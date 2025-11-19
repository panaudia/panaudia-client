
#pragma once

#include "Containers/Array.h"
#include "Containers/Map.h"
#include "Containers/UnrealString.h"
#include "Math/Vector.h"
#include "Math/Rotator.h"
#include "Math/UnrealMathUtility.h"
#include "UObject/ObjectMacros.h"
#include "Delegates/Delegate.h"
#include "Delegates/DelegateCombinations.h"

#include "PanaudiaTypes.generated.h"

UENUM(BlueprintType)
enum class EPanaudiaConnectionStatus : uint8
{
    Disconnected UMETA(DisplayName = "Disconnected"),
    Connecting UMETA(DisplayName = "Connecting"),
    Connected UMETA(DisplayName = "Connected"),
    DataConnected UMETA(DisplayName = "Data Connected"),
    Error UMETA(DisplayName = "Error")
};

USTRUCT(BlueprintType)
struct FPanaudiaNodeState
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    float X = 0.0f;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    float Y = 0.0f;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    float Z = 0.0f;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    float Yaw = 0.0f;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    float Pitch = 0.0f;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    float Roll = 0.0f;

    // Convert from Unreal coordinates (Z-up, left-handed) to Panaudia coordinates
    static FPanaudiaNodeState FromUnrealCoordinates(const FVector& Position, const FRotator& Rotation);

    // Convert to Unreal coordinates
    FVector GetUnrealPosition() const;
    FRotator GetUnrealRotation() const;

    // Serialize to binary buffer for WebRTC data channel (matches JavaScript implementation)
    TArray<uint8> ToDataBuffer() const;
    static FPanaudiaNodeState FromDataBuffer(const uint8* Data, int32 Size);
};

USTRUCT(BlueprintType)
struct FPanaudiaConnectionConfig
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    FString Ticket;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    bool bEnableDataChannel = false;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    FVector InitialPosition = FVector::ZeroVector;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    FRotator InitialRotation = FRotator::ZeroRotator;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    TMap<FString, FString> CustomAttributes;

    UPROPERTY(BlueprintReadWrite, Category = "Panaudia")
    //FString EntranceURL = TEXT("https://panaudia.com/entrance");
    FString EntranceURL = TEXT("http://localhost:8000/gateway");
};

// Typedef to avoid comma issues with macros
typedef TMap<FString, FString> FAttributesMap;

// C++ delegates (support lambdas) - used internally by FPanaudiaConnectionManager
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnConnectionStatusChangedNative, EPanaudiaConnectionStatus, const FString&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnNodeStateReceivedNative, const FPanaudiaNodeState&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnAttributesReceivedNative, const FAttributesMap&);

// Blueprint-compatible dynamic delegates - used by UPanaudiaAudioComponent
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnConnectionStatusChanged, EPanaudiaConnectionStatus, Status, const FString&, Message);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnNodeStateReceived, const FPanaudiaNodeState&, State);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAttributesReceived, const FString&, JsonData);
