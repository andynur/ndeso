import { type QualityPreset, SUPPORTED_LOCALES } from '@bale/shared';
import { format, locale, setLocale, t } from '../i18n/index.ts';
import { TouchControls, type TouchControlsProps } from './touch-controls.tsx';

export interface RenderStats {
  readonly preset: QualityPreset;
  readonly pixelRatio: number;
}

export interface AppProps {
  /** Only set under `?debug=perf` (PERFORMANCE_BUDGET §6). */
  readonly stats?: RenderStats | undefined;
  /** On-screen stick, context button, and camera buttons (GDD §12). */
  readonly controls?: TouchControlsProps | undefined;
}

/** M0-04 acceptance criterion: picking a locale re-renders every string below. */
function LocalePicker() {
  const active = locale.value;
  return (
    <p class="picker">
      <span class="picker__label">{t('settings.language')}</span>
      {SUPPORTED_LOCALES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          class="picker__option"
          lang={entry.tag}
          aria-pressed={entry.id === active}
          onClick={() => {
            void setLocale(entry.id);
          }}
        >
          {entry.nativeName}
        </button>
      ))}
    </p>
  );
}

/**
 * M0-03/M0-04 overlay: the Preact layer renders above the WebGL canvas, every string
 * comes from the locale bundles, and the locale can be switched live. The HUD from
 * DESIGN §4 replaces it in M2.
 */
export function App({ stats, controls }: AppProps) {
  return (
    <>
      <Panel stats={stats} />
      {controls ? <TouchControls {...controls} /> : null}
    </>
  );
}

function Panel({ stats }: Pick<AppProps, 'stats'>) {
  return (
    <div class="panel">
      <p class="panel__greeting">{t('boot.hello')}</p>
      <p class="panel__tagline">{t('app.tagline')}</p>
      <p class="panel__note">{t('boot.placeholder')}</p>
      {/* Sample data until M1-01 owns the clock and M2-07 the wallet. */}
      <p class="panel__sample">
        {t('hud.money')}: {format.value.money(12500)}
      </p>
      <LocalePicker />
      {stats ? (
        <p class="panel__stats">
          {locale.value} · {stats.preset} @ {stats.pixelRatio}x
        </p>
      ) : null}
    </div>
  );
}
