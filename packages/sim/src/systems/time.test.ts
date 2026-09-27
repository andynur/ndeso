import { describe, expect, test } from 'bun:test';
import { calendarData } from '@bale/content/calendar';
import { createContext, type SimEvent } from '../types.ts';
import { type ClockState, createClockState, createTimeSystem } from './time.ts';

const time = createTimeSystem(calendarData);
const { ticksPerMinute, dayStartMinute, dayEndMinute } = calendarData.clock;
const ticksPerDay = (dayEndMinute - dayStartMinute) * ticksPerMinute;

const run = (ticks: number, state: ClockState = createClockState(calendarData)) => {
  const ctx = createContext(ticks);
  time(state, ctx);
  return { state, events: ctx.events };
};

const ofType = (events: readonly SimEvent[], type: string) =>
  events.filter((event) => event.type === type);

describe('time system', () => {
  test('starts on day 0 at 05:00', () => {
    expect(createClockState(calendarData)).toEqual({ clock: { tick: 0, day: 0, minute: 300 } });
  });

  test('a game-minute takes ticksPerMinute ticks (0.7 real s)', () => {
    expect(ticksPerMinute).toBe(7);
    expect(run(ticksPerMinute - 1).state.clock).toEqual({ tick: 6, day: 0, minute: 300 });
    expect(run(ticksPerMinute).state.clock).toEqual({ tick: 0, day: 0, minute: 301 });
  });

  test('emits hourChanged on the hour', () => {
    const { events } = run(59 * ticksPerMinute);
    expect(ofType(events, 'hourChanged')).toEqual([]);
    expect(ofType(run(ticksPerMinute * 61).events, 'hourChanged')).toEqual([
      { type: 'hourChanged', hour: 6 },
    ]);
  });

  test('emits prayerTimeChanged when the band changes', () => {
    const { events } = run(ticksPerDay - 1);
    expect(ofType(events, 'prayerTimeChanged').map(({ band }) => band)).toEqual([
      'terbit',
      'dhuha',
      'dzuhur',
      'ashar',
      'maghrib',
      'isya',
    ]);
  });

  test('01:00 starts the next day at 05:00 with dayStarted and pasaranChanged', () => {
    const { state, events } = run(ticksPerDay);
    expect(state.clock).toEqual({ tick: 0, day: 1, minute: 300 });
    expect(events.slice(-4)).toEqual([
      { type: 'dayStarted', day: 1 },
      { type: 'pasaranChanged', pasaran: 'pahing' },
      { type: 'hourChanged', hour: 5 },
      { type: 'prayerTimeChanged', band: 'subuh' },
    ]);
  });

  test('emits mangsaChanged and musimChanged only at a boundary', () => {
    const state = createClockState(calendarData);
    state.clock.day = 12; // last day of Kasa (kemarau)
    const karo = run(ticksPerDay, state).events;
    expect(ofType(karo, 'mangsaChanged')).toEqual([
      { type: 'mangsaChanged', mangsa: 'karo', year: 1 },
    ]);
    expect(ofType(karo, 'musimChanged')).toEqual([]);

    state.clock.day = 36; // last day of Kapat (pancaroba)
    state.clock.minute = dayStartMinute;
    const kalima = run(ticksPerDay, state).events;
    expect(ofType(kalima, 'musimChanged')).toEqual([{ type: 'musimChanged', musim: 'hujan' }]);
  });

  test('emits hijriMonthChanged on the first of a Hijri month', () => {
    const state = createClockState(calendarData);
    state.clock.day = 76; // 1 Ramadan 1448 is day 77
    expect(ofType(run(ticksPerDay, state).events, 'hijriMonthChanged')).toEqual([
      { type: 'hijriMonthChanged', year: 1448, month: 9 },
    ]);
  });

  test('is deterministic: one big step equals many small ones', () => {
    const big = run(ticksPerDay * 2);
    const state = createClockState(calendarData);
    const events: SimEvent[] = [];
    for (let i = 0; i < ticksPerDay * 2; i++) events.push(...run(1, state).events);
    expect(state).toEqual(big.state);
    expect(events).toEqual(big.events);
  });
});
