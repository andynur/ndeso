import { expect, test } from 'bun:test';
import { PLAYER_DATA } from './player-bundle.ts';

test('the player file validates', () => {
  expect(PLAYER_DATA.speed).toBeGreaterThan(0);
  expect(PLAYER_DATA.radius).toBeLessThan(0.5);
});
