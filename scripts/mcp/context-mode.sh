#!/usr/bin/env bash
# MCP launcher for context-mode (MCP-only mode; routing hooks come from the plugin when installed locally).
if command -v context-mode >/dev/null 2>&1; then exec context-mode; fi
exec npx -y context-mode
