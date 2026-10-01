import type { DayEndReason, DayEndSummary } from '@bale/sim';
import { signal } from '@preact/signals';
import { format, t } from '../i18n/index.ts';

export interface PlayerStatusView {
  readonly money: number;
  readonly stamina: number;
  readonly maxStamina: number;
  readonly summary: DayEndSummary | null;
}

export const playerStatusView = signal<PlayerStatusView>({
  money: 0,
  stamina: 100,
  maxStamina: 100,
  summary: null,
});

export interface PlayerStatusProps {
  onSleep(): void;
  onContinue(): void;
}

const REASON_KEYS: Record<
  DayEndReason,
  'day_end.reason.sleep' | 'day_end.reason.exhausted' | 'day_end.reason.late'
> = {
  sleep: 'day_end.reason.sleep',
  exhausted: 'day_end.reason.exhausted',
  late: 'day_end.reason.late',
};

export function PlayerStatus({ onSleep, onContinue }: PlayerStatusProps) {
  const view = playerStatusView.value;
  const percent = (view.stamina / view.maxStamina) * 100;
  return (
    <>
      <section class="player-status" aria-label={t('hud.stamina')}>
        <div class="player-status__money">
          <span>{t('hud.money')}</span>
          <strong>{format.value.money(view.money)}</strong>
        </div>
        <div class="player-status__line">
          <span>{t('hud.stamina')}</span>
          <strong>
            {format.value.number(view.stamina)}/{format.value.number(view.maxStamina)}
          </strong>
        </div>
        <div class="player-status__track" aria-hidden="true">
          <span class="player-status__fill" style={{ width: `${percent}%` }} />
        </div>
        <button type="button" class="player-status__sleep" onClick={onSleep}>
          {t('day_end.sleep')}
        </button>
      </section>
      {view.summary ? (
        <div class="day-end" role="dialog" aria-modal="true" aria-labelledby="day-end-title">
          <section class="day-end__panel">
            <h2 id="day-end-title">
              {t('day_end.title', { day: format.value.number(view.summary.day + 1) })}
            </h2>
            <p>{t(REASON_KEYS[view.summary.reason])}</p>
            <p>
              {t('day_end.stamina', {
                stamina: format.value.number(view.summary.staminaRemaining),
                max: format.value.number(view.maxStamina),
              })}
            </p>
            {view.summary.moneyLost > 0 ? (
              <p>
                {t('day_end.money_lost', { money: format.value.money(view.summary.moneyLost) })}
              </p>
            ) : null}
            <button type="button" class="day-end__continue" onClick={onContinue} autofocus>
              {t('day_end.continue')}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
