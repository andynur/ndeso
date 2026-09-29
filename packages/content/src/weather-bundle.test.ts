import { expect, test } from 'bun:test';
import { WEATHER_DATA } from './weather-bundle.ts';

test('January is the unique heavy-rain month from GDD §3.3', () => {
  const january = WEATHER_DATA.byMonth[0];
  if (!january) throw new Error('January weather row is missing');
  expect(january).toEqual({
    month: 'jan',
    weights: { clear: 10, cloudy: 20, rain: 50, storm: 20 },
  });
  expect(january.weights.rain + january.weights.storm).toBeGreaterThan(
    Math.max(...WEATHER_DATA.byMonth.slice(1).map((row) => row.weights.rain + row.weights.storm)),
  );
});
