/**
 * A minimal glTF 2.0 binary (GLB) writer for generated placeholder models (ASSET_PIPELINE
 * §4). It writes exactly what the placeholders need — named, indexed triangle meshes with
 * POSITION, NORMAL and COLOR_0, one node each, one shared vertex-colour material — and
 * nothing else. `gltf-transform` then welds, dedups, prunes and meshopt-compresses it like
 * any Blender export, so placeholders exercise the same pipeline as final art.
 */

export interface GlbMesh {
  readonly name: string;
  /** xyz per vertex. */
  readonly positions: Float32Array;
  /** xyz per vertex, unit length. */
  readonly normals: Float32Array;
  /** Linear rgb per vertex (glTF vertex colours are linear). */
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
}

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'
const FLOAT = 5126;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const pad4 = (n: number): number => (n + 3) & ~3;

function bounds(positions: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = positions[i + c] as number;
      if (v < (min[c] as number)) min[c] = v;
      if (v > (max[c] as number)) max[c] = v;
    }
  }
  return { min, max };
}

export function writeGlb(meshes: readonly GlbMesh[], generator: string): Uint8Array {
  const views: { buffer: 0; byteOffset: number; byteLength: number; target: number }[] = [];
  const accessors: Record<string, unknown>[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  function addView(data: Float32Array | Uint32Array, target: number): number {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target });
    chunks.push(bytes);
    const padded = pad4(bytes.byteLength);
    if (padded > bytes.byteLength) chunks.push(new Uint8Array(padded - bytes.byteLength));
    offset += padded;
    return views.length - 1;
  }

  const gltfMeshes = meshes.map((mesh) => {
    const count = mesh.positions.length / 3;
    if (
      !Number.isInteger(count) ||
      mesh.normals.length !== mesh.positions.length ||
      mesh.colors.length !== mesh.positions.length
    ) {
      throw new Error(`${mesh.name}: positions, normals and colours must be xyz per vertex`);
    }
    const attribute = (data: Float32Array, extra: Record<string, unknown> = {}) => {
      accessors.push({
        bufferView: addView(data, ARRAY_BUFFER),
        componentType: FLOAT,
        count,
        type: 'VEC3',
        ...extra,
      });
      return accessors.length - 1;
    };
    const POSITION = attribute(mesh.positions, bounds(mesh.positions));
    const NORMAL = attribute(mesh.normals);
    const COLOR_0 = attribute(mesh.colors);
    accessors.push({
      bufferView: addView(mesh.indices, ELEMENT_ARRAY_BUFFER),
      componentType: UNSIGNED_INT,
      count: mesh.indices.length,
      type: 'SCALAR',
    });
    return {
      name: mesh.name,
      primitives: [
        { attributes: { POSITION, NORMAL, COLOR_0 }, indices: accessors.length - 1, material: 0 },
      ],
    };
  });

  const json = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ nodes: meshes.map((_, i) => i) }],
    nodes: meshes.map((mesh, i) => ({ name: mesh.name, mesh: i })),
    meshes: gltfMeshes,
    materials: [
      {
        name: 'vertex_color',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: offset }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = pad4(jsonBytes.byteLength);
  const total = 12 + 8 + jsonLength + 8 + offset;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  // The JSON chunk is padded with spaces, as the spec requires.
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonLength);
  let at = 20 + jsonLength;
  view.setUint32(at, offset, true);
  view.setUint32(at + 4, CHUNK_BIN, true);
  at += 8;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

/** Reads the JSON chunk back out of a GLB; for tests and the build report. */
export function readGlbJson(glb: Uint8Array): Record<string, unknown> {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB');
  const length = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + length))) as Record<
    string,
    unknown
  >;
}
