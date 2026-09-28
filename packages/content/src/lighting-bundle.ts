/// <reference path="./json5.d.ts" />
import { type LightingData, validateLighting } from '@bale/shared';
import lighting from '../data/lighting.json5';

/**
 * The day/night keyframes for the browser (DESIGN §1.3), inlined by the bundler like the
 * calendar. Validated once at import, so a broken file fails the boot loudly.
 */
function load(): LightingData {
  const result = validateLighting(lighting);
  if (!result.ok) throw new Error(`invalid lighting data:\n  ${result.errors.join('\n  ')}`);
  return result.data;
}

export const LIGHTING_DATA: LightingData = load();
