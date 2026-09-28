/**
 * Loads an area's models from the asset manifest (ASSET_PIPELINE §3): meshopt-compressed
 * GLBs, decoded by the meshopt decoder that ships with Three.js.
 *
 * DESIGN §1 wants flat vertex-colour shading, so every mesh is redrawn with one shared
 * Lambert material: one program for the whole world, and no PBR cost on a Low phone.
 * Shadows follow a naming convention the exports keep: a node named `ground` only
 * receives; everything else casts and receives.
 */

import type { AreaDef, AssetManifest } from '@bale/shared';
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const GROUND_NODE = 'ground';

/** Asset ids the area lists that the manifest does not have. */
export function missingModels(area: AreaDef, manifest: AssetManifest): string[] {
  return area.models.filter((id) => manifest[id] === undefined);
}

/**
 * Resolves with one group holding every model of `area`, ready to add to the scene.
 * `manifestUrl` is where the manifest was fetched from; entry urls are relative to it.
 */
export async function loadAreaModels(
  area: AreaDef,
  manifest: AssetManifest,
  manifestUrl: URL,
): Promise<Group> {
  const missing = missingModels(area, manifest);
  if (missing.length > 0) {
    throw new Error(`asset manifest has no ${missing.join(', ')} — run \`bun run assets\``);
  }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const material = new MeshLambertMaterial({ vertexColors: true });
  const group = new Group();
  group.name = area.id;

  const loaded = await Promise.all(
    area.models.map((id) => {
      const entry = manifest[id];
      return loader.loadAsync(new URL(entry?.url ?? '', manifestUrl).href);
    }),
  );
  for (const gltf of loaded) {
    gltf.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const previous = object.material;
      for (const slot of Array.isArray(previous) ? previous : [previous]) slot.dispose();
      object.material = material;
      const isGround = object.name === GROUND_NODE || object.parent?.name === GROUND_NODE;
      object.castShadow = !isGround;
      object.receiveShadow = true;
    });
    group.add(gltf.scene);
  }
  return group;
}
