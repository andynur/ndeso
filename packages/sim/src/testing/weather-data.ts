import type { WeatherData } from '@bale/shared';
import { weatherFileSchema } from '@bale/shared/content';

const WEATHER_FILE = new URL('../../../content/data/weather.json5', import.meta.url);

export async function loadWeatherForTests(): Promise<WeatherData> {
  return weatherFileSchema.parse(Bun.JSON5.parse(await Bun.file(WEATHER_FILE).text()));
}
