import { describe, expect, test } from 'bun:test';
import { DataTexture, NearestFilter, SRGBColorSpace } from 'three';
import { frameAt } from './animation.ts';
import { frameUv, getTag, type SpriteAtlas } from './atlas.ts';
import { buildPlaceholderCharAtlas, CHAR_FRAME_H, CHAR_FRAME_W } from './placeholder-atlas.ts';
import { createAtlasTexture, SpriteBatch } from './sprite-batch.ts';

const TINY: SpriteAtlas = {
  width: 64,
  height: 32,
  frames: [
    { x: 0, y: 0, w: 32, h: 32, durationMs: 100 },
    { x: 32, y: 0, w: 32, h: 32, durationMs: 300 },
  ],
  tags: { blink: { from: 0, to: 1 }, still: { from: 1, to: 1 } },
};

const PALETTE = {
  outline: 0x1b1410,
  skin: 0x8a5a36,
  hair: 0x161d38,
  shirt: 0x6fa8c9,
  trousers: 0x27335c,
};

describe('frameUv', () => {
  test('maps atlas pixels to GL space with row 0 at the top', () => {
    expect(frameUv(TINY, 1)).toEqual([0.5, 0, 1, 1]);
  });

  test('flipX swaps the horizontal edges only', () => {
    expect(frameUv(TINY, 1, true)).toEqual([1, 0, 0.5, 1]);
  });

  test('rejects a missing frame', () => {
    expect(() => frameUv(TINY, 2)).toThrow(RangeError);
  });
});

describe('frameAt', () => {
  test('holds each frame for its own duration and loops', () => {
    expect(frameAt(TINY, 'blink', 0.05)).toBe(0);
    expect(frameAt(TINY, 'blink', 0.1)).toBe(1);
    expect(frameAt(TINY, 'blink', 0.39)).toBe(1);
    expect(frameAt(TINY, 'blink', 0.4)).toBe(0);
    expect(frameAt(TINY, 'blink', 4.15)).toBe(1);
  });

  test('a start in the future shows the first frame', () => {
    expect(frameAt(TINY, 'blink', -1)).toBe(0);
  });

  test('a one-frame tag never leaves its frame', () => {
    expect(frameAt(TINY, 'still', 12.3)).toBe(1);
  });

  test('rejects an unknown tag', () => {
    expect(() => frameAt(TINY, 'nope', 0)).toThrow(RangeError);
  });
});

describe('placeholder character atlas (DESIGN §1.2)', () => {
  const { atlas, pixels } = buildPlaceholderCharAtlas(PALETTE);

  test('has every direction for idle and walk, with the specified frame counts', () => {
    for (const direction of ['down', 'up', 'side']) {
      const walk = atlas.tags[`walk_${direction}`];
      const idle = atlas.tags[`idle_${direction}`];
      expect(walk && walk.to - walk.from + 1).toBe(6);
      expect(idle && idle.to - idle.from + 1).toBe(4);
    }
  });

  test('walks at 10 fps in 32 × 48 frames', () => {
    const walk = getTag(atlas, 'walk_down');
    const frame = walk && atlas.frames[walk.from];
    expect(frame).toMatchObject({ w: CHAR_FRAME_W, h: CHAR_FRAME_H, durationMs: 100 });
  });

  test('pixel buffer matches the atlas size', () => {
    expect(pixels.length).toBe(atlas.width * atlas.height * 4);
  });

  test('every frame is drawn, outlined in ink, and stands on the frame bottom', () => {
    for (const frame of atlas.frames) {
      let outlined = 0;
      let lowest = -1;
      for (let y = 0; y < frame.h; y++) {
        for (let x = 0; x < frame.w; x++) {
          const i = ((frame.y + y) * atlas.width + frame.x + x) * 4;
          if (pixels[i + 3] === 0) continue;
          lowest = y;
          const rgb = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
          if (rgb === PALETTE.outline) outlined++;
        }
      }
      expect(outlined).toBeGreaterThan(0);
      expect(lowest).toBe(frame.h - 1);
    }
  });

  test('keeps a transparent border, so nearest sampling never bleeds a neighbour frame', () => {
    for (const frame of atlas.frames) {
      for (let x = 0; x < frame.w; x++) {
        expect(pixels[(frame.y * atlas.width + frame.x + x) * 4 + 3]).toBe(0);
      }
      for (let y = 0; y < frame.h; y++) {
        const row = (frame.y + y) * atlas.width;
        expect(pixels[(row + frame.x) * 4 + 3]).toBe(0);
        expect(pixels[(row + frame.x + frame.w - 1) * 4 + 3]).toBe(0);
      }
    }
  });
});

describe('SpriteBatch', () => {
  const { atlas, pixels } = buildPlaceholderCharAtlas(PALETTE);

  function makeBatch(capacity = 4): SpriteBatch {
    return new SpriteBatch({ atlas, texture: new DataTexture(), capacity });
  }

  function uvOf(batch: SpriteBatch, slot: number): number[] {
    const attr = batch.mesh.geometry.getAttribute('aUvRect');
    return Array.from(attr.array.slice(slot * 4, slot * 4 + 4));
  }

  test('atlas texture uses pixel-art sampling', () => {
    const texture = createAtlasTexture(pixels, atlas);
    expect(texture.magFilter).toBe(NearestFilter);
    expect(texture.minFilter).toBe(NearestFilter);
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.colorSpace).toBe(SRGBColorSpace);
  });

  test('writes position and the current frame per instance', () => {
    const batch = makeBatch();
    batch.add({ x: 1, y: 0, z: -2, tag: 'walk_down', startSeconds: 1 });
    batch.update(1.25);
    const walk = getTag(atlas, 'walk_down');
    expect(walk).toBeDefined();
    const expected = frameUv(atlas, (walk?.from ?? 0) + 2);
    expect(uvOf(batch, 0)).toEqual([...expected].map(Math.fround));
    const m = batch.mesh.instanceMatrix.array;
    expect([m[12], m[13], m[14]]).toEqual([1, 0, -2]);
    expect(batch.mesh.count).toBe(1);
  });

  test('flipX mirrors the UV rect', () => {
    const batch = makeBatch();
    batch.add({ x: 0, y: 0, z: 0, tag: 'idle_side', flipX: true });
    batch.update(0);
    const idle = getTag(atlas, 'idle_side');
    expect(uvOf(batch, 0)).toEqual([...frameUv(atlas, idle?.from ?? 0, true)].map(Math.fround));
  });

  test('remove keeps the live instances packed', () => {
    const batch = makeBatch();
    const a = batch.add({ x: 1, y: 0, z: 0, tag: 'idle_down' });
    batch.add({ x: 2, y: 0, z: 0, tag: 'idle_down' });
    batch.add({ x: 3, y: 0, z: 0, tag: 'idle_down' });
    batch.remove(a);
    batch.update(0);
    expect(batch.size).toBe(2);
    expect(batch.mesh.count).toBe(2);
    expect(batch.mesh.instanceMatrix.array[12]).toBe(3);
  });

  test('clear empties the live range without changing capacity', () => {
    const batch = makeBatch(3);
    batch.add({ x: 1, y: 0, z: 0, tag: 'idle_down' });
    batch.clear();
    expect(batch.size).toBe(0);
    expect(batch.capacity).toBe(3);
    expect(batch.mesh.count).toBe(0);
  });

  test('rejects an unknown tag and an overfull batch', () => {
    const batch = makeBatch(1);
    expect(() => batch.add({ x: 0, y: 0, z: 0, tag: 'dance' })).toThrow(RangeError);
    batch.add({ x: 0, y: 0, z: 0, tag: 'idle_up' });
    expect(() => batch.add({ x: 0, y: 0, z: 0, tag: 'idle_up' })).toThrow(RangeError);
  });

  test('all sprites share one mesh, so one draw call (ARCHITECTURE §4.2)', () => {
    const batch = makeBatch(64);
    for (let i = 0; i < 64; i++) batch.add({ x: i, y: 0, z: 0, tag: 'walk_up' });
    batch.update(3);
    expect(batch.mesh.count).toBe(64);
    batch.dispose();
  });
});
