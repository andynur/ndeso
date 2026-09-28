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
 * GDD §3.2: `15:40 · Ashar` over `Mangsa Kapat · hari 3/8 · Kliwon`. The prayer band is a
 * time label and nothing else (CULTURE_GUIDE §3). Top-left per DESIGN §5.
 */
export function HudClock() {
  const view = clockView.value;
  if (!view) return null;
  // Mangsa ids come from validated data; `content/src/calendar.test.ts` checks every one
  // has a name in every locale, which the key union cannot express.
  const mangsaKey = `calendar:mangsa.${view.mangsa}.name` as I18nKey;
  return (
    <div class="clock" role="timer" aria-live="off">
      <p class="clock__time">
        {t('hud.clock', {
          time: format.value.clock(view.hour, view.minute),
          band: t(BAND_KEYS[view.band]),
        })}
      </p>
      <p class="clock__date">
        {t('hud.mangsa_day', {
          mangsa: t(mangsaKey),
          day: format.value.number(view.mangsaDay),
          length: format.value.number(view.mangsaLength),
          pasaran: t(`pasaran.${view.pasaran}`),
        })}
      </p>
    </div>
  );
}
