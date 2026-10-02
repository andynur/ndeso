import type { AreaDef, FarmAreaDef } from '@bale/shared';

export type AreaId = 'bale' | 'pasar';

/** Each branch stays a separate browser chunk; no area data enters the core shell. */
export async function loadArea(id: 'bale'): Promise<FarmAreaDef>;
export async function loadArea(id: AreaId): Promise<AreaDef>;
export async function loadArea(id: AreaId): Promise<AreaDef> {
  if (id === 'bale') return (await import('./area-bale.ts')).BALE_AREA;
  return (await import('./area-pasar.ts')).PASAR_AREA;
}

export async function loadAreas(): Promise<readonly [FarmAreaDef, AreaDef]> {
  return Promise.all([loadArea('bale'), loadArea('pasar')]);
}
