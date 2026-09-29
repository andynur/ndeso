import {
  Color,
  DataTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  UniformsLib,
  UniformsUtils,
} from 'three';
import { frameAt } from './animation.ts';
import { frameUv, getTag, PPU, type SpriteAtlas } from './atlas.ts';

/**
 * One animated billboard. The batch hands these out; callers mutate the fields and the
 * next `update()` picks the change up. Position is the sprite's feet, in world units.
 */
export interface Sprite {
  x: number;
  y: number;
  z: number;
  /** Atlas tag name, e.g. `walk_down`. */
  tag: string;
  /** Mirror horizontally — the fourth, side-mirrored direction of DESIGN §1.2. */
  flipX: boolean;
  /** Sim time the current tag started; animation time counts from here. */
  startSeconds: number;
}

export type SpriteInit = Pick<Sprite, 'x' | 'y' | 'z' | 'tag'> & Partial<Sprite>;

/**
 * Cylindrical (Y-up) billboard: the quad turns about the vertical to face the camera but
 * stays upright, so sprites stand on the ground under the tilted DESIGN §1.1 camera. The
 * quad's size comes from the frame's pixel size at PPU 32, so frames of different sizes
 * share one batch.
 */
const VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform vec2 uAtlasSize;
uniform float uPpu;
attribute vec4 aUvRect;
varying vec2 vUv;

void main() {
  vec3 feet = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec2 size = abs(aUvRect.zw - aUvRect.xy) * uAtlasSize / uPpu;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  right = normalize(vec3(right.x, 0.0, right.z));
  vec3 world = feet + right * (position.x * size.x) + vec3(0.0, position.y * size.y, 0.0);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = mix(aUvRect.xy, aUvRect.zw, uv);
  #include <fog_vertex>
}
`;

/** Alpha cutout (DESIGN §1): no blending, so no sorting, and depth writes stay on. */
const FRAGMENT = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uMap;
uniform vec3 uTint;
varying vec2 vUv;

void main() {
  vec4 texel = texture2D(uMap, vUv);
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(texel.rgb * uTint, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** Pixel-art settings from DESIGN §1.2: nearest filtering, no mipmaps, sRGB. */
export function createAtlasTexture(pixels: Uint8Array, atlas: SpriteAtlas): DataTexture {
  const texture = new DataTexture(pixels, atlas.width, atlas.height, RGBAFormat);
  configureSpriteTexture(texture);
  // Match an image loaded by TextureLoader: atlas row 0 at the top (see `frameUv`).
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

export function configureSpriteTexture(texture: Texture): void {
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
}

export interface SpriteBatchOptions {
  readonly atlas: SpriteAtlas;
  readonly texture: Texture;
  /** Fixed instance capacity; the GPU buffers are sized once. */
  readonly capacity: number;
  /** Optional shared light tint, for several batches backed by one atlas. */
  readonly tint?: Color;
}

/**
 * ARCHITECTURE §4.2: one `InstancedMesh` per atlas, so every sprite on it costs one draw
 * call together. Per instance, the translation lives in `instanceMatrix` and the frame's
 * UV rect in the `aUvRect` attribute; the vertex shader does the rest.
 */
export class SpriteBatch {
  readonly mesh: InstancedMesh<PlaneGeometry, ShaderMaterial>;
  /** Light colour multiplied into every sprite; M1-07 drives it from the clock. */
  readonly tint: Color;
  private readonly sprites: Sprite[] = [];
  private readonly uvRects: InstancedBufferAttribute;
  /** Every frame's unflipped UV rect, computed once so `update` allocates nothing. */
  private readonly frameUvs: Float32Array;

  constructor(private readonly options: SpriteBatchOptions) {
    const { atlas, texture, capacity } = options;
    this.tint = options.tint ?? new Color(1, 1, 1);
    this.frameUvs = new Float32Array(atlas.frames.length * 4);
    for (let index = 0; index < atlas.frames.length; index++) {
      this.frameUvs.set(frameUv(atlas, index), index * 4);
    }

    const geometry = new PlaneGeometry(1, 1);
    // Anchor at the bottom centre: the sprite's position is where its feet are.
    geometry.translate(0, 0.5, 0);
    this.uvRects = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.uvRects.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aUvRect', this.uvRects);

    const material = new ShaderMaterial({
      // Only the fog block is cloned: `merge` deep-copies values, and a cloned texture
      // would upload twice while a cloned tint would stop following `this.tint`.
      uniforms: {
        ...UniformsUtils.clone(UniformsLib.fog),
        uAtlasSize: { value: [atlas.width, atlas.height] },
        uPpu: { value: PPU },
        uTint: { value: this.tint },
        uMap: { value: texture },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      fog: true,
    });

    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    // The bounding sphere Three.js derives from instanceMatrix ignores the quad's height
    // and the billboard turn. The whole batch is one draw call, so culling saves nothing.
    this.mesh.frustumCulled = false;
  }

  get size(): number {
    return this.sprites.length;
  }

  get capacity(): number {
    return this.options.capacity;
  }

  add(init: SpriteInit): Sprite {
    if (this.sprites.length >= this.options.capacity) {
      throw new RangeError(`sprite batch is full (${this.options.capacity})`);
    }
    getTag(this.options.atlas, init.tag);
    const sprite: Sprite = { flipX: false, startSeconds: 0, ...init };
    this.sprites.push(sprite);
    return sprite;
  }

  /** Swap-remove: the last sprite takes the freed slot, so the live range stays packed. */
  remove(sprite: Sprite): void {
    const index = this.sprites.indexOf(sprite);
    if (index < 0) return;
    const last = this.sprites.pop();
    if (last && last !== sprite) this.sprites[index] = last;
  }

  /** Clears the live range without reallocating its GPU buffers. */
  clear(): void {
    this.sprites.length = 0;
    this.mesh.count = 0;
  }

  /** Writes every sprite's position and current frame for sim time `simSeconds`. */
  update(simSeconds: number): void {
    const { atlas } = this.options;
    const matrices = this.mesh.instanceMatrix.array;
    const uvs = this.uvRects.array;
    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i] as Sprite;
      const m = i * 16;
      matrices[m + 12] = sprite.x;
      matrices[m + 13] = sprite.y;
      matrices[m + 14] = sprite.z;
      const frame = frameAt(atlas, sprite.tag, simSeconds - sprite.startSeconds);
      const f = frame * 4;
      const o = i * 4;
      // Mirroring swaps the left and right edges, as `frameUv(..., true)` does.
      uvs[o] = this.frameUvs[f + (sprite.flipX ? 2 : 0)] as number;
      uvs[o + 1] = this.frameUvs[f + 1] as number;
      uvs[o + 2] = this.frameUvs[f + (sprite.flipX ? 0 : 2)] as number;
      uvs[o + 3] = this.frameUvs[f + 3] as number;
    }
    this.mesh.count = this.sprites.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.uvRects.needsUpdate = true;
  }

  /** Frees the geometry and material. The texture belongs to the caller. */
  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
