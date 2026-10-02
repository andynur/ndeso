import { z } from 'zod';
import { SAVE_FORMAT } from './constants.ts';

export const CURRENT_SAVE_VERSION = 1;

const finite = z.number().finite();
const nonNegativeInt = z.number().int().nonnegative();
const dirSchema = z.enum(['north', 'east', 'south', 'west']);

const inventorySlotSchema = z.union([
  z.object({ kind: z.literal('tool'), id: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('item'),
      id: z.string().min(1),
      quantity: z.number().int().positive(),
    })
    .strict(),
  z.null(),
]);

const dayEndSummarySchema = z
  .object({
    day: nonNegativeInt,
    reason: z.enum(['sleep', 'exhausted', 'late']),
    staminaRemaining: nonNegativeInt,
    moneyLost: nonNegativeInt,
  })
  .strict();

const farmLocationSchema = z.object({
  area: z.string().min(1),
  x: z.number().int(),
  z: z.number().int(),
});

const emptyFarmTileSchema = farmLocationSchema
  .extend({
    plot: z.enum(['tegalan', 'kebun']),
    watered: z.boolean(),
    phase: z.enum(['untilled', 'tilled']),
  })
  .strict();

const cropFields = {
  cropId: z.string().min(1),
  growthDays: nonNegativeInt,
  dryDays: nonNegativeInt,
  phase: z.enum(['seeded', 'mature', 'withered']),
};

const cropFarmTileSchema = farmLocationSchema
  .extend({
    plot: z.enum(['tegalan', 'kebun']),
    watered: z.boolean(),
    ...cropFields,
  })
  .strict();

const emptySawahTileSchema = farmLocationSchema
  .extend({
    plot: z.literal('sawah'),
    waterLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    phase: z.enum(['untilled', 'tilled']),
  })
  .strict();

const cropSawahTileSchema = farmLocationSchema
  .extend({
    plot: z.literal('sawah'),
    waterLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    ...cropFields,
  })
  .strict();

export const gameStateSchema = z
  .object({
    clock: z.object({ tick: nonNegativeInt, day: nonNegativeInt, minute: nonNegativeInt }).strict(),
    seed: nonNegativeInt.max(0xffff_ffff),
    weather: z
      .object({
        today: z.enum(['clear', 'cloudy', 'rain', 'storm']),
        tomorrow: z.enum(['clear', 'cloudy', 'rain', 'storm']),
      })
      .strict(),
    player: z
      .object({
        area: z.string().min(1),
        x: finite,
        z: finite,
        facing: dirSchema,
        moveX: finite.min(-1).max(1),
        moveZ: finite.min(-1).max(1),
        stamina: nonNegativeInt,
        maxStamina: z.number().int().positive(),
        money: nonNegativeInt,
        dayEndSummary: dayEndSummarySchema.nullable(),
        inventory: z.array(inventorySlotSchema).length(9),
        selectedSlot: z.number().int().min(0).max(8),
      })
      .strict()
      .refine((player) => player.stamina <= player.maxStamina, {
        message: 'stamina must not exceed maxStamina',
        path: ['stamina'],
      }),
    farm: z
      .object({
        tiles: z.record(
          z.string(),
          z.union([
            emptyFarmTileSchema,
            cropFarmTileSchema,
            emptySawahTileSchema,
            cropSawahTileSchema,
          ]),
        ),
      })
      .strict(),
    shipping: z.object({ items: z.record(z.string(), nonNegativeInt) }).strict(),
    npcs: z.array(
      z
        .object({
          id: z.string().min(1),
          area: z.string(),
          x: finite,
          z: finite,
          facing: dirSchema,
          anim: z.string().min(1),
          active: z.boolean(),
          moving: z.boolean(),
          scheduleDay: z.number().int(),
          scheduleIndex: z.number().int(),
          entryIndex: z.number().int(),
        })
        .strict(),
    ),
    animals: z.record(
      z.string(),
      z
        .object({
          id: z.string().min(1),
          speciesId: z.string().min(1),
          area: z.string().min(1),
          affection: nonNegativeInt,
          fed: z.boolean(),
          petted: z.boolean(),
          products: z.record(z.string(), nonNegativeInt),
        })
        .strict(),
    ),
  })
  .strict();

const isoTimestampSchema = z.string().datetime({ offset: true });

export const saveFileSchema = z
  .object({
    format: z.literal(SAVE_FORMAT),
    version: z.literal(CURRENT_SAVE_VERSION),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    meta: z
      .object({ day: nonNegativeInt, money: nonNegativeInt, playTime: nonNegativeInt })
      .strict(),
    state: gameStateSchema,
  })
  .strict()
  .refine((save) => save.meta.day === save.state.clock.day, {
    message: 'meta.day must match state.clock.day',
    path: ['meta', 'day'],
  })
  .refine((save) => save.meta.money === save.state.player.money, {
    message: 'meta.money must match state.player.money',
    path: ['meta', 'money'],
  });

export type SavedGameState = z.infer<typeof gameStateSchema>;
export type SaveFile = z.infer<typeof saveFileSchema>;

export interface CreateSaveOptions {
  readonly now?: Date;
  readonly createdAt?: string;
  /** Active play time in whole milliseconds. */
  readonly playTime?: number;
}

export function createSaveFile(state: SavedGameState, options: CreateSaveOptions = {}): SaveFile {
  const updatedAt = (options.now ?? new Date()).toISOString();
  return saveFileSchema.parse({
    format: SAVE_FORMAT,
    version: CURRENT_SAVE_VERSION,
    createdAt: options.createdAt ?? updatedAt,
    updatedAt,
    meta: {
      day: state.clock.day,
      money: state.player.money,
      playTime: Math.max(0, Math.floor(options.playTime ?? 0)),
    },
    state: structuredClone(state),
  });
}
