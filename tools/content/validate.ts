import { validateArea, validateCalendar, validateLighting, validatePlayer } from '@bale/shared';
import {
  animalsFileSchema,
  clockFileSchema,
  cropsSchema,
  itemsSchema,
  marketFileSchema,
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
  const areas: { readonly file: string; readonly data: import('@bale/shared').AreaDef }[] = [];
  const npcIds = new Set<string>();
  const cropIds = new Set<string>();
  const toolIds = new Set<string>();
  const itemIds = new Set<string>();

  for (const [file, raw] of files) {
    if (file.startsWith('areas/') && file.endsWith('.json5')) {
      const result = validateArea(raw, file);
      if (result.ok) {
        if (areaIds.has(result.data.id)) {
          problems.push({ file, message: `duplicate area id '${result.data.id}'` });
        }
        areaIds.add(result.data.id);
        areas.push({ file, data: result.data });
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
      file === 'animals.json5'
        ? animalsFileSchema
        : file === 'crops.json5'
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
                      : file === 'market.json5'
                        ? marketFileSchema
                        : undefined;
    if (schema !== undefined) {
      problems.push(...zodProblems(file, schema, raw));
      const result = schema.safeParse(raw);
      if (result.success && Array.isArray(result.data)) {
        const ids = result.data as { readonly id: string }[];
        if (file === 'crops.json5') for (const entry of ids) cropIds.add(entry.id);
        if (file === 'items.json5') for (const entry of ids) itemIds.add(entry.id);
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

  for (const area of areas) {
    for (const [index, exit] of area.data.exits.entries()) {
      const destination = areas.find((candidate) => candidate.data.id === exit.to)?.data;
      if (!destination) {
        problems.push({
          file: area.file,
          message: `exits.${index}.to references missing area '${exit.to}'`,
        });
        continue;
      }
      const [x, z] = exit.spawn;
      if (Math.abs(x) > destination.size[0] / 2 || Math.abs(z) > destination.size[1] / 2) {
        problems.push({
          file: area.file,
          message: `exits.${index}.spawn lies outside destination '${exit.to}'`,
        });
      }
      if (
        destination.exits.some(
          ({ trigger }) =>
            x >= trigger.x &&
            x < trigger.x + trigger.w &&
            z >= trigger.z &&
            z < trigger.z + trigger.d,
        )
      ) {
        problems.push({
          file: area.file,
          message: `exits.${index}.spawn overlaps a destination exit in '${exit.to}'`,
        });
      }
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

  const animals = animalsFileSchema.safeParse(files.get('animals.json5'));
  if (!files.has('animals.json5')) {
    problems.push({ file: 'animals.json5', message: 'required animal file is missing' });
  } else if (animals.success) {
    const itemById = new Map(items.success ? items.data.map((item) => [item.id, item]) : []);
    for (const species of animals.data.species) {
      for (const field of ['feedItemId', 'productItemId', 'goodProductItemId'] as const) {
        if (!itemIds.has(species[field])) {
          problems.push({
            file: 'animals.json5',
            message: `${species.id}.${field} references missing item '${species[field]}'`,
          });
        }
      }
      const feed = itemById.get(species.feedItemId);
      const product = itemById.get(species.productItemId);
      const goodProduct = itemById.get(species.goodProductItemId);
      if (feed && feed.kind !== 'feed') {
        problems.push({
          file: 'animals.json5',
          message: `${species.id}.feedItemId must reference a feed item`,
        });
      }
      if (product && product.kind !== 'animal_product') {
        problems.push({
          file: 'animals.json5',
          message: `${species.id}.productItemId must reference an animal_product item`,
        });
      }
      if (goodProduct && goodProduct.kind !== 'animal_product') {
        problems.push({
          file: 'animals.json5',
          message: `${species.id}.goodProductItemId must reference an animal_product item`,
        });
      }
      if (
        product?.sellPrice !== null &&
        product?.sellPrice !== undefined &&
        goodProduct?.sellPrice !== Math.round(product.sellPrice * 1.5)
      ) {
        problems.push({
          file: 'animals.json5',
          message: `${species.id}.goodProductItemId must be worth 150% of its ordinary product`,
        });
      }
    }
    for (const resident of animals.data.residents) {
      if (!areaIds.has(resident.area)) {
        problems.push({
          file: 'animals.json5',
          message: `${resident.id}.area references missing area '${resident.area}'`,
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
