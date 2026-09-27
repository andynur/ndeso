import {
  type CalendarData,
  type HijriDateDef,
  type MusimId,
  PASARAN_IDS,
  type PasaranId,
  PRAYER_BAND_IDS,
  type PrayerBandId,
  WEEKDAY_IDS,
  type WeekdayId,
} from '@bale/shared';

/**
 * The three calendars as pure projections of one integer, `day` (ADR-0007). Day 0 is the
 * arrival and 1 Kasa. Nothing here is stored in state: saves keep `day`, and everything else
 * is recomputed. All arithmetic is on integers.
 */

export interface MangsaDate {
  /** 0-based position in the year. */
  readonly index: number;
  readonly id: string;
  /** 1-based day within the mangsa — the `3` in `hari 3/8`. */
  readonly day: number;
  readonly length: number;
  readonly musim: MusimId;
}

export interface HijriDate {
  readonly year: number;
  readonly month: number;
  /** 1-based game day within the month; months are compressed like the solar year. */
  readonly day: number;
  /** Game days in this month (9 or 10 at the 120/365 scale). */
  readonly monthLength: number;
}

export interface CalendarDate {
  readonly day: number;
  /** 1-based. */
  readonly year: number;
  /** 0-based. */
  readonly dayOfYear: number;
  readonly mangsa: MangsaDate;
  readonly pasaran: PasaranId;
  readonly weekday: WeekdayId;
  readonly hijri: HijriDate;
}

const floorDiv = (a: number, b: number): number => Math.floor(a / b);
const ceilDiv = (a: number, b: number): number => -Math.floor(-a / b);

export function yearOf(day: number, cal: CalendarData): number {
  return floorDiv(day, cal.gameYearDays) + 1;
}

export function dayOfYearOf(day: number, cal: CalendarData): number {
  return day - (yearOf(day, cal) - 1) * cal.gameYearDays;
}

export function mangsaOf(day: number, cal: CalendarData): MangsaDate {
  let rest = dayOfYearOf(day, cal);
  for (const [index, entry] of cal.mangsa.entries()) {
    if (rest < entry.gameDays) {
      return { index, id: entry.id, day: rest + 1, length: entry.gameDays, musim: entry.musim };
    }
    rest -= entry.gameDays;
  }
  // Unreachable for validated data: gameDays sum to gameYearDays.
  throw new Error(`mangsa table does not cover day ${day}`);
}

export function pasaranOf(day: number): PasaranId {
  return PASARAN_IDS[((day % 5) + 5) % 5] as PasaranId;
}

export function weekdayOf(day: number, cal: CalendarData): WeekdayId {
  const offset = WEEKDAY_IDS.indexOf(cal.clock.weekdayOfDay0);
  return WEEKDAY_IDS[(((day + offset) % 7) + 7) % 7] as WeekdayId;
}

// ── Hijri ────────────────────────────────────────────────────────────────────────────────
// The standard tabular calendar (30-year cycle, leap years 2, 5, 7, 10, 13, 16, 18, 21, 24,
// 26, 29), counted in "real" days since 1 Muharram 1 AH. A game day stands for
// realYearDays / gameYearDays real days, so game day g sits on real day
// R(g) = R0 + ⌊g · realYearDays / gameYearDays⌋, where R0 is the real day of day 0.
// Every month therefore lasts 9–10 game days, Ramadan included — GDD §10 still says
// "Ramadan (30 days)"; that conflict is an open decision in docs/STATUS.md, not settled here.

/** Real days from 1 Muharram 1 AH to the given date (0 for that first day). */
export function hijriToReal(date: HijriDateDef): number {
  const { year, month, day } = date;
  return (
    (year - 1) * 354 +
    floorDiv(3 + 11 * year, 30) +
    floorDiv(59 * (month - 1) + 1, 2) + // ⌈29.5 · (month − 1)⌉
    day -
    1
  );
}

/** Inverse of `hijriToReal`, as a tabular date with real month days. */
export function realToHijri(real: number): HijriDateDef {
  let year = floorDiv(30 * real + 10646, 10631);
  while (hijriToReal({ year: year + 1, month: 1, day: 1 }) <= real) year++;
  while (hijriToReal({ year, month: 1, day: 1 }) > real) year--;
  let month = 12;
  while (hijriToReal({ year, month, day: 1 }) > real) month--;
  return { year, month, day: real - hijriToReal({ year, month, day: 1 }) + 1 };
}

function realOf(day: number, cal: CalendarData): number {
  return hijriToReal(cal.clock.hijriOfDay0) + floorDiv(day * cal.realYearDays, cal.gameYearDays);
}

/**
 * The first game day on or after the given tabular date: where `1 Syawal` or `10 Dzulhijah`
 * lands. May be negative for dates before the arrival.
 */
export function hijriToDay(date: HijriDateDef, cal: CalendarData): number {
  const offset = hijriToReal(date) - hijriToReal(cal.clock.hijriOfDay0);
  return ceilDiv(offset * cal.gameYearDays, cal.realYearDays);
}

export function hijriOf(day: number, cal: CalendarData): HijriDate {
  const { year, month } = realToHijri(realOf(day, cal));
  const start = hijriToDay({ year, month, day: 1 }, cal);
  const next =
    month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
  return { year, month, day: day - start + 1, monthLength: hijriToDay(next, cal) - start };
}

// ── Clock ────────────────────────────────────────────────────────────────────────────────

/**
 * The band `minute` falls in, from the fixed per-mangsa table (GDD §3.2). Minutes past
 * midnight (≥ 1440) wrap; before the first band starts it is still the previous night's
 * last band. Display only — never gates anything (CULTURE_GUIDE §3).
 */
export function prayerBandOf(minute: number, mangsa: MangsaDate, cal: CalendarData): PrayerBandId {
  const starts = cal.mangsa[mangsa.index]?.prayerStarts ?? [];
  const time = ((minute % 1440) + 1440) % 1440;
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
  return {
    day,
    year: yearOf(day, cal),
    dayOfYear: dayOfYearOf(day, cal),
    mangsa: mangsaOf(day, cal),
    pasaran: pasaranOf(day),
    weekday: weekdayOf(day, cal),
    hijri: hijriOf(day, cal),
  };
}
