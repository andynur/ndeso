import { describe, expect, test } from 'bun:test';
import { CalendarDataError, parseClockTime, validateCalendarData } from './calendar.ts';

const times = {
  subuh: '04:20',
  terbit: '05:40',
  dhuha: '06:00',
  dzuhur: '11:45',
  ashar: '15:05',
  maghrib: '17:40',
  isya: '18:55',
};

const valid = () => ({
  mangsa: {
    verified: false,
    realYearDays: 365,
    gameYearDays: 10,
    mangsa: [
      { id: 'kasa', realDays: 200, gameDays: 6, musim: 'kemarau' },
      { id: 'karo', realDays: 165, gameDays: 4, musim: 'hujan' },
    ],
  },
  clock: {
    ticksPerMinute: 7,
    dayStartMinute: 300,
    dayEndMinute: 1500,
    prayer: { kasa: { ...times }, karo: { ...times } },
  },
  hijri: {
    monthDays: [9, 10, 10, 9, 10, 10, 9, 10, 10, 9, 10, 10],
    cycleYears: 30,
    leapYears: [2, 5, 7],
    epoch: { year: 1448, month: 1, day: 1 },
  },
});

const problemsOf = (sources: ReturnType<typeof valid>): readonly string[] => {
  try {
    validateCalendarData(sources);
    return [];
  } catch (error) {
    if (error instanceof CalendarDataError) return error.problems;
    throw error;
  }
};

describe('parseClockTime', () => {
  test('reads HH:MM as minutes from midnight', () => {
    expect(parseClockTime('00:00')).toBe(0);
    expect(parseClockTime('17:36')).toBe(1056);
  });

  test('rejects anything else', () => {
    for (const bad of ['24:00', '12:60', '9:05', '0905', 905, undefined]) {
      expect(parseClockTime(bad)).toBeUndefined();
    }
  });
});

describe('validateCalendarData', () => {
  test('accepts valid data and converts prayer times to minutes', () => {
    const data = validateCalendarData(valid());
    expect(data.clock.prayer['kasa']?.maghrib).toBe(17 * 60 + 40);
  });

  test('rejects mangsa lengths that do not sum to the year', () => {
    const sources = valid();
    sources.mangsa.gameYearDays = 11;
    expect(problemsOf(sources)).toEqual(['mangsa: gameDays sum to 10, but gameYearDays is 11']);
  });

  test('rejects duplicate ids and unknown musim', () => {
    const sources = valid();
    sources.mangsa.mangsa[1] = { id: 'kasa', realDays: 165, gameDays: 4, musim: 'semi' };
    expect(problemsOf(sources)).toEqual([
      "mangsa[1]: duplicate id 'kasa'",
      "mangsa[1] (kasa): unknown musim 'semi'",
      'clock.prayer.karo: not a mangsa id',
    ]);
  });

  test('requires a prayer row per mangsa, with bands in order', () => {
    const sources = valid();
    sources.clock.prayer = {
      kasa: { ...times, ashar: '11:00' },
      karo: undefined as unknown as typeof times,
    };
    expect(problemsOf(sources)).toEqual([
      'clock.prayer.kasa.ashar: not after the band before',
      'clock.prayer.karo: missing',
    ]);
  });

  test('checks the Hijri table and epoch', () => {
    const sources = valid();
    sources.hijri.monthDays = [9, 10];
    sources.hijri.leapYears = [2, 2, 31];
    sources.hijri.epoch = { year: 1448, month: 13, day: 1 };
    expect(problemsOf(sources)).toEqual([
      'hijri.monthDays: expected 12 positive integers',
      'hijri.leapYears: expected unique integers in 1..30',
      'hijri.epoch: expected a valid { year, month, day }',
    ]);
  });

  test('lists every problem at once in the error message', () => {
    const sources = valid();
    sources.mangsa.gameYearDays = 11;
    sources.clock.ticksPerMinute = 0;
    expect(() => validateCalendarData(sources)).toThrow(/gameDays sum to 10[\s\S]*ticksPerMinute/);
  });
});
