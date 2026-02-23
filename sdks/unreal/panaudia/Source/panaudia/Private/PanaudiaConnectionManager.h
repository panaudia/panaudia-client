
#pragma once

#include "Containers/Array.h"
#include "Containers/Map.h"
#include "Containers/Queue.h"
#include "Containers/UnrealString.h"
#include "HAL/CriticalSection.h"
#include "HAL/Platform.h"
#include "Math/Rotator.h"
#include "Math/Vector.h"
#include "Templates/SharedPointer.h"
#include "Tickable.h"

#include "PanaudiaTypes.h"
#include "PanaudiaJitterBuffer.h"
#include "PanaudiaMoqProtocol.h"

// Plain C++ types for msquic thread safety (msquic threads are NOT registered with UE)
#include <vector>
#include <mutex>
#include <atomic>
#include <queue>
#include <cstdint>

// msquic (suppress warnings from third-party headers)
THIRD_PARTY_INCLUDES_START
#include "msquic.h"
THIRD_PARTY_INCLUDES_END

// Forward declarations
class FPanaudiaOpusEncoder;
class FPanaudiaOpusDecoder;

// (FPanaudiaAudioPacket removed — audio is now decoded inline on msquic thread)

/**
 * Manages MOQ/QUIC connection using msquic.
 *
 * IMPORTANT THREADING MODEL:
 * msquic callbacks fire on msquic's own worker threads which are NOT registered
 * with UE's thread system. Calling ANY UE API (UE_LOG, TArray, new/delete, AsyncTask,
 * FString, etc.) from these threads will crash UE's CPU profiler trace system.
 *
 * Therefore: msquic callbacks ONLY use plain C/C++ types (std::vector, std::mutex,
 * std::atomic, malloc/free, printf). All UE work is deferred to Tick() on the game thread.
 */
class PANAUDIA_API FPanaudiaConnectionManager : public FTickableGameObject
{
public:
    FPanaudiaConnectionManager();
    virtual ~FPanaudiaConnectionManager();

    // Connection management
    void Connect(const FPanaudiaConnectionConfig& Config);
    void ConnectDirect(const FString& DirectURL, const FPanaudiaConnectionConfig& Config);
    void Disconnect();
    bool IsConnected() const { return CurrentStatus == EPanaudiaConnectionStatus::Connected || CurrentStatus == EPanaudiaConnectionStatus::DataConnected; }
    EPanaudiaConnectionStatus GetConnectionStatus() const { return CurrentStatus; }

    // Auto-reconnection settings
    void SetAutoReconnectEnabled(bool bEnabled);
    bool IsAutoReconnectEnabled() const { return bAutoReconnectEnabled; }
    void SetMaxReconnectAttempts(int32 MaxAttempts);
    void SetReconnectBaseDelay(float DelaySeconds);

    // Position updates
    void UpdatePosition(const FVector& Position, const FRotator& Rotation, float WorldExtent = 5000.0f);
    void UpdateAmbisonicPosition(const FPanaudiaNodeState& State);

    // Audio control
    void Mute(const FString& NodeId);
    void Unmute(const FString& NodeId);

    // Audio data handling (called from audio capture thread)
    void SubmitAudioData(const float* AudioData, int32 NumSamples, int32 NumChannels, int32 SampleRate);

    // Jitter buffer access (for UPanaudiaProceduralSound to read from audio render thread)
    FPanaudiaJitterBuffer* GetJitterBuffer() const { return JitterBuffer; }

    // Callbacks
    FOnConnectionStatusChangedNative OnConnectionStatusChanged;
    FOnNodeStateReceivedNative OnNodeStateReceived;
    FOnAttributesReceivedNative OnAttributesReceived;

    // FTickableGameObject interface
    virtual void Tick(float DeltaTime) override;
    virtual TStatId GetStatId() const override;
    virtual bool IsTickable() const override { return true; }

    // Jitter buffer configuration
    void SetJitterBufferEnabled(bool bEnabled);
    void SetJitterBufferRange(int32 MinMs, int32 MaxMs, int32 TargetMs);
    FJitterBufferStats GetJitterBufferStats() const;
    float GetCurrentAudioLatency() const;

private:
    // --- msquic handles ---
    const QUIC_API_TABLE* MsQuic = nullptr;
    HQUIC Registration = nullptr;
    HQUIC Configuration = nullptr;
    HQUIC QuicConnection = nullptr;
    HQUIC ControlStream = nullptr;

    // --- MOQ state ---
    uint64 NextRequestId = 0;          // Client uses even IDs (0, 2, 4...)

    // Track aliases assigned by server (via incoming SUBSCRIBE)
    uint64 AudioInputTrackAlias = 0;
    uint64 StateTrackAlias = 0;
    uint64 ControlTrackAlias = 0;
    bool bAudioAliasAssigned = false;
    bool bStateAliasAssigned = false;
    bool bControlAliasAssigned = false;

    // Track aliases we assign (for our subscriptions)
    uint64 AudioOutputTrackAlias = 100;
    uint64 StateOutputTrackAlias = 101;
    uint64 AttributesTrackAlias = 102;

    // Object IDs for outgoing datagrams
    uint64 AudioObjectId = 0;
    uint64 StateObjectId = 0;
    uint64 ControlObjectId = 0;

    // Node ID from JWT
    FString NodeId;

    // --- Connection state ---
    EPanaudiaConnectionStatus CurrentStatus;
    FString LastErrorMessage;

    // Auto-reconnection state
    bool bAutoReconnectEnabled = false;
    bool bIsManualDisconnect = false;
    bool bIsReconnecting = false;
    int32 ReconnectAttemptCount = 0;
    int32 MaxReconnectAttempts = 10;
    float ReconnectBaseDelay = 2.0f;
    float ReconnectTimer = 0.0f;
    float CurrentReconnectDelay = 0.0f;
    FPanaudiaConnectionConfig LastConnectionConfig;
    bool bHasConnectionConfig = false;

    // --- Audio ---
    FPanaudiaOpusEncoder* OpusEncoder = nullptr;
    FPanaudiaOpusDecoder* OpusDecoder = nullptr;

    // Pre-allocated decode buffer for msquic thread (960 stereo samples max)
    float DecodeBuffer[960 * 2];

    // Pre-allocated mic send path buffers (capture thread only — no sync needed)
    float MonoBuffer[1024];              // Stereo→mono scratch (max capture frame)
    float AccumulationBuffer[240];       // Accumulate until 240 samples (5ms at 48kHz)
    int32 AccumulatedSamples = 0;
    uint8 EncodeOutputBuffer[512];       // Max Opus frame (~200 bytes typical)
    uint8 DatagramBuffer[600];           // MOQ header + Opus payload

    // Jitter buffer
    FPanaudiaJitterBuffer* JitterBuffer = nullptr;

    // --- Queued outgoing datagrams (from non-QUIC threads) ---
    TQueue<TArray<uint8>, EQueueMode::Mpsc> OutgoingDatagramQueue;

    // =========================================================================
    // msquic thread-safe queues (plain C++ only — NO UE types!)
    // These are written from msquic callback threads and read from Tick().
    // =========================================================================

    // Incoming control stream data chunks
    std::queue<std::vector<uint8_t>> PendingControlData;
    std::mutex ControlDataMutex;

    // Incoming datagrams
    std::queue<std::vector<uint8_t>> PendingDatagrams;
    std::mutex DatagramMutex;

    // Connection event flags (set by msquic callbacks, read by Tick)
    std::atomic<bool> bPendingConnected{false};
    std::atomic<bool> bPendingTransportShutdown{false};
    std::atomic<bool> bPendingPeerShutdown{false};
    std::atomic<bool> bMoqSessionStarted{false};


    // Control stream receive buffer (game thread only, used in Tick)
    TArray<uint8> ControlStreamRecvBuffer;

    // =========================================================================

    // --- QUIC initialization ---
    bool InitializeQuic();
    void CleanupQuic();

    // --- MOQ session (called from Tick/game thread) ---
    void StartMoqSession();
    void SendClientSetup();
    void AnnounceAndSubscribe();
    void SendOnControlStream(const TArray<uint8>& Data);
    void ProcessControlStreamData(const uint8* Data, int32 Len);
    void HandleServerSetup(const uint8* Content, int32 ContentLen);
    void HandleAnnounceOk(const uint8* Content, int32 ContentLen);
    void HandleSubscribeOk(const uint8* Content, int32 ContentLen);
    void HandleIncomingSubscribe(const uint8* Content, int32 ContentLen);

    // --- Data sending ---
    void SendDatagram(const TArray<uint8>& Data);
    void SendDatagramDirect(const uint8* Data, int32 Len);
    void SendStateUpdate(const FPanaudiaNodeState& State);
    void SendControlMessage(const FString& Type, const TSharedPtr<FJsonObject>& MessageData);

    // --- Data receiving (called from Tick/game thread) ---
    void ProcessPendingDatagrams();
    void OnStateDataReceived(const uint8* Payload, int32 PayloadLen);
    void OnAttributesDataReceived(const uint8* Payload, int32 PayloadLen);

    // --- Audio codec ---
    void InitializeAudioCodecs();
    void CleanupAudioCodecs();
    void InitializeJitterBuffer();

    // --- Connection helpers ---
    void SetConnectionStatus(EPanaudiaConnectionStatus NewStatus, const FString& Message);
    void HandleConnectionLost(const FString& Reason);
    void AttemptReconnect();
    void ResetReconnectionState();
    float CalculateReconnectDelay() const;

    // --- msquic callbacks (static, run on msquic threads — NO UE APIS!) ---
    static QUIC_STATUS QUIC_API StaticConnectionCallback(
        HQUIC Connection, void* Context, QUIC_CONNECTION_EVENT* Event);
    static QUIC_STATUS QUIC_API StaticStreamCallback(
        HQUIC Stream, void* Context, QUIC_STREAM_EVENT* Event);

    QUIC_STATUS OnConnectionEvent(HQUIC Connection, QUIC_CONNECTION_EVENT* Event);
    QUIC_STATUS OnStreamEvent(HQUIC Stream, QUIC_STREAM_EVENT* Event);
};
