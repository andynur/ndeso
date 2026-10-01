import { z } from 'zod';
import { contentIdSchema, localeKeySchema, originSchema, uniqueIds } from './common.ts';

export const animalSpeciesSchema = z
  .strictObject({
    id: contentIdSchema,
    nameKey: localeKeySchema,
    origin: originSchema,
    feedItemId: contentIdSchema,
    productItemId: contentIdSchema,
    goodProductItemId: contentIdSchema,
    maxAffection: z.int().positive(),
    goodProductChancePerAffection: z.number().min(0).max(1),
  })
  .refine((species) => species.maxAffection * species.goodProductChancePerAffection <= 1, {
    message: 'maximum affection must not make the good-product chance exceed 100%',
    path: ['goodProductChancePerAffection'],
  });

export const animalResidentSchema = z.strictObject({
  id: contentIdSchema,
  nameKey: localeKeySchema,
  speciesId: contentIdSchema,
  area: contentIdSchema,
  initialAffection: z.int().nonnegative(),
});

export const animalsFileSchema = z
  .strictObject({
    species: z.array(animalSpeciesSchema).min(1).superRefine(uniqueIds),
    residents: z.array(animalResidentSchema).min(1).superRefine(uniqueIds),
  })
  .superRefine((file, context) => {
    const speciesById = new Map(file.species.map((species) => [species.id, species]));
    for (const [index, resident] of file.residents.entries()) {
      const species = speciesById.get(resident.speciesId);
      if (!species) {
        context.addIssue({
          code: 'custom',
          message: `references missing species '${resident.speciesId}'`,
          path: ['residents', index, 'speciesId'],
          input: resident.speciesId,
        });
      } else if (resident.initialAffection > species.maxAffection) {
        context.addIssue({
          code: 'custom',
          message: `must not exceed ${resident.speciesId}.maxAffection`,
          path: ['residents', index, 'initialAffection'],
          input: resident.initialAffection,
        });
      }
    }
  });

export type AnimalSpeciesDef = z.infer<typeof animalSpeciesSchema>;
export type AnimalResidentDef = z.infer<typeof animalResidentSchema>;
export type AnimalData = z.infer<typeof animalsFileSchema>;
