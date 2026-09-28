import { expect, test } from 'bun:test';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { clockViewOf } from './clock-view.ts';

const cal = CALENDAR_DATA;

test('day 0 at 05:00 is subuh on Rabu Wage, 1 Juli 2026 = 15 Sura 1960 Dal = 15 Muharram 1448', () => {
  expect(clockViewOf({ tick: 0, day: 0, minute: 300 }, cal)).toEqual({
    hour: 5,
    minute: 0,
    band: 'subuh',
    weekday: 'wed',
    pasaran: 'wage',
    date: 1,
    month: 'jul',
    year: 2026,
    jawa: { day: 15, month: 'sura', year: 1960, yearName: 'dal' },
    hijri: { day: 15, month: 'muharram', year: 1448 },
  });
});

test('reads the GDD §3.2 example: 15:40 is Ashar', () => {
  const view = clockViewOf({ tick: 3, day: 4, minute: 15 * 60 + 40 }, cal);
  expect([view.hour, view.minute, view.band]).toEqual([15, 40, 'ashar']);
});

test('past midnight the wall clock wraps and it is still isya', () => {
  const view = clockViewOf({ tick: 0, day: 0, minute: 1440 + 30 }, cal);
  expect([view.hour, view.minute, view.band]).toEqual([0, 30, 'isya']);
});
