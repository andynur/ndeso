import { expect, test } from 'bun:test';
import { MARKET_DATA } from './market-bundle.ts';

test('ships Bu Ratna morning trade and the authored pasaran price bands', () => {
  expect(MARKET_DATA).toMatchObject({
    id: 'pasar_baledono',
    openMinute: 270,
    closeMinute: 690,
    favorablePasaran: ['legi', 'kliwon'],
    regularSellPercent: [85, 115],
    favorableSellPercent: [110, 140],
  });
});
