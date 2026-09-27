import { describe, expect, test } from 'bun:test';
import { calendarData } from '@bale/content/calendar';
import type { CalendarData, HijriDate } from '@bale/shared';
import {
  calendarDateOf,
  hijriOf,
  mangsaOf,
  pasaranOf,
  prayerBandOf,
  weekdayOf,
} from './calendar.ts';

const at = (day: number) => {
  const date = mangsaOf(calendarData, day);
  return `${date.year}:${date.mangsa.id} ${date.dayOfMangsa}/${date.mangsa.gameDays}`;
};

const hhmm = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3));

const nextHijri = (calendar: CalendarData, date: HijriDate, length: number): HijriDate => {
  if (date.day < length) return { ...date, day: date.day + 1 };
  if (date.month < calendar.hijri.monthDays.length) {
    return { year: date.year, month: date.month + 1, day: 1 };
  }
  return { year: date.year + 1, month: 1, day: 1 };
};

describe('pranata mangsa', () => {
  test('day 0 is 1 Kasa of year 1', () => {
    expect(at(0)).toBe('1:kasa 1/13');
  });

  test('each mangsa hands over to the next at its length', () => {
    expect(at(12)).toBe('1:kasa 13/13');
    expect(at(13)).toBe('1:karo 1/8');
    expect(at(119)).toBe('1:sadha 13/13');
  });

  test('the year wraps after 120 days', () => {
    expect(at(120)).toBe('2:kasa 1/13');
    expect(at(360)).toBe('4:kasa 1/13');
  });

  test('musim adds up to the GDD §3 split: hujan 54, kemarau 50, pancaroba 16', () => {
    const days: Record<string, number> = {};
    for (let day = 0; day < 120; day++) {
      const { musim } = calendarDateOf(calendarData, day);
      days[musim] = (days[musim] ?? 0) + 1;
    }
    expect(days).toEqual({ hujan: 54, kemarau: 50, pancaroba: 16 });
  });
});

describe('pasaran and weekday', () => {
  test('pasaran is day % 5 from Legi, and stays aligned to the 120-day year', () => {
    expect([0, 1, 2, 3, 4, 5].map(pasaranOf)).toEqual([
      'legi',
      'pahing',
      'pon',
      'wage',
      'kliwon',
      'legi',
    ]);
    expect(pasaranOf(120)).toBe(pasaranOf(0));
  });

  test('day 0 is a Senin and the week repeats every 7 days', () => {
    expect(weekdayOf(0)).toBe('mon');
    expect(weekdayOf(6)).toBe('sun');
    expect(weekdayOf(7)).toBe('mon');
  });
});

describe('tabular Hijri', () => {
  test('day 0 is the epoch in the data file', () => {
    expect(hijriOf(calendarData, 0)).toEqual(calendarData.hijri.epoch);
  });

  test('1 Ramadan walks ~4 days earlier each game year', () => {
    const starts: number[] = [];
    for (let day = 0; day < 360; day++) {
      const { month, day: date } = hijriOf(calendarData, day);
      if (month === 9 && date === 1) starts.push(day);
    }
    // 1448 and 1449 are common (116 days), 1450 is a leap year (117).
    expect(starts).toEqual([77, 193, 309]);
  });

  test('every day is the successor of the one before; 11 leap days per 30 years', () => {
    let previous = hijriOf(calendarData, 0);
    let leapDays = 0;
    const cycleDays = 30 * 116 + 11;
    for (let day = 1; day <= cycleDays; day++) {
      const today = hijriOf(calendarData, day);
      const length = calendarData.hijri.monthDays[previous.month - 1] as number;
      if (today.month === 12 && today.day === length + 1) leapDays++;
      else expect(today).toEqual(nextHijri(calendarData, previous, length));
      previous = today;
    }
    expect(leapDays).toBe(11);
    expect(hijriOf(calendarData, cycleDays)).toEqual({ ...calendarData.hijri.epoch, year: 1478 });
  });

  test('with real month lengths a 30-year cycle is 10 631 days, as in the real calendar', () => {
    const real: CalendarData = {
      ...calendarData,
      hijri: {
        ...calendarData.hijri,
        monthDays: [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29],
        epoch: { year: 1, month: 1, day: 1 },
      },
    };
    expect(hijriOf(real, 10_631)).toEqual({ year: 31, month: 1, day: 1 });
    expect(hijriOf(real, 10_630)).toEqual({ year: 30, month: 12, day: 29 });
    // Year 29 is a leap year, so its Dzulhijjah has a 30th day; year 30 is common.
    expect(hijriOf(real, 10_631 - 355)).toEqual({ year: 29, month: 12, day: 30 });
    expect(hijriOf(real, 10_631 - 354)).toEqual({ year: 30, month: 1, day: 1 });
  });
});

describe('prayer-time bands', () => {
  const { kasa, kapitu } = calendarData.clock.prayer;

  test('reads the band from the fixed table for the day’s mangsa', () => {
    expect(prayerBandOf(calendarData, 0, 300)).toBe('subuh');
    expect(prayerBandOf(calendarData, 0, kasa?.terbit ?? 0)).toBe('terbit');
    expect(prayerBandOf(calendarData, 0, hhmm('15:40'))).toBe('ashar');
    expect(prayerBandOf(calendarData, 0, kasa?.maghrib ?? 0)).toBe('maghrib');
  });

  test('isya carries past midnight until the day ends', () => {
    expect(prayerBandOf(calendarData, 0, hhmm('23:59'))).toBe('isya');
    expect(prayerBandOf(calendarData, 0, 1440 + 30)).toBe('isya');
  });

  test('maghrib moves with the mangsa', () => {
    const kapituDay = 60;
    expect(mangsaOf(calendarData, kapituDay).mangsa.id).toBe('kapitu');
    expect(prayerBandOf(calendarData, kapituDay, kasa?.maghrib ?? 0)).toBe('ashar');
    expect(prayerBandOf(calendarData, kapituDay, kapitu?.maghrib ?? 0)).toBe('maghrib');
  });
});
