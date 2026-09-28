import type {
  CalendarData,
  HijriMonthId,
  JawaMonthId,
  JawaYearId,
  MasehiMonthId,
  PasaranId,
  PrayerBandId,
  WeekdayId,
} from '@bale/shared';
import { JAWA_MONTH_IDS } from '@bale/shared';
import { type ClockState, hijriMonthId, hourOf, prayerBandOf, projectDay } from '@bale/sim';

/**
 * What the HUD clock shows (GDD §3.2):
 *
 *   15:40 · Ashar
 *   Rabu Wage, 1 Juli 2026
 *   15 Sura 1960 Dal · 15 Muharam 1448 H
 *
 * A read-only projection of the sim clock, rebuilt only when the minute changes, so the
 * overlay re-renders at most once per game minute (~0.7 s), not every frame.
 */
export interface ClockView {
  readonly hour: number;
  readonly minute: number;
  /** A time label only — it never gates anything (CULTURE_GUIDE §3). */
  readonly band: PrayerBandId;
  readonly weekday: WeekdayId;
  readonly pasaran: PasaranId;
  readonly date: number;
  readonly month: MasehiMonthId;
  readonly year: number;
  readonly jawa: {
    readonly day: number;
    readonly month: JawaMonthId;
    readonly year: number;
    readonly yearName: JawaYearId;
  };
  readonly hijri: { readonly day: number; readonly month: HijriMonthId; readonly year: number };
}

export function clockViewOf(clock: Readonly<ClockState>, cal: CalendarData): ClockView {
  const today = projectDay(clock.day, cal);
  const { masehi, jawa, hijri } = today;
  return {
    hour: hourOf(clock.minute),
    minute: clock.minute % 60,
    band: prayerBandOf(clock.minute, masehi.month, cal),
    weekday: today.weekday,
    pasaran: today.pasaran,
    date: masehi.date,
    month: masehi.monthId,
    year: masehi.year,
    jawa: {
      day: jawa.day,
      month: JAWA_MONTH_IDS[jawa.month - 1] ?? 'sura',
      year: jawa.year,
      yearName: jawa.yearName,
    },
    hijri: { day: hijri.day, month: hijriMonthId(hijri.month), year: hijri.year },
  };
}
