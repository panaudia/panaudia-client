
#include "PanaudiaOpusEncoder.h"

#include "opus.h"
#include <cstdio>
#include <algorithm>

// Opus application types
#define OPUS_APPLICATION_VOIP 2048
#define OPUS_APPLICATION_AUDIO 2049
#define OPUS_APPLICATION_RESTRICTED_LOWDELAY 2051

FPanaudiaOpusEncoder::FPanaudiaOpusEncoder()
    : Encoder(nullptr)
    , SampleRate(48000)
    , NumChannels(1)
    , FrameSize(960)
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

bool FPanaudiaOpusEncoder::Initialize(int32 InSampleRate, int32 InNumChannels,
                                       int32 Application, int32 InFrameSize)
{
    if (Encoder)
    {
        opus_encoder_destroy(Encoder);
        Encoder = nullptr;
    }

    SampleRate = InSampleRate;
    NumChannels = InNumChannels;
    FrameSize = InFrameSize;

    int32 Error = 0;
    Encoder = opus_encoder_create(SampleRate, NumChannels, Application, &Error);

    if (Error != OPUS_OK || !Encoder)
    {
        printf("[Panaudia] Failed to create Opus encoder: %s\n", opus_strerror(Error));
        return false;
    }

    // Variable bitrate
    opus_encoder_ctl(Encoder, OPUS_SET_VBR(1));

    // Defaults
    SetBitrate(64000);
    SetComplexity(5);
    SetDTX(true);

    // Voice signal type
    opus_encoder_ctl(Encoder, OPUS_SET_SIGNAL(OPUS_SIGNAL_VOICE));

    printf("[Panaudia] Opus encoder initialized: %dHz, %d ch, frame=%d samples (%.1fms)\n",
        SampleRate, NumChannels, FrameSize,
        (float)FrameSize * 1000.0f / (float)SampleRate);

    return true;
}

int32 FPanaudiaOpusEncoder::Encode(const float* PCMData, int32 NumSamples,
                                    uint8* OutBuffer, int32 OutBufferSize)
{
    if (!Encoder)
    {
        printf("[Panaudia] Opus encoder not initialized\n");
        return -1;
    }

    if (NumSamples != FrameSize)
    {
        printf("[Panaudia] Invalid frame size: %d, expected: %d\n", NumSamples, FrameSize);
        return -1;
    }

    int32 EncodedBytes = opus_encode_float(
        Encoder, PCMData, FrameSize, OutBuffer, OutBufferSize);

    if (EncodedBytes < 0)
    {
        printf("[Panaudia] Opus encoding failed: %s\n", opus_strerror(EncodedBytes));
        return EncodedBytes;
    }

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
        Complexity = std::clamp(Complexity, 0, 10);
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
