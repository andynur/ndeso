import { z } from 'zod';
import { contentIdSchema, localeKeySchema, originSchema, uniqueIds } from './common.ts';

export const toolSchema = z.strictObject({
  id: contentIdSchema,
  nameKey: localeKeySchema,
  descKey: localeKeySchema,
  origin: originSchema,
  action: z.enum(['hoe', 'water', 'sickle', 'axe']),
  staminaCost: z.int().min(2).max(6),
});

export const toolsSchema = z.array(toolSchema).superRefine(uniqueIds);

export type ToolDef = z.infer<typeof toolSchema>;
