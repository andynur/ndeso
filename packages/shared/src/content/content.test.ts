import { describe, expect, test } from 'bun:test';
import { cropsSchema, itemsSchema, monthsFileSchema, npcSchema, toolsSchema } from './index.ts';

const localeFields = {
  nameKey: 'items:crop.cabai.name',
  descKey: 'items:crop.cabai.desc',
};

describe('content schemas', () => {
  test('accepts linked crop, item, and tool definitions', () => {
    expect(
      itemsSchema.safeParse([
        {
          id: 'cabai_seed',
          ...localeFields,
          origin: 'Baledono, Purworejo, Jawa Tengah',
          kind: 'seed',
          cropId: 'cabai',
          buyPrice: 800,
          sellPrice: null,
          stackSize: 99,
        },
      ]).success,
    ).toBe(true);
    expect(
      cropsSchema.safeParse([
        {
          id: 'cabai',
          ...localeFields,
          origin: 'Baledono, Purworejo, Jawa Tengah',
          plot: 'tegalan',
          musim: 'kemarau',
          growDays: 8,
          regrowDays: 3,
          dryDaysToWither: 3,
          seedPrice: 800,
          sellPrice: 700,
          harvestYield: 3,
        },
      ]).success,
    ).toBe(true);
    expect(
      toolsSchema.safeParse([
        {
          id: 'hoe',
          ...localeFields,
          origin: 'Baledono, Purworejo, Jawa Tengah',
          action: 'hoe',
          staminaCost: 4,
        },
      ]).success,
    ).toBe(true);
    expect(
      ['sickle', 'axe'].every(
        (action) =>
          toolsSchema.safeParse([
            {
              id: action,
              ...localeFields,
              origin: 'Baledono, Purworejo, Jawa Tengah',
              action,
              staminaCost: 4,
            },
          ]).success,
      ),
    ).toBe(true);
  });

  test('rejects duplicate ids and invalid balance bounds', () => {
    const tool = {
      id: 'hoe',
      ...localeFields,
      origin: 'Baledono, Purworejo, Jawa Tengah',
      action: 'hoe',
      staminaCost: 7,
    };
    const result = toolsSchema.safeParse([tool, tool]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("duplicate id 'hoe'");
      expect(result.error.issues.some((issue) => issue.path.at(-1) === 'staminaCost')).toBe(true);
    }
  });

  test('keeps all calendar year and month-order invariants', () => {
    const months = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ].map((id) => ({ id, musim: 'kemarau' }));
    expect(monthsFileSchema.safeParse({ gameYearDays: 120, months }).success).toBe(true);

    const bad = monthsFileSchema.safeParse({
      gameYearDays: 132,
      months: [...months].reverse(),
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const messages = bad.error.issues.map((issue) => issue.message).join('\n');
      expect(messages).toContain('multiple of 5');
      expect(messages).toContain('in order');
    }
  });

  test('rejects an NPC schedule whose entries run backwards', () => {
    const result = npcSchema.safeParse({
      id: 'mbah_hita',
      nameKey: 'npcs:mbah_hita.name',
      titleKey: 'npcs:mbah_hita.title',
      bioKey: 'npcs:mbah_hita.bio',
      origin: 'Baledono, Purworejo, Jawa Tengah',
      schedules: [
        {
          entries: [
            { time: '12:00', area: 'bale', x: 0, z: 0, anim: 'idle' },
            { time: '08:00', area: 'bale', x: 1, z: 1, anim: 'walk' },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        'entries must be strictly increasing by time',
      );
    }
  });
});
