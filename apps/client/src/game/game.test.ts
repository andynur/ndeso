import { expect, test } from 'bun:test';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { type Command, PLAYER_RADIUS } from '@bale/sim';
import { createGame } from './game.ts';
import { createPlaceholderArea, PLACEHOLDER_SPAWN } from './placeholder-area.ts';

const cal = CALENDAR_DATA;
const area = createPlaceholderArea();

test('one game minute per ticksPerMinute steps', () => {
  const game = createGame(cal, area);
  const start = game.state.clock.minute;
  for (let i = 0; i < cal.clock.ticksPerMinute * 3; i++) game.step();
  expect(game.state.clock.minute).toBe(start + 3);
  expect(game.ticks).toBe(cal.clock.ticksPerMinute * 3);
});

test('events are buffered across steps and drained once', () => {
  const game = createGame(cal, area);
  const minutesToHour = 60 - (game.state.clock.minute % 60);
  for (let i = 0; i < cal.clock.ticksPerMinute * minutesToHour; i++) game.step();
  const events = game.drainEvents();
  expect(events.some((e) => e.type === 'hourChanged')).toBe(true);
  expect(game.drainEvents()).toEqual([]);
});

test('submitted commands reach the next tick only, sanitized and in order', () => {
  const seen: (readonly Command[])[] = [];
  const game = createGame(cal, area, undefined, [(_state, ctx) => seen.push(ctx.commands)]);
  game.submit({ type: 'move', x: 3, z: 4 });
  game.submit({ type: 'selectSlot', slot: 99 });
  game.submit({ type: 'interact' });
  game.step();
  game.step();
  expect(seen[0]).toEqual([{ type: 'move', x: 0.6, z: 0.8 }, { type: 'interact' }]);
  expect(seen[1]).toEqual([]);
});

test('the player walks on a held move and remembers where the last tick started', () => {
  const game = createGame(cal, area);
  game.submit({ type: 'move', x: 1, z: 0 });
  game.step();
  const before = game.state.player.pos.x;
  game.step();
  expect(game.previousPos.x).toBe(before);
  expect(game.state.player.pos.x).toBeGreaterThan(before);
  expect(game.state.player.facing).toBe('east');
});

test('the placeholder house blocks the player', () => {
  const game = createGame(cal, area);
  game.submit({ type: 'move', x: 0, z: -1 });
  for (let i = 0; i < 30; i++) game.step();
  expect(game.state.player.pos.x).toBe(PLACEHOLDER_SPAWN.x);
  expect(game.state.player.pos.z).toBeCloseTo(1 + PLAYER_RADIUS);
});
