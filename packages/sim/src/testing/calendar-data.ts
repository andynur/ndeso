import { type CalendarData, validateCalendar } from '@bale/shared';

/**
 * Test-only: the real calendar data, read straight from the content files and run through the
 * shared schema. `packages/sim` may not import `@bale/content` at runtime (ARCHITECTURE §2), so
 * tests read the files by path instead. Never import this from runtime sim code.
 */
const CALENDAR_DIR = new URL('../../../content/data/calendar/', import.meta.url);

async function read(file: string): Promise<unknown> {
  return Bun.JSON5.parse(await Bun.file(new URL(file, CALENDAR_DIR)).text());
}

export async function loadCalendarForTests(): Promise<CalendarData> {
  const result = validateCalendar({
    mangsa: await read('mangsa.json5'),
    clock: await read('clock.json5'),
    prayerTimes: await read('prayer-times.json5'),
  });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.data;
}
