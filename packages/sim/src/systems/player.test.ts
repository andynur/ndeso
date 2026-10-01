import { beforeAll, describe, expect, test } from 'bun:test';
import type { CalendarData } from '@bale/shared';
import type { ToolDef } from '@bale/shared/content';
import { loadCalendarForTests } from '../testing/calendar-data.ts';
import { createContext } from '../types.ts';
import type { MovementState } from './movement.ts';
import {
  createDayTransitionSystem,
  createPlayerProgress,
  createStaminaSystem,
  MAX_FAINT_PENALTY,
  type PlayerProgressState,
} from './player.ts';
import { createTimeState, type TimeState } from './time.ts';

let cal: CalendarData;
beforeAll(async () => {
  cal = await loadCalendarForTests();
});

const tools: readonly ToolDef[] = [
  {
    id: 'hoe',
    nameKey: 'items:tool.hoe.name',
    descKey: 'items:tool.hoe.desc',
    origin: 'Central Java, Indonesia',
    action: 'hoe',
    staminaCost: 4,
  },
  {
    id: 'watering_can',
    nameKey: 'items:tool.watering_can.name',
    descKey: 'items:tool.watering_can.desc',
    origin: 'Central Java, Indonesia',
    action: 'water',
    staminaCost: 2,
  },
];

type State = TimeState & MovementState & PlayerProgressState;

function fresh(): State {
  return {
    ...createTimeState(cal),
    player: {
      area: 'bale',
      x: 0,
      z: 0,
      facing: 'south',
      moveX: 0,
      moveZ: 0,
      ...createPlayerProgress(),
    },
  };
}

describe('stamina', () => {
  test('charges only accepted tool actions and clamps at zero', () => {
    const state = fresh();
    state.player.stamina = 5;
    const ctx = createContext();
    ctx.emit({ type: 'tileHoed', key: 'bale:1,1' });
    ctx.emit({ type: 'tileWatered', key: 'bale:1,2' });
    createStaminaSystem(tools)(state, ctx);
    expect(state.player.stamina).toBe(0);
    expect(state.player.dayEndSummary).toMatchObject({ reason: 'exhausted', staminaRemaining: 0 });
  });

  test('an eventless rejected action costs nothing', () => {
    const state = fresh();
    createStaminaSystem(tools)(state, createContext());
    expect(state.player.stamina).toBe(100);
    expect(state.player.dayEndSummary).toBeNull();
  });

  test('fainting removes ten percent of money, capped at Rp5,000', () => {
    const state = fresh();
    state.player.stamina = 2;
    state.player.money = 80_000;
    const ctx = createContext();
    ctx.emit({ type: 'tileWatered', key: 'bale:1,1' });
    createStaminaSystem(tools)(state, ctx);
    expect(state.player.money).toBe(75_000);
    expect(state.player.dayEndSummary?.moneyLost).toBe(MAX_FAINT_PENALTY);
  });
});

describe('day transitions', () => {
  test('sleep opens a summary; acknowledgement starts the next day and restores stamina', () => {
    const state = fresh();
    state.player.stamina = 42;
    createDayTransitionSystem(cal)(state, createContext(1, [{ type: 'sleep' }]));
    expect(state.clock.day).toBe(0);
    expect(state.player.dayEndSummary).toEqual({
      day: 0,
      reason: 'sleep',
      staminaRemaining: 42,
      moneyLost: 0,
    });

    const ctx = createContext(1, [{ type: 'continueDay' }]);
    createDayTransitionSystem(cal)(state, ctx);
    expect(state.clock).toEqual({ day: 1, minute: 300, tick: 0 });
    expect(state.player.stamina).toBe(100);
    expect(state.player.dayEndSummary).toBeNull();
    expect(ctx.events.some((event) => event.type === 'dayStarted')).toBe(true);
  });

  test('01:00 causes a late pass-out and stops held movement', () => {
    const state = fresh();
    state.player.moveX = 1;
    state.clock.minute = cal.clock.dayEndMinute;
    const ctx = createContext();
    ctx.emit({ type: 'dayExpired', day: 0 });
    createDayTransitionSystem(cal)(state, ctx);
    expect(state.player.dayEndSummary).toMatchObject({ reason: 'late' });
    expect(state.player.moveX).toBe(0);
  });
});
