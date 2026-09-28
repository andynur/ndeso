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
});
