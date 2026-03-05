
# Panaudia Unreal Plugin - API Reference

## UPanaudiaAudioComponent

Actor component that handles audio capture, MOQ/QUIC connection, and binaural playback via libpanaudia-core. Attach to the player pawn or character.

### Connection Methods

#### Connect
```cpp
void Connect(const FPanaudiaConnectionConfig& Config);
```
Connects to a Panaudia MOQ server. Configures libpanaudia-core tracks, starts the QUIC session, begins audio playback, and optionally starts microphone capture.

#### ConnectDirect
```cpp
void ConnectDirect(const FString& DirectURL, FVector Position, FRotator Rotation);
```
Convenience wrapper that builds a config and calls `Connect()`.

#### Disconnect
```cpp
void Disconnect();
```
Stops mic capture, audio playback, and disconnects from the server.

#### IsConnected
```cpp
bool IsConnected() const;
```
Returns `true` if the core session is in the `Connected` state.

### Position

#### UpdatePosition
```cpp
void UpdatePosition(FVector Position, FRotator Rotation);
```
Sends a NodeInfo3 binary message (48 bytes) on the `state_input` track. Called automatically when `bAutoUpdatePosition` is true.

### Audio Control

#### MuteNode / UnmuteNode
```cpp
void MuteNode(const FString& NodeId);
void UnmuteNode(const FString& NodeId);
```
Sends a JSON control message on the `control_input` track to mute or unmute a specific remote participant.

#### SetMicrophoneEnabled
```cpp
void SetMicrophoneEnabled(bool bEnabled);
```
Enables or disables microphone capture at runtime. Useful for push-to-talk.

### Jitter Buffer

#### ConfigureJitterBuffer
```cpp
void ConfigureJitterBuffer(int32 MinMs, int32 MaxMs, int32 TargetMs);
```
Adjusts jitter buffer bounds. Takes effect on the next connection.

#### SetJitterBufferEnabled
```cpp
void SetJitterBufferEnabled(bool bEnabled);
```
Enables or disables adaptive jitter buffer sizing.

#### GetCurrentAudioLatency
```cpp
float GetCurrentAudioLatency() const;
```
Returns current audio buffer latency in milliseconds.

#### GetJitterBufferPacketLoss
```cpp
float GetJitterBufferPacketLoss() const;
```
Returns current packet loss percentage (placeholder, returns 0.0 currently).

### Reconnection

#### SetAutoReconnect
```cpp
void SetAutoReconnect(bool bEnabled);
```

#### IsAutoReconnectEnabled
```cpp
bool IsAutoReconnectEnabled() const;
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `bAutoUpdatePosition` | bool | true | Auto-send position from owning actor |
| `PositionUpdateRate` | float | 0.05 | Position send interval in seconds |
| `bCaptureMicrophone` | bool | true | Enable microphone capture on connect |
| `InputVolume` | float | 1.0 | Mic volume multiplier |
| `OutputVolume` | float | 1.0 | Playback volume multiplier |
| `WorldExtent` | float | 5000.0 | Half-width of world in cm (Panaudia 0-1 mapping) |
| `bEnablePresenceTracks` | bool | false | Subscribe to state/attributes output tracks |
| `bAdaptiveJitterBuffer` | bool | true | Adaptive jitter buffer sizing |
| `MinJitterBufferMs` | int32 | 20 | Min jitter buffer (ms) |
| `MaxJitterBufferMs` | int32 | 200 | Max jitter buffer (ms) |
| `TargetJitterBufferMs` | int32 | 60 | Initial target jitter buffer (ms) |
| `bAutoReconnectEnabled` | bool | true | Auto-reconnect on failure |
| `MaxReconnectAttempts` | int32 | 10 | Max reconnect retries |
| `ReconnectBaseDelay` | float | 2.0 | Base delay for exponential backoff (s) |

### Delegates

#### OnConnectionStatusChanged
```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnConnectionStatusChanged,
    EPanaudiaConnectionStatus, Status,
    const FString&, Message);
```
Fired on the game thread when connection state changes.

#### OnDataTrackReceived
```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnDataTrackReceived,
    const FString&, TrackName,
    const TArray<uint8>&, Data);
```
Fired on the game thread when data arrives on `state_output` or `attributes_output` tracks. `TrackName` is either `"state_output"` or `"attributes_output"`. `Data` contains the raw bytes.

---

## Data Types

### EPanaudiaConnectionStatus
```cpp
enum class EPanaudiaConnectionStatus : uint8
{
    Disconnected,
    Connecting,
    Connected,
    DataConnected,
    Error
};
```

### FPanaudiaConnectionConfig
```cpp
struct FPanaudiaConnectionConfig
{
    FString ServerURL;              // MOQ server URL, e.g. "quic://server:4433"
    FString Ticket;                 // JWT session ticket
    FVector InitialPosition;        // Starting position (UE coordinates)
    FRotator InitialRotation;       // Starting rotation (UE coordinates)
    bool bSkipCertValidation;       // Skip TLS cert check (development only)
};
```

### FPanaudiaNodeState
```cpp
struct FPanaudiaNodeState
{
    float X, Y, Z;                  // Position in Panaudia 0-1 range
    float Yaw, Pitch, Roll;         // Rotation in degrees

    static FPanaudiaNodeState FromUnrealCoordinates(
        const FVector& Position, const FRotator& Rotation, float WorldExtent);
};
```
Used internally for building the NodeInfo3 binary sent on the state_input track.

---

## Module

### Log Category
```cpp
DECLARE_LOG_CATEGORY_EXTERN(LogPanaudia, Log, All);
```
All plugin output uses `LogPanaudia`.

### Header Files

| Header | Contents |
|--------|----------|
| `Panaudia.h` | Convenience header — includes all public headers |
| `PanaudiaAudioComponent.h` | Main component class |
| `PanaudiaTypes.h` | Enums, structs, delegate declarations |
| `PanaudiaModule.h` | Module interface and log category |
