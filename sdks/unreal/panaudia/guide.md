
# Panaudia Unreal Plugin - Usage Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Setup](#basic-setup)
- [Blueprint Usage](#blueprint-usage)
- [C++ Usage](#c-usage)
- [Advanced Features](#advanced-features)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Quick Start Example

The simplest way to add spatial audio to your project:

1. **Add the component to your player character**
   - Open your player character Blueprint
   - Add a `PanaudiaAudioComponent` to your character
   - The component will automatically capture audio and update position

2. **Connect to a session**
   - In your character's BeginPlay, call `Connect` with a session ticket
   - The component handles everything else automatically

**Blueprint Example:**

In your player character's BeginPlay event:
- Make `FPanaudiaConnectionConfig` struct
  - Set `Ticket` to your session ticket
  - Set `Initial Position` to Get Actor Location
  - Set `Initial Rotation` to Get Actor Rotation
- Call `Connect` on PanaudiaAudioComponent with the config

That's it! You now have spatial audio with automatic position tracking.

---

## Basic Setup

### Adding the Component in Blueprint

1. Open your player character or pawn Blueprint
2. In the Components panel, click "Add Component"
3. Search for "Panaudia Audio Component"
4. Add it to your actor

### Configuring the Component

The component has several properties you can configure in the Details panel:

**Audio Settings:**
- `Capture Microphone` - Enable/disable microphone input (default: true)
- `Input Volume` - Microphone volume multiplier (default: 1.0)
- `Output Volume` - Playback volume multiplier (default: 1.0)

**Position Tracking:**
- `Auto Update Position` - Automatically send position updates (default: true)
- `Position Update Rate` - How often to send updates in seconds (default: 0.1)

**Jitter Buffer:**
- `Adaptive Jitter Buffer` - Enable adaptive buffering (default: true)
- `Min Jitter Buffer Ms` - Minimum buffer size (default: 20ms)
- `Max Jitter Buffer Ms` - Maximum buffer size (default: 200ms)
- `Target Jitter Buffer Ms` - Target buffer size (default: 60ms)

**Reconnection:**
- `Auto Reconnect Enabled` - Automatically reconnect on failure (default: true)
- `Max Reconnect Attempts` - Maximum retry attempts (default: 10)
- `Reconnect Base Delay` - Base delay between retries (default: 2.0s)

---

## Blueprint Usage

### Connecting to a Session

#### Using a Session Ticket

In Blueprint, on BeginPlay:
1. Create a `Make FPanaudiaConnectionConfig` node
2. Set the `Ticket` pin to your session ticket string
3. Set `bEnableDataChannel` to true
4. Set `Initial Position` and `Initial Rotation` from your actor
5. Set `Entrance URL` to `"https://panaudia.com/entrance"` (or leave default)
6. Connect the output to the `Connect` function on your PanaudiaAudioComponent

#### Using a Direct URL

In Blueprint, on BeginPlay:
1. Get your actor's location and rotation
2. Call `ConnectDirect` on your PanaudiaAudioComponent
3. Provide the direct WebSocket URL, position, and rotation

### Handling Connection Events

Bind to the `OnConnectionStatusChanged` event on the PanaudiaAudioComponent:
1. Add an event binding for `OnConnectionStatusChanged`
2. Use a Branch node to check if Status equals `Connected`
3. On success, display "Connected to Panaudia!"
4. On failure, check if Status equals `Error` and display the error Message

### Receiving Remote Node Updates

Bind to the `OnRemoteStateReceived` event:
1. Add an event binding for `OnRemoteStateReceived`
2. Call `Get Unreal Position` on the State parameter
3. Call `Get Unreal Rotation` on the State parameter
4. Use these values to update visual representations of remote users

### Muting/Unmuting Nodes

To mute a specific user, call `Mute Node` on your PanaudiaAudioComponent with their Node ID.

To unmute a specific user, call `Unmute Node` on your PanaudiaAudioComponent with their Node ID.

### Disconnecting

In your EndPlay event, call `Disconnect` on your PanaudiaAudioComponent to properly clean up the connection.

---

## C++ Usage

### Adding the Component in C++

**MyCharacter.h:**
```cpp 

#include "Panaudia.h"

UCLASS() class MYGAME_API AMyCharacter : public ACharacter { 

GENERATED_BODY()
public: 
    AMyCharacter();
protected: 
    virtual void BeginPlay() override;
    
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Audio")
    UPanaudiaAudioComponent* PanaudiaAudio;
};
```

**MyCharacter.cpp:**
```cpp
#include "MyCharacter.h"
AMyCharacter::AMyCharacter() { 

// Create and attach the Panaudia audio component PanaudiaAudio = CreateDefaultSubobject(TEXT("PanaudiaAudio")); }
void AMyCharacter::BeginPlay() { 
    Super::BeginPlay();
    // Configure connection
    FPanaudiaConnectionConfig Config;
    Config.Ticket = TEXT("your-session-ticket");
    Config.bEnableDataChannel = true;
    Config.InitialPosition = GetActorLocation();
    Config.InitialRotation = GetActorRotation();
    
    // Connect
    PanaudiaAudio->Connect(Config);
}
``` 

### Binding to Events in C++
```cpp 
void AMyCharacter::BeginPlay() { Super::BeginPlay();
    // Bind to connection status changes
    PanaudiaAudio->OnConnectionStatusChanged.AddDynamic(this, &AMyCharacter::HandleConnectionStatus);

    // Bind to remote state updates
    PanaudiaAudio->OnRemoteStateReceived.AddDynamic(this, &AMyCharacter::HandleRemoteState);
}

void AMyCharacter::HandleConnectionStatus(EPanaudiaConnectionStatus Status, const FString& Message) { switch (Status) { case EPanaudiaConnectionStatus::Connected: UE_LOG(LogTemp, Log, TEXT("Connected to Panaudia")); break; case EPanaudiaConnectionStatus::Error: UE_LOG(LogTemp, Error, TEXT("Connection error: %s"), *Message); break; default: break; } }
void AMyCharacter::HandleRemoteState(const FPanaudiaNodeState& State) { FVector Position = State.GetUnrealPosition(); FRotator Rotation = State.GetUnrealRotation();

// Do something with the remote node's position and rotation
UE_LOG(LogTemp, Log, TEXT("Remote node at: %s"), *Position.ToString());
}
```

### Using Native C++ Delegates

For lambda functions and more flexible binding, use the native delegates:
```cpp 
// Lambda binding example with native delegates 

PanaudiaAudio->GetConnectionManager()->OnConnectionStatusChangedNative.AddLambda( [this](EPanaudiaConnectionStatus Status, const FString& Message) { if (Status == EPanaudiaConnectionStatus::Connected) { // Handle connection } } );
``` 

---

## Advanced Features

### Custom Attributes

Send custom metadata with your connection:
```cpp 

FPanaudiaConnectionConfig Config; Config.Ticket = TEXT("your-ticket");

// Add custom attributes Config.CustomAttributes.Add(TEXT("username"), TEXT("Player1")); 
Config.CustomAttributes.Add(TEXT("team"), TEXT("blue")); 
Config.CustomAttributes.Add(TEXT("level"), TEXT("5"));
PanaudiaAudio->Connect(Config);
```

### Manual Position Updates

If you need custom position logic, disable auto-updates:
```cpp
// Disable automatic position updates 
PanaudiaAudio->bAutoUpdatePosition = false;

// Manually update position when needed 
void AMyCharacter::UpdateAudioPosition() { 
    FVector CustomPosition = CalculateCustomPosition(); 
    FRotator CustomRotation = CalculateCustomRotation();
    PanaudiaAudio->UpdatePosition(CustomPosition, CustomRotation);
}
``` 

### Configuring Jitter Buffer at Runtime
```cpp

// Configure jitter buffer dynamically void AMyCharacter::OptimizeForLowLatency() { PanaudiaAudio->ConfigureJitterBuffer; }
void AMyCharacter::OptimizeForStability() { PanaudiaAudio->ConfigureJitterBuffer; }
// Check current latency float CurrentLatency = PanaudiaAudio->GetCurrentAudioLatency(); float PacketLoss = PanaudiaAudio->GetJitterBufferPacketLoss();
UE_LOG(LogTemp, Log, TEXT("Latency: %.1fms, Packet Loss: %.2f%%"), CurrentLatency, PacketLoss);
```

### Controlling Auto-Reconnection
```cpp
// Disable auto-reconnect for manual control PanaudiaAudio->SetAutoReconnect(false);
// Check if auto-reconnect is enabled if (PanaudiaAudio->IsAutoReconnectEnabled()) { // Auto-reconnect is active }
// Configure reconnection parameters PanaudiaAudio->MaxReconnectAttempts = 5; PanaudiaAudio->ReconnectBaseDelay = 1.0f;
``` 

### Microphone Control
```cpp
// Implement push-to-talk void AMyCharacter::StartTalking() { PanaudiaAudio->SetMicrophoneEnabled(true); }
void AMyCharacter::StopTalking() { PanaudiaAudio->SetMicrophoneEnabled(false); }
// Adjust microphone volume PanaudiaAudio->InputVolume = 0.8f; // 80% volume
// Adjust output volume PanaudiaAudio->OutputVolume = 1.2f; // 120% volume
```

---

## Common Patterns

### Multiplayer Game Lobby
```cpp
void AMyPlayerController::JoinLobby(const FString& LobbyId) { // Get session ticket from your backend FString Ticket = RequestTicketFromBackend(LobbyId);
// Configure connection
FPanaudiaConnectionConfig Config;
Config.Ticket = Ticket;
Config.CustomAttributes.Add(TEXT("lobby"), LobbyId);
Config.CustomAttributes.Add(TEXT("username"), PlayerName);

// Connect
if (UPanaudiaAudioComponent* Audio = GetPawn()->FindComponentByClass<UPanaudiaAudioComponent>())
{
    Audio->Connect(Config);
}
}
``` 

### VR Application
```cpp
void AVRCharacter::BeginPlay() { Super::BeginPlay();
// Create audio component
PanaudiaAudio = CreateDefaultSubobject<UPanaudiaAudioComponent>(TEXT("PanaudiaAudio"));

// Configure for VR - faster position updates
PanaudiaAudio->bAutoUpdatePosition = true;
PanaudiaAudio->PositionUpdateRate = 0.05f;  // 20 Hz for VR

// Lower latency for VR
PanaudiaAudio->ConfigureJitterBuffer(10, 100, 30);
}
```

### Proximity-Based Muting
```cpp
void AMyCharacter::Tick(float DeltaTime) { Super::Tick(DeltaTime);
// Mute players beyond a certain distance
const float MaxAudioDistance = 5000.0f;

for (const auto& RemotePlayer : RemotePlayers)
{
    float Distance = FVector::Dist(GetActorLocation(), RemotePlayer.Position);
    
    if (Distance > MaxAudioDistance)
    {
        PanaudiaAudio->MuteNode(RemotePlayer.NodeId);
    }
    else
    {
        PanaudiaAudio->UnmuteNode(RemotePlayer.NodeId);
    }
}
}
``` 

### Network Quality Monitoring
```cpp
void AMyCharacter::MonitorAudioQuality() { // Check every second GetWorldTimerManager().SetTimer(QualityCheckTimer, this { float Latency = PanaudiaAudio->GetCurrentAudioLatency(); float PacketLoss = PanaudiaAudio->GetJitterBufferPacketLoss();
// Adjust quality based on conditions
if (PacketLoss > 5.0f)
{
// High packet loss - increase buffer
PanaudiaAudio->ConfigureJitterBuffer(30, 300, 120);
ShowNetworkWarning(TEXT("Poor network quality"));
}
else if (Latency < 50.0f && PacketLoss < 1.0f)
{
// Good connection - optimize for low latency
PanaudiaAudio->ConfigureJitterBuffer(10, 100, 40);
}
}, 1.0f, true);
}
```

### Push-to-Talk System
```cpp
void AMyCharacter::SetupInputComponent() { Super::SetupInputComponent();
InputComponent->BindAction("Talk", IE_Pressed, this, &AMyCharacter::StartTalking);
InputComponent->BindAction("Talk", IE_Released, this, &AMyCharacter::StopTalking);
}
void AMyCharacter::BeginPlay() { Super::BeginPlay();
// Start with microphone disabled for push-to-talk
PanaudiaAudio->SetMicrophoneEnabled(false);
}
void AMyCharacter::StartTalking() { PanaudiaAudio->SetMicrophoneEnabled(true); ShowTalkingIndicator(true); }
void AMyCharacter::StopTalking() { PanaudiaAudio->SetMicrophoneEnabled(false); ShowTalkingIndicator(false); }
``` 

---

## Troubleshooting

### No Audio Output

**Check:**
1. Is the component connected? Use `IsConnected()`
2. Check output volume: `PanaudiaAudio->OutputVolume`
3. Verify connection status via `OnConnectionStatusChanged` event
4. Ensure DataChannel is enabled: `Config.bEnableDataChannel = true`

### No Audio Input

**Check:**
1. Microphone capture enabled: `PanaudiaAudio->bCaptureMicrophone = true`
2. Microphone permissions granted on the platform
3. Input volume: `PanaudiaAudio->InputVolume`
4. Use `SetMicrophoneEnabled(true)` if implementing push-to-talk

### High Latency

**Solutions:**
```cpp
// Reduce jitter buffer size PanaudiaAudio->ConfigureJitterBuffer(10, 100, 30);
// Increase position update rate (if needed) PanaudiaAudio->PositionUpdateRate = 0.05f; // 20 Hz
```

### Choppy Audio

**Solutions:**
```cpp
// Increase jitter buffer size PanaudiaAudio->ConfigureJitterBuffer(30, 300, 100);
// Enable adaptive jitter buffer PanaudiaAudio->bAdaptiveJitterBuffer = true;
// Monitor packet loss float PacketLoss = PanaudiaAudio->GetJitterBufferPacketLoss(); if (PacketLoss > 5.0f) { // Network issues detected }
``` 

### Connection Drops

**Solutions:**
```cpp
// Enable auto-reconnect PanaudiaAudio->SetAutoReconnect(true);
// Increase reconnection attempts PanaudiaAudio->MaxReconnectAttempts = 20;
// Monitor connection status void HandleConnectionStatus(EPanaudiaConnectionStatus Status, const FString& Message) { if (Status == EPanaudiaConnectionStatus::Error) { UE_LOG(LogTemp, Error, TEXT("Connection error: %s"), *Message); // Implement fallback logic } }
```

### Position Not Updating

**Check:**
1. Auto-update enabled: `PanaudiaAudio->bAutoUpdatePosition = true`
2. Component attached to moving actor
3. Data channel enabled: `Config.bEnableDataChannel = true`
4. Position update rate: `PanaudiaAudio->PositionUpdateRate` (default 0.1s)

### Memory or Performance Issues

**Optimize:**
```cpp
// Reduce position update frequency PanaudiaAudio->PositionUpdateRate = 0.2f; // 5 Hz instead of 10 Hz
// Disable adaptive jitter buffer if not needed PanaudiaAudio->bAdaptiveJitterBuffer = false;
// Disconnect when not needed void AMyCharacter::OnLeaveLobby() { PanaudiaAudio->Disconnect(); }
``` 

---

## Best Practices

1. **Always disconnect properly** - Call `Disconnect()` in `EndPlay` or when leaving a session
2. **Monitor connection status** - Bind to `OnConnectionStatusChanged` to handle errors gracefully
3. **Adjust for your use case** - VR needs faster updates, turn-based games can use slower rates
4. **Test network conditions** - Test with various latencies and packet loss scenarios
5. **Implement fallbacks** - Have UI feedback when audio quality degrades
6. **Use auto-reconnect** - Enable it for better user experience in unstable networks
7. **Profile audio performance** - Monitor `GetCurrentAudioLatency()` and `GetJitterBufferPacketLoss()`
8. **Respect privacy** - Clearly indicate when microphone is active
```
