import { beforeAll, describe, expect, test } from 'bun:test';
import type { CalendarData, WeatherData } from '@bale/shared';
import { masehiOf } from '../calendar.ts';
import { loadCalendarForTests } from '../testing/calendar-data.ts';
import { loadWeatherForTests } from '../testing/weather-data.ts';
import { createContext } from '../types.ts';
import { createWeatherState, createWeatherSystem, weatherForDay } from './weather.ts';

let cal: CalendarData;
let weather: WeatherData;
beforeAll(async () => {
  [cal, weather] = await Promise.all([loadCalendarForTests(), loadWeatherForTests()]);
});

describe('daily weather', () => {
  test('is stable for a save seed and changes when the seed changes', () => {
    const first = Array.from({ length: 120 }, (_, day) => weatherForDay(1234, day, cal, weather));
    expect(Array.from({ length: 120 }, (_, day) => weatherForDay(1234, day, cal, weather))).toEqual(
      first,
    );
    expect(
      Array.from({ length: 120 }, (_, day) => weatherForDay(5678, day, cal, weather)),
    ).not.toEqual(first);
  });

  test('follows each month distribution over many seeded years', () => {
    const counts = Array.from({ length: 12 }, () => ({ wet: 0, total: 0 }));
    for (let seed = 0; seed < 500; seed++) {
      for (let day = 0; day < 120; day++) {
        const id = weatherForDay(seed, day, cal, weather);
        const count = counts[masehiOf(day, cal).month - 1];
        if (!count) throw new Error('month out of range');
        count.total++;
        if (id === 'rain' || id === 'storm') count.wet++;
      }
    }
    const wetRate = counts.map((count) => count.wet / count.total);
    expect(wetRate[0]).toBeGreaterThan(0.66);
    for (const month of [4, 5, 6, 7, 8])
      expect(Math.abs((wetRate[month] ?? 0) - 0.1)).toBeLessThan(0.03);
    expect(Math.abs((wetRate[9] ?? 0) - 0.35)).toBeLessThan(0.03);
    for (const month of [1, 2, 10, 11])
      expect(Math.abs((wetRate[month] ?? 0) - 0.55)).toBeLessThan(0.03);
  });

  test('updates today and tomorrow after dayStarted and emits the forecast', () => {
    const state = createWeatherState(99, 0, cal, weather);
    const ctx = createContext();
    ctx.emit({ type: 'dayStarted', day: 1 });
    createWeatherSystem(cal, weather)(state, ctx);
    expect(state.weather.today).toBe(weatherForDay(99, 1, cal, weather));
    expect(state.weather.tomorrow).toBe(weatherForDay(99, 2, cal, weather));
    expect(ctx.events.at(-1)).toEqual({
      type: 'weatherChanged',
      today: state.weather.today,
      tomorrow: state.weather.tomorrow,
    });
  });
});
