
#include "PanaudiaOpusDecoder.h"

#include <cstdio>
#include "opus.h"

FPanaudiaOpusDecoder::FPanaudiaOpusDecoder()
    : Decoder(nullptr)
    , SampleRate(48000)
    , NumChannels(2)
{
}

FPanaudiaOpusDecoder::~FPanaudiaOpusDecoder()
{
    if (Decoder)
    {
        opus_decoder_destroy(Decoder);
        Decoder = nullptr;
    }
}

bool FPanaudiaOpusDecoder::Initialize(int32 InSampleRate, int32 InNumChannels)
{
    if (Decoder)
    {
        opus_decoder_destroy(Decoder);
        Decoder = nullptr;
    }

    SampleRate = InSampleRate;
    NumChannels = InNumChannels;

    int32 Error = 0;
    Decoder = opus_decoder_create(SampleRate, NumChannels, &Error);

    if (Error != OPUS_OK || !Decoder)
    {
        printf("[Panaudia] Failed to create Opus decoder: %s\n", opus_strerror(Error));
        return false;
    }

    printf("[Panaudia] Opus decoder initialized: %dHz, %d channels\n", SampleRate, NumChannels);

    return true;
}

int32 FPanaudiaOpusDecoder::Decode(const uint8* EncodedData, int32 EncodedSize, float* OutPCMData, int32 MaxFrameSize)
{
    if (!Decoder)
    {
        printf("[Panaudia] Opus decoder not initialized\n");
        return -1;
    }

    if (!EncodedData || EncodedSize <= 0)
    {
        printf("[Panaudia] Invalid encoded data\n");
        return -1;
    }

    // Decode
    int32 DecodedSamples = opus_decode_float(
        Decoder,
        EncodedData,
        EncodedSize,
        OutPCMData,
        MaxFrameSize,
        0  // decode_fec = 0 (no forward error correction)
    );

    if (DecodedSamples < 0)
    {
        printf("[Panaudia] Opus decoding failed: %s\n", opus_strerror(DecodedSamples));
        return DecodedSamples;
    }

    return DecodedSamples;
}

int32 FPanaudiaOpusDecoder::DecodePLC(float* OutPCMData, int32 FrameSize)
{
    if (!Decoder)
    {
        printf("[Panaudia] Opus decoder not initialized\n");
        return -1;
    }

    // Decode with null packet for packet loss concealment
    int32 DecodedSamples = opus_decode_float(
        Decoder,
        nullptr,  // null = PLC mode
        0,
        OutPCMData,
        FrameSize,
        0
    );

    if (DecodedSamples < 0)
    {
        printf("[Panaudia] Opus PLC failed: %s\n", opus_strerror(DecodedSamples));
        return DecodedSamples;
    }

    return DecodedSamples;
}
