#pragma once

#include "Components/ActorComponent.h"
#include "Components/AudioComponent.h"
#include "Sound/SoundWaveProcedural.h"

#include "AudioDevice.h"
#include "AudioCapture.h"

#include "Containers/Array.h"
#include "Templates/SharedPointer.h"
#include "HAL/Platform.h"

#include "PanaudiaTypes.h"

#include "PanaudiaAudioComponent.generated.h"

class FPanaudiaConnectionManager;

/**
 * Actor component that handles audio capture, WebRTC connection, and binaural playback
 * This component should be attached to the player pawn/character
 */
UCLASS(ClassGroup=(Audio), meta=(BlueprintSpawnableComponent))
class PANAUDIA_API UPanaudiaAudioComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPanaudiaAudioComponent();

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
    float PositionUpdateRate = 0.1f; // 10 Hz

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    bool bCaptureMicrophone = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    float InputVolume = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Panaudia")
    float OutputVolume = 1.0f;

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
    FOnNodeStateReceived OnRemoteStateReceived;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
    // Connection manager
    TSharedPtr<FPanaudiaConnectionManager> ConnectionManager;

    // Audio capture
    Audio::FAudioCapture AudioCapture;
    bool bIsCapturing;
    TArray<float> CaptureBuffer;

    // Audio playback
    UPROPERTY()
    USoundWaveProcedural* ProceduralSound;

    UPROPERTY()
    UAudioComponent* AudioComponent;

    // Timing
    float TimeSinceLastPositionUpdate;

    // Audio processing
    void StartAudioCapture();
    void StopAudioCapture();
    void OnAudioCapture(const float* AudioData, int32 NumFrames, int32 NumChannels, int32 SampleRate, double StreamTime, bool bOverflow);

    void SetupAudioPlayback();
    void ProcessIncomingAudio();

    // Position tracking
    void AutoUpdatePosition();

    // Connection callbacks
    void HandleConnectionStatusChanged(EPanaudiaConnectionStatus Status, const FString& Message);
    void HandleNodeStateReceived(const FPanaudiaNodeState& State);
    void HandleAttributesReceived(const FString& JsonData);
};