import type { CalendarData, PasaranId, PrayerBandId } from '@bale/shared';
import { type ClockState, hourOf, mangsaOf, pasaranOf, prayerBandOf } from '@bale/sim';

/**
 * What the HUD clock shows (GDD §3.2): `15:40 · Ashar · Mangsa Kapat hari 3/8 · Kliwon`.
 * A read-only projection of the sim clock, rebuilt only when the minute changes, so the
 * overlay re-renders at most once per game minute (~0.7 s), not every frame.
 */
export interface ClockView {
  readonly hour: number;
  readonly minute: number;
  /** A time label only — it never gates anything (CULTURE_GUIDE §3). */
  readonly band: PrayerBandId;
  readonly mangsa: string;
  /** 1-based day within the mangsa. */
  readonly mangsaDay: number;
  readonly mangsaLength: number;
  readonly pasaran: PasaranId;
}

export function clockViewOf(clock: Readonly<ClockState>, cal: CalendarData): ClockView {
  const mangsa = mangsaOf(clock.day, cal);
  return {
    hour: hourOf(clock.minute),
    minute: clock.minute % 60,
    band: prayerBandOf(clock.minute, mangsa, cal),
    mangsa: mangsa.id,
    mangsaDay: mangsa.day,
    mangsaLength: mangsa.length,
    pasaran: pasaranOf(clock.day),
  };
}
