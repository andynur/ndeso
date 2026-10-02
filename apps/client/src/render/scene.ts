import type { AreaDef, LightingData, QualityPreset, WeatherId } from '@bale/shared';
import type { CropDef } from '@bale/shared/content';
import type { Dir } from '@bale/sim';
import {
  AmbientLight,
  DirectionalLight,
  Fog,
  type Group,
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
import { CropView, type FarmTilesView, type WateredSoilPalette } from './crops/crop-view.ts';
import type { CropPalette } from './crops/placeholder-crop-atlas.ts';
import { createDayNight, createLightingSample } from './lighting/day-night.ts';
import { clampPixelRatio, QUALITY } from './quality/presets.ts';
import {
  type AnimalPalette,
  buildPlaceholderAnimalAtlas,
} from './sprites/placeholder-animal-atlas.ts';
import {
  buildPlaceholderCharAtlas,
  buildPlaceholderCharAtlasVariants,
  type CharPalette,
} from './sprites/placeholder-atlas.ts';
import { createAtlasTexture, type Sprite, SpriteBatch } from './sprites/sprite-batch.ts';
import { RainField } from './weather/rain-field.ts';

/** How far the sun sits from the follow target, along its direction. */
const SUN_DISTANCE = 30;
/**
 * Half the edge of the sun's shadow box, centred on the follow target: the whole frame at
 * the widest zoom, and no more, so 512 texels still give crisp edges on Medium.
 */
const SHADOW_HALF = 14;

/**
 * Teras lamps (DESIGN §1.3: point lights, max 4 active; PERFORMANCE_BUDGET §4 caps them per
 * preset) at the area's lamp points. The warm colour is the maghrib sun's: a lamp is lit by
 * the same kerosene-orange hour.
 */
const LAMP_COLOR = 0xff9a4d;
const LAMP_INTENSITY = 6;
const LAMP_RANGE = 7;

/** A plain plane to stand on until the area's models have loaded (or if they cannot). */
const FALLBACK_GROUND_SIZE = 40;

/** The player as the sim last left them, interpolated to this frame (`game/game.ts`). */
export interface PlayerView {
  readonly x: number;
  readonly z: number;
  readonly facing: Dir;
  readonly moving: boolean;
}

/** Read-only NPC projection; authored schedule and movement remain sim-owned. */
export interface NpcView extends PlayerView {
  readonly id: string;
  readonly area: string;
  readonly anim: string;
  readonly active: boolean;
}

export interface AnimalView {
  readonly id: string;
  readonly area: string;
  readonly affection: number;
  readonly fed: boolean;
}

/**
 * World colours the scene paints with, passed in rather than imported: ARCHITECTURE §2
 * forbids `render/` from importing `ui/`, so `main.ts` reads `ui/tokens.ts` and hands
 * the values down.
 */
export interface ScenePalette {
  /** The fallback ground plane shown before the area's models arrive. */
  readonly ground: number;
  readonly character: CharPalette;
  readonly npcCharacters: readonly { readonly id: string; readonly palette: CharPalette }[];
  readonly crop: CropPalette;
  readonly wateredSoil: WateredSoilPalette;
  readonly animal: AnimalPalette;
}

export interface SceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly preset: QualityPreset;
  readonly palette: ScenePalette;
  /** DESIGN §1.3 keyframes, `content/data/lighting.json5`. */
  readonly lighting: LightingData;
  /** The area on screen: its spawn frames the camera and its lamp points light the night. */
  readonly area: AreaDef;
  /** Crop definitions determine the placeholder atlas tags and growth-stage thresholds. */
  readonly crops: readonly CropDef[];
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
   * Shows the area's loaded models (`render/world/area-models.ts`) in place of the fallback
   * ground. The scene owns and disposes them from then on.
   */
  setWorld(world: Group): void;
  /** High keeps the previous parsed area in memory for a fast return trip. */
  hasCachedArea(areaId: string): boolean;
  /** Atomically replaces the streamed area while the DOM fade is opaque. */
  setArea(area: AreaDef, world?: Group): void;
  /** Rebuilds farm instances after a farm event; never called every render frame. */
  syncFarm(tiles: FarmTilesView): void;
  /**
   * Draws one frame at `simSeconds`, the sim time interpolated between ticks
   * (`(ticks + alpha) * TICK_MS / 1000`, ARCHITECTURE §4.1). The game loop owns the
   * frame timing; the scene never schedules itself. `realDtSeconds` is wall-clock frame
   * time, which the camera runs on so it still eases while the sim is paused.
   * `clockMinute` is the game clock (`ClockState.minute` plus the fraction of the minute
   * elapsed), which drives the day/night lighting. `player` is drawn and followed.
   */
  draw(
    simSeconds: number,
    realDtSeconds: number,
    clockMinute: number,
    weather: WeatherId,
    player: PlayerView,
    npcs: readonly NpcView[],
    animals: readonly AnimalView[],
  ): void;
  readonly camera: CameraControls;
  dispose(): void;
}

/**
 * The world view: the area's models (M1-09) under the clock-driven light (M1-07) and the
 * preset's shadows (M1-08), with the M1-03 billboard sprites on top. The scene starts on a
 * fallback ground plane and swaps in the area once its models have loaded.
 */
export function createScene(options: SceneOptions): SceneHandle {
  const { canvas, palette, lighting, crops } = options;
  let area = options.area;
  const [spawnX, spawnZ] = area.spawn;
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

  let fallbackGround: Mesh | undefined = new Mesh(
    new PlaneGeometry(FALLBACK_GROUND_SIZE, FALLBACK_GROUND_SIZE),
    new MeshLambertMaterial({ color: palette.ground }),
  );
  fallbackGround.rotation.x = -Math.PI / 2;
  fallbackGround.receiveShadow = true;
  scene.add(fallbackGround);

  const { atlas, pixels } = buildPlaceholderCharAtlas(palette.character);
  const atlasTexture = createAtlasTexture(pixels, atlas);
  const sprites = new SpriteBatch({ atlas, texture: atlasTexture, capacity: 1 });
  scene.add(sprites.mesh);
  const npcAtlasData = buildPlaceholderCharAtlasVariants(palette.npcCharacters);
  const npcAtlasTexture = createAtlasTexture(npcAtlasData.pixels, npcAtlasData.atlas);
  const npcSprites = new SpriteBatch({
    atlas: npcAtlasData.atlas,
    texture: npcAtlasTexture,
    capacity: palette.npcCharacters.length,
  });
  scene.add(npcSprites.mesh);
  const animalAtlasData = buildPlaceholderAnimalAtlas(palette.animal);
  const animalAtlasTexture = createAtlasTexture(animalAtlasData.pixels, animalAtlasData.atlas);
  const animalSprites = new SpriteBatch({
    atlas: animalAtlasData.atlas,
    texture: animalAtlasTexture,
    capacity: 1,
  });
  scene.add(animalSprites.mesh);
  const coop = area.coop ?? [0, 0];
  const animalSprite = animalSprites.add({
    x: coop[0] + 0.5,
    y: 0.35,
    z: coop[1] + 0.5,
    tag: 'hungry',
  });
  let cropView = new CropView({
    areaId: area.id,
    crops,
    capacity: area.field ? area.field.w * area.field.d : 1,
    cropPalette: palette.crop,
    soilPalette: palette.wateredSoil,
  });
  scene.add(cropView.group);
  const rain = new RainField();
  scene.add(rain.points);
  let weather: WeatherId = 'clear';
  let currentWorld: Group | undefined;
  const worldCache = new Map<string, Group>();
  // The player, the camera's follow target; placed by `draw` from the sim every frame.
  const playerSprite = sprites.add({ x: spawnX, y: 0, z: spawnZ, tag: 'idle_down' });
  rig.snapTo(spawnX, spawnZ);
  let playerWasMoving = false;
  const npcSpriteById = new Map<string, Sprite>();
  for (const [index, character] of palette.npcCharacters.entries()) {
    npcSpriteById.set(
      character.id,
      npcSprites.add({
        x: 0,
        y: 0,
        z: 0,
        tag: `${character.id}_idle_down`,
        startSeconds: index * 0.3,
        visible: false,
      }),
    );
  }
  const facing: Facing = { facing: 'down', flipX: false };

  /** Picks the tag for a world heading as the camera currently sees it. */
  function face(
    sprite: Sprite,
    action: 'idle' | 'walk',
    dx: number,
    dz: number,
    prefix = '',
  ): void {
    rig.screenFacing(dx, dz, facing);
    sprite.tag = `${prefix}${TAGS[action][facing.facing]}`;
    sprite.flipX = facing.flipX;
  }

  let pixelRatio = 0;

  /** Applies everything the preset owns except the pixel ratio, which `resize` sets. */
  function applyPreset(): void {
    const quality = QUALITY[preset];
    if (preset !== 'high') {
      for (const cached of worldCache.values()) disposeWorld(cached);
      worldCache.clear();
    }
    rain.setWeather(weather, quality.rainParticles);
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
    while (lamps.length > 0) lamps.pop()?.removeFromParent();
    for (const [x, y, z] of area.lamps.slice(lamps.length, quality.lamps)) {
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
    const cover =
      weather === 'cloudy' ? 0.35 : weather === 'rain' ? 0.8 : weather === 'storm' ? 1 : 0;
    dayNight.sample(clockMinute, cover, light);
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
    npcSprites.tint.setRGB(light.spriteTint[0], light.spriteTint[1], light.spriteTint[2]);
    animalSprites.tint.setRGB(light.spriteTint[0], light.spriteTint[1], light.spriteTint[2]);
    cropView.tint.setRGB(light.spriteTint[0], light.spriteTint[1], light.spriteTint[2]);
    for (const lamp of lamps) lamp.intensity = light.lamps * LAMP_INTENSITY;
  }

  function draw(
    simSeconds: number,
    realDtSeconds: number,
    clockMinute: number,
    nextWeather: WeatherId,
    player: PlayerView,
    npcs: readonly NpcView[],
    animals: readonly AnimalView[],
  ): void {
    if (nextWeather !== weather) {
      weather = nextWeather;
      rain.setWeather(weather, QUALITY[preset].rainParticles);
    }
    playerSprite.x = player.x;
    playerSprite.z = player.z;
    // The rig keeps easing while the context is lost, so it is settled when it returns.
    rig.follow(player.x, player.z);
    rig.update(realDtSeconds);
    if (contextLost) return;
    // Setting off restarts the walk cycle, so a step begins on the contact frame.
    if (player.moving && !playerWasMoving) playerSprite.startSeconds = simSeconds;
    playerWasMoving = player.moving;
    const heading = HEADINGS[player.facing];
    face(playerSprite, player.moving ? 'walk' : 'idle', heading[0], heading[1]);
    for (const npc of npcs) {
      const sprite = npcSpriteById.get(npc.id);
      if (!sprite) continue;
      const visible = npc.active && npc.area === area.id;
      if (visible && npc.moving && (!sprite.visible || !sprite.tag.includes('_walk_'))) {
        sprite.startSeconds = simSeconds;
      }
      sprite.visible = visible;
      if (!visible) continue;
      sprite.x = npc.x;
      sprite.z = npc.z;
      const npcHeading = HEADINGS[npc.facing];
      face(sprite, npc.moving ? 'walk' : 'idle', npcHeading[0], npcHeading[1], `${npc.id}_`);
    }
    sprites.update(simSeconds);
    npcSprites.update(simSeconds);
    const chicken = animals[0];
    animalSprite.visible = chicken?.area === area.id;
    if (chicken) {
      animalSprite.tag = chicken.fed ? (chicken.affection >= 4 ? 'happy' : 'idle') : 'hungry';
    }
    animalSprites.update(simSeconds);

    rig.pose(cameraPose);
    rain.update(simSeconds, cameraPose.lookX, cameraPose.lookZ);
    applyLighting(clockMinute);
    camera.position.set(cameraPose.x, cameraPose.y, cameraPose.z);
    camera.lookAt(cameraPose.lookX, cameraPose.lookY, cameraPose.lookZ);
    // Fog starts at the follow target and is total at the keyframe's multiple of the camera
    // distance, so it tracks zoom and thickens into the maghrib haze.
    fog.near = rig.distance;
    fog.far = rig.distance * light.fog;
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
    npcSprites.dispose();
    npcAtlasTexture.dispose();
    animalSprites.dispose();
    animalAtlasTexture.dispose();
    cropView.group.removeFromParent();
    cropView.dispose();
    rain.points.removeFromParent();
    rain.dispose();
    scene.traverse((object) => {
      if (
        !(object instanceof Mesh) ||
        object === sprites.mesh ||
        object === npcSprites.mesh ||
        object === animalSprites.mesh
      )
        return;
      object.geometry.dispose();
      const { material } = object;
      for (const slot of Array.isArray(material) ? material : [material]) slot.dispose();
    });
    renderer.dispose();
    for (const cached of worldCache.values()) disposeWorld(cached);
    worldCache.clear();
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
    setWorld(world) {
      if (fallbackGround) {
        fallbackGround.removeFromParent();
        fallbackGround.geometry.dispose();
        (fallbackGround.material as MeshLambertMaterial).dispose();
        fallbackGround = undefined;
      }
      currentWorld = world;
      scene.add(world);
    },
    hasCachedArea: (areaId) => worldCache.has(areaId),
    setArea(nextArea, world) {
      currentWorld?.removeFromParent();
      if (currentWorld) {
        if (preset === 'high') worldCache.set(area.id, currentWorld);
        else disposeWorld(currentWorld);
      }
      if (fallbackGround) {
        fallbackGround.removeFromParent();
        fallbackGround.geometry.dispose();
        (fallbackGround.material as MeshLambertMaterial).dispose();
        fallbackGround = undefined;
      }
      area = nextArea;
      const cached = worldCache.get(area.id);
      if (cached) worldCache.delete(area.id);
      if (cached && world) disposeWorld(world);
      currentWorld = cached ?? world;
      if (currentWorld) scene.add(currentWorld);
      else {
        fallbackGround = new Mesh(
          new PlaneGeometry(
            area.size[0] + FALLBACK_GROUND_SIZE,
            area.size[1] + FALLBACK_GROUND_SIZE,
          ),
          new MeshLambertMaterial({ color: palette.ground }),
        );
        fallbackGround.rotation.x = -Math.PI / 2;
        fallbackGround.receiveShadow = true;
        scene.add(fallbackGround);
      }
      cropView.group.removeFromParent();
      cropView.dispose();
      cropView = new CropView({
        areaId: area.id,
        crops,
        capacity: area.field ? area.field.w * area.field.d : 1,
        cropPalette: palette.crop,
        soilPalette: palette.wateredSoil,
      });
      scene.add(cropView.group);
      const nextCoop = area.coop;
      animalSprite.x = (nextCoop?.[0] ?? 0) + 0.5;
      animalSprite.z = (nextCoop?.[1] ?? 0) + 0.5;
      rig.snapTo(area.spawn[0], area.spawn[1]);
      applyPreset();
    },
    syncFarm: (tiles) => cropView.sync(tiles),
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

/** World heading `(dx, dz)` of each sim facing; north is −z. */
const HEADINGS: Readonly<Record<Dir, readonly [number, number]>> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
};

function disposeWorld(world: Group): void {
  world.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const material = object.material;
    for (const slot of Array.isArray(material) ? material : [material]) slot.dispose();
  });
}
