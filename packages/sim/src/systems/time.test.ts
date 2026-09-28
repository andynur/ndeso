import { beforeAll, describe, expect, test } from 'bun:test';
import type { CalendarData } from '@bale/shared';
import { loadCalendarForTests } from '../testing/calendar-data.ts';
import { createContext, type SimEvent } from '../types.ts';
import { createTimeState, createTimeSystem, startNextDay, type TimeState } from './time.ts';

let cal: CalendarData;
beforeAll(async () => {
  cal = await loadCalendarForTests();
});

const minutes = (n: number) => n * cal.clock.ticksPerMinute;
const dayTicks = () => minutes(cal.clock.dayEndMinute - cal.clock.dayStartMinute);

function run(ticks: number, state: TimeState = createTimeState(cal)) {
  const ctx = createContext(ticks);
  createTimeSystem(cal)(state, ctx);
  return { state, events: ctx.events };
}

const ofType = (events: SimEvent[], type: string) => events.filter((e) => e.type === type);

describe('time system', () => {
  test('starts on day 0 at 05:00', () => {
    expect(createTimeState(cal)).toEqual({ clock: { tick: 0, day: 0, minute: 300 } });
  });

  test('advances one game minute every ticksPerMinute ticks (0.7 s at 10 Hz)', () => {
    expect(cal.clock.ticksPerMinute).toBe(7);
    expect(run(6).state.clock).toEqual({ tick: 6, day: 0, minute: 300 });
    expect(run(7).state.clock).toEqual({ tick: 0, day: 0, minute: 301 });
  });

  test('emits hourChanged on the hour', () => {
    const { events } = run(minutes(60));
    expect(ofType(events, 'hourChanged')).toEqual([{ type: 'hourChanged', hour: 6 }]);
  });

  test('emits prayerTimeChanged when a band starts (dhuha at 05:55 in Juli)', () => {
    const { events } = run(minutes(55));
    expect(ofType(events, 'prayerTimeChanged')).toEqual([
      { type: 'prayerTimeChanged', band: 'dhuha' },
    ]);
  });

  test('the day ends at 01:00 and the next starts at 05:00', () => {
    const { state, events } = run(dayTicks());
    expect(state.clock).toEqual({ tick: 0, day: 1, minute: 300 });
    const rollover = events.slice(events.findIndex((e) => e.type === 'dayStarted'));
    expect(rollover).toEqual([
      { type: 'dayStarted', day: 1 },
      { type: 'pasaranChanged', pasaran: 'kliwon' },
      { type: 'hourChanged', hour: 5 },
      { type: 'prayerTimeChanged', band: 'subuh' },
    ]);
  });

  test('passes midnight without ending the day', () => {
    const { state, events } = run(minutes(1440 - 300));
    expect(state.clock).toMatchObject({ day: 0, minute: 1440 });
    expect(events.at(-1)).toEqual({ type: 'hourChanged', hour: 0 });
  });

  test('emits monthChanged when Agustus starts on day 10', () => {
    const state = createTimeState(cal);
    const ctx = createContext();
    for (let i = 0; i < 10; i++) startNextDay(state, ctx, cal);
    expect(ofType(ctx.events, 'monthChanged')).toEqual([
      { type: 'monthChanged', year: 2026, month: 8 },
    ]);
    expect(ofType(ctx.events, 'musimChanged')).toEqual([]);
  });

  test('emits musimChanged when Oktober brings pancaroba on day 30', () => {
    const state = createTimeState(cal);
    const ctx = createContext();
    for (let i = 0; i < 30; i++) startNextDay(state, ctx, cal);
    expect(ofType(ctx.events, 'musimChanged')).toEqual([
      { type: 'musimChanged', musim: 'pancaroba' },
    ]);
  });

  test('one big step equals many single-tick steps', () => {
    const ticks = minutes(1300);
    const whole = run(ticks);
    const state = createTimeState(cal);
    const events: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) events.push(...run(1, state).events);
    expect(state).toEqual(whole.state);
    expect(events).toEqual(whole.events);
  });
});
