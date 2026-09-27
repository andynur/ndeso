# ADR-0002: HD-2D rendering with Three.js on WebGL2
- Status: Accepted
- Date: 2026-09-26

## Context
We want a "2D that feels 3D" look on low-end Android browsers. Options: pure 2D (Phaser), isometric 2D, HD-2D (3D world + sprite characters), full 3D.

## Decision
HD-2D: a low-poly 3D world plus billboard pixel-art sprites, rendered with Three.js on **WebGL2** (WebGPU is not required and not targeted for v1).

## Consequences
- + Real lighting, shadows, day/night, and camera rotation. No character rigging.
- + Three.js is small, flexible, and well documented.
- − We build our own scene management, sprite batching, and quality system.
- − Needs strict performance budgets (PERFORMANCE_BUDGET) and real-device testing from M1.

## Alternatives considered
- Phaser isometric: lighter, less "3D". A fallback if M1 fails its budgets.
- Babylon.js/PlayCanvas: heavier or editor-bound.
- Godot/Unity web export: large WASM payloads and weaker mobile-browser stability.
