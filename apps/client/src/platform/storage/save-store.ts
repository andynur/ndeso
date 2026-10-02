import { createSaveFile, parseSaveFile, type SavedGameState, type SaveFile } from '@bale/shared';
import { createStore, get, set } from 'idb-keyval';

export const SAVE_SLOTS = [1, 2, 3] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface LoadedSave {
  readonly save: SaveFile;
  readonly source: 'primary' | 'backup';
  readonly primaryError?: string;
}

export interface SlotSummary {
  readonly slot: SaveSlot;
  readonly save?: SaveFile['meta'] & Pick<SaveFile, 'createdAt' | 'updatedAt'>;
  readonly source?: LoadedSave['source'];
  readonly primaryError?: string;
}

export interface SaveStore {
  load(slot: SaveSlot): Promise<LoadedSave | undefined>;
  save(slot: SaveSlot, state: SavedGameState, playTime: number): Promise<SaveFile>;
  restoreBackup(slot: SaveSlot): Promise<SaveFile>;
  list(): Promise<SlotSummary[]>;
}

export interface SaveStoreOptions {
  readonly now?: () => Date;
  readonly persist?: () => Promise<boolean>;
}

const primaryKey = (slot: SaveSlot): string => `save:${slot}`;
const backupKey = (slot: SaveSlot): string => `save:${slot}:backup`;

export function createSaveStore(
  storage: KeyValueStore = indexedDbStore(),
  options: SaveStoreOptions = {},
): SaveStore {
  const now = options.now ?? (() => new Date());
  const persist = options.persist ?? requestPersistentStorage;
  let persistenceRequested = false;

  const load = async (slot: SaveSlot): Promise<LoadedSave | undefined> => {
    const primary = parseStored(await storage.get(primaryKey(slot)));
    if (primary.kind === 'valid') return { save: primary.save, source: 'primary' };
    const backup = parseStored(await storage.get(backupKey(slot)));
    if (backup.kind !== 'valid') return undefined;
    return {
      save: backup.save,
      source: 'backup',
      ...(primary.kind === 'invalid' ? { primaryError: primary.error } : {}),
    };
  };

  return {
    load,
    async save(slot, state, playTime) {
      // Snapshot before the first await: the live sim may keep stepping while IndexedDB responds.
      const snapshot = structuredClone(state);
      const previous = parseStored(await storage.get(primaryKey(slot)));
      if (previous.kind === 'valid') await storage.set(backupKey(slot), previous.save);
      const save = createSaveFile(snapshot, {
        now: now(),
        ...(previous.kind === 'valid' ? { createdAt: previous.save.createdAt } : {}),
        playTime,
      });
      await storage.set(primaryKey(slot), save);
      if (!persistenceRequested) {
        persistenceRequested = true;
        void persist().catch(() => false);
      }
      return save;
    },
    async restoreBackup(slot) {
      const backup = parseStored(await storage.get(backupKey(slot)));
      if (backup.kind !== 'valid') throw new Error(`save slot ${slot} has no valid backup`);
      await storage.set(primaryKey(slot), backup.save);
      return backup.save;
    },
    async list() {
      return Promise.all(
        SAVE_SLOTS.map(async (slot): Promise<SlotSummary> => {
          const loaded = await load(slot);
          return loaded
            ? {
                slot,
                save: {
                  ...loaded.save.meta,
                  createdAt: loaded.save.createdAt,
                  updatedAt: loaded.save.updatedAt,
                },
                source: loaded.source,
                ...(loaded.primaryError ? { primaryError: loaded.primaryError } : {}),
              }
            : { slot };
        }),
      );
    },
  };
}

type StoredSave =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly error: string }
  | { readonly kind: 'valid'; readonly save: SaveFile };

function parseStored(value: unknown): StoredSave {
  if (value === undefined) return { kind: 'empty' };
  const parsed = parseSaveFile(value);
  return parsed.success
    ? { kind: 'valid', save: parsed.data }
    : { kind: 'invalid', error: parsed.error };
}

function indexedDbStore(): KeyValueStore {
  const store = createStore('bale', 'saves');
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
  };
}

async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
