
#pragma once

#include <vector>
#include <mutex>
#include <cstdint>
#include <cmath>
#include <algorithm>
#include <chrono>
#include <cstring>

// Ensure PANAUDIA_API is defined even without UE headers
#ifndef PANAUDIA_API
#define PANAUDIA_API
#endif

/**
 * Diagnostics exposed by the jitter buffer.
 */
struct FJitterBufferStats
{
    int32_t FillLevelSamples = 0;     // Current fill in per-channel samples
    float FillLevelMs = 0.0f;         // Current fill in milliseconds
    int32_t CurrentZone = 0;          // -3..+3 (negative = low, 0 = target, positive = high)
    int32_t UnderrunCount = 0;
    int32_t OverrunCount = 0;
    int32_t SamplesDropped = 0;
    int32_t SamplesInserted = 0;
    int32_t TotalPacketsReceived = 0;
    float AverageJitter = 0.0f;       // Inter-arrival std dev in ms
    bool bIsPlaying = false;          // true if in Playing state
};

/**
 * Real-time audio circular buffer with zone-based drift correction.
 *
 * - Never blocks on read or write.
 * - Target window: a range of fill levels where no correction is applied.
 * - Graduated correction zones (1/2/4 samples) on each side of the window.
 * - Filling/Playing state machine for initial buffering and dropout recovery.
 * - Overrun snap for read-stall recovery.
 *
 * Thread-safe: uses std::mutex. Callable from msquic threads and audio render threads.
 *
 * See plan/jitter_buffer_design.md for full design rationale.
 */
class PANAUDIA_API FPanaudiaJitterBuffer
{
public:
    FPanaudiaJitterBuffer();
    ~FPanaudiaJitterBuffer();

    /**
     * Initialize the buffer.
     * All latency parameters are in milliseconds.
     * Zone boundaries are derived from TargetLatencyMs, TargetWindowMs, and ZoneWidthMs.
     */
    void Initialize(
        int32_t InSampleRate = 48000,
        int32_t InNumChannels = 2,
        int32_t TargetLatencyMs = 60,
        int32_t TargetWindowMs = 20,
        int32_t ZoneWidthMs = 30,
        int32_t MinLatencyMs = 10,
        int32_t MaxLatencyMs = 200,
        int32_t InCorrectionInterval = 16
    );

    /** Write interleaved PCM floats into the ring (TArray overload for game thread). */
    void AddPacket(const std::vector<float>& AudioData, int32_t NumSamples, int32_t NumChannels);

    /** Write interleaved PCM floats into the ring (raw pointer overload for msquic thread). */
    void AddPacket(const float* AudioData, int32_t NumFloats, int32_t NumChannels);

    /** Read interleaved PCM floats from the ring. Never blocks. Returns false on underrun/filling. */
    bool GetAudio(float* OutAudioData, int32_t RequestedSamples, int32_t NumChannels);

    void Reset();
    FJitterBufferStats GetStats();
    float GetCurrentLatencyMs();

    // Legacy API compatibility
    void SetAdaptiveMode(bool bEnabled) { (void)bEnabled; }
    void SetJitterBufferRange(int32_t MinMs, int32_t MaxMs, int32_t TargetMs);

private:
    // Ring buffer
    std::vector<float> RingBuffer;
    int32_t RingCapacity;
    int32_t WritePos;
    int32_t ReadPos;
    int32_t BufferedFloats;

    // Audio format
    int32_t SampleRate;
    int32_t NumChannels;

    // Zone boundaries (in per-channel samples)
    int32_t TargetLow;
    int32_t TargetHigh;
    int32_t Z1Low, Z1High;
    int32_t Z2Low, Z2High;
    int32_t Z3Low, Z3High;
    int32_t MinSamples;
    int32_t MaxSamples;
    int32_t TargetCentre;

    // Drift correction
    int32_t CorrectionInterval;
    int32_t CorrectionCounter;
    int32_t TotalSamplesDropped;
    int32_t TotalSamplesInserted;

    // State machine
    enum class EBufferState : uint8_t
    {
        Filling,
        Playing
    };
    EBufferState State;

    // Stats
    int32_t UnderrunCount;
    int32_t OverrunCount;
    int32_t TotalPacketsReceived;

    // Jitter measurement (write side)
    double LastPacketTime;
    std::vector<double> InterArrivalTimes;
    float CurrentJitter;
    static const int32_t MaxInterArrivalSamples = 100;

    std::mutex BufferLock;

    // Time helper
    double GetTimeSeconds() const;

    // Helpers
    int32_t GetFillSamples() const;
    int32_t GetCurrentZone() const;
    void UpdateJitterStats(double ArrivalTime);
    float CalculateJitter() const;
    void RingCopy(float* Dst, int32_t FromPos, int32_t FloatCount) const;

    // Internal AddPacket implementation (called with lock held)
    void AddPacketInternal(const float* Src, int32_t FloatsToWrite);
};
