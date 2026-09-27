import { expect, test } from 'bun:test';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { createGame } from './game.ts';

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
