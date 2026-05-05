#!/usr/bin/env bash
#
# Generate trusted dev certificates for the moq-test-page.
#
# Uses mkcert (https://github.com/FiloSottile/mkcert) to:
#   1. Install a local CA into the system (and Firefox) trust stores, so
#      browsers accept the dev cert without warnings.
#   2. Issue a leaf cert covering localhost, 127.0.0.1 and dev.panaudia.com.
#
# Re-running the script is safe; mkcert -install is idempotent and the leaf
# cert is regenerated each run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/../certs"

if ! command -v mkcert >/dev/null 2>&1; then
  cat >&2 <<EOF
mkcert is not installed.

  macOS:          brew install mkcert nss
  Debian/Ubuntu:  sudo apt-get install -y libnss3-tools
                  # then download mkcert from https://github.com/FiloSottile/mkcert/releases
  Windows:        choco install mkcert

Then re-run this script.
EOF
  exit 1
fi

# Install the local CA into the OS + Firefox trust stores. Safe to re-run.
mkcert -install

mkdir -p "$CERTS_DIR"

mkcert \
  -key-file "$CERTS_DIR/server.key" \
  -cert-file "$CERTS_DIR/server.crt" \
  localhost 127.0.0.1 ::1 dev.panaudia.com

cat <<EOF

Dev certificates written to:
  $CERTS_DIR/server.crt
  $CERTS_DIR/server.key

Covered hostnames: localhost, 127.0.0.1, ::1, dev.panaudia.com

Run \`npm run dev\` next — Vite will find these under ./certs/ automatically.
EOF
