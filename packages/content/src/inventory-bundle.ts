/// <reference path="./json5.d.ts" />
import type { ItemDef, ToolDef } from '@bale/shared/content';
import items from '../data/items.json5';
import tools from '../data/tools.json5';

/** Browser inventory data, source-validated by `check:content` without bundling Zod. */
export const ITEM_DATA = items as readonly ItemDef[];
export const TOOL_DATA = tools as readonly ToolDef[];
