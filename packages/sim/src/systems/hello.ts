import { TICKS_PER_SECOND } from '@bale/shared';
import type { System } from '../types.ts';

/**
 * Walking-skeleton system: proves the fixed-step contract end to end before the real
 * clock lands in M1-01. It counts ticks and emits `helloSecond` once per simulated
 * second. Delete it (and its test) when `time` replaces it.
 */
export interface HelloState {
  hello: { ticks: number; seconds: number };
}

export function createHelloState(): HelloState {
  return { hello: { ticks: 0, seconds: 0 } };
}

export const hello: System<HelloState> = (state, ctx) => {
  const slice = state.hello;
  for (let i = 0; i < ctx.ticks; i++) {
    slice.ticks++;
    if (slice.ticks % TICKS_PER_SECOND === 0) {
      slice.seconds++;
      ctx.emit({ type: 'helloSecond', seconds: slice.seconds });
    }
  }
};
