#!/bin/bash

# Build script for libopus with universal binary support
# Run this from Plugins/panaudia/Source/ThirdParty/

set -e

echo "Building libopus for Mac (Universal Binary)..."

# Clone if not exists
if [ ! -d "opus" ]; then
    git clone https://github.com/xiph/opus.git
    cd opus
    git checkout v1.5.2
else
    cd opus
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
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DOPUS_BUILD_SHARED_LIBRARY=OFF \
    -DOPUS_BUILD_TESTING=OFF \
    -DOPUS_BUILD_PROGRAMS=OFF \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=10.15

cmake --build . --config Release -j8

# Build for arm64
echo ""
echo "Building for arm64..."
cd ..
mkdir -p arm64
cd arm64

cmake ../../../ \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_ARCHITECTURES="arm64" \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DOPUS_BUILD_SHARED_LIBRARY=OFF \
    -DOPUS_BUILD_TESTING=OFF \
    -DOPUS_BUILD_PROGRAMS=OFF \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0

cmake --build . --config Release -j8

# Create universal binary
echo ""
echo "Creating universal binary..."
cd ../Release

lipo -create \
    ../x86_64/libopus.a \
    ../arm64/libopus.a \
    -output libopus.a

# Verify the universal binary
echo ""
echo "Verifying universal binary..."
lipo -info libopus.a

echo ""
echo "Build complete!"
echo "Library location: $(pwd)/libopus.a"

# Cleanup intermediate builds (optional)
# cd ..
# rm -rf x86_64 arm64