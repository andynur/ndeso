import { describe, expect, test } from 'bun:test';
import { parseClockTime, type RawCalendarFiles, validateCalendar } from './calendar.ts';

const TIMES = ['04:30', '05:50', '11:45', '15:00', '17:40', '18:50'];

function nth<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`fixture has no item ${index}`);
  return item;
}

/** A minimal valid set: two mangsa of 60 game days each. */
function files() {
  return {
    mangsa: {
      realYearDays: 365,
      gameYearDays: 120,
      mangsa: [
        { id: 'kasa', realDays: 180, gameDays: 60, musim: 'kemarau' },
        { id: 'karo', realDays: 185, gameDays: 60, musim: 'hujan' },
      ],
    },
    clock: {
      ticksPerMinute: 7,
      dayStartMinute: 300,
      dayEndMinute: 1500,
      weekdayOfDay0: 'mon',
      hijriOfDay0: { year: 1448, month: 1, day: 6 },
    },
    prayerTimes: {
      bands: ['subuh', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'],
      byMangsa: [
        { mangsa: 'kasa', starts: TIMES },
        { mangsa: 'karo', starts: TIMES },
      ],
    },
  };
}

const errorsOf = (raw: RawCalendarFiles): readonly string[] => {
  const result = validateCalendar(raw);
  return result.ok ? [] : result.errors;
};

describe('validateCalendar', () => {
  test('accepts valid data and converts prayer times to minutes', () => {
    const result = validateCalendar(files());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.mangsa[0]?.prayerStarts[0]).toBe(270);
  });

  test('rejects gameDays that do not sum to gameYearDays', () => {
    const raw = files();
    nth(raw.mangsa.mangsa, 0).gameDays = 59;
    expect(errorsOf(raw)).toContain('mangsa.json5: gameDays sum to 119, but gameYearDays is 120');
  });

  test('rejects a year length that breaks the pasaran grid', () => {
    const raw = files();
    raw.mangsa.gameYearDays = 121;
    nth(raw.mangsa.mangsa, 0).gameDays = 61;
    expect(errorsOf(raw).join()).toContain('divisible by 5');
  });

  test('rejects duplicate mangsa ids', () => {
    const raw = files();
    nth(raw.mangsa.mangsa, 1).id = 'kasa';
    expect(errorsOf(raw).join()).toContain("'kasa' is a duplicate");
  });

  test('rejects an unknown musim tag', () => {
    const raw = files();
    nth(raw.mangsa.mangsa, 0).musim = 'both';
    expect(errorsOf(raw).join()).toContain("kasa.musim 'both' is not one of");
  });

  test('rejects a mangsa with no prayer-time row, and a row for an unknown mangsa', () => {
    const raw = files();
    nth(raw.prayerTimes.byMangsa, 1).mangsa = 'kapat';
    const errors = errorsOf(raw).join('\n');
    expect(errors).toContain("no row for mangsa 'karo'");
    expect(errors).toContain("row for unknown mangsa 'kapat'");
  });

  test('rejects prayer times out of order', () => {
    const raw = files();
    nth(raw.prayerTimes.byMangsa, 0).starts = [...TIMES].reverse();
    expect(errorsOf(raw).join()).toContain('kasa: starts must be strictly increasing');
  });

  test('rejects an impossible Hijri anchor', () => {
    const raw = files();
    raw.clock.hijriOfDay0 = { year: 1448, month: 2, day: 30 };
    expect(errorsOf(raw).join()).toContain('hijriOfDay0');
  });

  test('rejects a day that ends before it starts', () => {
    const raw = files();
    raw.clock.dayEndMinute = 200;
    expect(errorsOf(raw).join()).toContain('dayEndMinute');
  });
});

describe('parseClockTime', () => {
  test('reads HH:MM as minutes after midnight', () => {
    expect(parseClockTime('00:00')).toBe(0);
    expect(parseClockTime('18:51')).toBe(1131);
  });

  test('rejects anything else', () => {
    for (const bad of ['24:00', '5:00', '12:60', 300, undefined]) {
      expect(parseClockTime(bad)).toBeUndefined();
    }
  });
});
