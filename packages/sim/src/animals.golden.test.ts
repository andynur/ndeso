import { expect, test } from 'bun:test';
import type { AreaDef } from '@bale/shared';
import type { AnimalData, ItemDef } from '@bale/shared/content';
import { createAnimalsState, createAnimalsSystem } from './systems/animals.ts';
import { createContext, type SimEvent } from './types.ts';

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

const item = (id: string, kind: 'feed' | 'animal_product', sellPrice: number | null): ItemDef => ({
  id,
  kind,
  nameKey: `items:item.${id}.name`,
  descKey: `items:item.${id}.desc`,
  origin: 'Central Java, Indonesia',
  buyPrice: null,
  sellPrice,
  stackSize: 99,
});

test('a scripted 14-day chicken care cycle', () => {
  const items = [
    item('dedak', 'feed', null),
    item('telur', 'animal_product', 1200),
    item('telur_bagus', 'animal_product', 1800),
  ];
  const state = {
    ...createAnimalsState(data),
    seed: 0x42414c45,
    clock: { tick: 0, day: 0, minute: 360 },
    player: {
      area: 'bale',
      x: -4.5,
      z: 2.5,
      facing: 'west' as const,
      moveX: 0,
      moveZ: 0,
      inventory: [
        { kind: 'item' as const, id: 'dedak', quantity: 20 },
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
  const system = createAnimalsSystem(
    { id: 'bale', coop: [-6, 2] } as Pick<AreaDef, 'id' | 'coop'>,
    data,
    items,
  );
  const produced: string[] = [];

  const interact = () => system(state, createContext(1, [{ type: 'interact' }]));
  for (let day = 1; day <= 14; day++) {
    state.player.selectedSlot = 1;
    interact();
    state.player.selectedSlot = 0;
    interact();
    state.player.selectedSlot = 1;
    interact();
    const morning = createContext();
    morning.emit({ type: 'dayStarted', day });
    system(state, morning);
    for (const event of morning.events) recordProduct(event, produced);
  }
  state.player.selectedSlot = 1;
  interact();

  expect({
    animal: Object.values(state.animals).find((animal) => animal.id === 'pitik'),
    inventory: state.player.inventory,
    produced,
  }).toMatchSnapshot();
});

function recordProduct(event: SimEvent, produced: string[]): void {
  const fields = event as { readonly itemId?: unknown };
  if (event.type === 'animalProductProduced' && typeof fields.itemId === 'string') {
    produced.push(fields.itemId);
  }
}
