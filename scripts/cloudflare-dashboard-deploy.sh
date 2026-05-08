#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

npx wrangler deploy
