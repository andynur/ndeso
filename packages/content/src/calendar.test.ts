import { describe, expect, test } from 'bun:test';
import {
  HIJRI_MONTH_IDS,
  JAWA_MONTH_IDS,
  JAWA_YEAR_IDS,
  MASEHI_MONTH_IDS,
  SUPPORTED_LOCALES,
  validateCalendar,
} from '@bale/shared';
import { loadCalendarData, readCalendarFiles } from './calendar.ts';
import { loadLocaleBundle } from './index.ts';

describe('calendar data', () => {
  test('the committed files pass the calendar schema', async () => {
    const result = validateCalendar(await readCalendarFiles());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  test('musim follows the owner split: hujan Nov–Mar, pancaroba Apr and Oct (GDD §3)', async () => {
    const data = await loadCalendarData();
    expect(data.gameYearDays).toBe(120);
    expect(data.months.map((m) => m.musim.slice(0, 1)).join('')).toBe('hhhpkkkkkphh');
  });

  const keys = [
    ...MASEHI_MONTH_IDS.map((id) => `masehi.${id}`),
    ...HIJRI_MONTH_IDS.map((id) => `hijri.${id}`),
    ...JAWA_MONTH_IDS.map((id) => `jawa.${id}`),
    ...JAWA_YEAR_IDS.map((id) => `jawa_year.${id}`),
  ];
  for (const { id: locale } of SUPPORTED_LOCALES) {
    test(`every month and year name is in ${locale}/calendar.json`, async () => {
      const bundle = await loadLocaleBundle(locale, 'calendar');
      expect(keys.filter((key) => !bundle[key])).toEqual([]);
    });
  }
});
