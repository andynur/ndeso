import { clampMove, createInputFrame, type InputFrame, resetInputFrame } from './input-frame.ts';
import { createKeyboardSource, type KeyboardSource } from './keyboard.ts';
import {
  attachPointer,
  createPointerSource,
  type PointerSource,
  type StickView,
} from './pointer.ts';

/**
 * One input front for the game: keyboard, pointer, and the overlay's on-screen buttons
 * all land in the same `InputFrame`, sampled once per rendered frame. Gamepad joins here
 * when a task needs it (ARCHITECTURE §4.4).
 */
export interface Input {
  readonly keyboard: KeyboardSource;
  readonly pointer: PointerSource;
  /** On-screen context button (GDD §12, touch). */
  pressInteract(): void;
  /** On-screen camera buttons (GDD §12: "two-finger swipe / buttons"). */
  pressRotate(direction: 1 | -1): void;
  /** Merges every source into one frame and clears their edges. Reuses one object. */
  sample(): Readonly<InputFrame>;
}

export function createInput(onStick: (view: StickView | null) => void): Input {
  const keyboard = createKeyboardSource();
  const pointer = createPointerSource(onStick);
  const frame = createInputFrame();
  let interact = false;
  let rotate = 0;

  return {
    keyboard,
    pointer,
    pressInteract() {
      interact = true;
    },
    pressRotate(direction) {
      rotate += direction;
    },
    sample() {
      resetInputFrame(frame);
      keyboard.sample(frame);
      pointer.sample(frame);
      clampMove(frame);
      if (interact) frame.interact = true;
      frame.rotate += rotate;
      interact = false;
      rotate = 0;
      return frame;
    },
  };
}

/** Wires the browser into `input`. Returns the detach function. */
export function attachInput(target: Window, canvas: HTMLElement, input: Input): () => void {
  const { keyboard } = input;
  const onKeyDown = (event: KeyboardEvent) => {
    // Leave browser and OS shortcuts (Ctrl+R, Cmd+W, Alt+←) alone.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Arrows and Space would otherwise scroll a page that has nothing to scroll.
    if (keyboard.keyDown(event.code, event.repeat)) event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent) => keyboard.keyUp(event.code);
  const onBlur = () => keyboard.releaseAll();
  const onWheel = (event: WheelEvent) => {
    // A trackpad pinch arrives as Ctrl+wheel; without this the whole page zooms instead.
    if (event.ctrlKey) event.preventDefault();
    keyboard.wheel(event.deltaY, event.ctrlKey);
  };
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  const detachPointer = attachPointer(canvas, input.pointer);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
    canvas.removeEventListener('wheel', onWheel);
    detachPointer();
  };
}
