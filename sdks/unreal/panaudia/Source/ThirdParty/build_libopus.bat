@echo off
setlocal

REM Build script for libopus (Windows, x64 static)
REM Run this from Plugins\panaudia\Source\ThirdParty\

echo.
echo Building libopus for Windows (x64)...

REM Go to the folder where this script resides
cd /d "%~dp0"

REM Clone if not exists
if not exist "opus" (
    echo Cloning opus...
    git clone https://github.com/xiph/opus.git || goto :error
    cd opus
    echo Checking out tag v1.5.2...
    git checkout v1.5.2 || goto :error
) else (
    cd opus
)

REM Clean previous Windows builds (keep Mac builds separate)
if exist "build\Win64" (
    echo Removing previous Win64 build...
    rmdir /s /q "build\Win64"
)

mkdir "build\Win64"
mkdir "build\Win64\Release"

echo.
echo Configuring CMake for Win64 / Release...

cd "build\Win64"

REM NOTE: Run this script from a "x64 Native Tools Command Prompt" for VS
REM Adjust generator if you use a different VS version
cmake ..\.. ^
  -G "Visual Studio 17 2022" ^
  -A x64 ^
  -DCMAKE_BUILD_TYPE=Release ^
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON ^
  -DOPUS_BUILD_SHARED_LIBRARY=OFF ^
  -DOPUS_BUILD_TESTING=OFF ^
  -DOPUS_BUILD_PROGRAMS=OFF

if errorlevel 1 goto :error

echo.
echo Building libopus (Release / x64)...

cmake --build . --config Release -- /m
if errorlevel 1 goto :error

echo.
echo Build complete!
echo Library should be in:
echo   %cd%\Release\opus.lib

goto :EOF

:error
echo.
echo ERROR: Failed to build libopus.
exit /b 1
