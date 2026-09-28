import { beforeAll, describe, expect, test } from 'bun:test';
import type { CalendarData } from '@bale/shared';
import {
  dayOnOrAfterJdn,
  hijriOf,
  hijriToDay,
  hijriToJdn,
  hijriToReal,
  jawaOf,
  jdnOf,
  jdnToHijri,
  masehiOf,
  masehiToJdn,
  musimOf,
  pasaranOf,
  prayerBandOf,
  projectDay,
  realToHijri,
  weekdayOf,
} from './calendar.ts';
import { loadCalendarForTests } from './testing/calendar-data.ts';

let cal: CalendarData;
beforeAll(async () => {
  cal = await loadCalendarForTests();
});

const at = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h as number) * 60 + (m as number);
};

describe('Masehi, scaled (ADR-0009)', () => {
  test('day 0 is the arrival: 1 Juli 2026, kemarau', () => {
    expect(projectDay(0, cal)).toMatchObject({
      masehi: { year: 2026, month: 7, monthId: 'jul', date: 1, monthDay: 0 },
      musim: 'kemarau',
    });
  });

  test('a month is 10 game days showing 1, 4, 7 … 28, then the next month starts', () => {
    const dates = Array.from({ length: 10 }, (_, day) => masehiOf(day, cal).date);
    expect(dates).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28]);
    expect(masehiOf(10, cal)).toMatchObject({ month: 8, date: 1 });
  });

  test('a game year is 120 days and 1 Januari follows 31 Desember’s game day', () => {
    // July is month 7, so 1 Januari 2027 is 6 months × 10 days later.
    expect(masehiOf(59, cal)).toMatchObject({ year: 2026, month: 12, date: 28 });
    expect(masehiOf(60, cal)).toMatchObject({ year: 2027, month: 1, date: 1 });
    expect(masehiOf(60 + 120, cal)).toMatchObject({ year: 2028, month: 1, date: 1 });
  });

  test('February scales from its real length, leap years included', () => {
    const feb = (year: number) =>
      Array.from({ length: 10 }, (_, k) => masehiOf(60 + (year - 2027) * 120 + 10 + k, cal).date);
    expect(feb(2027)).toEqual([1, 3, 6, 9, 12, 15, 17, 20, 23, 26]);
    expect(feb(2028)).toEqual([1, 3, 6, 9, 12, 15, 18, 21, 24, 27]);
  });

  test('days before the arrival project backwards', () => {
    expect(masehiOf(-1, cal)).toMatchObject({ year: 2026, month: 6, date: 28 });
  });

  test('musim totals over a year: hujan 50, kemarau 50, pancaroba 20', () => {
    const totals: Record<string, number> = {};
    for (let day = 0; day < cal.gameYearDays; day++) {
      const musim = musimOf(day, cal);
      totals[musim] = (totals[musim] ?? 0) + 1;
    }
    expect(totals).toEqual({ kemarau: 50, pancaroba: 20, hujan: 50 });
  });
});

describe('Julian day numbers', () => {
  test('17 Agustus 1945 was Jumat Legi', () => {
    const jdn = masehiToJdn({ year: 1945, month: 8, day: 17 });
    expect(jdn).toBe(2431685);
    expect(jdn % 7).toBe(4); // 0 = Senin
    expect(jdn % 5).toBe(0); // 0 = Legi
  });

  test('jdnOf follows the shown date', () => {
    expect(jdnOf(1, cal) - jdnOf(0, cal)).toBe(3); // 1 → 4 Juli
  });
});

describe('weekday and pasaran', () => {
  test('day 0 is the real Rabu Wage of 1 Juli 2026', () => {
    expect([weekdayOf(0, cal), pasaranOf(0, cal)]).toEqual(['wed', 'wage']);
  });

  test('both advance one per game day, whatever date is skipped', () => {
    expect([1, 2, 7].map((day) => weekdayOf(day, cal))).toEqual(['thu', 'fri', 'wed']);
    expect([1, 2, 5].map((day) => pasaranOf(day, cal))).toEqual(['kliwon', 'legi', 'wage']);
  });

  test('pasaran is stable against the year because 120 is divisible by 5', () => {
    expect(pasaranOf(cal.gameYearDays, cal)).toBe(pasaranOf(0, cal));
  });
});

describe('tabular Hijri', () => {
  test('converts dates to real day counts and back', () => {
    for (let real = 0; real < 10631 * 2; real += 7) {
      expect(hijriToReal(realToHijri(real))).toBe(real);
    }
  });

  test('a 30-year cycle is 10631 days with 11 leap years', () => {
    expect(hijriToReal({ year: 1441, month: 1, day: 1 })).toBe(
      hijriToReal({ year: 1411, month: 1, day: 1 }) + 10631,
    );
  });

  test('1 Juli 2026 is 15 Muharram 1448', () => {
    expect(hijriOf(0, cal)).toEqual({ year: 1448, month: 1, day: 15 });
  });

  test('the Hijri date only moves forward, by the real days between shown dates', () => {
    for (let day = 1; day < cal.gameYearDays * 3; day++) {
      const gap = jdnOf(day, cal) - jdnOf(day - 1, cal);
      const prev = hijriToReal(hijriOf(day - 1, cal));
      expect(hijriToReal(hijriOf(day, cal)) - prev).toBe(gap);
    }
  });

  test('hijriToDay lands on the first game day on or after the date', () => {
    const target = { year: 1448, month: 9, day: 1 };
    const day = hijriToDay(target, cal);
    expect(hijriToReal(hijriOf(day, cal))).toBeGreaterThanOrEqual(hijriToReal(target));
    expect(hijriToReal(hijriOf(day - 1, cal))).toBeLessThan(hijriToReal(target));
  });

  test('dayOnOrAfterJdn inverts jdnOf, before the arrival too', () => {
    for (let day = -200; day < 400; day += 7) {
      expect(dayOnOrAfterJdn(jdnOf(day, cal), cal)).toBe(day);
    }
  });

  test('Ramadan walks 10–12 real days earlier against the Masehi year each year', () => {
    const starts = [1448, 1449, 1450, 1451].map((year) => {
      const jdn = hijriToJdn({ year, month: 9, day: 1 });
      const shown = masehiOf(dayOnOrAfterJdn(jdn, cal), cal);
      return { jdn, month: shown.month };
    });
    expect(starts.map((s) => s.month)).toEqual([2, 1, 1, 1]);
    for (let i = 1; i < starts.length; i++) {
      const yearLater = (starts[i - 1]?.jdn ?? 0) + 365;
      const drift = yearLater - (starts[i]?.jdn ?? 0);
      expect(drift).toBeGreaterThanOrEqual(10);
      expect(drift).toBeLessThanOrEqual(12);
    }
  });
});

describe('Jawa', () => {
  test('is the Hijri date under Javanese names: 15 Sura 1960 Dal', () => {
    expect(jawaOf(0, cal)).toEqual({ year: 1960, month: 1, day: 15, yearName: 'dal' });
  });

  test('1 Sura 1959 (27 Juni 2025, tabular) was a Je year and a Jumat Kliwon', () => {
    const jdn = masehiToJdn({ year: 2025, month: 6, day: 27 });
    expect(jdnToHijri(jdn)).toEqual({ year: 1447, month: 1, day: 1 });
    expect([jdn % 7, jdn % 5]).toEqual([4, 4]); // Jumat, Kliwon
    const day = dayOnOrAfterJdn(jdn, cal);
    expect(jawaOf(day, cal)).toMatchObject({ year: 1959, yearName: 'je' });
  });
});

describe('prayer-time bands', () => {
  const jul = 7;

  test('the day opens at 05:00 in subuh', () => {
    expect(prayerBandOf(at('05:00'), jul, cal)).toBe('subuh');
  });

  test('reads the GDD §3.2 example: 15:40 is Ashar in every month', () => {
    for (let month = 1; month <= 12; month++) {
      expect(prayerBandOf(at('15:40'), month, cal)).toBe('ashar');
    }
  });

  test('a band starts exactly at its table time', () => {
    expect(prayerBandOf(at('17:36'), jul, cal)).toBe('ashar');
    expect(prayerBandOf(at('17:37'), jul, cal)).toBe('maghrib');
  });

  test('after midnight it is still isya', () => {
    expect(prayerBandOf(at('24:30'), jul, cal)).toBe('isya');
  });
});
