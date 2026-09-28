import { expect, test } from 'bun:test';
import { Benchmark } from './benchmark.ts';

test('ignores the warm-up and averages the window after it', () => {
  const bench = new Benchmark(1000, 3000);
  const results: (number | undefined)[] = [];
  // A slow first second (shader compiles), then a steady 20 ms.
  for (let i = 0; i < 10; i++) results.push(bench.record(100));
  for (let i = 0; i < 150; i++) results.push(bench.record(20));
  const reported = results.filter((r) => r !== undefined);
  expect(reported).toEqual([20]);
  expect(bench.done).toBe(true);
});

test('reports once, then stays quiet', () => {
  const bench = new Benchmark(0, 100);
  for (let i = 0; i < 10; i++) bench.record(10);
  expect(bench.record(10)).toBeUndefined();
});
