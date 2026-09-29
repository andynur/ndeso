import { validateArea, validateCalendar, validateLighting, validatePlayer } from '@bale/shared';
import {
  clockFileSchema,
  cropsSchema,
  itemsSchema,
  monthsFileSchema,
  npcSchema,
  prayerTimesFileSchema,
  toolsSchema,
  weatherFileSchema,
} from '@bale/shared/content';

interface Schema {
  safeParse(input: unknown):
    | { readonly success: true; readonly data: unknown }
    | {
        readonly success: false;
        readonly error: {
          readonly issues: readonly {
            readonly path: readonly PropertyKey[];
            readonly message: string;
          }[];
        };
      };
}

export interface ContentProblem {
  readonly file: string;
  readonly message: string;
}

const CALENDAR_FILES = [
  'calendar/months.json5',
  'calendar/clock.json5',
  'calendar/prayer-times.json5',
] as const;

function zodProblems(file: string, schema: Schema, raw: unknown): ContentProblem[] {
  const result = schema.safeParse(raw);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    file,
    message: `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`,
  }));
}

function localeReferences(value: unknown, path: readonly (string | number)[] = []): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => localeReferences(entry, [...path, index]));
  }
  if (typeof value !== 'object' || value === null) return [];
  const references: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith('Key') && typeof child === 'string') {
      references.push(`${[...path, key].join('.')}:${child}`);
    }
    references.push(...localeReferences(child, [...path, key]));
  }
  return references;
}

export function validateContentSet(
  files: ReadonlyMap<string, unknown>,
  localeKeys: ReadonlySet<string>,
): ContentProblem[] {
  const problems: ContentProblem[] = [];
  const areaIds = new Set<string>();
  const npcIds = new Set<string>();
  const cropIds = new Set<string>();
  const toolIds = new Set<string>();

  for (const [file, raw] of files) {
    if (file.startsWith('areas/') && file.endsWith('.json5')) {
      const result = validateArea(raw, file);
      if (result.ok) {
        if (areaIds.has(result.data.id)) {
          problems.push({ file, message: `duplicate area id '${result.data.id}'` });
        }
        areaIds.add(result.data.id);
      } else problems.push(...result.errors.map((message) => ({ file, message })));
      continue;
    }
    if (file.startsWith('npcs/') && file.endsWith('.json5')) {
      problems.push(...zodProblems(file, npcSchema, raw));
      const result = npcSchema.safeParse(raw);
      if (result.success) {
        if (npcIds.has(result.data.id)) {
          problems.push({ file, message: `duplicate NPC id '${result.data.id}'` });
        }
        npcIds.add(result.data.id);
      }
      continue;
    }
    const schema =
      file === 'crops.json5'
        ? cropsSchema
        : file === 'items.json5'
          ? itemsSchema
          : file === 'tools.json5'
            ? toolsSchema
            : file === 'calendar/months.json5'
              ? monthsFileSchema
              : file === 'calendar/clock.json5'
                ? clockFileSchema
                : file === 'calendar/prayer-times.json5'
                  ? prayerTimesFileSchema
                  : file === 'weather.json5'
                    ? weatherFileSchema
                    : undefined;
    if (schema !== undefined) {
      problems.push(...zodProblems(file, schema, raw));
      const result = schema.safeParse(raw);
      if (result.success && Array.isArray(result.data)) {
        const ids = result.data as { readonly id: string }[];
        if (file === 'crops.json5') for (const entry of ids) cropIds.add(entry.id);
        if (file === 'tools.json5') for (const entry of ids) toolIds.add(entry.id);
      }
    } else if (file === 'lighting.json5') {
      const result = validateLighting(raw);
      if (!result.ok) problems.push(...result.errors.map((message) => ({ file, message })));
    } else if (file === 'player.json5') {
      const result = validatePlayer(raw);
      if (!result.ok) problems.push(...result.errors.map((message) => ({ file, message })));
    } else {
      problems.push({ file, message: 'no content schema registered for this file' });
    }
  }

  for (const file of ['items.json5', 'tools.json5'] as const) {
    if (!files.has(file)) problems.push({ file, message: 'required inventory file is missing' });
  }

  const crops = cropsSchema.safeParse(files.get('crops.json5'));
  const items = itemsSchema.safeParse(files.get('items.json5'));
  if (items.success) {
    const cropById = new Map(crops.success ? crops.data.map((crop) => [crop.id, crop]) : []);
    const seeds = new Set<string>();
    const products = new Set<string>();
    for (const item of items.data) {
      if (item.kind !== 'seed' && item.kind !== 'produce') continue;
      if (!cropIds.has(item.cropId)) {
        problems.push({
          file: 'items.json5',
          message: `${item.id}.cropId references missing crop '${item.cropId}'`,
        });
      }
      if (item.kind === 'produce') {
        if (products.has(item.cropId)) {
          problems.push({
            file: 'items.json5',
            message: `more than one produce item references crop '${item.cropId}'`,
          });
        }
        products.add(item.cropId);
        const crop = cropById.get(item.cropId);
        if (crop && item.sellPrice !== crop.sellPrice) {
          problems.push({
            file: 'items.json5',
            message: `${item.id}.sellPrice must match crop '${item.cropId}' sellPrice`,
          });
        }
      } else {
        if (seeds.has(item.cropId)) {
          problems.push({
            file: 'items.json5',
            message: `more than one seed item references crop '${item.cropId}'`,
          });
        }
        seeds.add(item.cropId);
        const crop = cropById.get(item.cropId);
        if (crop && item.buyPrice !== crop.seedPrice) {
          problems.push({
            file: 'items.json5',
            message: `${item.id}.buyPrice must match crop '${item.cropId}' seedPrice`,
          });
        }
      }
    }
    for (const cropId of cropIds) {
      if (!products.has(cropId)) {
        problems.push({ file: 'items.json5', message: `crop '${cropId}' has no produce item` });
      }
      if (!seeds.has(cropId)) {
        problems.push({ file: 'items.json5', message: `crop '${cropId}' has no seed item` });
      }
    }
  }

  const player = validatePlayer(files.get('player.json5'));
  if (player.ok && items.success) {
    const itemById = new Map(items.data.map((item) => [item.id, item]));
    for (const [index, entry] of player.data.inventory.entries()) {
      if (entry.kind === 'tool') {
        if (!toolIds.has(entry.id)) {
          problems.push({
            file: 'player.json5',
            message: `inventory.${index}.id references missing tool '${entry.id}'`,
          });
        }
        continue;
      }
      const item = itemById.get(entry.id);
      if (!item) {
        problems.push({
          file: 'player.json5',
          message: `inventory.${index}.id references missing item '${entry.id}'`,
        });
      } else if (entry.quantity > item.stackSize) {
        problems.push({
          file: 'player.json5',
          message: `inventory.${index}.quantity exceeds ${entry.id} stack size ${item.stackSize}`,
        });
      }
    }
  }

  if (CALENDAR_FILES.every((file) => files.has(file))) {
    const result = validateCalendar({
      months: files.get('calendar/months.json5'),
      clock: files.get('calendar/clock.json5'),
      prayerTimes: files.get('calendar/prayer-times.json5'),
    });
    if (!result.ok) {
      problems.push(
        ...result.errors.map((message) => ({ file: 'calendar', message: `calendar: ${message}` })),
      );
    }
  } else {
    for (const file of CALENDAR_FILES) {
      if (!files.has(file)) problems.push({ file, message: 'required calendar file is missing' });
    }
  }

  for (const [file, raw] of files) {
    for (const reference of localeReferences(raw)) {
      const separator = reference.indexOf(':');
      const path = reference.slice(0, separator);
      const key = reference.slice(separator + 1);
      if (!localeKeys.has(key))
        problems.push({ file, message: `${path} references missing '${key}'` });
    }
  }

  for (const [file, raw] of files) {
    if (!file.startsWith('npcs/')) continue;
    const result = npcSchema.safeParse(raw);
    if (!result.success) continue;
    for (const [ruleIndex, rule] of result.data.schedules.entries()) {
      for (const [entryIndex, entry] of rule.entries.entries()) {
        if (!areaIds.has(entry.area)) {
          problems.push({
            file,
            message: `schedules.${ruleIndex}.entries.${entryIndex}.area references missing area '${entry.area}'`,
          });
        }
      }
    }
  }

  return problems;
}
