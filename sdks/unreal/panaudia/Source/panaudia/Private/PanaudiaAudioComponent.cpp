
#include "PanaudiaAudioComponent.h"

#include "CoreMinimal.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/Controller.h"
#include "Components/AudioComponent.h"
#include "Sound/SoundWaveProcedural.h"
#include "AudioDevice.h"
#include "AudioCapture.h"
#include "DSP/BufferVectorOperations.h"
#include "PanaudiaConnectionManager.h"
#include "PanaudiaProceduralSound.h"

UPanaudiaAudioComponent::UPanaudiaAudioComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;

    bAutoUpdatePosition = true;
    PositionUpdateRate = 0.1f;
    bCaptureMicrophone = true;
    InputVolume = 1.0f;
    OutputVolume = 1.0f;

    TimeSinceLastPositionUpdate = 0.0f;
    bIsCapturing = false;
}

void UPanaudiaAudioComponent::BeginPlay()
{
    Super::BeginPlay();

    UE_LOG(LogTemp, Warning, TEXT("*** PANAUDIA AudioComponent::BeginPlay — BUILD 2026-02-23B (direct hardware thread audio, no game tick) ***"));

    // Create connection manager
    ConnectionManager = MakeShared<FPanaudiaConnectionManager>();

    // Configure jitter buffer
    ConnectionManager->SetJitterBufferEnabled(bAdaptiveJitterBuffer);
    ConnectionManager->SetJitterBufferRange(MinJitterBufferMs, MaxJitterBufferMs, TargetJitterBufferMs);

    // Configure auto-reconnection
    ConnectionManager->SetAutoReconnectEnabled(bAutoReconnectEnabled);
    ConnectionManager->SetMaxReconnectAttempts(MaxReconnectAttempts);
    ConnectionManager->SetReconnectBaseDelay(ReconnectBaseDelay);

    // Bind connection callbacks
    ConnectionManager->OnConnectionStatusChanged.AddLambda([this](EPanaudiaConnectionStatus Status, const FString& Message)
    {
        HandleConnectionStatusChanged(Status, Message);
    });

    ConnectionManager->OnNodeStateReceived.AddLambda([this](const FPanaudiaNodeState& State)
    {
        HandleNodeStateReceived(State);
    });

    // Fix: Change parameter type to match FOnAttributesReceivedNative (const FAttributesMap&)
    ConnectionManager->OnAttributesReceived.AddLambda([this](const FAttributesMap& Attributes)
    {
        // Convert TMap to JSON string for the handler
        FString JsonData = TEXT("{");
        bool bFirst = true;
        for (const auto& Pair : Attributes)
        {
            if (!bFirst) JsonData += TEXT(",");
            JsonData += FString::Printf(TEXT("\"%s\":\"%s\""), *Pair.Key, *Pair.Value);
            bFirst = false;
        }
        JsonData += TEXT("}");

        HandleAttributesReceived(JsonData);
    });

    // Setup audio playback
    SetupAudioPlayback();

    UE_LOG(LogTemp, Log, TEXT("PanaudiaAudioComponent initialized with auto-reconnect: %s"),
        bAutoReconnectEnabled ? TEXT("enabled") : TEXT("disabled"));
}

void UPanaudiaAudioComponent::SetJitterBufferEnabled(bool bEnabled)
{
    bAdaptiveJitterBuffer = bEnabled;
    if (ConnectionManager.IsValid())
    {
        ConnectionManager->SetJitterBufferEnabled(bEnabled);
    }
}

void UPanaudiaAudioComponent::ConfigureJitterBuffer(int32 MinMs, int32 MaxMs, int32 TargetMs)
{
    MinJitterBufferMs = MinMs;
    MaxJitterBufferMs = MaxMs;
    TargetJitterBufferMs = TargetMs;

    if (ConnectionManager.IsValid())
    {
        ConnectionManager->SetJitterBufferRange(MinMs, MaxMs, TargetMs);
    }
}

float UPanaudiaAudioComponent::GetCurrentAudioLatency() const
{
    if (ConnectionManager.IsValid())
    {
        return ConnectionManager->GetCurrentAudioLatency();
    }
    return 0.0f;
}

float UPanaudiaAudioComponent::GetJitterBufferPacketLoss() const
{
    // Packet loss is not tracked by the ring buffer — return 0
    return 0.0f;
}

void UPanaudiaAudioComponent::SetAutoReconnect(bool bEnabled)
{
    bAutoReconnectEnabled = bEnabled;
    if (ConnectionManager.IsValid())
    {
        ConnectionManager->SetAutoReconnectEnabled(bEnabled);
    }
}

bool UPanaudiaAudioComponent::IsAutoReconnectEnabled() const
{
    if (ConnectionManager.IsValid())
    {
        return ConnectionManager->IsAutoReconnectEnabled();
    }
    return bAutoReconnectEnabled;
}

void UPanaudiaAudioComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // Critical shutdown ordering:
    // 1. Stop mic capture
    StopAudioCapture();

    // 2. Stop audio render thread from calling OnGeneratePCMAudio
    if (AudioComponent)
    {
        AudioComponent->Stop();
    }

    // 3. Detach jitter buffer from procedural sound (safety net for in-flight callbacks)
    if (ProceduralSound)
    {
        ProceduralSound->SetJitterBuffer(nullptr);
    }

    // 4. Disconnect QUIC (synchronous, stops msquic callbacks that write to jitter buffer)
    if (ConnectionManager.IsValid())
    {
        ConnectionManager->Disconnect();
        // 5. Destroy connection manager (and jitter buffer) — now safe, no readers or writers
        ConnectionManager.Reset();
    }

    Super::EndPlay(EndPlayReason);
}

void UPanaudiaAudioComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Auto-update position if enabled
    if (bAutoUpdatePosition && ConnectionManager.IsValid() && ConnectionManager->IsConnected())
    {
        TimeSinceLastPositionUpdate += DeltaTime;

        if (TimeSinceLastPositionUpdate >= PositionUpdateRate)
        {
            AutoUpdatePosition();
            TimeSinceLastPositionUpdate = 0.0f;
        }
    }

    // Audio is handled directly by UPanaudiaProceduralSound::OnGeneratePCMAudio
    // on the audio render thread — no game-tick processing needed
}

void UPanaudiaAudioComponent::Connect(const FPanaudiaConnectionConfig& Config)
{
    if (!ConnectionManager.IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("ConnectionManager is not valid"));
        return;
    }

    UE_LOG(LogTemp, Log, TEXT("Connecting to Panaudia..."));
    ConnectionManager->Connect(Config);

    // Start audio playback immediately — OnGeneratePCMAudio produces silence until data arrives
    if (AudioComponent && !AudioComponent->IsPlaying())
    {
        AudioComponent->Play();
        UE_LOG(LogTemp, Log, TEXT("Started audio playback (silence until data arrives)"));
    }

    // Start capturing microphone if enabled
    if (bCaptureMicrophone)
    {
        StartAudioCapture();
    }
}

void UPanaudiaAudioComponent::ConnectDirect(const FString& DirectURL, FVector Position, FRotator Rotation)
{
    if (!ConnectionManager.IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("ConnectionManager is not valid"));
        return;
    }

    FPanaudiaConnectionConfig Config;
    Config.InitialPosition = Position;
    Config.InitialRotation = Rotation;

    UE_LOG(LogTemp, Log, TEXT("Connecting directly to: %s"), *DirectURL);
    ConnectionManager->ConnectDirect(DirectURL, Config);

    // Start audio playback immediately — OnGeneratePCMAudio produces silence until data arrives
    if (AudioComponent && !AudioComponent->IsPlaying())
    {
        AudioComponent->Play();
        UE_LOG(LogTemp, Log, TEXT("Started audio playback (silence until data arrives)"));
    }

    // Start capturing microphone if enabled
    if (bCaptureMicrophone)
    {
        StartAudioCapture();
    }
}

void UPanaudiaAudioComponent::Disconnect()
{
    if (ConnectionManager.IsValid())
    {
        ConnectionManager->Disconnect();
    }

    StopAudioCapture();
}

bool UPanaudiaAudioComponent::IsConnected() const
{
    return ConnectionManager.IsValid() && ConnectionManager->IsConnected();
}

void UPanaudiaAudioComponent::UpdatePosition(FVector Position, FRotator Rotation)
{
    if (ConnectionManager.IsValid())
    {
        ConnectionManager->UpdatePosition(Position, Rotation, WorldExtent);
    }
}

void UPanaudiaAudioComponent::MuteNode(const FString& NodeId)
{
    if (ConnectionManager.IsValid())
    {
        ConnectionManager->Mute(NodeId);
    }
}

void UPanaudiaAudioComponent::UnmuteNode(const FString& NodeId)
{
    if (ConnectionManager.IsValid())
    {
        ConnectionManager->Unmute(NodeId);
    }
}

void UPanaudiaAudioComponent::SetMicrophoneEnabled(bool bEnabled)
{
    bCaptureMicrophone = bEnabled;

    if (bEnabled && !bIsCapturing && IsConnected())
    {
        StartAudioCapture();
    }
    else if (!bEnabled && bIsCapturing)
    {
        StopAudioCapture();
    }
}

void UPanaudiaAudioComponent::StartAudioCapture()
{
    if (bIsCapturing)
    {
        UE_LOG(LogTemp, Warning, TEXT("Audio capture already started"));
        return;
    }

    // UE 5.6+ FOnAudioCaptureFunction expects const void* as first parameter
    Audio::FAudioCaptureDeviceParams Params;
    Params.DeviceIndex = 0; // Default device

    if (AudioCapture.OpenAudioCaptureStream(
        Params,
        [this](const void* AudioData, int32 NumFrames, int32 NumChannels, int32 SampleRate, double StreamTime, bool bOverflow)
        {
            // Cast void* to float* for our internal handler
            OnAudioCapture(reinterpret_cast<const float*>(AudioData), NumFrames, NumChannels, SampleRate, StreamTime, bOverflow);
        },
        1024))
    {
        if (AudioCapture.StartStream())
        {
            bIsCapturing = true;
            UE_LOG(LogTemp, Log, TEXT("Audio capture started"));
        }
        else
        {
            UE_LOG(LogTemp, Error, TEXT("Failed to start audio capture stream"));
        }
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to open audio capture stream"));
    }
}

void UPanaudiaAudioComponent::StopAudioCapture()
{
    if (!bIsCapturing)
    {
        return;
    }

    AudioCapture.StopStream();
    AudioCapture.CloseStream();
    bIsCapturing = false;

    UE_LOG(LogTemp, Log, TEXT("Audio capture stopped"));
}

void UPanaudiaAudioComponent::OnAudioCapture(
    const float* AudioData,
    int32 NumFrames,
    int32 NumChannels,
    int32 SampleRate,
    double StreamTime,
    bool bOverflow)
{
    if (!ConnectionManager.IsValid())
    {
        UE_LOG(LogTemp, Warning, TEXT("Failed to send audio: not valid"));
        return;
    }

    if (!ConnectionManager->IsConnected())
    {
        //UE_LOG(LogTemp, Warning, TEXT("Failed to send audio: not connected"));
        return;
    }

    // Apply input volume
    if (FMath::Abs(InputVolume - 1.0f) > SMALL_NUMBER)
    {
        CaptureBuffer.SetNum(NumFrames * NumChannels);
        for (int32 i = 0; i < NumFrames * NumChannels; ++i)
        {
            CaptureBuffer[i] = AudioData[i] * InputVolume;
        }
        AudioData = CaptureBuffer.GetData();
    }

    // Submit to connection manager
    ConnectionManager->SubmitAudioData(AudioData, NumFrames, NumChannels, SampleRate);
}

void UPanaudiaAudioComponent::SetupAudioPlayback()
{
    if (!GetWorld())
    {
        return;
    }

    // Create custom procedural sound wave (float PCM, reads directly from jitter buffer)
    ProceduralSound = NewObject<UPanaudiaProceduralSound>(this, TEXT("PanaudiaProceduralSound"));
    ProceduralSound->SetSampleRate(48000);
    ProceduralSound->NumChannels = 2; // Stereo for binaural
    ProceduralSound->Duration = INDEFINITELY_LOOPING_DURATION;
    ProceduralSound->SoundGroup = SOUNDGROUP_Voice;
    ProceduralSound->bLooping = false;

    // Wire jitter buffer pointer (audio render thread reads from it directly)
    if (ConnectionManager.IsValid())
    {
        ProceduralSound->SetJitterBuffer(ConnectionManager->GetJitterBuffer());
    }

    // Create audio component — play as 2D (non-spatialized) since server
    // already does binaural processing. Without this, UE applies 3D distance
    // attenuation which silences the output.
    AudioComponent = NewObject<UAudioComponent>(this, TEXT("PanaudiaAudioComponent"));
    AudioComponent->SetSound(ProceduralSound);
    AudioComponent->bAutoActivate = false;
    AudioComponent->bAlwaysPlay = true;
    AudioComponent->bIsUISound = true;  // Bypass UE 3D spatialization
    AudioComponent->SetVolumeMultiplier(1.0f);
    AudioComponent->RegisterComponent();

    UE_LOG(LogTemp, Log, TEXT("Audio playback setup complete (direct hardware thread reads)"));
}

// ProcessIncomingAudio removed — audio is handled directly by
// UPanaudiaProceduralSound::OnGeneratePCMAudio on the audio render thread

void UPanaudiaAudioComponent::AutoUpdatePosition()
{
    AActor* Owner = GetOwner();
    if (!Owner)
    {
        return;
    }

    FVector Position = Owner->GetActorLocation();

    // Use the control rotation (where the player is actually looking)
    // rather than the actor rotation (which may only track yaw for characters).
    // For non-pawn actors, fall back to actor rotation.
    FRotator Rotation;
    APawn* Pawn = Cast<APawn>(Owner);
    if (Pawn && Pawn->GetController())
    {
        Rotation = Pawn->GetController()->GetControlRotation();
    }
    else
    {
        Rotation = Owner->GetActorRotation();
    }

    UpdatePosition(Position, Rotation);
}

void UPanaudiaAudioComponent::HandleConnectionStatusChanged(EPanaudiaConnectionStatus Status, const FString& Message)
{
    UE_LOG(LogTemp, Log, TEXT("Connection status changed: %d - %s"), (int)Status, *Message);
    OnConnectionStatusChanged.Broadcast(Status, Message);
}

void UPanaudiaAudioComponent::HandleNodeStateReceived(const FPanaudiaNodeState& State)
{
    OnRemoteStateReceived.Broadcast(State);
}

void UPanaudiaAudioComponent::HandleAttributesReceived(const FString& JsonData)
{
    UE_LOG(LogTemp, Log, TEXT("Attributes received: %s"), *JsonData);
}