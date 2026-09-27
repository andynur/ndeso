/**
 * Calendar vocabularies that are definitions, not tuning (GDD §3, ADR-0007). The numbers that
 * are tuning — mangsa lengths, prayer-band times, the day-0 anchors — live in
 * `packages/content/data/calendar/*.json5`.
 */

/** Coarse season label over groups of mangsa. Crops are tagged with these (GDD §3.1). */
export const MUSIM_IDS = ['kemarau', 'pancaroba', 'hujan'] as const;
export type MusimId = (typeof MUSIM_IDS)[number];

/** The 5-day market cycle. Day 0 is Legi: pasaran is `day % 5` (ADR-0007). */
export const PASARAN_IDS = ['legi', 'pahing', 'pon', 'wage', 'kliwon'] as const;
export type PasaranId = (typeof PASARAN_IDS)[number];

/** The 7-day week, Senin first. Ids match the `ui:weekday.*` locale keys. */
export const WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayId = (typeof WEEKDAY_IDS)[number];

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

export interface MangsaDef {
  readonly id: string;
  readonly realDays: number;
  readonly gameDays: number;
  readonly musim: MusimId;
  /** Start of each band in `PRAYER_BAND_IDS` order, as minutes after midnight. */
  readonly prayerStarts: readonly number[];
}

export interface HijriDateDef {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface ClockDef {
  readonly ticksPerMinute: number;
  /** Minutes after the midnight that opens the game day; `dayEndMinute` may pass 1440. */
  readonly dayStartMinute: number;
  readonly dayEndMinute: number;
  readonly weekdayOfDay0: WeekdayId;
  /** The tabular Hijri date day 0 falls on. */
  readonly hijriOfDay0: HijriDateDef;
}

export interface CalendarData {
  readonly realYearDays: number;
  readonly gameYearDays: number;
  readonly mangsa: readonly MangsaDef[];
  readonly clock: ClockDef;
}

/** The three files as parsed JSON5, before any checking. */
export interface RawCalendarFiles {
  readonly mangsa: unknown;
  readonly clock: unknown;
  readonly prayerTimes: unknown;
}

export type CalendarResult =
  | { readonly ok: true; readonly data: CalendarData }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Every field name the three files use, so a parsed object can be read with dot access. */
type Field =
  | 'realYearDays'
  | 'gameYearDays'
  | 'mangsa'
  | 'id'
  | 'realDays'
  | 'gameDays'
  | 'musim'
  | 'bands'
  | 'byMangsa'
  | 'starts'
  | 'ticksPerMinute'
  | 'dayStartMinute'
  | 'dayEndMinute'
  | 'weekdayOfDay0'
  | 'hijriOfDay0'
  | 'year'
  | 'month'
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

/** Days in a month of the tabular Hijri calendar: odd months 30, even 29, a leap Dzulhijah 30. */
function hijriMonthLength(year: number, month: number): number {
  if (month % 2 === 1) return 30;
  const leap = (11 * year + 14) % 30 < 11;
  return month === 12 && leap ? 30 : 29;
}

export function validateCalendar(files: RawCalendarFiles): CalendarResult {
  const errors: string[] = [];
  const err = (file: string, message: string) => errors.push(`${file}: ${message}`);

  // mangsa.json5
  const raw = files.mangsa;
  const mangsa: Omit<MangsaDef, 'prayerStarts'>[] = [];
  let realYearDays = 0;
  let gameYearDays = 0;
  if (!isObj(raw)) {
    err('mangsa.json5', 'is not an object');
  } else {
    if (!isPositiveInt(raw.realYearDays))
      err('mangsa.json5', 'realYearDays must be a positive integer');
    else realYearDays = raw.realYearDays;
    if (!isPositiveInt(raw.gameYearDays))
      err('mangsa.json5', 'gameYearDays must be a positive integer');
    else gameYearDays = raw.gameYearDays;
    if (gameYearDays % 5 !== 0) {
      err(
        'mangsa.json5',
        `gameYearDays ${gameYearDays} must be divisible by 5 so pasaran is stable against the year (ADR-0007)`,
      );
    }
    if (!Array.isArray(raw.mangsa) || raw.mangsa.length === 0) {
      err('mangsa.json5', 'mangsa must be a non-empty array');
    } else {
      const seen = new Set<string>();
      for (const [index, entry] of raw.mangsa.entries()) {
        const at = `mangsa[${index}]`;
        if (!isObj(entry)) {
          err('mangsa.json5', `${at} is not an object`);
          continue;
        }
        const { id, realDays, gameDays, musim } = entry;
        if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) {
          err('mangsa.json5', `${at}.id must be a snake_case id`);
          continue;
        }
        if (seen.has(id)) err('mangsa.json5', `${at}.id '${id}' is a duplicate`);
        seen.add(id);
        if (!isPositiveInt(realDays))
          err('mangsa.json5', `${id}.realDays must be a positive integer`);
        if (!isPositiveInt(gameDays))
          err('mangsa.json5', `${id}.gameDays must be a positive integer`);
        if (!MUSIM_IDS.includes(musim as MusimId)) {
          err(
            'mangsa.json5',
            `${id}.musim '${String(musim)}' is not one of ${MUSIM_IDS.join(', ')}`,
          );
        }
        if (isPositiveInt(realDays) && isPositiveInt(gameDays)) {
          mangsa.push({ id, realDays, gameDays, musim: musim as MusimId });
        }
      }
      const sum = mangsa.reduce((total, entry) => total + entry.gameDays, 0);
      if (gameYearDays > 0 && sum !== gameYearDays) {
        err('mangsa.json5', `gameDays sum to ${sum}, but gameYearDays is ${gameYearDays}`);
      }
      const realSum = mangsa.reduce((total, entry) => total + entry.realDays, 0);
      if (realYearDays > 0 && realSum !== realYearDays) {
        err('mangsa.json5', `realDays sum to ${realSum}, but realYearDays is ${realYearDays}`);
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
    if (!Array.isArray(prayer.byMangsa)) {
      err('prayer-times.json5', 'byMangsa must be an array');
    } else {
      for (const [index, row] of prayer.byMangsa.entries()) {
        const at = `byMangsa[${index}]`;
        if (!isObj(row) || typeof row.mangsa !== 'string' || !Array.isArray(row.starts)) {
          err('prayer-times.json5', `${at} must be { mangsa, starts[] }`);
          continue;
        }
        if (prayerStarts.has(row.mangsa)) {
          err('prayer-times.json5', `${at}: mangsa '${row.mangsa}' appears twice`);
          continue;
        }
        const minutes = row.starts.map(parseClockTime);
        if (minutes.length !== PRAYER_BAND_IDS.length || minutes.some((m) => m === undefined)) {
          err(
            'prayer-times.json5',
            `${row.mangsa}: starts must be ${PRAYER_BAND_IDS.length} 'HH:MM' times`,
          );
          continue;
        }
        const starts = minutes as number[];
        if (starts.some((m, i) => i > 0 && m <= (starts[i - 1] as number))) {
          err('prayer-times.json5', `${row.mangsa}: starts must be strictly increasing`);
          continue;
        }
        prayerStarts.set(row.mangsa, starts);
      }
    }
    for (const { id } of mangsa) {
      if (!prayerStarts.has(id)) err('prayer-times.json5', `no row for mangsa '${id}'`);
    }
    for (const id of prayerStarts.keys()) {
      if (!mangsa.some((entry) => entry.id === id)) {
        err('prayer-times.json5', `row for unknown mangsa '${id}'`);
      }
    }
  }

  // clock.json5
  const clock = files.clock;
  if (!isObj(clock)) {
    err('clock.json5', 'is not an object');
  } else {
    const { ticksPerMinute, dayStartMinute, dayEndMinute, weekdayOfDay0, hijriOfDay0 } = clock;
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
    if (!WEEKDAY_IDS.includes(weekdayOfDay0 as WeekdayId)) {
      err('clock.json5', `weekdayOfDay0 must be one of ${WEEKDAY_IDS.join(', ')}`);
    }
    if (
      !isObj(hijriOfDay0) ||
      !isPositiveInt(hijriOfDay0.year) ||
      !isPositiveInt(hijriOfDay0.month) ||
      hijriOfDay0.month > 12 ||
      !isPositiveInt(hijriOfDay0.day) ||
      hijriOfDay0.day > hijriMonthLength(hijriOfDay0.year, hijriOfDay0.month)
    ) {
      err('clock.json5', 'hijriOfDay0 must be a valid tabular Hijri { year, month, day }');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  const c = clock as Obj;
  return {
    ok: true,
    data: {
      realYearDays,
      gameYearDays,
      mangsa: mangsa.map((entry) => ({
        ...entry,
        prayerStarts: prayerStarts.get(entry.id) as number[],
      })),
      clock: {
        ticksPerMinute: c.ticksPerMinute as number,
        dayStartMinute: c.dayStartMinute as number,
        dayEndMinute: c.dayEndMinute as number,
        weekdayOfDay0: c.weekdayOfDay0 as WeekdayId,
        hijriOfDay0: c.hijriOfDay0 as HijriDateDef,
      },
    },
  };
}
