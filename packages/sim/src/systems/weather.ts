import { type CalendarData, WEATHER_IDS, type WeatherData, type WeatherId } from '@bale/shared';
import { masehiOf } from '../calendar.ts';
import type { System } from '../types.ts';

export interface WeatherState {
  /** Stable save seed. Weather is derived from this plus the absolute day. */
  seed: number;
  weather: { today: WeatherId; tomorrow: WeatherId };
}

/** A fixed seed for new-game scaffolding until M2-17 asks the player to start a save. */
export const DEFAULT_GAME_SEED = 0x42414c45;

export function weatherForDay(
  seed: number,
  day: number,
  cal: CalendarData,
  data: WeatherData,
): WeatherId {
  const month = masehiOf(day, cal).month;
  const row = data.byMonth[month - 1];
  if (!row) throw new Error(`weather has no row for month ${month}`);
  const roll = unitHash(seed, day) * 100;
  let edge = 0;
  for (const id of WEATHER_IDS) {
    edge += row.weights[id];
    if (roll < edge) return id;
  }
  // The schema makes rows total 100; retain a deterministic fallback for typed test data.
  return 'clear';
}

export function createWeatherState(
  seed: number,
  day: number,
  cal: CalendarData,
  data: WeatherData,
): WeatherState {
  return {
    seed: seed >>> 0,
    weather: {
      today: weatherForDay(seed, day, cal, data),
      tomorrow: weatherForDay(seed, day + 1, cal, data),
    },
  };
}

/** Step 2: after time starts a day, roll today and keep tomorrow's forecast ready. */
export function createWeatherSystem(cal: CalendarData, data: WeatherData): System<WeatherState> {
  return (state, ctx) => {
    for (const event of ctx.events) {
      const { day } = event as { readonly day?: unknown };
      if (event.type !== 'dayStarted' || typeof day !== 'number') continue;
      state.weather.today = weatherForDay(state.seed, day, cal, data);
      state.weather.tomorrow = weatherForDay(state.seed, day + 1, cal, data);
      ctx.emit({
        type: 'weatherChanged',
        today: state.weather.today,
        tomorrow: state.weather.tomorrow,
      });
    }
  };
}

/** Stateless 32-bit avalanche: the same save seed and day always yield the same roll. */
function unitHash(seed: number, day: number): number {
  let value = (seed ^ Math.imul(day + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000;
}
