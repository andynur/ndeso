import { expect, test } from 'bun:test';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { clockViewOf } from './clock-view.ts';

const cal = CALENDAR_DATA;

test('day 0 at 05:00 is subuh, Kasa day 1, Legi', () => {
  expect(clockViewOf({ tick: 0, day: 0, minute: 300 }, cal)).toEqual({
    hour: 5,
    minute: 0,
    band: 'subuh',
    mangsa: 'kasa',
    mangsaDay: 1,
    mangsaLength: cal.mangsa[0]?.gameDays ?? 0,
    pasaran: 'legi',
  });
});

test('reads the GDD §3.2 example: 15:40 is Ashar, day 4 is Kliwon', () => {
  const view = clockViewOf({ tick: 3, day: 4, minute: 15 * 60 + 40 }, cal);
  expect([view.hour, view.minute, view.band, view.pasaran]).toEqual([15, 40, 'ashar', 'kliwon']);
});

test('past midnight the wall clock wraps and it is still isya', () => {
  const view = clockViewOf({ tick: 0, day: 0, minute: 1440 + 30 }, cal);
  expect([view.hour, view.minute, view.band]).toEqual([0, 30, 'isya']);
});
