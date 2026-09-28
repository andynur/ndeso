/**
 * Core sim contracts (ARCHITECTURE §3). Everything here is plain, serializable data:
 * no classes in state, no wall-clock time, no randomness outside the seeded RNG.
 * The full `GameState` grows task by task; M0 only needs the parts a system touches.
 */

import type { Command } from './commands.ts';

/** Events a system emits for render, UI, and audio to react to. Systems never call them back. */
export interface SimEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

/** Everything a system may read besides the state, plus the only way it emits. */
export interface SimContext {
  /** Ticks elapsed in this step; always 1 for the fixed-step loop, >1 when catching up. */
  readonly ticks: number;
  /** This step's player commands, already sanitized, in the order they were issued. */
  readonly commands: readonly Command[];
  /** Events emitted earlier in this step, in system order. Later systems may react to them. */
  readonly events: readonly SimEvent[];
  emit(event: SimEvent): void;
}

/** Systems mutate their own slice of the state and emit events (ARCHITECTURE §3.1). */
export type System<TState> = (state: TState, ctx: SimContext) => void;

/** Collects events during one step. Deterministic: order of emission is preserved. */
export function createContext(
  ticks = 1,
  commands: readonly Command[] = [],
): SimContext & { readonly events: SimEvent[] } {
  const events: SimEvent[] = [];
  return {
    ticks,
    commands,
    events,
    emit(event) {
      events.push(event);
    },
  };
}
