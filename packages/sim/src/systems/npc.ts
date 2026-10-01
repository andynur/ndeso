import { type CalendarData, parseClockTime, TICKS_PER_SECOND, type Vec2 } from '@bale/shared';
import type { NpcDef } from '@bale/shared/content';
import { projectDay } from '../calendar.ts';
import type { NavGrid } from '../nav.ts';
import { findNavPath } from '../nav.ts';
import type { System } from '../types.ts';
import type { Dir } from './movement.ts';
import { facingOf } from './movement.ts';
import type { ClockState } from './time.ts';
import type { WeatherState } from './weather.ts';

/** Placeholder tuning until character-specific movement belongs to final NPC content. */
export const NPC_WALK_SPEED = 2;

export interface NpcActorState {
  id: string;
  area: string;
  x: number;
  z: number;
  facing: Dir;
  anim: string;
  active: boolean;
  moving: boolean;
  scheduleDay: number;
  scheduleIndex: number;
  entryIndex: number;
}

export interface NpcState {
  npcs: NpcActorState[];
}

export type NpcSystemState = NpcState & { clock: ClockState } & WeatherState;

export function createNpcState(definitions: readonly NpcDef[]): NpcState {
  return {
    npcs: definitions.map((npc) => ({
      id: npc.id,
      area: '',
      x: 0,
      z: 0,
      facing: 'south',
      anim: 'idle',
      active: false,
      moving: false,
      scheduleDay: -1,
      scheduleIndex: -1,
      entryIndex: -1,
    })),
  };
}

interface Route {
  points: Vec2[];
  next: number;
}

/** First matching rule wins; its latest reached entry becomes the actor's target. */
export function createNpcSystem(
  definitions: readonly NpcDef[],
  calendar: CalendarData,
  navByArea: Readonly<Record<string, NavGrid>>,
): System<NpcSystemState> {
  const routes = new Map<string, Route>();
  const entryMinutes = definitions.map((npc) =>
    npc.schedules.map((rule) => rule.entries.map((entry) => parseClockTime(entry.time) ?? -1)),
  );
  return (state, ctx) => {
    const date = projectDay(state.clock.day, calendar);
    for (let npcIndex = 0; npcIndex < definitions.length; npcIndex++) {
      const definition = definitions[npcIndex];
      const actor = state.npcs[npcIndex];
      if (!definition || !actor) continue;
      const scheduleIndex = definition.schedules.findIndex(
        (rule) =>
          (!rule.days || rule.days.includes(date.weekday)) &&
          (!rule.weather || rule.weather.includes(state.weather.today)) &&
          (!rule.musim || rule.musim.includes(date.musim)),
      );
      const rule = definition.schedules[scheduleIndex];
      const minutes = entryMinutes[npcIndex]?.[scheduleIndex];
      let entryIndex = -1;
      if (rule && minutes) {
        for (let index = 0; index < minutes.length; index++) {
          if ((minutes[index] ?? Number.POSITIVE_INFINITY) <= state.clock.minute)
            entryIndex = index;
        }
      }
      const entry = rule?.entries[entryIndex];
      if (!entry) {
        actor.active = false;
        actor.moving = false;
        actor.scheduleDay = state.clock.day;
        actor.scheduleIndex = scheduleIndex;
        actor.entryIndex = -1;
        routes.delete(actor.id);
        continue;
      }

      const newDay = actor.scheduleDay !== state.clock.day;
      const firstAppearance = !actor.active || newDay || actor.area !== entry.area;
      const targetChanged =
        actor.scheduleIndex !== scheduleIndex || actor.entryIndex !== entryIndex || newDay;
      actor.active = true;
      actor.scheduleDay = state.clock.day;
      actor.scheduleIndex = scheduleIndex;
      actor.entryIndex = entryIndex;
      if (firstAppearance) {
        actor.area = entry.area;
        actor.x = entry.x;
        actor.z = entry.z;
        actor.anim = entry.anim;
        actor.moving = false;
        routes.delete(actor.id);
        continue;
      }
      const routeMissingBeforeTarget =
        !routes.has(actor.id) && (actor.x !== entry.x || actor.z !== entry.z);
      if (targetChanged || routeMissingBeforeTarget) {
        const grid = navByArea[entry.area];
        const points = grid ? findNavPath(grid, [actor.x, actor.z], [entry.x, entry.z]) : undefined;
        if (points) routes.set(actor.id, { points, next: 0 });
        else routes.delete(actor.id);
      }

      const route = routes.get(actor.id);
      if (!route) {
        actor.anim = entry.anim;
        actor.moving = false;
        continue;
      }
      moveAlong(actor, route, entry.anim, ctx.ticks);
      if (route.next >= route.points.length) routes.delete(actor.id);
    }
  };
}

function moveAlong(
  actor: NpcActorState,
  route: Route,
  destinationAnim: string,
  ticks: number,
): void {
  let remaining = (NPC_WALK_SPEED * ticks) / TICKS_PER_SECOND;
  actor.moving = true;
  actor.anim = 'walk';
  while (remaining > 0 && route.next < route.points.length) {
    const [targetX, targetZ] = route.points[route.next] as Vec2;
    const dx = targetX - actor.x;
    const dz = targetZ - actor.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= remaining) {
      actor.x = targetX;
      actor.z = targetZ;
      remaining -= distance;
      route.next++;
    } else {
      actor.x += (dx / distance) * remaining;
      actor.z += (dz / distance) * remaining;
      remaining = 0;
    }
    actor.facing = facingOf(dx, dz, actor.facing);
  }
  if (route.next >= route.points.length) {
    actor.moving = false;
    actor.anim = destinationAnim;
  }
}
