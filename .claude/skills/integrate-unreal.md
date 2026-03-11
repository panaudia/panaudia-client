Help the user integrate the Panaudia Unreal Engine plugin into their UE project. Use the information below and read the relevant source files to give accurate, up-to-date guidance.

## What this skill does

Walk the user through adding spatial audio to their Unreal Engine project using the Panaudia plugin. The plugin uses libpanaudia-core for MOQ/QUIC transport, Opus codec, and jitter buffering — all handled internally.

## Key files to consult

Before answering, read these files for the current API surface:

- `sdks/unreal/panaudia/Source/panaudia/Public/PanaudiaAudioComponent.h` — main component API
- `sdks/unreal/panaudia/Source/panaudia/Public/PanaudiaTypes.h` — types, delegates, config structs
- `sdks/unreal/panaudia/Source/panaudia/Private/PanaudiaAudioComponent.cpp` — implementation details if needed

For a working integration example, also read:
- The test project character at the path containing `unreal_testCharacter.cpp` (search for it)

## Integration steps to cover

1. **Add the plugin**: Copy the `panaudia` folder into the project's `Plugins/` directory. The plugin contains pre-built static libraries (libpanaudia-core, libopus, libmsquic) for the target platform.

2. **Enable the plugin**: Add to the project's `.uproject` file:
   ```json
   {
     "Name": "Panaudia",
     "Enabled": true
   }
   ```
   And add `"Panaudia"` to the module's `Build.cs` `PublicDependencyModuleNames`.

3. **Add the component**: Attach a `UPanaudiaAudioComponent` to the player pawn/character, either in C++ or via Blueprint in the editor.

4. **Authentication**: The user needs a JWT ticket string. The JWT must contain a `jti` field (node UUID). Don't help generate JWTs — that's server-side.

5. **Connect**:
   ```cpp
   FPanaudiaConnectionConfig Config;
   Config.ServerURL = TEXT("quic://your-server:4433");
   Config.Ticket = JwtToken;
   Config.InitialPosition = GetActorLocation();
   Config.InitialRotation = GetActorRotation();
   Config.bSkipCertValidation = true; // For dev only
   PanaudiaComp->Connect(Config);
   ```
   Or use `ConnectDirect(URL, Position, Rotation)` for simpler cases.

6. **Position updates**: By default, position updates automatically from the owning actor at 20Hz (`bAutoUpdatePosition = true`). To update manually:
   ```cpp
   PanaudiaComp->bAutoUpdatePosition = false;
   PanaudiaComp->UpdatePosition(NewPosition, NewRotation);
   ```

7. **Coordinate conversion**: The plugin converts between Unreal coordinates (Z-up, left-handed, centimetres) and Panaudia coordinates (0-1 range, Y-up) automatically. The `WorldExtent` property (default 5000 cm = 50m) controls the mapping — UE origin maps to Panaudia centre (0.5, 0.5, 0.5).

8. **Audio**: Microphone capture and spatial playback start automatically on connect. Control with:
   - `SetMicrophoneEnabled(bool)` — enable/disable mic
   - `InputVolume` / `OutputVolume` — volume properties (0-1)
   - `MuteNode(NodeId)` / `UnmuteNode(NodeId)` — mute/unmute remote participants

9. **Events/Delegates**: Bind to these delegates for state changes:
   ```cpp
   PanaudiaComp->OnConnectionStatusChanged.AddDynamic(this, &AMyActor::OnStatusChanged);
   PanaudiaComp->OnDataTrackReceived.AddDynamic(this, &AMyActor::OnDataReceived);
   ```
   Connection statuses: `Disconnected`, `Connecting`, `Connected`, `DataConnected`, `Error`.

10. **Presence tracks**: Set `bEnablePresenceTracks = true` to receive other participants' state and attributes via `OnDataTrackReceived`. By default this is off (audio-only mode).

11. **Jitter buffer tuning**: The adaptive jitter buffer works well by default. Tune if needed:
    ```cpp
    PanaudiaComp->bAdaptiveJitterBuffer = true;
    PanaudiaComp->MinJitterBufferMs = 20;
    PanaudiaComp->MaxJitterBufferMs = 200;
    PanaudiaComp->TargetJitterBufferMs = 60;
    ```
    Monitor with `GetCurrentAudioLatency()` and `GetJitterBufferPacketLoss()`.

12. **Reconnection**: Auto-reconnect is enabled by default with exponential backoff:
    ```cpp
    PanaudiaComp->bAutoReconnectEnabled = true;
    PanaudiaComp->MaxReconnectAttempts = 10;
    PanaudiaComp->ReconnectBaseDelay = 2.0f;
    ```

13. **Cleanup**: Call `Disconnect()` when done. EndPlay handles cleanup automatically if the component is destroyed.

## Architecture overview (for deeper questions)

- **libpanaudia-core**: Static C++ library handling QUIC transport (via msquic), MOQ protocol, Opus encode/decode, ring buffers, and jitter buffering. The plugin is a thin UE adapter around this core.
- **Audio render thread**: Reads from the core's lock-free jitter buffer via `UPanaudiaProceduralSound` — no game thread involvement for playback.
- **Mic capture thread**: Core Audio capture with stereo-to-mono downmix, writes to lock-free ring buffer.
- **Core session thread**: Drains ring buffers, Opus encodes/decodes, handles MOQ protocol and reconnection.
- **Data tracks**: State and control sent via `send_data()`, received via `DataRecvCallback` marshalled to game thread.

## Platform support

- **macOS**: Fully supported. Uses Core Audio for mic capture. Built-in mic auto-selected.
- **Windows**: Supported via msquic. Mic capture via platform audio APIs.
- **Linux**: Supported. PortAudio for mic capture.

## Building the ThirdParty libraries

If the user needs to rebuild libpanaudia-core from source:
```bash
cd sdks/unreal/panaudia/Source/ThirdParty && ./build_panaudia_core.sh
```
This produces `ThirdParty/panaudia-core/{include/, lib/Mac/}` with libpanaudia-core.a, libopus.a, and libmsquic.a (all static).

## Common issues to watch for

- **Self-signed certs**: Set `bSkipCertValidation = true` for local development. Never in production.
- **Mic permissions**: On macOS, the app needs microphone permission. UE editor usually has this already.
- **Lumen GI**: On macOS, Lumen Global Illumination can cause crashes. Disable in DefaultEngine.ini if needed.
- **JWT expiry**: Hardcoded JWT tokens expire. If connection fails after working previously, check token expiry.
- **Build cache**: If compile errors reference wrong library paths after Homebrew updates, run `go clean -cache` (for the Go server) or clean the UE build with `xcodebuild clean`.

## What NOT to help with

- Generating JWT tokens (server-side concern)
- Server deployment or configuration
- The Go spatial-mixer server internals
- The TypeScript client (separate skill)

$ARGUMENTS
