/** Generated placeholders for Pasar Baledono; layout is compressed by feel, never traced. */
import type { AreaDef, GroundRect } from '@bale/shared';
import { colorHex } from '../../apps/client/src/ui/tokens.ts';
import type { GlbMesh } from '../assets/glb.ts';
import { MeshBuilder } from '../assets/mesh-builder.ts';

const PAVING = colorHex('ink500');
const STALL = colorHex('kayu500');
const ROOF = colorHex('terakota500');
const CANOPY = colorHex('kunyit400');
const GROUND_MARGIN = 12;

export function buildPasarGround(area: AreaDef): GlbMesh {
  const mesh = new MeshBuilder('ground');
  const [w, d] = area.size;
  mesh.box(
    [-w / 2 - GROUND_MARGIN, -0.08, -d / 2 - GROUND_MARGIN],
    [w / 2 + GROUND_MARGIN, 0, d / 2 + GROUND_MARGIN],
    PAVING,
  );
  return mesh.build();
}

function buildShed(mesh: MeshBuilder, rect: GroundRect): void {
  const post = 0.12;
  for (const x of [rect.x + 0.4, rect.x + rect.w - 0.4]) {
    for (const z of [rect.z + 0.4, rect.z + rect.d - 0.4]) {
      mesh.box([x - post, 0, z - post], [x + post, 2.6, z + post], STALL);
    }
  }
  mesh.box(
    [rect.x + 0.15, 2.5, rect.z + 0.15],
    [rect.x + rect.w - 0.15, 2.8, rect.z + rect.d - 0.15],
    ROOF,
  );
  for (let z = rect.z + 1; z < rect.z + rect.d - 0.5; z += 2) {
    mesh.box([rect.x + 0.4, 0.75, z], [rect.x + rect.w - 0.4, 1.05, z + 0.8], STALL);
  }
}

export function buildPasarStalls(area: AreaDef): GlbMesh {
  const mesh = new MeshBuilder('stalls');
  for (const rect of area.solids) buildShed(mesh, rect);
  if (area.market) {
    const [x, z] = area.market;
    mesh.box([x + 0.05, 0.7, z + 0.05], [x + 0.95, 1, z + 0.95], CANOPY);
  }
  return mesh.build();
}

export function pasarPlaceholders(area: AreaDef): Record<string, GlbMesh[]> {
  return {
    pasar_ground_lvl0: [buildPasarGround(area)],
    pasar_stalls_lvl0: [buildPasarStalls(area)],
  };
}
