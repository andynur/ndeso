import type { PasaranId } from './calendar.ts';

export interface MarketData {
  readonly id: string;
  readonly nameKey: string;
  readonly sellerNameKey: string;
  readonly openMinute: number;
  readonly closeMinute: number;
  readonly favorablePasaran: readonly PasaranId[];
  readonly regularSellPercent: readonly [number, number];
  readonly favorableSellPercent: readonly [number, number];
}
