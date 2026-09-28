import { expect, test } from 'bun:test';
import { BALE_AREA } from '@bale/content/areas';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { PLAYER_DATA } from '@bale/content/player';
import type { Command } from '@bale/sim';
import { createGame, type PlayerPose, parseStartClock } from './game.ts';

const cal = CALENDAR_DATA;

test('one game minute per ticksPerMinute steps', () => {
  const game = createGame(cal, BALE_AREA, PLAYER_DATA);
  const start = game.state.clock.minute;
  for (let i = 0; i < cal.clock.ticksPerMinute * 3; i++) game.step();
  expect(game.state.clock.minute).toBe(start + 3);
  expect(game.ticks).toBe(cal.clock.ticksPerMinute * 3);
});

test('events are buffered across steps and drained once', () => {
  const game = createGame(cal, BALE_AREA, PLAYER_DATA);
  const minutesToHour = 60 - (game.state.clock.minute % 60);
  for (let i = 0; i < cal.clock.ticksPerMinute * minutesToHour; i++) game.step();
  const events = game.drainEvents();
  expect(events.some((e) => e.type === 'hourChanged')).toBe(true);
  expect(game.drainEvents()).toEqual([]);
});

test('submitted commands reach the next tick only, sanitized and in order', () => {
  const seen: (readonly Command[])[] = [];
  const game = createGame(cal, BALE_AREA, PLAYER_DATA, undefined, [
    (_state, ctx) => seen.push(ctx.commands),
  ]);
  game.submit({ type: 'move', x: 3, z: 4 });
  game.submit({ type: 'selectSlot', slot: 99 });
  game.submit({ type: 'interact' });
  game.step();
  game.step();
  expect(seen[0]).toEqual([{ type: 'move', x: 0.6, z: 0.8 }, { type: 'interact' }]);
  expect(seen[1]).toEqual([]);
});

test('the player walks on held intent and render interpolates between ticks', () => {
  const game = createGame(cal, BALE_AREA, PLAYER_DATA);
  const [spawnX, spawnZ] = BALE_AREA.spawn;
  const pose: PlayerPose = { x: 0, z: 0, facing: 'north', moving: false };
  expect(game.playerPose(0.5, pose)).toEqual({
    x: spawnX,
    z: spawnZ,
    facing: 'south',
    moving: false,
  });
  game.submit({ type: 'move', x: 1, z: 0 });
  game.step();
  game.step();
  const { x } = game.state.player;
  const step = x - game.playerPose(0, pose).x;
  expect(step).toBeGreaterThan(0);
  expect(game.playerPose(0.5, pose)).toEqual({
    x: x - step / 2,
    z: spawnZ,
    facing: 'east',
    moving: true,
  });
  expect(game.playerPose(1, pose).x).toBe(x);
});

test('?clock= reads a time inside the game day, after midnight included', () => {
  expect(parseStartClock('17:30', cal)).toBe(1050);
  expect(parseStartClock('00:30', cal)).toBe(1470);
  expect(parseStartClock('03:00', cal)).toBeUndefined();
  expect(parseStartClock('evening', cal)).toBeUndefined();
  expect(parseStartClock(null, cal)).toBeUndefined();
});
