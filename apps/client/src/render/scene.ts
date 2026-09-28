import type { LightingData, QualityPreset } from '@bale/shared';
import {
  AmbientLight,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  PCFShadowMap,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three';
import { type CameraPose, CameraRig, type Facing, FOV_DEG } from './camera/camera-rig.ts';
import { createDayNight, createLightingSample } from './lighting/day-night.ts';
import { clampPixelRatio, QUALITY } from './quality/presets.ts';
import { buildPlaceholderCharAtlas, type CharPalette } from './sprites/placeholder-atlas.ts';
import { createAtlasTexture, type Sprite, SpriteBatch } from './sprites/sprite-batch.ts';

/** How far the sun sits from the follow target, along its direction. */
const SUN_DISTANCE = 30;
/**
 * Half the edge of the sun's shadow box, centred on the follow target: the whole frame at
 * the widest zoom, and no more, so 512 texels still give crisp edges on Medium.
 */
const SHADOW_HALF = 14;

/**
 * Teras lamps (DESIGN §1.3: point lights, max 4 active; PERFORMANCE_BUDGET §4 caps them per
 * preset). Placeholder spot beside the house door until the Balé layout (M1-09) owns them.
 * The warm colour is the maghrib sun's: a lamp is lit by the same kerosene-orange hour.
 */
const LAMP_POSITIONS: readonly (readonly [number, number, number])[] = [[1.4, 1.6, 1.4]];
const LAMP_COLOR = 0xff9a4d;
const LAMP_INTENSITY = 6;
const LAMP_RANGE = 7;

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
  readonly character: CharPalette;
}

export interface SceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly preset: QualityPreset;
  readonly palette: ScenePalette;
  /** DESIGN §1.3 keyframes, `content/data/lighting.json5`. */
  readonly lighting: LightingData;
}

/** What the input layer may do to the camera (DESIGN §1.1). */
export interface CameraControls {
  /**
   * The displayed yaw in radians, easing through a turn. Input maps screen-relative
   * movement through it, so "up" on the stick stays "away from the camera" mid-turn.
   */
  readonly yaw: number;
  /** One quarter turn: `+1` counter-clockwise seen from above, `-1` clockwise. */
  rotate(direction: 1 | -1): void;
  /** Zoom by `delta` world units, positive = out; clamped to 10–18. */
  zoomBy(delta: number): void;
}

/** `renderer.info` for the perf overlay (PERFORMANCE_BUDGET §6). */
export interface RenderStats {
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  programs: number;
}

export interface SceneHandle {
  /** Device pixel ratio actually rendered: the preset cap × the dynamic render scale. */
  readonly pixelRatio: number;
  readonly preset: QualityPreset;
  /** Switches the quality preset live: DPR cap, shadows, and lamp count (PERF §4). */
  setPreset(preset: QualityPreset): void;
  /** Dynamic resolution (PERF §4): multiplies the preset's pixel ratio, 0.6–1. */
  setRenderScale(scale: number): void;
  /** Copies the last frame's renderer counters into `out`. */
  stats(out: RenderStats): RenderStats;
  /**
   * Draws one frame at `simSeconds`, the sim time interpolated between ticks
   * (`(ticks + alpha) * TICK_MS / 1000`, ARCHITECTURE §4.1). The game loop owns the
   * frame timing; the scene never schedules itself. `realDtSeconds` is wall-clock frame
   * time, which the camera runs on so it still eases while the sim is paused.
   * `clockMinute` is the game clock (`ClockState.minute` plus the fraction of the minute
   * elapsed), which drives the day/night lighting.
   */
  draw(simSeconds: number, realDtSeconds: number, clockMinute: number): void;
  readonly camera: CameraControls;
  dispose(): void;
}

/**
 * M0-03 walking skeleton: a ground plane and a low-poly placeholder house, enough to
 * prove WebGL2 and the camera framing on a real phone, plus the M1-03 billboard sprites.
 * Area streaming (M1-09) and day/night lighting (M1-07) replace the contents; the
 * plumbing here stays.
 */
export function createScene(options: SceneOptions): SceneHandle {
  const { canvas, palette, lighting } = options;
  let preset = options.preset;
  let renderScale = 1;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'default',
  });

  const scene = new Scene();
  const rig = new CameraRig();
  const fog = new Fog(0x000000, rig.distance, rig.distance * 3);
  scene.fog = fog;
  // One colour object for fog and background, so the far field melts into the sky.
  const sky = fog.color;
  scene.background = sky;

  const camera = new PerspectiveCamera(FOV_DEG, 1, 0.1, 200);
  const cameraPose: CameraPose = { x: 0, y: 0, z: 0, lookX: 0, lookY: 0, lookZ: 0 };

  // DESIGN §1.3: every light is driven by the clock through `applyLighting`.
  const dayNight = createDayNight(lighting);
  const light = createLightingSample();
  const sun = new DirectionalLight();
  const ambient = new AmbientLight();
  // The sun aims at its target, which follows the camera so the shadow box stays on screen.
  scene.add(sun, sun.target, ambient);
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -SHADOW_HALF;
  shadowCamera.right = SHADOW_HALF;
  shadowCamera.top = SHADOW_HALF;
  shadowCamera.bottom = -SHADOW_HALF;
  shadowCamera.near = 1;
  shadowCamera.far = SUN_DISTANCE * 2;
  sun.shadow.bias = -0.0005;
  // A fixed number of lamps per preset: adding or removing a light recompiles every lit
  // material, so a lamp that is "off" stays in the scene at intensity 0 and the count only
  // changes with the preset.
  const lamps: PointLight[] = [];

  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new MeshLambertMaterial({ color: palette.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Placeholder "house": a terracotta-roofed block. Replaced by real art in M1-09.
  const placeholder = new Mesh(
    new BoxGeometry(2, 2, 2),
    new MeshLambertMaterial({ color: palette.wall }),
  );
  placeholder.position.y = 1;
  placeholder.castShadow = true;
  placeholder.receiveShadow = true;
  const roof = new Mesh(
    new CylinderGeometry(0, 1.9, 1.4, 4),
    new MeshLambertMaterial({ color: palette.roof, flatShading: true }),
  );
  roof.position.y = 1.7;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
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
  // The walker stands in for the player (M1-06) as the camera's follow target.
  const walker = sprites.add({ x: 0, y: 0, z: WALK_HALF_SIDE, tag: 'walk_side' });
  rig.snapTo(walker.x, walker.z);
  // World headings (dx, dz): at yaw 0 these face down, up, right and left.
  const idleHeadings = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const;
  const idlers = idleHeadings.map(([dx, dz], i) => ({
    // Staggered starts, so the four do not breathe in lockstep.
    sprite: sprites.add({
      x: IDLE_XS[i] ?? 0,
      y: 0,
      z: IDLE_Z,
      tag: 'idle_down',
      startSeconds: i * 0.3,
    }),
    dx,
    dz,
  }));
  const facing: Facing = { facing: 'down', flipX: false };

  /** Picks the tag for a world heading as the camera currently sees it. */
  function face(sprite: Sprite, action: 'idle' | 'walk', dx: number, dz: number): void {
    rig.screenFacing(dx, dz, facing);
    sprite.tag = TAGS[action][facing.facing];
    sprite.flipX = facing.flipX;
  }

  let pixelRatio = 0;

  /** Applies everything the preset owns except the pixel ratio, which `resize` sets. */
  function applyPreset(): void {
    const quality = QUALITY[preset];
    const shadows = quality.shadowMapSize > 0;
    const shadowType = quality.softShadows ? PCFSoftShadowMap : PCFShadowMap;
    const shadowsChanged =
      renderer.shadowMap.enabled !== shadows || renderer.shadowMap.type !== shadowType;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = shadowType;
    sun.castShadow = shadows;
    if (shadows && sun.shadow.mapSize.x !== quality.shadowMapSize) {
      sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      // The next render allocates a map at the new size.
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    while (lamps.length > quality.lamps) lamps.pop()?.removeFromParent();
    for (const [x, y, z] of LAMP_POSITIONS.slice(lamps.length, quality.lamps)) {
      const lamp = new PointLight(LAMP_COLOR, 0, LAMP_RANGE, 2);
      lamp.position.set(x, y, z);
      scene.add(lamp);
      lamps.push(lamp);
    }
    // Toggling the shadow map is baked into every lit program; light counts are not.
    if (shadowsChanged) {
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const { material } = object;
        for (const slot of Array.isArray(material) ? material : [material]) {
          slot.needsUpdate = true;
        }
      });
    }
  }

  function resize(): void {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    // Re-read the DPR here: dragging a window between screens changes it.
    const next = clampPixelRatio(preset, globalThis.devicePixelRatio ?? 1) * renderScale;
    if (next !== pixelRatio) {
      pixelRatio = next;
      renderer.setPixelRatio(pixelRatio);
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  let contextLost = false;

  function applyLighting(clockMinute: number): void {
    // Weather does not exist yet (M2), so rain is always 0.
    dayNight.sample(clockMinute, 0, light);
    sun.color.setRGB(light.sun[0], light.sun[1], light.sun[2]);
    sun.intensity = light.sunIntensity;
    const [dx, dy, dz] = light.sunDirection;
    const { lookX, lookZ } = cameraPose;
    sun.target.position.set(lookX, 0, lookZ);
    sun.position.set(lookX + dx * SUN_DISTANCE, dy * SUN_DISTANCE, lookZ + dz * SUN_DISTANCE);
    ambient.color.setRGB(light.ambient[0], light.ambient[1], light.ambient[2]);
    ambient.intensity = light.ambientIntensity;
    sky.setRGB(light.haze[0], light.haze[1], light.haze[2]);
    sprites.tint.setRGB(light.spriteTint[0], light.spriteTint[1], light.spriteTint[2]);
    for (const lamp of lamps) lamp.intensity = light.lamps * LAMP_INTENSITY;
  }

  function draw(simSeconds: number, realDtSeconds: number, clockMinute: number): void {
    // The rig keeps easing while the context is lost, so it is settled when it returns.
    const leg = walkSquare(walker, simSeconds);
    rig.follow(walker.x, walker.z);
    rig.update(realDtSeconds);
    if (contextLost) return;
    face(walker, 'walk', LEG_HEADINGS[leg * 2] ?? 0, LEG_HEADINGS[leg * 2 + 1] ?? 0);
    for (const idler of idlers) face(idler.sprite, 'idle', idler.dx, idler.dz);
    sprites.update(simSeconds);

    rig.pose(cameraPose);
    applyLighting(clockMinute);
    camera.position.set(cameraPose.x, cameraPose.y, cameraPose.z);
    camera.lookAt(cameraPose.lookX, cameraPose.lookY, cameraPose.lookZ);
    // Fog starts at the follow target and is total at the keyframe's multiple of the camera
    // distance, so it tracks zoom and thickens into the maghrib haze.
    fog.near = rig.distance;
    fog.far = rig.distance * light.fog;
    marker.position.y = 2.9 + Math.sin(simSeconds * 2) * 0.15;
    renderer.render(scene, camera);
  }

  applyPreset();
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
    get preset() {
      return preset;
    },
    setPreset(next) {
      if (next === preset) return;
      preset = next;
      applyPreset();
      resize();
    },
    setRenderScale(scale) {
      if (scale === renderScale) return;
      renderScale = scale;
      resize();
    },
    stats(out) {
      const { render, memory, programs } = renderer.info;
      out.drawCalls = render.calls;
      out.triangles = render.triangles;
      out.textures = memory.textures;
      out.geometries = memory.geometries;
      out.programs = programs?.length ?? 0;
      return out;
    },
    draw,
    camera: {
      get yaw() {
        return rig.yaw;
      },
      rotate: (direction) => rig.rotate(direction),
      zoomBy: (delta) => rig.zoomBy(delta),
    },
    dispose,
  };
}

/** Atlas tags by action and screen facing; a table so the per-frame pick builds no strings. */
const TAGS = {
  idle: { down: 'idle_down', up: 'idle_up', side: 'idle_side' },
  walk: { down: 'walk_down', up: 'walk_up', side: 'walk_side' },
} as const;

/** World heading `(dx, dz)` of each leg of the walk: +x, -z, -x, +z. */
const LEG_HEADINGS = [1, 0, 0, -1, -1, 0, 0, 1] as const;

/**
 * Moves `sprite` round a square centred on the house and returns which leg (0–3) it is
 * on; the caller turns the leg's heading into a tag for the current camera yaw. Each side
 * restarts the walk cycle so a turn begins on the contact frame.
 */
function walkSquare(sprite: Sprite, simSeconds: number): number {
  const side = WALK_HALF_SIDE * 2;
  const sideSeconds = side / WALK_SPEED;
  const leg = Math.floor(simSeconds / sideSeconds) % 4;
  const along = (simSeconds % sideSeconds) * WALK_SPEED - WALK_HALF_SIDE;
  const h = WALK_HALF_SIDE;
  // A switch rather than a table of poses: this runs every frame and must not allocate.
  switch (leg) {
    case 0:
      sprite.x = along;
      sprite.z = h;
      break;
    case 1:
      sprite.x = h;
      sprite.z = -along;
      break;
    case 2:
      sprite.x = -along;
      sprite.z = -h;
      break;
    default:
      sprite.x = -h;
      sprite.z = along;
  }
  sprite.startSeconds = simSeconds - (simSeconds % sideSeconds);
  return leg;
}
