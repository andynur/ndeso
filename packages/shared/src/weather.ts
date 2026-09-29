import type { MasehiMonthId } from './calendar.ts';

export const WEATHER_IDS = ['clear', 'cloudy', 'rain', 'storm'] as const;
export type WeatherId = (typeof WEATHER_IDS)[number];

export type WeatherWeights = Readonly<Record<WeatherId, number>>;

export interface WeatherMonthDef {
  readonly month: MasehiMonthId;
  readonly weights: WeatherWeights;
}

export interface WeatherData {
  readonly byMonth: readonly WeatherMonthDef[];
}
