/// <reference path="./json5.d.ts" />
import { type FarmAreaDef, isFarmArea } from '@bale/shared';
import raw from '../data/areas/bale.json5';
import { parseArea } from './area-parse.ts';

const area = parseArea(raw, 'areas/bale.json5');
if (!isFarmArea(area)) throw new Error('areas/bale.json5 must define the Balé farm features');
export const BALE_AREA: FarmAreaDef = area;
