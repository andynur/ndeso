import type { CropDef } from '@bale/shared/content';
import type { FarmTile, SimEvent } from '@bale/sim';
import {
  Color,
  DataTexture,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
} from 'three';
import {
  configureSpriteTexture,
  createAtlasTexture,
  SpriteBatch,
} from '../sprites/sprite-batch.ts';
import {
  buildPlaceholderCropAtlas,
  type CropPalette,
  type CropVisualStage,
  cropTag,
  WITHERED_STAGE,
} from './placeholder-crop-atlas.ts';

const CROP_Y = 0.04;
const SOIL_Y = 0.035;
const SOIL_SIZE = 0.88;
const SOIL_TEXTURE_SIZE = 16;

export interface WateredSoilPalette {
  readonly earth: number;
  readonly water: number;
}

export interface CropViewOptions {
  readonly areaId: string;
  readonly crops: readonly CropDef[];
  readonly capacity: number;
  readonly cropPalette: CropPalette;
  readonly soilPalette: WateredSoilPalette;
}

/** Read-only rendering projection of the farm; the renderer never mutates these tiles. */
export type FarmTilesView = Readonly<Record<string, Readonly<FarmTile>>>;

/** Growth uses four visible stages: seedling, young, grown, and mature. */
export function cropVisualStage(
  tile: Readonly<FarmTile>,
  crop: CropDef,
): CropVisualStage | undefined {
  if (tile.phase === 'withered') return WITHERED_STAGE;
  if (tile.phase === 'mature') return 3;
  if (tile.phase !== 'seeded') return undefined;
  return Math.min(2, Math.floor((tile.growthDays * 3) / crop.growDays)) as 0 | 1 | 2;
}

/** Farm visuals change on tool actions and on daily growth/reset. */
export function cropViewNeedsSync(events: readonly SimEvent[]): boolean {
  for (const event of events) {
    if (
      event.type === 'dayStarted' ||
      event.type === 'tileHoed' ||
      event.type === 'tileWatered' ||
      event.type === 'cropPlanted' ||
      event.type === 'cropHarvested'
    ) {
      return true;
    }
  }
  return false;
}

/** Instanced crop sprites per crop/stage plus one instanced watered-soil decal mesh. */
export class CropView {
  readonly group = new Group();
  /** Shared by every crop stage batch and driven by the scene's day/night lighting. */
  readonly tint = new Color(1, 1, 1);
  readonly wateredSoil: InstancedMesh<PlaneGeometry, MeshLambertMaterial>;
  private readonly cropsById: ReadonlyMap<string, CropDef>;
  private readonly stageBatches = new Map<string, SpriteBatch>();
  private readonly atlasTexture: DataTexture;
  private readonly soilTexture: DataTexture;
  private readonly matrix = new Matrix4();

  constructor(private readonly options: CropViewOptions) {
    this.cropsById = new Map(options.crops.map((crop) => [crop.id, crop]));
    const { atlas, pixels } = buildPlaceholderCropAtlas(options.crops, options.cropPalette);
    this.atlasTexture = createAtlasTexture(pixels, atlas);
    for (const crop of options.crops) {
      for (const stage of [0, 1, 2, 3, WITHERED_STAGE] as const) {
        const tag = cropTag(crop.id, stage);
        const batch = new SpriteBatch({
          atlas,
          texture: this.atlasTexture,
          capacity: options.capacity,
          tint: this.tint,
        });
        this.stageBatches.set(tag, batch);
        this.group.add(batch.mesh);
      }
    }

    this.soilTexture = createWateredSoilTexture(options.soilPalette);
    const soilGeometry = new PlaneGeometry(SOIL_SIZE, SOIL_SIZE);
    soilGeometry.rotateX(-Math.PI / 2);
    const soilMaterial = new MeshLambertMaterial({ map: this.soilTexture });
    this.wateredSoil = new InstancedMesh(soilGeometry, soilMaterial, options.capacity);
    this.wateredSoil.instanceMatrix.setUsage(DynamicDrawUsage);
    this.wateredSoil.count = 0;
    this.wateredSoil.frustumCulled = false;
    this.wateredSoil.receiveShadow = true;
    // Soil first, then crops, independent of the order batches were created.
    this.group.add(this.wateredSoil);
    this.wateredSoil.renderOrder = -1;
  }

  /** Rebuilds packed instance ranges. Called on farm events, never every render frame. */
  sync(tiles: FarmTilesView): void {
    for (const batch of this.stageBatches.values()) batch.clear();
    let watered = 0;
    for (const tile of Object.values(tiles)) {
      if (tile.area !== this.options.areaId) continue;
      if (isWatered(tile)) {
        if (watered >= this.options.capacity) throw new RangeError('watered-soil batch is full');
        this.matrix.makeTranslation(tile.x + 0.5, SOIL_Y, tile.z + 0.5);
        this.wateredSoil.setMatrixAt(watered++, this.matrix);
      }
      if (tile.phase !== 'seeded' && tile.phase !== 'mature' && tile.phase !== 'withered') continue;
      const crop = this.cropsById.get(tile.cropId);
      if (!crop) continue;
      const stage = cropVisualStage(tile, crop);
      if (stage === undefined) continue;
      const tag = cropTag(crop.id, stage);
      this.stageBatches.get(tag)?.add({
        x: tile.x + 0.5,
        y: CROP_Y,
        z: tile.z + 0.5,
        tag,
      });
    }
    this.wateredSoil.count = watered;
    this.wateredSoil.instanceMatrix.needsUpdate = true;
    for (const batch of this.stageBatches.values()) batch.update(0);
  }

  instanceCount(cropId: string, stage: CropVisualStage): number {
    return this.stageBatches.get(cropTag(cropId, stage))?.size ?? 0;
  }

  dispose(): void {
    for (const batch of this.stageBatches.values()) batch.dispose();
    this.atlasTexture.dispose();
    this.wateredSoil.geometry.dispose();
    this.wateredSoil.material.dispose();
    this.wateredSoil.dispose();
    this.soilTexture.dispose();
  }
}

function isWatered(tile: Readonly<FarmTile>): boolean {
  if (tile.phase === 'untilled') return false;
  return tile.plot === 'sawah' ? tile.waterLevel > 0 : tile.watered;
}

/** Wet brown soil with blue diagonal glints: readable by pattern, not colour alone. */
function createWateredSoilTexture(palette: WateredSoilPalette): DataTexture {
  const pixels = new Uint8Array(SOIL_TEXTURE_SIZE * SOIL_TEXTURE_SIZE * 4);
  for (let y = 0; y < SOIL_TEXTURE_SIZE; y++) {
    for (let x = 0; x < SOIL_TEXTURE_SIZE; x++) {
      const ripple = (x + y * 2) % 7 === 0 || (x - y + SOIL_TEXTURE_SIZE) % 11 === 0;
      const color = ripple ? palette.water : palette.earth;
      const i = (y * SOIL_TEXTURE_SIZE + x) * 4;
      pixels[i] = (color >> 16) & 0xff;
      pixels[i + 1] = (color >> 8) & 0xff;
      pixels[i + 2] = color & 0xff;
      pixels[i + 3] = 0xff;
    }
  }
  const texture = new DataTexture(pixels, SOIL_TEXTURE_SIZE, SOIL_TEXTURE_SIZE, RGBAFormat);
  configureSpriteTexture(texture);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
