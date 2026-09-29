import { describe, expect, test } from 'bun:test';
import type { CropDef } from '@bale/shared/content';
import type { FarmTile, SimEvent } from '@bale/sim';
import { CropView, cropViewNeedsSync, cropVisualStage } from './crop-view.ts';
import {
  buildPlaceholderCropAtlas,
  CROP_FRAME_SIZE,
  cropTag,
  WITHERED_STAGE,
} from './placeholder-crop-atlas.ts';

const CROPS: readonly CropDef[] = [
  {
    id: 'cabai',
    nameKey: 'items:crop.cabai.name',
    descKey: 'items:crop.cabai.desc',
    origin: 'Central Java, Indonesia',
    plot: 'tegalan',
    musim: 'kemarau',
    growDays: 8,
    regrowDays: 3,
    dryDaysToWither: 3,
    seedPrice: 800,
    sellPrice: 700,
    harvestYield: 3,
  },
];

const CROP_PALETTE = {
  leaf: 0x5e9e3a,
  leafDark: 0x3d6b25,
  ripe: 0xf2b632,
  fruit: 0xd23c3c,
  earth: 0x8a5a36,
  withered: 0x6b5b4e,
};

function tile(partial: Partial<FarmTile>): FarmTile {
  return {
    area: 'bale',
    x: 7,
    z: -6,
    plot: 'tegalan',
    watered: false,
    phase: 'untilled',
    ...partial,
  } as FarmTile;
}

describe('crop stage projection', () => {
  const crop = CROPS[0] as CropDef;

  test('maps productive days across three growing stages and reserves stage 3 for mature', () => {
    expect(
      cropVisualStage(tile({ phase: 'seeded', cropId: 'cabai', growthDays: 0, dryDays: 0 }), crop),
    ).toBe(0);
    expect(
      cropVisualStage(tile({ phase: 'seeded', cropId: 'cabai', growthDays: 3, dryDays: 0 }), crop),
    ).toBe(1);
    expect(
      cropVisualStage(tile({ phase: 'seeded', cropId: 'cabai', growthDays: 6, dryDays: 0 }), crop),
    ).toBe(2);
    expect(
      cropVisualStage(tile({ phase: 'mature', cropId: 'cabai', growthDays: 8, dryDays: 0 }), crop),
    ).toBe(3);
  });

  test('uses a distinct withered stage and hides empty soil', () => {
    expect(
      cropVisualStage(
        tile({ phase: 'withered', cropId: 'cabai', growthDays: 2, dryDays: 3 }),
        crop,
      ),
    ).toBe(WITHERED_STAGE);
    expect(cropVisualStage(tile({ phase: 'tilled' }), crop)).toBeUndefined();
  });
});

describe('placeholder crop atlas', () => {
  test('has one static 32 px tag for every growth stage and withered art', () => {
    const { atlas, pixels } = buildPlaceholderCropAtlas(CROPS, CROP_PALETTE);
    expect(atlas.frames).toHaveLength(5);
    for (const stage of [0, 1, 2, 3, WITHERED_STAGE] as const) {
      const tag = atlas.tags[cropTag('cabai', stage)];
      expect(tag?.from).toBe(tag?.to);
      expect(atlas.frames[tag?.from ?? -1]).toMatchObject({
        w: CROP_FRAME_SIZE,
        h: CROP_FRAME_SIZE,
      });
    }
    expect(pixels.some((channel) => channel !== 0)).toBe(true);
  });
});

describe('CropView', () => {
  test('packs crops by stage and watered prepared tiles into instanced meshes', () => {
    const view = new CropView({
      areaId: 'bale',
      crops: CROPS,
      capacity: 6,
      cropPalette: CROP_PALETTE,
      soilPalette: { earth: CROP_PALETTE.earth, water: 0x6fa8c9 },
    });
    view.sync({
      a: tile({ phase: 'seeded', cropId: 'cabai', growthDays: 0, dryDays: 0, watered: true }),
      b: tile({ x: 8, phase: 'seeded', cropId: 'cabai', growthDays: 6, dryDays: 0 }),
      c: tile({ x: 9, phase: 'mature', cropId: 'cabai', growthDays: 8, dryDays: 0 }),
      d: tile({ x: 10, phase: 'withered', cropId: 'cabai', growthDays: 3, dryDays: 3 }),
      e: tile({ x: 11, phase: 'tilled', watered: true }),
      f: tile({ x: 12, phase: 'untilled', watered: true }),
      other: tile({
        area: 'pasar',
        x: 1,
        phase: 'mature',
        cropId: 'cabai',
        growthDays: 8,
        dryDays: 0,
        watered: true,
      }),
    });
    expect(view.instanceCount('cabai', 0)).toBe(1);
    expect(view.instanceCount('cabai', 1)).toBe(0);
    expect(view.instanceCount('cabai', 2)).toBe(1);
    expect(view.instanceCount('cabai', 3)).toBe(1);
    expect(view.instanceCount('cabai', WITHERED_STAGE)).toBe(1);
    expect(view.wateredSoil.count).toBe(2);

    view.sync({});
    expect(view.instanceCount('cabai', 0)).toBe(0);
    expect(view.wateredSoil.count).toBe(0);
    view.dispose();
  });
});

describe('crop view event gate', () => {
  test('refreshes on farm actions and day changes, not unrelated clock ticks', () => {
    const event = (type: string): SimEvent => ({ type });
    for (const type of ['dayStarted', 'tileHoed', 'tileWatered', 'cropPlanted', 'cropHarvested']) {
      expect(cropViewNeedsSync([event(type)])).toBe(true);
    }
    expect(cropViewNeedsSync([event('minuteChanged'), event('playerMoved')])).toBe(false);
  });
});
