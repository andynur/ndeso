import { describe, expect, test } from 'bun:test';
import type { AreaDef } from '@bale/shared';
import type { AnimalData, ItemDef } from '@bale/shared/content';
import { createContext } from '../types.ts';
import { createAnimalsState, createAnimalsSystem } from './animals.ts';

const data: AnimalData = {
  species: [
    {
      id: 'ayam_kampung',
      nameKey: 'items:animal.ayam_kampung.name',
      origin: 'Central Java, Indonesia',
      feedItemId: 'dedak',
      productItemId: 'telur',
      goodProductItemId: 'telur_bagus',
      maxAffection: 5,
      goodProductChancePerAffection: 0.1,
    },
  ],
  residents: [
    {
      id: 'pitik',
      nameKey: 'items:animal.pitik.name',
      speciesId: 'ayam_kampung',
      area: 'bale',
      initialAffection: 1,
    },
  ],
};

const items = [
  {
    id: 'dedak',
    kind: 'feed',
    nameKey: 'items:item.dedak.name',
    descKey: 'items:item.dedak.desc',
    origin: 'Central Java, Indonesia',
    buyPrice: null,
    sellPrice: null,
    stackSize: 99,
  },
  {
    id: 'telur',
    kind: 'animal_product',
    nameKey: 'items:item.telur.name',
    descKey: 'items:item.telur.desc',
    origin: 'Central Java, Indonesia',
    buyPrice: null,
    sellPrice: 1200,
    stackSize: 99,
  },
  {
    id: 'telur_bagus',
    kind: 'animal_product',
    nameKey: 'items:item.telur_bagus.name',
    descKey: 'items:item.telur_bagus.desc',
    origin: 'Central Java, Indonesia',
    buyPrice: null,
    sellPrice: 1800,
    stackSize: 99,
  },
] satisfies ItemDef[];

const area = { id: 'bale', coop: [-6, 2] } as Required<Pick<AreaDef, 'id' | 'coop'>>;

function state() {
  return {
    ...createAnimalsState(data),
    seed: 123,
    clock: { tick: 0, day: 0, minute: 360 },
    player: {
      area: 'bale',
      x: -4.5,
      z: 2.5,
      facing: 'west' as const,
      moveX: 0,
      moveZ: 0,
      inventory: [
        { kind: 'item' as const, id: 'dedak', quantity: 2 },
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      selectedSlot: 0,
    },
  };
}

describe('animals system', () => {
  test('feeds and pets once, then produces a seeded egg on the next day', () => {
    const current = state();
    const system = createAnimalsSystem(area, data, items);
    const chicken = Object.values(current.animals).find((animal) => animal.id === 'pitik');
    if (!chicken) throw new Error('missing test chicken');
    const feed = createContext(1, [{ type: 'interact' }]);
    system(current, feed);
    expect(chicken).toMatchObject({ fed: true, affection: 1 });
    expect(current.player.inventory[0]).toMatchObject({ quantity: 1 });

    current.player.selectedSlot = 1;
    const pet = createContext(1, [{ type: 'interact' }]);
    system(current, pet);
    expect(chicken).toMatchObject({ petted: true, affection: 2 });
    system(current, createContext(1, [{ type: 'interact' }]));
    expect(chicken.affection).toBe(2);

    const morning = createContext();
    morning.emit({ type: 'dayStarted', day: 1 });
    system(current, morning);
    expect(Object.values(chicken.products)).toEqual([1]);
    expect(chicken).toMatchObject({ fed: false, petted: false, affection: 2 });
  });

  test('collects products before care and keeps overflow in the coop', () => {
    const current = state();
    const system = createAnimalsSystem(area, data, items);
    const chicken = Object.values(current.animals).find((animal) => animal.id === 'pitik');
    if (!chicken) throw new Error('missing test chicken');
    chicken.products = { telur: 3 };
    current.player.inventory = current.player.inventory.map(() => ({
      kind: 'item' as const,
      id: 'telur',
      quantity: 99,
    }));
    current.player.inventory[8] = { kind: 'item', id: 'telur', quantity: 98 };
    const ctx = createContext(1, [{ type: 'interact' }]);
    system(current, ctx);
    expect(current.player.inventory[8]).toMatchObject({ quantity: 99 });
    expect(chicken.products).toEqual({ telur: 2 });
    expect(ctx.events).toContainEqual({ type: 'inventoryFull', itemId: 'telur', quantity: 2 });
  });

  test('neglect lowers affection but never kills or removes the chicken', () => {
    const current = state();
    const chicken = Object.values(current.animals).find((animal) => animal.id === 'pitik');
    if (!chicken) throw new Error('missing test chicken');
    chicken.affection = 1;
    const system = createAnimalsSystem(area, data, items);
    for (let day = 1; day <= 3; day++) {
      const ctx = createContext();
      ctx.emit({ type: 'dayStarted', day });
      system(current, ctx);
    }
    expect(chicken).toMatchObject({ id: 'pitik', affection: 0, products: {} });

    chicken.fed = true;
    const morning = createContext();
    morning.emit({ type: 'dayStarted', day: 4 });
    system(current, morning);
    expect(chicken.products).toEqual({});
  });
});
