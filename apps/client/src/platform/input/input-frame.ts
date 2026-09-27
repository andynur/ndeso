/**
 * The unified input snapshot (ARCHITECTURE §4.4 `input`): every device writes into one
 * `InputFrame` per rendered frame, and `game/` turns it into sim `Command`s and camera
 * calls. Nothing here knows about the sim or the renderer.
 *
 * Movement is **screen-relative** (`+x` right, `+y` up the screen, i.e. away from the
 * camera); only the game layer knows the camera yaw that maps it onto the ground.
 */
export interface InputFrame {
  /** Held movement, screen-relative, length ≤ 1. */
  moveX: number;
  moveY: number;
  /** Edge: use the tool / interact was pressed this frame. */
  interact: boolean;
  /** Edge: hotbar slot picked this frame, `0`-based, or `-1` for none. */
  slot: number;
  /** Edge: hotbar steps this frame (wheel notches), signed. */
  cycle: number;
  /** Edge: camera quarter turns this frame, `+1` counter-clockwise (`CameraControls.rotate`). */
  rotate: number;
  /** Edge: camera zoom this frame in world units, positive = out. */
  zoom: number;
}

export function createInputFrame(): InputFrame {
  return { moveX: 0, moveY: 0, interact: false, slot: -1, cycle: 0, rotate: 0, zoom: 0 };
}

/** Clears the edges and the held movement, ready for the sources to write again. */
export function resetInputFrame(frame: InputFrame): void {
  frame.moveX = 0;
  frame.moveY = 0;
  frame.interact = false;
  frame.slot = -1;
  frame.cycle = 0;
  frame.rotate = 0;
  frame.zoom = 0;
}

/** Scales `(moveX, moveY)` back onto the unit circle when two sources pushed it past. */
export function clampMove(frame: InputFrame): void {
  const length = Math.hypot(frame.moveX, frame.moveY);
  if (length > 1) {
    frame.moveX /= length;
    frame.moveY /= length;
  }
}
