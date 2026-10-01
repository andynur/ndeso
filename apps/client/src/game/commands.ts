import type { Command } from '@bale/sim';
import type { InputFrame } from '../platform/input/input-frame.ts';

/**
 * Input → `Command`s (ARCHITECTURE §1, `game/`). The one place that knows both the
 * device-free `InputFrame` and the camera yaw, so the sim only ever hears world-space
 * intents and replays the same whichever way the camera faced.
 */

/** Movement changes smaller than this are not worth a command. */
const MOVE_EPSILON = 1e-3;

/**
 * Screen-relative stick `(right, up)` → world `(x, z)` on the ground under camera `yaw`.
 * The inverse of `screenFacing` in `render/camera/camera-rig.ts`: at yaw 0 the camera looks
 * down −z, so "up the screen" is −z and "right" is +x.
 */
export function screenToWorld(
  right: number,
  up: number,
  yaw: number,
  out: { x: number; z: number },
): { x: number; z: number } {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // `screenFacing` measures "toward the camera"; up the screen is away from it.
  const toward = -up;
  out.x = right * cos + toward * sin;
  out.z = -right * sin + toward * cos;
  return out;
}

export interface CommandMapper {
  /** Emits this frame's commands through `submit`, in a fixed order. */
  map(
    frame: Readonly<InputFrame>,
    yaw: number,
    submit: (command: Command) => void,
    allowInteract?: boolean,
  ): void;
  /** Release held movement while a modal client interaction owns input. */
  stop(submit: (command: Command) => void): void;
}

export function createCommandMapper(): CommandMapper {
  const world = { x: 0, z: 0 };
  let lastX = 0;
  let lastZ = 0;

  return {
    map(frame, yaw, submit, allowInteract = true) {
      screenToWorld(frame.moveX, frame.moveY, yaw, world);
      // `+ 0` folds −0 into 0, so a stop always reads as `{ x: 0, z: 0 }`.
      const x = world.x + 0;
      const z = world.z + 0;
      // Held intent: sent only when it changes, so an idle player costs no commands. A stop
      // is always sent, however small the last intent was. The camera easing through a turn
      // changes the intent every frame, which is correct — the stick means "away from the
      // camera", and the camera is moving.
      const stopping = x === 0 && z === 0 && (lastX !== 0 || lastZ !== 0);
      if (stopping || Math.abs(x - lastX) > MOVE_EPSILON || Math.abs(z - lastZ) > MOVE_EPSILON) {
        lastX = x;
        lastZ = z;
        submit({ type: 'move', x, z });
      }
      if (frame.slot >= 0) submit({ type: 'selectSlot', slot: frame.slot });
      const steps = Math.trunc(frame.cycle);
      for (let i = 0; i < Math.abs(steps); i++) {
        submit({ type: 'cycleSlot', delta: steps > 0 ? 1 : -1 });
      }
      if (frame.interact && allowInteract) submit({ type: 'interact' });
      if (frame.sleep) submit({ type: 'sleep' });
      if (frame.continueDay) submit({ type: 'continueDay' });
    },
    stop(submit) {
      if (lastX === 0 && lastZ === 0) return;
      lastX = 0;
      lastZ = 0;
      submit({ type: 'move', x: 0, z: 0 });
    },
  };
}
