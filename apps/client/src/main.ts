import { ANIMAL_DATA } from '@bale/content/animals';
import { type AreaId, loadArea } from '@bale/content/areas';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { CROP_DATA } from '@bale/content/crops';
import { loadDialogStories } from '@bale/content/dialog';
import { ITEM_DATA, TOOL_DATA } from '@bale/content/inventory';
import { LIGHTING_DATA } from '@bale/content/lighting';
import { MARKET_DATA } from '@bale/content/market';
import { NPC_DATA } from '@bale/content/npcs';
import { PLAYER_DATA } from '@bale/content/player';
import { WEATHER_DATA } from '@bale/content/weather';
import { type AreaDef, type AssetManifest, parseAssetManifest, TICK_MS } from '@bale/shared';
import { createGameState } from '@bale/sim';
import { clockViewOf } from './game/clock-view.ts';
import { createCommandMapper } from './game/commands.ts';
import { createDialogController } from './game/dialog.ts';
import { dialogScriptAt, npcInFront } from './game/dialog-target.ts';
import {
  createGame,
  type NpcPose,
  type PlayerPose,
  parseStartArea,
  parseStartClock,
  parseStartWeather,
} from './game/game.ts';
import { createLoop, type FrameScheduler } from './game/loop.ts';
import { facesMarket } from './game/market-target.ts';
import { PerfMeter } from './game/perf-meter.ts';
import { createQualityControl, initialPreset, type QualityControl } from './game/quality.ts';
import { initI18n, loadNamespace, locale, t } from './i18n/index.ts';
import { attachInput, createInput } from './platform/input/input.ts';
import { localSettings } from './platform/settings.ts';
import { createAutosaveController } from './platform/storage/autosave.ts';
import { createSaveStore } from './platform/storage/save-store.ts';
import { cropViewNeedsSync } from './render/crops/crop-view.ts';
import { guessPreset } from './render/quality/presets.ts';
import {
  type AnimalView,
  createScene,
  type RenderStats,
  type ScenePalette,
} from './render/scene.ts';
import { loadAreaModels } from './render/world/area-models.ts';
import { animalStatusView, animalStatusViewOf } from './ui/animal-status.tsx';
import { hotbarView, inventoryViewOf } from './ui/hotbar.tsx';
import { clockView } from './ui/hud-clock.tsx';
import { marketOpen, marketView, marketViewOf } from './ui/market.tsx';
import { mountOverlay } from './ui/mount.ts';
import { perfView } from './ui/perf-overlay.tsx';
import { playerStatusView } from './ui/player-status.tsx';
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
  npcCharacters: [
    {
      id: 'mbah_hita',
      palette: {
        outline: colorHex('ink900'),
        skin: colorHex('kayu500'),
        hair: colorHex('ink500'),
        shirt: colorHex('kunyit400'),
        trousers: colorHex('indigo700'),
      },
    },
    {
      id: 'pak_harjo',
      palette: {
        outline: colorHex('ink900'),
        skin: colorHex('kayu500'),
        hair: colorHex('indigo900'),
        shirt: colorHex('sawah700'),
        trousers: colorHex('indigo700'),
      },
    },
    {
      id: 'bu_ratna',
      palette: {
        outline: colorHex('ink900'),
        skin: colorHex('kayu500'),
        hair: colorHex('indigo900'),
        shirt: colorHex('terakota500'),
        trousers: colorHex('indigo700'),
      },
    },
  ],
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
  animal: {
    outline: colorHex('ink900'),
    body: colorHex('kapur50'),
    comb: colorHex('bahaya500'),
    beak: colorHex('kunyit400'),
  },
};

const BROWSER_FRAMES: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
};

async function loadManifest(): Promise<{ manifest: AssetManifest; url: URL } | undefined> {
  const manifestUrl = new URL('assets/manifest.json', document.baseURI);
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`${manifestUrl.href}: HTTP ${response.status}`);
    const manifest = parseAssetManifest(await response.json());
    if (!manifest) throw new Error(`${manifestUrl.href} is not an asset manifest`);
    return { manifest, url: manifestUrl };
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: a missing world must be visible to a developer.
    console.error('[assets] area models failed to load; showing the fallback ground', error);
    return undefined;
  }
}

async function loadWorld(area: AreaDef, assets: Awaited<ReturnType<typeof loadManifest>>) {
  if (!assets) return undefined;
  try {
    return await loadAreaModels(area, assets.manifest, assets.url);
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: a missing area must remain diagnosable.
    console.error(`[assets] ${area.id} models failed to load; showing fallback ground`, error);
    return undefined;
  }
}

function waitForFade(element: HTMLElement): Promise<void> {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      element.removeEventListener('transitionend', done);
      resolve();
    };
    element.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 450);
  });
}

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage');
  const overlay = document.querySelector<HTMLElement>('#overlay');
  if (!canvas || !overlay) throw new Error('index.html is missing #stage or #overlay');

  const BALE_AREA = await loadArea('bale');

  await initI18n(navigator.languages);
  // The HUD clock names the months (GDD §3.2).
  await loadNamespace('calendar');
  await loadNamespace('items');
  await loadNamespace('npcs');
  // `subscribe` fires immediately and again on every switch, so this covers both the
  // initial paint and a live locale change.
  locale.subscribe(() => {
    document.documentElement.lang = locale.value;
    document.title = t('app.title');
  });

  const params = new URLSearchParams(location.search);
  // M2-17 will put slot choice on the title screen. Until then the vertical slice owns slot 1.
  const saveStore = createSaveStore();
  const loaded = await saveStore.load(1).catch((error) => {
    // biome-ignore lint/suspicious/noConsole: storage failure must remain diagnosable.
    console.error('[save] could not read slot 1; starting a new game', error);
    return undefined;
  });
  if (loaded?.source === 'backup') {
    // M2-17 will surface the restore choice; the valid backup is safe to play in the meantime.
    // biome-ignore lint/suspicious/noConsole: a recovered corrupt save must be visible to a developer.
    console.warn('[save] slot 1 primary was invalid; loaded its backup', loaded.primaryError);
  }
  const state =
    loaded?.save.state ??
    createGameState(CALENDAR_DATA, BALE_AREA, PLAYER_DATA, WEATHER_DATA, NPC_DATA, ANIMAL_DATA);
  if (state.player.area !== 'bale' && state.player.area !== 'pasar') {
    // A valid save from a future content set may name an area this build does not ship.
    state.player.area = BALE_AREA.id;
    [state.player.x, state.player.z] = BALE_AREA.spawn;
  }
  const previewArea = parseStartArea(params.get('area'));
  const startingArea =
    (previewArea ?? state.player.area) === 'pasar' ? await loadArea('pasar') : BALE_AREA;
  if (previewArea) {
    state.player.area = startingArea.id;
    [state.player.x, state.player.z] = startingArea.spawn;
  }
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
    area: startingArea,
    crops: CROP_DATA,
  });
  let activeAreaId = startingArea.id;
  // ASSET_PIPELINE §3: the area's models come from the generated manifest. The game runs
  // on the fallback ground meanwhile, and stays on it if the models cannot be had.
  const assetsPromise = loadManifest();
  void assetsPromise.then(async (assets) => {
    const world = await loadWorld(startingArea, assets);
    if (world && activeAreaId === startingArea.id) scene.setWorld(world);
  });

  // PERFORMANCE_BUDGET §6: render telemetry belongs behind `?debug=perf`.
  const debug = params.get('debug') === 'perf';
  // GDD §12: keyboard, the floating stick, and the on-screen buttons all feed one input.
  const input = createInput((view) => {
    stickView.value = view;
  });
  const dialog = createDialogController({
    locale: () => locale.value,
    loadStories: loadDialogStories,
  });
  attachInput(window, canvas, input);
  mountOverlay(overlay, {
    controls: { onInteract: input.pressInteract, onTurn: input.pressRotate },
    dialog: { onAdvance: dialog.advance, onChoose: dialog.choose },
    hotbar: { onSelect: input.pressSlot },
    playerStatus: { onSleep: input.pressSleep, onContinue: input.continueDay },
    market: {
      onBuy: (itemId) =>
        game.submit({
          type: 'buyItem',
          marketId: MARKET_DATA.id,
          itemId,
          quantity: 1,
        }),
      onSell: (itemId) =>
        game.submit({
          type: 'sellItem',
          marketId: MARKET_DATA.id,
          itemId,
          quantity: 1,
        }),
    },
  });
  const fade = overlay.querySelector<HTMLElement>('.area-fade');
  if (!fade) throw new Error('overlay did not mount .area-fade');

  // `?clock=17:30` opens the day at that hour, to judge its lighting (DESIGN §1.3).
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
    MARKET_DATA,
    NPC_DATA,
    ANIMAL_DATA,
    state,
    [],
    [BALE_AREA, ...(startingArea.id === 'bale' ? [] : [startingArea])],
  );
  const areas = new Map<string, AreaDef>([
    [BALE_AREA.id, BALE_AREA],
    [startingArea.id, startingArea],
  ]);
  const autosave = createAutosaveController(saveStore, 1, loaded?.save.meta.playTime);
  const requestAutosave = () => {
    void autosave.save(game.state).catch((error) => {
      // biome-ignore lint/suspicious/noConsole: a failed autosave must remain diagnosable.
      console.error('[save] autosave failed', error);
    });
  };
  const syncHotbar = () => {
    hotbarView.value = inventoryViewOf(
      game.state.player.inventory,
      game.state.player.selectedSlot,
      ITEM_DATA,
      TOOL_DATA,
    );
  };
  const syncPlayerStatus = () => {
    playerStatusView.value = {
      money: game.state.player.money,
      stamina: game.state.player.stamina,
      maxStamina: game.state.player.maxStamina,
      summary: game.state.player.dayEndSummary,
    };
  };
  const chickenSpecies = ANIMAL_DATA.species[0];
  const chickenResident = ANIMAL_DATA.residents[0];
  const syncAnimalStatus = () => {
    const animal = chickenResident ? game.state.animals[chickenResident.id] : undefined;
    if (!animal || !chickenSpecies || !chickenResident) return;
    animalStatusView.value = animalStatusViewOf(animal, chickenResident, chickenSpecies);
  };
  const syncMarket = () => {
    marketView.value = marketViewOf(
      game.state.player,
      game.state.clock,
      game.state.seed,
      ITEM_DATA,
      CALENDAR_DATA,
      MARKET_DATA,
    );
  };
  syncHotbar();
  syncPlayerStatus();
  syncAnimalStatus();
  syncMarket();
  scene.syncFarm(game.state.farm.tiles);
  const playerPose: PlayerPose = { x: 0, z: 0, facing: 'south', moving: false };
  const npcPoses: NpcPose[] = [];
  const animalViews: AnimalView[] = Object.values(game.state.animals);
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

  let transitioning = false;
  let loop: ReturnType<typeof createLoop>;

  const transitionTo = async (id: AreaId): Promise<void> => {
    if (transitioning || id === activeAreaId) return;
    transitioning = true;
    loop.stop();
    fade.classList.add('area-fade--opaque');
    await waitForFade(fade);
    const nextArea = areas.get(id) ?? (await loadArea(id));
    areas.set(id, nextArea);
    game.registerArea(nextArea);
    const world = scene.hasCachedArea(id)
      ? undefined
      : await loadWorld(nextArea, await assetsPromise);
    activeAreaId = id;
    scene.setArea(nextArea, world);
    scene.syncFarm(game.state.farm.tiles);
    fade.classList.remove('area-fade--opaque');
    await waitForFade(fade);
    transitioning = false;
    control?.reset();
    if (!document.hidden) loop.start();
  };

  loop = createLoop(
    {
      step: meter
        ? () => {
            const start = now();
            if (!dialog.active && !marketOpen.value && !transitioning) game.step();
            stepMs += now() - start;
          }
        : () => {
            if (!dialog.active && !marketOpen.value && !transitioning) game.step();
          },
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
        const { clock } = game.state;
        if (dialog.active || marketOpen.value || transitioning) {
          commands.stop(game.submit);
          if (frame.interact && dialog.active) dialog.advance();
        } else {
          const target = frame.interact
            ? npcInFront(game.state.player, game.state.npcs)
            : undefined;
          if (target) {
            commands.stop(game.submit);
            void dialog.start(target.id, dialogScriptAt(clock.minute));
          } else if (frame.interact && facesMarket(game.state.player, areas.get(activeAreaId))) {
            commands.stop(game.submit);
            marketOpen.value = true;
          } else {
            commands.map(frame, scene.camera.yaw, game.submit);
          }
        }
        const clockMinute =
          clock.minute + (clock.tick + alpha) / CALENDAR_DATA.clock.ticksPerMinute;
        scene.draw(
          ((game.ticks + alpha) * TICK_MS) / 1000,
          realDtMs / 1000,
          clockMinute,
          game.state.weather.today,
          game.playerPose(alpha, playerPose),
          game.npcPoses(alpha, npcPoses),
          animalViews,
        );
        const events = game.drainEvents();
        const areaChanged = events.find((event) => event.type === 'areaChanged') as
          | { readonly to?: unknown }
          | undefined;
        const destination = areaChanged?.to;
        if (destination === 'bale' || destination === 'pasar') {
          void transitionTo(destination);
        }
        if (events.some((event) => event.type === 'dayEnded')) requestAutosave();
        // Crop batches are rebuilt only when the farm changes. `dayStarted` matters even
        // when no crop-specific event fires because ordinary growth can cross a stage.
        if (cropViewNeedsSync(events)) scene.syncFarm(game.state.farm.tiles);
        if (
          events.some((event) => event.type === 'slotSelected' || event.type === 'inventoryChanged')
        ) {
          syncHotbar();
        }
        if (
          events.some(
            (event) =>
              event.type === 'staminaChanged' ||
              event.type === 'moneyChanged' ||
              event.type === 'dayEnded' ||
              event.type === 'dayStarted',
          )
        ) {
          syncPlayerStatus();
        }
        if (
          events.some((event) =>
            [
              'animalFed',
              'animalPetted',
              'animalNeglected',
              'animalProductProduced',
              'animalProductCollected',
            ].includes(event.type),
          )
        ) {
          syncAnimalStatus();
        }
        if (
          events.some(
            (event) =>
              event.type === 'inventoryChanged' ||
              event.type === 'moneyChanged' ||
              event.type === 'dayStarted',
          ) ||
          clock.minute !== lastMinute ||
          clock.day !== lastDay
        ) {
          syncMarket();
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

  // ARCHITECTURE §4.1: snapshot first, then pause the sim and renderer while hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      autosave.pause();
      requestAutosave();
      loop.stop();
    } else {
      autosave.resume();
      control?.reset();
      loop.start();
    }
  });

  if (!document.hidden) loop.start();
  else autosave.pause();
  window.__GAME_READY__ = true;
}

await boot();
