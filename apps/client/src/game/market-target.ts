import type { AreaDef } from '@bale/shared';
import type { PlayerState } from '@bale/sim';

/** The authored market tile directly in front of the player, if this area has one. */
export function facesMarket(player: Readonly<PlayerState>, area: AreaDef | undefined): boolean {
  if (!area?.market || player.area !== area.id) return false;
  const [dx, dz] = HEADINGS[player.facing];
  return (
    Math.floor(player.x + dx) === area.market[0] && Math.floor(player.z + dz) === area.market[1]
  );
}

const HEADINGS = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
} as const;
