import { expect, test } from 'bun:test';
import { ANIMAL_DATA } from '@bale/content/animals';
import { BALE_AREA } from '@bale/content/area-bale';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { NPC_DATA } from '@bale/content/npcs';
import { PLAYER_DATA } from '@bale/content/player';
import { WEATHER_DATA } from '@bale/content/weather';
import { CURRENT_SAVE_VERSION, createSaveFile, parseSaveFile } from '@bale/shared';
import { createGameState } from '@bale/sim';
import { createAutosaveController } from './autosave.ts';
import { createSaveStore, type KeyValueStore, SAVE_SLOTS, type SaveStore } from './save-store.ts';

const freshState = () =>
  createGameState(CALENDAR_DATA, BALE_AREA, PLAYER_DATA, WEATHER_DATA, NPC_DATA, ANIMAL_DATA);

class MemoryStore implements KeyValueStore {
  readonly values = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

test('save schema validates the whole sim snapshot and rejects incompatible versions', () => {
  const save = createSaveFile(freshState(), {
    now: new Date('2026-10-02T01:02:03.000Z'),
    playTime: 12_345.9,
  });
  expect(parseSaveFile(save)).toEqual({ success: true, data: save });
  expect(save.meta.playTime).toBe(12_345);

  expect(parseSaveFile({ ...save, version: CURRENT_SAVE_VERSION + 1 })).toEqual({
    success: false,
    error: `save version ${CURRENT_SAVE_VERSION + 1} is newer than this game`,
  });
  expect(parseSaveFile({ ...save, state: { ...save.state, seed: -1 } }).success).toBe(false);
});

test('three slots stay independent and request persistent storage after the first write', async () => {
  const memory = new MemoryStore();
  let persistenceRequests = 0;
  const store = createSaveStore(memory, {
    now: () => new Date('2026-10-02T01:02:03.000Z'),
    persist: async () => {
      persistenceRequests++;
      return true;
    },
  });

  for (const slot of SAVE_SLOTS) {
    const state = freshState();
    state.player.money = slot * 100;
    await store.save(slot, state, slot * 1_000);
  }
  await Promise.resolve();

  expect((await store.list()).map((summary) => summary.save?.money)).toEqual([100, 200, 300]);
  expect(persistenceRequests).toBe(1);
  expect(memory.values.has('save:1:backup')).toBe(false);
});

test('overwrite preserves the last good save and corrupt primary falls back to backup', async () => {
  const memory = new MemoryStore();
  let tick = 0;
  const store = createSaveStore(memory, {
    now: () => new Date(1_700_000_000_000 + tick++ * 1_000),
    persist: async () => true,
  });
  const state = freshState();
  state.player.money = 100;
  const first = await store.save(1, state, 1_000);
  state.player.money = 200;
  const second = await store.save(1, state, 2_000);

  expect(second.createdAt).toBe(first.createdAt);
  expect((await store.load(1))?.save.state.player.money).toBe(200);
  memory.values.set('save:1', { format: 'bale-save', version: CURRENT_SAVE_VERSION });

  const recovered = await store.load(1);
  expect(recovered?.source).toBe('backup');
  expect(recovered?.save.state.player.money).toBe(100);
  expect(recovered?.primaryError).toBeDefined();
  await store.restoreBackup(1);
  expect((await store.load(1))?.source).toBe('primary');
});

test('autosave counts active play time, pauses while hidden, and serializes writes', async () => {
  let time = 100;
  const writes: number[] = [];
  const store: Pick<SaveStore, 'save'> = {
    async save(_slot, state, playTime) {
      await Promise.resolve();
      writes.push(state.player.money);
      return createSaveFile(state, { playTime });
    },
  };
  const autosave = createAutosaveController(store, 1, 5_000, () => time);
  const state = freshState();

  time = 600;
  autosave.pause();
  expect(autosave.playTime).toBe(5_500);
  time = 1_600;
  expect(autosave.playTime).toBe(5_500);
  autosave.resume();
  time = 1_850;
  state.player.money = 100;
  const first = autosave.save(state);
  state.player.money = 200;
  const second = autosave.save(state);
  await Promise.all([first, second]);

  expect(autosave.playTime).toBe(5_750);
  expect(writes).toEqual([100, 200]);
});
