
#include "PanaudiaOpusEncoder.h"

#include "CoreMinimal.h"
#include "opus.h"

// Opus application types
#define OPUS_APPLICATION_VOIP 2048
#define OPUS_APPLICATION_AUDIO 2049
#define OPUS_APPLICATION_RESTRICTED_LOWDELAY 2051

FPanaudiaOpusEncoder::FPanaudiaOpusEncoder()
    : Encoder(nullptr)
    , SampleRate(48000)
    , NumChannels(1)
    , FrameSize(960) // 20ms at 48kHz
{
}

FPanaudiaOpusEncoder::~FPanaudiaOpusEncoder()
{
    if (Encoder)
    {
        opus_encoder_destroy(Encoder);
        Encoder = nullptr;
    }
}

bool FPanaudiaOpusEncoder::Initialize(int32 InSampleRate, int32 InNumChannels, int32 Application)
{
    if (Encoder)
    {
        opus_encoder_destroy(Encoder);
        Encoder = nullptr;
    }

    SampleRate = InSampleRate;
    NumChannels = InNumChannels;

    // Calculate frame size (20ms worth of samples)
    FrameSize = SampleRate / 50; // 20ms = 1/50 second

    int32 Error = 0;
    Encoder = opus_encoder_create(SampleRate, NumChannels, Application, &Error);

    if (Error != OPUS_OK || !Encoder)
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to create Opus encoder: %s"),
            *FString(opus_strerror(Error)));
        return false;
    }

    // Configure encoder for WebRTC
    // Use variable bitrate
    opus_encoder_ctl(Encoder, OPUS_SET_VBR(1));

    // Set bitrate (default 64kbps for voice)
    SetBitrate(64000);

    // Set complexity (default 5 for balance)
    SetComplexity(5);

    // Enable DTX (Discontinuous Transmission) for bandwidth savings
    SetDTX(true);

    // Set signal type to voice
    opus_encoder_ctl(Encoder, OPUS_SET_SIGNAL(OPUS_SIGNAL_VOICE));

    // Allocate encoding buffer (max Opus packet size)
    EncodingBuffer.SetNum(4000);

    UE_LOG(LogTemp, Log, TEXT("Opus encoder initialized: %dHz, %d channels, frame size: %d"),
        SampleRate, NumChannels, FrameSize);

    return true;
}

int32 FPanaudiaOpusEncoder::Encode(const float* PCMData, int32 NumSamples, TArray<uint8>& OutEncodedData)
{
    if (!Encoder)
    {
        UE_LOG(LogTemp, Error, TEXT("Opus encoder not initialized"));
        return -1;
    }

    // Ensure we have the correct frame size
    if (NumSamples != FrameSize)
    {
        UE_LOG(LogTemp, Warning, TEXT("Invalid frame size: %d, expected: %d"), NumSamples, FrameSize);
        return -1;
    }

    // Encode
    int32 EncodedBytes = opus_encode_float(
        Encoder,
        PCMData,
        FrameSize,
        EncodingBuffer.GetData(),
        EncodingBuffer.Num()
    );

    if (EncodedBytes < 0)
    {
        UE_LOG(LogTemp, Error, TEXT("Opus encoding failed: %s"),
            *FString(opus_strerror(EncodedBytes)));
        return EncodedBytes;
    }

    // Copy to output
    OutEncodedData.SetNum(EncodedBytes);
    FMemory::Memcpy(OutEncodedData.GetData(), EncodingBuffer.GetData(), EncodedBytes);

    return EncodedBytes;
}

void FPanaudiaOpusEncoder::SetBitrate(int32 Bitrate)
{
    if (Encoder)
    {
        opus_encoder_ctl(Encoder, OPUS_SET_BITRATE(Bitrate));
    }
}

void FPanaudiaOpusEncoder::SetComplexity(int32 Complexity)
{
    if (Encoder)
    {
        // Clamp to valid range 0-10
        Complexity = FMath::Clamp(Complexity, 0, 10);
        opus_encoder_ctl(Encoder, OPUS_SET_COMPLEXITY(Complexity));
    }
}

void FPanaudiaOpusEncoder::SetDTX(bool bEnabled)
{
    if (Encoder)
    {
        opus_encoder_ctl(Encoder, OPUS_SET_DTX(bEnabled ? 1 : 0));
    }
}