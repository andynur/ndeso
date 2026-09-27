import { describe, expect, test } from 'bun:test';
import {
  type CameraPose,
  CameraRig,
  DEAD_ZONE,
  DISTANCE_DEFAULT,
  DISTANCE_MAX,
  DISTANCE_MIN,
  type Facing,
  LOOK_HEIGHT,
  PITCH_DEG,
  screenFacing,
  smoothDamp,
  YAW_TURN_SECONDS,
} from './camera-rig.ts';

const FRAME = 1 / 60;

function run(rig: CameraRig, seconds: number, dt = FRAME): void {
  for (let t = 0; t < seconds - 1e-9; t += dt) rig.update(dt);
}

function pose(rig: CameraRig): CameraPose {
  return rig.pose({ x: 0, y: 0, z: 0, lookX: 0, lookY: 0, lookZ: 0 });
}

describe('pose', () => {
  test('sits DESIGN §1.1 distance away at a 38° pitch, looking at the focus', () => {
    const p = pose(new CameraRig({ x: 3, z: -2 }));
    const dx = p.x - p.lookX;
    const dy = p.y - p.lookY;
    const dz = p.z - p.lookZ;
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(DISTANCE_DEFAULT, 6);
    expect((Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI).toBeCloseTo(PITCH_DEG, 6);
    expect([p.lookX, p.lookY, p.lookZ]).toEqual([3, LOOK_HEIGHT, -2]);
    // Yaw 0 puts the camera on the +z side.
    expect(dx).toBeCloseTo(0, 9);
    expect(dz).toBeGreaterThan(0);
  });
});

describe('follow', () => {
  test('ignores movement inside the dead zone', () => {
    const rig = new CameraRig();
    rig.follow(DEAD_ZONE * 0.9, 0);
    run(rig, 1);
    expect(rig.focusX).toBe(0);
  });

  test('settles with the target on the dead-zone edge, without overshoot', () => {
    const rig = new CameraRig();
    rig.follow(5, 0);
    let max = 0;
    for (let i = 0; i < 120; i++) {
      rig.update(FRAME);
      max = Math.max(max, rig.focusX);
    }
    expect(rig.focusX).toBeCloseTo(5 - DEAD_ZONE, 3);
    expect(max).toBeLessThanOrEqual(5 - DEAD_ZONE + 1e-9);
  });

  test('is mostly there after the 0.15 s smoothing time', () => {
    const rig = new CameraRig();
    rig.follow(10.5, 0);
    run(rig, 0.3);
    expect(rig.focusX).toBeGreaterThan(9);
  });

  test('is frame-rate independent', () => {
    const fast = new CameraRig();
    const slow = new CameraRig();
    fast.follow(6, 2);
    slow.follow(6, 2);
    run(fast, 0.2, 1 / 120);
    run(slow, 0.2, 1 / 20);
    expect(fast.focusX).toBeCloseTo(slow.focusX, 1);
    expect(fast.focusZ).toBeCloseTo(slow.focusZ, 1);
  });

  test('snapTo jumps with no easing', () => {
    const rig = new CameraRig();
    rig.snapTo(4, 4);
    expect([rig.focusX, rig.focusZ]).toEqual([4, 4]);
    rig.update(FRAME);
    expect([rig.focusX, rig.focusZ]).toEqual([4, 4]);
  });
});

describe('yaw', () => {
  test('eases a quarter turn in 250 ms and stops exactly on the angle', () => {
    const rig = new CameraRig();
    rig.rotate(1);
    rig.update(YAW_TURN_SECONDS / 2);
    expect(rig.yaw).toBeCloseTo(Math.PI / 4, 6);
    rig.update(YAW_TURN_SECONDS / 2);
    expect(rig.yaw).toBe(Math.PI / 2);
    rig.update(1);
    expect(rig.yaw).toBe(Math.PI / 2);
    expect(rig.yawIndex).toBe(1);
  });

  test('wraps the index both ways', () => {
    const rig = new CameraRig();
    rig.rotate(-1);
    expect(rig.yawIndex).toBe(3);
    for (let i = 0; i < 5; i++) rig.rotate(1);
    expect(rig.yawIndex).toBe(0);
  });

  test('a press mid-turn continues from the current angle, never snapping', () => {
    const rig = new CameraRig();
    rig.rotate(1);
    rig.update(YAW_TURN_SECONDS / 2);
    const before = rig.yaw;
    rig.rotate(1);
    rig.update(0);
    expect(rig.yaw).toBeCloseTo(before, 9);
    run(rig, YAW_TURN_SECONDS);
    expect(rig.yaw).toBe(Math.PI);
  });
});

describe('zoom', () => {
  test('clamps to 10–18 and eases there', () => {
    const rig = new CameraRig();
    rig.zoomBy(-100);
    expect(rig.targetDistance).toBe(DISTANCE_MIN);
    rig.zoomBy(100);
    expect(rig.targetDistance).toBe(DISTANCE_MAX);
    run(rig, 1);
    expect(rig.distance).toBeCloseTo(DISTANCE_MAX, 3);
  });

  test('clamps the constructor distance', () => {
    expect(new CameraRig({ distance: 2 }).distance).toBe(DISTANCE_MIN);
  });
});

describe('screenFacing', () => {
  const out: Facing = { facing: 'down', flipX: false };
  const at = (dx: number, dz: number, quarter: number) => ({
    ...screenFacing(dx, dz, (quarter * Math.PI) / 2, out),
  });

  test('matches the M1-03 walk tags at yaw 0', () => {
    expect(at(0, 1, 0)).toEqual({ facing: 'down', flipX: false });
    expect(at(0, -1, 0)).toEqual({ facing: 'up', flipX: false });
    expect(at(1, 0, 0)).toEqual({ facing: 'side', flipX: false });
    expect(at(-1, 0, 0)).toEqual({ facing: 'side', flipX: true });
  });

  test('turns with the camera', () => {
    // A quarter turn puts the camera on +x: walking +x is now towards it.
    expect(at(1, 0, 1)).toEqual({ facing: 'down', flipX: false });
    expect(at(0, 1, 1)).toEqual({ facing: 'side', flipX: true });
    expect(at(0, 1, 2)).toEqual({ facing: 'up', flipX: false });
  });
});

describe('smoothDamp', () => {
  test('lands on the target instead of overshooting on a huge frame', () => {
    const state = { velocity: 0 };
    expect(smoothDamp(0, 1, 50, 0.15, 5, state)).toBe(1);
    expect(state.velocity).toBe(0);
  });
});
