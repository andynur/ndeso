import { describe, expect, test } from 'bun:test';
import { createInput } from './input.ts';
import { createInputFrame, type InputFrame } from './input-frame.ts';
import { createKeyboardSource, KEY_BINDINGS, ZOOM_STEP } from './keyboard.ts';
import {
  CLICK_SLOP_PX,
  createPointerSource,
  PINCH_PX_PER_UNIT,
  STICK_DEAD_ZONE,
  STICK_RADIUS_PX,
  STICK_ZONE,
  type StickView,
  SWIPE_TURN_PX,
  stickVector,
} from './pointer.ts';

const WIDTH = 800;

function sampleOf(source: { sample(frame: InputFrame): void }): InputFrame {
  const frame = createInputFrame();
  source.sample(frame);
  return frame;
}

describe('keyboard', () => {
  test('binds the GDD §12 keys by physical code', () => {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'Space', 'KeyE', 'KeyQ']) {
      expect(KEY_BINDINGS[code]).toBeDefined();
    }
    for (let digit = 1; digit <= 9; digit++) {
      expect(KEY_BINDINGS[`Digit${digit}`]).toEqual({ kind: 'slot', slot: digit - 1 });
    }
    expect(KEY_BINDINGS).toMatchObject({ KeyR: { kind: 'rotate', direction: -1 } });
  });

  test('WASD is screen-relative with up positive, and a diagonal is unit length', () => {
    const keys = createKeyboardSource();
    keys.keyDown('KeyW', false);
    expect(sampleOf(keys)).toMatchObject({ moveX: 0, moveY: 1 });
    keys.keyDown('KeyD', false);
    const diagonal = sampleOf(keys);
    expect(Math.hypot(diagonal.moveX, diagonal.moveY)).toBeCloseTo(1, 10);
    expect(diagonal.moveX).toBeGreaterThan(0);
  });

  test('opposite keys cancel, and letting go of one of two keys for a direction keeps it', () => {
    const keys = createKeyboardSource();
    keys.keyDown('KeyA', false);
    keys.keyDown('KeyD', false);
    expect(sampleOf(keys).moveX).toBe(0);
    keys.keyUp('KeyD');
    keys.keyDown('ArrowLeft', false);
    keys.keyUp('KeyA');
    expect(sampleOf(keys).moveX).toBe(-1);
  });

  test('releaseAll drops held movement and unsampled presses (window blur)', () => {
    const keys = createKeyboardSource();
    keys.keyDown('KeyW', false);
    keys.keyDown('KeyQ', false);
    keys.keyDown('KeyE', false);
    keys.releaseAll();
    expect(sampleOf(keys)).toMatchObject({ moveY: 0, rotate: 0, interact: false });
  });

  test('edges fire once and ignore autorepeat', () => {
    const keys = createKeyboardSource();
    keys.keyDown('KeyE', false);
    keys.keyDown('KeyE', true);
    keys.keyDown('KeyQ', false);
    keys.keyDown('KeyQ', true);
    keys.keyDown('Digit3', false);
    const frame = sampleOf(keys);
    expect(frame).toMatchObject({ interact: true, rotate: 1, slot: 2 });
    expect(sampleOf(keys)).toMatchObject({ interact: false, rotate: 0, slot: -1 });
  });

  test('unbound keys report false so the page keeps them', () => {
    expect(createKeyboardSource().keyDown('KeyZ', false)).toBe(false);
  });

  test('the wheel steps the hotbar; a Ctrl-wheel (trackpad pinch) zooms', () => {
    const keys = createKeyboardSource();
    keys.wheel(120, false);
    keys.wheel(3, false);
    keys.wheel(-40, true);
    expect(sampleOf(keys)).toMatchObject({ cycle: 2, zoom: -ZOOM_STEP });
  });
});

describe('stickVector', () => {
  const out = { x: 0, y: 0 };

  test('inside the dead zone is still', () => {
    expect(stickVector(STICK_RADIUS_PX * STICK_DEAD_ZONE * 0.9, 0, out)).toEqual({ x: 0, y: 0 });
  });

  test('full deflection is unit length and screen-up is positive y', () => {
    stickVector(0, -STICK_RADIUS_PX * 2, out);
    expect(out.x).toBeCloseTo(0, 10);
    expect(out.y).toBeCloseTo(1, 10);
  });

  test('speed ramps from zero at the dead-zone edge', () => {
    stickVector(STICK_RADIUS_PX * (STICK_DEAD_ZONE + 0.01), 0, out);
    expect(out.x).toBeGreaterThan(0);
    expect(out.x).toBeLessThan(0.05);
  });
});

describe('pointer', () => {
  function tracked() {
    const views: (StickView | null)[] = [];
    const source = createPointerSource((view) => views.push(view));
    return { source, views };
  }

  test('a touch in the left 40 % plants a floating stick and drives movement', () => {
    const { source, views } = tracked();
    source.down(1, 'touch', 100, 500, WIDTH);
    expect(views.at(-1)).toEqual({ originX: 100, originY: 500, knobX: 0, knobY: 0 });
    source.move(1, 100 + STICK_RADIUS_PX * 3, 500);
    expect(views.at(-1)).toMatchObject({ knobX: STICK_RADIUS_PX, knobY: 0 });
    expect(sampleOf(source)).toMatchObject({ moveX: 1, moveY: 0 });
    source.up(1);
    expect(views.at(-1)).toBeNull();
    expect(sampleOf(source)).toMatchObject({ moveX: 0, moveY: 0, interact: false });
  });

  test('a touch outside the stick zone does not plant the stick', () => {
    const { source, views } = tracked();
    // Just right of the zone: still the left half, but DESIGN §5 keeps the stick to 40 %.
    source.down(1, 'touch', WIDTH * (STICK_ZONE + 0.05), 500, WIDTH);
    source.move(1, WIDTH * (STICK_ZONE + 0.05) + 50, 500);
    expect(views).toEqual([]);
    expect(sampleOf(source).moveX).toBe(0);
  });

  test('a second finger releases the stick; a sideways swipe turns once per gesture', () => {
    const { source, views } = tracked();
    source.down(1, 'touch', 100, 500, WIDTH);
    source.down(2, 'touch', 300, 500, WIDTH);
    expect(views.at(-1)).toBeNull();
    source.move(1, 100 + SWIPE_TURN_PX, 500);
    source.move(2, 300 + SWIPE_TURN_PX, 500);
    source.move(1, 100 + SWIPE_TURN_PX * 4, 500);
    source.move(2, 300 + SWIPE_TURN_PX * 4, 500);
    const frame = sampleOf(source);
    expect(frame.rotate).toBe(-1);
    expect(frame.moveX).toBe(0);
  });

  test('a third finger pauses the gesture; lifting it resumes with the remaining pair', () => {
    const { source } = tracked();
    source.down(1, 'touch', 400, 500, WIDTH);
    source.down(2, 'touch', 600, 500, WIDTH);
    source.down(3, 'touch', 500, 300, WIDTH);
    source.move(1, 400 + SWIPE_TURN_PX * 2, 500);
    source.move(2, 600 + SWIPE_TURN_PX * 2, 500);
    expect(sampleOf(source).rotate).toBe(0);
    source.up(3);
    source.move(1, 400 + SWIPE_TURN_PX * 4, 500);
    source.move(2, 600 + SWIPE_TURN_PX * 4, 500);
    expect(sampleOf(source).rotate).toBe(-1);
  });

  test('a left swipe turns the other way', () => {
    const { source } = tracked();
    source.down(1, 'touch', 400, 500, WIDTH);
    source.down(2, 'touch', 600, 500, WIDTH);
    source.move(1, 400 - SWIPE_TURN_PX * 2, 500);
    source.move(2, 600 - SWIPE_TURN_PX * 2, 500);
    expect(sampleOf(source).rotate).toBe(1);
  });

  test('spreading two fingers zooms in, pinching zooms out', () => {
    const { source } = tracked();
    source.down(1, 'touch', 400, 400, WIDTH);
    source.down(2, 'touch', 400, 500, WIDTH);
    source.move(2, 400, 500 + PINCH_PX_PER_UNIT * 2);
    expect(sampleOf(source).zoom).toBeCloseTo(-2, 10);
    source.move(2, 400, 500);
    expect(sampleOf(source).zoom).toBeCloseTo(2, 10);
  });

  test('a mouse click is interact; a mouse drag, a cancel, and a touch are not', () => {
    const { source, views } = tracked();
    source.down(1, 'mouse', 100, 100, WIDTH);
    source.up(1);
    expect(sampleOf(source).interact).toBe(true);
    source.down(1, 'mouse', 100, 100, WIDTH);
    source.move(1, 100 + CLICK_SLOP_PX * 2, 100);
    source.up(1);
    source.down(2, 'mouse', 100, 100, WIDTH);
    source.cancel(2);
    source.down(3, 'touch', 700, 100, WIDTH);
    source.up(3);
    expect(sampleOf(source).interact).toBe(false);
    expect(views).toEqual([]);
  });
});

describe('createInput', () => {
  test('merges sources, clamps movement, and clears edges after a sample', () => {
    const input = createInput(() => {});
    input.keyboard.keyDown('KeyD', false);
    input.pointer.down(1, 'touch', 100, 500, WIDTH);
    input.pointer.move(1, 100 + STICK_RADIUS_PX, 500);
    input.pressInteract();
    input.pressSleep();
    input.continueDay();
    input.pressSlot(4);
    input.pressRotate(-1);
    const frame = input.sample();
    expect(frame.moveX).toBeCloseTo(1, 10);
    expect(frame).toMatchObject({
      interact: true,
      sleep: true,
      continueDay: true,
      rotate: -1,
      slot: 4,
    });
    expect(input.sample()).toMatchObject({
      interact: false,
      sleep: false,
      continueDay: false,
      rotate: 0,
      slot: -1,
    });
  });
});
