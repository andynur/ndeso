import {
  type CalendarData,
  HIJRI_MONTH_IDS,
  type HijriMonthId,
  JAWA_YEAR_IDS,
  type JawaYearId,
  MASEHI_MONTH_IDS,
  type MasehiDateDef,
  type MasehiMonthId,
  type MusimId,
  masehiMonthLength,
  PASARAN_IDS,
  type PasaranId,
  PRAYER_BAND_IDS,
  type PrayerBandId,
  scaledDate,
  WEEKDAY_IDS,
  type WeekdayId,
} from '@bale/shared';

/**
 * The calendars as pure projections of one integer, `day` (ADR-0009). Day 0 is the arrival.
 * Nothing here is stored in state: saves keep `day`, and everything else is recomputed. All
 * arithmetic is on integers.
 *
 * - **Masehi** leads. A game year is 120 days, so each month is 10 game days and the date
 *   shown is scaled from the real month: 1, 4, 7 … 28 for a 31-day month.
 * - **Hijri** and **Jawa** are read off the real date that game day shows (tabular Hijri;
 *   Jawa is the same date under Javanese names, year + 512), so they agree with a printed
 *   calendar for that date, within the ±1 day of the tabular method.
 * - **Weekday** and **pasaran** are real for day 0 and then advance one per game day, so
 *   the week and the pasaran cycle stay whole; they do not follow the skipped dates.
 */

export interface MasehiDate {
  readonly year: number;
  /** 1–12. */
  readonly month: number;
  readonly monthId: MasehiMonthId;
  /** The date shown, 1-based, from the real month. */
  readonly date: number;
  /** 0-based game day within the month — the `3` of 10. */
  readonly monthDay: number;
}

export interface HijriDate {
  readonly year: number;
  /** 1–12. */
  readonly month: number;
  /** Real day of the month in the tabular calendar. */
  readonly day: number;
}

export interface JawaDate {
  readonly year: number;
  /** 1–12, Sura first. */
  readonly month: number;
  readonly day: number;
  readonly yearName: JawaYearId;
}

export interface CalendarDate {
  readonly day: number;
  readonly masehi: MasehiDate;
  readonly musim: MusimId;
  readonly weekday: WeekdayId;
  readonly pasaran: PasaranId;
  readonly hijri: HijriDate;
  readonly jawa: JawaDate;
}

const floorDiv = (a: number, b: number): number => Math.floor(a / b);
const mod = (a: number, b: number): number => ((a % b) + b) % b;

// ── Julian day numbers ───────────────────────────────────────────────────────────────────
// Every calendar meets on the JDN, an integer day count. JDN mod 7 is 0 on a Monday and
// JDN mod 5 is 0 on Legi (17 Agustus 1945, JDN 2431685, was Jumat Legi).

/** Masehi (proleptic Gregorian) date → Julian day number. */
export function masehiToJdn(date: MasehiDateDef): number {
  const a = floorDiv(14 - date.month, 12);
  const y = date.year + 4800 - a;
  const m = date.month + 12 * a - 3;
  return (
    date.day +
    floorDiv(153 * m + 2, 5) +
    365 * y +
    floorDiv(y, 4) -
    floorDiv(y, 100) +
    floorDiv(y, 400) -
    32045
  );
}

/** The tabular Hijri epoch: 1 Muharram 1 AH (civil, Friday 16 July 622 Julian). */
const HIJRI_EPOCH_JDN = 1948440;

// The standard tabular calendar (30-year cycle, leap years 2, 5, 7, 10, 13, 16, 18, 21, 24,
// 26, 29). No astronomical hisab and no rukyat: a date can differ by ±1 day from the one
// Indonesia announces, which is inside the real-world spread between organisations.

/** Real days from 1 Muharram 1 AH to the given date (0 for that first day). */
export function hijriToReal(date: HijriDate): number {
  const { year, month, day } = date;
  return (
    (year - 1) * 354 +
    floorDiv(3 + 11 * year, 30) +
    floorDiv(59 * (month - 1) + 1, 2) + // ⌈29.5 · (month − 1)⌉
    day -
    1
  );
}

/** Inverse of `hijriToReal`. */
export function realToHijri(real: number): HijriDate {
  let year = floorDiv(30 * real + 10646, 10631);
  while (hijriToReal({ year: year + 1, month: 1, day: 1 }) <= real) year++;
  while (hijriToReal({ year, month: 1, day: 1 }) > real) year--;
  let month = 12;
  while (hijriToReal({ year, month, day: 1 }) > real) month--;
  return { year, month, day: real - hijriToReal({ year, month, day: 1 }) + 1 };
}

export const jdnToHijri = (jdn: number): HijriDate => realToHijri(jdn - HIJRI_EPOCH_JDN);
export const hijriToJdn = (date: HijriDate): number => hijriToReal(date) + HIJRI_EPOCH_JDN;

// ── Masehi, scaled ───────────────────────────────────────────────────────────────────────

/** Game days since 1 January of the arrival year, for `day`. */
function sinceArrivalYear(day: number, cal: CalendarData): number {
  const { arrival } = cal.clock;
  const monthDays = cal.gameMonthDays;
  const length = masehiMonthLength(arrival.year, arrival.month);
  // Validated data guarantees the arrival is a shown date, so this finds its game day.
  let k = 0;
  while (k < monthDays - 1 && scaledDate(k, length, monthDays) < arrival.day) k++;
  return (arrival.month - 1) * monthDays + k + day;
}

export function masehiOf(day: number, cal: CalendarData): MasehiDate {
  const since = sinceArrivalYear(day, cal);
  const year = cal.clock.arrival.year + floorDiv(since, cal.gameYearDays);
  const dayOfYear = mod(since, cal.gameYearDays);
  const month = floorDiv(dayOfYear, cal.gameMonthDays) + 1;
  const monthDay = dayOfYear % cal.gameMonthDays;
  return {
    year,
    month,
    monthId: MASEHI_MONTH_IDS[month - 1] as MasehiMonthId,
    date: scaledDate(monthDay, masehiMonthLength(year, month), cal.gameMonthDays),
    monthDay,
  };
}

/** The Julian day number of the real date `day` shows. */
export function jdnOf(day: number, cal: CalendarData): number {
  const { year, month, date } = masehiOf(day, cal);
  return masehiToJdn({ year, month, day: date });
}

/**
 * The first game day that shows a real date on or after `jdn`: where `1 Syawal` or
 * `17 Agustus` lands when the scaled calendar skips the date itself. May be negative.
 */
export function dayOnOrAfterJdn(jdn: number, cal: CalendarData): number {
  const arrivalJdn = jdnOf(0, cal);
  // ~3 real days per game day: start from an estimate that is never too late, then walk.
  let day = floorDiv((jdn - arrivalJdn) * cal.gameYearDays, 366) - 2;
  while (jdnOf(day, cal) >= jdn) day -= cal.gameMonthDays;
  while (jdnOf(day, cal) < jdn) day++;
  return day;
}

export function hijriToDay(date: HijriDate, cal: CalendarData): number {
  return dayOnOrAfterJdn(hijriToJdn(date), cal);
}

export function musimOf(day: number, cal: CalendarData): MusimId {
  return cal.months[masehiOf(day, cal).month - 1]?.musim ?? 'kemarau';
}

export function hijriOf(day: number, cal: CalendarData): HijriDate {
  return jdnToHijri(jdnOf(day, cal));
}

export function jawaOf(day: number, cal: CalendarData): JawaDate {
  const { year, month, day: date } = hijriOf(day, cal);
  const { hijriYearOffset, alipYear } = cal.clock.jawa;
  const jawaYear = year + hijriYearOffset;
  return {
    year: jawaYear,
    month,
    day: date,
    yearName: JAWA_YEAR_IDS[mod(jawaYear - alipYear, 8)] as JawaYearId,
  };
}

export function weekdayOf(day: number, cal: CalendarData): WeekdayId {
  return WEEKDAY_IDS[mod(jdnOf(0, cal) + day, 7)] as WeekdayId;
}

export function pasaranOf(day: number, cal: CalendarData): PasaranId {
  return PASARAN_IDS[mod(jdnOf(0, cal) + day, 5)] as PasaranId;
}

/** The locale id of a Hijri month number. */
export const hijriMonthId = (month: number): HijriMonthId =>
  HIJRI_MONTH_IDS[month - 1] ?? 'muharram';

// ── Clock ────────────────────────────────────────────────────────────────────────────────

/**
 * The band `minute` falls in, from the fixed per-month table (GDD §3.2); `month` is 1–12.
 * Minutes past midnight (≥ 1440) wrap; before the first band starts it is still the
 * previous night's last band. Display only — never gates anything (CULTURE_GUIDE §3).
 */
export function prayerBandOf(minute: number, month: number, cal: CalendarData): PrayerBandId {
  const starts = cal.months[month - 1]?.prayerStarts ?? [];
  const time = mod(minute, 1440);
  let band = PRAYER_BAND_IDS.length - 1;
  for (const [index, start] of starts.entries()) {
    if (time >= start) band = index;
  }
  return PRAYER_BAND_IDS[band] as PrayerBandId;
}

/** Hour of the wall clock, 0–23, for a minute that may run past midnight. */
export function hourOf(minute: number): number {
  return floorDiv(minute, 60) % 24;
}

export function projectDay(day: number, cal: CalendarData): CalendarDate {
  const masehi = masehiOf(day, cal);
  return {
    day,
    masehi,
    musim: musimOf(day, cal),
    weekday: weekdayOf(day, cal),
    pasaran: pasaranOf(day, cal),
    hijri: hijriOf(day, cal),
    jawa: jawaOf(day, cal),
  };
}
