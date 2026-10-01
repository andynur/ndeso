import { expect, test } from 'bun:test';
import { NPC_DATA } from './npcs-bundle.ts';

test('ships the three vertical-slice NPCs with visits to the authored area', () => {
  expect(NPC_DATA.map((npc) => npc.id)).toEqual(['mbah_hita', 'pak_harjo', 'bu_ratna']);
  expect(
    NPC_DATA.every((npc) =>
      npc.schedules.every((rule) => rule.entries.every((entry) => entry.area === 'bale')),
    ),
  ).toBe(true);
});
