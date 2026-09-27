---
name: session-handoff
description: End-of-task handoff. Updates docs/STATUS.md and the ROADMAP checkbox, and prepares a conventional commit (and PR text if asked). Use when a task is done or the session is about to end or compact.
---
# Session handoff

1. `docs/ROADMAP.md`: tick `[x]` for the finished task. If you discovered follow-up work, add new tasks with the next free id in the same milestone.
2. `docs/STATUS.md`:
   - Rewrite the **Now** block (≤ 15 lines): milestone, next task id, blockers, open decisions, known issues.
   - Prepend a **Log** entry (≤ 6 lines): date · task id · branch; Done; Tests; Notes/decisions; Next.
   - If Log has more than ~10 entries, move the oldest into `docs/status-archive.md`.
3. If a decision was made that is costly to reverse, add an ADR (`docs/adr/0000-template.md`).
4. Commit: `git add -A && git commit -m "<type>(<scope>): <task-id> <summary>"`, with a body listing notable changes (3–6 bullets).
5. If the user asked for a PR: title = commit subject; body = What/Why, task id, test evidence (`bun run check` summary), screenshots or a GIF note for visual changes, budget impact, and the PR template checklist.
6. Reply in ≤ 5 lines: what's done, what's next, anything the human must do (e.g. test on a phone).
