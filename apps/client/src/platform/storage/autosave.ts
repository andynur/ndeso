import type { SavedGameState } from '@bale/shared';
import type { SaveSlot, SaveStore } from './save-store.ts';

export interface AutosaveController {
  readonly playTime: number;
  pause(): void;
  resume(): void;
  save(state: SavedGameState): Promise<void>;
  settled(): Promise<void>;
}

/** Serializes writes so a day-end save and a simultaneous tab-hide save cannot race. */
export function createAutosaveController(
  store: Pick<SaveStore, 'save'>,
  slot: SaveSlot,
  initialPlayTime = 0,
  now: () => number = () => performance.now(),
): AutosaveController {
  let elapsed = Math.max(0, initialPlayTime);
  let activeSince: number | undefined = now();
  let pending: Promise<void> = Promise.resolve();

  const playTime = (): number =>
    Math.floor(elapsed + (activeSince === undefined ? 0 : Math.max(0, now() - activeSince)));

  return {
    get playTime() {
      return playTime();
    },
    pause() {
      if (activeSince === undefined) return;
      elapsed += Math.max(0, now() - activeSince);
      activeSince = undefined;
    },
    resume() {
      if (activeSince === undefined) activeSince = now();
    },
    save(state) {
      const snapshot = structuredClone(state);
      const duration = playTime();
      pending = pending
        .catch(() => undefined)
        .then(() => store.save(slot, snapshot, duration))
        .then(() => undefined);
      return pending;
    },
    settled() {
      return pending;
    },
  };
}
