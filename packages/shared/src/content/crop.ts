import { z } from 'zod';
import { MUSIM_IDS } from '../calendar.ts';
import { contentIdSchema, localeKeySchema, originSchema, uniqueIds } from './common.ts';

export const plotTypeSchema = z.enum(['tegalan', 'sawah', 'kebun']);
export const cropMusimSchema = z.enum([...MUSIM_IDS, 'semua']);

export const cropSchema = z.strictObject({
  id: contentIdSchema,
  nameKey: localeKeySchema,
  descKey: localeKeySchema,
  origin: originSchema,
  plot: plotTypeSchema,
  musim: cropMusimSchema,
  growDays: z.int().positive(),
  regrowDays: z.int().positive().nullable(),
  dryDaysToWither: z.int().positive(),
  seedPrice: z.int().nonnegative(),
  sellPrice: z.int().nonnegative(),
  harvestYield: z.int().positive(),
});

export const cropsSchema = z.array(cropSchema).superRefine(uniqueIds);

export type CropDef = z.infer<typeof cropSchema>;
