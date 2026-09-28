import { type CropDef, cropsSchema } from '@bale/shared/content';

const CROPS_FILE = new URL('../../../content/data/crops.json5', import.meta.url);

/** Test-only access to the real content without creating a sim → content dependency. */
export async function loadCropsForTests(): Promise<readonly CropDef[]> {
  return cropsSchema.parse(Bun.JSON5.parse(await Bun.file(CROPS_FILE).text()));
}
