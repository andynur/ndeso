import type { I18nKey } from '@bale/content/i18n';
import type { PrayerBandId } from '@bale/shared';
import { signal } from '@preact/signals';
import type { ClockView } from '../game/clock-view.ts';
import { format, t } from '../i18n/index.ts';

/** Set by the frame loop whenever the game minute changes; `null` before the first frame. */
export const clockView = signal<ClockView | null>(null);

const BAND_KEYS: Record<PrayerBandId, I18nKey> = {
  subuh: 'prayer.subuh',
  dhuha: 'prayer.dhuha',
  dzuhur: 'prayer.dzuhur',
  ashar: 'prayer.ashar',
  maghrib: 'prayer.maghrib',
  isya: 'prayer.isya',
};

/**
 * GDD §3.2: the time and its prayer band, the Masehi date with weekday and pasaran, and under
 * it the Javanese and Hijri dates as a subtitle. The prayer band is a time label and nothing
 * else (CULTURE_GUIDE §3). Top-left per DESIGN §5.
 */
export function HudClock() {
  const view = clockView.value;
  if (!view) return null;
  const n = format.value.number;
  return (
    <div class="clock" role="timer" aria-live="off">
      <p class="clock__time">
        {t('hud.clock', {
          time: format.value.clock(view.hour, view.minute),
          band: t(BAND_KEYS[view.band]),
        })}
      </p>
      <p class="clock__date">
        {t('hud.date', {
          weekday: t(`weekday.${view.weekday}`),
          pasaran: t(`pasaran.${view.pasaran}`),
          date: n(view.date),
          month: t(`calendar:masehi.${view.month}`),
          year: String(view.year),
        })}
      </p>
      <p class="clock__sub">
        {t('hud.date_sub', {
          jawa_day: n(view.jawa.day),
          jawa_month: t(`calendar:jawa.${view.jawa.month}`),
          jawa_year: String(view.jawa.year),
          jawa_year_name: t(`calendar:jawa_year.${view.jawa.yearName}`),
          hijri_day: n(view.hijri.day),
          hijri_month: t(`calendar:hijri.${view.hijri.month}`),
          hijri_year: String(view.hijri.year),
        })}
      </p>
    </div>
  );
}
