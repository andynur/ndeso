import { z } from 'zod';

export const contentIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, 'must be a snake_case id');

export const localeKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*:[a-z0-9_]+(?:\.[a-z0-9_]+)*$/, 'must be a namespaced locale key');

export const originSchema = z.string().trim().min(1, 'must name the content origin');

export const clockTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "must be a 24-hour 'HH:MM' time");

export function uniqueIds<T extends { readonly id: string }>(
  entries: readonly T[],
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.id)) {
      context.addIssue({
        code: 'custom',
        message: `duplicate id '${entry.id}'`,
        path: [index, 'id'],
        input: entry.id,
      });
    }
    seen.add(entry.id);
  }
}
