# AI WORKFLOW — agent harness & token strategy

> How this repo is set up for AI coding agents (primarily Claude Code cloud sessions launched from GitHub), and why. Decision record: [ADR-0006](adr/0006-ai-agent-harness.md). Indonesian setup guide: [id/SETUP_AI_AGENT.md](id/SETUP_AI_AGENT.md).

## 1. Layers of the harness

| Layer | File(s) | Loaded | Purpose |
|---|---|---|---|
| Canonical rules | `AGENTS.md` | Always (via `CLAUDE.md` import; other agents read it natively) | Hard rules, commands, doc map. Keep < 100 lines |
| Claude specifics | `CLAUDE.md` | Always | Token discipline, skills, subagents, hooks |
| Path rules | `.claude/rules/*.md` (`paths:` frontmatter) | Only when matching files are touched | Domain rules for sim, render, UI, content, tests |
| Skills | `.claude/skills/*/SKILL.md` | Name + description always; body on demand | Repeatable workflows: `next-task`, `add-game-content`, `i18n-string`, `session-handoff`, `terse` |
| Subagents | `.claude/agents/*.md` | On delegation, in their own context | `scout` (Haiku), `reviewer`, `i18n-translator`, `perf-auditor` (Sonnet) |
| Hooks | `.claude/settings.json` + `scripts/hooks/` | Automatic | Cloud bootstrap, STATUS injection, sim-purity guard, Biome format, Serena reminders |
| MCP | `.mcp.json` (committed) | Session start | Serena, context-mode |
| Memory across sessions | `docs/STATUS.md`, ROADMAP ticks, ADRs | Via hook / on demand | Replaces long chat history |
| Human entry point | `MASTER_PROMPT.md` | Pasted by the human | Bootstrap and daily prompts |

**Design rule:** anything always loaded must be short. Everything else is *discoverable* (doc map in AGENTS.md) and read on demand. Don't `@import` large docs into CLAUDE.md.

## 2. What works where

Claude Code cloud sessions load what is **committed in the repo**: `CLAUDE.md`, `.claude/settings.json` hooks and permissions, `.claude/rules|skills|agents`, and `.mcp.json`. They do **not** install plugins declared in repo settings, and they don't read your personal `~/.claude` config.

| Tool | Cloud session (from GitHub) | Local CLI / desktop |
|---|---|---|
| Serena MCP | ✓ via `.mcp.json` → `scripts/mcp/serena.sh` (uses the installed `serena`, else `uvx`) | ✓ same. Optionally launch with Serena's system-prompt override (§4.1) |
| Serena hooks | ✓ via `scripts/hooks/serena-hook.sh` (no-op if not installed) | ✓ |
| context-mode | ✓ **MCP-only** (tools available; the model must choose them, and CLAUDE.md tells it when) | ✓✓ Install the **plugin** for routing hooks + session continuity (§4.2) |
| Caveman | ✗ (plugin) → use our `terse` skill instead | ✓ plugin, **lite mode** recommended (§4.3) |
| Project skills / agents / rules | ✓ | ✓ |

## 3. Token strategy (in order of impact)

1. **One task per session.** Fresh sessions start from STATUS.md (~15 lines) instead of a long chat history. This is the biggest saver.
2. **Short always-on context.** AGENTS + CLAUDE ≈ 150 lines total. Rules load per path. Skill bodies load on demand.
3. **Symbol-level navigation (Serena).** `get_symbols_overview` + `find_symbol` read one function instead of a 600-line file. `replace_symbol_body` edits without re-reading.
4. **Keep large outputs out of context (context-mode).** Test logs, build output, JSON dumps, and web docs are processed in a sandbox; only the answer enters context. Fallback without it: `| tail -n 40`, `grep`.
5. **Delegate breadth to subagents.** `scout` (Haiku) reads 20 files in *its own* context and returns 15 lines.
6. **Deny-list junk reads.** `bun.lock`, `dist/`, assets, and `node_modules` are denied in settings.
7. **Hooks do deterministic work.** Formatting and purity checks cost zero model tokens, and they catch mistakes before a CI round trip.
8. **Terse chat output.** The `terse` skill (or Caveman lite locally) for conversation. **Never** for code, docs, or dialog.
9. **Right model per job.** Main session on the strongest model for design/implementation. `scout` on Haiku. Reviewers on Sonnet.
10. **Compact deliberately.** `/context` to inspect; `/compact keep <task decisions, failing tests>` before the window fills.

Realistic expectations: context-mode reports large savings on *tool output* (its README shows e.g. 986 KB → 62 KB for repo research), but mainly when its hooks route tools automatically. Caveman's own A/B data shows only single-digit % output savings in agentic coding sessions, because most tokens are code and tool calls. The biggest real wins are items 1–5.

## 4. Local setup (optional, for maintainers on their own machine)

### 4.1 Serena
```bash
# prerequisite: uv  (https://docs.astral.sh/uv/)
uv tool install -p 3.13 serena-agent
serena init
# The repo's .mcp.json already registers Serena for this project. Verify inside Claude Code with /mcp.
# Recommended by Serena to counter Claude Code's bias toward built-in tools:
alias claude-kt='claude --system-prompt="$(serena prompts print-cc-system-prompt-override)"'
```
Serena's docs warn against installing it from MCP/plugin marketplaces (outdated commands). Use the command above.
Project knowledge belongs in `docs/` (shared with humans), **not** in Serena memories. Serena memories are fine for personal scratch notes.

### 4.2 context-mode (plugin = full routing)
```text
/plugin marketplace add mksglu/context-mode
/plugin install context-mode@context-mode
/reload-plugins            # then verify:
/context-mode:ctx-doctor
/context-mode:ctx-stats    # savings for this session
```
If the plugin is installed, the project `.mcp.json` entry can register a duplicate server. If `/mcp` shows two, disable the project one locally (`/mcp` → disable `context-mode`).
License note: context-mode is under the **Elastic License 2.0** (source-available, not OSI open source). It's a dev tool only; we never vendor or redistribute it.

### 4.3 Caveman (optional)
```text
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman
/caveman lite        # recommended: drops filler, keeps grammar
```
Guidance: use `lite` for chat. Don't use `ultra` while designing or debugging, because very aggressive brevity can hurt reasoning quality. Don't run `caveman-compress` on AGENTS.md/CLAUDE.md: they are already terse, and humans read them too.

### 4.4 Optional MCP servers (not enabled by default; each adds tool schemas to context)
| Server | When worth it | How |
|---|---|---|
| Context7 (library docs) | Three.js/Bun API questions | `claude mcp add --transport http context7 https://mcp.context7.com/mcp` (local). In cloud, also allow `mcp.context7.com` in the environment's network settings |
| Playwright MCP | Rarely. Prefer `bun run smoke` (Bun.WebView) plus screenshots | local only |
| GitHub | Not needed in cloud (built-in GitHub tools) | — |

## 5. Session lifecycle (what "good" looks like)

```
SessionStart hook → bun ok, deps ok, STATUS Now printed (≈ 20 lines of context)
User: /next-task
Agent: reads ROADMAP task + referenced doc sections → 10-line plan
      → Serena overview of target files → implement + tests
      → bun run check (tail) → reviewer subagent → fixes
      → session-handoff: ROADMAP ✓, STATUS updated, commit
      → 5-line reply. Session ends.
```

## 6. Maintaining the harness

- Review this file and ADR-0006 at each milestone. Remove rules that agents already follow; add a rule only after the same mistake happens twice.
- Keep CLAUDE.md + AGENTS.md short. If a rule is long, move it into a path-scoped rule or a skill.
- When a tool changes behavior (Claude Code, Serena, context-mode), update the launcher scripts in `scripts/mcp/`, not the docs everywhere.
