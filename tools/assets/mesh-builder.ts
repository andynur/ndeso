import type { GlbMesh } from './glb.ts';

/**
 * Flat-shaded low-poly geometry for placeholder models (DESIGN §1: "low-poly 3D, flat or
 * vertex-colour shading"). Every face gets its own vertices and normal, so the facets read
 * as facets; `gltf-transform weld` merges whatever is shared afterwards.
 */

export type V3 = readonly [number, number, number];
/** sRGB 0xRRGGBB, as DESIGN §2 lists the tokens. */
export type Hex = number;

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

function hexToLinear(hex: Hex): V3 {
  return [
    srgbToLinear(((hex >> 16) & 0xff) / 255),
    srgbToLinear(((hex >> 8) & 0xff) / 255),
    srgbToLinear((hex & 0xff) / 255),
  ];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: V3): V3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

export class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];

  constructor(readonly name: string) {}

  get triangleCount(): number {
    return this.indices.length / 3;
  }

  /** A convex polygon, counter-clockwise seen from the side its normal faces. */
  polygon(points: readonly V3[], color: Hex): this {
    const [a, b, c] = points as [V3, V3, V3];
    const normal = normalize(cross(sub(b, a), sub(c, a)));
    const rgb = hexToLinear(color);
    const base = this.positions.length / 3;
    for (const point of points) {
      this.positions.push(...point);
      this.normals.push(...normal);
      this.colors.push(...rgb);
    }
    for (let i = 1; i < points.length - 1; i++) this.indices.push(base, base + i, base + i + 1);
    return this;
  }

  /** An axis-aligned box from `min` to `max`. `bottom: false` skips the unseen underside. */
  box(min: V3, max: V3, color: Hex, bottom = false): this {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    this.polygon(
      [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
      color,
    ); // top
    this.polygon(
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      color,
    ); // south +z
    this.polygon(
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      color,
    ); // north −z
    this.polygon(
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      color,
    ); // east +x
    this.polygon(
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      color,
    ); // west −x
    if (bottom)
      this.polygon(
        [
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y0, z1],
          [x0, y0, z1],
        ],
        color,
      );
    return this;
  }

  /** A square beam of side `size` from `a` to `b`, for rafters and braces. */
  beam(a: V3, b: V3, size: number, color: Hex): this {
    const axis = normalize(sub(b, a));
    const helper: V3 = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = scale(normalize(cross(axis, helper)), size / 2);
    const v = scale(normalize(cross(axis, u)), size / 2);
    const corner = (p: V3, su: number, sv: number): V3 => add(add(p, scale(u, su)), scale(v, sv));
    const ring = (p: V3): V3[] => [
      corner(p, 1, 1),
      corner(p, -1, 1),
      corner(p, -1, -1),
      corner(p, 1, -1),
    ];
    const ra = ring(a);
    const rb = ring(b);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.polygon([ra[i] as V3, ra[j] as V3, rb[j] as V3, rb[i] as V3], color);
    }
    this.polygon([...ra].reverse(), color);
    this.polygon(rb, color);
    return this;
  }

  /** A four-sided pyramid: grass tufts and the like. */
  pyramid(base: V3, radius: number, height: number, color: Hex): this {
    const [x, y, z] = base;
    const apex: V3 = [x, y + height, z];
    const corners: V3[] = [
      [x - radius, y, z + radius],
      [x + radius, y, z + radius],
      [x + radius, y, z - radius],
      [x - radius, y, z - radius],
    ];
    for (let i = 0; i < 4; i++) {
      this.polygon([corners[i] as V3, corners[(i + 1) % 4] as V3, apex], color);
    }
    return this;
  }

  build(): GlbMesh {
    return {
      name: this.name,
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    };
  }
}
