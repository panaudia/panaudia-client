
# Panaudia Unreal Plugin - Usage Guide

## Getting Started

### 1. Install the Plugin

Copy or symlink the `panaudia` directory into your project's `Plugins/` folder.

### 2. Build libpanaudia-core (first time only)

```bash
cd Plugins/panaudia/Source/ThirdParty
./build_panaudia_core.sh
```

### 3. Add to your project

In your `.uproject` file:
```json
{ "Name": "Panaudia", "Enabled": true }
```

In your `Build.cs`:
```csharp
PrivateDependencyModuleNames.Add("Panaudia");
```

### 4. Add the component

```cpp
#include "Panaudia.h"

// Header
UPROPERTY(VisibleAnywhere, Category = "Audio")
UPanaudiaAudioComponent* PanaudiaAudio;

// Constructor
PanaudiaAudio = CreateDefaultSubobject<UPanaudiaAudioComponent>(TEXT("PanaudiaAudio"));
```

### 5. Connect

```cpp
void AMyCharacter::ConnectToServer(const FString& ServerURL, const FString& Ticket)
{
    FPanaudiaConnectionConfig Config;
    Config.ServerURL = ServerURL;
    Config.Ticket = Ticket;
    PanaudiaAudio->bCaptureMicrophone = true;
    PanaudiaAudio->Connect(Config);
}
```

That's it. The component automatically captures the microphone, sends position updates, and plays binaural audio from the server.

## Connection Flow

The typical connection flow for a production deployment:

1. **Get a ticket** — your game backend creates and signs a JWT itself or calls the Panaudia ticket API to obtain a JWT for the player
2. **Resolve the server** — call the gateway API with the ticket to get a MOQ server URL
3. **Connect** — pass the URL and ticket to `PanaudiaAudioComponent::Connect()`

See the test project (`unreal_test`) for a working example of this flow using HTTP requests.

## Position and Coordinate System

The plugin converts between UE coordinates (cm, Z-up) and Panaudia coordinates (0-1 normalised range).

- `WorldExtent` (default 5000 cm) defines the half-width of the playable area
- UE origin `(0,0,0)` maps to Panaudia centre `(0.5, 0.5, 0.5)`
- Position updates are sent automatically at `PositionUpdateRate` (default 20 Hz)
- The component reads the owning actor's location and the controller's control rotation (where the player is looking)

To disable auto-updates and send position manually:
```cpp
PanaudiaAudio->bAutoUpdatePosition = false;
PanaudiaAudio->UpdatePosition(MyPosition, MyRotation);
```

## Audio Control

### Microphone

```cpp
// Toggle mic at runtime (e.g. push-to-talk)
PanaudiaAudio->SetMicrophoneEnabled(true);
PanaudiaAudio->SetMicrophoneEnabled(false);

// Adjust mic volume
PanaudiaAudio->InputVolume = 0.8f;
```

The plugin auto-selects the built-in microphone on macOS.

### Muting

```cpp
// Mute/unmute a specific remote participant by their node UUID
PanaudiaAudio->MuteNode(RemoteNodeId);
PanaudiaAudio->UnmuteNode(RemoteNodeId);
```

### Playback Volume

```cpp
PanaudiaAudio->OutputVolume = 1.5f;
```

## Connection Events

```cpp
// Bind in BeginPlay
PanaudiaAudio->OnConnectionStatusChanged.AddDynamic(
    this, &AMyCharacter::OnConnectionChanged);

void AMyCharacter::OnConnectionChanged(
    EPanaudiaConnectionStatus Status, const FString& Message)
{
    switch (Status)
    {
    case EPanaudiaConnectionStatus::DataConnected:
        UE_LOG(LogTemp, Log, TEXT("Connected: %s"), *Message);
        break;
    case EPanaudiaConnectionStatus::Error:
        UE_LOG(LogTemp, Error, TEXT("Error: %s"), *Message);
        break;
    default:
        break;
    }
}
```

## Jitter Buffer Tuning

```cpp
// Low latency (good network)
PanaudiaAudio->ConfigureJitterBuffer(10, 100, 30);

// High stability (poor network)
PanaudiaAudio->ConfigureJitterBuffer(30, 300, 120);

// Check current latency
float Latency = PanaudiaAudio->GetCurrentAudioLatency();
```

## Reconnection

Auto-reconnection is enabled by default with exponential backoff.

```cpp
// Disable for manual control
PanaudiaAudio->SetAutoReconnect(false);

// Adjust parameters
PanaudiaAudio->MaxReconnectAttempts = 20;
PanaudiaAudio->ReconnectBaseDelay = 1.0f;
```

## Remote Participant Visualisation

To see other participants in the world, add the companion **PanaudiaPresence** plugin. It automatically:

- Enables the state/attributes data tracks on the audio component
- Parses NodeInfo3 binary (position, rotation, volume, gone flag)
- Parses attributes JSON (name, colours)
- Spawns, moves, and destroys actors for remote participants

See the [PanaudiaPresence README](../panaudia-presence/README.md) for setup instructions.

## Disconnecting

```cpp
// Manual disconnect
PanaudiaAudio->Disconnect();
```

The component also disconnects automatically in `EndPlay`.

## Troubleshooting

### No audio output
- Check `IsConnected()` returns true
- Check `OutputVolume` is not zero
- Verify the server is running and the ticket is valid

### No audio input
- Check `bCaptureMicrophone` is true
- Check microphone permissions (System Preferences > Privacy > Microphone)
- Check `InputVolume` is not zero

### High latency
- Reduce jitter buffer: `ConfigureJitterBuffer(10, 100, 30)`

### Connection drops
- Enable auto-reconnect: `SetAutoReconnect(true)`
- Check server logs for disconnect reasons

### Position not updating
- Check `bAutoUpdatePosition` is true
- Ensure `WorldExtent` matches between client and other participants
