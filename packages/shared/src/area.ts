/**
 * Area layout data (PLACES §3) and the asset manifest (ASSET_PIPELINE §3).
 *
 * An area file holds what gameplay needs to know about a place — where the field, the
 * buildings and the water run — and the ids of the models that draw it. The placeholder
 * generator builds its boxes from the same numbers, so placeholder and gameplay agree, and
 * final art that keeps the ids swaps in with no code change (ASSET_PIPELINE §4).
 */

/** PLACES §1: every area file names where it is, so the culture review can find it. */
export const AREA_ORIGIN = 'Baledono, Purworejo, Jawa Tengah';

/** An axis-aligned rectangle on the ground, in world units (1 unit = 1 tile, DESIGN §1.2). */
export interface GroundRect {
  /** West edge (min x). */
  readonly x: number;
  /** North edge (min z); north is −z. */
  readonly z: number;
  readonly w: number;
  readonly d: number;
}

export type Vec2 = readonly [number, number];

export type Dir = 'north' | 'east' | 'south' | 'west';

export interface AreaExit {
  /** Walkable trigger rectangle at the area's loading edge. */
  readonly trigger: GroundRect;
  readonly to: string;
  /** Safe arrival point in the destination area. */
  readonly spawn: Vec2;
  readonly facing: Dir;
}

/** How wide a plank crossing over the kalen is, along the channel, in tiles. */
export const CROSSING_WIDTH = 2;
export type Vec3 = readonly [number, number, number];

export interface AreaDef {
  readonly id: string;
  readonly origin: string;
  /** Full extent, centred on the world origin. */
  readonly size: Vec2;
  /** Asset ids from the manifest, drawn together. */
  readonly models: readonly string[];
  readonly spawn: Vec2;
  /** Generic solid footprints used by non-farm areas. */
  readonly solids: readonly GroundRect[];
  /** Loading edges. Destination ids are checked across the complete content set. */
  readonly exits: readonly AreaExit[];
  /** Tile of the fresh-produce stall, when this area contains it. */
  readonly market?: Vec2;
  /** The farmable ground (GDD §2). */
  readonly field?: GroundRect;
  /** The joglo's footprint, platform included. */
  readonly joglo?: GroundRect;
  /** Shipping-box tile on the joglo platform (GDD §7). */
  readonly setoran?: Vec2;
  /** Chicken-coop tile (GDD §6); solid, with interaction from an adjacent tile. */
  readonly coop?: Vec2;
  /**
   * The kalen, a channel of `width` along axis-aligned segments between `points`. It blocks
   * walking except at `crossings`: points on the channel where a plank (*wot*) spans it,
   * each `CROSSING_WIDTH` wide.
   */
  readonly kalen?: {
    readonly points: readonly Vec2[];
    readonly width: number;
    readonly crossings: readonly Vec2[];
  };
  /** Teras lamps (DESIGN §1.3: max 4 active). */
  readonly lamps: readonly Vec3[];
}

/** The Balé base has the systems that are intentionally absent from ordinary areas. */
export type FarmAreaDef = AreaDef &
  Required<Pick<AreaDef, 'field' | 'joglo' | 'setoran' | 'coop' | 'kalen'>>;

export function isFarmArea(area: AreaDef): area is FarmAreaDef {
  return Boolean(area.field && area.joglo && area.setoran && area.coop && area.kalen);
}

export type AreaResult =
  | { readonly ok: true; readonly data: AreaDef }
  | { readonly ok: false; readonly errors: readonly string[] };

type Field =
  | 'id'
  | 'origin'
  | 'size'
  | 'models'
  | 'spawn'
  | 'solids'
  | 'exits'
  | 'trigger'
  | 'to'
  | 'facing'
  | 'market'
  | 'field'
  | 'joglo'
  | 'setoran'
  | 'coop'
  | 'kalen'
  | 'lamps'
  | 'points'
  | 'width'
  | 'crossings'
  | 'x'
  | 'z'
  | 'w'
  | 'd';
type Obj = Partial<Readonly<Record<Field, unknown>>>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isTuple = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every(isFiniteNumber);

const SNAKE_ID = /^[a-z][a-z0-9_]*$/;

/** Max point lights any preset allows (PERFORMANCE_BUDGET §4). */
const MAX_LAMPS = 4;

/** Whether `point` lies on one of the axis-aligned segments between `points`. */
function onPolyline(points: readonly Vec2[], [x, z]: Vec2): boolean {
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1] as Vec2;
    const [bx, bz] = points[i] as Vec2;
    const inX = x >= Math.min(ax, bx) && x <= Math.max(ax, bx);
    const inZ = z >= Math.min(az, bz) && z <= Math.max(az, bz);
    if (inX && inZ) return true;
  }
  return false;
}

export function validateArea(raw: unknown, file: string): AreaResult {
  const errors: string[] = [];
  const err = (message: string) => errors.push(`${file}: ${message}`);
  if (!isObj(raw)) return { ok: false, errors: [`${file}: is not an object`] };

  const { id, origin, size, models, spawn, setoran, coop, kalen, lamps, market } = raw;
  if (typeof id !== 'string' || !SNAKE_ID.test(id)) err('id must be a snake_case id');
  if (origin !== AREA_ORIGIN) err(`origin must be '${AREA_ORIGIN}' (PLACES §1)`);
  if (!isTuple(size, 2) || size.some((n) => n <= 0)) err('size must be [w, d], both > 0');
  if (
    !Array.isArray(models) ||
    models.length === 0 ||
    !models.every((m) => typeof m === 'string' && SNAKE_ID.test(m))
  ) {
    err('models must be a non-empty list of snake_case asset ids');
  }
  if (!isTuple(spawn, 2)) err('spawn must be [x, z]');

  const [halfW, halfD] = isTuple(size, 2)
    ? [(size[0] as number) / 2, (size[1] as number) / 2]
    : [0, 0];
  const inside = (x: number, z: number) => Math.abs(x) <= halfW && Math.abs(z) <= halfD;
  if (isTuple(spawn, 2) && !inside(spawn[0] as number, spawn[1] as number)) {
    err('spawn lies outside the area');
  }

  const rects: Record<'field' | 'joglo', GroundRect | undefined> = {
    field: undefined,
    joglo: undefined,
  };
  for (const name of ['field', 'joglo'] as const) {
    const rect = raw[name];
    if (rect === undefined) continue;
    if (
      !isObj(rect) ||
      !isFiniteNumber(rect.x) ||
      !isFiniteNumber(rect.z) ||
      !isFiniteNumber(rect.w) ||
      !isFiniteNumber(rect.d) ||
      rect.w <= 0 ||
      rect.d <= 0
    ) {
      err(`${name} must be { x, z, w, d } with w, d > 0`);
      continue;
    }
    const value = { x: rect.x, z: rect.z, w: rect.w, d: rect.d };
    if (!inside(value.x, value.z) || !inside(value.x + value.w, value.z + value.d)) {
      err(`${name} lies outside the area`);
    }
    rects[name] = value;
  }

  if (setoran !== undefined && (!isTuple(setoran, 2) || !setoran.every(Number.isInteger))) {
    err('setoran must be an integer [x, z] tile');
  } else if (isTuple(setoran, 2)) {
    const [x, z] = setoran as [number, number];
    const joglo = rects.joglo;
    if (
      joglo !== undefined &&
      (x < joglo.x || x + 1 > joglo.x + joglo.w || z < joglo.z || z + 1 > joglo.z + joglo.d)
    ) {
      err('setoran tile must lie on the joglo');
    }
  }

  if (coop !== undefined && (!isTuple(coop, 2) || !coop.every(Number.isInteger))) {
    err('coop must be an integer [x, z] tile');
  } else if (isTuple(coop, 2)) {
    const [x, z] = coop as [number, number];
    if (!inside(x, z) || !inside(x + 1, z + 1)) err('coop tile lies outside the area');
    if (isTuple(spawn, 2)) {
      const [spawnX, spawnZ] = spawn as [number, number];
      if (spawnX >= x && spawnX < x + 1 && spawnZ >= z && spawnZ < z + 1) {
        err('coop tile overlaps the spawn');
      }
    }
    for (const [name, rect] of Object.entries(rects)) {
      if (rect && x < rect.x + rect.w && x + 1 > rect.x && z < rect.z + rect.d && z + 1 > rect.z) {
        err(`coop tile overlaps the ${name}`);
      }
    }
  }

  let kalenDef: AreaDef['kalen'];
  if (
    kalen !== undefined &&
    (!isObj(kalen) ||
      !Array.isArray(kalen.points) ||
      kalen.points.length < 2 ||
      !kalen.points.every((p) => isTuple(p, 2)) ||
      !isFiniteNumber(kalen.width) ||
      kalen.width <= 0)
  ) {
    err('kalen must be { points: [[x, z], …≥ 2], width > 0 }');
  } else if (isObj(kalen)) {
    const points = kalen.points as unknown as Vec2[];
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1] as Vec2;
      const [bx, bz] = points[i] as Vec2;
      if (ax !== bx && az !== bz) err(`kalen segment ${i} must run along x or z`);
      if (ax === bx && az === bz) err(`kalen segment ${i} has zero length`);
    }
    const crossings = kalen.crossings ?? [];
    if (!Array.isArray(crossings) || !crossings.every((p) => isTuple(p, 2))) {
      err('kalen.crossings must be a list of [x, z] points');
    } else {
      for (const [i, point] of (crossings as unknown as Vec2[]).entries()) {
        if (!onPolyline(points, point)) err(`kalen crossing ${i} must lie on the kalen`);
      }
    }
    kalenDef = {
      points,
      width: kalen.width as number,
      crossings: crossings as unknown as Vec2[],
    };
  }

  const readRectList = (name: 'solids'): GroundRect[] => {
    const value = raw[name] ?? [];
    if (!Array.isArray(value)) {
      err(`${name} must be a list of { x, z, w, d } rectangles`);
      return [];
    }
    const result: GroundRect[] = [];
    for (const [index, entry] of value.entries()) {
      if (
        !isObj(entry) ||
        !isFiniteNumber(entry.x) ||
        !isFiniteNumber(entry.z) ||
        !isFiniteNumber(entry.w) ||
        !isFiniteNumber(entry.d) ||
        entry.w <= 0 ||
        entry.d <= 0
      ) {
        err(`${name}.${index} must be { x, z, w, d } with w, d > 0`);
        continue;
      }
      const rect = { x: entry.x, z: entry.z, w: entry.w, d: entry.d };
      if (!inside(rect.x, rect.z) || !inside(rect.x + rect.w, rect.z + rect.d)) {
        err(`${name}.${index} lies outside the area`);
      }
      result.push(rect);
    }
    return result;
  };
  const solids = readRectList('solids');

  const exits: AreaExit[] = [];
  const rawExits = raw.exits ?? [];
  if (!Array.isArray(rawExits)) err('exits must be a list');
  else {
    for (const [index, exit] of rawExits.entries()) {
      if (!isObj(exit)) {
        err(`exits.${index} must be an object`);
        continue;
      }
      const trigger = exit.trigger;
      const facing = exit.facing;
      if (
        !isObj(trigger) ||
        !isFiniteNumber(trigger.x) ||
        !isFiniteNumber(trigger.z) ||
        !isFiniteNumber(trigger.w) ||
        !isFiniteNumber(trigger.d) ||
        trigger.w <= 0 ||
        trigger.d <= 0
      ) {
        err(`exits.${index}.trigger must be { x, z, w, d } with w, d > 0`);
        continue;
      }
      const rect = { x: trigger.x, z: trigger.z, w: trigger.w, d: trigger.d };
      if (!inside(rect.x, rect.z) || !inside(rect.x + rect.w, rect.z + rect.d)) {
        err(`exits.${index}.trigger lies outside the area`);
      }
      if (typeof exit.to !== 'string' || !SNAKE_ID.test(exit.to)) {
        err(`exits.${index}.to must be a snake_case area id`);
        continue;
      }
      if (!isTuple(exit.spawn, 2)) {
        err(`exits.${index}.spawn must be [x, z]`);
        continue;
      }
      if (facing !== 'north' && facing !== 'east' && facing !== 'south' && facing !== 'west') {
        err(`exits.${index}.facing must be north, east, south, or west`);
        continue;
      }
      exits.push({ trigger: rect, to: exit.to, spawn: exit.spawn as unknown as Vec2, facing });
    }
  }

  if (market !== undefined && (!isTuple(market, 2) || !market.every(Number.isInteger))) {
    err('market must be an integer [x, z] tile');
  } else if (isTuple(market, 2) && !inside(market[0] as number, market[1] as number)) {
    err('market tile lies outside the area');
  }

  const baseFeatures = [rects.field, rects.joglo, setoran, coop, kalenDef];
  if (baseFeatures.some(Boolean) && !baseFeatures.every(Boolean)) {
    err('field, joglo, setoran, coop, and kalen must be defined together');
  }

  if (
    !Array.isArray(lamps) ||
    lamps.length > MAX_LAMPS ||
    !lamps.every((lamp) => isTuple(lamp, 3))
  ) {
    err(`lamps must be at most ${MAX_LAMPS} [x, y, z] points`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      id: id as string,
      origin: origin as string,
      size: size as unknown as Vec2,
      models: models as string[],
      spawn: spawn as unknown as Vec2,
      solids,
      exits,
      ...(market === undefined ? {} : { market: market as unknown as Vec2 }),
      ...(rects.field === undefined ? {} : { field: rects.field }),
      ...(rects.joglo === undefined ? {} : { joglo: rects.joglo }),
      ...(setoran === undefined ? {} : { setoran: setoran as unknown as Vec2 }),
      ...(coop === undefined ? {} : { coop: coop as unknown as Vec2 }),
      ...(kalenDef === undefined ? {} : { kalen: kalenDef }),
      lamps: lamps as unknown as Vec3[],
    },
  };
}

/** One generated asset, as `assets/manifest.json` lists it. */
export interface AssetEntry {
  /** Relative to the manifest's own URL, content-hashed. */
  readonly url: string;
  readonly bytes: number;
  readonly type: string;
}

export type AssetManifest = Readonly<Record<string, AssetEntry>>;

/** Checks a fetched manifest's shape; returns undefined when it is not one. */
export function parseAssetManifest(raw: unknown): AssetManifest | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  for (const entry of Object.values(raw)) {
    if (typeof entry !== 'object' || entry === null) return undefined;
    const { url, bytes, type } = entry as Partial<Record<keyof AssetEntry, unknown>>;
    if (typeof url !== 'string' || typeof bytes !== 'number' || typeof type !== 'string') {
      return undefined;
    }
  }
  return raw as AssetManifest;
}
