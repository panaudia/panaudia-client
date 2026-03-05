# Third Party Libraries

All transport, codec, and buffering dependencies are provided by **libpanaudia-core**.

## Building

```bash
./build_panaudia_core.sh
```

This clones (or updates) `libpanaudia-core` from GitHub, builds it, and copies the artifacts into `panaudia-core/`:

```
panaudia-core/
├── include/panaudia/*.h          (public headers)
└── lib/Mac/
    ├── libpanaudia-core.a        (static — MOQ/QUIC session, jitter buffer)
    ├── libopus.a                 (static — audio codec)
    └── libmsquic.a               (static — QUIC transport)
```

The UE plugin's `panaudia.Build.cs` links all three libraries from this directory.
