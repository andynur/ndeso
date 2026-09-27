#!/usr/bin/env bash
# Paste this into the Claude Code cloud environment "Setup script" field
# (claude.ai/code → environment selector → ⚙ → Setup script).
# Runs as root before Claude Code starts; the result is cached (~7 days), so keep it < 5 min.
# Repo-specific steps (bun install) run later in the SessionStart hook.
#
# This script REPORTS what it could not install. It used to hide every failure behind
# `>/dev/null 2>&1 || true`, which is how two MCP servers stayed configured-but-absent for
# two milestones (ADR-0008). A setup step that can fail silently will.
set -u
BUN_VERSION=1.4.1
FAILED=""

# Pinned Bun (the VM ships an older one)
if ! npm install -g "bun@${BUN_VERSION}" >/tmp/bun-install.log 2>&1; then
  FAILED="${FAILED} bun(npm-install)"
fi
NB="$(readlink -f "$(npm prefix -g)/bin/bun" 2>/dev/null)"
for p in /root/.bun/bin/bun /usr/local/bin/bun; do
  if [ -e "$p" ] && [ -n "$NB" ] && [ "$(readlink -f "$p")" != "$NB" ]; then ln -sf "$NB" "$p"; fi
done

# Verify, don't assume: an install that "succeeded" but left the wrong binary on PATH is
# the failure mode that actually bites.
ACTUAL="$(bun --version 2>/dev/null || echo missing)"
if [ "$ACTUAL" != "$BUN_VERSION" ]; then
  FAILED="${FAILED} bun(want ${BUN_VERSION}, got ${ACTUAL})"
fi

if [ -n "$FAILED" ]; then
  echo "SETUP INCOMPLETE —${FAILED}"
  echo "see /tmp/bun-install.log; the SessionStart hook will warn again"
  exit 1
fi

echo "setup ok — bun ${ACTUAL}"
exit 0
