
#pragma once

#include "Containers/Array.h"
#include "Containers/Queue.h"
#include "HAL/CriticalSection.h"
#include "HAL/Platform.h"

class FJsonObject;

/**
 * Statistics for jitter buffer adaptation
 */
struct FJitterBufferStats
{
    float AverageJitter = 0.0f;
    float MaxJitter = 0.0f;
    float PacketLossRate = 0.0f;
    int32 BufferedPackets = 0;
    int32 CurrentBufferSize = 0;
    int32 UnderrunCount = 0;
    int32 TotalPacketsReceived = 0;
};

/**
 * Audio packet with timing information
 */
struct FTimedAudioPacket
{
    TArray<float> AudioData;
    double ReceiveTime;
    int32 SequenceNumber;
    int32 NumSamples;
    int32 NumChannels;

    FTimedAudioPacket()
        : ReceiveTime(0.0)
        , SequenceNumber(0)
        , NumSamples(0)
        , NumChannels(0)
    {}
};

/**
 * Adaptive jitter buffer for real-time audio streaming
 * Dynamically adjusts buffer size based on network conditions
 */
class PANAUDIA_API FPanaudiaJitterBuffer
{
public:
    FPanaudiaJitterBuffer();
    ~FPanaudiaJitterBuffer();

    /**
     * Initialize the jitter buffer
     * @param MinBufferMs Minimum buffer size in milliseconds (lowest latency)
     * @param MaxBufferMs Maximum buffer size in milliseconds (highest stability)
     * @param TargetBufferMs Initial target buffer size
     * @param SampleRate Audio sample rate
     */
    void Initialize(int32 MinBufferMs = 20, int32 MaxBufferMs = 200, int32 TargetBufferMs = 60, int32 SampleRate = 48000);

    /**
     * Add an incoming audio packet to the buffer
     * @param AudioData PCM audio data
     * @param NumSamples Number of samples per channel
     * @param NumChannels Number of audio channels
     */
    void AddPacket(const TArray<float>& AudioData, int32 NumSamples, int32 NumChannels);

    /**
     * Get audio data for playback
     * @param OutAudioData Buffer to fill with audio
     * @param RequestedSamples Number of samples requested per channel
     * @param NumChannels Number of channels
     * @return true if data was available, false if buffer underrun
     */
    bool GetAudio(float* OutAudioData, int32 RequestedSamples, int32 NumChannels);

    /**
     * Reset the buffer
     */
    void Reset();

    /**
     * Get current buffer statistics
     */
    FJitterBufferStats GetStats();

    /**
     * Enable/disable adaptive mode
     */
    void SetAdaptiveMode(bool bEnabled);

    /**
     * Get current buffer latency in milliseconds
     */
    float GetCurrentLatencyMs();

private:
    // Configuration
    int32 MinBufferSamples;
    int32 MaxBufferSamples;
    int32 TargetBufferSamples;
    int32 CurrentTargetSamples;
    int32 SampleRate;
    bool bAdaptiveMode;

    // Packet storage
    TArray<FTimedAudioPacket> PacketBuffer;
    FCriticalSection BufferLock;

    // Sequence tracking
    int32 NextExpectedSequence;
    int32 LastReceivedSequence;
    int32 CurrentSequence;

    // Timing statistics
    double LastPacketTime;
    double FirstPacketTime;
    TArray<double> InterArrivalTimes;
    static const int32 MaxInterArrivalSamples = 100;

    // Performance tracking
    int32 TotalPacketsReceived;
    int32 PacketsLost;
    int32 UnderrunCount;
    int32 OverrunCount;
    double LastAdaptationTime;

    // Jitter calculation
    float CurrentJitter;
    float MaxRecentJitter;
    TArray<float> JitterHistory;
    static const int32 JitterHistorySize = 50;

    // Adaptation parameters
    float AdaptationRate;
    float UnderrunThreshold;
    float OverrunThreshold;
    static constexpr float AdaptationInterval = 1.0f; // seconds

    // Private methods
    void UpdateJitterStats(double ArrivalTime);
    void AdaptBufferSize();
    float CalculateJitter() const;
    float CalculatePacketLossRate() const;
    bool ShouldIncreaseBuffer() const;
    bool ShouldDecreaseBuffer() const;
    void IncreaseBufferSize();
    void DecreaseBufferSize();
    int32 GetBufferedSampleCount() const;
    void RemoveOldPackets();
};
