/// <reference path="./json5.d.ts" />
import type { MarketData } from '@bale/shared';
import { parseClockTime } from '@bale/shared';
import rawMarket from '../data/market.json5';

type RawMarket = Omit<MarketData, 'openMinute' | 'closeMinute'> & {
  readonly open: string;
  readonly close: string;
};
const market = rawMarket as RawMarket;

const openMinute = parseClockTime(market.open);
const closeMinute = parseClockTime(market.close);
if (openMinute === undefined || closeMinute === undefined) {
  throw new Error('market.json5 has an invalid opening time');
}

/** Browser market data, source-validated by `check:content` without bundling Zod. */
export const MARKET_DATA: MarketData = {
  id: market.id,
  nameKey: market.nameKey,
  sellerNameKey: market.sellerNameKey,
  favorablePasaran: market.favorablePasaran,
  regularSellPercent: market.regularSellPercent,
  favorableSellPercent: market.favorableSellPercent,
  openMinute,
  closeMinute,
};
