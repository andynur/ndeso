import type { BootI18n } from '../i18n/boot.ts';
import type { QualityPreset } from '../platform/quality.ts';

export interface AppProps {
  readonly i18n: BootI18n;
  readonly preset: QualityPreset;
  readonly pixelRatio: number;
}

/**
 * M0-03 overlay: proves the Preact layer renders above the WebGL canvas and that
 * strings come from the locale bundles. The HUD from DESIGN §4 replaces it in M2.
 */
export function App({ i18n, preset, pixelRatio }: AppProps) {
  return (
    <div class="panel">
      <p class="panel__greeting">{i18n.t('boot.hello')}</p>
      <p class="panel__tagline">{i18n.t('app.tagline')}</p>
      <p class="panel__meta">
        {i18n.t('boot.placeholder')} · {i18n.locale} · {preset} @ {pixelRatio}x
      </p>
    </div>
  );
}
