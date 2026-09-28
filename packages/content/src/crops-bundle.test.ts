import { expect, test } from 'bun:test';
import { cropsSchema } from '@bale/shared/content';
import { CROP_DATA } from './crops-bundle.ts';

test('bundles the three vertical-slice crops', () => {
  expect(cropsSchema.parse(CROP_DATA).map((crop) => crop.id)).toEqual([
    'padi',
    'cabai',
    'singkong',
  ]);
});
