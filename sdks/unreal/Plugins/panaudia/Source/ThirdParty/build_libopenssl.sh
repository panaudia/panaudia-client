
#!/bin/bash

set -e

echo "Building OpenSSL 1.1.1 for Mac (Universal Binary)..."

OPENSSL_VERSION="1.1.1w"
OPENSSL_URL="https://www.openssl.org/source/openssl-${OPENSSL_VERSION}.tar.gz"
OPENSSL_TARBALL="openssl-${OPENSSL_VERSION}.tar.gz"

# Clean up any corrupted downloads
if [ -f "$OPENSSL_TARBALL" ]; then
    echo "Removing existing tarball..."
    rm "$OPENSSL_TARBALL"
fi

# Download
echo "Downloading OpenSSL ${OPENSSL_VERSION}..."
if command -v wget &> /dev/null; then
    wget "$OPENSSL_URL"
elif command -v curl &> /dev/null; then
    curl -L -O "$OPENSSL_URL"
else
    echo "ERROR: Neither wget nor curl found. Please install one of them."
    exit 1
fi

# Verify the download
if [ ! -f "$OPENSSL_TARBALL" ]; then
    echo "ERROR: Download failed - tarball not found"
    exit 1
fi

# Check if it's a valid gzip file
if ! gzip -t "$OPENSSL_TARBALL" 2>/dev/null; then
    echo "ERROR: Downloaded file is not a valid gzip archive"
    echo "File size: $(ls -lh $OPENSSL_TARBALL | awk '{print $5}')"
    echo "File type: $(file $OPENSSL_TARBALL)"
    rm "$OPENSSL_TARBALL"
    exit 1
fi

# Extract
echo "Extracting..."
tar -xzf "$OPENSSL_TARBALL"

# Verify extraction
if [ ! -d "openssl-${OPENSSL_VERSION}" ]; then
    echo "ERROR: Extraction failed - directory not found"
    exit 1
fi

# Clean up tarball after successful extraction
rm "$OPENSSL_TARBALL"

cd "openssl-${OPENSSL_VERSION}"

# Clean previous builds
rm -rf build
mkdir -p build/x86_64 build/arm64 build/universal/lib build/universal/include

# Build for x86_64
echo ""
echo "Building OpenSSL for x86_64..."
./Configure darwin64-x86_64-cc \
    --prefix="$(pwd)/build/x86_64" \
    no-shared \
    no-tests \
    -mmacosx-version-min=10.15

make clean || true
make -j8
make install_sw

# Build for arm64
echo ""
echo "Building OpenSSL for arm64..."
make clean
./Configure darwin64-arm64-cc \
    --prefix="$(pwd)/build/arm64" \
    no-shared \
    no-tests \
    -mmacosx-version-min=11.0

make -j8
make install_sw

# Create universal binaries in lib/ subdirectory
echo ""
echo "Creating universal binaries..."
lipo -create \
    build/x86_64/lib/libssl.a \
    build/arm64/lib/libssl.a \
    -output build/universal/lib/libssl.a

lipo -create \
    build/x86_64/lib/libcrypto.a \
    build/arm64/lib/libcrypto.a \
    -output build/universal/lib/libcrypto.a

# Copy headers (they're the same for both architectures)
cp -r build/x86_64/include/* build/universal/include/

# Verify
echo ""
echo "Verifying universal binaries..."
lipo -info build/universal/lib/libssl.a
lipo -info build/universal/lib/libcrypto.a

echo ""
echo "OpenSSL build complete!"
echo "Root: $(pwd)/build/universal/"
echo "Libraries: $(pwd)/build/universal/lib/"
echo "  - libssl.a"
echo "  - libcrypto.a"
echo "Headers: $(pwd)/build/universal/include/"