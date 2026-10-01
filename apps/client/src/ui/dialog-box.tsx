import type { DialogController } from '../game/dialog.ts';
import { dialogView } from '../game/dialog.ts';
import { t } from '../i18n/index.ts';

export interface DialogBoxProps {
  readonly onAdvance: DialogController['advance'];
  readonly onChoose: DialogController['choose'];
}

export function DialogBox({ onAdvance, onChoose }: DialogBoxProps) {
  const view = dialogView.value;
  if (!view) return null;
  return (
    <section class="dialog-box" role="dialog" aria-modal="true" aria-live="polite">
      <div class="dialog-box__panel">
        <h2>{t(`npcs:${view.npcId}.name`)}</h2>
        <p>{view.text}</p>
        {view.choices.length > 0 ? (
          <div class="dialog-box__choices">
            {view.choices.map((choice) => (
              <button key={choice.index} type="button" onClick={() => onChoose(choice.index)}>
                {choice.text}
              </button>
            ))}
          </div>
        ) : (
          <button class="dialog-box__advance" type="button" onClick={onAdvance}>
            {t(view.complete ? 'dialog.close' : 'dialog.continue')}
          </button>
        )}
      </div>
    </section>
  );
}
