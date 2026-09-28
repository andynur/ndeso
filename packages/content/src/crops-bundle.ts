/// <reference path="./json5.d.ts" />
import type { CropDef } from '@bale/shared/content';
import crops from '../data/crops.json5';

/**
 * Browser crop data. `check:content` validates the source with the Zod schema; this module
 * deliberately does not import that schema and its runtime into the client bundle.
 */
export const CROP_DATA = crops as readonly CropDef[];
