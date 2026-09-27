/**
 * Sprite atlas descriptor. It mirrors the shape of Aseprite's `--format json-array`
 * export (ASSET_PIPELINE §2): a flat list of frames, each with a duration, and named tags
 * that select a `from..to` frame range. Tag names are animation names (`walk_down`).
 */

/** Pixels per world unit for every sprite, DESIGN §1.2. */
export const PPU = 32;

export interface AtlasFrame {
  /** Top-left corner and size in atlas pixels, y growing downwards as in the PNG. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly durationMs: number;
}

export interface AtlasTag {
  readonly from: number;
  readonly to: number;
}

export interface SpriteAtlas {
  readonly width: number;
  readonly height: number;
  readonly frames: readonly AtlasFrame[];
  readonly tags: Readonly<Record<string, AtlasTag>>;
}

/** `[u0, v0, u1, v1]`: left, bottom, right, top in GL texture space (v up). */
export type UvRect = readonly [number, number, number, number];

/**
 * UV rectangle of one frame. `flipX` swaps the horizontal edges, which is how the
 * side-mirrored direction (DESIGN §1.2) is drawn without a second row of frames.
 * The texture is uploaded with `flipY`, so atlas row 0 sits at the top (v = 1).
 */
export function frameUv(atlas: SpriteAtlas, index: number, flipX = false): UvRect {
  const frame = atlas.frames[index];
  if (!frame) throw new RangeError(`atlas has no frame ${index}`);
  const left = frame.x / atlas.width;
  const right = (frame.x + frame.w) / atlas.width;
  const top = 1 - frame.y / atlas.height;
  const bottom = 1 - (frame.y + frame.h) / atlas.height;
  return flipX ? [right, bottom, left, top] : [left, bottom, right, top];
}

export function getTag(atlas: SpriteAtlas, name: string): AtlasTag {
  const tag = atlas.tags[name];
  if (!tag) throw new RangeError(`atlas has no tag "${name}"`);
  return tag;
}
