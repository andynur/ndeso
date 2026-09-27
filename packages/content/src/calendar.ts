import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CalendarData, type RawCalendarFiles, validateCalendar } from '@bale/shared';

/** Reads the calendar data files (GDD §3, ADR-0007); the schema lives in `@bale/shared`. */

// Not CONTENT_ROOT from index.ts: index re-exports this module, and the cycle would read it
// before it is initialised.
export const CALENDAR_DIR = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  'data',
  'calendar',
);

async function readJson5(file: string): Promise<unknown> {
  return Bun.JSON5.parse(await Bun.file(join(CALENDAR_DIR, file)).text());
}

export async function readCalendarFiles(): Promise<RawCalendarFiles> {
  const [mangsa, clock, prayerTimes] = await Promise.all([
    readJson5('mangsa.json5'),
    readJson5('clock.json5'),
    readJson5('prayer-times.json5'),
  ]);
  return { mangsa, clock, prayerTimes };
}

/** Reads and validates the calendar data; throws with every problem listed. */
export async function loadCalendarData(): Promise<CalendarData> {
  const result = validateCalendar(await readCalendarFiles());
  if (!result.ok) throw new Error(`invalid calendar data:\n  ${result.errors.join('\n  ')}`);
  return result.data;
}
