import type { I18nKey } from '@bale/content/i18n';
import type { ItemDef, ToolDef } from '@bale/shared/content';
import { HOTBAR_SLOTS, type InventorySlot } from '@bale/sim';
import { signal } from '@preact/signals';
import { format, t } from '../i18n/index.ts';

export interface HotbarSlotView {
  readonly id: string;
  readonly kind: 'tool' | 'item';
  readonly nameKey: string;
  readonly quantity?: number;
}

export interface HotbarView {
  readonly selectedSlot: number;
  readonly slots: readonly (HotbarSlotView | null)[];
}

export const hotbarView = signal<HotbarView | null>(null);

export function inventoryViewOf(
  inventory: readonly InventorySlot[],
  selectedSlot: number,
  items: readonly ItemDef[],
  tools: readonly ToolDef[],
): HotbarView {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const toolById = new Map(tools.map((tool) => [tool.id, tool]));
  return {
    selectedSlot,
    slots: inventory.map((slot) => {
      if (slot === null) return null;
      const definition = slot.kind === 'tool' ? toolById.get(slot.id) : itemById.get(slot.id);
      if (!definition) return null;
      const base = {
        id: slot.id,
        kind: slot.kind,
        nameKey: definition.nameKey,
      };
      return slot.kind === 'item' ? { ...base, quantity: slot.quantity } : base;
    }),
  };
}

export interface HotbarProps {
  onSelect(slot: number): void;
}

/** DESIGN §5 ItemSlot row: nine keyboard/touch slots, with the sim selection authoritative. */
export function Hotbar({ onSelect }: HotbarProps) {
  const view = hotbarView.value;
  if (!view) return null;
  return (
    <div class="hotbar" role="toolbar" aria-label={t('controls.hotbar')}>
      {Array.from({ length: HOTBAR_SLOTS }, (_, index) => {
        const slot = view.slots[index] ?? null;
        const name = slot ? t(slot.nameKey as I18nKey) : t('controls.empty_slot');
        return (
          <button
            key={index}
            type="button"
            class="hotbar__slot"
            aria-label={t('controls.select_slot', { slot: index + 1, item: name })}
            aria-pressed={view.selectedSlot === index}
            title={name}
            onClick={() => onSelect(index)}
          >
            <span class="hotbar__number">{index + 1}</span>
            {slot ? (
              <span class={`hotbar__icon hotbar__icon--${slot.kind}`} aria-hidden="true">
                {name.slice(0, 1)}
              </span>
            ) : null}
            {slot?.quantity !== undefined ? (
              <span class="hotbar__quantity">{format.value.number(slot.quantity)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
