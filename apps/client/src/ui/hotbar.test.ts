import { expect, test } from 'bun:test';
import { ITEM_DATA, TOOL_DATA } from '@bale/content/inventory';
import type { InventorySlot } from '@bale/sim';
import { inventoryViewOf } from './hotbar.tsx';

test('projects sim slots through content without inventing UI-owned inventory state', () => {
  const slots: InventorySlot[] = [
    { kind: 'tool', id: 'hoe' },
    { kind: 'item', id: 'cabai_seed', quantity: 6 },
    null,
  ];
  const view = inventoryViewOf(slots, 1, ITEM_DATA, TOOL_DATA);
  expect(view).toEqual({
    selectedSlot: 1,
    slots: [
      { id: 'hoe', kind: 'tool', nameKey: 'items:tool.hoe.name' },
      { id: 'cabai_seed', kind: 'item', nameKey: 'items:item.cabai_seed.name', quantity: 6 },
      null,
    ],
  });
});
