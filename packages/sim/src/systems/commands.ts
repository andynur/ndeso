import type { CollisionGrid } from '../collision.ts';
import { movePlayer, type PlayerState } from '../player.ts';
import type { System } from '../types.ts';

/**
 * The `commands` system (ARCHITECTURE §3.2, step 3). `move` is a held intent: the client
 * sends it only when it changes, so the last one in a step replaces the stored intent and
 * the player keeps walking on it every tick until the next. Commands arrive sanitized
 * (`sanitizeCommand`), so nothing here re-validates them.
 *
 * `interact`, `selectSlot` and `cycleSlot` have nothing to act on until the inventory and
 * tools land (M2), and pass through untouched.
 */
export function createCommandsSystem(grid: CollisionGrid): System<PlayerState> {
  return (state, ctx) => {
    const { intent } = state.player;
    for (const command of ctx.commands) {
      if (command.type !== 'move') continue;
      intent.x = command.x;
      intent.z = command.z;
    }
    for (let i = 0; i < ctx.ticks; i++) movePlayer(state, grid);
  };
}
