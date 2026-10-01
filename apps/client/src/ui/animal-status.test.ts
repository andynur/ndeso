import { expect, test } from 'bun:test';
import { ANIMAL_DATA } from '@bale/content/animals';
import type { AnimalState } from '@bale/sim';
import { animalStatusViewOf } from './animal-status.tsx';

test('projects sim-owned care and pending products without a second UI model', () => {
  const resident = ANIMAL_DATA.residents[0];
  const species = ANIMAL_DATA.species[0];
  if (!resident || !species) throw new Error('missing chicken content');
  const animal: AnimalState = {
    id: resident.id,
    speciesId: species.id,
    area: resident.area,
    affection: 3,
    fed: true,
    petted: false,
    products: { telur: 2, telur_bagus: 1 },
  };
  expect(animalStatusViewOf(animal, resident, species)).toEqual({
    nameKey: 'items:animal.pitik.name',
    affection: 3,
    maxAffection: 5,
    fed: true,
    products: 3,
  });
});
