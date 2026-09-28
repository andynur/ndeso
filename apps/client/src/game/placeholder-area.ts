import { blockRect, type CollisionGrid, createCollisionGrid, type Vec2 } from '@bale/sim';

/**
 * The M0-03 test yard as sim data: the 40 × 40 ground with the 2 × 2 placeholder house at
 * its centre, matching `render/scene.ts` (which may not import `game/`, so the two are kept
 * in step by hand). M1-09's Balé terrain replaces both with a real area and its grid.
 */
export function createPlaceholderArea(): CollisionGrid {
  const grid = createCollisionGrid(-20, -20, 40, 40);
  blockRect(grid, -1, -1, 1, 1);
  return grid;
}

/** In front of the house, where the placeholder walker used to start its round. */
export const PLACEHOLDER_SPAWN: Readonly<Vec2> = { x: 0, z: 2.5 };
