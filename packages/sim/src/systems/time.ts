import type { CalendarData } from '@bale/shared';
import { type CalendarDate, hourOf, masehiOf, prayerBandOf, projectDay } from '../calendar.ts';
import type { SimContext, System } from '../types.ts';

/**
 * The `time` system (ARCHITECTURE §3.2, step 1): advances ticks, minutes and the `day`
 * counter, and emits the calendar events. Every calendar is a projection of `day`
 * (ADR-0009), so the system compares yesterday's projection with today's to decide what to
 * emit — nothing but `tick`, `minute` and `day` is stored.
 */

export interface ClockState {
  /** Ticks into the current game minute, 0 ≤ tick < ticksPerMinute. */
  tick: number;
  /** Absolute day; 0 is the arrival. */
  day: number;
  /** Minutes after the midnight that opens the game day; runs past 1440 until the day ends. */
  minute: number;
}

export interface TimeState {
  clock: ClockState;
}

export function createTimeState(cal: CalendarData): TimeState {
  return { clock: { tick: 0, day: 0, minute: cal.clock.dayStartMinute } };
}

/**
 * Ends the current day and starts the next at `dayStartMinute`. The clock calls it when the
 * day runs out; sleeping will call it too.
 */
export function startNextDay(state: TimeState, ctx: SimContext, cal: CalendarData): void {
  const { clock } = state;
  const before = projectDay(clock.day, cal);
  const bandBefore = prayerBandOf(clock.minute, before.masehi.month, cal);
  const hourBefore = hourOf(clock.minute);

  clock.day++;
  clock.minute = cal.clock.dayStartMinute;
  clock.tick = 0;
  const after = projectDay(clock.day, cal);

  ctx.emit({ type: 'dayStarted', day: clock.day });
  emitCalendarChanges(before, after, ctx);
  const hour = hourOf(clock.minute);
  if (hour !== hourBefore) ctx.emit({ type: 'hourChanged', hour });
  const band = prayerBandOf(clock.minute, after.masehi.month, cal);
  if (band !== bandBefore) ctx.emit({ type: 'prayerTimeChanged', band });
}

function emitCalendarChanges(before: CalendarDate, after: CalendarDate, ctx: SimContext): void {
  if (after.masehi.month !== before.masehi.month) {
    ctx.emit({ type: 'monthChanged', year: after.masehi.year, month: after.masehi.month });
  }
  if (after.musim !== before.musim) {
    ctx.emit({ type: 'musimChanged', musim: after.musim });
  }
  if (after.pasaran !== before.pasaran) {
    ctx.emit({ type: 'pasaranChanged', pasaran: after.pasaran });
  }
  if (after.hijri.month !== before.hijri.month) {
    ctx.emit({ type: 'hijriMonthChanged', year: after.hijri.year, month: after.hijri.month });
  }
}

export function createTimeSystem(cal: CalendarData): System<TimeState> {
  return (state, ctx) => {
    const { clock } = state;
    for (let i = 0; i < ctx.ticks; i++) {
      clock.tick++;
      if (clock.tick < cal.clock.ticksPerMinute) continue;
      clock.tick = 0;

      const { month } = masehiOf(clock.day, cal);
      const bandBefore = prayerBandOf(clock.minute, month, cal);
      clock.minute++;
      if (clock.minute >= cal.clock.dayEndMinute) {
        startNextDay(state, ctx, cal);
        continue;
      }
      if (clock.minute % 60 === 0) ctx.emit({ type: 'hourChanged', hour: hourOf(clock.minute) });
      const band = prayerBandOf(clock.minute, month, cal);
      if (band !== bandBefore) ctx.emit({ type: 'prayerTimeChanged', band });
    }
  };
}
