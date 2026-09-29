/// <reference path="./json5.d.ts" />
import type { WeatherData } from '@bale/shared';
import weather from '../data/weather.json5';

/** Browser weather data, source-validated by `check:content` without bundling Zod. */
export const WEATHER_DATA = weather as WeatherData;
