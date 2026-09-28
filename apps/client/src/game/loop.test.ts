import { describe, expect, test } from 'bun:test';
import { TICK_MS } from '@bale/shared';
import { advance, createLoop, type FrameScheduler, MAX_FRAME_MS } from './loop.ts';

describe('advance', () => {
  test('steps once per whole tick and keeps the remainder', () => {
    expect(advance(0, TICK_MS * 2.5)).toEqual({ steps: 2, accumulator: TICK_MS / 2 });
  });

  test('carries a partial tick into the next frame', () => {
    const first = advance(0, TICK_MS * 0.6);
    expect(first.steps).toBe(0);
    expect(advance(first.accumulator, TICK_MS * 0.6).steps).toBe(1);
  });

  test('clamps a long frame so the sim cannot spiral', () => {
    expect(advance(0, 10_000).steps).toBe(Math.floor(MAX_FRAME_MS / TICK_MS));
  });

  test('ignores a clock that runs backwards', () => {
    expect(advance(10, -500)).toEqual({ steps: 0, accumulator: 10 });
  });
});

/** A manual frame source: `flush(t)` delivers the pending frame at time `t`. */
function fakeScheduler() {
  let time = 0;
  let pending: ((now: number) => void) | undefined;
  let requests = 0;
  const scheduler: FrameScheduler = {
    request(callback) {
      pending = callback;
      return ++requests;
    },
    cancel() {
      pending = undefined;
    },
    now: () => time,
  };
  return {
    scheduler,
    get pending() {
      return pending !== undefined;
    },
    flush(at: number) {
      time = at;
      const callback = pending;
      pending = undefined;
      callback?.(at);
    },
  };
}

describe('createLoop', () => {
  test('ten sim steps per real second, with alpha for the remainder', () => {
    const clock = fakeScheduler();
    let steps = 0;
    const alphas: number[] = [];
    const loop = createLoop({ step: () => steps++, frame: (a) => alphas.push(a) }, clock.scheduler);
    loop.start();
    for (let t = 16; t <= 1000; t += 16) clock.flush(t);
    expect(steps).toBe(9); // 992 ms elapsed
    expect(alphas.at(-1)).toBeCloseTo(0.92);
    expect(alphas.every((a) => a >= 0 && a < 1)).toBe(true);
  });

  test('hands the frame its clamped real dt', () => {
    const clock = fakeScheduler();
    const dts: number[] = [];
    const loop = createLoop({ step: () => {}, frame: (_, dt) => dts.push(dt) }, clock.scheduler);
    loop.start();
    clock.flush(16);
    clock.flush(5016);
    expect(dts).toEqual([16, MAX_FRAME_MS]);
  });

  test('stop cancels the frame; start does not bill the time spent stopped', () => {
    const clock = fakeScheduler();
    let steps = 0;
    const loop = createLoop({ step: () => steps++, frame: () => {} }, clock.scheduler);
    loop.start();
    clock.flush(50);
    loop.stop();
    expect(loop.running).toBe(false);
    expect(clock.pending).toBe(false);

    clock.flush(60_000); // hidden for a minute: nothing delivered
    loop.start();
    clock.flush(60_060);
    expect(steps).toBe(1); // 50 + 60 ms, not a minute of catch-up
  });

  test('start and stop are idempotent', () => {
    const clock = fakeScheduler();
    let frames = 0;
    const loop = createLoop({ step: () => {}, frame: () => frames++ }, clock.scheduler);
    loop.start();
    loop.start();
    clock.flush(16);
    expect(frames).toBe(1);
    loop.stop();
    loop.stop();
    expect(loop.running).toBe(false);
  });

  test('a 30 fps cap on a 60 Hz display draws every other vsync, sim time intact', () => {
    const clock = fakeScheduler();
    let steps = 0;
    const dts: number[] = [];
    const loop = createLoop(
      { step: () => steps++, frame: (_, dt) => dts.push(dt) },
      clock.scheduler,
    );
    loop.setFpsCap(30);
    loop.start();
    for (let i = 1; i <= 60; i++) clock.flush(i * (1000 / 60));
    expect(dts.length).toBe(30);
    expect(dts.every((dt) => Math.abs(dt - 1000 / 30) < 1e-6)).toBe(true);
    expect(steps).toBe(10);
  });

  test('lifting the cap draws every vsync again', () => {
    const clock = fakeScheduler();
    let frames = 0;
    const loop = createLoop({ step: () => {}, frame: () => frames++ }, clock.scheduler);
    loop.setFpsCap(30);
    loop.setFpsCap(0);
    loop.start();
    for (let i = 1; i <= 60; i++) clock.flush(i * (1000 / 60));
    expect(frames).toBe(60);
  });
});
