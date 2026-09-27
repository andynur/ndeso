import { describe, expect, test } from 'bun:test';
import { calendarData } from '@bale/content/calendar';
import { calendarDateOf } from '../../src/calendar.ts';
import { createClockState, createTimeSystem } from '../../src/systems/time.ts';
import { createContext, type SimEvent } from '../../src/types.ts';

/**
 * Golden: three full game years of the clock (TESTING §2, ADR-0007). A change to any
 * calendar data file or projection shows up here as a diff; update with `bun test -u`
 * only on purpose, and say why in the PR.
 */
const YEARS = 3;
const DAYS = YEARS * calendarData.mangsa.gameYearDays;
const { ticksPerMinute, dayStartMinute, dayEndMinute } = calendarData.clock;
const TICKS_PER_DAY = (dayEndMinute - dayStartMinute) * ticksPerMinute;

const pad = (value: number, width: number) => String(value).padStart(width, '0');

function runYears(): { day: number; events: SimEvent[] }[] {
  const time = createTimeSystem(calendarData);
  const state = createClockState(calendarData);
  const days = [];
  for (let day = 0; day < DAYS; day++) {
    const ctx = createContext(TICKS_PER_DAY);
    time(state, ctx);
    days.push({ day: state.clock.day, events: ctx.events });
  }
  return days;
}

const run = runYears();

describe(`golden: ${YEARS} years of the calendar`, () => {
  test('the clock ends exactly on the first morning after the last day', () => {
    expect(run.at(-1)?.day).toBe(DAYS);
  });

  test('every day, projected: year, mangsa, musim, weekday, pasaran, Hijri', () => {
    const lines = [];
    for (let day = 0; day < DAYS; day++) {
      const d = calendarDateOf(calendarData, day);
      const hijri = `${d.hijri.year}-${pad(d.hijri.month, 2)}-${pad(d.hijri.day, 2)}`;
      lines.push(
        `${pad(day, 3)} y${d.year} ${d.mangsa.id} ${d.dayOfMangsa}/${d.mangsa.gameDays} ` +
          `${d.musim} ${d.weekday} ${d.pasaran} ${hijri}`,
      );
    }
    expect(lines.join('\n')).toMatchSnapshot();
  });

  test('calendar events from the running system, by the day they start', () => {
    const CALENDAR_EVENTS = ['mangsaChanged', 'musimChanged', 'hijriMonthChanged'];
    const lines = run.flatMap(({ day, events }) =>
      events
        .filter((event) => CALENDAR_EVENTS.includes(event.type))
        .map(({ type, ...rest }) => `${pad(day, 3)} ${type} ${JSON.stringify(rest)}`),
    );
    expect(lines.join('\n')).toMatchSnapshot();
  });

  test('festival dates: Sedekah Bumi season, Ramadan, Lebaran, Idul Adha', () => {
    const festivals = [];
    for (let day = 0; day < DAYS; day++) {
      const d = calendarDateOf(calendarData, day);
      const tag = `${pad(day, 3)} y${d.year} ${d.mangsa.id} ${d.dayOfMangsa} ${d.pasaran}`;
      if (d.mangsa.id === 'kasadasa' && d.dayOfMangsa === 1) festivals.push(`${tag}: kasadasa`);
      if (d.hijri.month === 9 && d.hijri.day === 1) festivals.push(`${tag}: 1 Ramadan`);
      if (d.hijri.month === 10 && d.hijri.day === 1) festivals.push(`${tag}: 1 Syawal`);
      if (d.hijri.month === 12 && d.hijri.day === 10) festivals.push(`${tag}: 10 Dzulhijjah`);
    }
    expect(festivals).toMatchSnapshot();
  });

  test('pasaran and dayStarted fire once a day, every day', () => {
    for (const { day, events } of run) {
      expect(events.filter((event) => event.type === 'dayStarted')).toEqual([
        { type: 'dayStarted', day },
      ]);
      expect(events.filter((event) => event.type === 'pasaranChanged')).toHaveLength(1);
    }
  });
});
