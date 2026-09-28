#!/usr/bin/env bun
/**
 * Dev server for `apps/client` (TECH_STACK §1: Bun HTML imports instead of Vite).
 *
 * Binds 0.0.0.0 so a phone on the same Wi-Fi can open the LAN URL printed below —
 * testing on a real low-end Android is the whole point of the M0 exit criteria.
 *
 *   bun run dev            # http://localhost:3000
 *   PORT=8080 bun run dev
 */

import { networkInterfaces } from 'node:os';
import { join, normalize } from 'node:path';
import index from '../apps/client/index.html';
import { ASSETS_DIR, buildAssets } from './assets/build.ts';

const { PORT } = process.env;
const port = Number(PORT ?? 3000);

// ASSET_PIPELINE §3: the models are generated, so make sure they exist and are current.
// Incremental — a no-op in well under a second when nothing changed.
await buildAssets();

const server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  development: { hmr: true, console: true },
  routes: {
    // Generated models and their manifest, served from `assets/` as the build copies them.
    '/assets/*': (request) => {
      const path = normalize(
        decodeURIComponent(new URL(request.url).pathname.slice('/assets/'.length)),
      );
      if (path.startsWith('..')) return new Response('Not found', { status: 404 });
      const file = Bun.file(join(ASSETS_DIR, path));
      return file.size > 0 ? new Response(file) : new Response('Not found', { status: 404 });
    },
    '/*': index,
  },
});

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

console.log(`\n  Balé dev server — HMR on, port ${server.port}\n`);
console.log(`  local    http://localhost:${server.port}`);
for (const address of lanAddresses()) {
  console.log(`  network  http://${address}:${server.port}`);
}
console.log('\n  Open the network URL on your phone (same Wi-Fi) to test on device.\n');
