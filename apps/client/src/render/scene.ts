import {
  AmbientLight,
  BoxGeometry,
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
import { clampPixelRatio, type QualityPreset } from '../platform/quality.ts';
import { colorHex } from '../ui/tokens.ts';

/** Camera rig constants, DESIGN §1.1. The full rig (follow, yaw snap, zoom) is M1-04. */
const FOV_DEG = 30;
const PITCH_DEG = 38;
const DISTANCE = 14;

const GROUND_SIZE = 40;
/** One full turn every 8 s, slow enough to read on a 30 fps phone. */
const SPIN_RAD_PER_SECOND = (Math.PI * 2) / 8;
/** ARCHITECTURE §4.1: never integrate more than 250 ms of real time in one frame. */
const MAX_FRAME_MS = 250;

export interface SceneHandle {
  readonly pixelRatio: number;
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface SceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly preset: QualityPreset;
}

/**
 * M0-03 walking skeleton: a ground plane and a rotating low-poly placeholder, enough to
 * prove WebGL2 + the camera framing on a real phone. Sprites (M1-03), area streaming and
 * day/night lighting (M1-07) replace the contents; the renderer plumbing here stays.
 */
export function createScene({ canvas, preset }: SceneOptions): SceneHandle {
  const pixelRatio = clampPixelRatio(preset, globalThis.devicePixelRatio ?? 1);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'default',
  });
  renderer.setPixelRatio(pixelRatio);

  const scene = new Scene();
  scene.fog = new Fog(colorHex('indigo700'), DISTANCE, DISTANCE * 3);

  const camera = new PerspectiveCamera(FOV_DEG, 1, 0.1, 200);
  const pitch = (PITCH_DEG * Math.PI) / 180;
  camera.position.set(0, Math.sin(pitch) * DISTANCE, Math.cos(pitch) * DISTANCE);
  camera.lookAt(0, 1.2, 0);

  // Noon keyframe from DESIGN §1.3. Driven by the game clock from M1-07 onwards.
  const sun = new DirectionalLight(colorHex('kapur50'), 2.2);
  sun.position.set(6, 10, 4);
  scene.add(sun, new AmbientLight(colorHex('hujan400'), 1.4));

  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new MeshLambertMaterial({ color: colorHex('sawah500') }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Placeholder "house": a terracotta-roofed block. Replaced by real art in M1-09.
  const placeholder = new Mesh(
    new BoxGeometry(2, 2, 2),
    new MeshLambertMaterial({ color: colorHex('kayu500') }),
  );
  placeholder.position.y = 1;
  const roof = new Mesh(
    new CylinderGeometry(0, 1.9, 1.4, 4),
    new MeshLambertMaterial({ color: colorHex('terakota500'), flatShading: true }),
  );
  roof.position.y = 1.7;
  roof.rotation.y = Math.PI / 4;
  placeholder.add(roof);

  const marker = new Mesh(
    new IcosahedronGeometry(0.4, 0),
    new MeshLambertMaterial({ color: colorHex('kunyit400'), flatShading: true }),
  );
  marker.position.set(0, 2.9, 0);
  placeholder.add(marker);
  scene.add(placeholder);

  function resize(): void {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  let frame = 0;
  let last = 0;
  let elapsed = 0;

  function draw(now: number): void {
    frame = requestAnimationFrame(draw);
    const delta = Math.min(now - last, MAX_FRAME_MS);
    last = now;
    elapsed += delta / 1000;
    placeholder.rotation.y = elapsed * SPIN_RAD_PER_SECOND;
    marker.position.y = 2.9 + Math.sin(elapsed * 2) * 0.15;
    renderer.render(scene, camera);
  }

  function start(): void {
    if (frame !== 0) return;
    last = performance.now();
    frame = requestAnimationFrame(draw);
  }

  function stop(): void {
    if (frame === 0) return;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // ARCHITECTURE §4.1: the browser drops the GL context on a backgrounded phone.
  // The sim is unaffected; we only have to stop asking for frames until it is back.
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    stop();
  };
  const onContextRestored = (): void => {
    resize();
    start();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  function dispose(): void {
    stop();
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

  return { pixelRatio, start, stop, dispose };
}
