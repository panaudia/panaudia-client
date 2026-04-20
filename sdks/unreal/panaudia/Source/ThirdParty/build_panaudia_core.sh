#!/bin/bash
# Build libpanaudia-core for macOS arm64 and copy artifacts into ThirdParty/panaudia-core/
#
# Usage:
#   ./build_panaudia_core.sh              # Production: fetch from GitHub (origin/main)
#   ./build_panaudia_core.sh local        # Development: use local sibling repo
#   ./build_panaudia_core.sh local /path  # Development: use specified local path

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CORE_REPO="https://github.com/panaudia/libpanaudia-core.git"
DEST="$SCRIPT_DIR/panaudia-core"

# Default local path: sibling repo relative to panaudia-client
DEFAULT_LOCAL_PATH="$SCRIPT_DIR/../../../../../../libpanaudia-core"

if [ "${1:-}" = "local" ]; then
    # --- Local development build ---
    CORE_SRC="${2:-$DEFAULT_LOCAL_PATH}"

    # Resolve to absolute path
    CORE_SRC="$(cd "$CORE_SRC" && pwd)"

    if [ ! -f "$CORE_SRC/CMakeLists.txt" ]; then
        echo "ERROR: No CMakeLists.txt found at $CORE_SRC"
        exit 1
    fi

    echo "=== Building libpanaudia-core from LOCAL source ==="
    echo "Source: $CORE_SRC"
else
    # --- Production build (from GitHub) ---
    CORE_SRC="$SCRIPT_DIR/panaudia-core-src"

    if [ -d "$CORE_SRC/.git" ]; then
        echo "=== Updating libpanaudia-core from GitHub ==="
        cd "$CORE_SRC"
        git fetch origin
        git reset --hard origin/main
    else
        echo "=== Cloning libpanaudia-core from GitHub ==="
        rm -rf "$CORE_SRC"
        git clone "$CORE_REPO" "$CORE_SRC"
    fi

    echo "Source: $CORE_SRC"
fi

echo "Destination: $DEST"

# Build in the source directory — static build (for editor / dylib consumers)
cd "$CORE_SRC"
cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES=arm64
cmake --build build -j$(sysctl -n hw.ncpu)

# Clear and create destination structure
rm -rf "$DEST"
mkdir -p "$DEST/include/panaudia"
mkdir -p "$DEST/lib/Mac"

# Copy public headers
cp "$CORE_SRC"/include/panaudia/*.h "$DEST/include/panaudia/"

# Copy static library
cp "$CORE_SRC/build/libpanaudia-core.a" "$DEST/lib/Mac/"

# Copy libopus (static — transitive dep not embedded in .a)
cp "$CORE_SRC/build/_deps/opus-build/libopus.a" "$DEST/lib/Mac/"

# Copy libmsquic (static — QUIC transport) with OpenSSL symbols hidden.
# msquic bundles OpenSSL 3.x which conflicts with UE's OpenSSL 1.1.x in
# monolithic (packaged) builds. Merging into a single .o and re-exporting
# only msquic's public API makes the OpenSSL symbols local/private.
MSQUIC_RAW="$CORE_SRC/build/_deps/msquic-build/bin/Release/libmsquic.a"

# Hide all symbols inside libmsquic.a except the two that libpanaudia-core
# needs (_MsQuicOpenVersion, _MsQuicClose). This prevents msquic's bundled
# OpenSSL 3.x from conflicting with UE's OpenSSL 1.1.x in monolithic builds.
# Using nmedit -s (keep-list) ensures ALL internal references — including
# msquic→OpenSSL calls — stay resolved to the bundled copies.
KEEP_SYMBOLS=$(mktemp)
cat > "$KEEP_SYMBOLS" << 'SYMBOLS'
_MsQuicOpenVersion
_MsQuicClose
SYMBOLS

echo "Hiding all symbols in libmsquic.a except MsQuicOpenVersion and MsQuicClose"

# Merge all .o files into a single relocatable object (resolves internal refs)
ld -r -arch arm64 -all_load "$MSQUIC_RAW" -o "$DEST/lib/Mac/libmsquic_merged.o"

# Keep only the two API symbols global, everything else becomes static/local
nmedit -s "$KEEP_SYMBOLS" "$DEST/lib/Mac/libmsquic_merged.o"

# Re-wrap as static archive
ar rcs "$DEST/lib/Mac/libmsquic.a" "$DEST/lib/Mac/libmsquic_merged.o"
rm "$DEST/lib/Mac/libmsquic_merged.o"
rm "$KEEP_SYMBOLS"

echo ""
echo "=== Artifacts ==="
ls -lh "$DEST/lib/Mac/"
echo ""
echo "=== Headers ==="
ls "$DEST/include/panaudia/"
echo ""
echo "=== Done ==="
