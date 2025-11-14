@echo off
setlocal

REM Build script for libdatachannel (Windows, x64 static)
REM Run this from Plugins\panaudia\Source\ThirdParty\

echo.
echo Building libdatachannel for Windows (x64)...

REM Directory where this script lives
cd /d "%~dp0"
set SCRIPT_DIR=%cd%

REM OpenSSL paths (custom build)
set OPENSSL_VERSION=1.1.1w
set OPENSSL_ROOT=%SCRIPT_DIR%\openssl-%OPENSSL_VERSION%\build\Win64
set OPENSSL_INCLUDE=%OPENSSL_ROOT%\include
set OPENSSL_CRYPTO_LIB=%OPENSSL_ROOT%\lib\libcrypto.lib
set OPENSSL_SSL_LIB=%OPENSSL_ROOT%\lib\libssl.lib

if not exist "%OPENSSL_ROOT%" (
    echo OpenSSL not found at:
    echo   %OPENSSL_ROOT%
    echo Please run build_libopenssl.bat first.
    exit /b 1
)

echo Using custom OpenSSL from:
echo   %OPENSSL_ROOT%

REM Clone if not exists
if not exist "libdatachannel" (
    echo.
    echo Cloning libdatachannel...
    git clone https://github.com/paullouisageneau/libdatachannel.git || goto :error
    cd libdatachannel
    echo Checking out tag v0.23.2...
    git checkout v0.23.2 || goto :error
    echo Initializing submodules...
    git submodule update --init --recursive --depth 1 || goto :error
) else (
    cd libdatachannel
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
cmake ..\.. ^
  -G "Visual Studio 17 2022" ^
  -A x64 ^
  -DCMAKE_BUILD_TYPE=Release ^
  -DBUILD_SHARED_LIBS=OFF ^
  -DUSE_GNUTLS=OFF ^
  -DUSE_NICE=OFF ^
  -DNO_WEBSOCKET=ON ^
  -DNO_EXAMPLES=ON ^
  -DNO_TESTS=ON ^
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON ^
  -DCMAKE_CXX_STANDARD=17 ^
  -DOPENSSL_ROOT_DIR="%OPENSSL_ROOT%" ^
  -DOPENSSL_INCLUDE_DIR="%OPENSSL_INCLUDE%" ^
  -DOPENSSL_CRYPTO_LIBRARY="%OPENSSL_CRYPTO_LIB%" ^
  -DOPENSSL_SSL_LIBRARY="%OPENSSL_SSL_LIB%" ^
  -DOPENSSL_USE_STATIC_LIBS=ON ^
  -DOPENSSL_FOUND=TRUE

if errorlevel 1 goto :error

echo.
echo Building libdatachannel (Release / x64)...

cmake --build . --config Release -- /m
if errorlevel 1 goto :error

echo.
echo Build complete!
echo Main library should be in:
echo   %cd%\Release\libdatachannel.lib

goto :EOF

:error
echo.
echo ERROR: Failed to build libdatachannel.
exit /b 1
