import { describe, expect, test } from 'bun:test';
import { validateContentSet } from './validate.ts';

const crop = {
  id: 'cabai',
  nameKey: 'items:crop.cabai.name',
  descKey: 'items:crop.cabai.desc',
  origin: 'Baledono, Purworejo, Jawa Tengah',
  plot: 'tegalan',
  musim: 'kemarau',
  growDays: 8,
  regrowDays: 3,
  dryDaysToWither: 3,
  seedPrice: 800,
  sellPrice: 700,
  harvestYield: 3,
};

describe('validateContentSet', () => {
  test('checks locale references across files', () => {
    const files = new Map<string, unknown>([['crops.json5', [crop]]]);
    const problems = validateContentSet(files, new Set());
    const messages = problems.map((problem) => problem.message).join('\n');
    expect(messages).toContain("references missing 'items:crop.cabai.name'");
  });

  test('rejects content files that are not covered by a schema', () => {
    const problems = validateContentSet(new Map([['mystery.json5', {}]]), new Set());
    expect(problems).toContainEqual({
      file: 'mystery.json5',
      message: 'no content schema registered for this file',
    });
  });

  test('rejects duplicate NPC ids across files', () => {
    const npc = {
      id: 'mbah_hita',
      nameKey: 'npcs:mbah_hita.name',
      titleKey: 'npcs:mbah_hita.title',
      bioKey: 'npcs:mbah_hita.bio',
      origin: 'Baledono, Purworejo, Jawa Tengah',
      schedules: [{ entries: [{ time: '08:00', area: 'bale', x: 0, z: 0, anim: 'idle' }] }],
    };
    const files = new Map<string, unknown>([
      ['npcs/a.json5', npc],
      ['npcs/b.json5', npc],
    ]);
    const problems = validateContentSet(files, new Set());
    expect(problems.some((problem) => problem.message === "duplicate NPC id 'mbah_hita'")).toBe(
      true,
    );
  });

  test('cross-checks inventory crop links, prices, and the starting loadout', () => {
    const files = new Map<string, unknown>([
      ['crops.json5', [crop]],
      [
        'items.json5',
        [
          {
            id: 'cabai_seed',
            nameKey: 'items:item.cabai_seed.name',
            descKey: 'items:item.cabai_seed.desc',
            origin: crop.origin,
            kind: 'seed',
            cropId: 'cabai',
            buyPrice: 999,
            sellPrice: null,
            stackSize: 99,
          },
        ],
      ],
      ['tools.json5', []],
      ['player.json5', { speed: 4, radius: 0.3, inventory: [{ kind: 'tool', id: 'hoe' }] }],
    ]);
    const messages = validateContentSet(files, new Set()).map((problem) => problem.message);
    expect(messages).toContain("cabai_seed.buyPrice must match crop 'cabai' seedPrice");
    expect(messages).toContain("crop 'cabai' has no produce item");
    expect(messages).toContain("inventory.0.id references missing tool 'hoe'");
  });
});
