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
import index from '../apps/client/index.html';

const { PORT } = process.env;
const port = Number(PORT ?? 3000);

const server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  development: { hmr: true, console: true },
  routes: { '/*': index },
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
