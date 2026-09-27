#!/usr/bin/env bash
# Runs Serena's Claude Code hooks if Serena is installed; silently no-ops otherwise.
# Never fails the tool call: Serena hook errors are swallowed.
# Usage: serena-hook.sh <remind|activate|cleanup|auto-approve>
if command -v serena-hooks >/dev/null 2>&1; then
  serena-hooks "$1" --client=claude-code 2>/dev/null || true
  exit 0
fi
cat >/dev/null  # drain hook stdin
exit 0
