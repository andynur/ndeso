# AI WORKFLOW — agent harness & token strategy

> How this repo is set up for AI coding agents (primarily Claude Code cloud sessions launched from GitHub), and why. Decision records: [ADR-0006](adr/0006-ai-agent-harness.md), [ADR-0008](adr/0008-drop-serena-context-mode.md). Indonesian setup guide: [id/SETUP_AI_AGENT.md](id/SETUP_AI_AGENT.md).

## 1. Layers of the harness

| Layer | File(s) | Loaded | Purpose |
|---|---|---|---|
| Canonical rules | `AGENTS.md` | Always (via `CLAUDE.md` import; other agents read it natively) | Hard rules, commands, doc map. Keep < 100 lines |
| Claude specifics | `CLAUDE.md` | Always | Token discipline, shell safety, skills, subagents, hooks |
| Path rules | `.claude/rules/*.md` (`paths:` frontmatter) | Only when matching files are touched | Domain rules for sim, render, UI, content, tests |
| Skills | `.claude/skills/*/SKILL.md` | Name + description always; body on demand | Repeatable workflows: `next-task`, `add-game-content`, `i18n-string`, `session-handoff`, `terse` |
| Subagents | `.claude/agents/*.md` | On delegation, in their own context | `scout` (Haiku), `reviewer`, `i18n-translator`, `perf-auditor` (Sonnet) |
| Hooks | `.claude/settings.json` + `scripts/hooks/` | Automatic | Cloud bootstrap, STATUS injection, sim-purity guard, Biome format |
| Repo tools | `tools/gh.ts`, `tools/check-links.ts` | On demand / in `bun run check` | Scoped replacements for hand-rolled `curl` and ad-hoc shell |
| Memory across sessions | `docs/STATUS.md`, ROADMAP ticks, ADRs | Via hook / on demand | Replaces long chat history |
| Human entry point | `MASTER_PROMPT.md` | Pasted by the human | Bootstrap and daily prompts |

**No MCP servers.** See [ADR-0008](adr/0008-drop-serena-context-mode.md).

**Design rule:** anything always loaded must be short. Everything else is *discoverable* (doc map in AGENTS.md) and read on demand. Don't `@import` large docs into CLAUDE.md.

## 2. What works where

Claude Code cloud sessions load what is **committed in the repo**: `CLAUDE.md`, `.claude/settings.json` hooks and permissions, and `.claude/rules|skills|agents`. They do **not** install plugins declared in repo settings, and they don't read your personal `~/.claude` config.

That asymmetry is the trap this harness already fell into: a tool that exists on a maintainer's laptop but not in the cloud produces guidance no cloud agent can follow, and nothing reports the gap. **If a capability is not verifiably present in a cloud session, do not write instructions that depend on it.**

## 3. Token strategy (in order of impact)

1. **One task per session.** Fresh sessions start from STATUS.md (~15 lines) instead of a long chat history. This is the biggest saver by a wide margin.
2. **Short always-on context.** AGENTS + CLAUDE ≈ 6 KB total. Rules load per path. Skill bodies load on demand.
3. **Narrow before reading.** `Grep output_mode:"count"` to find *where*, then `-n -C 3` to read only *that*; `sed -n 'A,Bp'` for a known slice. Whole-file reads only under ~150 lines or when rewriting.
4. **Keep large output out of context.** `| tail -n 40`, `| grep`, or an `awk` one-liner that prints the single number wanted. `BASH_MAX_OUTPUT_LENGTH=20000` is a backstop, not a budget.
5. **Delegate breadth to subagents — deliberately.** `scout` (Haiku) reads 20 files in *its own* context and returns 15 lines. But a subagent starts cold: one `reviewer` pass on a 16-file docs PR measured **90 555 tokens**. Required above 5 files or in `packages/sim`; skipped for one-file PRs.
6. **Deny-list junk reads.** `bun.lock`, `dist/`, assets and `node_modules` are denied in settings.
7. **Hooks do deterministic work.** Formatting and purity checks cost zero model tokens and catch mistakes before a CI round trip.
8. **Terse chat output.** The `terse` skill for conversation. **Never** for code, docs, or dialog.
9. **Right model per job.** Main session on the strongest model for design and implementation. `scout` on Haiku. Reviewers on Sonnet.
10. **Compact deliberately.** `/context` to inspect; `/compact keep <task decisions, failing tests>` before the window fills.

**Honest accounting.** Items 1 and 2 dominate. Items 3–4 are habits, not tooling, and they only work if the instructions describe tools that exist — the previous version of this file recommended Serena and context-mode, neither of which was installed, so the advice silently did nothing for two milestones. Measure before believing a savings claim, including the ones on this page.

## 4. Optional MCP servers

None are enabled. Each one adds tool schemas to context and a cold-start cost, so the bar is a capability the built-in tools genuinely lack.

| Server | When worth it | How |
|---|---|---|
| Context7 (library docs) | Three.js/Bun API questions where training data may be stale | `claude mcp add --transport http context7 https://mcp.context7.com/mcp` (local). In cloud, also allow `mcp.context7.com` in the environment's network settings |
| Serena (symbol tools) | Revisit past ~1 000 source files. Currently 33 — `grep` is instant | See [ADR-0008](adr/0008-drop-serena-context-mode.md) |
| Playwright MCP | Rarely. Prefer `bun run smoke` (Bun.WebView) plus screenshots | local only |
| GitHub | Not needed — use `bun tools/gh.ts` | — |

**Before enabling anything here:** add a line to `scripts/cloud-env-setup.sh` that *fails loudly* if the install did not land, and verify with `/mcp` in a real cloud session.

## 5. Session lifecycle (what "good" looks like)

```
SessionStart hook → bun ok, deps ok, STATUS Now printed (≈ 20 lines of context)
User: /next-task
Agent: reads ROADMAP task + referenced doc sections → 10-line plan
      → grep --count to locate, targeted reads → implement + tests
      → bun run check (tail) → reviewer subagent if > 5 files → fixes
      → session-handoff: ROADMAP ✓, STATUS updated, commit
      → 5-line reply. Session ends.
```

## 6. Maintaining the harness

- Review this file and its ADRs at each milestone. Remove rules that agents already follow; add a rule only after the same mistake happens twice.
- Keep CLAUDE.md + AGENTS.md short. If a rule is long, move it into a path-scoped rule or a skill.
- **A setup step that can fail silently will.** Every install in `scripts/cloud-env-setup.sh` must verify its result and report; no bare `|| true`.
- **Delete guidance the moment its tool goes away.** Stale advice is worse than no advice: an agent follows it, gets nothing, and the strategy the project believes it has is not the one running.
