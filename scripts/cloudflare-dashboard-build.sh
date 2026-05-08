#!/usr/bin/env bash
set -euo pipefail

if ! command -v cargo >/dev/null 2>&1 || ! command -v rustup >/dev/null 2>&1; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
fi

# shellcheck disable=SC1091
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

rustup target add wasm32-unknown-unknown

BW_WEB_VERSION="${BW_WEB_VERSION:-v2026.3.1}"
ARCHIVE="bw_web_${BW_WEB_VERSION}.tar.gz"

curl -L "https://github.com/dani-garcia/bw_web_builds/releases/download/${BW_WEB_VERSION}/${ARCHIVE}" -o "${ARCHIVE}"
mkdir -p public
tar -xzf "${ARCHIVE}" -C public/
rm "${ARCHIVE}"
find public/web-vault -type f -name '*.map' -delete
mkdir -p public/web-vault/css/
cp public/css/vaultwarden.css public/web-vault/css/ || true
