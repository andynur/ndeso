import { TICK_MS } from '@bale/shared';

/**
 * The fixed-step game loop (ARCHITECTURE §4.1): real time fills an accumulator, the sim
 * steps in whole `TICK_MS` slices, and the renderer draws with `alpha`, the fraction of the
 * next tick already elapsed, so motion stays smooth at any display rate.
 *
 * The frame source is injected so the loop is testable without a browser; `main.ts` passes
 * `requestAnimationFrame`.
 */

/** A long frame (tab switch, GC pause, debugger) is clamped so the sim never spirals. */
export const MAX_FRAME_MS = 250;

export interface FrameScheduler {
  request(callback: (now: number) => void): number;
  cancel(handle: number): void;
  now(): number;
}

export interface LoopHooks {
  /** Advance the sim by exactly one tick. */
  step(): void;
  /** Draw once; `alpha` ∈ [0, 1) is how far real time is into the next tick. */
  frame(alpha: number): void;
}

export interface Loop {
  readonly running: boolean;
  start(): void;
  stop(): void;
}

export interface Advance {
  steps: number;
  accumulator: number;
}

/** One frame of accumulator arithmetic; pure so the edge cases are unit-testable. */
export function advance(accumulator: number, realDtMs: number, tickMs = TICK_MS): Advance {
  let next = accumulator + Math.min(Math.max(realDtMs, 0), MAX_FRAME_MS);
  let steps = 0;
  while (next >= tickMs) {
    next -= tickMs;
    steps++;
  }
  return { steps, accumulator: next };
}

export function createLoop(hooks: LoopHooks, scheduler: FrameScheduler): Loop {
  let handle = 0;
  let running = false;
  let last = 0;
  let accumulator = 0;

  function tick(now: number): void {
    handle = scheduler.request(tick);
    const result = advance(accumulator, now - last);
    last = now;
    accumulator = result.accumulator;
    for (let i = 0; i < result.steps; i++) hooks.step();
    hooks.frame(accumulator / TICK_MS);
  }

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      // Resume from "now": time spent hidden or stopped is not owed to the sim.
      last = scheduler.now();
      handle = scheduler.request(tick);
    },
    stop() {
      if (!running) return;
      running = false;
      scheduler.cancel(handle);
      handle = 0;
    },
  };
}
