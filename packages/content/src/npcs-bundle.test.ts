import { expect, test } from 'bun:test';
import { NPC_DATA } from './npcs-bundle.ts';

test('ships the three vertical-slice NPCs across Balé and Pasar', () => {
  expect(NPC_DATA.map((npc) => npc.id)).toEqual(['mbah_hita', 'pak_harjo', 'bu_ratna']);
  const areaIds = new Set(
    NPC_DATA.flatMap((npc) =>
      npc.schedules.flatMap((rule) => rule.entries.map((entry) => entry.area)),
    ),
  );
  expect(areaIds).toEqual(new Set(['bale', 'pasar']));
  expect(NPC_DATA.find((npc) => npc.id === 'bu_ratna')?.schedules[0]?.entries[0]).toMatchObject({
    time: '04:30',
    area: 'pasar',
  });
});
