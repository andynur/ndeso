---
paths:
  - "apps/client/src/render/**"
---
# Rules: render (Three.js)
- Read sim **views** only. Never mutate sim state. Never import from `ui/`.
- Budget first (PERFORMANCE_BUDGET §3): prefer `InstancedMesh`, shared materials, atlases. No per-frame allocations (reuse `Vector3`/`Matrix4` scratch objects).
- Crops/tiles update on sim events (`dayStarted`, `tileChanged`), not every frame.
- All quality-dependent features go through `quality/presets.ts`. Low preset: no real shadows, no post, DPR cap 1.0.
- Dispose geometries/materials/textures on area unload. Handle `webglcontextlost`.
- Sprite textures: `NearestFilter`, no mipmaps, PPU 32 (DESIGN §1.2).
