import { CALENDAR_DATA } from '@bale/content/calendar';
import { TICK_MS } from '@bale/shared';
import { createGame } from './game/game.ts';
import { createLoop, type FrameScheduler } from './game/loop.ts';
import { initI18n, locale, t } from './i18n/index.ts';
import { guessPreset } from './render/quality/presets.ts';
import { type CameraControls, createScene, type ScenePalette } from './render/scene.ts';
import { mountOverlay } from './ui/mount.ts';
import { colorHex } from './ui/tokens.ts';

/** `tools/smoke.ts` (M2-19) waits for this before screenshotting. */
declare global {
  interface Window {
    __GAME_READY__?: true;
  }
}

/** ARCHITECTURE §2: `render/` may not import `ui/`, so the boot layer hands colours down. */
const PALETTE: ScenePalette = {
  ground: colorHex('sawah500'),
  wall: colorHex('kayu500'),
  roof: colorHex('terakota500'),
  marker: colorHex('kunyit400'),
  fog: colorHex('indigo700'),
  // Placeholder villager (M1-03); real character art replaces the whole atlas.
  character: {
    outline: colorHex('ink900'),
    skin: colorHex('kayu500'),
    hair: colorHex('indigo900'),
    shirt: colorHex('hujan400'),
    trousers: colorHex('indigo700'),
  },
};

const BROWSER_FRAMES: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
};

/** World units per wheel notch or +/- press. */
const ZOOM_STEP = 1;

/**
 * Stopgap camera bindings for desktop testing: Q/E turn, wheel and -/+ zoom. M1-05's input
 * layer replaces this and adds the touch controls; the camera is view state, not a sim
 * `Command`, so it will stay a direct call there too.
 */
function bindCameraKeys(camera: CameraControls): void {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    switch (event.key) {
      case 'q':
      case 'Q':
        camera.rotate(1);
        break;
      case 'e':
      case 'E':
        camera.rotate(-1);
        break;
      case '-':
        camera.zoomBy(ZOOM_STEP);
        break;
      case '+':
      case '=':
        camera.zoomBy(-ZOOM_STEP);
    }
  });
  window.addEventListener('wheel', (event) => camera.zoomBy(Math.sign(event.deltaY) * ZOOM_STEP), {
    passive: true,
  });
}

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage');
  const overlay = document.querySelector<HTMLElement>('#overlay');
  if (!canvas || !overlay) throw new Error('index.html is missing #stage or #overlay');

  await initI18n(navigator.languages);
  // `subscribe` fires immediately and again on every switch, so this covers both the
  // initial paint and a live locale change.
  locale.subscribe(() => {
    document.documentElement.lang = locale.value;
    document.title = t('app.title');
  });

  const preset = guessPreset({
    deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    cores: navigator.hardwareConcurrency,
    touch: matchMedia('(pointer: coarse)').matches,
  });

  const scene = createScene({ canvas, preset, palette: PALETTE });

  // PERFORMANCE_BUDGET §6: render telemetry belongs behind `?debug=perf`.
  const debug = new URLSearchParams(location.search).get('debug') === 'perf';
  mountOverlay(overlay, debug ? { stats: { preset, pixelRatio: scene.pixelRatio } } : {});

  const game = createGame(CALENDAR_DATA);
  const loop = createLoop(
    {
      step: game.step,
      frame(alpha, realDtMs) {
        scene.draw(((game.ticks + alpha) * TICK_MS) / 1000, realDtMs / 1000);
        // Nothing listens yet; the HUD clock (M1-08) is the first `ui.sync` consumer.
        game.drainEvents();
      },
    },
    BROWSER_FRAMES,
  );

  bindCameraKeys(scene.camera);

  // ARCHITECTURE §4.1: pause the sim and the renderer while hidden, so the game clock does
  // not run on in a background tab and the battery is spared. Saving first joins here once
  // there is a save (M2).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loop.stop();
    else loop.start();
  });

  if (!document.hidden) loop.start();
  window.__GAME_READY__ = true;
}

await boot();
