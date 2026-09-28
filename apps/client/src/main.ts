import { CALENDAR_DATA } from '@bale/content/calendar';
import { TICK_MS } from '@bale/shared';
import { isWalking } from '@bale/sim';
import { createCommandMapper } from './game/commands.ts';
import { createGame } from './game/game.ts';
import { createLoop, type FrameScheduler } from './game/loop.ts';
import { createPlaceholderArea } from './game/placeholder-area.ts';
import { initI18n, locale, t } from './i18n/index.ts';
import { attachInput, createInput } from './platform/input/input.ts';
import { guessPreset } from './render/quality/presets.ts';
import { createScene, type PlayerView, type ScenePalette } from './render/scene.ts';
import { mountOverlay } from './ui/mount.ts';
import { colorHex } from './ui/tokens.ts';
import { stickView } from './ui/touch-controls.tsx';

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
  // GDD §12: keyboard, the floating stick, and the on-screen buttons all feed one input.
  const input = createInput((view) => {
    stickView.value = view;
  });
  attachInput(window, canvas, input);
  mountOverlay(overlay, {
    ...(debug ? { stats: { preset, pixelRatio: scene.pixelRatio } } : {}),
    controls: { onInteract: input.pressInteract, onTurn: input.pressRotate },
  });

  const game = createGame(CALENDAR_DATA, createPlaceholderArea());
  const { player } = game.state;
  // Reused every frame: the draw path must not allocate.
  const view: { x: number; z: number; facing: PlayerView['facing']; walking: boolean } = {
    x: 0,
    z: 0,
    facing: player.facing,
    walking: false,
  };
  const commands = createCommandMapper();
  const loop = createLoop(
    {
      step: game.step,
      frame(alpha, realDtMs) {
        const frame = input.sample();
        // The camera is view state (DESIGN §1.1), so it answers input directly; the sim only
        // hears world-space `Command`s, queued for the next tick.
        // One quarter turn per edge: a key and a button in the same frame are two turns.
        for (let i = 0; i < Math.abs(frame.rotate); i++) {
          scene.camera.rotate(frame.rotate > 0 ? 1 : -1);
        }
        if (frame.zoom !== 0) scene.camera.zoomBy(frame.zoom);
        commands.map(frame, scene.camera.yaw, game.submit);
        // ARCHITECTURE §4.1: render sits `alpha` of the way through the tick just stepped.
        const from = game.previousPos;
        view.x = from.x + (player.pos.x - from.x) * alpha;
        view.z = from.z + (player.pos.z - from.z) * alpha;
        view.facing = player.facing;
        view.walking = isWalking(player);
        scene.draw(((game.ticks + alpha) * TICK_MS) / 1000, realDtMs / 1000, view);
        // Nothing listens yet; the HUD clock (M1-08) is the first `ui.sync` consumer.
        game.drainEvents();
      },
    },
    BROWSER_FRAMES,
  );

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
