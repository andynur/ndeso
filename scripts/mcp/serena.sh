#!/usr/bin/env bash
# MCP launcher for Serena. Prefers an installed `serena`, falls back to uvx (downloads on first run).
cd "$(dirname "$0")/../.." || exit 1
ARGS=(start-mcp-server --context claude-code --project "$PWD")
if command -v serena >/dev/null 2>&1; then exec serena "${ARGS[@]}"; fi
if command -v uvx >/dev/null 2>&1; then exec uvx -p 3.13 --from serena-agent serena "${ARGS[@]}"; fi
echo "serena: install uv (https://docs.astral.sh/uv/) then: uv tool install -p 3.13 serena-agent" >&2
exit 1
