import { expect, test } from 'bun:test';
import { CALENDAR_DATA } from '@bale/content/calendar';
import type { Command } from '@bale/sim';
import { createGame, parseStartClock } from './game.ts';

const cal = CALENDAR_DATA;

test('one game minute per ticksPerMinute steps', () => {
  const game = createGame(cal);
  const start = game.state.clock.minute;
  for (let i = 0; i < cal.clock.ticksPerMinute * 3; i++) game.step();
  expect(game.state.clock.minute).toBe(start + 3);
  expect(game.ticks).toBe(cal.clock.ticksPerMinute * 3);
});

test('events are buffered across steps and drained once', () => {
  const game = createGame(cal);
  const minutesToHour = 60 - (game.state.clock.minute % 60);
  for (let i = 0; i < cal.clock.ticksPerMinute * minutesToHour; i++) game.step();
  const events = game.drainEvents();
  expect(events.some((e) => e.type === 'hourChanged')).toBe(true);
  expect(game.drainEvents()).toEqual([]);
});

test('submitted commands reach the next tick only, sanitized and in order', () => {
  const seen: (readonly Command[])[] = [];
  const game = createGame(cal, undefined, [(_state, ctx) => seen.push(ctx.commands)]);
  game.submit({ type: 'move', x: 3, z: 4 });
  game.submit({ type: 'selectSlot', slot: 99 });
  game.submit({ type: 'interact' });
  game.step();
  game.step();
  expect(seen[0]).toEqual([{ type: 'move', x: 0.6, z: 0.8 }, { type: 'interact' }]);
  expect(seen[1]).toEqual([]);
});

test('?clock= reads a time inside the game day, after midnight included', () => {
  expect(parseStartClock('17:30', cal)).toBe(1050);
  expect(parseStartClock('00:30', cal)).toBe(1470);
  expect(parseStartClock('03:00', cal)).toBeUndefined();
  expect(parseStartClock('evening', cal)).toBeUndefined();
  expect(parseStartClock(null, cal)).toBeUndefined();
});
