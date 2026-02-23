#pragma once

#include "HAL/Platform.h"

// Forward declare Opus types
typedef struct OpusEncoder OpusEncoder;

/**
 * Opus audio encoder — thread-safe (no UE API calls, plain C/C++ only).
 * Safe to call from Core Audio capture thread or msquic threads.
 */
class PANAUDIA_API FPanaudiaOpusEncoder
{
public:
    FPanaudiaOpusEncoder();
    ~FPanaudiaOpusEncoder();

    /**
     * Initialize the encoder
     * @param SampleRate Sample rate (48000 for WebRTC)
     * @param NumChannels Number of channels (1 for mono, 2 for stereo)
     * @param Application Opus application type (2048=VOIP, 2049=Audio, 2051=LowDelay)
     * @param InFrameSize Samples per channel per frame (240=5ms, 480=10ms, 960=20ms at 48kHz)
     * @return true if initialization succeeded
     */
    bool Initialize(int32 SampleRate = 48000, int32 NumChannels = 1,
                    int32 Application = 2048, int32 InFrameSize = 960);

    /**
     * Encode PCM audio to Opus, writing into caller-provided buffer (zero-alloc).
     * @param PCMData Input PCM float samples [-1.0, 1.0]
     * @param NumSamples Number of samples per channel (must equal FrameSize)
     * @param OutBuffer Output buffer for Opus packet
     * @param OutBufferSize Size of output buffer in bytes
     * @return Number of bytes encoded, or negative on error
     */
    int32 Encode(const float* PCMData, int32 NumSamples, uint8* OutBuffer, int32 OutBufferSize);

    void SetBitrate(int32 Bitrate);
    void SetComplexity(int32 Complexity);
    void SetDTX(bool bEnabled);

    bool IsInitialized() const { return Encoder != nullptr; }
    int32 GetFrameSize() const { return FrameSize; }

private:
    OpusEncoder* Encoder;
    int32 SampleRate;
    int32 NumChannels;
    int32 FrameSize;
};
