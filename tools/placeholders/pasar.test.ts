import { expect, test } from 'bun:test';
import { PASAR_AREA } from '../../packages/content/src/area-pasar.ts';
import { buildPasarGround, buildPasarStalls } from './pasar.ts';

test('pasar placeholders stay low-poly and contain geometry', () => {
  const ground = buildPasarGround(PASAR_AREA);
  const stalls = buildPasarStalls(PASAR_AREA);
  const triangles = (ground.indices.length + stalls.indices.length) / 3;
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThan(2_000);
});
