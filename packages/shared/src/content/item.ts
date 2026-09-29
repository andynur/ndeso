import { z } from 'zod';
import { contentIdSchema, localeKeySchema, originSchema, uniqueIds } from './common.ts';

const itemBase = z.strictObject({
  id: contentIdSchema,
  nameKey: localeKeySchema,
  descKey: localeKeySchema,
  origin: originSchema,
  buyPrice: z.int().nonnegative().nullable(),
  sellPrice: z.int().nonnegative().nullable(),
  stackSize: z.int().positive(),
});

/** Seeds and produce point at their crop explicitly; ids are presentation, not joins. */
export const itemSchema = z.discriminatedUnion('kind', [
  itemBase.extend({ kind: z.literal('seed'), cropId: contentIdSchema }),
  itemBase.extend({ kind: z.literal('produce'), cropId: contentIdSchema }),
  itemBase.extend({ kind: z.enum(['food', 'material', 'quest']) }),
]);

export const itemsSchema = z.array(itemSchema).superRefine(uniqueIds);

export type ItemDef = z.infer<typeof itemSchema>;
