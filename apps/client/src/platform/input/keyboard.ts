import type { InputFrame } from './input-frame.ts';

/**
 * Keyboard and wheel, GDD §12. Keys are matched on `KeyboardEvent.code` — the physical
 * key — so WASD sits under the left hand on AZERTY and every other layout too.
 *
 * The camera turns on Q / R as the GDD table says; E is interact, so the M1-04 stopgap's
 * Q / E pair does not survive. The wheel switches tools (GDD §12); zoom is on − / + and on
 * a trackpad pinch, which browsers report as a wheel event with `ctrlKey` set.
 */

type Direction = 'up' | 'down' | 'left' | 'right';

export type KeyAction =
  | { readonly kind: 'move'; readonly direction: Direction }
  | { readonly kind: 'interact' }
  | { readonly kind: 'slot'; readonly slot: number }
  | { readonly kind: 'rotate'; readonly direction: 1 | -1 }
  | { readonly kind: 'zoom'; readonly delta: number };

/** World units per − / + press or wheel notch of zoom. */
export const ZOOM_STEP = 1;

const MOVE = (direction: Direction): KeyAction => ({ kind: 'move', direction });

export const KEY_BINDINGS: Readonly<Record<string, KeyAction>> = {
  KeyW: MOVE('up'),
  ArrowUp: MOVE('up'),
  KeyS: MOVE('down'),
  ArrowDown: MOVE('down'),
  KeyA: MOVE('left'),
  ArrowLeft: MOVE('left'),
  KeyD: MOVE('right'),
  ArrowRight: MOVE('right'),
  Space: { kind: 'interact' },
  KeyE: { kind: 'interact' },
  KeyQ: { kind: 'rotate', direction: 1 },
  KeyR: { kind: 'rotate', direction: -1 },
  Minus: { kind: 'zoom', delta: ZOOM_STEP },
  NumpadSubtract: { kind: 'zoom', delta: ZOOM_STEP },
  Equal: { kind: 'zoom', delta: -ZOOM_STEP },
  NumpadAdd: { kind: 'zoom', delta: -ZOOM_STEP },
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, slot) => [`Digit${slot + 1}`, { kind: 'slot', slot }]),
  ),
};

export interface KeyboardSource {
  /** Returns whether the key is bound, so the caller knows to `preventDefault`. */
  keyDown(code: string, repeat: boolean): boolean;
  keyUp(code: string): void;
  /** `deltaY` sign only: one notch per event, whatever the device's scroll units. */
  wheel(deltaY: number, ctrlKey: boolean): void;
  /** Drops every held key and unsampled press, e.g. when the window loses focus mid-press. */
  releaseAll(): void;
  /** Adds this source's movement and edges into `frame`, then clears the edges. */
  sample(frame: InputFrame): void;
}

export function createKeyboardSource(): KeyboardSource {
  // Held movement keys by code, so letting go of W while ↑ is down keeps moving up.
  const held = new Map<string, Direction>();
  let interact = false;
  let slot = -1;
  let cycle = 0;
  let rotate = 0;
  let zoom = 0;

  return {
    keyDown(code, repeat) {
      const action = KEY_BINDINGS[code];
      if (!action) return false;
      if (action.kind === 'move') {
        held.set(code, action.direction);
        return true;
      }
      // Holding a key must not turn the camera or retrigger a tool every autorepeat.
      if (repeat) return true;
      switch (action.kind) {
        case 'interact':
          interact = true;
          break;
        case 'slot':
          slot = action.slot;
          break;
        case 'rotate':
          rotate += action.direction;
          break;
        case 'zoom':
          zoom += action.delta;
      }
      return true;
    },
    keyUp(code) {
      held.delete(code);
    },
    wheel(deltaY, ctrlKey) {
      const notch = Math.sign(deltaY);
      if (ctrlKey) zoom += notch * ZOOM_STEP;
      else cycle += notch;
    },
    releaseAll() {
      held.clear();
      // A press from before the blur must not fire on the first frame after refocus.
      interact = false;
      slot = -1;
      cycle = 0;
      rotate = 0;
      zoom = 0;
    },
    sample(frame) {
      let right = 0;
      let left = 0;
      let up = 0;
      let down = 0;
      for (const direction of held.values()) {
        if (direction === 'right') right = 1;
        else if (direction === 'left') left = 1;
        else if (direction === 'up') up = 1;
        else down = 1;
      }
      const x = right - left;
      const y = up - down;
      // A diagonal is as fast as a straight line.
      const scale = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
      frame.moveX += x * scale;
      frame.moveY += y * scale;
      if (interact) frame.interact = true;
      if (slot >= 0) frame.slot = slot;
      frame.cycle += cycle;
      frame.rotate += rotate;
      frame.zoom += zoom;
      interact = false;
      slot = -1;
      cycle = 0;
      rotate = 0;
      zoom = 0;
    },
  };
}
