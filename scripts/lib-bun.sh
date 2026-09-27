#!/usr/bin/env bash
# Shared helper: make sure the pinned Bun version is the one on PATH.
# Cloud VMs ship an older Bun; installing via npm works through the cloud proxy.
ensure_bun() {
  local want="${1:-1.4.1}" nb cur
  [ "$(bun --version 2>/dev/null)" = "$want" ] && return 0
  echo "[bun] installing bun@$want via npm (found: $(bun --version 2>/dev/null || echo none))"
  npm install -g "bun@$want" >/dev/null 2>&1 || { echo "[bun] npm install failed"; return 1; }
  hash -r
  if [ "$(bun --version 2>/dev/null)" != "$want" ]; then
    # An older bun earlier on PATH (e.g. ~/.bun/bin) shadows the npm one: point it at the new binary.
    nb="$(readlink -f "$(npm prefix -g)/bin/bun")"
    cur="$(command -v bun || true)"
    if [ -n "$cur" ] && [ -n "$nb" ] && [ "$(readlink -f "$cur")" != "$nb" ]; then
      ln -sf "$nb" "$cur" && hash -r
    fi
  fi
  [ "$(bun --version 2>/dev/null)" = "$want" ] && echo "[bun] ok $(bun --version)"
}
