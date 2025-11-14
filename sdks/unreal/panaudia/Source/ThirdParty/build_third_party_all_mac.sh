#!/bin/bash

echo ""
echo "Building third-party libraries..."

if [ ! -f "openssl-1.1.1w/build/Universal/lib/libssl.a" ]; then
    echo "  Building libssl..."
    ./build_libopenssl.sh
else
    echo "  ✓ libssl already built"
fi

if [ ! -f "libdatachannel/build/Mac/Release/libdatachannel.a" ]; then
    echo "  Building libdatachannel..."
    ./build_libdatachannel.sh
else
    echo "  ✓ libdatachannel already built"
fi

if [ ! -f "opus/build/Mac/Release/libopus.a" ]; then
    echo "  Building libopus..."
    ./build_libopus.sh
else
    echo "  ✓ libopus already built"
fi