import { expect, test } from 'bun:test';
import { PASAR_AREA } from '@bale/content/area-pasar';
import type { PlayerState } from '@bale/sim';
import { facesMarket } from './market-target.ts';

const player: PlayerState = {
  area: 'pasar',
  x: 2.5,
  z: -0.5,
  facing: 'east',
  moveX: 0,
  moveZ: 0,
};

test('targets the authored pasar stall only from its front tile', () => {
  expect(facesMarket(player, PASAR_AREA)).toBe(true);
  expect(facesMarket({ ...player, facing: 'west' }, PASAR_AREA)).toBe(false);
  expect(facesMarket({ ...player, area: 'bale' }, PASAR_AREA)).toBe(false);
});
