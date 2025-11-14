
#include "PanaudiaConnectionManager.h"

#include "CoreMinimal.h"
#include "PanaudiaOpusEncoder.h"
#include "PanaudiaOpusDecoder.h"
#include "WebSocketsModule.h"
#include "IWebSocket.h"
#include "Json.h"
#include "JsonUtilities.h"
#include "Misc/Base64.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Async/Async.h"



// libdatachannel includes
#include "rtc/rtc.hpp"

class FJsonObject;

FPanaudiaConnectionManager::FPanaudiaConnectionManager()
    : CurrentStatus(EPanaudiaConnectionStatus::Disconnected)
    , LastErrorMessage()
    , bIsDataChannelOpen(false)
    , StatusLock()
    , bAutoReconnectEnabled(true)
    , bIsManualDisconnect(false)
    , bIsReconnecting(false)
    , ReconnectAttemptCount(0)
    , MaxReconnectAttempts(10)
    , ReconnectBaseDelay(2.0f)
    , ReconnectTimer(0.0f)
    , CurrentReconnectDelay(0.0f)
    , LastConnectionConfig()
    , bHasConnectionConfig(false)
    , OpusEncoder(nullptr)
    , OpusDecoder(nullptr)
    , PCMAccumulationBuffer()
    , AccumulatedSamples(0)
    , JitterBuffer(nullptr)
{
    UE_LOG(LogTemp, Log, TEXT("PanaudiaConnectionManager created with auto-reconnect enabled"));
    InitializeAudioCodecs();
    InitializeJitterBuffer();
}

void FPanaudiaConnectionManager::InitializeJitterBuffer()
{
    JitterBuffer = new FPanaudiaJitterBuffer();
    JitterBuffer->Initialize(20, 200, 60, 48000); // Min=20ms, Max=200ms, Target=60ms
    UE_LOG(LogTemp, Log, TEXT("Jitter buffer initialized"));
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

void FPanaudiaConnectionManager::InitializeAudioCodecs()
{
    // Initialize Opus encoder (mono 48kHz for microphone input)
    OpusEncoder = new FPanaudiaOpusEncoder();
    if (!OpusEncoder->Initialize(48000, 1, 2048)) // VOIP application
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to initialize Opus encoder"));
        delete OpusEncoder;
        OpusEncoder = nullptr;
    }
    else
    {
        // Configure for voice chat
        OpusEncoder->SetBitrate(64000);  // 64 kbps
        OpusEncoder->SetComplexity(5);   // Medium complexity
        OpusEncoder->SetDTX(true);       // Enable DTX for bandwidth savings
        UE_LOG(LogTemp, Log, TEXT("Opus encoder initialized"));
    }

    // Initialize Opus decoder (stereo 48kHz for binaural output)
    OpusDecoder = new FPanaudiaOpusDecoder();
    if (!OpusDecoder->Initialize(48000, 2)) // Stereo
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to initialize Opus decoder"));
        delete OpusDecoder;
        OpusDecoder = nullptr;
    }
    else
    {
        UE_LOG(LogTemp, Log, TEXT("Opus decoder initialized"));
    }

    // Pre-allocate accumulation buffer (20ms frame = 960 samples at 48kHz)
    PCMAccumulationBuffer.Reserve(960);
}

void FPanaudiaConnectionManager::CleanupAudioCodecs()
{
    if (OpusEncoder)
    {
        delete OpusEncoder;
        OpusEncoder = nullptr;
    }

    if (OpusDecoder)
    {
        delete OpusDecoder;
        OpusDecoder = nullptr;
    }
}

void FPanaudiaConnectionManager::SetAutoReconnectEnabled(bool bEnabled)
{
    bAutoReconnectEnabled = bEnabled;
    UE_LOG(LogTemp, Log, TEXT("Auto-reconnect %s"), bEnabled ? TEXT("enabled") : TEXT("disabled"));
}

void FPanaudiaConnectionManager::SetMaxReconnectAttempts(int32 MaxAttempts)
{
    MaxReconnectAttempts = FMath::Max(0, MaxAttempts);
    UE_LOG(LogTemp, Log, TEXT("Max reconnect attempts set to: %d"), MaxReconnectAttempts);
}

void FPanaudiaConnectionManager::SetReconnectBaseDelay(float DelaySeconds)
{
    ReconnectBaseDelay = FMath::Max(0.5f, DelaySeconds);
    UE_LOG(LogTemp, Log, TEXT("Reconnect base delay set to: %.2f seconds"), ReconnectBaseDelay);
}

void FPanaudiaConnectionManager::Connect(const FPanaudiaConnectionConfig& Config)
{
    UE_LOG(LogTemp, Log, TEXT("Connecting to Panaudia with ticket: %s"), *Config.Ticket);

    // Store config for reconnection
    LastConnectionConfig = Config;
    bHasConnectionConfig = true;
    bIsManualDisconnect = false;
    ResetReconnectionState();

    // First, lookup the WebSocket URL from the entrance server
    TSharedRef<IHttpRequest> HttpRequest = FHttpModule::Get().CreateRequest();
    HttpRequest->SetURL(Config.EntranceURL + TEXT("?ticket=") + Config.Ticket);
    HttpRequest->SetVerb(TEXT("GET"));

    HttpRequest->OnProcessRequestComplete().BindLambda([this, Config](
        FHttpRequestPtr Request,
        FHttpResponsePtr Response,
        bool bWasSuccessful)
    {
        if (bWasSuccessful && Response.IsValid())
        {
            FString ResponseStr = Response->GetContentAsString();
            TSharedPtr<FJsonObject> JsonObject;
            TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(ResponseStr);

            if (FJsonSerializer::Deserialize(Reader, JsonObject) && JsonObject.IsValid())
            {
                FString Status = JsonObject->GetStringField(TEXT("status"));
                if (Status == TEXT("ok"))
                {
                    FString ServerURL = JsonObject->GetStringField(TEXT("url"));
                    FString FullURL = BuildConnectionURL(Config, ServerURL);
                    ConnectDirect(FullURL, Config);
                }
                else
                {
                    SetConnectionStatus(EPanaudiaConnectionStatus::Error, TEXT("Entrance lookup failed"));
                    HandleConnectionLost(TEXT("Entrance lookup failed"));
                }
            }
        }
        else
        {
            SetConnectionStatus(EPanaudiaConnectionStatus::Error, TEXT("Failed to contact entrance server"));
            HandleConnectionLost(TEXT("Failed to contact entrance server"));
        }
    });

    HttpRequest->ProcessRequest();
}

void FPanaudiaConnectionManager::ConnectDirect(const FString& DirectURL, const FPanaudiaConnectionConfig& Config)
{
    UE_LOG(LogTemp, Log, TEXT("Connecting directly to: %s"), *DirectURL);

    WebSocketURL = DirectURL;

    // Store config for reconnection
    LastConnectionConfig = Config;
    bHasConnectionConfig = true;
    bIsManualDisconnect = false;

    // Initialize WebRTC peer connection first
    InitializePeerConnection();

    // Setup audio track
    SetupAudioTrack();

    // Connect WebSocket for signaling
    SetConnectionStatus(EPanaudiaConnectionStatus::Connecting, TEXT("Connecting"));

    if (!FModuleManager::Get().IsModuleLoaded("WebSockets"))
    {
        FModuleManager::Get().LoadModule("WebSockets");
    }

    WebSocket = FWebSocketsModule::Get().CreateWebSocket(DirectURL);

    WebSocket->OnConnected().AddRaw(this, &FPanaudiaConnectionManager::OnWebSocketConnected);
    WebSocket->OnConnectionError().AddRaw(this, &FPanaudiaConnectionManager::OnWebSocketConnectionError);
    WebSocket->OnClosed().AddRaw(this, &FPanaudiaConnectionManager::OnWebSocketClosed);
    WebSocket->OnMessage().AddRaw(this, &FPanaudiaConnectionManager::OnWebSocketMessage);

    WebSocket->Connect();
}

void FPanaudiaConnectionManager::Disconnect()
{
    UE_LOG(LogTemp, Log, TEXT("Manual disconnect from Panaudia"));

    bIsManualDisconnect = true;
    bIsReconnecting = false;
    ResetReconnectionState();

    CleanupWebSocket();
    CleanupWebRTC();

    SetConnectionStatus(EPanaudiaConnectionStatus::Disconnected, TEXT("Disconnected"));
}

void FPanaudiaConnectionManager::InitializePeerConnection()
{
    try
    {
        rtc::Configuration Config;

        // Add STUN servers (matching connection.js)
        Config.iceServers.emplace_back("stun:stun.l.google.com:19302");
        Config.iceServers.emplace_back("stun:stun.l.google.com:5349");
        Config.iceServers.emplace_back("stun:stun1.l.google.com:3478");

        PeerConnection = std::make_shared<rtc::PeerConnection>(Config);

            // Set up ICE candidate callback
            PeerConnection->onLocalCandidate([this](rtc::Candidate Candidate)
            {
                // Send ICE candidate via WebSocket
                // Note: libdatachannel's Candidate API varies by version
                // The candidate string already contains all necessary information
                FString CandidateStr = FString(UTF8_TO_TCHAR(Candidate.candidate().c_str()));
                FString MidStr = FString(UTF8_TO_TCHAR(Candidate.mid().c_str()));

                // Build JSON manually since sdpMLineIndex might not be available
                TSharedPtr<FJsonObject> CandidateObj = MakeShared<FJsonObject>();
                CandidateObj->SetStringField(TEXT("candidate"), CandidateStr);
                CandidateObj->SetStringField(TEXT("sdpMid"), MidStr);
                // sdpMLineIndex is optional and often not needed by the server
                CandidateObj->SetNumberField(TEXT("sdpMLineIndex"), 0);

                FString CandidateJson;
                TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&CandidateJson);
                FJsonSerializer::Serialize(CandidateObj.ToSharedRef(), Writer);

                SendICECandidate(CandidateJson);
            });

        // Set up gathering state callback
        PeerConnection->onGatheringStateChange([this](rtc::PeerConnection::GatheringState State)
        {
            UE_LOG(LogTemp, Log, TEXT("ICE Gathering State: %d"), (int)State);
        });

        // Handle incoming data channels from server
    PeerConnection->onDataChannel([this](std::shared_ptr<rtc::DataChannel> Channel)
    {
        // Convert std::string to FString at boundary
        FString ChannelLabel = FString(UTF8_TO_TCHAR(Channel->label().c_str()));

        UE_LOG(LogTemp, Log, TEXT("Panaudia: Data channel opened: %s"), *ChannelLabel);

        if (ChannelLabel == TEXT("state"))
        {
            StateChannel = Channel;

            // Set up message handler with boundary conversion
            Channel->onMessage([this](std::variant<rtc::binary, rtc::string> Data)
            {
                if (std::holds_alternative<rtc::binary>(Data))
                {
                    const auto& BinaryData = std::get<rtc::binary>(Data);

                    // Convert std::vector<std::byte> to std::vector<std::byte> view for our handler
                    OnStateChannelMessage(BinaryData);
                }
            });

            Channel->onOpen([this]() { OnStateChannelOpen(); });
        }
        else if (ChannelLabel == TEXT("control"))
        {
            ControlChannel = Channel;

            // Set up message handler with boundary conversion
            Channel->onMessage([this](std::variant<rtc::binary, rtc::string> Data)
            {
                if (std::holds_alternative<rtc::string>(Data))
                {
                    const auto& StringData = std::get<rtc::string>(Data);
                    OnControlChannelMessage(StringData);
                }
            });

            Channel->onOpen([this]() { OnControlChannelOpen(); });
        }
        else if (ChannelLabel == TEXT("attributes"))
        {
            AttributesChannel = Channel;

            // Set up message handler with boundary conversion
            Channel->onMessage([this](std::variant<rtc::binary, rtc::string> Data)
            {
                if (std::holds_alternative<rtc::string>(Data))
                {
                    const auto& StringData = std::get<rtc::string>(Data);
                    OnAttributesChannelMessage(StringData);
                }
            });

            Channel->onOpen([this]() { OnAttributesChannelOpen(); });
        }
    });

        // Handle incoming tracks (audio from server)
        PeerConnection->onTrack([this](std::shared_ptr<rtc::Track> Track)
        {
            UE_LOG(LogTemp, Log, TEXT("Received audio track"));

            Track->onMessage([this](auto Data)
            {
                if (std::holds_alternative<std::vector<std::byte>>(Data))
                {
                    OnAudioTrackMessage(std::get<std::vector<std::byte>>(Data));
                }
            });
        });

        UE_LOG(LogTemp, Log, TEXT("WebRTC PeerConnection initialized"));
    }
    catch (const std::exception& e)
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to initialize PeerConnection: %s"), *FString(e.what()));
        SetConnectionStatus(EPanaudiaConnectionStatus::Error, TEXT("Failed to initialize WebRTC"));
    }
}

void FPanaudiaConnectionManager::SetupAudioTrack()
{
    try
    {
        if (!PeerConnection)
        {
            UE_LOG(LogTemp, Error, TEXT("Cannot setup audio track: PeerConnection is null"));
            return;
        }

        // Add audio track - API may vary by version
        rtc::Description::Audio AudioDescription("audio", rtc::Description::Direction::SendRecv);
        AudioDescription.addOpusCodec(111);  // Opus codec with payload type 111

        // SSRC addition API might differ - wrap in try-catch
        try
        {
            AudioDescription.addSSRC(1, "panaudia-audio");
        }
        catch (const std::exception& e)
        {
            UE_LOG(LogTemp, Warning, TEXT("Could not add SSRC (API version): %s"), *FString(e.what()));
            // Continue anyway - SSRC is often optional
        }

        AudioTrack = PeerConnection->addTrack(AudioDescription);

        AudioTrack->onOpen([this]() { OnAudioTrackOpen(); });

        // Handle incoming audio data
        AudioTrack->onMessage([this](auto Data)
        {
            if (std::holds_alternative<std::vector<std::byte>>(Data))
            {
                OnAudioTrackMessage(std::get<std::vector<std::byte>>(Data));
            }
        });

        UE_LOG(LogTemp, Log, TEXT("Audio track added to PeerConnection"));
    }
    catch (const std::exception& e)
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to setup audio track: %s"), *FString(e.what()));
    }
}

void FPanaudiaConnectionManager::CreateAnswer(const FString& OfferSDP)
{
    try
    {
        if (!PeerConnection)
        {
            UE_LOG(LogTemp, Error, TEXT("Cannot create answer: PeerConnection is null"));
            return;
        }

        // Set remote description (the offer)
        rtc::Description Offer(std::string(TCHAR_TO_UTF8(*OfferSDP)), rtc::Description::Type::Offer);
        PeerConnection->setRemoteDescription(Offer);

        UE_LOG(LogTemp, Log, TEXT("Remote description (offer) set"));

        // The answer will be created automatically by libdatachannel
        PeerConnection->onLocalDescription([this](rtc::Description Description)
        {
            std::string SDP = Description.generateSdp();
            FString SDPString = FString(UTF8_TO_TCHAR(SDP.c_str()));

            // Modify SDP to enable stereo (matches JavaScript implementation)
            SDPString = SDPString.Replace(TEXT("a=fmtp:111 "), TEXT("a=fmtp:111 stereo=1; sprop-stereo=1; "));

            // Send answer via WebSocket
            TSharedPtr<FJsonObject> AnswerObj = MakeShared<FJsonObject>();
            AnswerObj->SetStringField(TEXT("type"), TEXT("answer"));
            AnswerObj->SetStringField(TEXT("sdp"), SDPString);

            FString AnswerJson;
            TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&AnswerJson);
            FJsonSerializer::Serialize(AnswerObj.ToSharedRef(), Writer);

            // Wrap in event message
            TSharedPtr<FJsonObject> EventObj = MakeShared<FJsonObject>();
            EventObj->SetStringField(TEXT("event"), TEXT("answer"));
            EventObj->SetStringField(TEXT("data"), AnswerJson);

            FString EventJson;
            TSharedRef<TJsonWriter<>> EventWriter = TJsonWriterFactory<>::Create(&EventJson);
            FJsonSerializer::Serialize(EventObj.ToSharedRef(), EventWriter);

            if (WebSocket && WebSocket->IsConnected())
            {
                WebSocket->Send(EventJson);
                UE_LOG(LogTemp, Log, TEXT("Sent answer"));
            }
        });
    }
    catch (const std::exception& e)
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to create answer: %s"), *FString(e.what()));
    }
}

void FPanaudiaConnectionManager::SendICECandidate(const FString& CandidateJson)
{
    if (WebSocket && WebSocket->IsConnected())
    {
        TSharedPtr<FJsonObject> EventObj = MakeShareable(new FJsonObject());
        EventObj->SetStringField(TEXT("event"), TEXT("candidate"));
        EventObj->SetStringField(TEXT("data"), CandidateJson);

        FString EventJson;
        TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&EventJson);
        FJsonSerializer::Serialize(EventObj.ToSharedRef(), Writer);

        WebSocket->Send(EventJson);
        UE_LOG(LogTemp, Verbose, TEXT("Sent ICE candidate"));
    }
}

// WebSocket Handlers

// When connection succeeds, reset reconnection state
void FPanaudiaConnectionManager::OnWebSocketConnected()
{
    UE_LOG(LogTemp, Log, TEXT("WebSocket connected"));

    // Reset reconnection state on successful connection
    if (bIsReconnecting)
    {
        UE_LOG(LogTemp, Log, TEXT("Reconnection successful!"));
        ResetReconnectionState();
    }
}

void FPanaudiaConnectionManager::OnWebSocketConnectionError(const FString& Error)
{
    UE_LOG(LogTemp, Error, TEXT("WebSocket connection error: %s"), *Error);
    SetConnectionStatus(EPanaudiaConnectionStatus::Error, Error);
    HandleConnectionLost(FString::Printf(TEXT("WebSocket error: %s"), *Error));
}

void FPanaudiaConnectionManager::OnWebSocketClosed(int32 StatusCode, const FString& Reason, bool bWasClean)
{
    UE_LOG(LogTemp, Log, TEXT("WebSocket closed: %d - %s (clean: %d)"), StatusCode, *Reason, bWasClean);

    if (!bIsManualDisconnect)
    {
        SetConnectionStatus(EPanaudiaConnectionStatus::Disconnected, TEXT("Connection closed"));
        HandleConnectionLost(FString::Printf(TEXT("Connection closed: %s"), *Reason));
    }
}

void FPanaudiaConnectionManager::HandleConnectionLost(const FString& Reason)
{
    if (bIsManualDisconnect)
    {
        UE_LOG(LogTemp, Log, TEXT("Connection lost but was manual disconnect, not reconnecting"));
        return;
    }

    if (!bAutoReconnectEnabled)
    {
        UE_LOG(LogTemp, Log, TEXT("Connection lost but auto-reconnect is disabled"));
        return;
    }

    if (!bHasConnectionConfig)
    {
        UE_LOG(LogTemp, Warning, TEXT("Connection lost but no config stored for reconnection"));
        return;
    }

    if (MaxReconnectAttempts > 0 && ReconnectAttemptCount >= MaxReconnectAttempts)
    {
        UE_LOG(LogTemp, Error, TEXT("Max reconnect attempts (%d) reached. Giving up."), MaxReconnectAttempts);
        SetConnectionStatus(EPanaudiaConnectionStatus::Error,
            FString::Printf(TEXT("Connection lost: %s. Max reconnect attempts reached."), *Reason));
        ResetReconnectionState();
        return;
    }

    bIsReconnecting = true;
    CurrentReconnectDelay = CalculateReconnectDelay();
    ReconnectTimer = CurrentReconnectDelay;

    UE_LOG(LogTemp, Warning, TEXT("Connection lost: %s. Will attempt reconnect #%d in %.1f seconds"),
        *Reason, ReconnectAttemptCount + 1, CurrentReconnectDelay);

    SetConnectionStatus(EPanaudiaConnectionStatus::Error,
        FString::Printf(TEXT("Reconnecting in %.1f seconds (attempt %d/%d)..."),
            CurrentReconnectDelay,
            ReconnectAttemptCount + 1,
            MaxReconnectAttempts));
}

void FPanaudiaConnectionManager::AttemptReconnect()
{
    if (!bIsReconnecting || !bHasConnectionConfig)
    {
        return;
    }

    ReconnectAttemptCount++;

    UE_LOG(LogTemp, Log, TEXT("Attempting reconnect #%d..."), ReconnectAttemptCount);

    // Cleanup previous connection
    CleanupWebSocket();
    CleanupWebRTC();

    // Attempt to reconnect using stored config
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
    // Exponential backoff with jitter
    // Delay = BaseDelay * (2 ^ AttemptCount) + RandomJitter
    float ExponentialDelay = ReconnectBaseDelay * FMath::Pow(2.0f, FMath::Min(ReconnectAttemptCount, 5));

    // Cap at 60 seconds
    ExponentialDelay = FMath::Min(ExponentialDelay, 60.0f);

    // Add random jitter (±20%)
    float Jitter = FMath::RandRange(-0.2f, 0.2f) * ExponentialDelay;

    return ExponentialDelay + Jitter;
}

void FPanaudiaConnectionManager::OnWebSocketMessage(const FString& Message)
{
    UE_LOG(LogTemp, Verbose, TEXT("WebSocket message received"));

    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);

    if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid())
    {
        UE_LOG(LogTemp, Warning, TEXT("Failed to parse WebSocket message"));
        return;
    }

    FString Event = JsonObject->GetStringField(TEXT("event"));

    if (Event == TEXT("offer"))
    {
        HandleOfferMessage(JsonObject->GetStringField(TEXT("data")));
    }
    else if (Event == TEXT("candidate"))
    {
        HandleCandidateMessage(JsonObject->GetStringField(TEXT("data")));
    }
    else if (Event == TEXT("error"))
    {
        HandleErrorMessage(JsonObject->GetStringField(TEXT("data")));
    }
}

void FPanaudiaConnectionManager::HandleOfferMessage(const FString& OfferJson)
{
    UE_LOG(LogTemp, Log, TEXT("Received offer"));

    TSharedPtr<FJsonObject> OfferObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(OfferJson);

    if (FJsonSerializer::Deserialize(Reader, OfferObject) && OfferObject.IsValid())
    {
        FString SDP = OfferObject->GetStringField(TEXT("sdp"));
        CreateAnswer(SDP);
    }
}

void FPanaudiaConnectionManager::HandleCandidateMessage(const FString& CandidateJson)
{
    UE_LOG(LogTemp, Verbose, TEXT("Received ICE candidate"));

    TSharedPtr<FJsonObject> CandidateObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(CandidateJson);

    if (FJsonSerializer::Deserialize(Reader, CandidateObject) && CandidateObject.IsValid())
    {
        try
        {
            FString Candidate = CandidateObject->GetStringField(TEXT("candidate"));
            FString SdpMid = CandidateObject->GetStringField(TEXT("sdpMid"));

            if (PeerConnection)
            {
                // Different libdatachannel versions have different Candidate constructors
                // Try the simpler two-parameter version first
                try
                {
                    PeerConnection->addRemoteCandidate(rtc::Candidate(
                        std::string(TCHAR_TO_UTF8(*Candidate)),
                        std::string(TCHAR_TO_UTF8(*SdpMid))
                    ));
                }
                catch (const std::exception& e)
                {
                    // If that fails, just use the candidate string
                    // Some versions auto-parse the mid from the candidate string
                    UE_LOG(LogTemp, Verbose, TEXT("Trying alternate candidate format"));
                    PeerConnection->addRemoteCandidate(rtc::Candidate(
                        std::string(TCHAR_TO_UTF8(*Candidate))
                    ));
                }
            }
        }
        catch (const std::exception& e)
        {
            UE_LOG(LogTemp, Warning, TEXT("Failed to add ICE candidate: %s"), *FString(e.what()));
        }
    }
}

void FPanaudiaConnectionManager::HandleErrorMessage(const FString& ErrorJson)
{
    UE_LOG(LogTemp, Error, TEXT("Received error message: %s"), *ErrorJson);

    TSharedPtr<FJsonObject> ErrorObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(ErrorJson);

    if (FJsonSerializer::Deserialize(Reader, ErrorObject) && ErrorObject.IsValid())
    {
        FString ErrorMessage = ErrorObject->GetStringField(TEXT("message"));
        SetConnectionStatus(EPanaudiaConnectionStatus::Error, ErrorMessage);
    }
}

// Data Channel Handlers

// Also reset on successful data channel connection
void FPanaudiaConnectionManager::OnStateChannelOpen()
{
    UE_LOG(LogTemp, Log, TEXT("State data channel opened"));
    bIsDataChannelOpen = true;
    SetConnectionStatus(EPanaudiaConnectionStatus::DataConnected, TEXT("Data channel connected"));

    // Successfully connected, reset reconnection state
    if (bIsReconnecting)
    {
        UE_LOG(LogTemp, Log, TEXT("Full reconnection successful - data channel established"));
        ResetReconnectionState();
    }
}

void FPanaudiaConnectionManager::OnStateChannelMessage(const std::vector<std::byte>& Data)
{
    // Convert STL vector to Unreal TArray immediately at the boundary
    TArray<uint8> UnrealData;
    UnrealData.SetNum(Data.size());
    if (Data.size() > 0)
    {
        FMemory::Memcpy(UnrealData.GetData(), Data.data(), Data.size());
    }

    // Now process using Unreal containers
    if (UnrealData.Num() >= 24)  // 6 floats * 4 bytes
    {
        FPanaudiaNodeState State = FPanaudiaNodeState::FromDataBuffer(UnrealData.GetData(), UnrealData.Num());

        // Broadcast to game thread
        if (OnNodeStateReceived.IsBound())
        {
            AsyncTask(ENamedThreads::GameThread, [this, State]()
            {
                OnNodeStateReceived.Broadcast(State);
            });
        }
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("Panaudia: Received malformed state message (size: %d)"), UnrealData.Num());
    }
}

void FPanaudiaConnectionManager::OnControlChannelOpen()
{
    UE_LOG(LogTemp, Log, TEXT("Control data channel opened"));
}

void FPanaudiaConnectionManager::OnControlChannelMessage(const std::string& Message)
{
    // Convert std::string to FString immediately at the boundary
    FString UnrealMessage = FString(UTF8_TO_TCHAR(Message.c_str()));

    // Process using Unreal types
    UE_LOG(LogTemp, Log, TEXT("Panaudia: Control message received: %s"), *UnrealMessage);

    // Parse JSON using Unreal's JSON system
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(UnrealMessage);

    if (FJsonSerializer::Deserialize(Reader, JsonObject) && JsonObject.IsValid())
    {
        FString MessageType = JsonObject->GetStringField(TEXT("type"));

        // Handle different control message types
        if (MessageType == TEXT("pong"))
        {
            // Handle pong response
            UE_LOG(LogTemp, Verbose, TEXT("Panaudia: Pong received"));
        }
        else if (MessageType == TEXT("error"))
        {
            FString ErrorMessage = JsonObject->GetStringField(TEXT("message"));
            UE_LOG(LogTemp, Error, TEXT("Panaudia: Server error: %s"), *ErrorMessage);
        }
        // Add other message type handlers as needed
    }
}

void FPanaudiaConnectionManager::OnAttributesChannelOpen()
{
    UE_LOG(LogTemp, Log, TEXT("Attributes data channel opened"));
}

void FPanaudiaConnectionManager::OnAttributesChannelMessage(const std::string& Message)
{
    // Convert std::string to FString immediately at the boundary
    FString UnrealMessage = FString(UTF8_TO_TCHAR(Message.c_str()));

    UE_LOG(LogTemp, Log, TEXT("Panaudia: Attributes received: %s"), *UnrealMessage);

    // Parse JSON using Unreal's JSON system
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(UnrealMessage);

    if (FJsonSerializer::Deserialize(Reader, JsonObject) && JsonObject.IsValid())
    {
        // Extract attributes
        TMap<FString, FString> Attributes;

        for (const auto& Pair : JsonObject->Values)
        {
            if (Pair.Value->Type == EJson::String)
            {
                Attributes.Add(Pair.Key, Pair.Value->AsString());
            }
        }

        // Broadcast to game thread
        if (OnAttributesReceived.IsBound())
        {
            AsyncTask(ENamedThreads::GameThread, [this, Attributes]()
            {
                OnAttributesReceived.Broadcast(Attributes);
            });
        }
    }
}

void FPanaudiaConnectionManager::OnAudioTrackOpen()
{
    UE_LOG(LogTemp, Log, TEXT("Audio track opened"));
    SetConnectionStatus(EPanaudiaConnectionStatus::Connected, TEXT("Connected"));
}

void FPanaudiaConnectionManager::OnAudioTrackMessage(const std::vector<std::byte>& Data)
{
    // Convert STL vector to Unreal TArray immediately at the boundary
    TArray<uint8> EncodedData;
    EncodedData.SetNum(Data.size());
    if (Data.size() > 0)
    {
        FMemory::Memcpy(EncodedData.GetData(), Data.data(), Data.size());
    }

    // Create packet structure using Unreal containers
    FPanaudiaAudioPacket Packet;
    Packet.Data = MoveTemp(EncodedData);  // Move to avoid copy
    Packet.NumSamples = 0;  // Will be set after decoding
    Packet.NumChannels = 0; // Will be set after decoding
    Packet.Timestamp = FPlatformTime::Seconds();

    // Queue for processing (TQueue is thread-safe)
    IncomingPacketQueue.Enqueue(MoveTemp(Packet));
}

// Position Updates

void FPanaudiaConnectionManager::UpdatePosition(const FVector& Position, const FRotator& Rotation)
{
    FPanaudiaNodeState State = FPanaudiaNodeState::FromUnrealCoordinates(Position, Rotation);
    UpdateAmbisonicPosition(State);
}

void FPanaudiaConnectionManager::UpdateAmbisonicPosition(const FPanaudiaNodeState& State)
{
    SendStateUpdate(State);
}

void FPanaudiaConnectionManager::SendStateUpdate(const FPanaudiaNodeState& State)
{
    if (!StateChannel || !StateChannel->isOpen())
    {
        return;
    }

    // Convert Unreal TArray to std::vector at the boundary
    TArray<uint8> UnrealData = State.ToDataBuffer();

    std::vector<std::byte> StdData;
    StdData.resize(UnrealData.Num());
    if (UnrealData.Num() > 0)
    {
        FMemory::Memcpy(StdData.data(), UnrealData.GetData(), UnrealData.Num());
    }

    try
    {
        StateChannel->send(StdData);
    }
    catch (const std::exception& e)
    {
        FString ErrorMsg = FString(UTF8_TO_TCHAR(e.what()));
        UE_LOG(LogTemp, Error, TEXT("Panaudia: Failed to send state: %s"), *ErrorMsg);
    }
}

// Audio Control

void FPanaudiaConnectionManager::Mute(const FString& NodeId)
{
    TSharedPtr<FJsonObject> MessageData = MakeShareable(new FJsonObject());
    MessageData->SetStringField(TEXT("node"), NodeId);
    SendControlMessage(TEXT("mute"), MessageData);
}

void FPanaudiaConnectionManager::Unmute(const FString& NodeId)
{
    TSharedPtr<FJsonObject> MessageData = MakeShareable(new FJsonObject());
    MessageData->SetStringField(TEXT("node"), NodeId);
    SendControlMessage(TEXT("unmute"), MessageData);
}

void FPanaudiaConnectionManager::SendControlMessage(const FString& Type, const TSharedPtr<FJsonObject>& MessageData)
{
    if (!ControlChannel || !ControlChannel->isOpen())
    {
        return;
    }

    // Build JSON using Unreal containers
    TSharedPtr<FJsonObject> JsonMessage = MakeShared<FJsonObject>();
    JsonMessage->SetStringField(TEXT("type"), Type);

    if (MessageData.IsValid())
    {
        for (const auto& Pair : MessageData->Values)
        {
            JsonMessage->SetField(Pair.Key, Pair.Value);
        }
    }

    // Serialize to FString
    FString JsonString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonString);
    FJsonSerializer::Serialize(JsonMessage.ToSharedRef(), Writer);

    // Convert FString to std::string at the boundary
    std::string StdString(TCHAR_TO_UTF8(*JsonString));

    try
    {
        ControlChannel->send(StdString);
    }
    catch (const std::exception& e)
    {
        FString ErrorMsg = FString(UTF8_TO_TCHAR(e.what()));
        UE_LOG(LogTemp, Error, TEXT("Panaudia: Failed to send control message: %s"), *ErrorMsg);
    }
}

// Audio Data Handling

void FPanaudiaConnectionManager::SubmitAudioData(const float* AudioData, int32 NumSamples, int32 NumChannels, int32 SampleRate)
{
    if (!OpusEncoder || !OpusEncoder->IsInitialized())
    {
        return;
    }

    if (!AudioTrack || !AudioTrack->isOpen())
    {
        return;
    }

    // Convert to mono if needed
    TArray<float> MonoBuffer;
    const float* ProcessData = AudioData;

    if (NumChannels > 1)
    {
        // Average channels to mono
        MonoBuffer.SetNum(NumSamples);
        for (int32 i = 0; i < NumSamples; ++i)
        {
            float Sum = 0.0f;
            for (int32 ch = 0; ch < NumChannels; ++ch)
            {
                Sum += AudioData[i * NumChannels + ch];
            }
            MonoBuffer[i] = Sum / NumChannels;
        }
        ProcessData = MonoBuffer.GetData();
    }

    // Accumulate samples until we have a full frame (960 samples for 20ms at 48kHz)
    const int32 RequiredFrameSize = 960;

    for (int32 i = 0; i < NumSamples; ++i)
    {
        PCMAccumulationBuffer.Add(ProcessData[i]);
        AccumulatedSamples++;

        if (AccumulatedSamples >= RequiredFrameSize)
        {
            // Encode frame
            TArray<uint8> EncodedPacket;
            int32 EncodedBytes = OpusEncoder->Encode(
                PCMAccumulationBuffer.GetData(),
                RequiredFrameSize,
                EncodedPacket
            );

            if (EncodedBytes > 0)
            {
                // Send via WebRTC
                try
                {
                    std::vector<std::byte> ByteVector;
                    ByteVector.reserve(EncodedPacket.Num());
                    for (uint8 Byte : EncodedPacket)
                    {
                        ByteVector.push_back(static_cast<std::byte>(Byte));
                    }

                    AudioTrack->send(ByteVector);
                }
                catch (const std::exception& e)
                {
                    UE_LOG(LogTemp, Warning, TEXT("Failed to send audio: %s"), *FString(e.what()));
                }
            }

            // Reset accumulation buffer
            PCMAccumulationBuffer.Empty();
            AccumulatedSamples = 0;
        }
    }
}

bool FPanaudiaConnectionManager::GetReceivedAudioData(float* OutAudioData, int32 NumSamples, int32 NumChannels)
{
    if (!OpusDecoder || !OpusDecoder->IsInitialized() || !JitterBuffer)
    {
        return false;
    }

    // Process any pending packets first
    ProcessIncomingAudio();

    // Get audio from jitter buffer
    return JitterBuffer->GetAudio(OutAudioData, NumSamples, NumChannels);
}

void FPanaudiaConnectionManager::SetJitterBufferEnabled(bool bEnabled)
{
    if (JitterBuffer)
    {
        JitterBuffer->SetAdaptiveMode(bEnabled);
    }
}

void FPanaudiaConnectionManager::SetJitterBufferRange(int32 MinMs, int32 MaxMs, int32 TargetMs)
{
    if (JitterBuffer)
    {
        JitterBuffer->Initialize(MinMs, MaxMs, TargetMs, 48000);
    }
}

FJitterBufferStats FPanaudiaConnectionManager::GetJitterBufferStats() const
{
    if (JitterBuffer)
    {
        return JitterBuffer->GetStats();
    }
    return FJitterBufferStats();
}

float FPanaudiaConnectionManager::GetCurrentAudioLatency() const
{
    if (JitterBuffer)
    {
        return JitterBuffer->GetCurrentLatencyMs();
    }
    return 0.0f;
}

void FPanaudiaConnectionManager::ProcessIncomingAudio()
{
    if (!OpusDecoder || !OpusDecoder->IsInitialized() || !JitterBuffer)
    {
        return;
    }

    // Decode all pending packets and add to jitter buffer
    FPanaudiaAudioPacket Packet;
    while (IncomingPacketQueue.Dequeue(Packet))
    {
        const int32 MaxFrameSize = 960;
        const int32 NumChannels = 2; // Stereo
        TArray<float> DecodedPCM;
        DecodedPCM.SetNum(MaxFrameSize * NumChannels);

        int32 DecodedSamples = OpusDecoder->Decode(
            Packet.Data.GetData(),
            Packet.Data.Num(),
            DecodedPCM.GetData(),
            MaxFrameSize
        );

        if (DecodedSamples > 0)
        {
            DecodedPCM.SetNum(DecodedSamples * NumChannels);

            // Add to jitter buffer instead of directly to queue
            JitterBuffer->AddPacket(DecodedPCM, DecodedSamples, NumChannels);
        }
        else
        {
            // Packet loss - use PLC
            TArray<float> PLCBuffer;
            PLCBuffer.SetNum(MaxFrameSize * NumChannels);
            int32 PLCSamples = OpusDecoder->DecodePLC(PLCBuffer.GetData(), MaxFrameSize);

            if (PLCSamples > 0)
            {
                PLCBuffer.SetNum(PLCSamples * NumChannels);
                JitterBuffer->AddPacket(PLCBuffer, PLCSamples, NumChannels);
            }
        }
    }
}

void FPanaudiaConnectionManager::ProcessOutgoingAudio()
{
    // Audio is now encoded and sent immediately in SubmitAudioData
    // This method can be used for additional processing if needed
}

// Helper Methods

void FPanaudiaConnectionManager::SetConnectionStatus(EPanaudiaConnectionStatus NewStatus, const FString& Message)
{
    FScopeLock Lock(&StatusLock);

    if (CurrentStatus != NewStatus)
    {
        CurrentStatus = NewStatus;
        LastErrorMessage = Message;

        // Queue delegate call on game thread
        AsyncTask(ENamedThreads::GameThread, [this, NewStatus, Message]()
        {
            OnConnectionStatusChanged.Broadcast(NewStatus, Message);
        });

        UE_LOG(LogTemp, Log, TEXT("Connection status: %d - %s"), (int)NewStatus, *Message);
    }
}

FString FPanaudiaConnectionManager::BuildConnectionURL(const FPanaudiaConnectionConfig& Config, const FString& BaseURL)
{
    FString URL = BaseURL;

    // Add query parameters
    TArray<FString> Params;

    if (!Config.Ticket.IsEmpty())
    {
        Params.Add(FString::Printf(TEXT("ticket=%s"), *Config.Ticket));
    }

    // Add position
    FPanaudiaNodeState State = FPanaudiaNodeState::FromUnrealCoordinates(
        Config.InitialPosition,
        Config.InitialRotation
    );

    Params.Add(FString::Printf(TEXT("x=%f"), State.X));
    Params.Add(FString::Printf(TEXT("y=%f"), State.Y));
    Params.Add(FString::Printf(TEXT("z=%f"), State.Z));
    Params.Add(FString::Printf(TEXT("yaw=%f"), State.Yaw));
    Params.Add(FString::Printf(TEXT("pitch=%f"), State.Pitch));
    Params.Add(FString::Printf(TEXT("roll=%f"), State.Roll));

    if (Config.bEnableDataChannel)
    {
        Params.Add(TEXT("data=true"));
    }

    // Add custom attributes
    for (const auto& Attr : Config.CustomAttributes)
    {
        Params.Add(FString::Printf(TEXT("%s=%s"), *Attr.Key, *Attr.Value));
    }

    if (Params.Num() > 0)
    {
        URL += TEXT("?") + FString::Join(Params, TEXT("&"));
    }

    return URL;
}

// Cleanup

void FPanaudiaConnectionManager::CleanupWebRTC()
{
    try
    {
        // Close and reset data channels
        if (StateChannel)
        {
            try
            {
                if (StateChannel->isOpen())
                {
                    StateChannel->close();
                }
            }
            catch (const std::exception& e)
            {
                UE_LOG(LogTemp, Verbose, TEXT("StateChannel close exception (expected): %s"), *FString(e.what()));
            }
            StateChannel.reset();
        }

        if (ControlChannel)
        {
            try
            {
                if (ControlChannel->isOpen())
                {
                    ControlChannel->close();
                }
            }
            catch (const std::exception& e)
            {
                UE_LOG(LogTemp, Verbose, TEXT("ControlChannel close exception (expected): %s"), *FString(e.what()));
            }
            ControlChannel.reset();
        }

        if (AttributesChannel)
        {
            try
            {
                if (AttributesChannel->isOpen())
                {
                    AttributesChannel->close();
                }
            }
            catch (const std::exception& e)
            {
                UE_LOG(LogTemp, Verbose, TEXT("AttributesChannel close exception (expected): %s"), *FString(e.what()));
            }
            AttributesChannel.reset();
        }

        // Reset audio track
        if (AudioTrack)
        {
            AudioTrack.reset();
        }

        // Close and reset peer connection
        if (PeerConnection)
        {
            try
            {
                PeerConnection->close();
            }
            catch (const std::exception& e)
            {
                UE_LOG(LogTemp, Verbose, TEXT("PeerConnection close exception (expected): %s"), *FString(e.what()));
            }
            PeerConnection.reset();
        }

        bIsDataChannelOpen = false;
    }
    catch (const std::exception& e)
    {
        UE_LOG(LogTemp, Warning, TEXT("Error during WebRTC cleanup: %s"), *FString(e.what()));
    }
}

void FPanaudiaConnectionManager::CleanupWebSocket()
{
    if (WebSocket)
    {
        if (WebSocket->IsConnected())
        {
            WebSocket->Close();
        }
        WebSocket.Reset();
    }
}

// FTickableGameObject

void FPanaudiaConnectionManager::Tick(float DeltaTime)
{
    // Process incoming audio packets
    ProcessIncomingAudio();

    // Handle reconnection timer
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
