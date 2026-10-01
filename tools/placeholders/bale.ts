/**
 * Placeholder models for Balé (PLACES §3, ring 0), built from `areas/bale.json5`: the
 * overgrown field, the dry kalen, and the half-built joglo. Coloured boxes by design
 * (ASSET_PIPELINE §4) — every colour is a DESIGN §2 token, and the ids are the final
 * assets' ids so Blender exports replace them without a code change.
 */

import { type AreaDef, CROSSING_WIDTH } from '@bale/shared';
import { colorHex } from '../../apps/client/src/ui/tokens.ts';
import type { GlbMesh } from '../assets/glb.ts';
import { MeshBuilder, type V3 } from '../assets/mesh-builder.ts';

const GRASS = colorHex('sawah500');
const WEEDS = colorHex('sawah700');
const EARTH = colorHex('kayu500');
const STONE = colorHex('ink500');
const WOOD = colorHex('kayu500');
const TILE = colorHex('terakota500');
const LAMP = colorHex('kunyit400');

/** How far the ground runs past the area, so the fog — not an edge — ends the world. */
const GROUND_MARGIN = 12;
/** Depth of the dead kalen: dry now, which is the point (the water system is M3). */
const KALEN_DEPTH = 0.4;
/** A crossing's boards sit on the banks, proud of the grass. */
const PLANK_THICKNESS = 0.06;

/** Deterministic scatter: tools may not share the sim's RNG, but must still be stable. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Ground plane with the kalen cut into it, the field's bare soil, and its weeds. */
export function buildGround(area: AreaDef): GlbMesh {
  const mesh = new MeshBuilder('ground');
  const [w, d] = area.size;
  const minX = -w / 2 - GROUND_MARGIN;
  const maxX = w / 2 + GROUND_MARGIN;
  const minZ = -d / 2 - GROUND_MARGIN;
  const maxZ = d / 2 + GROUND_MARGIN;
  const { points, width } = area.kalen;
  const first = points[0] as readonly [number, number];
  const last = points[points.length - 1] as readonly [number, number];

  // The placeholder cuts one straight north–south channel; the schema allows bends for the
  // final art, and this says so loudly rather than drawing the wrong thing.
  if (points.length !== 2 || first[0] !== last[0]) {
    throw new Error('placeholder kalen supports one north–south segment');
  }
  const kx0 = first[0] - width / 2;
  const kx1 = first[0] + width / 2;
  const kz0 = Math.max(Math.min(first[1], last[1]), minZ);
  const kz1 = Math.min(Math.max(first[1], last[1]), maxZ);

  const flat = (x0: number, z0: number, x1: number, z1: number, y: number, color: number) => {
    if (x1 > x0 && z1 > z0) {
      mesh.polygon(
        [
          [x0, y, z0],
          [x0, y, z1],
          [x1, y, z1],
          [x1, y, z0],
        ],
        color,
      );
    }
  };
  // Grass everywhere except the channel's own strip.
  flat(minX, minZ, kx0, maxZ, 0, GRASS);
  flat(kx1, minZ, maxX, maxZ, 0, GRASS);
  flat(kx0, minZ, kx1, kz0, 0, GRASS);
  flat(kx0, kz1, kx1, maxZ, 0, GRASS);
  // The kalen: a cracked earth bed and stone-lined walls.
  flat(kx0, kz0, kx1, kz1, -KALEN_DEPTH, EARTH);
  // Walls face into the channel: west +x, east −x, north end +z, south end −z.
  const y0 = -KALEN_DEPTH;
  mesh.polygon(
    [
      [kx0, 0, kz0],
      [kx0, 0, kz1],
      [kx0, y0, kz1],
      [kx0, y0, kz0],
    ],
    STONE,
  );
  mesh.polygon(
    [
      [kx1, 0, kz1],
      [kx1, 0, kz0],
      [kx1, y0, kz0],
      [kx1, y0, kz1],
    ],
    STONE,
  );
  mesh.polygon(
    [
      [kx1, 0, kz0],
      [kx0, 0, kz0],
      [kx0, y0, kz0],
      [kx1, y0, kz0],
    ],
    STONE,
  );
  mesh.polygon(
    [
      [kx0, 0, kz1],
      [kx1, 0, kz1],
      [kx1, y0, kz1],
      [kx0, y0, kz1],
    ],
    STONE,
  );

  // Plank crossings (wot): two boards side by side, resting on the banks.
  for (const [, cz] of area.kalen.crossings) {
    const half = CROSSING_WIDTH / 2;
    mesh.box([kx0 - 0.2, 0, cz - half], [kx1 + 0.2, PLANK_THICKNESS, cz - 0.03], WOOD);
    mesh.box([kx0 - 0.2, 0, cz + 0.03], [kx1 + 0.2, PLANK_THICKNESS, cz + half], WOOD);
  }

  // The field: bare soil a hair above the grass, gone to weeds — the player clears it.
  const { field } = area;
  flat(field.x, field.z, field.x + field.w, field.z + field.d, 0.02, EARTH);
  const random = lcg(0x0ba1e);
  const tufts = Math.round(field.w * field.d * 0.6);
  for (let i = 0; i < tufts; i++) {
    const x = field.x + 0.3 + random() * (field.w - 0.6);
    const z = field.z + 0.3 + random() * (field.d - 0.6);
    mesh.pyramid([x, 0.02, z], 0.12 + random() * 0.12, 0.25 + random() * 0.35, WEEDS);
  }

  // Kandang ayam: a one-tile, low open-sided placeholder around the authored coop tile.
  const [coopX, coopZ] = area.coop;
  mesh.box([coopX + 0.08, 0, coopZ + 0.08], [coopX + 0.92, 0.12, coopZ + 0.92], EARTH);
  for (const [x, z] of [
    [coopX + 0.12, coopZ + 0.12],
    [coopX + 0.88, coopZ + 0.12],
    [coopX + 0.12, coopZ + 0.88],
    [coopX + 0.88, coopZ + 0.88],
  ] as const) {
    mesh.box([x - 0.04, 0.12, z - 0.04], [x + 0.04, 0.9, z + 0.04], WOOD);
  }
  mesh.box([coopX + 0.02, 0.88, coopZ + 0.02], [coopX + 0.98, 1.02, coopZ + 0.98], TILE);
  return mesh.build();
}

/**
 * The joglo, half built: the stone platform, the four saka guru and twelve outer posts,
 * the tie beams on two sides only, the bare hip rafters, and one slope tiled.
 */
export function buildJoglo(area: AreaDef): GlbMesh {
  const mesh = new MeshBuilder('joglo');
  const { joglo } = area;
  const cx = joglo.x + joglo.w / 2;
  const cz = joglo.z + joglo.d / 2;
  const plinth = 0.3;
  const outerHalf = joglo.w / 2 - 0.5;
  const outerHalfZ = joglo.d / 2 - 0.5;
  const outerTop = plinth + 2.3;
  const guruHalf = 1.2;
  const guruTop = plinth + 3.7;
  const ridgeY = guruTop + 1.4;

  mesh.box([joglo.x, 0, joglo.z], [joglo.x + joglo.w, plinth, joglo.z + joglo.d], STONE);

  const post = (x: number, z: number, top: number, size: number) =>
    mesh.box([x - size / 2, plinth, z - size / 2], [x + size / 2, top, z + size / 2], WOOD);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) post(cx + sx * guruHalf, cz + sz * guruHalf, guruTop, 0.32);
  }
  const along = [-1, -1 / 3, 1 / 3, 1];
  const outer = new Set<string>();
  for (const t of along) {
    for (const [x, z] of [
      [cx + t * outerHalf, cz - outerHalfZ],
      [cx + t * outerHalf, cz + outerHalfZ],
      [cx - outerHalf, cz + t * outerHalfZ],
      [cx + outerHalf, cz + t * outerHalfZ],
    ] as const) {
      const key = `${x.toFixed(3)},${z.toFixed(3)}`;
      if (outer.has(key)) continue;
      outer.add(key);
      post(x, z, outerTop, 0.22);
    }
  }

  // Tie beams (blandar): the saka guru frame is closed, the outer ring only front and west.
  const beam = 0.18;
  const g = guruHalf;
  const guruCorners: V3[] = [
    [cx - g, guruTop, cz - g],
    [cx + g, guruTop, cz - g],
    [cx + g, guruTop, cz + g],
    [cx - g, guruTop, cz + g],
  ];
  for (let i = 0; i < 4; i++) {
    mesh.beam(guruCorners[i] as V3, guruCorners[(i + 1) % 4] as V3, beam, WOOD);
  }
  const o = outerHalf;
  const oz = outerHalfZ;
  mesh.beam([cx - o, outerTop, cz + oz], [cx + o, outerTop, cz + oz], beam, WOOD);
  mesh.beam([cx - o, outerTop, cz - oz], [cx - o, outerTop, cz + oz], beam, WOOD);

  // The roof frame: a short ridge over the saka guru, and hip rafters down to the corners.
  const ridgeA: V3 = [cx - 0.6, ridgeY, cz];
  const ridgeB: V3 = [cx + 0.6, ridgeY, cz];
  mesh.beam(ridgeA, ridgeB, beam, WOOD);
  for (const [i, corner] of guruCorners.entries()) {
    mesh.beam(i === 0 || i === 3 ? ridgeA : ridgeB, corner, beam, WOOD);
    const [x, , z] = corner;
    const sx = Math.sign(x - cx);
    const sz = Math.sign(z - cz);
    mesh.beam(corner, [cx + sx * o, outerTop, cz + sz * oz], beam, WOOD);
  }

  // One slope tiled (the north brunjung), the rest still open to the sky.
  mesh.polygon(
    [
      [cx - g - 0.1, guruTop + 0.05, cz - g - 0.1],
      [ridgeA[0], ridgeY + 0.05, cz],
      [ridgeB[0], ridgeY + 0.05, cz],
      [cx + g + 0.1, guruTop + 0.05, cz - g - 0.1],
    ],
    TILE,
  );

  // Teras lamps: small lanterns where the lights hang.
  for (const [x, y, z] of area.lamps) {
    mesh.box([x - 0.1, y - 0.15, z - 0.1], [x + 0.1, y + 0.1, z + 0.1], LAMP, true);
  }

  // Setoran: a lidded wooden shipping box on its authored gameplay tile.
  const [setoranX, setoranZ] = area.setoran;
  mesh.box(
    [setoranX + 0.12, plinth, setoranZ + 0.12],
    [setoranX + 0.88, plinth + 0.72, setoranZ + 0.88],
    WOOD,
  );
  mesh.box(
    [setoranX + 0.08, plinth + 0.72, setoranZ + 0.08],
    [setoranX + 0.92, plinth + 0.82, setoranZ + 0.92],
    WOOD,
  );
  return mesh.build();
}

/** Every placeholder model for the base area, by asset id (DESIGN §11 naming). */
export function balePlaceholders(area: AreaDef): Record<string, GlbMesh[]> {
  return {
    bale_ground_lvl0: [buildGround(area)],
    bale_joglo_lvl0: [buildJoglo(area)],
  };
}
