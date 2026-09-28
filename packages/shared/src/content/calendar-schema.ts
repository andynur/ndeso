import { z } from 'zod';
import { MASEHI_MONTH_IDS, MUSIM_IDS, PRAYER_BAND_IDS } from '../calendar.ts';
import { clockTimeSchema } from './common.ts';

const orderedIds = <T extends readonly string[]>(ids: T, label: string) =>
  z
    .array(z.enum(ids))
    .length(ids.length)
    .refine((values) => values.every((id, i) => id === ids[i]), {
      message: `${label} must be [${ids.join(', ')}] in order`,
    });

export const monthsFileSchema = z
  .strictObject({
    gameYearDays: z.int().positive(),
    months: z
      .array(
        z.strictObject({
          id: z.enum(MASEHI_MONTH_IDS),
          musim: z.enum(MUSIM_IDS),
        }),
      )
      .length(MASEHI_MONTH_IDS.length),
  })
  .superRefine((file, context) => {
    if (file.gameYearDays % 12 !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'gameYearDays must be a multiple of 12',
        path: ['gameYearDays'],
        input: file.gameYearDays,
      });
    }
    if (file.gameYearDays % 5 !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'gameYearDays must be a multiple of 5',
        path: ['gameYearDays'],
        input: file.gameYearDays,
      });
    }
    if (!file.months.every((month, index) => month.id === MASEHI_MONTH_IDS[index])) {
      context.addIssue({
        code: 'custom',
        message: `months must be [${MASEHI_MONTH_IDS.join(', ')}] in order`,
        path: ['months'],
        input: file.months,
      });
    }
  });

export const prayerTimesFileSchema = z.strictObject({
  verified: z.boolean(),
  bands: orderedIds(PRAYER_BAND_IDS, 'bands'),
  byMonth: z
    .array(
      z.strictObject({
        month: z.enum(MASEHI_MONTH_IDS),
        starts: z.array(clockTimeSchema).length(PRAYER_BAND_IDS.length),
      }),
    )
    .length(MASEHI_MONTH_IDS.length)
    .superRefine((rows, context) => {
      if (!rows.every((row, index) => row.month === MASEHI_MONTH_IDS[index])) {
        context.addIssue({
          code: 'custom',
          message: `byMonth must have [${MASEHI_MONTH_IDS.join(', ')}] in order`,
          input: rows,
        });
      }
      for (const [rowIndex, row] of rows.entries()) {
        if (row.starts.some((time, index) => index > 0 && time <= (row.starts[index - 1] ?? ''))) {
          context.addIssue({
            code: 'custom',
            message: 'starts must be strictly increasing',
            path: [rowIndex, 'starts'],
            input: row.starts,
          });
        }
      }
    }),
});

export const clockFileSchema = z
  .strictObject({
    ticksPerMinute: z.int().positive(),
    dayStartMinute: z.int().min(1).max(1439),
    dayEndMinute: z.int().positive(),
    arrival: z.strictObject({
      year: z.int().positive(),
      month: z.int().min(1).max(12),
      day: z.int().min(1).max(31),
    }),
    jawa: z.strictObject({
      hijriYearOffset: z.int().positive(),
      alipYear: z.int().positive(),
    }),
  })
  .refine((clock) => clock.dayEndMinute > clock.dayStartMinute, {
    message: 'dayEndMinute must be after dayStartMinute',
    path: ['dayEndMinute'],
  })
  .refine((clock) => clock.dayEndMinute - clock.dayStartMinute <= 1440, {
    message: 'game day must be at most 24 hours',
    path: ['dayEndMinute'],
  });
