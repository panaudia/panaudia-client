#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MSQUIC_DIR="$SCRIPT_DIR/msquic"
QUICTLS_DIR="$SCRIPT_DIR/quictls"

echo "Building msquic as shared library (dylib) for macOS..."
echo "  MSQUIC_DIR: $MSQUIC_DIR"
echo "  QUICTLS_DIR: $QUICTLS_DIR"

# Build arm64
echo ""
echo "=== Building msquic arm64 (shared) ==="
cmake -S "$MSQUIC_DIR" -B "$MSQUIC_DIR/build/arm64" \
    -DCMAKE_BUILD_TYPE=Release \
    -DQUIC_BUILD_SHARED=ON \
    -DQUIC_ENABLE_LOGGING=OFF \
    -DQUIC_TLS_LIB=openssl \
    -DQUIC_BUILD_TOOLS=OFF \
    -DQUIC_BUILD_TEST=OFF \
    -DQUIC_BUILD_PERF=OFF \
    -DOPENSSL_ROOT_DIR="$QUICTLS_DIR/build/arm64" \
    -DCMAKE_OSX_ARCHITECTURES="arm64" \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DCMAKE_INSTALL_RPATH="@loader_path"

cmake --build "$MSQUIC_DIR/build/arm64" --config Release -- -j$(sysctl -n hw.ncpu)

# Build x86_64
echo ""
echo "=== Building msquic x86_64 (shared) ==="
cmake -S "$MSQUIC_DIR" -B "$MSQUIC_DIR/build/x86_64" \
    -DCMAKE_BUILD_TYPE=Release \
    -DQUIC_BUILD_SHARED=ON \
    -DQUIC_ENABLE_LOGGING=OFF \
    -DQUIC_TLS_LIB=openssl \
    -DQUIC_BUILD_TOOLS=OFF \
    -DQUIC_BUILD_TEST=OFF \
    -DQUIC_BUILD_PERF=OFF \
    -DOPENSSL_ROOT_DIR="$QUICTLS_DIR/build/x86_64" \
    -DCMAKE_OSX_ARCHITECTURES="x86_64" \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DCMAKE_INSTALL_RPATH="@loader_path"

cmake --build "$MSQUIC_DIR/build/x86_64" --config Release -- -j$(sysctl -n hw.ncpu)

# Create universal binary
echo ""
echo "=== Creating universal dylib ==="
OUTPUT_DIR="$SCRIPT_DIR/msquic/build/Mac/Release"
mkdir -p "$OUTPUT_DIR"

# Find the shared library
ARM64_DYLIB=$(find "$MSQUIC_DIR/build/arm64" -name "libmsquic.dylib" -o -name "libmsquic.*.dylib" | grep -v cmake | head -1)
X86_DYLIB=$(find "$MSQUIC_DIR/build/x86_64" -name "libmsquic.dylib" -o -name "libmsquic.*.dylib" | grep -v cmake | head -1)

if [ -z "$ARM64_DYLIB" ] || [ -z "$X86_DYLIB" ]; then
    echo "ERROR: Could not find msquic shared library"
    echo "  arm64 search: $(find "$MSQUIC_DIR/build/arm64" -name "libmsquic*" | head -5)"
    echo "  x86_64 search: $(find "$MSQUIC_DIR/build/x86_64" -name "libmsquic*" | head -5)"
    exit 1
fi

echo "  arm64 dylib: $ARM64_DYLIB"
echo "  x86_64 dylib: $X86_DYLIB"

lipo -create "$ARM64_DYLIB" "$X86_DYLIB" -output "$OUTPUT_DIR/libmsquic.dylib"

# Set install name to @rpath so UE can find it
install_name_tool -id "@rpath/libmsquic.dylib" "$OUTPUT_DIR/libmsquic.dylib"

echo ""
echo "=== Result ==="
lipo -info "$OUTPUT_DIR/libmsquic.dylib"
echo "Install name:"
otool -D "$OUTPUT_DIR/libmsquic.dylib"

# Copy headers
INCLUDE_DIR="$SCRIPT_DIR/msquic/include"
if [ ! -d "$INCLUDE_DIR" ]; then
    mkdir -p "$INCLUDE_DIR"
    cp "$MSQUIC_DIR/src/inc/msquic.h" "$INCLUDE_DIR/"
    cp "$MSQUIC_DIR/src/inc/msquic_posix.h" "$INCLUDE_DIR/" 2>/dev/null || true
    cp "$MSQUIC_DIR/src/inc/quic_platform.h" "$INCLUDE_DIR/" 2>/dev/null || true
fi

echo ""
echo "Build complete!"
echo "  Library: $OUTPUT_DIR/libmsquic.dylib"
echo "  Headers: $INCLUDE_DIR/"
echo ""
echo "NOTE: Remove libssl.a and libcrypto.a from Build.cs — they are now internal to the dylib."
