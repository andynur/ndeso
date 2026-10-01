import { z } from 'zod';
import { PASARAN_IDS, parseClockTime } from '../calendar.ts';
import { clockTimeSchema, contentIdSchema, localeKeySchema } from './common.ts';

const percentRangeSchema = z
  .tuple([z.int().positive(), z.int().positive()])
  .refine(
    ([minimum, maximum]) => minimum <= maximum,
    'minimum percent must not exceed maximum percent',
  );

export const marketFileSchema = z
  .strictObject({
    id: contentIdSchema,
    nameKey: localeKeySchema,
    sellerNameKey: localeKeySchema,
    open: clockTimeSchema,
    close: clockTimeSchema,
    favorablePasaran: z.array(z.enum(PASARAN_IDS)).min(1),
    regularSellPercent: percentRangeSchema,
    favorableSellPercent: percentRangeSchema,
  })
  .superRefine((market, context) => {
    const open = parseClockTime(market.open);
    const close = parseClockTime(market.close);
    if (open !== undefined && close !== undefined && open >= close) {
      context.addIssue({
        code: 'custom',
        message: 'market open must be before close',
        path: ['close'],
        input: market.close,
      });
    }
  });
