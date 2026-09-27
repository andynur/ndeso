import type { QualityPreset } from '@bale/shared';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import { clampPixelRatio } from './quality/presets.ts';
import { buildPlaceholderCharAtlas, type CharPalette } from './sprites/placeholder-atlas.ts';
import { createAtlasTexture, type Sprite, SpriteBatch } from './sprites/sprite-batch.ts';

/** Camera rig constants, DESIGN §1.1. The full rig (follow, yaw snap, zoom) is M1-04. */
const FOV_DEG = 30;
const PITCH_DEG = 38;
const DISTANCE = 14;

/**
 * Noon keyframe from the DESIGN §1.3 lighting table. Those are lighting values, not
 * §2 palette tokens, so they are not in `ui/tokens.ts`; M1-07 moves the whole table
 * into `content/data/lighting.json5` and interpolates it from the game clock.
 * DESIGN fixes the ambient intensity at 0.7 but not the sun's — 2.5 reads correctly
 * under Three.js' physically-based light units.
 */
const NOON_SUN = { color: 0xfff4e0, intensity: 2.5 };
const NOON_AMBIENT = { color: 0xa8c4e0, intensity: 0.7 };

const GROUND_SIZE = 40;

/** Placeholder villagers: one walks a square round the house, four stand facing each way. */
const WALK_HALF_SIDE = 2.5;
const WALK_SPEED = 1.5;
/** Flanking the house, inside the landscape-phone frame at the default zoom. */
const IDLE_XS = [-6.5, -5, 5, 6.5] as const;
const IDLE_Z = 0.5;

/**
 * World colours the scene paints with, passed in rather than imported: ARCHITECTURE §2
 * forbids `render/` from importing `ui/`, so `main.ts` reads `ui/tokens.ts` and hands
 * the values down.
 */
export interface ScenePalette {
  readonly ground: number;
  readonly wall: number;
  readonly roof: number;
  readonly marker: number;
  readonly fog: number;
  readonly character: CharPalette;
}

export interface SceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly preset: QualityPreset;
  readonly palette: ScenePalette;
}

export interface SceneHandle {
  /** Current render scale; re-clamped whenever the canvas resizes onto another screen. */
  readonly pixelRatio: number;
  /**
   * Draws one frame at `simSeconds`, the sim time interpolated between ticks
   * (`(ticks + alpha) * TICK_MS / 1000`, ARCHITECTURE §4.1). The game loop owns the
   * frame timing; the scene never schedules itself.
   */
  draw(simSeconds: number): void;
  dispose(): void;
}

/**
 * M0-03 walking skeleton: a ground plane and a low-poly placeholder house, enough to
 * prove WebGL2 and the camera framing on a real phone, plus the M1-03 billboard sprites.
 * Area streaming (M1-09) and day/night lighting (M1-07) replace the contents; the
 * plumbing here stays.
 */
export function createScene({ canvas, preset, palette }: SceneOptions): SceneHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'default',
  });

  const scene = new Scene();
  scene.background = new Color(palette.fog);
  scene.fog = new Fog(palette.fog, DISTANCE, DISTANCE * 3);

  const camera = new PerspectiveCamera(FOV_DEG, 1, 0.1, 200);
  const pitch = (PITCH_DEG * Math.PI) / 180;
  camera.position.set(0, Math.sin(pitch) * DISTANCE, Math.cos(pitch) * DISTANCE);
  camera.lookAt(0, 1.2, 0);

  const sun = new DirectionalLight(NOON_SUN.color, NOON_SUN.intensity);
  sun.position.set(6, 10, 4);
  scene.add(sun, new AmbientLight(NOON_AMBIENT.color, NOON_AMBIENT.intensity));

  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new MeshLambertMaterial({ color: palette.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Placeholder "house": a terracotta-roofed block. Replaced by real art in M1-09.
  const placeholder = new Mesh(
    new BoxGeometry(2, 2, 2),
    new MeshLambertMaterial({ color: palette.wall }),
  );
  placeholder.position.y = 1;
  const roof = new Mesh(
    new CylinderGeometry(0, 1.9, 1.4, 4),
    new MeshLambertMaterial({ color: palette.roof, flatShading: true }),
  );
  roof.position.y = 1.7;
  roof.rotation.y = Math.PI / 4;
  placeholder.add(roof);

  const marker = new Mesh(
    new IcosahedronGeometry(0.4, 0),
    new MeshLambertMaterial({ color: palette.marker, flatShading: true }),
  );
  marker.position.set(0, 2.9, 0);
  placeholder.add(marker);
  scene.add(placeholder);

  const { atlas, pixels } = buildPlaceholderCharAtlas(palette.character);
  const atlasTexture = createAtlasTexture(pixels, atlas);
  const sprites = new SpriteBatch({ atlas, texture: atlasTexture, capacity: 64 });
  scene.add(sprites.mesh);
  const walker = sprites.add({ x: 0, y: 0, z: WALK_HALF_SIDE, tag: 'walk_side' });
  const idleFacings = [
    ['idle_down', false],
    ['idle_up', false],
    ['idle_side', false],
    ['idle_side', true],
  ] as const;
  idleFacings.forEach(([tag, flipX], i) => {
    // Staggered starts, so the four do not breathe in lockstep.
    sprites.add({ x: IDLE_XS[i] ?? 0, y: 0, z: IDLE_Z, tag, flipX, startSeconds: i * 0.3 });
  });

  let pixelRatio = 0;

  function resize(): void {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    // Re-read the DPR here: dragging a window between screens changes it.
    const next = clampPixelRatio(preset, globalThis.devicePixelRatio ?? 1);
    if (next !== pixelRatio) {
      pixelRatio = next;
      renderer.setPixelRatio(pixelRatio);
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  let contextLost = false;

  function draw(simSeconds: number): void {
    if (contextLost) return;
    walkSquare(walker, simSeconds);
    sprites.update(simSeconds);
    marker.position.y = 2.9 + Math.sin(simSeconds * 2) * 0.15;
    renderer.render(scene, camera);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // ARCHITECTURE §4.1: the browser drops the GL context on a backgrounded phone.
  // The sim is unaffected and keeps stepping; we only skip drawing until it is back.
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
  };
  const onContextRestored = (): void => {
    contextLost = false;
    resize();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  function dispose(): void {
    observer.disconnect();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    sprites.dispose();
    atlasTexture.dispose();
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || object === sprites.mesh) return;
      object.geometry.dispose();
      const { material } = object;
      for (const slot of Array.isArray(material) ? material : [material]) slot.dispose();
    });
    renderer.dispose();
  }

  return {
    get pixelRatio() {
      return pixelRatio;
    },
    draw,
    dispose,
  };
}

/**
 * Moves `sprite` round a square centred on the house (+x, -z, -x, +z legs) and
 * picks the walk tag from its heading, as seen by the camera at yaw 0: +z is towards the
 * camera (`down`), -z away (`up`), ±x the side view, mirrored for -x. Each side restarts
 * the walk cycle so a turn begins on the contact frame.
 */
function walkSquare(sprite: Sprite, simSeconds: number): void {
  const side = WALK_HALF_SIDE * 2;
  const sideSeconds = side / WALK_SPEED;
  const leg = Math.floor(simSeconds / sideSeconds) % 4;
  const along = (simSeconds % sideSeconds) * WALK_SPEED - WALK_HALF_SIDE;
  const h = WALK_HALF_SIDE;
  // A switch rather than a table of poses: this runs every frame and must not allocate.
  switch (leg) {
    case 0:
      setWalk(sprite, along, h, 'walk_side', false);
      break;
    case 1:
      setWalk(sprite, h, -along, 'walk_up', false);
      break;
    case 2:
      setWalk(sprite, -along, -h, 'walk_side', true);
      break;
    default:
      setWalk(sprite, -h, along, 'walk_down', false);
  }
  sprite.startSeconds = simSeconds - (simSeconds % sideSeconds);
}

function setWalk(sprite: Sprite, x: number, z: number, tag: string, flipX: boolean): void {
  sprite.x = x;
  sprite.z = z;
  sprite.tag = tag;
  sprite.flipX = flipX;
}
