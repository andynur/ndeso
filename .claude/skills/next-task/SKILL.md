---
name: next-task
description: Pick up and complete the next ROADMAP task end-to-end (plan, implement, test, handoff). Use when the user says "next task", "lanjut", "continue", or names a task id like M1-03.
---
# Next task workflow

1. **Orient (cheap):** the SessionStart hook already printed the STATUS "Now" block. Open `docs/ROADMAP.md` and find the task (given id, or the first unchecked task whose milestone is current). Read only the doc sections the task references.
2. **Branch:** `git switch -c <type>/<task-id>-<slug>` (skip in cloud sessions that already have a session branch).
3. **Plan (≤ 10 lines in chat):** files to touch, approach, tests, risks. If the task is ambiguous or conflicts with docs, ask **one** question before coding. Otherwise proceed.
4. **Explore minimally:** Serena `get_symbols_overview`/`find_symbol` on the files involved; use the `scout` subagent for anything wider.
5. **Implement in small steps.** Tests alongside the code (sim: unit + golden when balance changes).
6. **Verify:** `bun run check 2>&1 | tail -n 40`. Fix until green. For render/UI tasks, also `bun run build` and describe what to check visually on a phone.
7. **Review:** run the `reviewer` subagent on the diff; fix blockers.
8. **Handoff:** run the `session-handoff` skill (ROADMAP checkbox, STATUS entry, commit message).
9. Stop. Don't start the next task in the same session unless the user asks.
