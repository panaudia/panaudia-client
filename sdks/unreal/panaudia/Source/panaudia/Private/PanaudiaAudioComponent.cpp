
#include "PanaudiaAudioComponent.h"
#include "PanaudiaModule.h"

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
#include "Misc/Base64.h"
#include "Json.h"
#include "JsonUtilities.h"
#include "Async/Async.h"

#include <panaudia/core.h>

#include "PanaudiaProceduralSound.h"

// NodeInfo3 binary size: UUID(16) + Position(12) + Rotation(12) + Volume(4) + Gone(4)
static const int32 NODE_INFO3_SIZE = 48;

// ============================================================================
// Private implementation struct — keeps heavy headers out of the public header
// ============================================================================

struct FPanaudiaAudioComponentPrivate
{
    panaudia::PanaudiaCore* Core = nullptr;
    panaudia::TrackHandle* AudioOutputTrack = nullptr;
    panaudia::TrackHandle* AudioInputTrack = nullptr;
    panaudia::TrackHandle* StateOutputTrack = nullptr;
    panaudia::TrackHandle* AttributesOutputTrack = nullptr;
    panaudia::TrackHandle* StateInputTrack = nullptr;
    panaudia::TrackHandle* ControlInputTrack = nullptr;

    Audio::FAudioCapture AudioCapture;
    bool bIsCapturing = false;

    static constexpr int32 MaxCaptureFrames = 1024;
    static constexpr int32 MaxCaptureChannels = 8;
    float CaptureBuffer[MaxCaptureFrames * MaxCaptureChannels];
    float MonoBuffer[MaxCaptureFrames];
};

// Forward declarations — defined after ConfigureCore
static void PanaudiaCoreStatusChanged_Impl(panaudia::ConnectionState, const char*, void*);
static void PanaudiaCoreDataReceived_Impl(panaudia::TrackHandle*, const uint8_t*, uint32_t, void*);
static void PanaudiaCoreLog_Impl(panaudia::LogLevel, const char*, void*);

// ============================================================================
// Helper: Extract NodeID (jti claim) from JWT token
// ============================================================================

static FString ExtractNodeIdFromJwt(const FString& Token)
{
    TArray<FString> Parts;
    Token.ParseIntoArray(Parts, TEXT("."));
    if (Parts.Num() != 3)
    {
        UE_LOG(LogPanaudia, Error, TEXT("Invalid JWT: expected 3 parts, got %d"), Parts.Num());
        return FString();
    }

    // Base64url -> base64
    FString Payload = Parts[1];
    Payload = Payload.Replace(TEXT("-"), TEXT("+"));
    Payload = Payload.Replace(TEXT("_"), TEXT("/"));
    while (Payload.Len() % 4 != 0)
    {
        Payload += TEXT("=");
    }

    TArray<uint8> DecodedBytes;
    if (!FBase64::Decode(Payload, DecodedBytes))
    {
        UE_LOG(LogPanaudia, Error, TEXT("Failed to base64-decode JWT payload"));
        return FString();
    }

    DecodedBytes.Add(0);
    FString JsonString = FString(UTF8_TO_TCHAR(
        reinterpret_cast<const char*>(DecodedBytes.GetData())));

    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);

    if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid())
    {
        UE_LOG(LogPanaudia, Error, TEXT("Failed to parse JWT payload JSON"));
        return FString();
    }

    FString NodeIdValue = JsonObject->GetStringField(TEXT("jti"));
    if (!NodeIdValue.IsEmpty())
    {
        return NodeIdValue;
    }

    UE_LOG(LogPanaudia, Error, TEXT("No jti claim found in JWT payload"));
    return FString();
}

// ============================================================================
// Helper: Convert UUID string "550e8400-e29b-41d4-..." to 16 raw bytes
// ============================================================================

static bool UuidStringToBytes(const FString& UuidStr, uint8* OutBytes)
{
    FString Hex = UuidStr.Replace(TEXT("-"), TEXT(""));
    if (Hex.Len() != 32)
    {
        return false;
    }
    for (int32 i = 0; i < 16; ++i)
    {
        FString ByteStr = Hex.Mid(i * 2, 2);
        OutBytes[i] = (uint8)FCString::Strtoi(*ByteStr, nullptr, 16);
    }
    return true;
}

// ============================================================================
// Constructor / Destructor
// ============================================================================

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

    P = new FPanaudiaAudioComponentPrivate();
}

UPanaudiaAudioComponent::~UPanaudiaAudioComponent()
{
    delete P;
    P = nullptr;
}

// ============================================================================
// BeginPlay / EndPlay
// ============================================================================

void UPanaudiaAudioComponent::BeginPlay()
{
    Super::BeginPlay();

    UE_LOG(LogPanaudia, Warning, TEXT("*** PANAUDIA AudioComponent::BeginPlay — v0.3.0-core built %s %s ***"), TEXT(__DATE__), TEXT(__TIME__));

    P->Core = new panaudia::PanaudiaCore();

    SetupAudioPlayback();

    UE_LOG(LogPanaudia, Log, TEXT("PanaudiaAudioComponent initialized with auto-reconnect: %s"),
        bAutoReconnectEnabled ? TEXT("enabled") : TEXT("disabled"));
}

void UPanaudiaAudioComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // Critical shutdown ordering:
    // 1. Stop mic capture (no more writes)
    StopAudioCapture();

    // 2. Stop audio render thread from calling OnGeneratePCMAudio
    if (AudioComp)
    {
        AudioComp->Stop();
    }

    // 3. Null out atomic pointers in ProceduralSound (safety net for in-flight callbacks)
    if (ProceduralSound)
    {
        ProceduralSound->SetCore(nullptr, nullptr);
    }

    // 4. Disconnect Core (synchronous — joins session thread, no more callbacks after return)
    if (P->Core)
    {
        P->Core->disconnect();
        // 5. Safe to delete — no readers, no writers, no callbacks
        delete P->Core;
        P->Core = nullptr;
    }

    P->AudioOutputTrack = nullptr;
    P->AudioInputTrack = nullptr;
    P->StateOutputTrack = nullptr;
    P->AttributesOutputTrack = nullptr;
    P->StateInputTrack = nullptr;
    P->ControlInputTrack = nullptr;

    Super::EndPlay(EndPlayReason);
}

// ============================================================================
// Core Configuration
// ============================================================================

void UPanaudiaAudioComponent::ConfigureCore(const FString& ServerURL, const FString& Ticket)
{
    if (!P->Core) return;

    // Extract NodeID from JWT
    NodeId = ExtractNodeIdFromJwt(Ticket);
    if (NodeId.IsEmpty())
    {
        UE_LOG(LogPanaudia, Error, TEXT("Failed to extract node ID from JWT"));
        return;
    }
    UE_LOG(LogPanaudia, Log, TEXT("Node ID: %s"), *NodeId);

    // Convert FString to std::string
    std::string NodeIdStr = TCHAR_TO_UTF8(*NodeId);
    std::string ServerURLStr = TCHAR_TO_UTF8(*ServerURL);
    std::string TicketStr = TCHAR_TO_UTF8(*Ticket);

    panaudia::SessionConfig Config;
    Config.server_url = ServerURLStr;
    Config.jwt = TicketStr;

    // Jitter buffer
    Config.jitter_buffer_min_ms = MinJitterBufferMs;
    Config.jitter_buffer_max_ms = MaxJitterBufferMs;
    Config.jitter_buffer_initial_ms = TargetJitterBufferMs;

    // Reconnection
    Config.max_reconnect_attempts = bAutoReconnectEnabled ? MaxReconnectAttempts : 0;
    Config.reconnect_base_delay_ms = (uint32_t)(ReconnectBaseDelay * 1000.0f);
    Config.reconnect_max_delay_ms = 60000;

    // Callbacks — file-scope functions defined below
    Config.status_callback = &PanaudiaCoreStatusChanged_Impl;
    Config.status_ctx = this;
    Config.data_recv_callback = &PanaudiaCoreDataReceived_Impl;
    Config.data_recv_ctx = this;
    Config.log_callback = &PanaudiaCoreLog_Impl;
    Config.log_ctx = this;
    Config.log_level = panaudia::LogLevel::Info;

    // --- Track definitions ---

    // Audio output (inbound — server's binaural mix → our speakers)
    {
        panaudia::TrackConfig T;
        T.name = "audio_output";
        T.moq_namespace = {"out", "audio", "opus-stereo", NodeIdStr};
        T.direction = panaudia::TrackDirection::Inbound;
        T.type = panaudia::TrackType::Audio;
        T.channels = 2;
        T.sample_rate = 48000;
        T.codec = panaudia::AudioCodec::Opus;
        Config.tracks.push_back(T);
    }

    // Audio input (outbound — our mic → server)
    {
        panaudia::TrackConfig T;
        T.name = "audio_input";
        T.moq_namespace = {"in", "audio", "opus-mono", NodeIdStr};
        T.direction = panaudia::TrackDirection::Outbound;
        T.type = panaudia::TrackType::Audio;
        T.channels = 1;
        T.sample_rate = 48000;
        T.codec = panaudia::AudioCodec::Opus;
        T.opus_bitrate = 64000;
        T.opus_frame_size_ms = 5;
        Config.tracks.push_back(T);
    }

    // State & attributes output (inbound) — only subscribe when presence visualisation is active
    if (bEnablePresenceTracks)
    {
        // State output (inbound — remote node positions)
        {
            panaudia::TrackConfig T;
            T.name = "state_output";
            T.moq_namespace = {"out", "state", NodeIdStr};
            T.direction = panaudia::TrackDirection::Inbound;
            T.type = panaudia::TrackType::Data;
            Config.tracks.push_back(T);
        }

        // Attributes output (inbound — remote node attributes)
        {
            panaudia::TrackConfig T;
            T.name = "attributes_output";
            T.moq_namespace = {"out", "attributes", NodeIdStr};
            T.direction = panaudia::TrackDirection::Inbound;
            T.type = panaudia::TrackType::Data;
            Config.tracks.push_back(T);
        }
    }

    // State input (outbound — our position → server)
    {
        panaudia::TrackConfig T;
        T.name = "state_input";
        T.moq_namespace = {"state", NodeIdStr};
        T.direction = panaudia::TrackDirection::Outbound;
        T.type = panaudia::TrackType::Data;
        Config.tracks.push_back(T);
    }

    // Control input (outbound — mute/unmute commands → server)
    {
        panaudia::TrackConfig T;
        T.name = "control_input";
        T.moq_namespace = {"in", "control", NodeIdStr};
        T.direction = panaudia::TrackDirection::Outbound;
        T.type = panaudia::TrackType::Data;
        Config.tracks.push_back(T);
    }

    P->Core->configure(Config);

    // Resolve track handles
    P->AudioOutputTrack = P->Core->get_track("audio_output");
    P->AudioInputTrack = P->Core->get_track("audio_input");
    P->StateOutputTrack = P->Core->get_track("state_output");
    P->AttributesOutputTrack = P->Core->get_track("attributes_output");
    P->StateInputTrack = P->Core->get_track("state_input");
    P->ControlInputTrack = P->Core->get_track("control_input");
}

// ============================================================================
// Core Callbacks (file-scope, matching panaudia callback typedefs)
// ============================================================================

static void PanaudiaCoreStatusChanged_Impl(
    panaudia::ConnectionState State, const char* Message, void* Ctx)
{
    // Map panaudia::ConnectionState to EPanaudiaConnectionStatus
    EPanaudiaConnectionStatus UEStatus;
    switch (State)
    {
    case panaudia::ConnectionState::Disconnected:
        UEStatus = EPanaudiaConnectionStatus::Disconnected;
        break;
    case panaudia::ConnectionState::Connecting:
    case panaudia::ConnectionState::Reconnecting:
        UEStatus = EPanaudiaConnectionStatus::Connecting;
        break;
    case panaudia::ConnectionState::Connected:
        UEStatus = EPanaudiaConnectionStatus::DataConnected;
        break;
    case panaudia::ConnectionState::Failed:
        UEStatus = EPanaudiaConnectionStatus::Error;
        break;
    default:
        UEStatus = EPanaudiaConnectionStatus::Disconnected;
        break;
    }

    FString Msg = Message ? FString(UTF8_TO_TCHAR(Message)) : FString();

    // Marshal to game thread for delegate broadcast
    auto* Self = static_cast<UPanaudiaAudioComponent*>(Ctx);
    AsyncTask(ENamedThreads::GameThread, [Self, UEStatus, Msg]()
    {
        if (!IsValid(Self)) return;
        UE_LOG(LogPanaudia, Log, TEXT("Connection status changed: %d - %s"), (int)UEStatus, *Msg);
        Self->OnConnectionStatusChanged.Broadcast(UEStatus, Msg);
    });
}

static void PanaudiaCoreDataReceived_Impl(
    panaudia::TrackHandle* Track, const uint8_t* Data, uint32_t DataLen, void* Ctx)
{
    if (DataLen == 0) return;
    auto* Self = static_cast<UPanaudiaAudioComponent*>(Ctx);

    FString TrackName;
    if (Track == Self->P->StateOutputTrack)
    {
        TrackName = TEXT("state_output");
    }
    else if (Track == Self->P->AttributesOutputTrack)
    {
        TrackName = TEXT("attributes_output");
    }
    else
    {
        return;
    }

    TArray<uint8> RawData;
    RawData.Append(Data, DataLen);

    AsyncTask(ENamedThreads::GameThread, [Self, TrackName, RawData = MoveTemp(RawData)]()
    {
        if (!IsValid(Self)) return;
        Self->OnDataTrackReceived.Broadcast(TrackName, RawData);
    });
}

static void PanaudiaCoreLog_Impl(
    panaudia::LogLevel Level, const char* Message, void* Ctx)
{
    FString Msg = UTF8_TO_TCHAR(Message);

    switch (Level)
    {
    case panaudia::LogLevel::Error:
        UE_LOG(LogPanaudia, Error, TEXT("[panaudia-core] %s"), *Msg);
        break;
    case panaudia::LogLevel::Warn:
        UE_LOG(LogPanaudia, Warning, TEXT("[panaudia-core] %s"), *Msg);
        break;
    case panaudia::LogLevel::Info:
        UE_LOG(LogPanaudia, Log, TEXT("[panaudia-core] %s"), *Msg);
        break;
    case panaudia::LogLevel::Debug:
    case panaudia::LogLevel::Trace:
        UE_LOG(LogPanaudia, Verbose, TEXT("[panaudia-core] %s"), *Msg);
        break;
    }
}

// ============================================================================
// Connection
// ============================================================================

void UPanaudiaAudioComponent::Connect(const FPanaudiaConnectionConfig& Config)
{
    if (!P->Core)
    {
        UE_LOG(LogPanaudia, Error, TEXT("Core is not initialized"));
        return;
    }

    UE_LOG(LogPanaudia, Log, TEXT("Connecting to Panaudia via Core..."));
    ConfigureCore(Config.ServerURL, Config.Ticket);
    P->Core->connect();

    // Wire up audio playback to Core
    if (ProceduralSound)
    {
        ProceduralSound->SetCore(P->Core, P->AudioOutputTrack);
    }

    // Start audio playback immediately — OnGeneratePCMAudio produces silence until data arrives
    if (AudioComp && !AudioComp->IsPlaying())
    {
        AudioComp->Play();
        UE_LOG(LogPanaudia, Log, TEXT("Started audio playback (silence until data arrives)"));
    }

    // Start capturing microphone if enabled
    if (bCaptureMicrophone)
    {
        StartAudioCapture();
    }
}

void UPanaudiaAudioComponent::ConnectDirect(const FString& DirectURL, FVector Position, FRotator Rotation)
{
    if (!P->Core)
    {
        UE_LOG(LogPanaudia, Error, TEXT("Core is not initialized"));
        return;
    }

    // Build a config with the direct URL (no ticket for direct connections)
    // The caller should have set up a JWT token already via Connect()
    // For direct URL, we still need a ticket — use empty string
    FPanaudiaConnectionConfig Config;
    Config.ServerURL = DirectURL;
    Config.InitialPosition = Position;
    Config.InitialRotation = Rotation;

    UE_LOG(LogPanaudia, Log, TEXT("Connecting directly to: %s"), *DirectURL);
    Connect(Config);
}

void UPanaudiaAudioComponent::Disconnect()
{
    StopAudioCapture();

    if (ProceduralSound)
    {
        ProceduralSound->SetCore(nullptr, nullptr);
    }

    if (P->Core)
    {
        P->Core->disconnect();
    }
}

bool UPanaudiaAudioComponent::IsConnected() const
{
    if (!P->Core) return false;
    auto State = P->Core->get_connection_state();
    return State == panaudia::ConnectionState::Connected;
}

// ============================================================================
// Position / Control
// ============================================================================

void UPanaudiaAudioComponent::UpdatePosition(FVector Position, FRotator Rotation)
{
    if (!P->Core || !P->StateInputTrack) return;

    FPanaudiaNodeState State = FPanaudiaNodeState::FromUnrealCoordinates(
        Position, Rotation, WorldExtent);

    // Build NodeInfo3 binary (48 bytes)
    uint8 NodeInfo[NODE_INFO3_SIZE];
    uint8* Ptr = NodeInfo;

    // UUID (bytes 0-15)
    if (!UuidStringToBytes(NodeId, Ptr))
    {
        return;
    }
    Ptr += 16;

    // Position (bytes 16-27, float32 LE)
    FMemory::Memcpy(Ptr, &State.X, 4); Ptr += 4;
    FMemory::Memcpy(Ptr, &State.Y, 4); Ptr += 4;
    FMemory::Memcpy(Ptr, &State.Z, 4); Ptr += 4;

    // Rotation (bytes 28-39, float32 LE)
    FMemory::Memcpy(Ptr, &State.Yaw, 4); Ptr += 4;
    FMemory::Memcpy(Ptr, &State.Pitch, 4); Ptr += 4;
    FMemory::Memcpy(Ptr, &State.Roll, 4); Ptr += 4;

    // Volume (bytes 40-43)
    float Volume = 1.0f;
    FMemory::Memcpy(Ptr, &Volume, 4); Ptr += 4;

    // Gone flag (bytes 44-47)
    int32 Gone = 0;
    FMemory::Memcpy(Ptr, &Gone, 4);

    P->Core->send_data(P->StateInputTrack, NodeInfo, NODE_INFO3_SIZE);
}

void UPanaudiaAudioComponent::MuteNode(const FString& MuteNodeId)
{
    if (!P->Core || !P->ControlInputTrack) return;

    TSharedPtr<FJsonObject> Json = MakeShareable(new FJsonObject());
    Json->SetStringField(TEXT("type"), TEXT("mute"));
    Json->SetStringField(TEXT("node"), MuteNodeId);

    FString JsonString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonString);
    FJsonSerializer::Serialize(Json.ToSharedRef(), Writer);

    FTCHARToUTF8 UTF8(*JsonString);
    P->Core->send_data(P->ControlInputTrack,
        reinterpret_cast<const uint8_t*>(UTF8.Get()), UTF8.Length());
}

void UPanaudiaAudioComponent::UnmuteNode(const FString& UnmuteNodeId)
{
    if (!P->Core || !P->ControlInputTrack) return;

    TSharedPtr<FJsonObject> Json = MakeShareable(new FJsonObject());
    Json->SetStringField(TEXT("type"), TEXT("unmute"));
    Json->SetStringField(TEXT("node"), UnmuteNodeId);

    FString JsonString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonString);
    FJsonSerializer::Serialize(Json.ToSharedRef(), Writer);

    FTCHARToUTF8 UTF8(*JsonString);
    P->Core->send_data(P->ControlInputTrack,
        reinterpret_cast<const uint8_t*>(UTF8.Get()), UTF8.Length());
}

void UPanaudiaAudioComponent::SetMicrophoneEnabled(bool bEnabled)
{
    bCaptureMicrophone = bEnabled;

    if (bEnabled && !P->bIsCapturing && IsConnected())
    {
        StartAudioCapture();
    }
    else if (!bEnabled && P->bIsCapturing)
    {
        StopAudioCapture();
    }
}

// ============================================================================
// Jitter Buffer / Reconnection settings
// ============================================================================

void UPanaudiaAudioComponent::SetJitterBufferEnabled(bool bEnabled)
{
    bAdaptiveJitterBuffer = bEnabled;
}

void UPanaudiaAudioComponent::ConfigureJitterBuffer(int32 MinMs, int32 MaxMs, int32 TargetMs)
{
    MinJitterBufferMs = MinMs;
    MaxJitterBufferMs = MaxMs;
    TargetJitterBufferMs = TargetMs;
}

float UPanaudiaAudioComponent::GetCurrentAudioLatency() const
{
    if (P->Core && P->AudioOutputTrack)
    {
        auto Status = P->Core->get_buffer_status(P->AudioOutputTrack);
        // Convert buffered frames to ms at 48kHz
        return (float)Status.buffered_frames / 48.0f;
    }
    return 0.0f;
}

float UPanaudiaAudioComponent::GetJitterBufferPacketLoss() const
{
    return 0.0f;
}

void UPanaudiaAudioComponent::SetAutoReconnect(bool bEnabled)
{
    bAutoReconnectEnabled = bEnabled;
}

bool UPanaudiaAudioComponent::IsAutoReconnectEnabled() const
{
    return bAutoReconnectEnabled;
}

// ============================================================================
// Tick
// ============================================================================

void UPanaudiaAudioComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Auto-update position if enabled
    if (bAutoUpdatePosition && IsConnected())
    {
        TimeSinceLastPositionUpdate += DeltaTime;

        if (TimeSinceLastPositionUpdate >= PositionUpdateRate)
        {
            AutoUpdatePosition();
            TimeSinceLastPositionUpdate = 0.0f;
        }
    }
}

// ============================================================================
// Audio Capture
// ============================================================================

void UPanaudiaAudioComponent::StartAudioCapture()
{
    if (P->bIsCapturing)
    {
        UE_LOG(LogPanaudia, Warning, TEXT("Audio capture already started"));
        return;
    }

    // Enumerate all capture devices and find the built-in mic
    TArray<Audio::FCaptureDeviceInfo> Devices;
    P->AudioCapture.GetCaptureDevicesAvailable(Devices);

    int32 SelectedDevice = 0;
    UE_LOG(LogPanaudia, Log, TEXT("Available capture devices (%d):"), Devices.Num());
    for (int32 i = 0; i < Devices.Num(); ++i)
    {
        UE_LOG(LogPanaudia, Log, TEXT("  [%d] \"%s\" — %d ch, %d Hz"),
            i, *Devices[i].DeviceName, Devices[i].InputChannels, Devices[i].PreferredSampleRate);
    }

    // Find the built-in mic: prefer device with "Built-in" or "MacBook" in name, 1-2 channels
    int32 BuiltInIndex = INDEX_NONE;
    int32 FirstLowChIndex = INDEX_NONE;
    for (int32 i = 0; i < Devices.Num(); ++i)
    {
        if (Devices[i].InputChannels >= 1 && Devices[i].InputChannels <= 2)
        {
            if (FirstLowChIndex == INDEX_NONE)
            {
                FirstLowChIndex = i;
            }
            if (Devices[i].DeviceName.Contains(TEXT("Built-in")) ||
                Devices[i].DeviceName.Contains(TEXT("MacBook")) ||
                Devices[i].DeviceName.Contains(TEXT("Internal")))
            {
                BuiltInIndex = i;
                break;
            }
        }
    }

    if (BuiltInIndex != INDEX_NONE)
    {
        SelectedDevice = BuiltInIndex;
        UE_LOG(LogPanaudia, Log, TEXT("Selected built-in mic: [%d] \"%s\" (%d ch)"),
            SelectedDevice, *Devices[SelectedDevice].DeviceName, Devices[SelectedDevice].InputChannels);
    }
    else if (FirstLowChIndex != INDEX_NONE)
    {
        SelectedDevice = FirstLowChIndex;
        UE_LOG(LogPanaudia, Warning, TEXT("No built-in mic found, using first 1-2ch device: [%d] \"%s\" (%d ch)"),
            SelectedDevice, *Devices[SelectedDevice].DeviceName, Devices[SelectedDevice].InputChannels);
    }
    else
    {
        UE_LOG(LogPanaudia, Warning, TEXT("No 1-2ch device found, using device 0 (%d ch)"),
            Devices.Num() > 0 ? Devices[0].InputChannels : 0);
    }

    Audio::FAudioCaptureDeviceParams Params;
    Params.DeviceIndex = SelectedDevice;

    if (P->AudioCapture.OpenAudioCaptureStream(
        Params,
        [this](const void* AudioData, int32 NumFrames, int32 NumChannels, int32 SampleRate, double StreamTime, bool bOverflow)
        {
            OnAudioCapture(reinterpret_cast<const float*>(AudioData), NumFrames, NumChannels, SampleRate, StreamTime, bOverflow);
        },
        1024))
    {
        if (P->AudioCapture.StartStream())
        {
            P->bIsCapturing = true;
            UE_LOG(LogPanaudia, Log, TEXT("Audio capture started on device [%d]"), SelectedDevice);
        }
        else
        {
            UE_LOG(LogPanaudia, Error, TEXT("Failed to start audio capture stream"));
        }
    }
    else
    {
        UE_LOG(LogPanaudia, Error, TEXT("Failed to open audio capture stream on device [%d]"), SelectedDevice);
    }
}

void UPanaudiaAudioComponent::StopAudioCapture()
{
    if (!P->bIsCapturing)
    {
        return;
    }

    P->AudioCapture.StopStream();
    P->AudioCapture.CloseStream();
    P->bIsCapturing = false;

    UE_LOG(LogPanaudia, Log, TEXT("Audio capture stopped"));
}

void UPanaudiaAudioComponent::OnAudioCapture(
    const float* AudioData,
    int32 NumFrames,
    int32 NumChannels,
    int32 SampleRate,
    double StreamTime,
    bool bOverflow)
{
    if (!P->Core || !P->AudioInputTrack) return;
    if (P->Core->get_connection_state() != panaudia::ConnectionState::Connected) return;

    // Clamp to buffer limits
    if (NumFrames > FPanaudiaAudioComponentPrivate::MaxCaptureFrames)
        NumFrames = FPanaudiaAudioComponentPrivate::MaxCaptureFrames;
    if (NumChannels > FPanaudiaAudioComponentPrivate::MaxCaptureChannels)
        NumChannels = FPanaudiaAudioComponentPrivate::MaxCaptureChannels;

    // Apply input volume into pre-allocated CaptureBuffer (no allocation)
    const float* ProcessData = AudioData;
    if (FMath::Abs(InputVolume - 1.0f) > SMALL_NUMBER)
    {
        int32 TotalSamples = NumFrames * NumChannels;
        for (int32 i = 0; i < TotalSamples; ++i)
        {
            P->CaptureBuffer[i] = AudioData[i] * InputVolume;
        }
        ProcessData = P->CaptureBuffer;
    }

    // Stereo-to-mono downmix (audio_input track is mono)
    if (NumChannels > 1)
    {
        for (int32 i = 0; i < NumFrames; ++i)
        {
            float Sum = 0.0f;
            for (int32 ch = 0; ch < NumChannels; ++ch)
            {
                Sum += ProcessData[i * NumChannels + ch];
            }
            P->MonoBuffer[i] = Sum / NumChannels;
        }
        P->Core->write_audio(P->AudioInputTrack, P->MonoBuffer, NumFrames, 0);
    }
    else
    {
        P->Core->write_audio(P->AudioInputTrack, ProcessData, NumFrames, 0);
    }
}

// ============================================================================
// Audio Playback Setup
// ============================================================================

void UPanaudiaAudioComponent::SetupAudioPlayback()
{
    if (!GetWorld())
    {
        return;
    }

    // Create custom procedural sound wave (float PCM, reads from Core via read_audio)
    ProceduralSound = NewObject<UPanaudiaProceduralSound>(this, TEXT("PanaudiaProceduralSound"));
    ProceduralSound->SetSampleRate(48000);
    ProceduralSound->NumChannels = 2; // Stereo for binaural
    ProceduralSound->Duration = INDEFINITELY_LOOPING_DURATION;
    ProceduralSound->SoundGroup = SOUNDGROUP_Voice;
    ProceduralSound->bLooping = false;

    // Create audio component — play as 2D (non-spatialized) since server
    // already does binaural processing.
    AudioComp = NewObject<UAudioComponent>(this, TEXT("PanaudiaAudioComponent"));
    AudioComp->SetSound(ProceduralSound);
    AudioComp->bAutoActivate = false;
    AudioComp->bAlwaysPlay = true;
    AudioComp->bIsUISound = true;  // Bypass UE 3D spatialization
    AudioComp->SetVolumeMultiplier(1.0f);
    AudioComp->RegisterComponent();

    UE_LOG(LogPanaudia, Log, TEXT("Audio playback setup complete (Core read_audio path)"));
}

// ============================================================================
// Position Tracking
// ============================================================================

void UPanaudiaAudioComponent::AutoUpdatePosition()
{
    AActor* Owner = GetOwner();
    if (!Owner)
    {
        return;
    }

    FVector Position = Owner->GetActorLocation();

    // Use the control rotation (where the player is actually looking)
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
