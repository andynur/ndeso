import { expect, test } from 'bun:test';
import { BALE_AREA } from '@bale/content/areas';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { CROP_DATA } from '@bale/content/crops';
import { ITEM_DATA, TOOL_DATA } from '@bale/content/inventory';
import { MARKET_DATA } from '@bale/content/market';
import { NPC_DATA } from '@bale/content/npcs';
import { PLAYER_DATA } from '@bale/content/player';
import { WEATHER_DATA } from '@bale/content/weather';
import { buildCollisionGrid, buildNavGrid, type Command, findNavPath } from '@bale/sim';
import {
  createGame,
  type NpcPose,
  type PlayerPose,
  parseStartClock,
  parseStartWeather,
} from './game.ts';

const cal = CALENDAR_DATA;
const freshGame = () =>
  createGame(
    cal,
    BALE_AREA,
    PLAYER_DATA,
    CROP_DATA,
    ITEM_DATA,
    TOOL_DATA,
    WEATHER_DATA,
    MARKET_DATA,
    NPC_DATA,
  );

test('every authored Balé schedule leg has a walkable nav route', () => {
  const nav = buildNavGrid(buildCollisionGrid(BALE_AREA));
  for (const npc of NPC_DATA) {
    for (const rule of npc.schedules) {
      for (let index = 0; index < rule.entries.length; index++) {
        const entry = rule.entries[index];
        const previous = rule.entries[Math.max(0, index - 1)];
        expect(entry?.area).toBe('bale');
        expect(
          entry && previous
            ? findNavPath(nav, [previous.x, previous.z], [entry.x, entry.z])
            : undefined,
          `${npc.id} schedule entry ${index} must be walkable`,
        ).toBeDefined();
      }
    }
  }
});

test('one game minute per ticksPerMinute steps', () => {
  const game = freshGame();
  const start = game.state.clock.minute;
  for (let i = 0; i < cal.clock.ticksPerMinute * 3; i++) game.step();
  expect(game.state.clock.minute).toBe(start + 3);
  expect(game.ticks).toBe(cal.clock.ticksPerMinute * 3);
});

test('events are buffered across steps and drained once', () => {
  const game = freshGame();
  const minutesToHour = 60 - (game.state.clock.minute % 60);
  for (let i = 0; i < cal.clock.ticksPerMinute * minutesToHour; i++) game.step();
  const events = game.drainEvents();
  expect(events.some((e) => e.type === 'hourChanged')).toBe(true);
  expect(game.drainEvents()).toEqual([]);
});

test('submitted commands reach the next tick only, sanitized and in order', () => {
  const seen: (readonly Command[])[] = [];
  const game = createGame(
    cal,
    BALE_AREA,
    PLAYER_DATA,
    CROP_DATA,
    ITEM_DATA,
    TOOL_DATA,
    WEATHER_DATA,
    MARKET_DATA,
    NPC_DATA,
    undefined,
    [(_state, ctx) => seen.push(ctx.commands)],
  );
  game.submit({ type: 'move', x: 3, z: 4 });
  game.submit({ type: 'selectSlot', slot: 99 });
  game.submit({ type: 'interact' });
  game.step();
  game.step();
  expect(seen[0]).toEqual([{ type: 'move', x: 0.6, z: 0.8 }, { type: 'interact' }]);
  expect(seen[1]).toEqual([]);
});

test('the player walks on held intent and render interpolates between ticks', () => {
  const game = freshGame();
  const [spawnX, spawnZ] = BALE_AREA.spawn;
  const pose: PlayerPose = { x: 0, z: 0, facing: 'north', moving: false };
  expect(game.playerPose(0.5, pose)).toEqual({
    x: spawnX,
    z: spawnZ,
    facing: 'south',
    moving: false,
  });
  game.submit({ type: 'move', x: 1, z: 0 });
  game.step();
  game.step();
  const { x } = game.state.player;
  const step = x - game.playerPose(0, pose).x;
  expect(step).toBeGreaterThan(0);
  expect(game.playerPose(0.5, pose)).toEqual({
    x: x - step / 2,
    z: spawnZ,
    facing: 'east',
    moving: true,
  });
  expect(game.playerPose(1, pose).x).toBe(x);
});

test('NPC poses project sim-owned schedules and interpolate path movement', () => {
  const game = freshGame();
  const poses: NpcPose[] = [];
  game.state.clock.minute = 389;
  for (let tick = 0; tick < cal.clock.ticksPerMinute; tick++) game.step();
  const mbah = game.npcPoses(1, poses).find((pose) => pose.id === 'mbah_hita');
  expect(mbah).toMatchObject({ active: true, area: 'bale', x: -2.5, z: 2.5 });

  game.state.clock.minute = 540;
  game.step();
  const currentX = game.state.npcs.find((npc) => npc.id === 'mbah_hita')?.x ?? 0;
  const before = game.npcPoses(0, poses).find((pose) => pose.id === 'mbah_hita')?.x ?? 0;
  const halfway = game.npcPoses(0.5, poses).find((pose) => pose.id === 'mbah_hita');
  expect(currentX).toBeGreaterThan(before);
  expect(halfway).toMatchObject({ moving: true });
  expect(halfway?.x).toBeCloseTo((before + currentX) / 2);
});

test('farm commands run against the area field', () => {
  const game = freshGame();
  const target = { area: 'bale', x: BALE_AREA.field.x, z: BALE_AREA.field.z };
  game.submit({ type: 'useTool', tool: 'hoe', target });
  game.submit({ type: 'plantSeed', cropId: 'cabai', target });
  game.submit({ type: 'useTool', tool: 'watering_can', target });
  game.step();
  expect(game.state.farm.tiles[`bale:${target.x},${target.z}`]).toMatchObject({
    phase: 'seeded',
    cropId: 'cabai',
    watered: true,
  });
});

test('hotbar selection resolves Use in front of the player and consumes only planted seed', () => {
  const game = freshGame();
  const target = { area: 'bale', x: BALE_AREA.field.x, z: BALE_AREA.field.z };
  const player = game.state.player as typeof game.state.player;
  player.x = target.x - 0.5;
  player.z = target.z + 0.5;
  player.facing = 'east';

  game.submit({ type: 'interact' });
  game.step();
  expect(game.state.farm.tiles[`bale:${target.x},${target.z}`]).toMatchObject({ phase: 'tilled' });

  game.submit({ type: 'selectSlot', slot: 2 });
  game.submit({ type: 'interact' });
  game.step();
  expect(game.state.farm.tiles[`bale:${target.x},${target.z}`]).toMatchObject({
    phase: 'seeded',
    cropId: 'cabai',
  });
  expect(game.state.player.inventory[2]).toMatchObject({ quantity: 5 });

  game.submit({ type: 'interact' });
  game.step();
  expect(game.state.player.inventory[2]).toMatchObject({ quantity: 5 });

  game.submit({ type: 'selectSlot', slot: 1 });
  game.submit({ type: 'interact' });
  game.step();
  expect(game.state.farm.tiles[`bale:${target.x},${target.z}`]).toMatchObject({ watered: true });
});

test('a full inventory leaves a ripe crop intact until its whole yield fits', () => {
  const game = freshGame();
  const target = { area: 'bale', x: BALE_AREA.field.x, z: BALE_AREA.field.z };
  const key = `bale:${target.x},${target.z}` as const;
  game.state.player.x = target.x - 0.5;
  game.state.player.z = target.z + 0.5;
  game.state.player.facing = 'east';
  game.state.farm.tiles[key] = {
    ...target,
    plot: 'tegalan',
    watered: false,
    phase: 'mature',
    cropId: 'cabai',
    growthDays: 8,
    dryDays: 0,
  };
  for (let slot = 0; slot < game.state.player.inventory.length; slot++) {
    game.state.player.inventory[slot] = { kind: 'tool', id: `full_${slot}` };
  }

  game.submit({ type: 'interact' });
  game.step();
  expect(game.state.farm.tiles[key]).toMatchObject({ phase: 'mature' });
  expect(game.drainEvents()).toContainEqual({
    type: 'inventoryFull',
    itemId: 'cabai',
    quantity: 3,
  });

  game.state.player.inventory[8] = null;
  game.submit({ type: 'interact' });
  game.step();
  expect(game.state.farm.tiles[key]).toMatchObject({ phase: 'seeded' });
  expect(game.state.player.inventory.at(8)).toEqual({
    kind: 'item',
    id: 'cabai',
    quantity: 3,
  });
});

test('accepted tools spend stamina, sleep freezes the day, and continue starts tomorrow', () => {
  const game = freshGame();
  const target = { area: 'bale', x: BALE_AREA.field.x, z: BALE_AREA.field.z };
  game.submit({ type: 'useTool', tool: 'hoe', target });
  game.step();
  expect(game.state.player.stamina).toBe(96);

  game.submit({ type: 'sleep' });
  game.step();
  expect(game.state.player.dayEndSummary).toMatchObject({ reason: 'sleep' });
  const frozenMinute = game.state.clock.minute;
  for (let tick = 0; tick < cal.clock.ticksPerMinute * 2; tick++) game.step();
  expect(game.state.clock.minute).toBe(frozenMinute);

  game.submit({ type: 'continueDay' });
  game.step();
  expect(game.state.clock).toMatchObject({ day: 1, minute: cal.clock.dayStartMinute });
  expect(game.state.player.stamina).toBe(100);
  expect(game.state.player.dayEndSummary).toBeNull();
});

test('setoran removes selected produce and pays its base price the next morning', () => {
  const game = freshGame();
  const [x, z] = BALE_AREA.setoran;
  game.state.player.x = x + 0.5;
  game.state.player.z = z + 1.5;
  game.state.player.facing = 'north';
  game.state.player.inventory[8] = { kind: 'item', id: 'cabai', quantity: 3 };
  game.state.player.selectedSlot = 8;

  game.submit({ type: 'interact' });
  game.step();
  expect(game.state.player.inventory[8]).toBeNull();
  expect(game.state.shipping.items).toEqual({ cabai: 3 });
  expect(game.state.player.money).toBe(0);

  game.submit({ type: 'sleep' });
  game.step();
  game.submit({ type: 'continueDay' });
  game.step();
  expect(game.state.shipping.items).toEqual({});
  expect(game.state.player.money).toBe(2_100);
  expect(game.drainEvents()).toContainEqual({ type: 'shipmentPaid', count: 3, money: 2_100 });
});

test('market commands buy seeds and sell produce through sim-authoritative state', () => {
  const game = freshGame();
  game.state.player.money = 1_000;
  game.submit({
    type: 'buyItem',
    marketId: MARKET_DATA.id,
    itemId: 'cabai_seed',
    quantity: 1,
  });
  game.step();
  expect(game.state.player.money).toBe(200);
  expect(game.state.player.inventory[2]).toMatchObject({ id: 'cabai_seed', quantity: 7 });

  game.state.player.inventory[8] = { kind: 'item', id: 'cabai', quantity: 2 };
  game.submit({
    type: 'sellItem',
    marketId: MARKET_DATA.id,
    itemId: 'cabai',
    quantity: 1,
  });
  game.step();
  expect(game.state.player.inventory[8]).toMatchObject({ id: 'cabai', quantity: 1 });
  expect(game.state.player.money).toBeGreaterThan(200);
  expect(game.drainEvents().some((event) => event.type === 'marketSold')).toBe(true);
});

test('?clock= reads a time inside the game day, after midnight included', () => {
  expect(parseStartClock('17:30', cal)).toBe(1050);
  expect(parseStartClock('00:30', cal)).toBe(1470);
  expect(parseStartClock('03:00', cal)).toBeUndefined();
  expect(parseStartClock('evening', cal)).toBeUndefined();
  expect(parseStartClock(null, cal)).toBeUndefined();
});

test('?weather= accepts only a known weather id', () => {
  expect(parseStartWeather('rain')).toBe('rain');
  expect(parseStartWeather('sunny')).toBeUndefined();
  expect(parseStartWeather(null)).toBeUndefined();
});
