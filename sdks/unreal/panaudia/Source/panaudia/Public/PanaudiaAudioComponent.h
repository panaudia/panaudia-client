#pragma once

#include "Components/ActorComponent.h"
#include "PanaudiaTypes.h"

#include "PanaudiaAudioComponent.generated.h"

struct FPanaudiaAudioComponentPrivate;

/**
 * Actor component that handles audio capture, MOQ/QUIC connection, and binaural playback.
 * Uses libpanaudia-core for all transport, codec, and buffering.
 * This component should be attached to the player pawn/character.
 */
UCLASS(ClassGroup=(Audio), meta=(BlueprintSpawnableComponent))
class PANAUDIA_API UPanaudiaAudioComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPanaudiaAudioComponent();
    ~UPanaudiaAudioComponent();

    // Connection methods
    UFUNCTION(BlueprintCallable, Category = "Panaudia")
    void Connect(const FPanaudiaConnectionConfig& Config);

    UFUNCTION(BlueprintCallable, Category = "Panaudia")
    void ConnectDirect(const FString& DirectURL, FVector Position, FRotator Rotation);

    UFUNCTION(BlueprintCallable, Category = "Panaudia")
    void Disconnect();

    UFUNCTION(BlueprintPure, Category = "Panaudia")
    bool IsConnected() const;

    // Position updates (automatically called if bAutoUpdatePosition is true)
    UFUNCTION(BlueprintCallable, Category = "Panaudia")
    void UpdatePosition(FVector Position, FRotator Rotation);

    // Audio control
    UFUNCTION(BlueprintCallable, Category = "Panaudia")
    void MuteNode(const FString& NodeId);

    UFUNCTION(BlueprintCallable, Category = "Panaudia")
    void UnmuteNode(const FString& NodeId);

    UFUNCTION(BlueprintCallable, Category = "Panaudia")
    void SetMicrophoneEnabled(bool bEnabled);

    // Configuration
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    bool bAutoUpdatePosition = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    float PositionUpdateRate = 0.05f; // 20 Hz (matches TS client)

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    bool bCaptureMicrophone = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    float InputVolume = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    float OutputVolume = 1.0f;

    /** When true, subscribes to state_output and attributes_output tracks from the server.
     *  Set automatically by PanaudiaPresenceComponent; leave false if presence visualisation is not needed. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    bool bEnablePresenceTracks = false;

    // Half-width of the UE world in cm that maps to the Panaudia 0-1 range.
    // UE origin maps to Panaudia center (0.5, 0.5, 0.5).
    // Default 5000 cm = 50m per side = 100m total world size.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia", meta = (ClampMin = "100", ClampMax = "100000"))
    float WorldExtent = 5000.0f;

    // Jitter buffer settings
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|JitterBuffer")
    bool bAdaptiveJitterBuffer = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|JitterBuffer", meta = (ClampMin = "10", ClampMax = "50"))
    int32 MinJitterBufferMs = 20;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|JitterBuffer", meta = (ClampMin = "50", ClampMax = "500"))
    int32 MaxJitterBufferMs = 200;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|JitterBuffer", meta = (ClampMin = "20", ClampMax = "200"))
    int32 TargetJitterBufferMs = 60;

    // Auto-reconnection settings
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|Reconnection")
    bool bAutoReconnectEnabled = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|Reconnection", meta = (ClampMin = "0", ClampMax = "100"))
    int32 MaxReconnectAttempts = 10;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia|Reconnection", meta = (ClampMin = "0.5", ClampMax = "30.0"))
    float ReconnectBaseDelay = 2.0f;

    // Control methods for reconnection
    UFUNCTION(BlueprintCallable, Category = "Panaudia|Reconnection")
    void SetAutoReconnect(bool bEnabled);

    UFUNCTION(BlueprintPure, Category = "Panaudia|Reconnection")
    bool IsAutoReconnectEnabled() const;

    // Control methods for Jitter Buffer
    UFUNCTION(BlueprintCallable, Category = "Panaudia|JitterBuffer")
    void SetJitterBufferEnabled(bool bEnabled);

    UFUNCTION(BlueprintCallable, Category = "Panaudia|JitterBuffer")
    void ConfigureJitterBuffer(int32 MinMs, int32 MaxMs, int32 TargetMs);

    UFUNCTION(BlueprintPure, Category = "Panaudia|JitterBuffer")
    float GetCurrentAudioLatency() const;

    UFUNCTION(BlueprintPure, Category = "Panaudia|JitterBuffer")
    float GetJitterBufferPacketLoss() const;

    // Delegates
    UPROPERTY(BlueprintAssignable, Category = "Panaudia")
    FOnConnectionStatusChanged OnConnectionStatusChanged;

    UPROPERTY(BlueprintAssignable, Category = "Panaudia")
    FOnDataTrackReceived OnDataTrackReceived;

    // Opaque pimpl — keeps audio capture and core.h out of this header.
    // Struct defined in PanaudiaAudioComponent.cpp only.
    FPanaudiaAudioComponentPrivate* P;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
    // Audio playback (UObject pointers must be declared here for UPROPERTY)
    UPROPERTY()
    class UPanaudiaProceduralSound* ProceduralSound;

    UPROPERTY()
    class UAudioComponent* AudioComp;

    // Timing
    float TimeSinceLastPositionUpdate;

    // Node ID extracted from JWT (needed for state encoding)
    FString NodeId;

    // Audio processing
    void StartAudioCapture();
    void StopAudioCapture();
    void OnAudioCapture(const float* AudioData, int32 NumFrames, int32 NumChannels, int32 SampleRate, double StreamTime, bool bOverflow);

    void SetupAudioPlayback();

    // Core configuration
    void ConfigureCore(const FString& ServerURL, const FString& Ticket);

    // Position tracking
    void AutoUpdatePosition();
};
