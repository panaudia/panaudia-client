
# PanaudiaPresence Plugin

Companion plugin for **Panaudia** that visualises remote participants in the Unreal Engine world. It receives raw data track messages from the Panaudia audio component and handles all participant lifecycle: spawning, positioning, and cleanup.

## Overview

The Panaudia audio plugin handles transport and audio. It deliberately knows nothing about participant semantics — that's game logic. PanaudiaPresence bridges the gap:

- Parses **NodeInfo3** binary state messages (UUID, position, rotation, volume, gone flag)
- Parses **attributes** JSON (name, colours, subspaces)
- Waits for both state and attributes before spawning (no half-initialised actors)
- Smooth interpolation of participant movement
- Destroys actors when participants leave (gone flag)
- Fires delegates for game code to react to joins, leaves, and state changes

## Setup

### 1. Add the plugin

Copy or symlink `panaudia-presence` into your project's `Plugins/` folder.

In your `.uproject`:
```json
{ "Name": "PanaudiaPresence", "Enabled": true }
```

In your `Build.cs`:
```csharp
PrivateDependencyModuleNames.Add("PanaudiaPresence");
```

### 2. Add the component

Place `UPanaudiaPresenceComponent` on the same actor as `UPanaudiaAudioComponent`:

```cpp
#include "PanaudiaPresenceComponent.h"

// Header
UPROPERTY(VisibleAnywhere, Category = "Panaudia")
UPanaudiaPresenceComponent* PanaudiaPresence;

// Constructor
PanaudiaPresence = CreateDefaultSubobject<UPanaudiaPresenceComponent>(TEXT("PanaudiaPresence"));
```

That's it. In BeginPlay the presence component automatically:
1. Finds the `UPanaudiaAudioComponent` on the same actor
2. Sets `bEnablePresenceTracks = true` so the audio component subscribes to state/attributes tracks
3. Binds to `OnDataTrackReceived` for incoming data

## Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `RemotePlayerClass` | nullptr | Actor class to spawn per participant. If null, uses SpawnParticipantDelegate or a default sphere. |
| `LocalNodeUuid` | "" | UUID of the local player — state from this UUID is ignored (no self-spawn). |
| `WorldExtent` | 5000.0 | Half-width of UE world in cm. Must match the audio component's value. |
| `bAutoFindAudioComponent` | true | Auto-discover audio component on the same actor. |
| `bEnableSmoothing` | true | Smooth interpolation of participant positions between updates. |
| `InterpolationSpeed` | 20.0 | Smoothing factor — each frame moves 1/N of remaining distance. |

## Customising Spawn Behaviour

### Spawn Delegate

Bind `SpawnParticipantDelegate` to control what actor is created:

```cpp
PanaudiaPresence->SpawnParticipantDelegate.BindLambda(
    [this](const FParticipantSpawnInfo& Info) -> AActor*
    {
        // Info.Uuid, Info.Location, Info.Rotation, Info.Attributes
        // Info.Attributes.DisplayName, .Colour, .OuterColour, .bWithMask

        AActor* Actor = GetWorld()->SpawnActor<AActor>(...);
        // Set up meshes, materials, etc.
        return Actor;
    });
```

### Update Delegate

Bind `UpdateParticipantDelegate` to override how actors are positioned (e.g. to add a vertical offset):

```cpp
PanaudiaPresence->UpdateParticipantDelegate.BindLambda(
    [](AActor* Actor, const FVector& Location, const FRotator& Rotation)
    {
        Actor->SetActorLocationAndRotation(Location + FVector(0, 0, 80), Rotation);
    });
```

## Delegates

| Delegate | Parameters | Description |
|----------|------------|-------------|
| `OnParticipantJoined` | `FString NodeUuid, AActor* Actor` | A new participant was spawned |
| `OnParticipantLeft` | `FString NodeUuid` | A participant's actor was destroyed |
| `OnParticipantStateChanged` | `FString NodeUuid, FVector Location, FRotator Rotation, float Volume` | Position/volume update for an existing participant |

All delegates fire on the game thread.

## API

| Method | Description |
|--------|-------------|
| `GetParticipantCount()` | Number of currently tracked participants |
| `GetParticipantActor(NodeUuid)` | Actor for a specific UUID, or nullptr |

## Data Formats

### NodeInfo3 Binary (48 bytes)

| Bytes | Type | Field |
|-------|------|-------|
| 0-15 | 16 raw bytes | UUID |
| 16-27 | 3x float32 LE | Position X, Y, Z (Panaudia 0-1 range) |
| 28-39 | 3x float32 LE | Rotation Yaw, Pitch, Roll (degrees) |
| 40-43 | float32 LE | Volume |
| 44-47 | int32 LE | Gone flag (non-zero = participant left) |

### Attributes JSON

```json
{
  "uuid": "550e8400-e29b-41d4-...",
  "name": "Player1",
  "ticket": { "colour": "2f56ee", "outer_colour": "00bbff", "mask": "face" },
  "connection": { "colour": "ff0000" },
  "subspaces": ["uuid1", "uuid2"]
}
```

Colours are parsed from either the `connection` or `ticket` sub-object (connection takes priority). If a `mask` field is present, `bWithMask` is set to true.

## Log Category

All plugin output uses `LogPanaudiaPresence`.

## Dependencies

- **Panaudia** plugin (required)
- UE modules: Core, CoreUObject, Engine, Json, JsonUtilities

## License

Copyright Paul Harter / Panaudia
