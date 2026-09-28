import { type AreaDef, type PlayerData, validateArea, validatePlayer } from '@bale/shared';

/**
 * Test-only: the real area files, read by path and validated, for the same reason as
 * `calendar-data.ts` — `packages/sim` may not import `@bale/content` at runtime.
 */
const DATA_DIR = new URL('../../../content/data/', import.meta.url);
const AREA_DIR = new URL('areas/', DATA_DIR);

export async function loadAreaForTests(id: string): Promise<AreaDef> {
  const file = `${id}.json5`;
  const raw: unknown = Bun.JSON5.parse(await Bun.file(new URL(file, AREA_DIR)).text());
  const result = validateArea(raw, file);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.data;
}

export async function loadPlayerForTests(): Promise<PlayerData> {
  const raw: unknown = Bun.JSON5.parse(await Bun.file(new URL('player.json5', DATA_DIR)).text());
  const result = validatePlayer(raw);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.data;
}
