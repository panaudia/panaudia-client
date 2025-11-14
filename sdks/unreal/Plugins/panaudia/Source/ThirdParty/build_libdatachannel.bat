@echo off
setlocal enabledelayedexpansion

REM Advanced build script for libdatachannel on Windows
REM Supports multiple Visual Studio versions

echo ====================================
echo libdatachannel Windows Build Script
echo ====================================
echo.

REM ===== Configuration =====
set LIBDC_VERSION=v0.20.1
set BUILD_TYPE=Release
set BUILD_DIR=build\Win64\Release

REM ===== Check Prerequisites =====
echo [1/6] Checking prerequisites...
echo.

REM Check Git
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/
    goto :error
)
echo   [OK] Git found

REM Check CMake
where cmake >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] CMake is not installed or not in PATH
    echo Please install CMake from https://cmake.org/
    goto :error
)
echo   [OK] CMake found

REM Detect Visual Studio
set VS_GENERATOR=
set VS_VERSION=

if exist "C:\Program Files\Microsoft Visual Studio\2022" (
    set VS_GENERATOR=Visual Studio 17 2022
    set VS_VERSION=2022
    echo   [OK] Visual Studio 2022 found
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019" (
    set VS_GENERATOR=Visual Studio 16 2019
    set VS_VERSION=2019
    echo   [OK] Visual Studio 2019 found
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2017" (
    set VS_GENERATOR=Visual Studio 15 2017
    set VS_VERSION=2017
    echo   [OK] Visual Studio 2017 found
) else (
    echo [ERROR] No compatible Visual Studio installation found
    echo Please install Visual Studio 2017 or later
    goto :error
)

echo.
echo Using: !VS_GENERATOR!
echo.

REM ===== Clone Repository =====
echo [2/6] Cloning repository...
echo.

if not exist "libdatachannel" (
    echo Cloning libdatachannel from GitHub...
    git clone https://github.com/paullouisageneau/libdatachannel.git
    if !ERRORLEVEL! NEQ 0 goto :error

    cd libdatachannel
    echo Checking out version %LIBDC_VERSION%...
    git checkout %LIBDC_VERSION%
    if !ERRORLEVEL! NEQ 0 (
        echo [WARNING] Could not checkout %LIBDC_VERSION%, using master
    )
    cd ..
) else (
    echo Repository already exists, skipping clone
)

cd libdatachannel

REM ===== Update Submodules =====
echo.
echo [3/6] Updating submodules...
echo.

git submodule update --init --recursive
if !ERRORLEVEL! NEQ 0 (
    echo [WARNING] Submodule update had issues, continuing...
)

REM ===== Configure =====
echo.
echo [4/6] Configuring with CMake...
echo.

if not exist "%BUILD_DIR%" mkdir %BUILD_DIR%
cd %BUILD_DIR%

cmake ..\..\.. ^
    -G "!VS_GENERATOR!" ^
    -A x64 ^
    -DCMAKE_BUILD_TYPE=%BUILD_TYPE% ^
    -DUSE_GNUTLS=OFF ^
    -DUSE_NICE=OFF ^
    -DNO_WEBSOCKET=ON ^
    -DNO_EXAMPLES=ON ^
    -DNO_TESTS=ON ^
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON ^
    -DCMAKE_MSVC_RUNTIME_LIBRARY="MultiThreaded"

if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] CMake configuration failed
    goto :error
)

REM ===== Build =====
echo.
echo [5/6] Building (this may take several minutes)...
echo.

cmake --build . --config %BUILD_TYPE% --parallel

if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Build failed
    goto :error
)

REM ===== Verify =====
echo.
echo [6/6] Verifying build...
echo.

if exist "%BUILD_TYPE%\datachannel.lib" (
    echo [OK] Static library built successfully
    set LIB_PATH=%CD%\%BUILD_TYPE%\datachannel.lib
) else (
    echo [ERROR] Library file not found
    goto :error
)

if exist "..\..\..\include\rtc\rtc.hpp" (
    echo [OK] Header files found
) else (
    echo [WARNING] Header files may be missing
)

REM ===== Success =====
echo.
echo ====================================
echo BUILD SUCCESSFUL!
echo ====================================
echo.
echo Library: !LIB_PATH!
echo Headers: %CD%\..\..\..\include
echo.
echo Next steps:
echo 1. Build libopus using build_libopus.bat
echo 2. Regenerate Unreal project files
echo 3. Build your Unreal project
echo.

cd ..\..\..
pause
exit /b 0

REM ===== Error Handler =====
:error
echo.
echo ====================================
echo BUILD FAILED!
echo ====================================
echo.
echo Troubleshooting:
echo - Ensure Visual Studio C++ tools are installed
echo - Try running as Administrator
echo - Check your internet connection for Git clone
echo - Ensure enough disk space (^~2GB needed)
echo.
echo For more help, see:
echo https://github.com/paullouisageneau/libdatachannel
echo.
pause
exit /b 1