
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
#include "IWebSocket.h"
#include "PanaudiaJitterBuffer.h"


// Include STL headers after Unreal headers to avoid conflicts
#include <vector>
#include <string>
#include <memory>

// Forward declarations
namespace rtc
{
    class PeerConnection;
    class DataChannel;
    class Track;
    struct Configuration;
}

class FPanaudiaOpusEncoder;
class FPanaudiaOpusDecoder;

// Audio packet structure
struct FPanaudiaAudioPacket
{
    TArray<uint8> Data;
    int32 NumSamples;
    int32 NumChannels;
    double Timestamp;
};

/**
 * Manages WebRTC connection using libdatachannel
 * Mirrors the functionality of connection.js with auto-reconnection
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
    void UpdatePosition(const FVector& Position, const FRotator& Rotation);
    void UpdateAmbisonicPosition(const FPanaudiaNodeState& State);

    // Audio control
    void Mute(const FString& NodeId);
    void Unmute(const FString& NodeId);

    // Audio data handling (called from audio thread)
    void SubmitAudioData(const float* AudioData, int32 NumSamples, int32 NumChannels, int32 SampleRate);
    bool GetReceivedAudioData(float* OutAudioData, int32 NumSamples, int32 NumChannels);

    // Callbacks - Use NATIVE versions that support lambdas
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
    // WebSocket connection for signaling
    TSharedPtr<IWebSocket> WebSocket;
    FString WebSocketURL;
    std::atomic<bool> bAnswerSent{false};

    // WebRTC peer connection
    std::shared_ptr<rtc::PeerConnection> PeerConnection;

    // Data channels
    std::shared_ptr<rtc::DataChannel> StateChannel;
    std::shared_ptr<rtc::DataChannel> ControlChannel;
    std::shared_ptr<rtc::DataChannel> AttributesChannel;

    // Audio track
    std::shared_ptr<rtc::Track> AudioTrack;

    // Connection state
    EPanaudiaConnectionStatus CurrentStatus;
    FString LastErrorMessage;
    bool bIsDataChannelOpen;
    FCriticalSection StatusLock;

    // Auto-reconnection state
    bool bAutoReconnectEnabled;
    bool bIsManualDisconnect;
    bool bIsReconnecting;
    int32 ReconnectAttemptCount;
    int32 MaxReconnectAttempts;
    float ReconnectBaseDelay;
    float ReconnectTimer;
    float CurrentReconnectDelay;
    FPanaudiaConnectionConfig LastConnectionConfig;
    bool bHasConnectionConfig;

    // Audio encoding/decoding
    FPanaudiaOpusEncoder* OpusEncoder;
    FPanaudiaOpusDecoder* OpusDecoder;

    // Audio buffers (thread-safe queues)
    TQueue<TArray<float>, EQueueMode::Mpsc> OutgoingPCMQueue;
    TQueue<FPanaudiaAudioPacket, EQueueMode::Mpsc> IncomingPacketQueue;
    TQueue<TArray<float>, EQueueMode::Mpsc> DecodedAudioQueue;

    // Audio resampling buffer (for accumulating partial frames)
    TArray<float> PCMAccumulationBuffer;
    int32 AccumulatedSamples;

    // Jitter buffer
    FPanaudiaJitterBuffer* JitterBuffer;

    // WebSocket handlers
    void OnWebSocketConnected();
    void OnWebSocketConnectionError(const FString& Error);
    void OnWebSocketClosed(int32 StatusCode, const FString& Reason, bool bWasClean);
    void OnWebSocketMessage(const FString& Message);

    // Signaling message handlers
    void HandleOfferMessage(const FString& OfferJson);
    void HandleCandidateMessage(const FString& CandidateJson);
    void HandleErrorMessage(const FString& ErrorJson);

    // WebRTC setup
    void InitializePeerConnection();
    void SetupAudioTrack();
    void CreateAnswer(const FString& OfferSDP);
    void SendICECandidate(const FString& CandidateJson);

    // Data channel handlers
    void OnStateChannelOpen();
    void OnStateChannelMessage(const std::vector<std::byte>& Data);
    void OnControlChannelOpen();
    void OnControlChannelMessage(const std::string& Message);
    void OnAttributesChannelOpen();
    void OnAttributesChannelMessage(const std::string& Message);;

    // Audio track handlers
    void OnAudioTrackOpen();
    void OnAudioTrackMessage(const std::vector<std::byte>& Data);
    void ProcessOutgoingAudio();
    void ProcessIncomingAudio();

    // Auto-reconnection
    void HandleConnectionLost(const FString& Reason);
    void AttemptReconnect();
    void ResetReconnectionState();
    float CalculateReconnectDelay() const;

    // Helper methods
    void SetConnectionStatus(EPanaudiaConnectionStatus NewStatus, const FString& Message);
    void SendControlMessage(const FString& Type, const TSharedPtr<FJsonObject>& MessageData);
    FString BuildConnectionURL(const FPanaudiaConnectionConfig& Config, const FString& BaseURL);
    void SendStateUpdate(const FPanaudiaNodeState& State);

    void InitializeJitterBuffer();

    // Cleanup
    void CleanupWebRTC();
    void CleanupWebSocket();
    void InitializeAudioCodecs();
    void CleanupAudioCodecs();
};