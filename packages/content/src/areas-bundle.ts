/// <reference path="./json5.d.ts" />
import { type AreaDef, validateArea } from '@bale/shared';
import bale from '../data/areas/bale.json5';

/**
 * Area layouts for the browser (PLACES §3), inlined by the bundler and validated once at
 * import. Only the base exists until area streaming (M2-13).
 */
function load(raw: unknown, file: string): AreaDef {
  const result = validateArea(raw, file);
  if (!result.ok) throw new Error(`invalid area data:\n  ${result.errors.join('\n  ')}`);
  return result.data;
}

export const BALE_AREA: AreaDef = load(bale, 'areas/bale.json5');
