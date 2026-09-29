import { beforeAll, expect, test } from 'bun:test';
import type { CalendarData } from '@bale/shared';
import type { CropDef } from '@bale/shared/content';
import type { Command } from './commands.ts';
import {
  createFarmCommandSystem,
  createFarmingState,
  createFarmingSystem,
  tileKey,
} from './systems/farming.ts';
import type { WeatherState } from './systems/weather.ts';
import { loadCalendarForTests } from './testing/calendar-data.ts';
import { loadCropsForTests } from './testing/crop-data.ts';
import { createContext, type SimEvent } from './types.ts';

let crops: readonly CropDef[];
let cal: CalendarData;
beforeAll(async () => {
  [crops, cal] = await Promise.all([loadCropsForTests(), loadCalendarForTests()]);
});

function isHarvestEvent(
  event: SimEvent,
): event is SimEvent & { readonly cropId: string; readonly yield: number } {
  const fields = event as { readonly cropId?: unknown; readonly yield?: unknown };
  return (
    event.type === 'cropHarvested' &&
    typeof fields.cropId === 'string' &&
    typeof fields.yield === 'number'
  );
}

test('a scripted 14-day cabai and singkong plot', () => {
  const cabai = { area: 'bale', x: 8, z: -2 } as const;
  const singkong = { area: 'bale', x: 9, z: -2 } as const;
  const state = {
    ...createFarmingState([
      { ...cabai, plot: 'tegalan' },
      { ...singkong, plot: 'tegalan' },
    ]),
    seed: 0,
    weather: { today: 'clear', tomorrow: 'clear' },
  } satisfies ReturnType<typeof createFarmingState> & WeatherState;
  const commands = createFarmCommandSystem(crops);
  const growth = createFarmingSystem(crops, cal);
  const harvests: string[] = [];

  const act = (...input: Command[]) => {
    const ctx = createContext(1, input);
    commands(state, ctx);
    for (const event of ctx.events) {
      if (isHarvestEvent(event)) harvests.push(`${event.cropId}:${event.yield}`);
    }
  };

  act(
    { type: 'useTool', tool: 'hoe', target: cabai },
    { type: 'plantSeed', cropId: 'cabai', target: cabai },
    { type: 'useTool', tool: 'hoe', target: singkong },
    { type: 'plantSeed', cropId: 'singkong', target: singkong },
  );
  for (let day = 1; day <= 14; day++) {
    // Cabai is tended every day. Singkong misses days 3–6, proving its five-day tolerance.
    act({ type: 'useTool', tool: 'watering_can', target: cabai });
    if (day < 3 || day > 6) act({ type: 'useTool', tool: 'watering_can', target: singkong });
    const ctx = createContext();
    ctx.emit({ type: 'dayStarted', day });
    growth(state, ctx);
    if (day === 8 || day === 11 || day === 14) act({ type: 'harvest', target: cabai });
    if (day === 14) act({ type: 'harvest', target: singkong });
  }

  expect({
    tiles: [state.farm.tiles[tileKey(cabai)], state.farm.tiles[tileKey(singkong)]],
    harvests,
  }).toMatchSnapshot();
});
