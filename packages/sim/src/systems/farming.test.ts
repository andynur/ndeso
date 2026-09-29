import { beforeAll, describe, expect, test } from 'bun:test';
import type { CalendarData } from '@bale/shared';
import type { CropDef } from '@bale/shared/content';
import type { Command } from '../commands.ts';
import { loadCalendarForTests } from '../testing/calendar-data.ts';
import { loadCropsForTests } from '../testing/crop-data.ts';
import { createContext, type SimEvent } from '../types.ts';
import {
  createFarmCommandSystem,
  createFarmingState,
  createFarmingSystem,
  type FarmingState,
  tileKey,
} from './farming.ts';
import type { WeatherState } from './weather.ts';

let crops: readonly CropDef[];
let cal: CalendarData;
beforeAll(async () => {
  [crops, cal] = await Promise.all([loadCropsForTests(), loadCalendarForTests()]);
});

const target = { area: 'bale', x: 8, z: -2 } as const;
const key = tileKey(target);

function fresh(
  plot: 'tegalan' | 'sawah' = 'tegalan',
  waterLevel: 0 | 1 | 2 | 3 = 0,
): FarmingState & WeatherState {
  return {
    ...createFarmingState([
      plot === 'sawah' ? { ...target, plot, waterLevel } : { ...target, plot },
    ]),
    seed: 0,
    weather: { today: 'clear', tomorrow: 'clear' },
  };
}

function command(state: FarmingState, ...commands: Command[]): SimEvent[] {
  const ctx = createContext(1, commands);
  createFarmCommandSystem(crops)(state, ctx);
  return ctx.events;
}

function day(state: FarmingState & WeatherState, absoluteDay: number): SimEvent[] {
  const ctx = createContext();
  ctx.emit({ type: 'dayStarted', day: absoluteDay });
  createFarmingSystem(crops, cal)(state, ctx);
  return ctx.events.slice(1);
}

function prepare(state: FarmingState, cropId: string): void {
  command(state, { type: 'useTool', tool: 'hoe', target });
  command(state, { type: 'plantSeed', cropId, target });
}

describe('farm commands', () => {
  test('hoes, plants only a matching plot, and waters prepared ground', () => {
    const state = fresh();
    expect(command(state, { type: 'plantSeed', cropId: 'cabai', target })).toEqual([]);
    expect(command(state, { type: 'useTool', tool: 'hoe', target })).toEqual([
      { type: 'tileHoed', key },
    ]);
    expect(command(state, { type: 'plantSeed', cropId: 'padi', target })).toEqual([]);
    expect(command(state, { type: 'plantSeed', cropId: 'cabai', target })).toEqual([
      { type: 'cropPlanted', key, cropId: 'cabai' },
    ]);
    expect(command(state, { type: 'useTool', tool: 'watering_can', target })).toEqual([
      { type: 'tileWatered', key, waterLevel: undefined },
    ]);
    expect(state.farm.tiles[key]).toMatchObject({
      phase: 'seeded',
      cropId: 'cabai',
      watered: true,
    });
  });

  test('raises sawah water to level 3 and no further', () => {
    const state = fresh('sawah', 2);
    prepare(state, 'padi');
    command(
      state,
      { type: 'useTool', tool: 'watering_can', target },
      { type: 'useTool', tool: 'watering_can', target },
    );
    expect(state.farm.tiles[key]).toMatchObject({ waterLevel: 3, cropId: 'padi' });
  });

  test('an empty sawah loses exactly one water level per clear day', () => {
    const state = fresh('sawah', 3);
    day(state, 40);
    expect(state.farm.tiles[key]).toMatchObject({ phase: 'untilled', waterLevel: 2 });
  });

  test('ignores targets outside the declared farm and rejects duplicate plots', () => {
    const state = fresh();
    expect(
      command(state, {
        type: 'useTool',
        tool: 'hoe',
        target: { area: 'bale', x: 99, z: 99 },
      }),
    ).toEqual([]);
    expect(() =>
      createFarmingState([
        { ...target, plot: 'tegalan' },
        { ...target, plot: 'sawah' },
      ]),
    ).toThrow(`duplicate farm tile '${key}'`);
  });
});

describe('daily growth', () => {
  test('uses yesterday’s water once and matures on the configured productive day', () => {
    const state = fresh();
    prepare(state, 'cabai');
    for (let n = 1; n <= 8; n++) {
      command(state, { type: 'useTool', tool: 'watering_can', target });
      const events = day(state, n);
      if (n < 8) expect(events).toEqual([]);
      else expect(events).toEqual([{ type: 'cropMatured', key, cropId: 'cabai' }]);
    }
    expect(state.farm.tiles[key]).toMatchObject({
      phase: 'mature',
      growthDays: 8,
      watered: false,
    });
  });

  test('withers tegalan at each crop’s dry-day threshold', () => {
    const cabai = fresh();
    prepare(cabai, 'cabai');
    day(cabai, 1);
    day(cabai, 2);
    expect(day(cabai, 3)).toEqual([{ type: 'cropWithered', key, cropId: 'cabai', reason: 'dry' }]);

    const singkong = fresh();
    prepare(singkong, 'singkong');
    for (let n = 1; n < 5; n++) expect(day(singkong, n)).toEqual([]);
    expect(day(singkong, 5)).toEqual([
      { type: 'cropWithered', key, cropId: 'singkong', reason: 'dry' },
    ]);
  });

  test('wrong-musim crops wither on the next day', () => {
    const state = fresh('sawah', 3);
    prepare(state, 'padi');
    // Arrival is July / kemarau; padi is a hujan crop.
    expect(day(state, 1)).toEqual([{ type: 'cropWithered', key, cropId: 'padi', reason: 'musim' }]);
  });

  test('an unharvested mature crop still withers when its musim ends', () => {
    const state = fresh();
    prepare(state, 'cabai');
    for (let n = 1; n <= 8; n++) {
      command(state, { type: 'useTool', tool: 'watering_can', target });
      day(state, n);
    }
    expect(day(state, 40)).toEqual([
      { type: 'cropWithered', key, cropId: 'cabai', reason: 'musim' },
    ]);
  });

  test('sawah dries before growth and rice needs level 2', () => {
    const state = fresh('sawah', 3);
    prepare(state, 'padi');
    // Day 40 is November / hujan. Level 3 dries to 2 and grows once.
    day(state, 40);
    expect(state.farm.tiles[key]).toMatchObject({ waterLevel: 2, growthDays: 1 });
    // The next clear day dries to 1, so growth pauses.
    day(state, 41);
    expect(state.farm.tiles[key]).toMatchObject({ waterLevel: 1, growthDays: 1, dryDays: 1 });
  });

  test('rain grows tegalan without manual watering and keeps sawah from drying', () => {
    const tegalan = fresh();
    prepare(tegalan, 'cabai');
    tegalan.weather.today = 'rain';
    day(tegalan, 1);
    expect(tegalan.farm.tiles[key]).toMatchObject({ growthDays: 1, dryDays: 0 });

    const sawah = fresh('sawah', 2);
    prepare(sawah, 'padi');
    sawah.weather.today = 'storm';
    day(sawah, 40);
    expect(sawah.farm.tiles[key]).toMatchObject({ waterLevel: 2, growthDays: 1, dryDays: 0 });
  });
});

describe('harvest', () => {
  test('returns one-shot crops to untilled soil', () => {
    const state = fresh();
    prepare(state, 'singkong');
    for (let n = 1; n <= 10; n++) {
      command(state, { type: 'useTool', tool: 'watering_can', target });
      day(state, n);
    }
    expect(command(state, { type: 'harvest', target })).toEqual([
      { type: 'cropHarvested', key, cropId: 'singkong', yield: 1 },
    ]);
    expect(state.farm.tiles[key]).toMatchObject({ phase: 'untilled' });
    expect(state.farm.tiles[key]).not.toHaveProperty('cropId');
  });

  test('regrowing crops keep enough progress for the configured regrow time', () => {
    const state = fresh();
    prepare(state, 'cabai');
    for (let n = 1; n <= 8; n++) {
      command(state, { type: 'useTool', tool: 'watering_can', target });
      day(state, n);
    }
    expect(command(state, { type: 'harvest', target })).toEqual([
      { type: 'cropHarvested', key, cropId: 'cabai', yield: 3 },
    ]);
    expect(state.farm.tiles[key]).toMatchObject({ phase: 'seeded', growthDays: 5 });
    for (let n = 9; n <= 11; n++) {
      command(state, { type: 'useTool', tool: 'watering_can', target });
      day(state, n);
    }
    expect(state.farm.tiles[key]).toMatchObject({ phase: 'mature', growthDays: 8 });
  });
});
