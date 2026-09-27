# ADR-0008: Drop the Serena and context-mode MCP servers
- Status: Accepted
- Date: 2026-09-27
- Supersedes: [ADR-0006](0006-ai-agent-harness.md) items 5 and 7 (MCP servers, output brevity). The rest of ADR-0006 stands.

## Context

ADR-0006 registered two MCP servers in a committed `.mcp.json`: **Serena** for
symbol-level navigation and editing, and **context-mode** for sandboxed tool
output. `CLAUDE.md` then told agents to prefer them over reading files and over
letting large output into context. The cloud setup script installed both.

Measured in a real cloud session at the end of M0:

- Neither `serena`, `context-mode`, nor `serena-hooks` was on `PATH`.
- The setup script's installs are all `>/dev/null 2>&1 || true`, so a failed
  install is invisible. It happened, and nobody noticed for two milestones.
- The launcher scripts fall back to `uvx` / `npx`, which download on first use.
  With `MCP_TIMEOUT=60000` that produced four connect/disconnect cycles in one
  session, each injecting a 21-tool listing into context.
- The `PreToolUse` Serena hook matched `Grep|Glob|Read|Bash` and no-op'd. It was
  measured at ~5 ms per call — **not** a real cost, and it would have been wrong
  to remove it for that reason alone.

The damage was not latency. It was that **the project's stated token strategy
could not run**. Agents were told to prefer symbol tools that did not exist, so
every session silently fell back to `grep`, and the advice that would have
made `grep` efficient had been replaced by advice about Serena.

## Decision

Remove both servers, their launchers, their hooks, and every instruction that
depends on them. Delete `.mcp.json`; the project registers **no MCP servers**.

Replace the Serena guidance in `CLAUDE.md` with the technique that actually
works here: narrow with `Grep output_mode: "count"`, then read only the matching
region with `-n -C 3` or `sed -n 'A,Bp'`.

Add `tools/gh.ts` so GitHub API work needs neither `curl` in the allow-list nor
shell-escaped PR bodies.

## Consequences

**Good**
- The harness no longer advertises capabilities it does not have. An agent that
  follows `CLAUDE.md` literally now does the right thing.
- Nothing to install, so cloud sessions start faster and cannot half-fail.
- `curl` stays out of the allow-list. Permission patterns match a command
  prefix and a URL comes after the flags, so `Bash(curl:*)` would have allowed
  requests to any host. `Bash(bun tools/:*)` is scoped to code in this repo.

**Bad / accepted**
- No symbol-level editing. Acceptable at this size: 33 source files, where
  `grep` is instant. Serena earns its keep in codebases two orders of magnitude
  larger, and this ADR should be revisited if the repo gets there.
- Large tool output is managed by hand (`| tail`, `| grep`, an `awk` that prints
  only the number wanted) rather than sandboxed.

**Follow-ups**
- `scripts/cloud-env-setup.sh` must **report** what it failed to install instead
  of swallowing errors. A silent `|| true` is what let this rot for two
  milestones.
- Revisit if the repo passes ~1 000 source files.

## Alternatives considered

- **Install them properly** (fix the setup script, verify on PATH). Rejected for
  now: it buys symbol navigation for a 33-file repo while adding a Python
  toolchain and an `npx` package to every cold start. The cost is certain, the
  benefit is not.
- **Keep the config, drop the CLAUDE.md guidance.** Worst of both: cold-start
  cost and reconnect noise with no instruction telling anyone to use them.
- **Keep Serena, drop context-mode.** Serena is the one whose absence actively
  misled the token strategy, so it is the one that had to go first.
