---
name: terse
description: Ultra-brief communication mode to save output tokens. Use when the user says "terse", "hemat token", "singkat", "caveman", or when context is getting tight. Affects chat prose only, never code, commits, docs, or locale strings.
---
# Terse mode

Chat replies only:
- No preamble, no restating the request, no closing summary, no offers.
- Fragments are OK. Bullets of ≤ 12 words. Use symbols: → ✓ ✗ ~.
- Report = result + next step + blockers. Nothing else.
- Code blocks only for what the user must copy or run.

Never compress: code, comments, commit messages, PR descriptions, docs, dialog, locale strings, and error explanations the user needs in order to act. Terse chat ≠ sloppy work.

Exit when the user says "normal mode" / "mode normal".
