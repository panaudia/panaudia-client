
#pragma once

#include "Containers/Array.h"
#include "HAL/Platform.h"

// Forward declare Opus types
typedef struct OpusDecoder OpusDecoder;

/**
 * Opus audio decoder for WebRTC
 * Decodes Opus packets to PCM float audio
 */
class PANAUDIA_API FPanaudiaOpusDecoder
{
public:
    FPanaudiaOpusDecoder();
    ~FPanaudiaOpusDecoder();

    /**
     * Initialize the decoder
     * @param SampleRate Sample rate (48000 for WebRTC)
     * @param NumChannels Number of channels (1 for mono, 2 for stereo)
     * @return true if initialization succeeded
     */
    bool Initialize(int32 SampleRate = 48000, int32 NumChannels = 2);

    /**
     * Decode Opus packet to PCM
     * @param EncodedData Input Opus packet
     * @param EncodedSize Size of Opus packet in bytes
     * @param OutPCMData Output PCM float samples [-1.0, 1.0]
     * @param MaxFrameSize Maximum number of samples per channel to decode
     * @return Number of samples per channel decoded, or negative on error
     */
    int32 Decode(const uint8* EncodedData, int32 EncodedSize, float* OutPCMData, int32 MaxFrameSize);

    /**
     * Decode packet loss concealment
     * Used when a packet is lost to generate plausible audio
     * @param OutPCMData Output PCM float samples
     * @param FrameSize Number of samples per channel to generate
     * @return Number of samples per channel generated, or negative on error
     */
    int32 DecodePLC(float* OutPCMData, int32 FrameSize);

    /**
     * Check if decoder is initialized
     */
    bool IsInitialized() const { return Decoder != nullptr; }

    /**
     * Get the sample rate
     */
    int32 GetSampleRate() const { return SampleRate; }

    /**
     * Get the number of channels
     */
    int32 GetNumChannels() const { return NumChannels; }

private:
    OpusDecoder* Decoder;
    int32 SampleRate;
    int32 NumChannels;
};