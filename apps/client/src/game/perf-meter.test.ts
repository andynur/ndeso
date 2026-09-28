import { expect, test } from 'bun:test';
import { PERF_WINDOW_MS, PerfMeter } from './perf-meter.ts';

test('publishes averages once per window', () => {
  const meter = new PerfMeter();
  const frames = PERF_WINDOW_MS / 20;
  const published: boolean[] = [];
  for (let i = 0; i < frames; i++) published.push(meter.record(20, i === 3 ? 9 : 4));
  expect(published.filter(Boolean).length).toBe(1);
  expect(published.at(-1)).toBe(true);
  expect(meter.latest.fps).toBeCloseTo(50, 6);
  expect(meter.latest.frameMs).toBeCloseTo(20, 6);
  expect(meter.latest.cpuMs).toBeCloseTo((4 * (frames - 1) + 9) / frames, 6);
  expect(meter.latest.cpuMaxMs).toBe(9);
});

test('each window starts fresh', () => {
  const meter = new PerfMeter();
  for (let i = 0; i < PERF_WINDOW_MS / 10; i++) meter.record(10, 12);
  for (let i = 0; i < PERF_WINDOW_MS / 25; i++) meter.record(25, 2);
  expect(meter.latest.fps).toBeCloseTo(40, 6);
  expect(meter.latest.cpuMaxMs).toBe(2);
});
