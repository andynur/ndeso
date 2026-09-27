# ADR-0006: AI agent harness & token strategy
- Status: Accepted — **items 5 and 7 superseded by [ADR-0008](0008-drop-serena-context-mode.md)**
- Date: 2026-09-26

## Context
Most implementation is done by AI coding agents (Claude Code in cloud sessions from the GitHub repo, sometimes locally). Sessions start fresh, context windows are finite, and tokens cost money and rate limit.

## Decision
1. `AGENTS.md` = canonical, tool-agnostic rules. `CLAUDE.md` imports it and adds Claude-specific notes. Both stay short (progressive disclosure: docs are read on demand, not @-imported).
2. Path-scoped rules in `.claude/rules/` load only when relevant files are touched.
3. Skills in `.claude/skills/` for repeatable workflows (next task, add content, i18n, handoff), loaded on demand.
4. Subagents in `.claude/agents/` for exploration, review, and checks with cheaper models, keeping the main context clean.
5. ~~MCP servers in `.mcp.json` (committed, so cloud sessions get them): **Serena** and **context-mode**.~~ **Superseded by ADR-0008: no MCP servers.** They were configured but never actually installed, so the guidance that depended on them was unfollowable.
6. `docs/STATUS.md` handoff plus the SessionStart hook replace long-running sessions: one task per session.
7. Output brevity via our own `terse` skill. ~~The Caveman plugin is optional for local use.~~ **Superseded by ADR-0008**, along with the rest of the optional-plugin story.
8. Hooks enforce architecture (sim purity), format on edit, and bootstrap cloud sessions.

## Consequences
- + Predictable, cheap sessions; knowledge persists in the repo, not in chat history.
- − The harness must be maintained as tools evolve. Review this ADR every milestone.
- Note: Claude Code cloud sessions do **not** install plugins declared in repo settings. That, plus a setup script that swallowed its install errors, is how the MCP half of this ADR ended up configured-but-absent for two milestones. See [ADR-0008](0008-drop-serena-context-mode.md) and docs/AI_WORKFLOW.md.
