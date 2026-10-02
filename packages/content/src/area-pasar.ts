/// <reference path="./json5.d.ts" />
import type { AreaDef } from '@bale/shared';
import raw from '../data/areas/pasar.json5';
import { parseArea } from './area-parse.ts';

export const PASAR_AREA: AreaDef = parseArea(raw, 'areas/pasar.json5');
