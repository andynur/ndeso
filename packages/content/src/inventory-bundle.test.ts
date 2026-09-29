import { expect, test } from 'bun:test';
import { ITEM_DATA, TOOL_DATA } from './inventory-bundle.ts';

test('ships the vertical-slice tools, seeds, and one product per crop', () => {
  expect(TOOL_DATA.map((tool) => tool.id)).toEqual(['hoe', 'watering_can']);
  expect(ITEM_DATA.filter((item) => item.kind === 'seed')).toHaveLength(3);
  expect(ITEM_DATA.filter((item) => item.kind === 'produce')).toHaveLength(3);
});
