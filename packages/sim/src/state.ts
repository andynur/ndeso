import type { AreaDef, CalendarData, PlayerData, WeatherData } from '@bale/shared';
import { createEconomyState, type EconomyState } from './systems/economy.ts';
import { createFarmingState, type FarmingState, type FarmPlot } from './systems/farming.ts';
import { createInventoryPlayerState, type InventoryState } from './systems/inventory.ts';
import { createPlayerState, type MovementState } from './systems/movement.ts';
import { createPlayerProgress, type PlayerProgressState } from './systems/player.ts';
import { createTimeState, type TimeState } from './systems/time.ts';
import { createWeatherState, DEFAULT_GAME_SEED, type WeatherState } from './systems/weather.ts';

/**
 * The sim state so far (ARCHITECTURE §3.3 sketch): each system's slice, joined. Grows task
 * by task; the saved schema arrives with `save.ts`.
 */
export type GameState = TimeState &
  MovementState &
  PlayerProgressState &
  FarmingState &
  InventoryState &
  EconomyState &
  WeatherState;

export function createGameState(
  cal: CalendarData,
  area: AreaDef,
  playerData: PlayerData,
  weather: WeatherData,
  seed = DEFAULT_GAME_SEED,
): GameState {
  const plots: FarmPlot[] = [];
  const xEnd = area.field.x + area.field.w;
  const zEnd = area.field.z + area.field.d;
  for (let x = area.field.x; x < xEnd; x++) {
    for (let z = area.field.z; z < zEnd; z++) {
      plots.push({ area: area.id, x, z, plot: 'tegalan' as const });
    }
  }
  const time = createTimeState(cal);
  return {
    ...time,
    ...createWeatherState(seed, time.clock.day, cal, weather),
    player: {
      ...createPlayerState(area),
      ...createInventoryPlayerState(playerData),
      ...createPlayerProgress(),
    },
    ...createEconomyState(),
    ...createFarmingState(plots),
  };
}
