
# Panaudia Unreal Plugin

Spatial audio plugin for Unreal Engine providing real-time voice communication with binaural 3D audio over MOQ/QUIC.

## Overview

Panaudia enables developers to add spatial audio to Unreal Engine projects. The plugin handles:

- **Real-time Audio** - Low-latency voice using MOQ (Media over QUIC) transport
- **Binaural 3D Audio** - Server-side spatial rendering based on player position and orientation
- **Automatic Position Tracking** - Synchronises listener position with the owning actor
- **Adaptive Jitter Buffer** - Dynamic audio buffering for varying network conditions
- **Auto-Reconnection** - Reliable connection management with exponential backoff

All transport, codec, and buffering logic lives in **libpanaudia-core**, a shared C++ library. The plugin is a thin UE adapter around it.

## Architecture

```
UPanaudiaAudioComponent
    |
    +-- libpanaudia-core (static lib)
    |       MOQ protocol, QUIC transport (msquic), Opus codec, jitter buffer
    |
    +-- UE Audio Capture (microphone input)
    +-- UPanaudiaProceduralSound (binaural playback)
```

### Tracks

The plugin configures up to six MOQ tracks per connection:

| Track | Direction | Purpose |
|-------|-----------|---------|
| `audio_output` | Inbound | Server's binaural stereo mix |
| `audio_input` | Outbound | Microphone capture (mono Opus) |
| `state_input` | Outbound | Local position/rotation (NodeInfo3 binary) |
| `control_input` | Outbound | Mute/unmute commands (JSON) |
| `state_output` | Inbound | Remote participant positions (optional) |
| `attributes_output` | Inbound | Remote participant metadata (optional) |

The last two tracks are only subscribed when `bEnablePresenceTracks` is true (set automatically by the companion **PanaudiaPresence** plugin).

## Quick Start

### C++

```cpp
// Header
UPROPERTY(VisibleAnywhere, Category = "Audio")
UPanaudiaAudioComponent* PanaudiaAudio;

// Constructor
PanaudiaAudio = CreateDefaultSubobject<UPanaudiaAudioComponent>(TEXT("PanaudiaAudio"));

// BeginPlay — after obtaining a JWT ticket from your backend
FPanaudiaConnectionConfig Config;
Config.ServerURL = TEXT("quic://your-server:4433");
Config.Ticket = Ticket;
PanaudiaAudio->bCaptureMicrophone = true;
PanaudiaAudio->Connect(Config);
```

Position updates are sent automatically at 20 Hz. The component reads the owning actor's location and control rotation.

## Configuration

### Audio

| Property | Default | Description |
|----------|---------|-------------|
| `bCaptureMicrophone` | true | Enable microphone input |
| `InputVolume` | 1.0 | Mic volume multiplier |
| `OutputVolume` | 1.0 | Playback volume multiplier |

### Position

| Property | Default | Description |
|----------|---------|-------------|
| `bAutoUpdatePosition` | true | Auto-send position from owning actor |
| `PositionUpdateRate` | 0.05s | Update interval (20 Hz) |
| `WorldExtent` | 5000 cm | Half-width of UE world mapping to Panaudia 0-1 range |

### Jitter Buffer

| Property | Default | Description |
|----------|---------|-------------|
| `bAdaptiveJitterBuffer` | true | Enable adaptive sizing |
| `MinJitterBufferMs` | 20 | Minimum buffer (ms) |
| `MaxJitterBufferMs` | 200 | Maximum buffer (ms) |
| `TargetJitterBufferMs` | 60 | Initial target (ms) |

### Reconnection

| Property | Default | Description |
|----------|---------|-------------|
| `bAutoReconnectEnabled` | true | Auto-reconnect on failure |
| `MaxReconnectAttempts` | 10 | Max retries |
| `ReconnectBaseDelay` | 2.0s | Base delay (exponential backoff) |

### Presence

| Property | Default | Description |
|----------|---------|-------------|
| `bEnablePresenceTracks` | false | Subscribe to state/attributes output tracks. Set automatically by PanaudiaPresence. |

## API

### Methods

| Method | Description |
|--------|-------------|
| `Connect(Config)` | Connect to a Panaudia server |
| `Disconnect()` | Disconnect and stop audio |
| `IsConnected()` | Check connection state |
| `UpdatePosition(Position, Rotation)` | Manual position update |
| `MuteNode(NodeId)` | Mute a remote participant |
| `UnmuteNode(NodeId)` | Unmute a remote participant |
| `SetMicrophoneEnabled(bEnabled)` | Toggle mic capture |
| `ConfigureJitterBuffer(Min, Max, Target)` | Runtime jitter buffer tuning |
| `GetCurrentAudioLatency()` | Current buffer latency in ms |

### Delegates

| Delegate | Parameters | Description |
|----------|------------|-------------|
| `OnConnectionStatusChanged` | `EPanaudiaConnectionStatus, FString Message` | Connection state changes |
| `OnDataTrackReceived` | `FString TrackName, TArray<uint8> Data` | Raw inbound data track bytes |

`OnDataTrackReceived` fires for `state_output` and `attributes_output` tracks. The **PanaudiaPresence** plugin binds to this delegate to parse and visualise remote participants.

### Connection Config

```cpp
USTRUCT(BlueprintType)
struct FPanaudiaConnectionConfig
{
    FString ServerURL;          // e.g. "quic://server:4433"
    FString Ticket;             // JWT session ticket
    FVector InitialPosition;
    FRotator InitialRotation;
    bool bSkipCertValidation;   // Skip TLS cert check (dev only)
};
```

## Building Third-Party Libraries

```bash
cd Source/ThirdParty
./build_panaudia_core.sh              # Fetch from GitHub and build
./build_panaudia_core.sh local        # Build from local sibling repo
```

This produces `panaudia-core/lib/Mac/` containing three static libraries:
- `libpanaudia-core.a` — MOQ/QUIC session, jitter buffer, ring buffers
- `libopus.a` — Opus audio codec
- `libmsquic.a` — QUIC transport

## Requirements

- **Unreal Engine** 5.4+ (tested with 5.6)
- **macOS** arm64 (Apple Silicon)
- **Xcode** Command Line Tools, CMake (for building ThirdParty)

## Log Category

All plugin log output uses `LogPanaudia`. Filter with:
```
Log LogPanaudia Verbose
```

## Companion Plugin

**[PanaudiaPresence](../panaudia-presence/)** — optional plugin that parses the raw state/attributes data tracks and spawns/moves/destroys actors for remote participants. When present, it automatically enables the presence tracks on the audio component.

## License

Copyright Paul Harter / Panaudia

## Links

- Website: https://panaudia.com
