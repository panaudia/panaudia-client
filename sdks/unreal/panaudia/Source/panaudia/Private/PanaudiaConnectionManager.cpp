
#include "PanaudiaConnectionManager.h"

#include "CoreMinimal.h"
#include "PanaudiaOpusEncoder.h"
#include "PanaudiaOpusDecoder.h"
#include "Json.h"
#include "JsonUtilities.h"
#include "Misc/Base64.h"
#include "Async/Async.h"

// ALPN for raw QUIC MOQ connection (matching Go server's handleQuicConnection)
static const char* MOQ_ALPN = "moq-00";

// MOQ Transport version (draft-11: 0xff000000 + 11)
static const uint64 MOQ_TRANSPORT_VERSION = 0xff00000b;

// NodeInfo3 binary size: UUID(16) + Position(12) + Rotation(12) + Volume(4) + Gone(4)
static const int32 NODE_INFO3_SIZE = 48;

// ============================================================================
// Helper: Extract NodeID (jti claim) from JWT token
// ============================================================================

static FString ExtractNodeIdFromJwt(const FString& Token)
{
    // JWT format: header.payload.signature
    TArray<FString> Parts;
    Token.ParseIntoArray(Parts, TEXT("."));
    if (Parts.Num() != 3)
    {
        UE_LOG(LogTemp, Error, TEXT("Invalid JWT: expected 3 parts, got %d"), Parts.Num());
        return FString();
    }

    // Base64url → base64
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
        UE_LOG(LogTemp, Error, TEXT("Failed to base64-decode JWT payload"));
        return FString();
    }

    // Null-terminate for string conversion
    DecodedBytes.Add(0);
    FString JsonString = FString(UTF8_TO_TCHAR(
        reinterpret_cast<const char*>(DecodedBytes.GetData())));

    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);

    if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to parse JWT payload JSON"));
        return FString();
    }

    // Get node ID from jti claim
    FString NodeIdValue = JsonObject->GetStringField(TEXT("jti"));
    if (!NodeIdValue.IsEmpty())
    {
        return NodeIdValue;
    }

    UE_LOG(LogTemp, Error, TEXT("No jti claim found in JWT payload"));
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

FPanaudiaConnectionManager::FPanaudiaConnectionManager()
    : CurrentStatus(EPanaudiaConnectionStatus::Disconnected)
    , LastErrorMessage()
    , OpusEncoder(nullptr)
    , OpusDecoder(nullptr)
    , AccumulatedSamples(0)
    , JitterBuffer(nullptr)
{
    UE_LOG(LogTemp, Log, TEXT("PanaudiaConnectionManager created (MOQ/QUIC)"));
    InitializeAudioCodecs();
    InitializeJitterBuffer();
}

FPanaudiaConnectionManager::~FPanaudiaConnectionManager()
{
    Disconnect();
    CleanupAudioCodecs();

    if (JitterBuffer)
    {
        delete JitterBuffer;
        JitterBuffer = nullptr;
    }
}

// ============================================================================
// Audio Codec Initialization
// ============================================================================

void FPanaudiaConnectionManager::InitializeAudioCodecs()
{
    // Mono encoder for microphone input — 5ms frames (240 samples at 48kHz)
    OpusEncoder = new FPanaudiaOpusEncoder();
    if (!OpusEncoder->Initialize(48000, 1, 2048, 240))
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to initialize Opus encoder"));
        delete OpusEncoder;
        OpusEncoder = nullptr;
    }
    else
    {
        OpusEncoder->SetBitrate(64000);
        OpusEncoder->SetComplexity(5);
        OpusEncoder->SetDTX(true);
        UE_LOG(LogTemp, Log, TEXT("Opus encoder initialized (mono 48kHz, 5ms frames)"));
    }

    // Stereo decoder for binaural output from server
    OpusDecoder = new FPanaudiaOpusDecoder();
    if (!OpusDecoder->Initialize(48000, 2))
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to initialize Opus decoder"));
        delete OpusDecoder;
        OpusDecoder = nullptr;
    }
    else
    {
        UE_LOG(LogTemp, Log, TEXT("Opus decoder initialized (stereo 48kHz)"));
    }
}

void FPanaudiaConnectionManager::CleanupAudioCodecs()
{
    if (OpusEncoder) { delete OpusEncoder; OpusEncoder = nullptr; }
    if (OpusDecoder) { delete OpusDecoder; OpusDecoder = nullptr; }
}

void FPanaudiaConnectionManager::InitializeJitterBuffer()
{
    JitterBuffer = new FPanaudiaJitterBuffer();
    JitterBuffer->Initialize(48000, 2, 60, 20, 30, 10, 200, 16);
    UE_LOG(LogTemp, Log, TEXT("Jitter buffer initialized"));
}

// ============================================================================
// QUIC Initialization
// ============================================================================

bool FPanaudiaConnectionManager::InitializeQuic()
{
    QUIC_STATUS Status = MsQuicOpen2(&MsQuic);
    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("MsQuicOpen2 failed: 0x%x"), Status);
        return false;
    }

    // Registration with low-latency profile
    QUIC_REGISTRATION_CONFIG RegConfig = {};
    RegConfig.AppName = "Panaudia";
    RegConfig.ExecutionProfile = QUIC_EXECUTION_PROFILE_LOW_LATENCY;

    Status = MsQuic->RegistrationOpen(&RegConfig, &Registration);
    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("RegistrationOpen failed: 0x%x"), Status);
        return false;
    }

    // ALPN buffer
    QUIC_BUFFER AlpnBuffer;
    AlpnBuffer.Length = (uint32_t)strlen(MOQ_ALPN);
    AlpnBuffer.Buffer = (uint8_t*)MOQ_ALPN;

    // QUIC settings: enable datagrams, reasonable timeouts
    QUIC_SETTINGS Settings = {};
    Settings.IsSet.DatagramReceiveEnabled = TRUE;
    Settings.DatagramReceiveEnabled = TRUE;
    Settings.IsSet.IdleTimeoutMs = TRUE;
    Settings.IdleTimeoutMs = 30000;
    Settings.IsSet.PeerBidiStreamCount = TRUE;
    Settings.PeerBidiStreamCount = 10;
    Settings.IsSet.PeerUnidiStreamCount = TRUE;
    Settings.PeerUnidiStreamCount = 10;

    Status = MsQuic->ConfigurationOpen(
        Registration, &AlpnBuffer, 1,
        &Settings, sizeof(Settings),
        nullptr, &Configuration);
    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("ConfigurationOpen failed: 0x%x"), Status);
        return false;
    }

    // TLS credential (client mode)
    QUIC_CREDENTIAL_CONFIG CredConfig = {};
    CredConfig.Type = QUIC_CREDENTIAL_TYPE_NONE;
    CredConfig.Flags = QUIC_CREDENTIAL_FLAG_CLIENT;
    if (LastConnectionConfig.bSkipCertValidation)
    {
        CredConfig.Flags |= QUIC_CREDENTIAL_FLAG_NO_CERTIFICATE_VALIDATION;
    }

    Status = MsQuic->ConfigurationLoadCredential(Configuration, &CredConfig);
    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("ConfigurationLoadCredential failed: 0x%x"), Status);
        return false;
    }

    UE_LOG(LogTemp, Log, TEXT("QUIC initialized (ALPN: %hs)"), MOQ_ALPN);
    return true;
}

void FPanaudiaConnectionManager::CleanupQuic()
{
    if (ControlStream && MsQuic)
    {
        MsQuic->StreamClose(ControlStream);
        ControlStream = nullptr;
    }

    if (QuicConnection && MsQuic)
    {
        MsQuic->ConnectionClose(QuicConnection);
        QuicConnection = nullptr;
    }

    if (Configuration && MsQuic)
    {
        MsQuic->ConfigurationClose(Configuration);
        Configuration = nullptr;
    }

    if (Registration && MsQuic)
    {
        MsQuic->RegistrationClose(Registration);
        Registration = nullptr;
    }

    if (MsQuic)
    {
        MsQuicClose(MsQuic);
        MsQuic = nullptr;
    }

    // Reset MOQ state
    NextRequestId = 0;
    bAudioAliasAssigned = false;
    bStateAliasAssigned = false;
    bControlAliasAssigned = false;
    AudioObjectId = 0;
    StateObjectId = 0;
    ControlObjectId = 0;
    ControlStreamRecvBuffer.Empty();
    bMoqSessionStarted.store(false);
    bPendingConnected.store(false);
    bPendingTransportShutdown.store(false);
    bPendingPeerShutdown.store(false);

    // Drain queues
    {
        std::lock_guard<std::mutex> Lock(ControlDataMutex);
        while (!PendingControlData.empty()) PendingControlData.pop();
    }
    {
        std::lock_guard<std::mutex> Lock(DatagramMutex);
        while (!PendingDatagrams.empty()) PendingDatagrams.pop();
    }
}

// ============================================================================
// Connection Management
// ============================================================================

void FPanaudiaConnectionManager::Connect(const FPanaudiaConnectionConfig& Config)
{
    UE_LOG(LogTemp, Warning, TEXT("*** PANAUDIA Connect() CALLED — printing stack trace: ***"));
    FDebug::DumpStackTraceToLog(ELogVerbosity::Warning);
    UE_LOG(LogTemp, Log, TEXT("Connecting via MOQ/QUIC"));

    LastConnectionConfig = Config;
    bHasConnectionConfig = true;
    bIsManualDisconnect = false;
    ResetReconnectionState();

    // For MOQ we connect directly (no entrance server HTTP lookup)
    ConnectDirect(Config.ServerURL, Config);
}

void FPanaudiaConnectionManager::ConnectDirect(
    const FString& DirectURL, const FPanaudiaConnectionConfig& Config)
{
    UE_LOG(LogTemp, Log, TEXT("ConnectDirect: %s"), *DirectURL);

    LastConnectionConfig = Config;
    bHasConnectionConfig = true;
    bIsManualDisconnect = false;

    // Extract NodeID from JWT
    NodeId = ExtractNodeIdFromJwt(Config.Ticket);
    if (NodeId.IsEmpty())
    {
        SetConnectionStatus(EPanaudiaConnectionStatus::Error,
            TEXT("Failed to extract node ID from JWT"));
        return;
    }
    UE_LOG(LogTemp, Log, TEXT("Node ID: %s"), *NodeId);

    SetConnectionStatus(EPanaudiaConnectionStatus::Connecting, TEXT("Connecting"));

    if (!InitializeQuic())
    {
        SetConnectionStatus(EPanaudiaConnectionStatus::Error,
            TEXT("Failed to initialize QUIC"));
        return;
    }

    // Parse host:port from URL (strip scheme if present)
    FString Host;
    int32 Port = 4433;

    FString WorkURL = DirectURL;
    if (WorkURL.StartsWith(TEXT("quic://")))  WorkURL.RightChopInline(7);
    else if (WorkURL.StartsWith(TEXT("https://"))) WorkURL.RightChopInline(8);
    else if (WorkURL.StartsWith(TEXT("http://")))  WorkURL.RightChopInline(7);

    // Remove trailing path (e.g. /gateway)
    int32 SlashIdx;
    if (WorkURL.FindChar('/', SlashIdx))
    {
        WorkURL.LeftInline(SlashIdx);
    }

    int32 ColonIdx;
    if (WorkURL.FindChar(':', ColonIdx))
    {
        Host = WorkURL.Left(ColonIdx);
        Port = FCString::Atoi(*WorkURL.Mid(ColonIdx + 1));
    }
    else
    {
        Host = WorkURL;
    }

    // Open QUIC connection
    QUIC_STATUS Status = MsQuic->ConnectionOpen(
        Registration,
        StaticConnectionCallback,
        this,
        &QuicConnection);
    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("ConnectionOpen failed: 0x%x"), Status);
        SetConnectionStatus(EPanaudiaConnectionStatus::Error,
            TEXT("Failed to open QUIC connection"));
        CleanupQuic();
        return;
    }

    // Start QUIC handshake
    FTCHARToUTF8 HostUTF8(*Host);
    Status = MsQuic->ConnectionStart(
        QuicConnection,
        Configuration,
        QUIC_ADDRESS_FAMILY_UNSPEC,
        HostUTF8.Get(),
        (uint16_t)Port);
    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("ConnectionStart failed: 0x%x"), Status);
        SetConnectionStatus(EPanaudiaConnectionStatus::Error,
            TEXT("Failed to start QUIC connection"));
        CleanupQuic();
        return;
    }

    UE_LOG(LogTemp, Log, TEXT("QUIC connection started to %s:%d"), *Host, Port);
}

void FPanaudiaConnectionManager::Disconnect()
{
    UE_LOG(LogTemp, Log, TEXT("Disconnect"));

    bIsManualDisconnect = true;
    bIsReconnecting = false;
    ResetReconnectionState();

    CleanupQuic();

    SetConnectionStatus(EPanaudiaConnectionStatus::Disconnected, TEXT("Disconnected"));
}

// ============================================================================
// msquic Static Callbacks → Instance Methods
//
// CRITICAL: These run on msquic worker threads.
// Do NOT call any UE API (UE_LOG, TArray, FString, new, delete, AsyncTask, etc.)
// Only use: printf, std::vector, std::mutex, std::atomic, malloc/free, msquic API.
// ============================================================================

QUIC_STATUS QUIC_API FPanaudiaConnectionManager::StaticConnectionCallback(
    HQUIC Connection, void* Context, QUIC_CONNECTION_EVENT* Event)
{
    auto* Self = static_cast<FPanaudiaConnectionManager*>(Context);
    return Self->OnConnectionEvent(Connection, Event);
}

QUIC_STATUS QUIC_API FPanaudiaConnectionManager::StaticStreamCallback(
    HQUIC Stream, void* Context, QUIC_STREAM_EVENT* Event)
{
    auto* Self = static_cast<FPanaudiaConnectionManager*>(Context);
    return Self->OnStreamEvent(Stream, Event);
}

QUIC_STATUS FPanaudiaConnectionManager::OnConnectionEvent(
    HQUIC Connection, QUIC_CONNECTION_EVENT* Event)
{
    // *** msquic thread — NO UE API calls! ***

    switch (Event->Type)
    {
    case QUIC_CONNECTION_EVENT_CONNECTED:
        printf("[Panaudia] QUIC connected (ALPN len: %u)\n",
            Event->CONNECTED.NegotiatedAlpnLength);
        bPendingConnected.store(true);
        break;

    case QUIC_CONNECTION_EVENT_SHUTDOWN_INITIATED_BY_TRANSPORT:
        printf("[Panaudia] QUIC transport shutdown: 0x%llx\n",
            (unsigned long long)Event->SHUTDOWN_INITIATED_BY_TRANSPORT.Status);
        bPendingTransportShutdown.store(true);
        break;

    case QUIC_CONNECTION_EVENT_SHUTDOWN_INITIATED_BY_PEER:
        printf("[Panaudia] QUIC peer shutdown: %llu\n",
            (unsigned long long)Event->SHUTDOWN_INITIATED_BY_PEER.ErrorCode);
        bPendingPeerShutdown.store(true);
        break;

    case QUIC_CONNECTION_EVENT_SHUTDOWN_COMPLETE:
        printf("[Panaudia] QUIC shutdown complete\n");
        break;

    case QUIC_CONNECTION_EVENT_PEER_STREAM_STARTED:
        printf("[Panaudia] Peer stream started\n");
        MsQuic->SetCallbackHandler(
            Event->PEER_STREAM_STARTED.Stream,
            (void*)StaticStreamCallback,
            this);
        break;

    case QUIC_CONNECTION_EVENT_DATAGRAM_STATE_CHANGED:
        printf("[Panaudia] Datagram state: send=%d, maxLen=%u\n",
            Event->DATAGRAM_STATE_CHANGED.SendEnabled,
            Event->DATAGRAM_STATE_CHANGED.MaxSendLength);
        break;

    case QUIC_CONNECTION_EVENT_DATAGRAM_RECEIVED:
        {
            // Parse MOQ datagram inline on msquic thread
            const uint8_t* RawData = Event->DATAGRAM_RECEIVED.Buffer->Buffer;
            uint32_t RawLen = Event->DATAGRAM_RECEIVED.Buffer->Length;

            // ParseObjectDatagram uses pure C types — safe on msquic thread
            // We use local variables matching the UE typedefs (uint64/uint8/int32)
            // since these are just stdint aliases
            uint64 DgTrackAlias, DgGroupID, DgObjectID;
            uint8 DgPriority;
            const uint8* DgPayload;
            int32 DgPayloadLen;

            if (MoqProtocol::ParseObjectDatagram(
                    RawData, (int32)RawLen,
                    DgTrackAlias, DgGroupID, DgObjectID,
                    DgPriority, DgPayload, DgPayloadLen))
            {
                if (DgTrackAlias == AudioOutputTrackAlias && OpusDecoder && OpusDecoder->IsInitialized() && JitterBuffer)
                {
                    // Decode audio inline on msquic thread — no game tick involved
                    if (DgPayloadLen > 0)
                    {
                        int32 DecodedSamples = OpusDecoder->Decode(
                            DgPayload, DgPayloadLen,
                            DecodeBuffer, 960);

                        if (DecodedSamples > 0)
                        {
                            JitterBuffer->AddPacket(DecodeBuffer, DecodedSamples * 2, 2);
                        }
                        else
                        {
                            printf("[Panaudia] Opus decode failed: %d (payloadLen=%d)\n",
                                DecodedSamples, DgPayloadLen);
                        }
                    }
                }
                else
                {
                    // Non-audio datagrams: queue for game thread (state, attributes)
                    std::vector<uint8_t> Buf(RawData, RawData + RawLen);
                    {
                        std::lock_guard<std::mutex> Lock(DatagramMutex);
                        PendingDatagrams.push(std::move(Buf));
                    }
                }
            }
        }
        break;

    case QUIC_CONNECTION_EVENT_DATAGRAM_SEND_STATE_CHANGED:
        {
            // Free single-block send context on terminal states
            // Layout: [QUIC_BUFFER][payload] — one malloc, one free
            void* RawCtx = Event->DATAGRAM_SEND_STATE_CHANGED.ClientContext;
            auto DgState = Event->DATAGRAM_SEND_STATE_CHANGED.State;
            if (RawCtx &&
                DgState != QUIC_DATAGRAM_SEND_UNKNOWN &&
                DgState != QUIC_DATAGRAM_SEND_SENT &&
                DgState != QUIC_DATAGRAM_SEND_LOST_SUSPECT)
            {
                free(RawCtx);
            }
        }
        break;

    default:
        break;
    }

    return QUIC_STATUS_SUCCESS;
}

QUIC_STATUS FPanaudiaConnectionManager::OnStreamEvent(
    HQUIC Stream, QUIC_STREAM_EVENT* Event)
{
    // *** msquic thread — NO UE API calls! ***

    switch (Event->Type)
    {
    case QUIC_STREAM_EVENT_RECEIVE:
        {
            // Copy received bytes into std::vector and queue for game thread
            for (uint32_t i = 0; i < Event->RECEIVE.BufferCount; ++i)
            {
                const uint8_t* Data = Event->RECEIVE.Buffers[i].Buffer;
                uint32_t Len = Event->RECEIVE.Buffers[i].Length;

                std::vector<uint8_t> Buf(Data, Data + Len);
                {
                    std::lock_guard<std::mutex> Lock(ControlDataMutex);
                    PendingControlData.push(std::move(Buf));
                }
            }
        }
        break;

    case QUIC_STREAM_EVENT_SEND_COMPLETE:
        // Free the SendContext allocated in SendOnControlStream
        if (Event->SEND_COMPLETE.ClientContext)
        {
            struct SendContext {
                uint8_t* DataBuf;
                QUIC_BUFFER* QuicBuf;
            };
            SendContext* Ctx = static_cast<SendContext*>(Event->SEND_COMPLETE.ClientContext);
            free(Ctx->DataBuf);
            free(Ctx->QuicBuf);
            free(Ctx);
        }
        break;

    case QUIC_STREAM_EVENT_PEER_SEND_SHUTDOWN:
        printf("[Panaudia] Control stream: peer send shutdown\n");
        break;

    case QUIC_STREAM_EVENT_SHUTDOWN_COMPLETE:
        printf("[Panaudia] Control stream: shutdown complete\n");
        break;

    default:
        break;
    }

    return QUIC_STATUS_SUCCESS;
}

// ============================================================================
// MOQ Session Lifecycle (called from Tick/game thread)
// ============================================================================

void FPanaudiaConnectionManager::StartMoqSession()
{
    // Open bidirectional control stream
    QUIC_STATUS Status = MsQuic->StreamOpen(
        QuicConnection,
        QUIC_STREAM_OPEN_FLAG_NONE, // bidirectional
        StaticStreamCallback,
        this,
        &ControlStream);
    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("StreamOpen failed: 0x%x"), Status);
        SetConnectionStatus(EPanaudiaConnectionStatus::Error,
            TEXT("Failed to open control stream"));
        return;
    }

    Status = MsQuic->StreamStart(ControlStream, QUIC_STREAM_START_FLAG_NONE);
    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("StreamStart failed: 0x%x"), Status);
        SetConnectionStatus(EPanaudiaConnectionStatus::Error,
            TEXT("Failed to start control stream"));
        return;
    }

    UE_LOG(LogTemp, Log, TEXT("Control stream opened, sending CLIENT_SETUP"));
    SendClientSetup();
    bMoqSessionStarted.store(true);
}

void FPanaudiaConnectionManager::SendClientSetup()
{
    // CLIENT_SETUP content:
    //   [version_count varint=1][version varint]
    //   [param_count varint=3]
    //   [role: key=0x00 (even) → bare varint value=0x03 (PubSub)]
    //   [path: key=0x01 (odd) → length-prefixed bytes "/" ]
    //   [max_subscribe_id: key=0x02 (even) → bare varint value=100]
    //
    // Path is REQUIRED for raw QUIC (moqtransport validates it).
    // For WebTransport the path comes from the HTTP URL.
    TArray<uint8> Content;
    uint8 Buf[8];
    int32 Len;

    // 1 supported version
    Len = MoqProtocol::EncodeVarint(1, Buf);
    Content.Append(Buf, Len);
    Len = MoqProtocol::EncodeVarint(MOQ_TRANSPORT_VERSION, Buf);
    Content.Append(Buf, Len);

    // 3 parameters
    Len = MoqProtocol::EncodeVarint(3, Buf);
    Content.Append(Buf, Len);

    // Role = PubSub (0x03). Key 0x00 is even → value is bare varint
    Len = MoqProtocol::EncodeVarint(0x00, Buf);
    Content.Append(Buf, Len);
    Len = MoqProtocol::EncodeVarint(0x03, Buf);
    Content.Append(Buf, Len);

    // Path = "/". Key 0x01 is odd → length-prefixed bytes
    Len = MoqProtocol::EncodeVarint(0x01, Buf);
    Content.Append(Buf, Len);
    Len = MoqProtocol::EncodeVarint(1, Buf); // length of "/"
    Content.Append(Buf, Len);
    Content.Add(0x2F); // '/'

    // MaxSubscribeId = 100. Key 0x02 is even → value is bare varint
    Len = MoqProtocol::EncodeVarint(0x02, Buf);
    Content.Append(Buf, Len);
    Len = MoqProtocol::EncodeVarint(100, Buf);
    Content.Append(Buf, Len);

    TArray<uint8> Message = MoqProtocol::BuildControlMessage(
        EMoqMessageType::ClientSetup, Content);
    SendOnControlStream(Message);
}

void FPanaudiaConnectionManager::AnnounceAndSubscribe()
{
    // Matches the TypeScript client flow:
    // 1. Subscribe to output tracks (audio, state, attributes) — first with JWT auth
    // 2. Announce input tracks (audio, state, control)

    // --- Subscribe to output audio (with JWT authorization) ---
    {
        uint64 ReqId = NextRequestId; NextRequestId += 2;
        TArray<FString> Ns = { TEXT("out"), TEXT("audio"), TEXT("opus-stereo"), NodeId };
        TArray<uint8> Msg = MoqProtocol::BuildSubscribe(
            ReqId, Ns, TEXT(""),
            128, LastConnectionConfig.Ticket);
        PendingSubscribeRequests.Add(ReqId, TEXT("audio_output"));
        SendOnControlStream(Msg);
        UE_LOG(LogTemp, Log, TEXT("SUBSCRIBE audio output (req=%llu)"), ReqId);
    }

    // --- Subscribe to state output ---
    {
        uint64 ReqId = NextRequestId; NextRequestId += 2;
        TArray<FString> Ns = { TEXT("out"), TEXT("state"), NodeId };
        TArray<uint8> Msg = MoqProtocol::BuildSubscribe(
            ReqId, Ns, TEXT(""),
            128, LastConnectionConfig.Ticket);
        PendingSubscribeRequests.Add(ReqId, TEXT("state_output"));
        SendOnControlStream(Msg);
        UE_LOG(LogTemp, Log, TEXT("SUBSCRIBE state output (req=%llu)"), ReqId);
    }

    // --- Subscribe to attributes output ---
    {
        uint64 ReqId = NextRequestId; NextRequestId += 2;
        TArray<FString> Ns = { TEXT("out"), TEXT("attributes"), NodeId };
        TArray<uint8> Msg = MoqProtocol::BuildSubscribe(
            ReqId, Ns, TEXT(""),
            128, LastConnectionConfig.Ticket);
        PendingSubscribeRequests.Add(ReqId, TEXT("attributes_output"));
        SendOnControlStream(Msg);
        UE_LOG(LogTemp, Log, TEXT("SUBSCRIBE attributes output (req=%llu)"), ReqId);
    }

    // --- Announce audio input ---
    {
        uint64 ReqId = NextRequestId; NextRequestId += 2;
        TArray<FString> Ns = { TEXT("in"), TEXT("audio"), TEXT("opus-mono"), NodeId };
        TArray<uint8> Msg = MoqProtocol::BuildAnnounce(ReqId, Ns);
        SendOnControlStream(Msg);
        UE_LOG(LogTemp, Log, TEXT("ANNOUNCE audio input (req=%llu)"), ReqId);
    }

    // --- Announce state ---
    {
        uint64 ReqId = NextRequestId; NextRequestId += 2;
        TArray<FString> Ns = { TEXT("state"), NodeId };
        TArray<uint8> Msg = MoqProtocol::BuildAnnounce(ReqId, Ns);
        SendOnControlStream(Msg);
        UE_LOG(LogTemp, Log, TEXT("ANNOUNCE state (req=%llu)"), ReqId);
    }

    // --- Announce control ---
    {
        uint64 ReqId = NextRequestId; NextRequestId += 2;
        TArray<FString> Ns = { TEXT("in"), TEXT("control"), NodeId };
        TArray<uint8> Msg = MoqProtocol::BuildAnnounce(ReqId, Ns);
        SendOnControlStream(Msg);
        UE_LOG(LogTemp, Log, TEXT("ANNOUNCE control (req=%llu)"), ReqId);
    }
}

void FPanaudiaConnectionManager::SendOnControlStream(const TArray<uint8>& Data)
{
    if (!ControlStream || !MsQuic)
    {
        return;
    }

    // Allocate send buffer with padding to detect overflow.
    // Use calloc to zero-fill (helps detect corruption patterns).
    // QUIC_BUFFER struct is also heap-allocated to ensure it outlives the async send.
    size_t DataLen = (size_t)Data.Num();
    size_t AllocSize = DataLen + 256; // generous padding for diagnostics
    uint8* SendBuf = static_cast<uint8*>(calloc(1, AllocSize));
    if (!SendBuf) return;
    memcpy(SendBuf, Data.GetData(), DataLen);

    // Heap-allocate the QUIC_BUFFER so it survives beyond this stack frame
    QUIC_BUFFER* QuicBufPtr = static_cast<QUIC_BUFFER*>(calloc(1, sizeof(QUIC_BUFFER)));
    if (!QuicBufPtr) { free(SendBuf); return; }
    QuicBufPtr->Buffer = SendBuf;
    QuicBufPtr->Length = (uint32_t)DataLen;

    // Pack both pointers for cleanup: store QuicBufPtr as ClientContext,
    // and SendBuf pointer at a known offset we can retrieve in SEND_COMPLETE
    // Simple approach: use a small struct
    struct SendContext {
        uint8* DataBuf;
        QUIC_BUFFER* QuicBuf;
    };
    SendContext* Ctx = static_cast<SendContext*>(calloc(1, sizeof(SendContext)));
    if (!Ctx) { free(SendBuf); free(QuicBufPtr); return; }
    Ctx->DataBuf = SendBuf;
    Ctx->QuicBuf = QuicBufPtr;

    QUIC_STATUS Status = MsQuic->StreamSend(
        ControlStream,
        QuicBufPtr, 1,
        QUIC_SEND_FLAG_NONE,
        Ctx); // ClientContext → freed in SEND_COMPLETE

    if (QUIC_FAILED(Status))
    {
        UE_LOG(LogTemp, Error, TEXT("StreamSend failed: 0x%x"), Status);
        free(SendBuf);
        free(QuicBufPtr);
        free(Ctx);
    }
}

// ============================================================================
// Control Stream Message Parsing (called from Tick/game thread)
// ============================================================================

void FPanaudiaConnectionManager::ProcessControlStreamData(
    const uint8* Data, int32 Len)
{
    // Message framing: [Type varint][Length 2-byte BE][Content]
    int32 Offset = 0;

    while (Offset < Len)
    {
        // Need at least 3 bytes for minimal header
        if (Len - Offset < 3)
        {
            break;
        }

        // Parse type varint
        int32 TypeBytes = 0;
        uint64 MsgType = MoqProtocol::DecodeVarint(
            Data + Offset, Len - Offset, TypeBytes);
        if (TypeBytes == 0) break;

        int32 HeaderSize = TypeBytes + 2;
        if (Offset + HeaderSize > Len) break;

        // 2-byte big-endian content length
        uint16 ContentLen =
            ((uint16)Data[Offset + TypeBytes] << 8) |
            (uint16)Data[Offset + TypeBytes + 1];

        int32 TotalSize = HeaderSize + (int32)ContentLen;
        if (Offset + TotalSize > Len) break; // incomplete message

        const uint8* Content = Data + Offset + HeaderSize;

        // Dispatch
        switch (MsgType)
        {
        case (uint64)EMoqMessageType::ServerSetup:
            HandleServerSetup(Content, ContentLen);
            break;

        case (uint64)EMoqMessageType::AnnounceOk:
            HandleAnnounceOk(Content, ContentLen);
            break;

        case (uint64)EMoqMessageType::SubscribeOk:
            HandleSubscribeOk(Content, ContentLen);
            break;

        case (uint64)EMoqMessageType::Subscribe:
            HandleIncomingSubscribe(Content, ContentLen);
            break;

        case (uint64)EMoqMessageType::SubscribeAnnounces:
            {
                // Respond with SUBSCRIBE_ANNOUNCES_OK (0x12)
                int32 Br = 0;
                uint64 ReqId = MoqProtocol::DecodeVarint(Content, ContentLen, Br);
                UE_LOG(LogTemp, Log, TEXT("SUBSCRIBE_ANNOUNCES req=%llu → OK"), ReqId);

                TArray<uint8> OkBody;
                uint8 Buf[8];
                int32 BLen = MoqProtocol::EncodeVarint(ReqId, Buf);
                OkBody.Append(Buf, BLen);

                TArray<uint8> Msg = MoqProtocol::BuildControlMessage(
                    EMoqMessageType::SubscribeAnnouncesOk, OkBody);
                SendOnControlStream(Msg);
            }
            break;

        case (uint64)EMoqMessageType::Announce:
            {
                // Server announcing to us → respond ANNOUNCE_OK
                int32 Br = 0;
                uint64 ReqId = MoqProtocol::DecodeVarint(Content, ContentLen, Br);
                UE_LOG(LogTemp, Log, TEXT("Server ANNOUNCE req=%llu → OK"), ReqId);

                TArray<uint8> OkBody;
                uint8 Buf[8];
                int32 BLen = MoqProtocol::EncodeVarint(ReqId, Buf);
                OkBody.Append(Buf, BLen);

                TArray<uint8> Msg = MoqProtocol::BuildControlMessage(
                    EMoqMessageType::AnnounceOk, OkBody);
                SendOnControlStream(Msg);
            }
            break;

        case (uint64)EMoqMessageType::SubscribeError:
            {
                int32 Br = 0;
                uint64 SubId = MoqProtocol::DecodeVarint(Content, ContentLen, Br);
                UE_LOG(LogTemp, Error, TEXT("SUBSCRIBE_ERROR for req=%llu"), SubId);
            }
            break;

        case (uint64)EMoqMessageType::AnnounceError:
            UE_LOG(LogTemp, Error, TEXT("ANNOUNCE_ERROR received"));
            break;

        default:
            UE_LOG(LogTemp, Log, TEXT("Unknown control message: 0x%llx"), MsgType);
            break;
        }

        Offset += TotalSize;
    }

    // Remove consumed bytes
    if (Offset > 0)
    {
        ControlStreamRecvBuffer.RemoveAt(0, Offset);
    }
}

void FPanaudiaConnectionManager::HandleServerSetup(
    const uint8* Content, int32 ContentLen)
{
    int32 Br = 0;
    uint64 Version = MoqProtocol::DecodeVarint(Content, ContentLen, Br);
    UE_LOG(LogTemp, Log, TEXT("SERVER_SETUP version=0x%llx"), Version);

    // Server is ready → subscribe to output tracks and announce input tracks
    AnnounceAndSubscribe();
}

void FPanaudiaConnectionManager::HandleAnnounceOk(
    const uint8* Content, int32 ContentLen)
{
    int32 Br = 0;
    uint64 ReqId = MoqProtocol::DecodeVarint(Content, ContentLen, Br);
    UE_LOG(LogTemp, Log, TEXT("ANNOUNCE_OK req=%llu"), ReqId);
}

void FPanaudiaConnectionManager::HandleSubscribeOk(
    const uint8* Content, int32 ContentLen)
{
    int32 Pos = 0;
    int32 Br = 0;

    uint64 ReqId = MoqProtocol::DecodeVarint(Content + Pos, ContentLen - Pos, Br);
    if (Br == 0) return;
    Pos += Br;

    // TrackAlias assigned by the publisher (server) — draft-11
    uint64 TrackAlias = MoqProtocol::DecodeVarint(Content + Pos, ContentLen - Pos, Br);
    if (Br == 0) return;
    Pos += Br;

    UE_LOG(LogTemp, Log, TEXT("SUBSCRIBE_OK req=%llu trackAlias=%llu"), ReqId, TrackAlias);

    // Store the server-assigned alias for the correct track
    if (FString* TrackType = PendingSubscribeRequests.Find(ReqId))
    {
        if (*TrackType == TEXT("audio_output"))
        {
            AudioOutputTrackAlias = TrackAlias;
            UE_LOG(LogTemp, Log, TEXT("→ Audio output alias = %llu"), TrackAlias);
        }
        else if (*TrackType == TEXT("state_output"))
        {
            StateOutputTrackAlias = TrackAlias;
            UE_LOG(LogTemp, Log, TEXT("→ State output alias = %llu"), TrackAlias);
        }
        else if (*TrackType == TEXT("attributes_output"))
        {
            AttributesTrackAlias = TrackAlias;
            UE_LOG(LogTemp, Log, TEXT("→ Attributes output alias = %llu"), TrackAlias);
        }
        PendingSubscribeRequests.Remove(ReqId);
    }
}

void FPanaudiaConnectionManager::HandleIncomingSubscribe(
    const uint8* Content, int32 ContentLen)
{
    // Parse: RequestID, Namespace tuple, ... (NO TrackAlias in SUBSCRIBE per draft-11)
    int32 Pos = 0;
    int32 Br = 0;

    uint64 RequestId = MoqProtocol::DecodeVarint(Content + Pos, ContentLen - Pos, Br);
    if (Br == 0) return;
    Pos += Br;

    // Assign a local TrackAlias (we are the publisher for these tracks)
    uint64 TrackAlias = NextTrackAlias++;

    // Namespace tuple
    uint64 NsCount = MoqProtocol::DecodeVarint(Content + Pos, ContentLen - Pos, Br);
    if (Br == 0) return;
    Pos += Br;

    TArray<FString> Namespace;
    for (uint64 i = 0; i < NsCount; ++i)
    {
        uint64 PartLen = MoqProtocol::DecodeVarint(Content + Pos, ContentLen - Pos, Br);
        if (Br == 0) return;
        Pos += Br;

        if (Pos + (int32)PartLen > ContentLen) return;

        FUTF8ToTCHAR Conv(
            reinterpret_cast<const char*>(Content + Pos), (int32)PartLen);
        Namespace.Add(FString(Conv.Length(), Conv.Get()));
        Pos += (int32)PartLen;
    }

    FString NsPath = FString::Join(Namespace, TEXT("/"));
    UE_LOG(LogTemp, Log,
        TEXT("Incoming SUBSCRIBE: %s alias=%llu req=%llu"),
        *NsPath, TrackAlias, RequestId);

    // Send SUBSCRIBE_OK with our assigned TrackAlias
    TArray<uint8> OkMsg = MoqProtocol::BuildSubscribeOk(RequestId, TrackAlias);
    SendOnControlStream(OkMsg);

    // Map track alias to our track type
    if (NsPath.Contains(TEXT("in/audio")))
    {
        AudioInputTrackAlias = TrackAlias;
        bAudioAliasAssigned = true;
        UE_LOG(LogTemp, Log, TEXT("→ Audio input alias = %llu"), TrackAlias);
    }
    else if (NsPath.Contains(TEXT("state/")) && !NsPath.Contains(TEXT("out/state")))
    {
        StateTrackAlias = TrackAlias;
        bStateAliasAssigned = true;
        UE_LOG(LogTemp, Log, TEXT("→ State alias = %llu"), TrackAlias);
    }
    else if (NsPath.Contains(TEXT("in/control")))
    {
        ControlTrackAlias = TrackAlias;
        bControlAliasAssigned = true;
        UE_LOG(LogTemp, Log, TEXT("→ Control alias = %llu"), TrackAlias);
    }

    // Transition to DataConnected once we have the audio alias
    if (bAudioAliasAssigned)
    {
        SetConnectionStatus(EPanaudiaConnectionStatus::DataConnected,
            TEXT("MOQ data channels ready"));

        if (bIsReconnecting)
        {
            UE_LOG(LogTemp, Log, TEXT("Reconnection successful"));
            ResetReconnectionState();
        }
    }
}

// ============================================================================
// Datagram Sending
// ============================================================================

void FPanaudiaConnectionManager::SendDatagram(const TArray<uint8>& Data)
{
    SendDatagramDirect(Data.GetData(), Data.Num());
}

void FPanaudiaConnectionManager::SendDatagramDirect(const uint8* Data, int32 Len)
{
    if (!MsQuic || !QuicConnection || Len <= 0)
    {
        return;
    }

    // Single allocation: [QUIC_BUFFER][payload bytes]
    // msquic frees the context asynchronously on its own thread,
    // so we must heap-allocate. The DATAGRAM_SEND_STATE_CHANGED handler
    // calls free() on this single block.
    size_t TotalSize = sizeof(QUIC_BUFFER) + (size_t)Len;
    uint8_t* Block = (uint8_t*)malloc(TotalSize);
    if (!Block) return;

    QUIC_BUFFER* QB = (QUIC_BUFFER*)Block;
    QB->Buffer = Block + sizeof(QUIC_BUFFER);
    QB->Length = (uint32_t)Len;
    memcpy(QB->Buffer, Data, Len);

    QUIC_STATUS Status = MsQuic->DatagramSend(
        QuicConnection, QB, 1,
        QUIC_SEND_FLAG_NONE, Block);

    if (QUIC_FAILED(Status))
    {
        free(Block);
    }
}

void FPanaudiaConnectionManager::SendStateUpdate(const FPanaudiaNodeState& State)
{
    if (!bStateAliasAssigned)
    {
        return;
    }

    // Build NodeInfo3 binary (48 bytes, little-endian, matching encoding.ts)
    TArray<uint8> NodeInfo;
    NodeInfo.SetNum(NODE_INFO3_SIZE);
    uint8* Ptr = NodeInfo.GetData();

    // UUID (bytes 0-15)
    if (!UuidStringToBytes(NodeId, Ptr))
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to encode NodeId as UUID bytes"));
        return;
    }
    Ptr += 16;

    // Position (bytes 16-27, float32 LE)
    float PosX = State.X;
    float PosY = State.Y;
    float PosZ = State.Z;
    FMemory::Memcpy(Ptr, &PosX, 4); Ptr += 4;
    FMemory::Memcpy(Ptr, &PosY, 4); Ptr += 4;
    FMemory::Memcpy(Ptr, &PosZ, 4); Ptr += 4;

    // Rotation (bytes 28-39, float32 LE)
    float RotYaw = State.Yaw;
    float RotPitch = State.Pitch;
    float RotRoll = State.Roll;
    FMemory::Memcpy(Ptr, &RotYaw, 4); Ptr += 4;
    FMemory::Memcpy(Ptr, &RotPitch, 4); Ptr += 4;
    FMemory::Memcpy(Ptr, &RotRoll, 4); Ptr += 4;

    // Volume (bytes 40-43)
    float Volume = 1.0f;
    FMemory::Memcpy(Ptr, &Volume, 4); Ptr += 4;

    // Gone flag (bytes 44-47)
    int32 Gone = 0;
    FMemory::Memcpy(Ptr, &Gone, 4);

    // Wrap as MOQ Object Datagram
    TArray<uint8> Datagram = MoqProtocol::BuildObjectDatagram(
        StateTrackAlias,
        0,               // GroupID
        StateObjectId++,
        1,               // Priority (lower than audio)
        NodeInfo.GetData(),
        NodeInfo.Num());

    SendDatagram(Datagram);
}

void FPanaudiaConnectionManager::SendControlMessage(
    const FString& Type, const TSharedPtr<FJsonObject>& MessageData)
{
    if (!bControlAliasAssigned)
    {
        return;
    }

    TSharedPtr<FJsonObject> Json = MakeShared<FJsonObject>();
    Json->SetStringField(TEXT("type"), Type);

    if (MessageData.IsValid())
    {
        for (const auto& Pair : MessageData->Values)
        {
            Json->SetField(Pair.Key, Pair.Value);
        }
    }

    FString JsonString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonString);
    FJsonSerializer::Serialize(Json.ToSharedRef(), Writer);

    FTCHARToUTF8 UTF8(*JsonString);

    TArray<uint8> Datagram = MoqProtocol::BuildObjectDatagram(
        ControlTrackAlias,
        0,
        ControlObjectId++,
        2, // Lower priority
        reinterpret_cast<const uint8*>(UTF8.Get()),
        UTF8.Length());

    SendDatagram(Datagram);
}

// ============================================================================
// Datagram Processing (called from Tick/game thread)
// ============================================================================

void FPanaudiaConnectionManager::ProcessPendingDatagrams()
{
    std::vector<uint8_t> RawDatagram;

    for (;;)
    {
        {
            std::lock_guard<std::mutex> Lock(DatagramMutex);
            if (PendingDatagrams.empty()) break;
            RawDatagram = std::move(PendingDatagrams.front());
            PendingDatagrams.pop();
        }

        uint64 TrackAlias, GroupID, ObjectID;
        uint8 Priority;
        const uint8* Payload;
        int32 PayloadLen;

        if (!MoqProtocol::ParseObjectDatagram(
                RawDatagram.data(), (int32)RawDatagram.size(),
                TrackAlias, GroupID, ObjectID,
                Priority, Payload, PayloadLen))
        {
            continue;
        }

        // Audio datagrams are decoded inline on msquic thread (never queued here)
        if (TrackAlias == StateOutputTrackAlias)
        {
            OnStateDataReceived(Payload, PayloadLen);
        }
        else if (TrackAlias == AttributesTrackAlias)
        {
            OnAttributesDataReceived(Payload, PayloadLen);
        }
    }
}

void FPanaudiaConnectionManager::OnStateDataReceived(
    const uint8* Payload, int32 PayloadLen)
{
    if (PayloadLen < NODE_INFO3_SIZE) return;

    // Parse NodeInfo3 (skip UUID at bytes 0-15)
    float X, Y, Z, Yaw, Pitch, Roll;
    FMemory::Memcpy(&X,     Payload + 16, 4);
    FMemory::Memcpy(&Y,     Payload + 20, 4);
    FMemory::Memcpy(&Z,     Payload + 24, 4);
    FMemory::Memcpy(&Yaw,   Payload + 28, 4);
    FMemory::Memcpy(&Pitch, Payload + 32, 4);
    FMemory::Memcpy(&Roll,  Payload + 36, 4);

    FPanaudiaNodeState State;
    State.X = X;
    State.Y = Y;
    State.Z = Z;
    State.Yaw = Yaw;
    State.Pitch = Pitch;
    State.Roll = Roll;

    OnNodeStateReceived.Broadcast(State);
}

void FPanaudiaConnectionManager::OnAttributesDataReceived(
    const uint8* Payload, int32 PayloadLen)
{
    if (PayloadLen <= 0) return;

    FUTF8ToTCHAR Conv(
        reinterpret_cast<const char*>(Payload), PayloadLen);
    FString JsonString(Conv.Length(), Conv.Get());

    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);

    if (FJsonSerializer::Deserialize(Reader, JsonObject) && JsonObject.IsValid())
    {
        TMap<FString, FString> Attributes;
        for (const auto& Pair : JsonObject->Values)
        {
            if (Pair.Value->Type == EJson::String)
            {
                Attributes.Add(Pair.Key, Pair.Value->AsString());
            }
        }

        OnAttributesReceived.Broadcast(Attributes);
    }
}

// ============================================================================
// Audio Data Handling
// ============================================================================

void FPanaudiaConnectionManager::SubmitAudioData(
    const float* AudioData, int32 NumSamples,
    int32 NumChannels, int32 SampleRate)
{
    if (!OpusEncoder || !OpusEncoder->IsInitialized()) return;
    if (!bAudioAliasAssigned) return;
    if (!MsQuic || !QuicConnection) return;

    const int32 FrameSize = 240; // 5ms at 48kHz

    // Stereo→mono into pre-allocated MonoBuffer (no allocation)
    const float* ProcessData = AudioData;
    if (NumChannels > 1)
    {
        for (int32 i = 0; i < NumSamples; ++i)
        {
            float Sum = 0.0f;
            for (int32 ch = 0; ch < NumChannels; ++ch)
            {
                Sum += AudioData[i * NumChannels + ch];
            }
            MonoBuffer[i] = Sum / NumChannels;
        }
        ProcessData = MonoBuffer;
    }

    // Accumulate in bulk and encode when 240 samples ready
    int32 Remaining = NumSamples;
    int32 SrcOffset = 0;

    while (Remaining > 0)
    {
        int32 Space = FrameSize - AccumulatedSamples;
        int32 ToCopy = (Remaining < Space) ? Remaining : Space;

        memcpy(AccumulationBuffer + AccumulatedSamples,
               ProcessData + SrcOffset,
               ToCopy * sizeof(float));
        AccumulatedSamples += ToCopy;
        SrcOffset += ToCopy;
        Remaining -= ToCopy;

        if (AccumulatedSamples >= FrameSize)
        {
            // Encode into pre-allocated buffer (no allocation)
            int32 EncodedBytes = OpusEncoder->Encode(
                AccumulationBuffer, FrameSize,
                EncodeOutputBuffer, sizeof(EncodeOutputBuffer));

            if (EncodedBytes > 0)
            {
                // Build MOQ datagram header + payload inline (no allocation)
                int32 DgOffset = 0;

                // Type = 0x00 (Object Datagram)
                DgOffset += MoqProtocol::EncodeVarint(0x00, DatagramBuffer + DgOffset);
                // TrackAlias
                DgOffset += MoqProtocol::EncodeVarint(AudioInputTrackAlias, DatagramBuffer + DgOffset);
                // GroupID = 0
                DgOffset += MoqProtocol::EncodeVarint(0, DatagramBuffer + DgOffset);
                // ObjectID
                DgOffset += MoqProtocol::EncodeVarint(AudioObjectId++, DatagramBuffer + DgOffset);
                // Priority = 0 (highest)
                DatagramBuffer[DgOffset++] = 0;
                // Payload
                memcpy(DatagramBuffer + DgOffset, EncodeOutputBuffer, EncodedBytes);
                DgOffset += EncodedBytes;

                // Single malloc for msquic async send
                SendDatagramDirect(DatagramBuffer, DgOffset);
            }
            // else: encode failed — Opus DTX may produce 0 bytes for silence

            AccumulatedSamples = 0;
        }
    }
}

// GetReceivedAudioData and ProcessIncomingAudio removed —
// audio is now decoded inline on the msquic thread and read directly
// by UPanaudiaProceduralSound::OnGeneratePCMAudio on the audio render thread.

// ============================================================================
// Position Updates
// ============================================================================

void FPanaudiaConnectionManager::UpdatePosition(
    const FVector& Position, const FRotator& Rotation, float WorldExtent)
{
    FPanaudiaNodeState State = FPanaudiaNodeState::FromUnrealCoordinates(
        Position, Rotation, WorldExtent);
    UpdateAmbisonicPosition(State);
}

void FPanaudiaConnectionManager::UpdateAmbisonicPosition(
    const FPanaudiaNodeState& State)
{
    SendStateUpdate(State);
}

// ============================================================================
// Audio Control (Mute/Unmute via control datagram)
// ============================================================================

void FPanaudiaConnectionManager::Mute(const FString& TargetNodeId)
{
    TSharedPtr<FJsonObject> Data = MakeShareable(new FJsonObject());
    Data->SetStringField(TEXT("node"), TargetNodeId);
    SendControlMessage(TEXT("mute"), Data);
}

void FPanaudiaConnectionManager::Unmute(const FString& TargetNodeId)
{
    TSharedPtr<FJsonObject> Data = MakeShareable(new FJsonObject());
    Data->SetStringField(TEXT("node"), TargetNodeId);
    SendControlMessage(TEXT("unmute"), Data);
}

// ============================================================================
// Connection Helpers
// ============================================================================

void FPanaudiaConnectionManager::SetConnectionStatus(
    EPanaudiaConnectionStatus NewStatus, const FString& Message)
{
    if (CurrentStatus != NewStatus)
    {
        CurrentStatus = NewStatus;
        LastErrorMessage = Message;

        OnConnectionStatusChanged.Broadcast(NewStatus, Message);

        UE_LOG(LogTemp, Log, TEXT("Status: %d - %s"), (int)NewStatus, *Message);
    }
}

void FPanaudiaConnectionManager::HandleConnectionLost(const FString& Reason)
{
    if (bIsManualDisconnect) return;

    if (!bAutoReconnectEnabled)
    {
        SetConnectionStatus(EPanaudiaConnectionStatus::Error, Reason);
        return;
    }

    if (!bHasConnectionConfig) return;

    if (MaxReconnectAttempts > 0 && ReconnectAttemptCount >= MaxReconnectAttempts)
    {
        SetConnectionStatus(EPanaudiaConnectionStatus::Error,
            FString::Printf(TEXT("Max reconnect attempts reached: %s"), *Reason));
        ResetReconnectionState();
        return;
    }

    bIsReconnecting = true;
    CurrentReconnectDelay = CalculateReconnectDelay();
    ReconnectTimer = CurrentReconnectDelay;

    UE_LOG(LogTemp, Warning,
        TEXT("Connection lost: %s. Reconnect #%d in %.1fs"),
        *Reason, ReconnectAttemptCount + 1, CurrentReconnectDelay);

    SetConnectionStatus(EPanaudiaConnectionStatus::Error,
        FString::Printf(TEXT("Reconnecting in %.1fs..."), CurrentReconnectDelay));
}

void FPanaudiaConnectionManager::AttemptReconnect()
{
    if (!bIsReconnecting || !bHasConnectionConfig) return;

    ReconnectAttemptCount++;
    UE_LOG(LogTemp, Log, TEXT("Reconnect attempt #%d"), ReconnectAttemptCount);

    CleanupQuic();
    Connect(LastConnectionConfig);
}

void FPanaudiaConnectionManager::ResetReconnectionState()
{
    bIsReconnecting = false;
    ReconnectAttemptCount = 0;
    ReconnectTimer = 0.0f;
    CurrentReconnectDelay = 0.0f;
}

float FPanaudiaConnectionManager::CalculateReconnectDelay() const
{
    float Delay = ReconnectBaseDelay
        * FMath::Pow(2.0f, FMath::Min(ReconnectAttemptCount, 5));
    Delay = FMath::Min(Delay, 60.0f);
    float Jitter = FMath::RandRange(-0.2f, 0.2f) * Delay;
    return Delay + Jitter;
}

// ============================================================================
// Auto-reconnect Settings
// ============================================================================

void FPanaudiaConnectionManager::SetAutoReconnectEnabled(bool bEnabled)
{
    bAutoReconnectEnabled = bEnabled;
}

void FPanaudiaConnectionManager::SetMaxReconnectAttempts(int32 MaxAttempts)
{
    MaxReconnectAttempts = FMath::Max(0, MaxAttempts);
}

void FPanaudiaConnectionManager::SetReconnectBaseDelay(float DelaySeconds)
{
    ReconnectBaseDelay = FMath::Max(0.5f, DelaySeconds);
}

// ============================================================================
// Jitter Buffer Settings
// ============================================================================

void FPanaudiaConnectionManager::SetJitterBufferEnabled(bool bEnabled)
{
    if (JitterBuffer) JitterBuffer->SetAdaptiveMode(bEnabled);
}

void FPanaudiaConnectionManager::SetJitterBufferRange(
    int32 MinMs, int32 MaxMs, int32 TargetMs)
{
    if (JitterBuffer) JitterBuffer->SetJitterBufferRange(MinMs, MaxMs, TargetMs);
}

FJitterBufferStats FPanaudiaConnectionManager::GetJitterBufferStats() const
{
    return JitterBuffer ? JitterBuffer->GetStats() : FJitterBufferStats();
}

float FPanaudiaConnectionManager::GetCurrentAudioLatency() const
{
    return JitterBuffer ? JitterBuffer->GetCurrentLatencyMs() : 0.0f;
}

// ============================================================================
// FTickableGameObject — Game Thread
//
// This is where all queued msquic events are processed safely with UE APIs.
// ============================================================================

void FPanaudiaConnectionManager::Tick(float DeltaTime)
{
    // --- Process pending connection events from msquic callbacks ---

    if (bPendingConnected.exchange(false))
    {
        UE_LOG(LogTemp, Log, TEXT("QUIC connected"));
        SetConnectionStatus(EPanaudiaConnectionStatus::Connected, TEXT("QUIC connected"));
        StartMoqSession();
    }

    if (bPendingTransportShutdown.exchange(false))
    {
        UE_LOG(LogTemp, Warning, TEXT("QUIC transport shutdown"));
        if (!bIsManualDisconnect)
        {
            HandleConnectionLost(TEXT("Transport shutdown"));
        }
    }

    if (bPendingPeerShutdown.exchange(false))
    {
        UE_LOG(LogTemp, Warning, TEXT("QUIC peer shutdown"));
        if (!bIsManualDisconnect)
        {
            HandleConnectionLost(TEXT("Peer shutdown"));
        }
    }

    // --- Process incoming control stream data ---
    {
        std::vector<uint8_t> Chunk;
        for (;;)
        {
            {
                std::lock_guard<std::mutex> Lock(ControlDataMutex);
                if (PendingControlData.empty()) break;
                Chunk = std::move(PendingControlData.front());
                PendingControlData.pop();
            }

            // Append to UE-side receive buffer
            ControlStreamRecvBuffer.Append(Chunk.data(), (int32)Chunk.size());
        }

        // Parse complete messages
        if (ControlStreamRecvBuffer.Num() > 0)
        {
            ProcessControlStreamData(
                ControlStreamRecvBuffer.GetData(),
                ControlStreamRecvBuffer.Num());
        }
    }

    // --- Process incoming datagrams (state, attributes only — audio decoded on msquic thread) ---
    ProcessPendingDatagrams();

    // --- Flush queued outgoing datagrams ---
    if (MsQuic && QuicConnection)
    {
        TArray<uint8> QueuedData;
        while (OutgoingDatagramQueue.Dequeue(QueuedData))
        {
            SendDatagramDirect(QueuedData.GetData(), QueuedData.Num());
        }
    }

    // --- Reconnection timer ---
    if (bIsReconnecting && ReconnectTimer > 0.0f)
    {
        ReconnectTimer -= DeltaTime;
        if (ReconnectTimer <= 0.0f)
        {
            AttemptReconnect();
        }
    }
}

TStatId FPanaudiaConnectionManager::GetStatId() const
{
    RETURN_QUICK_DECLARE_CYCLE_STAT(FPanaudiaConnectionManager, STATGROUP_Tickables);
}
