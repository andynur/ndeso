/// <reference path="./json5.d.ts" />
import { type PlayerData, validatePlayer } from '@bale/shared';
import player from '../data/player.json5';

/** Player movement tuning for the browser, inlined by the bundler and validated at import. */
function load(): PlayerData {
  const result = validatePlayer(player);
  if (!result.ok) throw new Error(`invalid player data:\n  ${result.errors.join('\n  ')}`);
  return result.data;
}

export const PLAYER_DATA: PlayerData = load();
