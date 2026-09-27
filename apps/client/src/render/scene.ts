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
/** One full turn every 8 s, slow enough to read on a 30 fps phone. */
const SPIN_RAD_PER_SECOND = (Math.PI * 2) / 8;

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
 * M0-03 walking skeleton: a ground plane and a rotating low-poly placeholder, enough to
 * prove WebGL2 and the camera framing on a real phone. Sprites (M1-03), area streaming
 * and day/night lighting (M1-07) replace the contents; the plumbing here stays.
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
    placeholder.rotation.y = simSeconds * SPIN_RAD_PER_SECOND;
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
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
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
