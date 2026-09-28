import { describe, expect, test } from 'bun:test';
import {
  MASEHI_MONTH_IDS,
  masehiMonthLength,
  parseClockTime,
  type RawCalendarFiles,
  scaledDate,
  validateCalendar,
} from './calendar.ts';

const TIMES = ['04:30', '05:50', '11:45', '15:00', '17:40', '18:50'];

function nth<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`fixture has no item ${index}`);
  return item;
}

/** A minimal valid set: every month kemarau, every month the same prayer times. */
function files() {
  return {
    months: {
      gameYearDays: 120,
      months: MASEHI_MONTH_IDS.map((id): { id: string; musim: string } => ({
        id,
        musim: 'kemarau',
      })),
    },
    clock: {
      ticksPerMinute: 7,
      dayStartMinute: 300,
      dayEndMinute: 1500,
      arrival: { year: 2026, month: 7, day: 1 },
      jawa: { hijriYearOffset: 512, alipYear: 1956 } as unknown,
    },
    prayerTimes: {
      bands: ['subuh', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'],
      byMonth: MASEHI_MONTH_IDS.map((month): { month: string; starts: string[] } => ({
        month,
        starts: TIMES,
      })),
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
    if (result.ok) {
      expect(result.data.gameMonthDays).toBe(10);
      expect(result.data.months[0]?.prayerStarts[0]).toBe(270);
    }
  });

  test('rejects a year that does not split into 12 equal months', () => {
    const raw = files();
    raw.months.gameYearDays = 125;
    expect(errorsOf(raw).join()).toContain('multiple of 12');
  });

  test('rejects months missing or out of order', () => {
    const raw = files();
    raw.months.months.reverse();
    expect(errorsOf(raw).join()).toContain('months must be the 12 rows');
  });

  test('rejects an unknown musim', () => {
    const raw = files();
    nth(raw.months.months, 0).musim = 'both';
    expect(errorsOf(raw)).toContain(
      "months.json5: jan.musim 'both' is not one of kemarau, pancaroba, hujan",
    );
  });

  test('rejects a month with no prayer-time row, and a row for an unknown month', () => {
    const raw = files();
    nth(raw.prayerTimes.byMonth, 1).month = 'kasa';
    const errors = errorsOf(raw).map((e) => e.replace('prayer-times.json5: ', ''));
    expect(errors).toContain("no row for month 'feb'");
    expect(errors).toContain("row for unknown month 'kasa'");
  });

  test('rejects prayer times that are not strictly increasing', () => {
    const raw = files();
    nth(raw.prayerTimes.byMonth, 0).starts = [...TIMES].reverse();
    expect(errorsOf(raw).join()).toContain('strictly increasing');
  });

  test('rejects an impossible arrival date', () => {
    const raw = files();
    raw.clock.arrival = { year: 2026, month: 2, day: 29 };
    expect(errorsOf(raw).join()).toContain('arrival must be a valid Masehi');
  });

  test('rejects an arrival the scaled calendar skips, naming the dates it shows', () => {
    const raw = files();
    raw.clock.arrival = { year: 2026, month: 7, day: 2 };
    expect(errorsOf(raw).join()).toContain('pick one of 1, 4, 7, 10, 13, 16, 19, 22, 25, 28');
  });

  test('rejects a missing Javanese anchor', () => {
    const raw = files();
    raw.clock.jawa = undefined;
    expect(errorsOf(raw).join()).toContain('jawa must be');
  });

  test('rejects a day that ends before it starts', () => {
    const raw = files();
    raw.clock.dayEndMinute = 200;
    expect(errorsOf(raw).join()).toContain('dayEndMinute');
  });
});

describe('Masehi month arithmetic', () => {
  test('February has 29 days in a leap year only', () => {
    expect([2026, 2028, 2100, 2000].map((y) => masehiMonthLength(y, 2))).toEqual([28, 29, 28, 29]);
  });

  test('a scaled month always shows the 1st and never runs past its last day', () => {
    for (const length of [28, 29, 30, 31]) {
      const shown = Array.from({ length: 10 }, (_, k) => scaledDate(k, length, 10));
      expect(shown[0]).toBe(1);
      expect(Math.max(...shown)).toBeLessThanOrEqual(length);
      expect(new Set(shown).size).toBe(10);
    }
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
