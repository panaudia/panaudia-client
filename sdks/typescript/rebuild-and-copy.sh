#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="/Users/paul/Dropbox/glowinthedark/panaudia/code/panaudia/lark_audio/src/lark/apps/http/web/shared/static/examples/js/panaudia"

cd "$SCRIPT_DIR"

echo "Building @panaudia/client..."
npm run build

echo "Replacing $DEST with dist/"
rm -rf "$DEST"
cp -r dist "$DEST"

echo "Done."
