import { describe, expect, test } from 'bun:test';
import { RainField } from './rain-field.ts';

describe('RainField', () => {
  test('uses the preset cap for storms and fewer particles for ordinary rain', () => {
    const field = new RainField();
    field.setWeather('storm', 800);
    expect(field.points.visible).toBe(true);
    expect(field.points.geometry.drawRange.count).toBe(800);
    field.setWeather('rain', 800);
    expect(field.points.geometry.drawRange.count).toBe(600);
    field.setWeather('cloudy', 800);
    expect(field.points.visible).toBe(false);
    expect(field.points.geometry.drawRange.count).toBe(0);
    field.dispose();
  });
});
