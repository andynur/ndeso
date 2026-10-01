import { beforeAll, describe, expect, test } from 'bun:test';
import type { AreaDef, CalendarData } from '@bale/shared';
import type { NpcDef } from '@bale/shared/content';
import { buildCollisionGrid } from '../collision.ts';
import { buildNavGrid, type NavGrid } from '../nav.ts';
import { loadAreaForTests } from '../testing/area-data.ts';
import { loadCalendarForTests } from '../testing/calendar-data.ts';
import { createContext } from '../types.ts';
import { createNpcState, createNpcSystem, type NpcSystemState } from './npc.ts';

let calendar: CalendarData;
let area: AreaDef;
let nav: NavGrid;
beforeAll(async () => {
  calendar = await loadCalendarForTests();
  area = await loadAreaForTests('bale');
  nav = buildNavGrid(buildCollisionGrid(area));
});

const npc: NpcDef = {
  id: 'test_npc',
  nameKey: 'npcs:test.name',
  titleKey: 'npcs:test.title',
  bioKey: 'npcs:test.bio',
  origin: 'Baledono, Purworejo, Jawa Tengah',
  schedules: [
    {
      weather: ['rain'],
      entries: [{ time: '05:00', area: 'bale', x: -5.5, z: 3.5, anim: 'rain_idle' }],
    },
    {
      entries: [
        { time: '06:00', area: 'bale', x: -5.5, z: -4.5, anim: 'idle' },
        { time: '07:00', area: 'bale', x: 4.5, z: -4.5, anim: 'look' },
      ],
    },
  ],
};

function fresh(minute = 300): NpcSystemState {
  return {
    clock: { day: 0, minute, tick: 0 },
    seed: 1,
    weather: { today: 'clear', tomorrow: 'clear' },
    ...createNpcState([npc]),
  };
}

describe('NPC schedule system', () => {
  test('keeps an NPC absent before the first entry, then places the first visit', () => {
    const state = fresh();
    const system = createNpcSystem([npc], calendar, { bale: nav });
    system(state, createContext());
    expect(state.npcs[0]?.active).toBe(false);

    state.clock.minute = 360;
    system(state, createContext());
    expect(state.npcs[0]).toMatchObject({
      active: true,
      x: -5.5,
      z: -4.5,
      anim: 'idle',
      scheduleIndex: 1,
      entryIndex: 0,
    });
  });

  test('uses the first matching rule', () => {
    const state = fresh();
    state.weather.today = 'rain';
    const system = createNpcSystem([npc], calendar, { bale: nav });
    system(state, createContext());
    expect(state.npcs[0]).toMatchObject({
      active: true,
      x: -5.5,
      z: 3.5,
      anim: 'rain_idle',
      scheduleIndex: 0,
    });
  });

  test('walks a shortest nav route around solid tiles and settles at the target', () => {
    const state = fresh(360);
    const system = createNpcSystem([npc], calendar, { bale: nav });
    system(state, createContext());
    state.clock.minute = 420;
    system(state, createContext());
    expect(state.npcs[0]).toMatchObject({ moving: true, anim: 'walk' });
    expect(state.npcs[0]?.z).toBeLessThan(-4.5);

    for (let tick = 0; tick < 200; tick++) system(state, createContext());
    expect(state.npcs[0]).toMatchObject({
      x: 4.5,
      z: -4.5,
      moving: false,
      anim: 'look',
      facing: 'south',
    });
  });

  test('resolves a fresh day independently instead of carrying yesterday forward', () => {
    const state = fresh(420);
    const system = createNpcSystem([npc], calendar, { bale: nav });
    system(state, createContext());
    expect(state.npcs[0]?.active).toBe(true);
    state.clock.day = 1;
    state.clock.minute = 300;
    system(state, createContext());
    expect(state.npcs[0]).toMatchObject({ active: false, entryIndex: -1, scheduleDay: 1 });
  });

  test('rebuilds a derived route from serializable mid-walk state', () => {
    const state = fresh(420);
    const actor = state.npcs[0];
    if (!actor) throw new Error('missing test NPC');
    Object.assign(actor, {
      active: true,
      area: 'bale',
      x: -5.5,
      z: -6.5,
      scheduleDay: 0,
      scheduleIndex: 1,
      entryIndex: 1,
    });
    const system = createNpcSystem([npc], calendar, { bale: nav });
    system(state, createContext(5));
    expect(actor.moving).toBe(true);
    expect([actor.x, actor.z]).not.toEqual([-5.5, -6.5]);
  });
});
