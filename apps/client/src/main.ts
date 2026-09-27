import { createBootI18n } from './i18n/boot.ts';
import { guessPreset } from './render/quality/presets.ts';
import { createScene, type ScenePalette } from './render/scene.ts';
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
};

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage');
  const overlay = document.querySelector<HTMLElement>('#overlay');
  if (!canvas || !overlay) throw new Error('index.html is missing #stage or #overlay');

  const i18n = createBootI18n(navigator.languages);
  document.documentElement.lang = i18n.locale;
  document.title = i18n.t('app.title');

  const preset = guessPreset({
    deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    cores: navigator.hardwareConcurrency,
    touch: matchMedia('(pointer: coarse)').matches,
  });

  const scene = createScene({ canvas, preset, palette: PALETTE });

  // PERFORMANCE_BUDGET §6: render telemetry belongs behind `?debug=perf`.
  const debug = new URLSearchParams(location.search).get('debug') === 'perf';
  mountOverlay(overlay, {
    i18n,
    ...(debug ? { stats: { preset, pixelRatio: scene.pixelRatio } } : {}),
  });

  // ARCHITECTURE §4.1: stop burning battery (and the frame budget) while hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.stop();
    else scene.start();
  });

  scene.start();
  window.__GAME_READY__ = true;
}

boot();
