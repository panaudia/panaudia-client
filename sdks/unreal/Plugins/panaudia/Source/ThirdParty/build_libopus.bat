@echo off
REM Build script for libopus on Windows

echo Building libopus for Windows...

REM Clone if not exists
if not exist "opus" (
    git clone https://github.com/xiph/opus.git
    cd opus
    git checkout v1.4
) else (
    cd opus
    git pull
)

REM Create build directory
if not exist "build\Win64\Release" mkdir build\Win64\Release
cd build\Win64\Release

REM Configure with CMake
cmake ..\..\.. ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON ^
    -DOPUS_BUILD_SHARED_LIBRARY=OFF ^
    -DOPUS_BUILD_TESTING=OFF ^
    -DOPUS_BUILD_PROGRAMS=OFF

REM Build
cmake --build . --config Release

echo Build complete!
echo Library location: %cd%\Release\opus.lib

pause