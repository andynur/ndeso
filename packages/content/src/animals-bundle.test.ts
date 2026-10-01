import { expect, test } from 'bun:test';
import { ANIMAL_DATA } from './animals-bundle.ts';

test('ships one ayam kampung resident for the vertical slice', () => {
  expect(ANIMAL_DATA.species.map((species) => species.id)).toEqual(['ayam_kampung']);
  expect(ANIMAL_DATA.residents).toEqual([
    expect.objectContaining({ id: 'pitik', speciesId: 'ayam_kampung', area: 'bale' }),
  ]);
});
