/** Values shared by sim, client, and tools. Game balance numbers live in content, not here. */

/** Fixed simulation step: 10 ticks per real second (ARCHITECTURE §3.1). */
export const TICKS_PER_SECOND = 10;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** Save schema version. Bump it together with a migration (ARCHITECTURE §5). */
export const SAVE_VERSION = 1;

/** Magic string stored in every save file so a foreign JSON is rejected early. */
export const SAVE_FORMAT = 'bale-save';
