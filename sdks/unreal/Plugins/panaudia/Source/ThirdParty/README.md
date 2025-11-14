# Third Party Libraries

This directory contains build scripts for external dependencies.

## Building Libraries

### libdatachannel

```bash
# macOS/Linux
./build_libdatachannel.sh

# Windows
build_libdatachannel.bat
```

### libopus``` bash
# macOS/Linux
./build_libopus.sh

# Windows
build_libopus.bat
```


ThirdParty/
├── libdatachannel/
│   ├── include/
│   └── build/
│       ├── Mac/Release/libdatachannel.a
│       ├── Win64/Release/datachannel.lib
│       └── Linux/Release/libdatachannel.a
└── opus/
    ├── include/
    └── build/
        ├── Mac/Release/libopus.a
        ├── Win64/Release/Release/opus.lib
        └── Linux/Release/libopus.a
