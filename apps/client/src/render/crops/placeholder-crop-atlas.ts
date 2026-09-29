import type { CropDef } from '@bale/shared/content';
import type { AtlasFrame, AtlasTag, SpriteAtlas } from '../sprites/atlas.ts';

/** DESIGN §1.2: one 32 px frame per world-space crop tile. */
export const CROP_FRAME_SIZE = 32;
export const CROP_GROWTH_STAGES = 4;
export const WITHERED_STAGE = 'withered';

export type CropVisualStage = 0 | 1 | 2 | 3 | typeof WITHERED_STAGE;

export interface CropPalette {
  readonly leaf: number;
  readonly leafDark: number;
  readonly ripe: number;
  readonly fruit: number;
  readonly earth: number;
  readonly withered: number;
}

/** Procedural placeholder art; final licensed sheets replace it without changing tags. */
export function buildPlaceholderCropAtlas(
  crops: readonly CropDef[],
  palette: CropPalette,
): { readonly atlas: SpriteAtlas; readonly pixels: Uint8Array } {
  const stagesPerCrop = CROP_GROWTH_STAGES + 1;
  const width = CROP_FRAME_SIZE * stagesPerCrop;
  const height = CROP_FRAME_SIZE * crops.length;
  const pixels = new Uint8Array(width * height * 4);
  const frames: AtlasFrame[] = [];
  const tags: Record<string, AtlasTag> = {};

  for (let row = 0; row < crops.length; row++) {
    const crop = crops[row] as CropDef;
    for (let column = 0; column < stagesPerCrop; column++) {
      const stage: CropVisualStage =
        column < CROP_GROWTH_STAGES ? (column as 0 | 1 | 2 | 3) : WITHERED_STAGE;
      const frame = frames.length;
      const canvas = new CropCanvas(pixels, width, column * CROP_FRAME_SIZE, row * CROP_FRAME_SIZE);
      drawCrop(canvas, crop.id, stage, palette);
      frames.push({
        x: column * CROP_FRAME_SIZE,
        y: row * CROP_FRAME_SIZE,
        w: CROP_FRAME_SIZE,
        h: CROP_FRAME_SIZE,
        durationMs: 1000,
      });
      tags[cropTag(crop.id, stage)] = { from: frame, to: frame };
    }
  }

  return { atlas: { width, height, frames, tags }, pixels };
}

export function cropTag(cropId: string, stage: CropVisualStage): string {
  return `${cropId}_${stage}`;
}

function drawCrop(c: CropCanvas, cropId: string, stage: CropVisualStage, p: CropPalette): void {
  c.rect(10, 28, 12, 2, p.earth);
  if (stage === WITHERED_STAGE) {
    c.rect(15, 14, 2, 15, p.withered);
    c.rect(8, 20, 8, 2, p.withered);
    c.rect(17, 23, 8, 2, p.withered);
    c.rect(8, 22, 4, 3, p.earth);
    c.rect(21, 25, 4, 3, p.earth);
    return;
  }

  const height = [5, 11, 18, 25][stage] ?? 5;
  const top = 29 - height;
  if (cropId === 'padi') drawPadi(c, stage, top, p);
  else if (cropId === 'singkong') drawSingkong(c, stage, top, p);
  else drawBush(c, stage, top, p, cropId === 'cabai');
}

function drawPadi(c: CropCanvas, stage: number, top: number, p: CropPalette): void {
  const stalks = stage + 2;
  for (let i = 0; i < stalks; i++) {
    const x = 11 + i * 3;
    c.rect(x, top + (i % 2) * 2, 1, 29 - top, i % 2 ? p.leafDark : p.leaf);
    if (stage === 3) c.rect(x - 1, top + (i % 2) * 2, 3, 3, p.ripe);
  }
}

function drawSingkong(c: CropCanvas, stage: number, top: number, p: CropPalette): void {
  c.rect(15, top + 5, 2, 24 - top, p.leafDark);
  const spread = 3 + stage * 2;
  c.rect(16 - spread, top + 4, spread * 2, 2, p.leaf);
  c.rect(14 - Math.floor(spread / 2), top + 1, spread, 3, p.leaf);
  c.rect(17, top + 7, Math.max(2, spread - 1), 2, p.leafDark);
}

function drawBush(
  c: CropCanvas,
  stage: number,
  top: number,
  p: CropPalette,
  hasFruit: boolean,
): void {
  c.rect(15, top + 5, 2, 24 - top, p.leafDark);
  const width = 4 + stage * 2;
  c.rect(16 - width, top + 5, width * 2, 4, p.leaf);
  c.rect(12 - stage, top + 10, 8 + stage * 2, 5, p.leafDark);
  if (stage === 3 && hasFruit) {
    c.rect(10, top + 11, 2, 4, p.fruit);
    c.rect(20, top + 8, 2, 4, p.fruit);
    c.rect(15, top + 15, 2, 4, p.fruit);
  }
}

class CropCanvas {
  constructor(
    private readonly pixels: Uint8Array,
    private readonly stride: number,
    private readonly ox: number,
    private readonly oy: number,
  ) {}

  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let py = Math.max(1, y); py < Math.min(CROP_FRAME_SIZE - 1, y + h); py++) {
      for (let px = Math.max(1, x); px < Math.min(CROP_FRAME_SIZE - 1, x + w); px++) {
        const i = ((this.oy + py) * this.stride + this.ox + px) * 4;
        this.pixels[i] = (color >> 16) & 0xff;
        this.pixels[i + 1] = (color >> 8) & 0xff;
        this.pixels[i + 2] = color & 0xff;
        this.pixels[i + 3] = 0xff;
      }
    }
  }
}
