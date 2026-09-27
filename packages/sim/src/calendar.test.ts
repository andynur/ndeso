import { beforeAll, describe, expect, test } from 'bun:test';
import type { CalendarData } from '@bale/shared';
import {
  hijriOf,
  hijriToDay,
  hijriToReal,
  mangsaOf,
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

describe('pranata mangsa', () => {
  test('day 0 is the first day of Kasa, year 1', () => {
    expect(projectDay(0, cal)).toMatchObject({
      year: 1,
      dayOfYear: 0,
      mangsa: { id: 'kasa', day: 1, length: 13, musim: 'kemarau' },
    });
  });

  test('Kasa lasts 13 days, then Karo starts', () => {
    expect(mangsaOf(12, cal)).toMatchObject({ id: 'kasa', day: 13 });
    expect(mangsaOf(13, cal)).toMatchObject({ id: 'karo', day: 1, length: 8 });
  });

  test('the last day of the year is Sadha 13/13 and day 120 opens year 2 in Kasa', () => {
    expect(mangsaOf(119, cal)).toMatchObject({ id: 'sadha', day: 13, length: 13 });
    expect(projectDay(120, cal)).toMatchObject({ year: 2, dayOfYear: 0, mangsa: { id: 'kasa' } });
  });

  test('musim totals match GDD §3: hujan 54, kemarau 50, pancaroba 16', () => {
    const totals: Record<string, number> = {};
    for (let day = 0; day < cal.gameYearDays; day++) {
      const { musim } = mangsaOf(day, cal);
      totals[musim] = (totals[musim] ?? 0) + 1;
    }
    expect(totals).toEqual({ kemarau: 50, pancaroba: 16, hujan: 54 });
  });
});

describe('pasaran and weekday', () => {
  test('pasaran is day % 5 starting at Legi', () => {
    expect([0, 1, 2, 3, 4, 5].map(pasaranOf)).toEqual([
      'legi',
      'pahing',
      'pon',
      'wage',
      'kliwon',
      'legi',
    ]);
  });

  test('pasaran is stable against the year because 120 is divisible by 5', () => {
    expect(pasaranOf(cal.gameYearDays)).toBe(pasaranOf(0));
  });

  test('the week starts on Senin at day 0 and repeats every 7 days', () => {
    expect(weekdayOf(0, cal)).toBe('mon');
    expect(weekdayOf(6, cal)).toBe('sun');
    expect(weekdayOf(7, cal)).toBe('mon');
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

  test('day 0 falls in Muharram 1448, the month having started before the arrival', () => {
    expect(hijriOf(0, cal)).toMatchObject({ year: 1448, month: 1 });
    expect(hijriOf(0, cal).day).toBeGreaterThan(1);
  });

  test('months are 9 or 10 game days and each day follows the last', () => {
    for (let day = 1; day < cal.gameYearDays * 3; day++) {
      const prev = hijriOf(day - 1, cal);
      const today = hijriOf(day, cal);
      expect([9, 10]).toContain(today.monthLength);
      if (today.month === prev.month) {
        expect(today.day).toBe(prev.day + 1);
      } else {
        expect(today.day).toBe(1);
        expect(prev.day).toBe(prev.monthLength);
      }
    }
  });

  test('hijriToDay lands on the first game day of the month', () => {
    const day = hijriToDay({ year: 1448, month: 9, day: 1 }, cal);
    expect(hijriOf(day, cal)).toMatchObject({ year: 1448, month: 9, day: 1 });
  });

  test('Ramadan walks 3–4 days earlier against the solar year each year (ADR-0007)', () => {
    const starts = [1448, 1449, 1450, 1451].map(
      (year) => hijriToDay({ year, month: 9, day: 1 }, cal) % cal.gameYearDays,
    );
    for (let i = 1; i < starts.length; i++) {
      const drift = (starts[i - 1] as number) - (starts[i] as number);
      expect(drift).toBeGreaterThanOrEqual(3);
      expect(drift).toBeLessThanOrEqual(4);
    }
  });
});

describe('prayer-time bands', () => {
  const kasa = () => mangsaOf(0, cal);
  const kapat = () => mangsaOf(31, cal); // Kapat hari 3/8, as in GDD §3.2

  test('the day opens at 05:00 in subuh', () => {
    expect(prayerBandOf(at('05:00'), kasa(), cal)).toBe('subuh');
  });

  test('reads the GDD §3.2 example: 15:40 in Kapat is Ashar', () => {
    expect(kapat().id).toBe('kapat');
    expect(prayerBandOf(at('15:40'), kapat(), cal)).toBe('ashar');
  });

  test('a band starts exactly at its table time', () => {
    expect(prayerBandOf(at('17:36'), kasa(), cal)).toBe('ashar');
    expect(prayerBandOf(at('17:37'), kasa(), cal)).toBe('maghrib');
  });

  test('after midnight it is still isya', () => {
    expect(prayerBandOf(at('24:30'), kasa(), cal)).toBe('isya');
  });
});
