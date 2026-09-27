import { signal } from '@preact/signals';
import { t } from '../i18n/index.ts';
import { STICK_RADIUS_PX, type StickView } from '../platform/input/pointer.ts';

/** Where the floating stick is drawn; `null` while no thumb holds it. Set by the input layer. */
export const stickView = signal<StickView | null>(null);

export interface TouchControlsProps {
  onInteract(): void;
  /** `+1` counter-clockwise from above, like `CameraControls.rotate`. */
  onTurn(direction: 1 | -1): void;
}

const STICK_SIZE = `${STICK_RADIUS_PX * 2}px`;

/** The ring under the thumb. Drawn only; the canvas owns the touch itself. */
function Stick() {
  const view = stickView.value;
  if (!view) return null;
  return (
    <div
      class="stick"
      aria-hidden="true"
      style={{
        left: `${view.originX}px`,
        top: `${view.originY}px`,
        width: STICK_SIZE,
        height: STICK_SIZE,
      }}
    >
      <div
        class="stick__knob"
        style={{ transform: `translate(${view.knobX}px, ${view.knobY}px)` }}
      />
    </div>
  );
}

/**
 * GDD §12 touch column, laid out per DESIGN §5: the joystick floats in the left 40 %, the
 * context button sits under the right thumb with the camera buttons beside it. CSS hides the
 * buttons where the primary pointer is a mouse; the keys cover them there.
 */
export function TouchControls({ onInteract, onTurn }: TouchControlsProps) {
  return (
    <>
      <Stick />
      <div class="controls">
        <button
          type="button"
          class="controls__turn"
          aria-label={t('controls.turn_ccw')}
          onClick={() => onTurn(1)}
        >
          ↺
        </button>
        <button
          type="button"
          class="controls__turn"
          aria-label={t('controls.turn_cw')}
          onClick={() => onTurn(-1)}
        >
          ↻
        </button>
        <button type="button" class="controls__action" onClick={onInteract}>
          {t('controls.interact')}
        </button>
      </div>
    </>
  );
}
