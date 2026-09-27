import type { AtlasFrame, AtlasTag, SpriteAtlas } from './atlas.ts';

/**
 * Placeholder character atlas, drawn in code at boot so no generated image is committed
 * (AGENTS rule 9) and no final art is faked (ASSET_PIPELINE §4). It follows the DESIGN
 * §1.2 character spec — 32 × 48 frames, down/up/side (side-mirrored is a flip), walk
 * 6 frames at 10 fps, idle 4 frames, 1 px outline — so the real sheet swaps in with the
 * same tag names.
 */

export const CHAR_FRAME_W = 32;
export const CHAR_FRAME_H = 48;

/** Walk speed is DESIGN §1.2. Idle speed is unspecified there; 4 fps reads as breathing. */
const WALK = { frames: 6, durationMs: 100 } as const;
const IDLE = { frames: 4, durationMs: 250 } as const;

const DIRECTIONS = ['down', 'up', 'side'] as const;
export type CharDirection = (typeof DIRECTIONS)[number];

/** Rows top to bottom: idle then walk, each in DIRECTIONS order. */
const ANIMS = [
  { name: 'idle', ...IDLE, bob: [0, 0, 1, 1], stride: [0, 0, 0, 0] },
  { name: 'walk', ...WALK, bob: [0, 1, 0, 0, 1, 0], stride: [0, 1, 2, 0, -1, -2] },
] as const;

export interface CharPalette {
  readonly outline: number;
  readonly skin: number;
  readonly hair: number;
  readonly shirt: number;
  readonly trousers: number;
}

export interface PixelAtlas {
  readonly atlas: SpriteAtlas;
  /** RGBA8, row 0 at the top, `atlas.width * atlas.height * 4` bytes. */
  readonly pixels: Uint8Array;
}

export function buildPlaceholderCharAtlas(palette: CharPalette): PixelAtlas {
  const columns = Math.max(...ANIMS.map((anim) => anim.frames));
  const width = columns * CHAR_FRAME_W;
  const height = ANIMS.length * DIRECTIONS.length * CHAR_FRAME_H;
  const pixels = new Uint8Array(width * height * 4);
  const frames: AtlasFrame[] = [];
  const tags: Record<string, AtlasTag> = {};

  let row = 0;
  for (const anim of ANIMS) {
    for (const direction of DIRECTIONS) {
      const from = frames.length;
      for (let f = 0; f < anim.frames; f++) {
        const x = f * CHAR_FRAME_W;
        const y = row * CHAR_FRAME_H;
        const canvas = new FrameCanvas(pixels, width, x, y);
        drawFigure(canvas, palette, direction, anim.bob[f] ?? 0, anim.stride[f] ?? 0);
        canvas.outline(palette.outline);
        frames.push({ x, y, w: CHAR_FRAME_W, h: CHAR_FRAME_H, durationMs: anim.durationMs });
      }
      tags[`${anim.name}_${direction}`] = { from, to: frames.length - 1 };
      row++;
    }
  }

  return { atlas: { width, height, frames, tags }, pixels };
}

/** A figure facing `direction`, feet on the bottom row, lifted by `bob` px. */
function drawFigure(
  c: FrameCanvas,
  p: CharPalette,
  direction: CharDirection,
  bob: number,
  stride: number,
): void {
  const feet = CHAR_FRAME_H - 2;
  // Legs: side view swings them apart along x; front/back alternate their length.
  const legTop = feet - 8 - bob;
  if (direction === 'side') {
    c.rect(13 + stride, legTop, 4, feet - legTop + 1, p.trousers);
    c.rect(15 - stride, legTop, 4, feet - legTop + 1, p.trousers);
  } else {
    c.rect(11, legTop, 4, feet - legTop + 1 - Math.max(0, stride), p.trousers);
    c.rect(17, legTop, 4, feet - legTop + 1 - Math.max(0, -stride), p.trousers);
  }

  const bodyTop = 20 - bob;
  c.rect(9, bodyTop, 14, legTop - bodyTop, p.shirt);

  const headTop = 7 - bob;
  c.rect(10, headTop, 12, 13, p.skin);
  // Hair: a cap from the front, the whole head from behind, swept back from the side.
  if (direction === 'up') c.rect(10, headTop, 12, 13, p.hair);
  else if (direction === 'side') {
    c.rect(10, headTop, 12, 4, p.hair);
    c.rect(10, headTop, 5, 9, p.hair);
  } else c.rect(10, headTop, 12, 4, p.hair);

  // Face: two eyes from the front; one eye and a nose from the side (facing +x).
  if (direction === 'down') {
    c.rect(13, headTop + 7, 2, 2, p.outline);
    c.rect(17, headTop + 7, 2, 2, p.outline);
  } else if (direction === 'side') {
    c.rect(18, headTop + 7, 2, 2, p.outline);
    c.rect(22, headTop + 8, 1, 2, p.skin);
  }
}

/** Writes into one frame of the atlas, clipped to the frame. */
class FrameCanvas {
  constructor(
    private readonly pixels: Uint8Array,
    private readonly stride: number,
    private readonly ox: number,
    private readonly oy: number,
  ) {}

  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let py = Math.max(0, y); py < Math.min(CHAR_FRAME_H, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(CHAR_FRAME_W, x + w); px++) {
        this.set(px, py, color);
      }
    }
  }

  /** DESIGN §1.2: a 1 px dark outline around every opaque pixel (4-neighbourhood). */
  outline(color: number): void {
    const edge: [number, number][] = [];
    for (let y = 0; y < CHAR_FRAME_H; y++) {
      for (let x = 0; x < CHAR_FRAME_W; x++) {
        if (this.opaque(x, y)) continue;
        const touches =
          this.opaque(x - 1, y) ||
          this.opaque(x + 1, y) ||
          this.opaque(x, y - 1) ||
          this.opaque(x, y + 1);
        if (touches) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.set(x, y, color);
  }

  private opaque(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= CHAR_FRAME_W || y >= CHAR_FRAME_H) return false;
    return this.pixels[this.offset(x, y) + 3] !== 0;
  }

  private set(x: number, y: number, color: number): void {
    const i = this.offset(x, y);
    this.pixels[i] = (color >> 16) & 0xff;
    this.pixels[i + 1] = (color >> 8) & 0xff;
    this.pixels[i + 2] = color & 0xff;
    this.pixels[i + 3] = 0xff;
  }

  private offset(x: number, y: number): number {
    return ((this.oy + y) * this.stride + this.ox + x) * 4;
  }
}
