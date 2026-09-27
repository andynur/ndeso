#!/usr/bin/env bun
/**
 * Placeholder for a `bun run <script>` that a later ROADMAP task implements.
 * Prints `TODO <task-id>` and exits 0 so `bun run check` / `bun run ci` stay green
 * during M0. Replace the package.json line when the real script lands.
 *
 * Usage: bun tools/todo.ts M0-05 'import boundary check'
 */
const [taskId, what] = process.argv.slice(2);
console.log(what ? `TODO ${taskId} — ${what}` : `TODO ${taskId}`);
