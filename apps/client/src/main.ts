import { BALE_AREA } from '@bale/content/areas';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { CROP_DATA } from '@bale/content/crops';
import { ITEM_DATA, TOOL_DATA } from '@bale/content/inventory';
import { LIGHTING_DATA } from '@bale/content/lighting';
import { PLAYER_DATA } from '@bale/content/player';
import { WEATHER_DATA } from '@bale/content/weather';
import { parseAssetManifest, TICK_MS } from '@bale/shared';
import { createGameState } from '@bale/sim';
import { clockViewOf } from './game/clock-view.ts';
import { createCommandMapper } from './game/commands.ts';
import { createGame, type PlayerPose, parseStartClock, parseStartWeather } from './game/game.ts';
import { createLoop, type FrameScheduler } from './game/loop.ts';
import { PerfMeter } from './game/perf-meter.ts';
import { createQualityControl, initialPreset, type QualityControl } from './game/quality.ts';
import { initI18n, loadNamespace, locale, t } from './i18n/index.ts';
import { attachInput, createInput } from './platform/input/input.ts';
import { localSettings } from './platform/settings.ts';
import { cropViewNeedsSync } from './render/crops/crop-view.ts';
import { guessPreset } from './render/quality/presets.ts';
import {
  createScene,
  type RenderStats,
  type SceneHandle,
  type ScenePalette,
} from './render/scene.ts';
import { loadAreaModels } from './render/world/area-models.ts';
import { hotbarView, inventoryViewOf } from './ui/hotbar.tsx';
import { clockView } from './ui/hud-clock.tsx';
import { mountOverlay } from './ui/mount.ts';
import { perfView } from './ui/perf-overlay.tsx';
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
  // Placeholder villager (M1-03); real character art replaces the whole atlas.
  character: {
    outline: colorHex('ink900'),
    skin: colorHex('kayu500'),
    hair: colorHex('indigo900'),
    shirt: colorHex('hujan400'),
    trousers: colorHex('indigo700'),
  },
  crop: {
    leaf: colorHex('sawah500'),
    leafDark: colorHex('sawah700'),
    ripe: colorHex('kunyit400'),
    fruit: colorHex('bahaya500'),
    earth: colorHex('kayu500'),
    withered: colorHex('ink500'),
  },
  wateredSoil: {
    earth: colorHex('kayu500'),
    water: colorHex('hujan400'),
  },
};

const BROWSER_FRAMES: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
};

async function loadWorld(scene: SceneHandle): Promise<void> {
  const manifestUrl = new URL('assets/manifest.json', document.baseURI);
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`${manifestUrl.href}: HTTP ${response.status}`);
    const manifest = parseAssetManifest(await response.json());
    if (!manifest) throw new Error(`${manifestUrl.href} is not an asset manifest`);
    scene.setWorld(await loadAreaModels(BALE_AREA, manifest, manifestUrl));
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: a missing world must be visible to a developer.
    console.error('[assets] area models failed to load; showing the fallback ground', error);
  }
}

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage');
  const overlay = document.querySelector<HTMLElement>('#overlay');
  if (!canvas || !overlay) throw new Error('index.html is missing #stage or #overlay');

  await initI18n(navigator.languages);
  // The HUD clock names the months (GDD §3.2).
  await loadNamespace('calendar');
  await loadNamespace('items');
  // `subscribe` fires immediately and again on every switch, so this covers both the
  // initial paint and a live locale change.
  locale.subscribe(() => {
    document.documentElement.lang = locale.value;
    document.title = t('app.title');
  });

  const params = new URLSearchParams(location.search);
  // PERFORMANCE_BUDGET §4: `?quality=` → the stored choice → a guess the benchmark checks.
  const quality = initialPreset(params.get('quality'), localSettings, () =>
    guessPreset({
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      cores: navigator.hardwareConcurrency,
      touch: matchMedia('(pointer: coarse)').matches,
    }),
  );

  const scene = createScene({
    canvas,
    preset: quality.preset,
    palette: PALETTE,
    lighting: LIGHTING_DATA,
    area: BALE_AREA,
    crops: CROP_DATA,
  });
  // ASSET_PIPELINE §3: the area's models come from the generated manifest. The game runs
  // on the fallback ground meanwhile, and stays on it if the models cannot be had.
  void loadWorld(scene);

  // PERFORMANCE_BUDGET §6: render telemetry belongs behind `?debug=perf`.
  const debug = params.get('debug') === 'perf';
  // GDD §12: keyboard, the floating stick, and the on-screen buttons all feed one input.
  const input = createInput((view) => {
    stickView.value = view;
  });
  attachInput(window, canvas, input);
  mountOverlay(overlay, {
    controls: { onInteract: input.pressInteract, onTurn: input.pressRotate },
    hotbar: { onSelect: input.pressSlot },
  });

  // `?clock=17:30` opens the day at that hour, to judge its lighting (DESIGN §1.3).
  const state = createGameState(CALENDAR_DATA, BALE_AREA, PLAYER_DATA, WEATHER_DATA);
  const startMinute = parseStartClock(params.get('clock'), CALENDAR_DATA);
  if (startMinute !== undefined) state.clock.minute = startMinute;
  const startWeather = parseStartWeather(params.get('weather'));
  if (startWeather !== undefined) state.weather.today = startWeather;
  const game = createGame(
    CALENDAR_DATA,
    BALE_AREA,
    PLAYER_DATA,
    CROP_DATA,
    ITEM_DATA,
    TOOL_DATA,
    WEATHER_DATA,
    state,
  );
  const syncHotbar = () => {
    hotbarView.value = inventoryViewOf(
      game.state.player.inventory,
      game.state.player.selectedSlot,
      ITEM_DATA,
      TOOL_DATA,
    );
  };
  syncHotbar();
  scene.syncFarm(game.state.farm.tiles);
  const playerPose: PlayerPose = { x: 0, z: 0, facing: 'south', moving: false };
  const commands = createCommandMapper();
  const now = BROWSER_FRAMES.now;
  const meter = debug ? new PerfMeter() : undefined;
  const renderStats: RenderStats = {
    drawCalls: 0,
    triangles: 0,
    textures: 0,
    geometries: 0,
    programs: 0,
  };
  let stepMs = 0;
  // Quality control drives the loop's fps cap, so it is created once the loop exists; the
  // frame hook reads it through this binding rather than depending on declaration order.
  let control: QualityControl | undefined;
  let lastMinute = Number.NaN;
  let lastDay = Number.NaN;

  const loop = createLoop(
    {
      step: meter
        ? () => {
            const start = now();
            game.step();
            stepMs += now() - start;
          }
        : game.step,
      frame(alpha, realDtMs) {
        const frameStart = meter ? now() : 0;
        const frame = input.sample();
        // The camera is view state (DESIGN §1.1), so it answers input directly; the sim only
        // hears world-space `Command`s, queued for the next tick.
        // One quarter turn per edge: a key and a button in the same frame are two turns.
        for (let i = 0; i < Math.abs(frame.rotate); i++) {
          scene.camera.rotate(frame.rotate > 0 ? 1 : -1);
        }
        if (frame.zoom !== 0) scene.camera.zoomBy(frame.zoom);
        commands.map(frame, scene.camera.yaw, game.submit);
        const { clock } = game.state;
        const clockMinute =
          clock.minute + (clock.tick + alpha) / CALENDAR_DATA.clock.ticksPerMinute;
        scene.draw(
          ((game.ticks + alpha) * TICK_MS) / 1000,
          realDtMs / 1000,
          clockMinute,
          game.state.weather.today,
          game.playerPose(alpha, playerPose),
        );
        const events = game.drainEvents();
        // Crop batches are rebuilt only when the farm changes. `dayStarted` matters even
        // when no crop-specific event fires because ordinary growth can cross a stage.
        if (cropViewNeedsSync(events)) scene.syncFarm(game.state.farm.tiles);
        if (
          events.some((event) => event.type === 'slotSelected' || event.type === 'inventoryChanged')
        ) {
          syncHotbar();
        }
        // ui.sync (ARCHITECTURE §4.1): the clock view changes once per game minute at most.
        if (clock.minute !== lastMinute || clock.day !== lastDay) {
          lastMinute = clock.minute;
          lastDay = clock.day;
          clockView.value = clockViewOf(clock, CALENDAR_DATA);
        }
        control?.frame(realDtMs);
        if (meter?.record(realDtMs, stepMs + now() - frameStart)) {
          scene.stats(renderStats);
          const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } })
            .memory;
          perfView.value = {
            ...meter.latest,
            ...renderStats,
            preset: scene.preset,
            pixelRatio: scene.pixelRatio,
            heapMb: memory ? memory.usedJSHeapSize / 1048576 : undefined,
            benchmarking: control?.benchmarking ?? false,
          };
        }
        stepMs = 0;
      },
    },
    BROWSER_FRAMES,
  );
  control = createQualityControl(
    {
      get preset() {
        return scene.preset;
      },
      setPreset: scene.setPreset,
      setRenderScale: scene.setRenderScale,
      setFpsCap: loop.setFpsCap,
    },
    localSettings,
    quality.benchmark,
  );

  // ARCHITECTURE §4.1: pause the sim and the renderer while hidden, so the game clock does
  // not run on in a background tab and the battery is spared. Saving first joins here once
  // there is a save (M2).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      loop.stop();
    } else {
      control?.reset();
      loop.start();
    }
  });

  if (!document.hidden) loop.start();
  window.__GAME_READY__ = true;
}

await boot();
