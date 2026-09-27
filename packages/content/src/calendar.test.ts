import { describe, expect, test } from 'bun:test';
import { SUPPORTED_LOCALES, validateCalendar } from '@bale/shared';
import { loadCalendarData, readCalendarFiles } from './calendar.ts';
import { loadLocaleBundle } from './index.ts';

describe('calendar data', () => {
  test('the committed files pass the calendar schema', async () => {
    const result = validateCalendar(await readCalendarFiles());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  test('has the 12 mangsa of GDD §3.1 summing to a 120-day year', async () => {
    const data = await loadCalendarData();
    expect(data.gameYearDays).toBe(120);
    expect(data.mangsa.map((m) => m.id)).toEqual([
      'kasa',
      'karo',
      'katelu',
      'kapat',
      'kalima',
      'kanem',
      'kapitu',
      'kawolu',
      'kasanga',
      'kasadasa',
      'dhesta',
      'sadha',
    ]);
  });

  for (const { id: locale } of SUPPORTED_LOCALES) {
    test(`every mangsa has a name and a sign in ${locale}/calendar.json`, async () => {
      const bundle = await loadLocaleBundle(locale, 'calendar');
      const missing = (await loadCalendarData()).mangsa
        .flatMap((m) => [`mangsa.${m.id}.name`, `mangsa.${m.id}.sign`])
        .filter((key) => !bundle[key]);
      expect(missing).toEqual([]);
    });
  }
});
