import { z } from 'zod';
import { MUSIM_IDS, WEEKDAY_IDS } from '../calendar.ts';
import { clockTimeSchema, contentIdSchema, localeKeySchema, originSchema } from './common.ts';

export const weatherIdSchema = z.enum(['clear', 'cloudy', 'rain', 'storm']);

export const scheduleEntrySchema = z.strictObject({
  time: clockTimeSchema,
  area: contentIdSchema,
  x: z.number().finite(),
  z: z.number().finite(),
  anim: contentIdSchema,
});

export const scheduleRuleSchema = z
  .strictObject({
    days: z.array(z.enum(WEEKDAY_IDS)).min(1).optional(),
    weather: z.array(weatherIdSchema).min(1).optional(),
    musim: z.array(z.enum(MUSIM_IDS)).min(1).optional(),
    entries: z.array(scheduleEntrySchema).min(1),
  })
  .superRefine((rule, context) => {
    for (let index = 1; index < rule.entries.length; index++) {
      const previous = rule.entries[index - 1];
      const current = rule.entries[index];
      if (previous !== undefined && current !== undefined && current.time <= previous.time) {
        context.addIssue({
          code: 'custom',
          message: 'entries must be strictly increasing by time',
          path: ['entries', index, 'time'],
          input: current.time,
        });
      }
    }
  });

export const npcSchema = z.strictObject({
  id: contentIdSchema,
  nameKey: localeKeySchema,
  titleKey: localeKeySchema,
  bioKey: localeKeySchema,
  origin: originSchema,
  schedules: z.array(scheduleRuleSchema).min(1),
});

export type NpcDef = z.infer<typeof npcSchema>;
