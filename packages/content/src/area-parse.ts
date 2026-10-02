import { type AreaDef, validateArea } from '@bale/shared';

export function parseArea(raw: unknown, file: string): AreaDef {
  const result = validateArea(raw, file);
  if (!result.ok) throw new Error(`invalid area data:\n  ${result.errors.join('\n  ')}`);
  return result.data;
}
