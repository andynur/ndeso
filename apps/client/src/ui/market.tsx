import type { I18nKey } from '@bale/content/i18n';
import type { CalendarData, MarketData, PasaranId } from '@bale/shared';
import type { ItemDef } from '@bale/shared/content';
import { type InventorySlot, marketIsOpen, marketSellPrice, pasaranOf } from '@bale/sim';
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { format, t } from '../i18n/index.ts';

export interface MarketItemView {
  readonly id: string;
  readonly nameKey: string;
  readonly price: number;
  readonly owned: number;
}

export interface MarketView {
  readonly nameKey: string;
  readonly sellerNameKey: string;
  readonly money: number;
  readonly isOpen: boolean;
  readonly openMinute: number;
  readonly closeMinute: number;
  readonly pasaran: PasaranId;
  readonly favorable: boolean;
  readonly seeds: readonly MarketItemView[];
  readonly produce: readonly MarketItemView[];
}

export const marketView = signal<MarketView | null>(null);

export function marketViewOf(
  player: { readonly money: number; readonly inventory: readonly InventorySlot[] },
  clock: { readonly day: number; readonly minute: number },
  seed: number,
  items: readonly ItemDef[],
  cal: CalendarData,
  market: MarketData,
): MarketView {
  const quantities = new Map<string, number>();
  for (const slot of player.inventory) {
    if (slot?.kind === 'item')
      quantities.set(slot.id, (quantities.get(slot.id) ?? 0) + slot.quantity);
  }
  const pasaran = pasaranOf(clock.day, cal);
  return {
    nameKey: market.nameKey,
    sellerNameKey: market.sellerNameKey,
    money: player.money,
    isOpen: marketIsOpen(clock.minute, market),
    openMinute: market.openMinute,
    closeMinute: market.closeMinute,
    pasaran,
    favorable: market.favorablePasaran.includes(pasaran),
    seeds: items
      .filter(
        (item): item is Extract<ItemDef, { kind: 'seed' }> =>
          item.kind === 'seed' && item.buyPrice !== null,
      )
      .map((item) => ({
        id: item.id,
        nameKey: item.nameKey,
        price: item.buyPrice ?? 0,
        owned: quantities.get(item.id) ?? 0,
      })),
    produce: items
      .filter(
        (item): item is Extract<ItemDef, { kind: 'produce' }> =>
          item.kind === 'produce' && item.sellPrice !== null,
      )
      .map((item) => ({
        id: item.id,
        nameKey: item.nameKey,
        price: marketSellPrice(item.sellPrice ?? 0, item.id, seed, clock.day, cal, market),
        owned: quantities.get(item.id) ?? 0,
      })),
  };
}

export interface MarketProps {
  onBuy(itemId: string): void;
  onSell(itemId: string): void;
}

export function Market({ onBuy, onSell }: MarketProps) {
  const [shown, setShown] = useState(false);
  const view = marketView.value;
  if (!view) return null;
  const marketName = t(view.nameKey as I18nKey);
  const sellerName = t(view.sellerNameKey as I18nKey);
  return (
    <>
      <button type="button" class="market-launch" onClick={() => setShown(true)}>
        {t('market.visit', { market: marketName })}
      </button>
      {shown ? (
        <div class="market" role="dialog" aria-modal="true" aria-labelledby="market-title">
          <section class="market__panel">
            <header class="market__header">
              <div>
                <h2 id="market-title">
                  {t('market.title', { seller: sellerName, market: marketName })}
                </h2>
                <p>
                  {t('market.hours', {
                    open: clockLabel(view.openMinute),
                    close: clockLabel(view.closeMinute),
                  })}
                </p>
              </div>
              <button type="button" class="market__close" onClick={() => setShown(false)}>
                {t('common.back')}
              </button>
            </header>
            <div class={`market__status ${view.isOpen ? '' : 'market__status--closed'}`}>
              {view.isOpen
                ? view.favorable
                  ? t('market.status.favorable', { pasaran: t(`pasaran.${view.pasaran}`) })
                  : t('market.status.open')
                : t('market.status.closed')}
            </div>
            <p class="market__money">
              {t('hud.money')}: <strong>{format.value.money(view.money)}</strong>
            </p>
            <MarketList
              title={t('market.buy_seeds')}
              actionKey="market.buy"
              items={view.seeds}
              disabled={(item) => !view.isOpen || view.money < item.price}
              onAction={onBuy}
            />
            <MarketList
              title={t('market.sell_produce')}
              actionKey="market.sell"
              items={view.produce}
              disabled={(item) => !view.isOpen || item.owned < 1}
              onAction={onSell}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}

function MarketList({
  title,
  actionKey,
  items,
  disabled,
  onAction,
}: {
  readonly title: string;
  readonly actionKey: 'market.buy' | 'market.sell';
  readonly items: readonly MarketItemView[];
  readonly disabled: (item: MarketItemView) => boolean;
  readonly onAction: (itemId: string) => void;
}) {
  return (
    <section class="market__section">
      <h3>{title}</h3>
      <ul class="market__list">
        {items.map((item) => {
          const name = t(item.nameKey as I18nKey);
          return (
            <li key={item.id} class="market__item">
              <span>
                <strong>{name}</strong>
                <small>
                  {t('market.item_detail', {
                    price: format.value.money(item.price),
                    owned: format.value.number(item.owned),
                  })}
                </small>
              </span>
              <button type="button" disabled={disabled(item)} onClick={() => onAction(item.id)}>
                {t(actionKey, { item: name, price: format.value.money(item.price) })}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function clockLabel(minute: number): string {
  return format.value.clock(Math.floor(minute / 60) % 24, minute % 60);
}
