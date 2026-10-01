import type { I18nKey } from '@bale/content/i18n';
import type { AnimalResidentDef, AnimalSpeciesDef } from '@bale/shared/content';
import type { AnimalState } from '@bale/sim';
import { signal } from '@preact/signals';
import { format, t } from '../i18n/index.ts';

export interface AnimalStatusView {
  readonly nameKey: string;
  readonly affection: number;
  readonly maxAffection: number;
  readonly fed: boolean;
  readonly products: number;
}

export const animalStatusView = signal<AnimalStatusView>({
  nameKey: 'items:animal.pitik.name',
  affection: 0,
  maxAffection: 5,
  fed: false,
  products: 0,
});

export function animalStatusViewOf(
  animal: AnimalState,
  resident: AnimalResidentDef,
  species: AnimalSpeciesDef,
): AnimalStatusView {
  return {
    nameKey: resident.nameKey,
    affection: animal.affection,
    maxAffection: species.maxAffection,
    fed: animal.fed,
    products: Object.values(animal.products).reduce((total, count) => total + count, 0),
  };
}

/** Read-only projection of the sim-owned chicken care state. */
export function AnimalStatus() {
  const view = animalStatusView.value;
  return (
    <section class="animal-status" aria-label={t(view.nameKey as I18nKey)}>
      <strong>{t(view.nameKey as I18nKey)}</strong>
      <span>
        {t('animal.affection', {
          current: format.value.number(view.affection),
          max: format.value.number(view.maxAffection),
        })}
      </span>
      <span>{t(view.fed ? 'animal.fed' : 'animal.hungry')}</span>
      {view.products > 0 ? (
        <span>{t('animal.products', { count: format.value.number(view.products) })}</span>
      ) : null}
    </section>
  );
}
