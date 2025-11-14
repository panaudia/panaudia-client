@echo off
setlocal

REM Build script for OpenSSL 1.1.1w (Windows, x64 static)
REM Run this from Plugins\panaudia\Source\ThirdParty\

echo.
echo Building OpenSSL 1.1.1 for Windows (x64)...

cd /d "%~dp0"

set OPENSSL_VERSION=1.1.1w
set OPENSSL_DIR=openssl-%OPENSSL_VERSION%
set OPENSSL_BUILD_ROOT=%OPENSSL_DIR%\build\Win64

REM If source folder doesn't exist, download and extract it
if not exist "%OPENSSL_DIR%" (
    echo OpenSSL source directory "%OPENSSL_DIR%" not found.
    echo Attempting to download and extract...

    set OPENSSL_TARBALL=openssl-%OPENSSL_VERSION%.tar.gz
    set OPENSSL_URL=https://www.openssl.org/source/openssl-%OPENSSL_VERSION%.tar.gz

    if exist "%OPENSSL_TARBALL%" (
        echo Removing existing tarball...
        del /f /q "%OPENSSL_TARBALL%"
    )

    powershell -Command "try { Invoke-WebRequest -Uri '%OPENSSL_URL%' -OutFile '%OPENSSL_TARBALL%' -UseBasicParsing } catch { exit 1 }"
    if errorlevel 1 (
        echo ERROR: Failed to download OpenSSL tarball.
        exit /b 1
    )

    echo Extracting OpenSSL source (requires tar)...
    powershell -Command "tar -xzf '%OPENSSL_TARBALL%'"
    if errorlevel 1 (
        echo ERROR: Failed to extract OpenSSL tarball.
        exit /b 1
    )

    del /f /q "%OPENSSL_TARBALL%"
)

if not exist "%OPENSSL_DIR%" (
    echo ERROR: OpenSSL source directory not found after download/extract.
    exit /b 1
)

cd "%OPENSSL_DIR%"

REM Clean previous Win64 build
if exist "%OPENSSL_BUILD_ROOT%" (
    echo Removing previous Win64 build...
    rmdir /s /q "%OPENSSL_BUILD_ROOT%"
)

mkdir "%OPENSSL_BUILD_ROOT%"

echo.
echo Configuring OpenSSL for VC-WIN64A (static, no tests)...

REM NOTE: Run this script from a "x64 Native Tools Command Prompt" so cl/nmake are available.
where perl >nul 2>&1
if errorlevel 1 (
    echo ERROR: perl not found in PATH. Please install Strawberry Perl or similar.
    exit /b 1
)

perl Configure VC-WIN64A no-shared no-tests --prefix="%CD%\build\Win64"
if errorlevel 1 goto :error

echo.
echo Building OpenSSL (this may take a while)...

nmake clean >nul 2>&1
nmake
if errorlevel 1 goto :error

echo.
echo Installing OpenSSL into build\Win64 ...

nmake install_sw
if errorlevel 1 goto :error

echo.
echo OpenSSL build complete!
echo Root:     %CD%\build\Win64
echo Libraries: %CD%\build\Win64\lib
echo Includes: %CD%\build\Win64\include

goto :EOF

:error
echo.
echo ERROR: Failed to build OpenSSL.
exit /b 1
