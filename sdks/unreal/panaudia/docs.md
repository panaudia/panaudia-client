
# Panaudia Unreal Plugin - API Reference

## Table of Contents

- [Core Components](#core-components)
  - [UPanaudiaAudioComponent](#upanaudiaaudiocomponent)
- [Data Types](#data-types)
  - [EPanaudiaConnectionStatus](#epanaudiaconnectionstatus)
  - [FPanaudiaNodeState](#fpanaudianodestate)
  - [FPanaudiaConnectionConfig](#fpanaudiaconnectionconfig)
- [Module](#module)
  - [FPanaudiaModule](#fpanaudiamodule)
- [Event Delegates](#event-delegates)

---

## Core Components

### UPanaudiaAudioComponent

Actor component that handles audio capture, WebRTC connection, and binaural playback. This component should be attached to the player pawn/character.

#### Connection Methods

##### Connect
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia") void Connect(const FPanaudiaConnectionConfig& Config);
```


Establishes a connection to a Panaudia session using the provided configuration.

**Parameters:**
- `Config` - Connection configuration structure

##### ConnectDirect
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia") void ConnectDirect(const FString& DirectURL, FVector Position, FRotator Rotation);
```
 

Establishes a direct connection using a URL, bypassing the entrance service.

**Parameters:**
- `DirectURL` - Direct connection URL
- `Position` - Initial position in Unreal coordinates
- `Rotation` - Initial rotation in Unreal coordinates

##### Disconnect
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia") void Disconnect();
```


Terminates the current connection and stops all audio processing.

##### IsConnected
```cpp
UFUNCTION(BlueprintPure, Category = "Panaudia") bool IsConnected() const;
```
 

Checks whether the component is currently connected to a Panaudia session.

**Returns:** `true` if connected, `false` otherwise

#### Position Management

##### UpdatePosition
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia") void UpdatePosition(FVector Position, FRotator Rotation);
```


Manually updates the listener's position and rotation. Automatically called if `bAutoUpdatePosition` is enabled.

**Parameters:**
- `Position` - Position in Unreal coordinates
- `Rotation` - Rotation in Unreal coordinates

#### Audio Control Methods

##### MuteNode
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia") void MuteNode(const FString& NodeId);
```
 

Mutes audio from a specific remote node.

**Parameters:**
- `NodeId` - Identifier of the node to mute

##### UnmuteNode
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia") void UnmuteNode(const FString& NodeId);
```


Unmutes audio from a previously muted node.

**Parameters:**
- `NodeId` - Identifier of the node to unmute

##### SetMicrophoneEnabled
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia") void SetMicrophoneEnabled(bool bEnabled);
```
 

Enables or disables microphone capture.

**Parameters:**
- `bEnabled` - `true` to enable microphone, `false` to disable

#### Reconnection Control

##### SetAutoReconnect
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia|Reconnection") void SetAutoReconnect(bool bEnabled);
```


Enables or disables automatic reconnection on connection failure.

**Parameters:**
- `bEnabled` - `true` to enable auto-reconnect, `false` to disable

##### IsAutoReconnectEnabled
```cpp
UFUNCTION(BlueprintPure, Category = "Panaudia|Reconnection") bool IsAutoReconnectEnabled() const;
```
 

Checks whether automatic reconnection is enabled.

**Returns:** `true` if auto-reconnect is enabled, `false` otherwise

#### Jitter Buffer Control

##### SetJitterBufferEnabled
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia|JitterBuffer") void SetJitterBufferEnabled(bool bEnabled);
```


Enables or disables adaptive jitter buffering.

**Parameters:**
- `bEnabled` - `true` to enable adaptive jitter buffer, `false` to disable

##### ConfigureJitterBuffer
```cpp
UFUNCTION(BlueprintCallable, Category = "Panaudia|JitterBuffer") void ConfigureJitterBuffer(int32 MinMs, int32 MaxMs, int32 TargetMs);
```
 

Configures jitter buffer timing parameters.

**Parameters:**
- `MinMs` - Minimum buffer size in milliseconds (10-50)
- `MaxMs` - Maximum buffer size in milliseconds (50-500)
- `TargetMs` - Target buffer size in milliseconds (20-200)

##### GetCurrentAudioLatency
```cpp
UFUNCTION(BlueprintPure, Category = "Panaudia|JitterBuffer") float GetCurrentAudioLatency() const;
```


Returns the current audio latency in milliseconds.

**Returns:** Current latency value in milliseconds

##### GetJitterBufferPacketLoss
```cpp
UFUNCTION(BlueprintPure, Category = "Panaudia|JitterBuffer") float GetJitterBufferPacketLoss() const;
```
 

Returns the current packet loss percentage.

**Returns:** Packet loss as a percentage

#### Configuration Properties

##### bAutoUpdatePosition
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia") bool bAutoUpdatePosition = true;
```


Enables automatic position updates based on the owner actor's transform.

**Default:** `true`

##### PositionUpdateRate
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia") float PositionUpdateRate = 0.1f;
```
 

Rate at which position updates are sent, in seconds.

**Default:** `0.1` (10 Hz)

##### bCaptureMicrophone
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia") bool bCaptureMicrophone = true;
```


Enables or disables microphone capture.

**Default:** `true`

##### InputVolume
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia") float InputVolume = 1.0f;
```
 

Microphone input volume multiplier.

**Default:** `1.0`

##### OutputVolume
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia") float OutputVolume = 1.0f;
```


Audio output volume multiplier.

**Default:** `1.0`

##### bAdaptiveJitterBuffer
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|JitterBuffer") bool bAdaptiveJitterBuffer = true;
```
 

Enables adaptive jitter buffer adjustment.

**Default:** `true`

##### MinJitterBufferMs
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|JitterBuffer") int32 MinJitterBufferMs = 20;
```


Minimum jitter buffer size in milliseconds.

**Range:** 10-50  
**Default:** `20`

##### MaxJitterBufferMs
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|JitterBuffer") int32 MaxJitterBufferMs = 200;
```
 

Maximum jitter buffer size in milliseconds.

**Range:** 50-500  
**Default:** `200`

##### TargetJitterBufferMs
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|JitterBuffer") int32 TargetJitterBufferMs = 60;
```


Target jitter buffer size in milliseconds.

**Range:** 20-200  
**Default:** `60`

##### bAutoReconnectEnabled
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|Reconnection") bool bAutoReconnectEnabled = true;
```
 

Enables automatic reconnection on connection failure.

**Default:** `true`

##### MaxReconnectAttempts
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|Reconnection") int32 MaxReconnectAttempts = 10;
```


Maximum number of reconnection attempts.

**Range:** 0-100  
**Default:** `10`

##### ReconnectBaseDelay
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|Reconnection") float ReconnectBaseDelay = 2.0f;
```
 

Base delay between reconnection attempts in seconds.

**Range:** 0.5-30.0  
**Default:** `2.0`

#### Event Delegates

##### OnConnectionStatusChanged
```cpp
UPROPERTY(BlueprintAssignable, Category = "Panaudia") FOnConnectionStatusChanged OnConnectionStatusChanged;
```


Fired when the connection status changes.

**Delegate Type:** `FOnConnectionStatusChanged`

**Parameters:**
- `Status` - New connection status
- `Message` - Status message or error description

##### OnRemoteStateReceived
```cpp
UPROPERTY(BlueprintAssignable, Category = "Panaudia") FOnNodeStateReceived OnRemoteStateReceived;
```
 

Fired when a remote node's state (position/rotation) is received.

**Delegate Type:** `FOnNodeStateReceived`

**Parameters:**
- `State` - Remote node's position and rotation state

---

## Data Types

### EPanaudiaConnectionStatus
```cpp
UENUM(BlueprintType) enum class EPanaudiaConnectionStatus : uint8
```

Connection status enumeration.

**Values:**
- `Disconnected` - Not connected to any session
- `Connecting` - Connection in progress
- `Connected` - WebRTC connection established
- `DataConnected` - Data channel active
- `Error` - Connection error occurred

### FPanaudiaNodeState
```cpp
USTRUCT(BlueprintType) struct FPanaudiaNodeState
``` 

Represents the position and rotation of a node in 3D space.

#### Properties

##### X
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") float X = 0.0f;
```


X coordinate position.

##### Y
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") float Y = 0.0f;
```
 

Y coordinate position.

##### Z
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") float Z = 0.0f;
```


Z coordinate position.

##### Yaw
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") float Yaw = 0.0f;
```
 

Yaw rotation component.

##### Pitch
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") float Pitch = 0.0f;
```


Pitch rotation component.

##### Roll
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") float Roll = 0.0f;
```
 

Roll rotation component.

#### Static Methods

##### FromUnrealCoordinates
```cpp
static FPanaudiaNodeState FromUnrealCoordinates(const FVector& Position, const FRotator& Rotation);
```


Converts from Unreal coordinates (Z-up, left-handed) to Panaudia coordinates.

**Parameters:**
- `Position` - Position in Unreal coordinate system
- `Rotation` - Rotation in Unreal coordinate system

**Returns:** Node state in Panaudia coordinate system

##### FromDataBuffer
```cpp
static FPanaudiaNodeState FromDataBuffer(const uint8* Data, int32 Size);
```
 

Deserializes a node state from a binary data buffer.

**Parameters:**
- `Data` - Pointer to binary data
- `Size` - Size of data buffer

**Returns:** Deserialized node state

#### Instance Methods

##### GetUnrealPosition
```cpp
FVector GetUnrealPosition() const;
```


Converts the node state position to Unreal coordinate system.

**Returns:** Position as `FVector`

##### GetUnrealRotation
```cpp
FRotator GetUnrealRotation() const;
```
 

Converts the node state rotation to Unreal coordinate system.

**Returns:** Rotation as `FRotator`

##### ToDataBuffer
```cpp
TArrayToDataBuffer() const;
```


Serializes the node state to a binary buffer for WebRTC data channel transmission.

**Returns:** Binary data array

### FPanaudiaConnectionConfig
```cpp
USTRUCT(BlueprintType) struct FPanaudiaConnectionConfig
``` 

Configuration structure for establishing a Panaudia connection.

#### Properties

##### Ticket
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") FString Ticket;
```


Session ticket obtained from the Panaudia entrance service.

##### bEnableDataChannel
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") bool bEnableDataChannel = true;
```
 

Enables the WebRTC data channel for position/state updates.

**Default:** `true`

##### InitialPosition
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") FVector InitialPosition = FVector::ZeroVector;
```


Initial position in Unreal coordinates.

**Default:** `(0, 0, 0)`

##### InitialRotation
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") FRotator InitialRotation = FRotator::ZeroRotator;
```
 

Initial rotation in Unreal coordinates.

**Default:** `(0, 0, 0)`

##### CustomAttributes
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") TMap<FString, FString> CustomAttributes;
```


Custom key-value attributes to associate with this connection.

##### EntranceURL
```cpp
UPROPERTY(BlueprintReadWrite, Category = "Panaudia") FString EntranceURL = TEXT("https://panaudia.com/entrance");
```
 

URL of the Panaudia entrance service.

**Default:** `"https://panaudia.com/entrance"`

---

## Module

### FPanaudiaModule
```cpp
class FPanaudiaModule : public IModuleInterface
```

Main module class implementing the Panaudia plugin interface.

#### Public Methods

##### StartupModule
```cpp
virtual void StartupModule() override;
```
 

Called when the module is loaded. Handles initialization and library loading.

##### ShutdownModule
```cpp
virtual void ShutdownModule() override;
```


Called when the module is unloaded. Handles cleanup and library unloading.

---

## Event Delegates

### Blueprint Delegates

#### FOnConnectionStatusChanged
```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnConnectionStatusChanged, EPanaudiaConnectionStatus, Status, const FString&, Message);
```
 

Blueprint-compatible dynamic multicast delegate for connection status changes.

**Parameters:**
- `Status` - New connection status
- `Message` - Status message or error description

#### FOnNodeStateReceived
```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnNodeStateReceived, const FPanaudiaNodeState&, State);
```


Blueprint-compatible dynamic multicast delegate for receiving remote node states.

**Parameters:**
- `State` - Remote node's position and rotation state

#### FOnAttributesReceived
```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAttributesReceived, const FString&, JsonData);
```
 

Blueprint-compatible dynamic delegate for receiving custom attributes as JSON.

**Parameters:**
- `JsonData` - JSON-encoded attributes string

### Native C++ Delegates

#### FOnConnectionStatusChangedNative
```cpp
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnConnectionStatusChangedNative, EPanaudiaConnectionStatus, const FString&);
```


Native C++ multicast delegate for connection status changes. Supports lambda functions.

#### FOnNodeStateReceivedNative
```cpp
DECLARE_MULTICAST_DELEGATE_OneParam(FOnNodeStateReceivedNative, const FPanaudiaNodeState&);
```
 

Native C++ multicast delegate for receiving remote node states. Supports lambda functions.

#### FOnAttributesReceivedNative
```cpp
DECLARE_MULTICAST_DELEGATE_OneParam(FOnAttributesReceivedNative, const FAttributesMap&);
```


Native C++ multicast delegate for receiving custom attributes from remote nodes. Supports lambda functions.

**Type Definition:**
```cpp
typedef TMap<FString, FString> FAttributesMap;
```
 

---

## Header Files

The complete public API is available through these header files:

- `Panaudia.h` - Main header that includes all other public headers
- `PanaudiaAudioComponent.h` - Audio component class
- `PanaudiaTypes.h` - Data types and structures
- `PanaudiaModule.h` - Module interface

To use the plugin in your code, simply include:
```cpp
#include "Panaudia.h"