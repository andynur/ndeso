import { CURRENT_SAVE_VERSION, type SaveFile, saveFileSchema } from './save.ts';

type Migration = (oldSave: Readonly<Record<string, unknown>>) => unknown;
type SaveRecord = Record<string, unknown> & { format?: unknown; version?: unknown };

/** Add `migrations[n]` when version n must be upgraded to n + 1. */
export const migrations: Readonly<Partial<Record<number, Migration>>> = {};

export type SaveParseResult =
  | { readonly success: true; readonly data: SaveFile }
  | { readonly success: false; readonly error: string };

export function parseSaveFile(value: unknown): SaveParseResult {
  try {
    const migrated = migrateSaveFile(value);
    const result = saveFileSchema.safeParse(migrated);
    return result.success
      ? { success: true, data: result.data }
      : { success: false, error: result.error.issues.map((issue) => issue.message).join('; ') };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'invalid save' };
  }
}

function migrateSaveFile(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
  let current = value as SaveRecord;
  if (current.format !== 'bale-save') throw new Error('unknown save format');
  if (!Number.isInteger(current.version)) throw new Error('missing save version');
  let version = current.version as number;
  if (version > CURRENT_SAVE_VERSION)
    throw new Error(`save version ${version} is newer than this game`);
  while (version < CURRENT_SAVE_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`no migration from save version ${version}`);
    const next = migrate(current);
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      throw new Error(`migration ${version} returned an invalid save`);
    }
    current = next as SaveRecord;
    if (current.version !== version + 1) {
      throw new Error(`migration ${version} did not produce version ${version + 1}`);
    }
    version++;
  }
  return current;
}
