import type { BootI18n } from '../i18n/boot.ts';
import type { QualityPreset } from '../render/quality/presets.ts';

export interface RenderStats {
  readonly preset: QualityPreset;
  readonly pixelRatio: number;
}

export interface AppProps {
  readonly i18n: BootI18n;
  /** Only set under `?debug=perf` (PERFORMANCE_BUDGET §6). */
  readonly stats?: RenderStats | undefined;
}

/**
 * M0-03 overlay: proves the Preact layer renders above the WebGL canvas and that
 * strings come from the locale bundles. The HUD from DESIGN §4 replaces it in M2.
 */
export function App({ i18n, stats }: AppProps) {
  return (
    <div class="panel">
      <p class="panel__greeting">{i18n.t('boot.hello')}</p>
      <p class="panel__tagline">{i18n.t('app.tagline')}</p>
      <p class="panel__note">{i18n.t('boot.placeholder')}</p>
      {stats ? (
        <p class="panel__stats">
          {i18n.locale} · {stats.preset} @ {stats.pixelRatio}x
        </p>
      ) : null}
    </div>
  );
}
