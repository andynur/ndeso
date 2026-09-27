import { createBootI18n } from './i18n/boot.ts';
import { guessPreset } from './platform/quality.ts';
import { createScene } from './render/scene.ts';
import { mountOverlay } from './ui/mount.ts';

/** `tools/smoke.ts` (M2-19) waits for this before screenshotting. */
declare global {
  interface Window {
    __GAME_READY__?: true;
  }
}

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

  const scene = createScene({ canvas, preset });
  mountOverlay(overlay, { i18n, preset, pixelRatio: scene.pixelRatio });

  // ARCHITECTURE §4.1: stop burning battery (and the frame budget) while hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.stop();
    else scene.start();
  });

  scene.start();
  window.__GAME_READY__ = true;
}

boot();
