import { SUPPORTED_LOCALES } from '@bale/shared';
import { locale, setLocale, t } from '../i18n/index.ts';
import { AnimalStatus } from './animal-status.tsx';
import { DialogBox, type DialogBoxProps } from './dialog-box.tsx';
import { Hotbar, type HotbarProps } from './hotbar.tsx';
import { HudClock } from './hud-clock.tsx';
import { Market, type MarketProps } from './market.tsx';
import { PerfOverlay } from './perf-overlay.tsx';
import { PlayerStatus, type PlayerStatusProps } from './player-status.tsx';
import { TouchControls, type TouchControlsProps } from './touch-controls.tsx';

export interface AppProps {
  /** On-screen stick, context button, and camera buttons (GDD §12). */
  readonly controls?: TouchControlsProps | undefined;
  readonly dialog?: DialogBoxProps | undefined;
  readonly hotbar?: HotbarProps | undefined;
  readonly playerStatus?: PlayerStatusProps | undefined;
  readonly market?: MarketProps | undefined;
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
export function App({ controls, dialog, hotbar, playerStatus, market }: AppProps) {
  return (
    <>
      <div class="hud-top-left">
        <HudClock />
        <Panel />
      </div>
      <PerfOverlay />
      {playerStatus ? <PlayerStatus {...playerStatus} /> : null}
      <AnimalStatus />
      {market ? <Market {...market} /> : null}
      {dialog ? <DialogBox {...dialog} /> : null}
      {hotbar ? <Hotbar {...hotbar} /> : null}
      {controls ? <TouchControls {...controls} /> : null}
      <div class="area-fade" aria-hidden="true" />
    </>
  );
}

function Panel() {
  return (
    <div class="panel">
      <p class="panel__greeting">{t('boot.hello')}</p>
      <p class="panel__tagline">{t('app.tagline')}</p>
      <p class="panel__note">{t('boot.placeholder')}</p>
      <LocalePicker />
    </div>
  );
}
