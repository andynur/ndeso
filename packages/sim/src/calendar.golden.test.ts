import { beforeAll, expect, test } from 'bun:test';
import { type CalendarData, HIJRI_MONTH } from '@bale/shared';
import { type CalendarDate, hijriToDay, projectDay } from './calendar.ts';
import { createTimeState, createTimeSystem } from './systems/time.ts';
import { loadCalendarForTests } from './testing/calendar-data.ts';
import { createContext } from './types.ts';

/**
 * Golden: three whole game years of the calendar (ROADMAP M1-01, ARCHITECTURE §3.4). A mangsa
 * length, the Hijri anchor or the tabular arithmetic changing shows up here as a readable
 * diff. Update with `bun test -u` only on purpose, and say why in the PR.
 */

const YEARS = 3;
let cal: CalendarData;
beforeAll(async () => {
  cal = await loadCalendarForTests();
});

const line = (d: CalendarDate): string =>
  [
    `day ${String(d.day).padStart(3)}`,
    `y${d.year}`,
    `${d.mangsa.id} ${d.mangsa.day}/${d.mangsa.length} (${d.mangsa.musim})`,
    `${d.weekday} ${d.pasaran}`,
    `${d.hijri.day}/${d.hijri.month}/${d.hijri.year} of ${d.hijri.monthLength}`,
  ].join(' · ');

test(`mangsa boundaries for ${YEARS} years`, () => {
  const rows: string[] = [];
  for (let day = 0; day < cal.gameYearDays * YEARS; day++) {
    const date = projectDay(day, cal);
    if (date.mangsa.day === 1) rows.push(line(date));
  }
  expect(rows).toMatchSnapshot();
});

test(`Hijri festival dates for ${YEARS} years`, () => {
  const festivals = [
    { id: 'ramadan', month: HIJRI_MONTH.ramadan, day: 1 },
    { id: 'lebaran', month: HIJRI_MONTH.syawal, day: 1 },
    { id: 'idul_adha', month: HIJRI_MONTH.dzulhijah, day: 10 },
  ];
  const end = cal.gameYearDays * YEARS;
  const rows: { day: number; text: string }[] = [];
  const first = projectDay(0, cal).hijri.year;
  const last = projectDay(end - 1, cal).hijri.year;
  for (let year = first; year <= last; year++) {
    for (const festival of festivals) {
      const day = hijriToDay({ year, month: festival.month, day: festival.day }, cal);
      if (day >= 0 && day < end) {
        rows.push({ day, text: `${festival.id.padEnd(9)} ${line(projectDay(day, cal))}` });
      }
    }
  }
  rows.sort((a, b) => a.day - b.day);
  expect(rows.map((row) => row.text)).toMatchSnapshot();
});

test(`the time system's calendar events agree with the projections over ${YEARS} years`, () => {
  const state = createTimeState(cal);
  const ctx = createContext(
    cal.clock.ticksPerMinute * (cal.clock.dayEndMinute - cal.clock.dayStartMinute),
  );
  const system = createTimeSystem(cal);
  const seen: string[] = [];
  const expected: string[] = [];
  for (let day = 1; day < cal.gameYearDays * YEARS; day++) {
    ctx.events.length = 0;
    system(state, ctx);
    expect(state.clock.day).toBe(day);
    for (const { type, mangsa, month } of ctx.events) {
      if (type === 'mangsaChanged') seen.push(`${day} mangsa ${String(mangsa)}`);
      if (type === 'hijriMonthChanged') seen.push(`${day} hijri ${String(month)}`);
    }
    const today = projectDay(day, cal);
    const yesterday = projectDay(day - 1, cal);
    if (today.mangsa.id !== yesterday.mangsa.id) expected.push(`${day} mangsa ${today.mangsa.id}`);
    if (today.hijri.month !== yesterday.hijri.month) {
      expected.push(`${day} hijri ${today.hijri.month}`);
    }
  }
  expect(seen).toEqual(expected);
  expect(seen.length).toBeGreaterThan(YEARS * 12 * 2 - 4);
});
