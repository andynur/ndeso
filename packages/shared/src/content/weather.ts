import { z } from 'zod';
import { MASEHI_MONTH_IDS } from '../calendar.ts';
import { WEATHER_IDS } from '../weather.ts';

export const weatherFileSchema = z
  .strictObject({
    byMonth: z
      .array(
        z.strictObject({
          month: z.enum(MASEHI_MONTH_IDS),
          weights: z.strictObject({
            clear: z.int().min(0).max(100),
            cloudy: z.int().min(0).max(100),
            rain: z.int().min(0).max(100),
            storm: z.int().min(0).max(100),
          }),
        }),
      )
      .length(MASEHI_MONTH_IDS.length),
  })
  .superRefine((file, context) => {
    for (const [index, row] of file.byMonth.entries()) {
      if (row.month !== MASEHI_MONTH_IDS[index]) {
        context.addIssue({
          code: 'custom',
          message: `byMonth must have [${MASEHI_MONTH_IDS.join(', ')}] in order`,
          path: ['byMonth', index, 'month'],
          input: row.month,
        });
      }
      const total = WEATHER_IDS.reduce((sum, id) => sum + row.weights[id], 0);
      if (total !== 100) {
        context.addIssue({
          code: 'custom',
          message: `weather weights must total 100, got ${total}`,
          path: ['byMonth', index, 'weights'],
          input: row.weights,
        });
      }
    }
  });
