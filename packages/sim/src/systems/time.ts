import type { CalendarData } from '@bale/shared';
import { calendarDateOf, prayerBandOf } from '../calendar.ts';
import type { SimContext, System } from '../types.ts';

/**
 * The clock (ARCHITECTURE §3.2, GDD §3). `day` is the only calendar value stored; mangsa,
 * musim, pasaran, weekday and the Hijri date are projections of it (ADR-0007), and each
 * change event comes from comparing yesterday's projection with today's.
 */
export interface ClockState {
  clock: {
    /** Ticks into the current game-minute, 0 ≤ tick < `ticksPerMinute`. */
    tick: number;
    /** Absolute day, 0 = the arrival. */
    day: number;
    /** Minutes from the game day's midnight; passes 1440 after midnight (01:00 = 1500). */
    minute: number;
  };
}

export function createClockState(calendar: CalendarData): ClockState {
  return { clock: { tick: 0, day: 0, minute: calendar.clock.dayStartMinute } };
}

const hourOf = (minute: number) => Math.floor(minute / 60) % 24;

function startNextDay(state: ClockState, calendar: CalendarData, ctx: SimContext) {
  const clock = state.clock;
  const before = calendarDateOf(calendar, clock.day);
  clock.day += 1;
  clock.minute = calendar.clock.dayStartMinute;
  const after = calendarDateOf(calendar, clock.day);

  ctx.emit({ type: 'dayStarted', day: after.day });
  if (after.mangsa.id !== before.mangsa.id) {
    ctx.emit({ type: 'mangsaChanged', mangsa: after.mangsa.id, year: after.year });
  }
  if (after.musim !== before.musim) ctx.emit({ type: 'musimChanged', musim: after.musim });
  ctx.emit({ type: 'pasaranChanged', pasaran: after.pasaran });
  if (after.hijri.month !== before.hijri.month) {
    ctx.emit({ type: 'hijriMonthChanged', year: after.hijri.year, month: after.hijri.month });
  }
}

function advanceMinute(state: ClockState, calendar: CalendarData, ctx: SimContext) {
  const clock = state.clock;
  const bandBefore = prayerBandOf(calendar, clock.day, clock.minute);
  const hourBefore = hourOf(clock.minute);

  if (clock.minute + 1 >= calendar.clock.dayEndMinute) startNextDay(state, calendar, ctx);
  else clock.minute += 1;

  const hour = hourOf(clock.minute);
  if (hour !== hourBefore) ctx.emit({ type: 'hourChanged', hour });
  const band = prayerBandOf(calendar, clock.day, clock.minute);
  if (band !== bandBefore) ctx.emit({ type: 'prayerTimeChanged', band });
}

/**
 * Advances `ctx.ticks` ticks. Reaching `dayEndMinute` starts the next day at
 * `dayStartMinute`; sleeping and passing out, which end a day early, come later.
 */
export function createTimeSystem(calendar: CalendarData): System<ClockState> {
  return (state, ctx) => {
    for (let i = 0; i < ctx.ticks; i++) {
      state.clock.tick += 1;
      if (state.clock.tick < calendar.clock.ticksPerMinute) continue;
      state.clock.tick = 0;
      advanceMinute(state, calendar, ctx);
    }
  };
}
