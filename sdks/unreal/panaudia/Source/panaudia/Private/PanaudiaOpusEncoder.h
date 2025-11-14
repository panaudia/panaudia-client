#pragma once

#include "Containers/Array.h"
#include "HAL/Platform.h"

// Forward declare Opus types
typedef struct OpusEncoder OpusEncoder;

/**
 * Opus audio encoder for WebRTC
 * Encodes PCM float audio to Opus packets
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
     * @param Application Application type (VOIP, Audio, or Restricted Low Delay)
     * @return true if initialization succeeded
     */
    bool Initialize(int32 SampleRate = 48000, int32 NumChannels = 1, int32 Application = 2048);

    /**
     * Encode PCM audio to Opus
     * @param PCMData Input PCM float samples [-1.0, 1.0]
     * @param NumSamples Number of samples per channel
     * @param OutEncodedData Output Opus packet
     * @return Number of bytes encoded, or negative on error
     */
    int32 Encode(const float* PCMData, int32 NumSamples, TArray<uint8>& OutEncodedData);

    /**
     * Set encoder bitrate
     * @param Bitrate Bitrate in bits per second (e.g., 64000 for 64 kbps)
     */
    void SetBitrate(int32 Bitrate);

    /**
     * Set encoder complexity (0-10, higher = better quality but slower)
     */
    void SetComplexity(int32 Complexity);

    /**
     * Enable/disable DTX (Discontinuous Transmission)
     */
    void SetDTX(bool bEnabled);

    /**
     * Check if encoder is initialized
     */
    bool IsInitialized() const { return Encoder != nullptr; }

private:
    OpusEncoder* Encoder;
    int32 SampleRate;
    int32 NumChannels;
    int32 FrameSize; // Samples per channel per frame

    // Encoding buffer
    TArray<uint8> EncodingBuffer;
};
