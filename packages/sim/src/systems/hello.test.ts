import { describe, expect, test } from 'bun:test';
import { TICKS_PER_SECOND } from '@ndeso/shared';
import { createContext } from '../types.ts';
import { createHelloState, hello } from './hello.ts';

const run = (ticks: number) => {
  const state = createHelloState();
  const ctx = createContext(ticks);
  hello(state, ctx);
  return { state, events: ctx.events };
};

describe('hello system', () => {
  test('starts at zero', () => {
    expect(createHelloState()).toEqual({ hello: { ticks: 0, seconds: 0 } });
  });

  test('counts every tick of the step', () => {
    expect(run(3).state.hello.ticks).toBe(3);
  });

  test('emits one helloSecond per simulated second', () => {
    const { state, events } = run(TICKS_PER_SECOND * 2);
    expect(state.hello.seconds).toBe(2);
    expect(events).toEqual([
      { type: 'helloSecond', seconds: 1 },
      { type: 'helloSecond', seconds: 2 },
    ]);
  });

  test('emits nothing before a full second has passed', () => {
    expect(run(TICKS_PER_SECOND - 1).events).toEqual([]);
  });

  test('is deterministic: one big step equals many small ones', () => {
    const big = run(TICKS_PER_SECOND * 3);

    const state = createHelloState();
    const events = [];
    for (let i = 0; i < TICKS_PER_SECOND * 3; i++) {
      const ctx = createContext(1);
      hello(state, ctx);
      events.push(...ctx.events);
    }

    expect(state).toEqual(big.state);
    expect(events).toEqual(big.events);
  });
});
