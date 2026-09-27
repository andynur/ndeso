#!/usr/bin/env bash
# Paste this into the Claude Code cloud environment "Setup script" field
# (claude.ai/code → environment selector → ⚙ → Setup script).
# Runs as root before Claude Code starts; the result is cached (~7 days), so keep it < 5 min.
# Repo-specific steps (bun install) run later in the SessionStart hook.
set -u
BUN_VERSION=1.4.1

# 1) Pinned Bun (the VM ships an older one)
npm install -g "bun@${BUN_VERSION}" >/dev/null 2>&1 || true
NB="$(readlink -f "$(npm prefix -g)/bin/bun" 2>/dev/null)"
for p in /root/.bun/bin/bun /usr/local/bin/bun; do
  if [ -e "$p" ] && [ -n "$NB" ] && [ "$(readlink -f "$p")" != "$NB" ]; then ln -sf "$NB" "$p"; fi
done

# 2) Serena (semantic code tools) + 3) context-mode (context saver), in parallel
( uv tool install -p 3.13 serena-agent >/dev/null 2>&1 || true ) &
( npm install -g context-mode >/dev/null 2>&1 || true ) &
wait

# Make uv tools visible on PATH for later processes
ln -sf /root/.local/bin/serena /usr/local/bin/serena 2>/dev/null || true
ln -sf /root/.local/bin/serena-hooks /usr/local/bin/serena-hooks 2>/dev/null || true

echo "bun $(bun --version 2>/dev/null) | serena $(command -v serena >/dev/null && echo ok || echo missing) | context-mode $(command -v context-mode >/dev/null && echo ok || echo missing)"
exit 0
