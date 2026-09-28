import { describe, expect, test } from 'bun:test';
import { readGlbJson, writeGlb } from './glb.ts';
import { MeshBuilder, type V3 } from './mesh-builder.ts';

/** Area-weighted normal of each triangle, from its winding. */
function faceNormals(mesh: ReturnType<MeshBuilder['build']>): V3[] {
  const out: V3[] = [];
  const p = (i: number): V3 => [
    mesh.positions[i * 3] as number,
    mesh.positions[i * 3 + 1] as number,
    mesh.positions[i * 3 + 2] as number,
  ];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [
      p(mesh.indices[t] as number),
      p(mesh.indices[t + 1] as number),
      p(mesh.indices[t + 2] as number),
    ];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    out.push([
      (u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number),
      (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number),
      (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number),
    ]);
  }
  return out;
}

describe('MeshBuilder', () => {
  test('every box face winds outwards', () => {
    const mesh = new MeshBuilder('b').box([0, 0, 0], [1, 1, 1], 0xffffff, true).build();
    const centre: V3 = [0.5, 0.5, 0.5];
    for (const [t, n] of faceNormals(mesh).entries()) {
      const i = mesh.indices[t * 3] as number;
      const toFace = [0, 1, 2].map(
        (c) => (mesh.positions[i * 3 + c] as number) - (centre[c] as number),
      );
      const dot =
        n[0] * (toFace[0] as number) + n[1] * (toFace[1] as number) + n[2] * (toFace[2] as number);
      expect(dot).toBeGreaterThan(0);
    }
  });

  test('beams wind outwards from their axis', () => {
    const mesh = new MeshBuilder('b').beam([0, 0, 0], [2, 1, 0], 0.2, 0xffffff).build();
    const normals = faceNormals(mesh);
    expect(normals.length).toBe(12);
    for (const [t, n] of normals.entries()) {
      const i = mesh.indices[t * 3] as number;
      const q: V3 = [mesh.positions[i * 3] as number, mesh.positions[i * 3 + 1] as number, 0];
      // Midpoint of the axis nearest the vertex; the face must point away from it.
      const along = Math.max(0, Math.min(1, (q[0] * 2 + q[1]) / 5));
      const toFace = [q[0] - 2 * along, q[1] - along, (mesh.positions[i * 3 + 2] as number) - 0];
      const dot =
        n[0] * (toFace[0] as number) + n[1] * (toFace[1] as number) + n[2] * (toFace[2] as number);
      expect(dot).toBeGreaterThan(-1e-9);
    }
  });

  test('stored normals match the winding', () => {
    const mesh = new MeshBuilder('p').pyramid([0, 0, 0], 1, 1, 0xffffff).build();
    const first = faceNormals(mesh)[0] as V3;
    const stored = [mesh.normals[0], mesh.normals[1], mesh.normals[2]] as V3;
    const length = Math.hypot(...first);
    expect(
      stored.map((c, i) => c - (first[i] as number) / length).every((e) => Math.abs(e) < 1e-6),
    ).toBe(true);
  });

  test('colours are written in linear space', () => {
    const mesh = new MeshBuilder('c').pyramid([0, 0, 0], 1, 1, 0x808080).build();
    expect(mesh.colors[0]).toBeCloseTo(0.2158605, 5);
  });
});

describe('writeGlb', () => {
  test('writes a GLB whose JSON names every mesh and bounds its positions', () => {
    const box = new MeshBuilder('crate').box([0, 0, 0], [1, 2, 3], 0xffffff).build();
    const glb = writeGlb([box], 'test');
    expect(new DataView(glb.buffer).getUint32(8, true)).toBe(glb.byteLength);
    expect(glb.byteLength % 4).toBe(0);
    const json = readGlbJson(glb) as {
      nodes: { name: string }[];
      accessors: { min?: number[]; max?: number[] }[];
    };
    expect(json.nodes.map((n) => n.name)).toEqual(['crate']);
    expect(json.accessors[0]?.min).toEqual([0, 0, 0]);
    expect(json.accessors[0]?.max).toEqual([1, 2, 3]);
  });
});
