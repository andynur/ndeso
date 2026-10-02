import { expect, test } from 'bun:test';
import { BALE_AREA } from '../../packages/content/src/area-bale.ts';
import { buildGround, buildJoglo } from './bale.ts';

function bounds(positions: Float32Array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    const c = i % 3;
    min[c] = Math.min(min[c] as number, positions[i] as number);
    max[c] = Math.max(max[c] as number, positions[i] as number);
  }
  return { min, max };
}

test('the joglo stands inside its footprint', () => {
  const { joglo } = BALE_AREA;
  const { min, max } = bounds(buildJoglo(BALE_AREA).positions);
  // Lamps hang just outside the front posts, so allow their lantern boxes.
  expect(min[0]).toBeGreaterThanOrEqual(joglo.x);
  expect(max[0]).toBeLessThanOrEqual(joglo.x + joglo.w);
  expect(min[2]).toBeGreaterThanOrEqual(joglo.z);
  expect(max[2]).toBeLessThanOrEqual(joglo.z + joglo.d + 0.5);
  expect(min[1]).toBe(0);
});

test('the kalen is cut below the ground, and nothing else is', () => {
  const ground = buildGround(BALE_AREA);
  const { min } = bounds(ground.positions);
  expect(min[1]).toBeCloseTo(-0.4, 6);
  const kalenX = BALE_AREA.kalen.points[0]?.[0] ?? 0;
  const half = BALE_AREA.kalen.width / 2;
  for (let i = 0; i < ground.positions.length; i += 3) {
    if ((ground.positions[i + 1] as number) < 0) {
      expect(Math.abs((ground.positions[i] as number) - kalenX)).toBeLessThanOrEqual(half + 1e-6);
    }
  }
});

test('placeholders stay low-poly (PERFORMANCE_BUDGET §3: 60k triangles on Low)', () => {
  const triangles =
    (buildGround(BALE_AREA).indices.length + buildJoglo(BALE_AREA).indices.length) / 3;
  expect(triangles).toBeLessThan(2000);
});
