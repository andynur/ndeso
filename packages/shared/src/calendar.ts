/**
 * Calendar data contracts and the narrow validator for `packages/content/data/calendar/*`
 * (GDD §3, ADR-0007). The full Zod schemas for all content arrive with M2-01; this checks
 * only what the clock needs to be correct, and runs wherever the data is loaded.
 */

export const MUSIM_IDS = ['hujan', 'kemarau', 'pancaroba'] as const;
export type MusimId = (typeof MUSIM_IDS)[number];

/** In band order: a band lasts from its start until the next band starts. */
export const PRAYER_BANDS = [
  'subuh',
  'terbit',
  'dhuha',
  'dzuhur',
  'ashar',
  'maghrib',
  'isya',
] as const;
export type PrayerBand = (typeof PRAYER_BANDS)[number];

/** `pasaran = day % 5` (ADR-0007). Ids match the `ui:pasaran.*` locale keys. */
export const PASARAN_IDS = ['legi', 'pahing', 'pon', 'wage', 'kliwon'] as const;
export type PasaranId = (typeof PASARAN_IDS)[number];

/** `weekday = day % 7`; day 0 is a Senin. Ids match the `ui:weekday.*` locale keys. */
export const WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayId = (typeof WEEKDAY_IDS)[number];

export interface MangsaData {
  readonly id: string;
  readonly realDays: number;
  readonly gameDays: number;
  readonly musim: MusimId;
}

export interface MangsaFile {
  readonly verified: boolean;
  readonly realYearDays: number;
  readonly gameYearDays: number;
  readonly mangsa: readonly MangsaData[];
}

export interface ClockData {
  readonly ticksPerMinute: number;
  /** Minutes from the game day's midnight; `dayEndMinute` may pass 1440 (01:00 = 1500). */
  readonly dayStartMinute: number;
  readonly dayEndMinute: number;
  /** Band start, in minutes from midnight, per mangsa id. */
  readonly prayer: Readonly<Record<string, Readonly<Record<PrayerBand, number>>>>;
}

export interface HijriDate {
  readonly year: number;
  /** 1-based: 9 = Ramadan, 10 = Syawal, 12 = Dzulhijjah. */
  readonly month: number;
  /** 1-based. */
  readonly day: number;
}

export interface HijriData {
  /** Common-year month lengths; a leap year adds one day to the last month. */
  readonly monthDays: readonly number[];
  readonly cycleYears: number;
  /** 1-based positions within the cycle. */
  readonly leapYears: readonly number[];
  /** The Hijri date of game day 0. */
  readonly epoch: HijriDate;
}

/** Everything the clock projects `day` through. `prayer` times are already minutes. */
export interface CalendarData {
  readonly mangsa: MangsaFile;
  readonly clock: ClockData;
  readonly hijri: HijriData;
}

/** The raw file shapes: identical except prayer times are written `'HH:MM'`. */
export interface CalendarSources {
  readonly mangsa: unknown;
  readonly clock: unknown;
  readonly hijri: unknown;
}

export class CalendarDataError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid calendar data:\n  - ${problems.join('\n  - ')}`);
    this.name = 'CalendarDataError';
  }
}

type Obj = Readonly<Record<string, unknown>>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPosInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/** `'HH:MM'` → minutes from midnight, or undefined when malformed. */
export function parseClockTime(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

function checkMangsa(raw: unknown, problems: string[]): MangsaFile | undefined {
  if (!isObj(raw) || !Array.isArray(raw['mangsa'])) {
    problems.push('mangsa: expected an object with a `mangsa` array');
    return undefined;
  }
  const { gameYearDays } = raw;
  if (!isPosInt(gameYearDays)) problems.push('mangsa.gameYearDays: expected a positive integer');
  const seen = new Set<string>();
  let sum = 0;
  raw['mangsa'].forEach((entry: unknown, index: number) => {
    const at = `mangsa[${index}]`;
    if (!isObj(entry) || typeof entry['id'] !== 'string') {
      problems.push(`${at}: expected an object with a string id`);
      return;
    }
    const { id, gameDays, musim } = entry;
    if (seen.has(id)) problems.push(`${at}: duplicate id '${id}'`);
    seen.add(id);
    if (isPosInt(gameDays)) sum += gameDays;
    else problems.push(`${at} (${id}): gameDays must be a positive integer`);
    if (!MUSIM_IDS.includes(musim as MusimId)) {
      problems.push(`${at} (${id}): unknown musim '${String(musim)}'`);
    }
  });
  if (seen.size === 0) problems.push('mangsa: the list is empty');
  if (isPosInt(gameYearDays) && sum !== gameYearDays) {
    problems.push(`mangsa: gameDays sum to ${sum}, but gameYearDays is ${gameYearDays}`);
  }
  return raw as unknown as MangsaFile;
}

function checkClock(raw: unknown, mangsaIds: readonly string[], problems: string[]) {
  if (!isObj(raw) || !isObj(raw['prayer'])) {
    problems.push('clock: expected an object with a `prayer` table');
    return undefined;
  }
  const { ticksPerMinute, dayStartMinute, dayEndMinute } = raw;
  if (!isPosInt(ticksPerMinute)) problems.push('clock.ticksPerMinute: expected a positive integer');
  const isMinute = (value: unknown): value is number => value === 0 || isPosInt(value);
  if (!isMinute(dayStartMinute) || !isPosInt(dayEndMinute) || dayStartMinute >= dayEndMinute) {
    problems.push('clock: dayStartMinute and dayEndMinute must be integers with start < end');
  } else if (dayEndMinute - dayStartMinute > 1440) {
    problems.push('clock: a game day cannot be longer than 24 hours');
  }

  const table = raw['prayer'];
  const prayer: Record<string, Record<PrayerBand, number>> = {};
  for (const id of Object.keys(table)) {
    if (!mangsaIds.includes(id)) problems.push(`clock.prayer.${id}: not a mangsa id`);
  }
  for (const id of mangsaIds) {
    const row = table[id];
    if (!isObj(row)) {
      problems.push(`clock.prayer.${id}: missing`);
      continue;
    }
    const minutes = {} as Record<PrayerBand, number>;
    let previous = -1;
    for (const band of PRAYER_BANDS) {
      const value = parseClockTime(row[band]);
      if (value === undefined) {
        problems.push(`clock.prayer.${id}.${band}: expected 'HH:MM'`);
        continue;
      }
      if (value <= previous) problems.push(`clock.prayer.${id}.${band}: not after the band before`);
      previous = value;
      minutes[band] = value;
    }
    prayer[id] = minutes;
  }
  return { ...(raw as unknown as ClockData), prayer };
}

function checkHijri(raw: unknown, problems: string[]): HijriData | undefined {
  if (!isObj(raw) || !Array.isArray(raw['monthDays']) || !Array.isArray(raw['leapYears'])) {
    problems.push('hijri: expected an object with `monthDays` and `leapYears` arrays');
    return undefined;
  }
  const { monthDays, leapYears, cycleYears, epoch } = raw;
  if (monthDays.length !== 12 || !monthDays.every(isPosInt)) {
    problems.push('hijri.monthDays: expected 12 positive integers');
  }
  if (!isPosInt(cycleYears)) {
    problems.push('hijri.cycleYears: expected a positive integer');
  } else if (
    !leapYears.every((year: unknown) => isPosInt(year) && year <= cycleYears) ||
    new Set(leapYears).size !== leapYears.length
  ) {
    problems.push(`hijri.leapYears: expected unique integers in 1..${cycleYears}`);
  }
  const month = isObj(epoch) ? epoch['month'] : undefined;
  const day = isObj(epoch) ? epoch['day'] : undefined;
  if (
    !isObj(epoch) ||
    !isPosInt(epoch['year']) ||
    !isPosInt(month) ||
    month > 12 ||
    !isPosInt(day) ||
    day > ((monthDays[month - 1] as number | undefined) ?? 0)
  ) {
    // Bounded by the common-year length: an epoch on a leap day is rejected, deliberately.
    problems.push('hijri.epoch: expected a valid { year, month, day }');
  }
  return raw as unknown as HijriData;
}

/**
 * Checks the calendar files and converts prayer times to minutes. Throws a
 * `CalendarDataError` listing every problem, so one run shows them all.
 */
export function validateCalendarData(sources: CalendarSources): CalendarData {
  const problems: string[] = [];
  const mangsa = checkMangsa(sources.mangsa, problems);
  const ids = mangsa?.mangsa.map((entry) => entry.id) ?? [];
  const clock = checkClock(sources.clock, ids, problems);
  const hijri = checkHijri(sources.hijri, problems);
  if (problems.length > 0 || !mangsa || !clock || !hijri) throw new CalendarDataError(problems);
  return { mangsa, clock, hijri };
}
