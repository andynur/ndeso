/**
 * Calendar vocabularies that are definitions, not tuning (GDD §3, ADR-0009). The numbers that
 * are tuning — which musim each month belongs to, prayer-band times, the arrival date, the
 * Javanese year anchor — live in `packages/content/data/calendar/*.json5`.
 */

/** Coarse season label, derived from the Masehi month. Crops are tagged with these (GDD §3.1). */
export const MUSIM_IDS = ['kemarau', 'pancaroba', 'hujan'] as const;
export type MusimId = (typeof MUSIM_IDS)[number];

/** The 5-day market cycle, in order. Legi is 0 (ADR-0009). */
export const PASARAN_IDS = ['legi', 'pahing', 'pon', 'wage', 'kliwon'] as const;
export type PasaranId = (typeof PASARAN_IDS)[number];

/** The 7-day week, Senin first. Ids match the `ui:weekday.*` locale keys. */
export const WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayId = (typeof WEEKDAY_IDS)[number];

/** Masehi months, January first. Ids match the `calendar:masehi.*` locale keys. */
export const MASEHI_MONTH_IDS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;
export type MasehiMonthId = (typeof MASEHI_MONTH_IDS)[number];

/** Hijri months, Muharram first. Ids match the `calendar:hijri.*` locale keys. */
export const HIJRI_MONTH_IDS = [
  'muharram',
  'safar',
  'rabiul_awal',
  'rabiul_akhir',
  'jumadil_awal',
  'jumadil_akhir',
  'rajab',
  'syaban',
  'ramadan',
  'syawal',
  'zulkaidah',
  'zulhijah',
] as const;
export type HijriMonthId = (typeof HIJRI_MONTH_IDS)[number];

/**
 * Javanese (Sultan Agungan) months: the Hijri months under their Javanese names, Sura first.
 * Ids match the `calendar:jawa.*` locale keys.
 */
export const JAWA_MONTH_IDS = [
  'sura',
  'sapar',
  'mulud',
  'bakda_mulud',
  'jumadil_awal',
  'jumadil_akhir',
  'rejeb',
  'ruwah',
  'pasa',
  'sawal',
  'sela',
  'besar',
] as const;
export type JawaMonthId = (typeof JAWA_MONTH_IDS)[number];

/** The eight year names of a windu, Alip first. Ids match the `calendar:jawa_year.*` keys. */
export const JAWA_YEAR_IDS = [
  'alip',
  'ehe',
  'jimawal',
  'je',
  'dal',
  'be',
  'wawu',
  'jimakir',
] as const;
export type JawaYearId = (typeof JAWA_YEAR_IDS)[number];

/**
 * The bands the clock reads in (GDD §3.2), in the order they start through a day. `dhuha`
 * begins at sunrise. Display only — a band never gates or scores anything (CULTURE_GUIDE §3).
 */
export const PRAYER_BAND_IDS = ['subuh', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const;
export type PrayerBandId = (typeof PRAYER_BAND_IDS)[number];

/** Hijri months are numbered 1–12; these are the ones festivals hang off (GDD §10). */
export const HIJRI_MONTH = { muharram: 1, ramadan: 9, syawal: 10, dzulhijah: 12 } as const;

/**
 * The calendar's content schema: the shape the sim's clock projects from, and a narrow,
 * hand-written validator for the three `data/calendar/*.json5` files. It lives in `shared`
 * because every content schema does (M2-01); the rest of `check:content` stays M2-01. This
 * validates only what the clock needs to be correct — the task that consumes a data file is
 * the task that validates it.
 */

export interface MonthDef {
  readonly id: MasehiMonthId;
  readonly musim: MusimId;
  /** Start of each band in `PRAYER_BAND_IDS` order, as minutes after midnight. */
  readonly prayerStarts: readonly number[];
}

/** A Masehi (Gregorian) date; `month` is 1–12. */
export interface MasehiDateDef {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface JawaDef {
  /** Javanese year = Hijri year + this (1 Sura 1555 = 1 Muharram 1043). */
  readonly hijriYearOffset: number;
  /** A Javanese year that is Alip, the first of a windu. */
  readonly alipYear: number;
}

export interface ClockDef {
  readonly ticksPerMinute: number;
  /** Minutes after the midnight that opens the game day; `dayEndMinute` may pass 1440. */
  readonly dayStartMinute: number;
  readonly dayEndMinute: number;
  /** Day 0: the arrival. Must be a date the scaled calendar shows (ADR-0009). */
  readonly arrival: MasehiDateDef;
  readonly jawa: JawaDef;
}

export interface CalendarData {
  readonly gameYearDays: number;
  /** Game days per Masehi month: `gameYearDays / 12`. */
  readonly gameMonthDays: number;
  readonly months: readonly MonthDef[];
  readonly clock: ClockDef;
}

/** The three files as parsed JSON5, before any checking. */
export interface RawCalendarFiles {
  readonly months: unknown;
  readonly clock: unknown;
  readonly prayerTimes: unknown;
}

export type CalendarResult =
  | { readonly ok: true; readonly data: CalendarData }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Every field name the three files use, so a parsed object can be read with dot access. */
type Field =
  | 'gameYearDays'
  | 'months'
  | 'id'
  | 'musim'
  | 'bands'
  | 'byMonth'
  | 'month'
  | 'starts'
  | 'ticksPerMinute'
  | 'dayStartMinute'
  | 'dayEndMinute'
  | 'arrival'
  | 'jawa'
  | 'hijriYearOffset'
  | 'alipYear'
  | 'year'
  | 'day';
type Obj = Partial<Readonly<Record<Field, unknown>>>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/** `'04:35'` → 275. Returns undefined for anything that is not a valid 24-hour time. */
export function parseClockTime(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Days in a Masehi month; `month` is 1–12. */
export function masehiMonthLength(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : (MONTH_DAYS[month - 1] ?? 0);
}

/**
 * The date shown on the `k`-th game day (0-based) of a Masehi month of `length` real days
 * compressed into `monthDays` game days (ADR-0009): the 1st always, then every ~3 days.
 */
export function scaledDate(k: number, length: number, monthDays: number): number {
  return 1 + Math.floor((k * length) / monthDays);
}

export function validateCalendar(files: RawCalendarFiles): CalendarResult {
  const errors: string[] = [];
  const err = (file: string, message: string) => errors.push(`${file}: ${message}`);

  // months.json5
  const raw = files.months;
  const musimOf = new Map<MasehiMonthId, MusimId>();
  let gameYearDays = 0;
  if (!isObj(raw)) {
    err('months.json5', 'is not an object');
  } else {
    if (!isPositiveInt(raw.gameYearDays) || raw.gameYearDays % 12 !== 0) {
      err('months.json5', 'gameYearDays must be a positive multiple of 12 (equal months)');
    } else {
      gameYearDays = raw.gameYearDays;
    }
    if (gameYearDays % 5 !== 0) {
      err(
        'months.json5',
        `gameYearDays ${gameYearDays} must be divisible by 5 so pasaran is stable against the year`,
      );
    }
    if (
      !Array.isArray(raw.months) ||
      raw.months.length !== MASEHI_MONTH_IDS.length ||
      raw.months.some((row, index) => !isObj(row) || row.id !== MASEHI_MONTH_IDS[index])
    ) {
      err('months.json5', `months must be the 12 rows [${MASEHI_MONTH_IDS.join(', ')}] in order`);
    } else {
      for (const row of raw.months as Obj[]) {
        const id = row.id as MasehiMonthId;
        if (!MUSIM_IDS.includes(row.musim as MusimId)) {
          err(
            'months.json5',
            `${id}.musim '${String(row.musim)}' is not one of ${MUSIM_IDS.join(', ')}`,
          );
        } else {
          musimOf.set(id, row.musim as MusimId);
        }
      }
    }
  }

  // prayer-times.json5
  const prayerStarts = new Map<string, number[]>();
  const prayer = files.prayerTimes;
  if (!isObj(prayer)) {
    err('prayer-times.json5', 'is not an object');
  } else {
    const bands = prayer.bands;
    if (
      !Array.isArray(bands) ||
      bands.length !== PRAYER_BAND_IDS.length ||
      bands.some((band, index) => band !== PRAYER_BAND_IDS[index])
    ) {
      err('prayer-times.json5', `bands must be exactly [${PRAYER_BAND_IDS.join(', ')}]`);
    }
    if (!Array.isArray(prayer.byMonth)) {
      err('prayer-times.json5', 'byMonth must be an array');
    } else {
      for (const [index, row] of prayer.byMonth.entries()) {
        const at = `byMonth[${index}]`;
        if (!isObj(row) || typeof row.month !== 'string' || !Array.isArray(row.starts)) {
          err('prayer-times.json5', `${at} must be { month, starts[] }`);
          continue;
        }
        if (prayerStarts.has(row.month)) {
          err('prayer-times.json5', `${at}: month '${row.month}' appears twice`);
          continue;
        }
        const minutes = row.starts.map(parseClockTime);
        if (minutes.length !== PRAYER_BAND_IDS.length || minutes.some((m) => m === undefined)) {
          err(
            'prayer-times.json5',
            `${row.month}: starts must be ${PRAYER_BAND_IDS.length} 'HH:MM' times`,
          );
          continue;
        }
        const starts = minutes as number[];
        if (starts.some((m, i) => i > 0 && m <= (starts[i - 1] as number))) {
          err('prayer-times.json5', `${row.month}: starts must be strictly increasing`);
          continue;
        }
        prayerStarts.set(row.month, starts);
      }
    }
    for (const id of MASEHI_MONTH_IDS) {
      if (!prayerStarts.has(id)) err('prayer-times.json5', `no row for month '${id}'`);
    }
    for (const id of prayerStarts.keys()) {
      if (!MASEHI_MONTH_IDS.includes(id as MasehiMonthId)) {
        err('prayer-times.json5', `row for unknown month '${id}'`);
      }
    }
  }

  // clock.json5
  const clock = files.clock;
  if (!isObj(clock)) {
    err('clock.json5', 'is not an object');
  } else {
    const { ticksPerMinute, dayStartMinute, dayEndMinute, arrival, jawa } = clock;
    if (!isPositiveInt(ticksPerMinute))
      err('clock.json5', 'ticksPerMinute must be a positive integer');
    if (!isPositiveInt(dayStartMinute) || dayStartMinute >= 1440) {
      err('clock.json5', 'dayStartMinute must be a minute of the day (1–1439)');
    }
    if (
      !isPositiveInt(dayEndMinute) ||
      !isPositiveInt(dayStartMinute) ||
      dayEndMinute <= dayStartMinute ||
      dayEndMinute - dayStartMinute > 1440
    ) {
      err('clock.json5', 'dayEndMinute must be after dayStartMinute and at most 24 h later');
    }
    if (
      !isObj(arrival) ||
      !isPositiveInt(arrival.year) ||
      !isPositiveInt(arrival.month) ||
      arrival.month > 12 ||
      !isPositiveInt(arrival.day) ||
      arrival.day > masehiMonthLength(arrival.year, arrival.month)
    ) {
      err('clock.json5', 'arrival must be a valid Masehi { year, month, day }');
    } else if (gameYearDays > 0) {
      const monthDays = gameYearDays / 12;
      const length = masehiMonthLength(arrival.year, arrival.month);
      const shown = Array.from({ length: monthDays }, (_, k) => scaledDate(k, length, monthDays));
      if (!shown.includes(arrival.day)) {
        err(
          'clock.json5',
          `arrival day ${arrival.day} is skipped by the scaled calendar; pick one of ${shown.join(', ')}`,
        );
      }
    }
    if (!isObj(jawa) || !isPositiveInt(jawa.hijriYearOffset) || !isPositiveInt(jawa.alipYear)) {
      err('clock.json5', 'jawa must be { hijriYearOffset, alipYear } as positive integers');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  const c = clock as Obj;
  return {
    ok: true,
    data: {
      gameYearDays,
      gameMonthDays: gameYearDays / 12,
      months: MASEHI_MONTH_IDS.map((id) => ({
        id,
        musim: musimOf.get(id) as MusimId,
        prayerStarts: prayerStarts.get(id) as number[],
      })),
      clock: {
        ticksPerMinute: c.ticksPerMinute as number,
        dayStartMinute: c.dayStartMinute as number,
        dayEndMinute: c.dayEndMinute as number,
        arrival: c.arrival as MasehiDateDef,
        jawa: c.jawa as JawaDef,
      },
    },
  };
}
