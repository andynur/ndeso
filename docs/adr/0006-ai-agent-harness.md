# ADR-0006: AI agent harness & token strategy
- Status: Accepted
- Date: 2026-09-26

## Context
Most implementation is done by AI coding agents (Claude Code in cloud sessions from the GitHub repo, sometimes locally). Sessions start fresh, context windows are finite, and tokens cost money and rate limit.

## Decision
1. `AGENTS.md` = canonical, tool-agnostic rules. `CLAUDE.md` imports it and adds Claude-specific notes. Both stay short (progressive disclosure: docs are read on demand, not @-imported).
2. Path-scoped rules in `.claude/rules/` load only when relevant files are touched.
3. Skills in `.claude/skills/` for repeatable workflows (next task, add content, i18n, handoff), loaded on demand.
4. Subagents in `.claude/agents/` for exploration, review, and checks with cheaper models, keeping the main context clean.
5. MCP servers in `.mcp.json` (committed, so cloud sessions get them): **Serena** (symbol-level navigation and editing) and **context-mode** (sandboxed tool output + indexed search). Optional servers are documented, not enabled.
6. `docs/STATUS.md` handoff plus the SessionStart hook replace long-running sessions: one task per session.
7. Output brevity via our own `terse` skill; the Caveman plugin is optional for local use (lite mode).
8. Hooks enforce architecture (sim purity), format on edit, and bootstrap cloud sessions.

## Consequences
- + Predictable, cheap sessions; knowledge persists in the repo, not in chat history.
- − The harness must be maintained as tools evolve. Review this ADR every milestone.
- Note: Claude Code cloud sessions do **not** install plugins declared in repo settings, so context-mode runs there as an MCP server only (no routing hooks) and Caveman is local-only. See docs/AI_WORKFLOW.md.
