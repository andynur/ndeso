import { expect, test } from 'bun:test';
import { loadCalendarData } from './calendar.ts';
import { CALENDAR_DATA } from './calendar-bundle.ts';

test('the bundled calendar matches the one read from disk', async () => {
  expect(CALENDAR_DATA).toEqual(await loadCalendarData());
});
