@echo off
setlocal

REM Build all third-party libraries for Windows (x64)
REM Run this from Plugins\panaudia\Source\panaudia\ThirdParty\

echo.
echo Building third-party libraries for Windows (x64)...

cd /d "%~dp0"

REM ==========================
REM OpenSSL (libssl / libcrypto)
REM ==========================
set OPENSSL_SSL=openssl-1.1.1w\build\Win64\lib\libssl.lib

if not exist "%OPENSSL_SSL%" (
    echo.
    echo Building OpenSSL (libssl / libcrypto)...
    call build_libopenssl.bat
    if errorlevel 1 goto :error
) else (
    echo.
    echo ✓ OpenSSL already built:
    echo   %OPENSSL_SSL%
)

REM ==========================
REM libdatachannel
REM ==========================
set LIBDATACHANNEL_LIB=libdatachannel\build\Win64\Release\libdatachannel.lib

if not exist "%LIBDATACHANNEL_LIB%" (
    echo.
    echo Building libdatachannel...
    call build_libdatachannel.bat
    if errorlevel 1 goto :error
) else (
    echo.
    echo ✓ libdatachannel already built:
    echo   %LIBDATACHANNEL_LIB%
)

REM ==========================
REM libopus
REM ==========================
set OPUS_LIB=opus\build\Win64\Release\opus.lib

if not exist "%OPUS_LIB%" (
    echo.
    echo Building libopus...
    call build_libopus.bat
    if errorlevel 1 goto :error
) else (
    echo.
    echo ✓ libopus already built:
    echo   %OPUS_LIB%
)

echo.
echo All third-party libraries built successfully for Windows.
goto :EOF

:error
echo.
echo ERROR: Failed to build one or more third-party libraries.
exit /b 1
