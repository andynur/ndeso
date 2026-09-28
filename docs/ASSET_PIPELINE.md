# ASSET PIPELINE

## 1. Folders

```
assets-src/          # Source files (Git LFS): .blend, .aseprite, .wav, .psd
  models/<area>/
  sprites/<category>/
  audio/{music,sfx,ambience}/
assets/              # Generated, git-ignored. Output of `bun run assets`
assets/CREDITS.md    # (tracked) author, license, source for every asset
```

Track `assets-src/**` with **Git LFS**: `git lfs track "assets-src/**"`. Never commit generated outputs.

## 2. Formats & settings

| Source | Output | Tool | Settings |
|---|---|---|---|
| Blender `.blend` | `.glb` | Blender export → `gltf-transform` | Y-up, apply transforms, vertex colors allowed, ≤ 1 material per mesh where possible. Then `meshopt` compression + `dedup` + `prune` + `weld` |
| Textures (world) | `.ktx2` ETC1S | `gltf-transform etc1s` | Power-of-two, max 1024², mipmaps on |
| Sprites/UI atlases | `.ktx2` UASTC **or** `.png` | `gltf-transform uastc` / Bun.Image | Pixel-art atlases stay **PNG (lossless)** if UASTC shows artifacts; max 2048² atlas; no mipmaps |
| Aseprite `.aseprite` | PNG sheet + JSON | Aseprite CLI (`--sheet --data --format json-array`) | Tags = animation names (`walk_down`, `idle_side`) |
| Icons (PWA) | 192/512 PNG + maskable | `Bun.Image` | From one 1024² source |
| Music | `.webm` (Opus 64 kbps) + `.m4a` (AAC 96 kbps) | ffmpeg | Loop points in the JSON sidecar |
| SFX | `.webm` Opus 48 kbps mono | ffmpeg | Trim silence, −1 dBTP peak |

## 3. Build script (`tools/assets/build.ts`)

**Implemented today (M1-09), the minimum:** `bun run assets` takes the generated placeholder models plus any `assets-src/models/<area>/<id>.glb` (an export wins over the placeholder with the same id), runs each through `gltf-transform optimize --compress meshopt` (dedup, weld, prune, meshopt; simplify, instancing, joins and texture steps off), writes `assets/models/<area>/<id>-<hash>.glb` and `assets/manifest.json`, and skips unchanged sources via `.cache/assets.json`. The CLI runs under Bun, so neither the machine nor CI needs Node. `bun run dev` and `bun run build` call it first; the build ships the manifest and the models under `dist/assets/`. The client decodes meshopt with the decoder bundled in `three`. Textures, sprites and audio join as their tasks land.

The full design:

Runs with Bun Shell, is incremental (content-hash cache in `.cache/assets.json`), and processes files in parallel:
1. Find changed sources since the last run.
2. Convert with the right tool (table above). External tools (`blender`, `aseprite`, `ffmpeg`) are **optional**: if missing, skip with a warning and reuse the last committed output from the release bucket.
3. Write hashed filenames and an `assets/manifest.json` mapping `logicalId → { url, bytes, type }`.
4. Report sizes per area against [PERFORMANCE_BUDGET](PERFORMANCE_BUDGET.md).

## 4. Placeholder-first workflow

- Every system is built with **placeholder assets** first: colored boxes, `tools/placeholders/` generated sprites with the id text drawn on them.
- Placeholders have ids identical to the final assets, so a swap needs no code change. Placeholder **models** are generated from the area data by code in `tools/placeholders/` (nothing binary is committed); a placeholder that has to be drawn by hand lives in `assets-src/placeholders/`.
- AI agents must **never** try to generate final art. They use placeholders and open an issue labeled `art-needed` with the spec from DESIGN.md.

## 5. Licensing of assets

- Original assets: CC BY-SA 4.0 (see [ADR-0005](adr/0005-licensing.md)).
- Third-party assets: only CC0, CC BY, CC BY-SA, or OFL (fonts). Record each in `assets/CREDITS.md`. **No** "free for personal use", ripped game assets, or unclear AI-generated art.
- Contributors confirm the origin and license in the PR template.
