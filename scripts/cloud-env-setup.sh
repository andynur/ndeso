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

# Trust the workspace, so the repo's own permission allow-list is actually honoured.
#
# Without this, Claude Code prints
#   "Ignoring 34 permissions.allow entries from .claude/settings.json:
#    this workspace has not been trusted"
# and every allow-listed command falls back to asking. The allow-list in
# .claude/settings.json is read-only shell verbs and safe git subcommands, reviewed in PRs
# like any other file — this makes that list effective rather than decorative.
#
# It grants nothing beyond what that file already declares: the deny-list still applies,
# and `git push`, `curl`, `wget` and dependency changes stay on "ask".
CLAUDE_JSON=/root/.claude.json
WORKSPACE="${BALE_WORKSPACE:-/home/user/repo}"
if ! python3 - "$CLAUDE_JSON" "$WORKSPACE" <<'PY'
import json, os, sys

path, workspace = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(path):
    try:
        with open(path) as handle:
            data = json.load(handle)
    except (OSError, ValueError) as error:
        # Do not clobber a file we could not parse — a corrupt ~/.claude.json is the
        # user's session history and credentials pointer.
        print(f"cannot read {path}: {error}", file=sys.stderr)
        raise SystemExit(1)

data.setdefault("projects", {}).setdefault(workspace, {})["hasTrustDialogAccepted"] = True
with open(path, "w") as handle:
    json.dump(data, handle, indent=2)
PY
then
  FAILED="${FAILED} trust(${WORKSPACE})"
fi

if [ -n "$FAILED" ]; then
  echo "SETUP INCOMPLETE —${FAILED}"
  echo "see /tmp/bun-install.log; the SessionStart hook will warn again"
  exit 1
fi

echo "setup ok — bun ${ACTUAL} | workspace trusted: ${WORKSPACE}"
exit 0
