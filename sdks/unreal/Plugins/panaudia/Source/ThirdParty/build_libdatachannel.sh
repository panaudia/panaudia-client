#!/bin/bash

set -e

echo "Building libdatachannel for Mac (Universal Binary)..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# OpenSSL paths (our custom build)
OPENSSL_VERSION="1.1.1w"
OPENSSL_ROOT="$SCRIPT_DIR/openssl-${OPENSSL_VERSION}/build/universal"
OPENSSL_INCLUDE="$OPENSSL_ROOT/include"
OPENSSL_CRYPTO_LIB="$OPENSSL_ROOT/lib/libcrypto.a"
OPENSSL_SSL_LIB="$OPENSSL_ROOT/lib/libssl.a"

if [ ! -d "$OPENSSL_ROOT" ]; then
    echo "OpenSSL not found at $OPENSSL_ROOT"
    echo "Please run ./build_openssl.sh first"
    exit 1
fi

echo "Using custom OpenSSL from: $OPENSSL_ROOT"

# Clone if not exists
if [ ! -d "libdatachannel" ]; then
    git clone https://github.com/paullouisageneau/libdatachannel.git
    cd libdatachannel
    git checkout v0.23.2
    git submodule update --init --recursive --depth 1
else
    cd libdatachannel
fi

# Clean previous builds
rm -rf build/Mac
mkdir -p build/Mac/Release

# Build for x86_64
echo ""
echo "Building for x86_64..."
mkdir -p build/Mac/x86_64
cd build/Mac/x86_64

cmake ../../../ \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_ARCHITECTURES="x86_64" \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=10.15 \
    -DBUILD_SHARED_LIBS=OFF \
    -DUSE_GNUTLS=OFF \
    -DUSE_NICE=OFF \
    -DNO_WEBSOCKET=ON \
    -DNO_EXAMPLES=ON \
    -DNO_TESTS=ON \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DCMAKE_CXX_STANDARD=17 \
    -DOPENSSL_ROOT_DIR="$OPENSSL_ROOT" \
    -DOPENSSL_INCLUDE_DIR="$OPENSSL_INCLUDE" \
    -DOPENSSL_CRYPTO_LIBRARY="$OPENSSL_CRYPTO_LIB" \
    -DOPENSSL_SSL_LIBRARY="$OPENSSL_SSL_LIB" \
    -DOPENSSL_USE_STATIC_LIBS=ON \
    -DOPENSSL_FOUND=TRUE

cmake --build . --config Release -j8

# Build for arm64
echo ""
echo "Building for arm64..."
cd ../
mkdir -p arm64
cd arm64

cmake ../../../ \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_ARCHITECTURES="arm64" \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 \
    -DBUILD_SHARED_LIBS=OFF \
    -DUSE_GNUTLS=OFF \
    -DUSE_NICE=OFF \
    -DNO_WEBSOCKET=ON \
    -DNO_EXAMPLES=ON \
    -DNO_TESTS=ON \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DCMAKE_CXX_STANDARD=17 \
    -DOPENSSL_ROOT_DIR="$OPENSSL_ROOT" \
    -DOPENSSL_INCLUDE_DIR="$OPENSSL_INCLUDE" \
    -DOPENSSL_CRYPTO_LIBRARY="$OPENSSL_CRYPTO_LIB" \
    -DOPENSSL_SSL_LIBRARY="$OPENSSL_SSL_LIB" \
    -DOPENSSL_USE_STATIC_LIBS=ON \
    -DOPENSSL_FOUND=TRUE

cmake --build . --config Release -j8

# Create universal binaries for each library
echo ""
echo "Creating universal binaries..."
cd ../Release

# Main datachannel library
lipo -create \
    ../x86_64/libdatachannel.a \
    ../arm64/libdatachannel.a \
    -output libdatachannel.a

# usrsctp library
lipo -create \
    ../x86_64/deps/usrsctp/usrsctplib/libusrsctp.a \
    ../arm64/deps/usrsctp/usrsctplib/libusrsctp.a \
    -output libusrsctp.a

# libjuice library
lipo -create \
    ../x86_64/deps/libjuice/libjuice.a \
    ../arm64/deps/libjuice/libjuice.a \
    -output libjuice.a

# libsrtp2 library (needed for media support)
lipo -create \
    ../x86_64/deps/libsrtp/libsrtp2.a \
    ../arm64/deps/libsrtp/libsrtp2.a \
    -output libsrtp2.a

# Verify
echo ""
echo "Verifying universal binaries..."
echo "libdatachannel.a:"
lipo -info libdatachannel.a
echo ""
echo "libusrsctp.a:"
lipo -info libusrsctp.a
echo ""
echo "libjuice.a:"
lipo -info libjuice.a
echo ""
echo "libsrtp2.a:"
lipo -info libsrtp2.a

echo ""
echo "Checking symbols..."
echo "DataChannel class symbols:"
nm libdatachannel.a | c++filt | grep "DataChannel::" | head -10

echo ""
echo "Build complete!"
echo "Library location: $(pwd)/"
echo "Libraries created:"
echo "  - libdatachannel.a"
echo "  - libusrsctp.a"
echo "  - libjuice.a"
echo "  - libsrtp2.a"