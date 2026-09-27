import { type CalendarData, validateCalendarData } from '@bale/shared';
import clock from '../data/calendar/clock.json5';
import hijri from '../data/calendar/hijri.json5';
import mangsa from '../data/calendar/mangsa.json5';

/**
 * The calendar data (GDD §3, ADR-0007), validated at import time: a bad edit to any of the
 * three files fails the first test or build that loads it, with every problem listed.
 */
export const calendarData: CalendarData = validateCalendarData({ mangsa, clock, hijri });
