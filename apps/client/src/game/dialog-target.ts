import type { DialogNpcId } from '@bale/content/dialog';
import type { MovementState, NpcActorState } from '@bale/sim';

/** The three authored scripts are selected by the same wall-clock bands in every locale. */
export function dialogScriptAt(minute: number): 'morning' | 'day' | 'evening' {
  const wallMinute = minute % 1440;
  if (wallMinute < 11 * 60) return 'morning';
  if (wallMinute < 16 * 60) return 'day';
  return 'evening';
}

/** GDD §12 auto-target: talk to an active NPC occupying the tile in front of the player. */
export function npcInFront(
  player: MovementState['player'],
  npcs: readonly NpcActorState[],
): (NpcActorState & { readonly id: DialogNpcId }) | undefined {
  const targetX =
    Math.floor(player.x) + (player.facing === 'east' ? 1 : player.facing === 'west' ? -1 : 0);
  const targetZ =
    Math.floor(player.z) + (player.facing === 'south' ? 1 : player.facing === 'north' ? -1 : 0);
  return npcs.find(
    (npc) =>
      npc.active &&
      npc.area === player.area &&
      Math.floor(npc.x) === targetX &&
      Math.floor(npc.z) === targetZ &&
      isDialogNpc(npc.id),
  ) as (NpcActorState & { readonly id: DialogNpcId }) | undefined;
}

function isDialogNpc(id: string): id is DialogNpcId {
  return id === 'mbah_hita' || id === 'pak_harjo' || id === 'bu_ratna';
}
