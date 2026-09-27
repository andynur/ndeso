#!/usr/bin/env bash
# SessionStart hook: (cloud) make sure toolchain + deps exist, then print the STATUS "Now" block.
# Stdout of this hook is added to Claude's context, so keep output SMALL.
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT" || exit 0
LOG="${TMPDIR:-/tmp}/ndeso-session-setup.log"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  {
    # shellcheck source=../lib-bun.sh
    . scripts/lib-bun.sh
    ensure_bun "$(cat .bun-version 2>/dev/null || echo 1.4.1)"
    if [ -f package.json ] && [ ! -d node_modules ]; then
      bun install --frozen-lockfile 2>&1 | tail -n 5 || bun install 2>&1 | tail -n 5
    fi
  } >"$LOG" 2>&1 || true
  if [ "$(bun --version 2>/dev/null)" != "$(cat .bun-version 2>/dev/null)" ]; then
    echo "[setup] WARNING: Bun version mismatch ($(bun --version 2>/dev/null)); see $LOG"
  fi
fi

if [ -f docs/STATUS.md ]; then
  echo "=== docs/STATUS.md — Now ==="
  awk '/^## Now/{f=1;next} /^## /{f=0} f' docs/STATUS.md | sed '/^$/d' | head -n 15
fi
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?') | bun $(bun --version 2>/dev/null || echo '?')"
exit 0
