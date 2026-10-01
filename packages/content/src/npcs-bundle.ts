/// <reference path="./json5.d.ts" />
import { parseClockTime } from '@bale/shared';
import type { NpcDef } from '@bale/shared/content';
import buRatna from '../data/npcs/bu_ratna.json5';
import mbahHita from '../data/npcs/mbah_hita.json5';
import pakHarjo from '../data/npcs/pak_harjo.json5';

const definitions = [mbahHita, pakHarjo, buRatna] as readonly NpcDef[];
for (const npc of definitions) {
  for (const rule of npc.schedules) {
    for (const entry of rule.entries) {
      if (parseClockTime(entry.time) === undefined) {
        throw new Error(`${npc.id} has an invalid schedule time '${entry.time}'`);
      }
    }
  }
}

/** Browser-ready NPC schedules, source-validated by `check:content` without bundling Zod. */
export const NPC_DATA: readonly NpcDef[] = definitions;
