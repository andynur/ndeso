/**
 * Locale-aware number formatting (I18N §1 rule 4: never concatenate, always go through
 * `format.*`). Date and clock formatting that needs translated strings lives in
 * `runtime.ts`, next to `t()`.
 */

import { type LocaleId, localeInfo } from '@ndeso/shared';

export interface NumberFormats {
  /** IDR with no decimals: `Rp12.500` in `id`, `Rp12,500` in `en` (I18N §7). */
  money(value: number): string;
  number(value: number): string;
  /** In-game 24 h clock, e.g. `06:00` — the same shape in both locales (I18N §7). */
  clock(hour: number, minute: number): string;
}

export function createNumberFormats(locale: LocaleId): NumberFormats {
  const tag = localeInfo(locale).tag;
  const money = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'IDR',
    // Without narrowSymbol an `en` locale renders IDR as "IDR12,500" (I18N §7 wants "Rp").
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  });
  const plain = new Intl.NumberFormat(tag);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return {
    // Intl renders IDR as "Rp 12.500" in some ICU versions; the house style has no gap.
    money: (value) => money.format(value).replace(/ /g, ''),
    number: (value) => plain.format(value),
    clock: (hour, minute) => `${pad(hour)}:${pad(minute)}`,
  };
}
