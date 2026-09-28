import { z } from 'zod';
import { contentIdSchema, localeKeySchema, originSchema, uniqueIds } from './common.ts';

export const itemSchema = z.strictObject({
  id: contentIdSchema,
  nameKey: localeKeySchema,
  descKey: localeKeySchema,
  origin: originSchema,
  kind: z.enum(['seed', 'produce', 'food', 'material', 'quest']),
  buyPrice: z.int().nonnegative().nullable(),
  sellPrice: z.int().nonnegative().nullable(),
  stackSize: z.int().positive(),
});

export const itemsSchema = z.array(itemSchema).superRefine(uniqueIds);

export type ItemDef = z.infer<typeof itemSchema>;
