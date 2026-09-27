/// <reference path="./json5.d.ts" />
import { type CalendarData, validateCalendar } from '@bale/shared';
import clock from '../data/calendar/clock.json5';
import mangsa from '../data/calendar/mangsa.json5';
import prayerTimes from '../data/calendar/prayer-times.json5';

/**
 * The calendar data for the browser: the same files `calendar.ts` reads from disk, imported
 * statically so the bundler inlines them (`calendar.ts` uses `node:` APIs the client may not).
 * Validated once at import; a broken file fails the boot loudly instead of desyncing the clock.
 */
function load(): CalendarData {
  const result = validateCalendar({ mangsa, clock, prayerTimes });
  if (!result.ok) throw new Error(`invalid calendar data:\n  ${result.errors.join('\n  ')}`);
  return result.data;
}

export const CALENDAR_DATA: CalendarData = load();
