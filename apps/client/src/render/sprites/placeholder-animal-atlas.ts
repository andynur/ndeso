import type { PixelAtlas } from './placeholder-atlas.ts';

const SIZE = 32;
const STATES = ['idle', 'happy', 'hungry'] as const;

export interface AnimalPalette {
  readonly outline: number;
  readonly body: number;
  readonly comb: number;
  readonly beak: number;
}

/** Generated 32 px chicken placeholder; final animal art replaces these stable tags. */
export function buildPlaceholderAnimalAtlas(palette: AnimalPalette): PixelAtlas {
  const width = SIZE * 2;
  const height = SIZE * STATES.length;
  const pixels = new Uint8Array(width * height * 4);
  const frames: PixelAtlas['atlas']['frames'][number][] = [];
  const tags: Record<string, { from: number; to: number }> = {};

  for (const [row, state] of STATES.entries()) {
    const from = frames.length;
    for (let frame = 0; frame < 2; frame++) {
      drawChicken(pixels, width, frame * SIZE, row * SIZE, palette, state, frame);
      frames.push({ x: frame * SIZE, y: row * SIZE, w: SIZE, h: SIZE, durationMs: 350 });
    }
    tags[state] = { from, to: frames.length - 1 };
  }
  return { atlas: { width, height, frames, tags }, pixels };
}

function drawChicken(
  pixels: Uint8Array,
  stride: number,
  ox: number,
  oy: number,
  palette: AnimalPalette,
  state: (typeof STATES)[number],
  frame: number,
): void {
  const bob = frame;
  const paint = (x: number, y: number, w: number, h: number, color: number) => {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const index = ((oy + py) * stride + ox + px) * 4;
        pixels[index] = (color >> 16) & 0xff;
        pixels[index + 1] = (color >> 8) & 0xff;
        pixels[index + 2] = color & 0xff;
        pixels[index + 3] = 0xff;
      }
    }
  };

  paint(7, 16 - bob, 17, 11, palette.outline);
  paint(9, 15 - bob, 13, 10, palette.body);
  paint(18, 9 - bob, 8, 10, palette.outline);
  paint(19, 10 - bob, 6, 8, palette.body);
  paint(21, 7 - bob, 2, 3, palette.comb);
  paint(23, 13 - bob, 5, 3, palette.beak);
  paint(22, 12 - bob, 1, 1, palette.outline);
  paint(11, 26, 2, 4, palette.outline);
  paint(19, 26, 2, 4, palette.outline);
  if (state === 'happy') paint(5, 11 - bob, 3, 3, palette.comb);
  if (state === 'hungry') paint(4, 24 - bob, 3, 2, palette.beak);
}
