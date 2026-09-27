import {
  type CalendarData,
  type HijriData,
  type HijriDate,
  type MangsaData,
  type MusimId,
  PASARAN_IDS,
  type PasaranId,
  PRAYER_BANDS,
  type PrayerBand,
  WEEKDAY_IDS,
  type WeekdayId,
} from '@bale/shared';

/**
 * The three calendars as pure projections of the absolute `day` (ADR-0007). Nothing here is
 * stored: a save keeps `day` only, so fixing a data file can never make a save disagree
 * with itself. Day 0 is the arrival: 1 Kasa, year 1, a Senin Legi.
 */

export interface MangsaDate {
  /** 1-based game year. */
  readonly year: number;
  /** 0-based position in the mangsa list (0 = Kasa). */
  readonly index: number;
  readonly mangsa: MangsaData;
  /** 1-based day within the mangsa. */
  readonly dayOfMangsa: number;
}

export interface CalendarDate extends MangsaDate {
  readonly day: number;
  readonly musim: MusimId;
  readonly pasaran: PasaranId;
  readonly weekday: WeekdayId;
  readonly hijri: HijriDate;
}

const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

export function mangsaOf(calendar: CalendarData, day: number): MangsaDate {
  const { gameYearDays, mangsa } = calendar.mangsa;
  let rest = mod(day, gameYearDays);
  for (let index = 0; index < mangsa.length; index++) {
    const entry = mangsa[index] as MangsaData;
    if (rest < entry.gameDays) {
      return {
        year: Math.floor(day / gameYearDays) + 1,
        index,
        mangsa: entry,
        dayOfMangsa: rest + 1,
      };
    }
    rest -= entry.gameDays;
  }
  // Unreachable once validateCalendarData has checked that gameDays sum to gameYearDays.
  throw new Error(`day ${day} falls outside the mangsa table`);
}

export const pasaranOf = (day: number): PasaranId =>
  PASARAN_IDS[mod(day, PASARAN_IDS.length)] as PasaranId;

export const weekdayOf = (day: number): WeekdayId =>
  WEEKDAY_IDS[mod(day, WEEKDAY_IDS.length)] as WeekdayId;

const commonYearDays = (hijri: HijriData) => hijri.monthDays.reduce((sum, days) => sum + days, 0);

const isLeapYear = (hijri: HijriData, year: number) =>
  hijri.leapYears.includes(mod(year - 1, hijri.cycleYears) + 1);

const yearDays = (hijri: HijriData, year: number) =>
  commonYearDays(hijri) + (isLeapYear(hijri, year) ? 1 : 0);

/** Days from 1/1/1 to the first day of `year`, by whole cycles plus the leftover years. */
function daysBeforeYear(hijri: HijriData, year: number): number {
  const elapsed = year - 1;
  const cycles = Math.floor(elapsed / hijri.cycleYears);
  const leftover = elapsed - cycles * hijri.cycleYears;
  const leapsInLeftover = hijri.leapYears.filter((position) => position <= leftover).length;
  return elapsed * commonYearDays(hijri) + cycles * hijri.leapYears.length + leapsInLeftover;
}

function monthLength(hijri: HijriData, year: number, month: number): number {
  const base = hijri.monthDays[month - 1] as number;
  return month === hijri.monthDays.length && isLeapYear(hijri, year) ? base + 1 : base;
}

function daysBeforeDate(hijri: HijriData, date: HijriDate): number {
  let days = daysBeforeYear(hijri, date.year);
  for (let month = 1; month < date.month; month++) days += monthLength(hijri, date.year, month);
  return days + date.day - 1;
}

export function hijriOf(calendar: CalendarData, day: number): HijriDate {
  const { hijri } = calendar;
  const target = daysBeforeDate(hijri, hijri.epoch) + day;
  const meanYear = commonYearDays(hijri) + hijri.leapYears.length / hijri.cycleYears;
  // The mean-year estimate is within one year either way; step to the exact one.
  let year = Math.floor(target / meanYear) + 1;
  while (daysBeforeYear(hijri, year) > target) year--;
  while (daysBeforeYear(hijri, year) + yearDays(hijri, year) <= target) year++;
  let rest = target - daysBeforeYear(hijri, year);
  let month = 1;
  while (rest >= monthLength(hijri, year, month)) {
    rest -= monthLength(hijri, year, month);
    month++;
  }
  return { year, month, day: rest + 1 };
}

export function calendarDateOf(calendar: CalendarData, day: number): CalendarDate {
  const mangsa = mangsaOf(calendar, day);
  return {
    ...mangsa,
    day,
    musim: mangsa.mangsa.musim,
    pasaran: pasaranOf(day),
    weekday: weekdayOf(day),
    hijri: hijriOf(calendar, day),
  };
}

/**
 * The prayer-time band `minute` falls in, from the fixed per-mangsa table (GDD §3.2). Before
 * the first band of the day (the small hours) it is still the previous night's `isya`.
 * A time display only: nothing may gate or score on it (CULTURE_GUIDE §3).
 */
export function prayerBandOf(calendar: CalendarData, day: number, minute: number): PrayerBand {
  const table = calendar.clock.prayer[mangsaOf(calendar, day).mangsa.id];
  if (table === undefined) throw new Error(`no prayer table for day ${day}`);
  const timeOfDay = mod(minute, 1440);
  let band: PrayerBand = 'isya';
  for (const candidate of PRAYER_BANDS) {
    if (table[candidate] <= timeOfDay) band = candidate;
  }
  return band;
}
