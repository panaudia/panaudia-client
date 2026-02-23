
#include "PanaudiaJitterBuffer.h"

#include <cstdio>

FPanaudiaJitterBuffer::FPanaudiaJitterBuffer()
    : RingCapacity(0)
    , WritePos(0)
    , ReadPos(0)
    , BufferedFloats(0)
    , SampleRate(48000)
    , NumChannels(2)
    , TargetLow(0)
    , TargetHigh(0)
    , Z1Low(0), Z1High(0)
    , Z2Low(0), Z2High(0)
    , Z3Low(0), Z3High(0)
    , MinSamples(0)
    , MaxSamples(0)
    , TargetCentre(0)
    , CorrectionInterval(16)
    , CorrectionCounter(0)
    , TotalSamplesDropped(0)
    , TotalSamplesInserted(0)
    , State(EBufferState::Filling)
    , UnderrunCount(0)
    , OverrunCount(0)
    , TotalPacketsReceived(0)
    , LastPacketTime(0.0)
    , CurrentJitter(0.0f)
{
    InterArrivalTimes.reserve(MaxInterArrivalSamples);
}

FPanaudiaJitterBuffer::~FPanaudiaJitterBuffer()
{
}

double FPanaudiaJitterBuffer::GetTimeSeconds() const
{
    auto Now = std::chrono::steady_clock::now();
    auto Duration = Now.time_since_epoch();
    return std::chrono::duration<double>(Duration).count();
}

void FPanaudiaJitterBuffer::Initialize(
    int32_t InSampleRate,
    int32_t InNumChannels,
    int32_t TargetLatencyMs,
    int32_t TargetWindowMs,
    int32_t ZoneWidthMs,
    int32_t MinLatencyMs,
    int32_t MaxLatencyMs,
    int32_t InCorrectionInterval)
{
    std::lock_guard<std::mutex> Lock(BufferLock);

    SampleRate = InSampleRate;
    NumChannels = InNumChannels;
    CorrectionInterval = InCorrectionInterval;

    // Convert ms to per-channel samples
    auto MsToSamples = [&](int32_t Ms) -> int32_t { return (Ms * SampleRate) / 1000; };

    TargetCentre = MsToSamples(TargetLatencyMs);
    int32_t HalfWindow = MsToSamples(TargetWindowMs) / 2;
    TargetLow = TargetCentre - HalfWindow;
    TargetHigh = TargetCentre + HalfWindow;

    int32_t ZoneStep = MsToSamples(ZoneWidthMs) / 3;
    Z1Low  = TargetLow  - ZoneStep;
    Z2Low  = TargetLow  - ZoneStep * 2;
    Z3Low  = TargetLow  - ZoneStep * 3;
    Z1High = TargetHigh + ZoneStep;
    Z2High = TargetHigh + ZoneStep * 2;
    Z3High = TargetHigh + ZoneStep * 3;

    MinSamples = MsToSamples(MinLatencyMs);
    MaxSamples = MsToSamples(MaxLatencyMs);

    // Clamp zone boundaries to min/max
    Z3Low = std::max(Z3Low, MinSamples);
    Z2Low = std::max(Z2Low, MinSamples);
    Z1Low = std::max(Z1Low, MinSamples);
    Z1High = std::min(Z1High, MaxSamples);
    Z2High = std::min(Z2High, MaxSamples);
    Z3High = std::min(Z3High, MaxSamples);

    // Allocate ring: 1 second of audio as headroom
    RingCapacity = SampleRate * NumChannels; // 1 second of interleaved floats
    RingBuffer.assign(RingCapacity, 0.0f);
    WritePos = 0;
    ReadPos = 0;
    BufferedFloats = 0;

    // Reset state
    State = EBufferState::Filling;
    CorrectionCounter = 0;
    TotalSamplesDropped = 0;
    TotalSamplesInserted = 0;
    UnderrunCount = 0;
    OverrunCount = 0;
    TotalPacketsReceived = 0;
    LastPacketTime = 0.0;
    CurrentJitter = 0.0f;
    InterArrivalTimes.clear();

    printf("[JitterBuffer] Target=%d-%dms, Zones=%dms, Min=%dms, Max=%dms, Correction every %d reads\n",
        TargetLatencyMs - TargetWindowMs / 2,
        TargetLatencyMs + TargetWindowMs / 2,
        ZoneWidthMs, MinLatencyMs, MaxLatencyMs, CorrectionInterval);
}

void FPanaudiaJitterBuffer::SetJitterBufferRange(int32_t MinMs, int32_t MaxMs, int32_t TargetMs)
{
    // Legacy compatibility: map old 3-param API to new zone API
    int32_t WindowMs = std::max(20, (MaxMs - MinMs) / 4);
    int32_t ZoneMs = std::max(10, (TargetMs - MinMs));
    Initialize(SampleRate, NumChannels, TargetMs, WindowMs, ZoneMs, MinMs, MaxMs, CorrectionInterval);
}

void FPanaudiaJitterBuffer::Reset()
{
    std::lock_guard<std::mutex> Lock(BufferLock);

    WritePos = 0;
    ReadPos = 0;
    BufferedFloats = 0;
    State = EBufferState::Filling;
    CorrectionCounter = 0;
    TotalSamplesDropped = 0;
    TotalSamplesInserted = 0;
    UnderrunCount = 0;
    OverrunCount = 0;
    TotalPacketsReceived = 0;
    LastPacketTime = 0.0;
    CurrentJitter = 0.0f;
    InterArrivalTimes.clear();
}

// ============================================================================
// Write Path
// ============================================================================

void FPanaudiaJitterBuffer::AddPacket(const std::vector<float>& AudioData, int32_t InNumSamples, int32_t InNumChannels)
{
    int32_t FloatsToWrite = InNumSamples * InNumChannels;
    if (FloatsToWrite <= 0 || FloatsToWrite > (int32_t)AudioData.size()) return;

    std::lock_guard<std::mutex> Lock(BufferLock);
    if (RingCapacity == 0) return;

    double Now = GetTimeSeconds();
    UpdateJitterStats(Now);
    TotalPacketsReceived++;

    AddPacketInternal(AudioData.data(), FloatsToWrite);
}

void FPanaudiaJitterBuffer::AddPacket(const float* AudioData, int32_t NumFloats, int32_t InNumChannels)
{
    (void)InNumChannels; // NumFloats already includes channels
    if (!AudioData || NumFloats <= 0) return;

    std::lock_guard<std::mutex> Lock(BufferLock);
    if (RingCapacity == 0) return;

    double Now = GetTimeSeconds();
    UpdateJitterStats(Now);
    TotalPacketsReceived++;

    AddPacketInternal(AudioData, NumFloats);
}

void FPanaudiaJitterBuffer::AddPacketInternal(const float* Src, int32_t FloatsToWrite)
{
    // If ring would overflow, advance read head to make room
    if (BufferedFloats + FloatsToWrite > RingCapacity)
    {
        int32_t Excess = (BufferedFloats + FloatsToWrite) - RingCapacity;
        ReadPos = (ReadPos + Excess) % RingCapacity;
        BufferedFloats -= Excess;
    }

    // Copy into ring with wrap
    int32_t Remaining = FloatsToWrite;
    const float* SrcPtr = Src;
    while (Remaining > 0)
    {
        int32_t SpaceToEnd = RingCapacity - WritePos;
        int32_t Chunk = std::min(Remaining, SpaceToEnd);
        memcpy(RingBuffer.data() + WritePos, SrcPtr, Chunk * sizeof(float));
        SrcPtr += Chunk;
        WritePos = (WritePos + Chunk) % RingCapacity;
        Remaining -= Chunk;
    }
    BufferedFloats += FloatsToWrite;
}

// ============================================================================
// Read Path
// ============================================================================

bool FPanaudiaJitterBuffer::GetAudio(float* OutAudioData, int32_t RequestedSamples, int32_t InNumChannels)
{
    std::lock_guard<std::mutex> Lock(BufferLock);

    if (RingCapacity == 0) return false;

    int32_t FloatsRequested = RequestedSamples * InNumChannels;
    int32_t FillSamples = GetFillSamples();

    // --- Filling state: wait for target fill before starting playback ---
    if (State == EBufferState::Filling)
    {
        if (FillSamples >= TargetLow)
        {
            State = EBufferState::Playing;
            printf("[JitterBuffer] Filling -> Playing (fill=%d samples, %.1fms)\n",
                FillSamples, (float)FillSamples / SampleRate * 1000.0f);
        }
        else
        {
            memset(OutAudioData, 0, FloatsRequested * sizeof(float));
            return false;
        }
    }

    // --- Overrun snap (read stall recovery) ---
    if (FillSamples > MaxSamples)
    {
        int32_t TargetFillFloats = TargetCentre * InNumChannels;
        int32_t Excess = BufferedFloats - TargetFillFloats;
        if (Excess > 0)
        {
            ReadPos = (ReadPos + Excess) % RingCapacity;
            BufferedFloats -= Excess;
        }
        OverrunCount++;
        FillSamples = GetFillSamples();
        printf("[JitterBuffer] Overrun snap (fill now=%d samples, %.1fms)\n",
            FillSamples, (float)FillSamples / SampleRate * 1000.0f);
    }

    // --- Underrun (write stall) ---
    if (FillSamples < MinSamples)
    {
        // Only log on transition from Playing to Filling (not every frame)
        if (State == EBufferState::Playing)
        {
            printf("[JitterBuffer] Underrun -> Filling (fill=%d samples)\n", FillSamples);
        }
        State = EBufferState::Filling;
        UnderrunCount++;

        // Discard any remaining stale data so that when writes resume,
        // only fresh audio accumulates. Without this, recovery would
        // replay a small fragment from before the dropout.
        ReadPos = WritePos;
        BufferedFloats = 0;

        memset(OutAudioData, 0, FloatsRequested * sizeof(float));
        return false;
    }

    // --- Determine zone-based correction ---
    int32_t Correction = 0; // positive = drop samples, negative = insert samples
    if (FillSamples > Z2High)          Correction = 4;
    else if (FillSamples > Z1High)     Correction = 2;
    else if (FillSamples > TargetHigh) Correction = 1;
    else if (FillSamples < Z2Low)      Correction = -4;
    else if (FillSamples < Z1Low)      Correction = -2;
    else if (FillSamples < TargetLow)  Correction = -1;

    // Only apply correction every N reads
    CorrectionCounter++;
    if (CorrectionCounter < CorrectionInterval)
    {
        Correction = 0;
    }
    else
    {
        CorrectionCounter = 0;
    }

    // --- Read from ring with correction ---
    if (Correction > 0)
    {
        // DROP: read RequestedSamples to output, advance ring by extra Correction samples
        int32_t FloatsToOutput = FloatsRequested;
        int32_t ExtraFloats = Correction * InNumChannels;
        int32_t FloatsToConsume = FloatsToOutput + ExtraFloats;

        // Don't consume more than available
        FloatsToConsume = std::min(FloatsToConsume, BufferedFloats);
        FloatsToOutput = std::min(FloatsToOutput, FloatsToConsume);

        RingCopy(OutAudioData, ReadPos, FloatsToOutput);
        ReadPos = (ReadPos + FloatsToConsume) % RingCapacity;
        BufferedFloats -= FloatsToConsume;
        TotalSamplesDropped += Correction;

        // Zero-fill if output was clamped short
        if (FloatsToOutput < FloatsRequested)
        {
            memset(OutAudioData + FloatsToOutput,
                0, (FloatsRequested - FloatsToOutput) * sizeof(float));
        }
    }
    else if (Correction < 0)
    {
        // INSERT: read fewer samples from ring, duplicate last sample to fill output
        int32_t InsertCount = -Correction; // positive number of samples to insert
        int32_t InsertFloats = InsertCount * InNumChannels;
        int32_t RealFloats = FloatsRequested - InsertFloats;

        // Ensure we read at least one frame's worth
        RealFloats = std::max(RealFloats, InNumChannels);
        RealFloats = std::min(RealFloats, BufferedFloats);

        RingCopy(OutAudioData, ReadPos, RealFloats);
        ReadPos = (ReadPos + RealFloats) % RingCapacity;
        BufferedFloats -= RealFloats;

        // Duplicate the last sample pair to fill the rest of the output
        int32_t Filled = RealFloats;
        while (Filled < FloatsRequested)
        {
            // Copy the last NumChannels floats (last sample) to extend
            int32_t SrcOffset = std::max(0, Filled - InNumChannels);
            int32_t CopyCount = std::min(InNumChannels, FloatsRequested - Filled);
            memcpy(OutAudioData + Filled, OutAudioData + SrcOffset, CopyCount * sizeof(float));
            Filled += CopyCount;
        }
        TotalSamplesInserted += InsertCount;
    }
    else
    {
        // No correction: straight read
        int32_t FloatsToRead = std::min(FloatsRequested, BufferedFloats);
        RingCopy(OutAudioData, ReadPos, FloatsToRead);
        ReadPos = (ReadPos + FloatsToRead) % RingCapacity;
        BufferedFloats -= FloatsToRead;

        // Zero-fill if we ran short (shouldn't happen after underrun check)
        if (FloatsToRead < FloatsRequested)
        {
            memset(OutAudioData + FloatsToRead, 0, (FloatsRequested - FloatsToRead) * sizeof(float));
        }
    }

    return true;
}

// ============================================================================
// Ring Helpers
// ============================================================================

void FPanaudiaJitterBuffer::RingCopy(float* Dst, int32_t FromPos, int32_t FloatCount) const
{
    int32_t Remaining = FloatCount;
    int32_t Pos = FromPos;
    float* Out = Dst;

    while (Remaining > 0)
    {
        int32_t SpaceToEnd = RingCapacity - Pos;
        int32_t Chunk = std::min(Remaining, SpaceToEnd);
        memcpy(Out, RingBuffer.data() + Pos, Chunk * sizeof(float));
        Out += Chunk;
        Pos = (Pos + Chunk) % RingCapacity;
        Remaining -= Chunk;
    }
}

int32_t FPanaudiaJitterBuffer::GetFillSamples() const
{
    return (NumChannels > 0) ? (BufferedFloats / NumChannels) : 0;
}

int32_t FPanaudiaJitterBuffer::GetCurrentZone() const
{
    int32_t Fill = GetFillSamples();
    if (Fill < Z2Low) return -3;
    if (Fill < Z1Low) return -2;
    if (Fill < TargetLow) return -1;
    if (Fill <= TargetHigh) return 0;
    if (Fill <= Z1High) return 1;
    if (Fill <= Z2High) return 2;
    return 3;
}

// ============================================================================
// Jitter Stats (write side)
// ============================================================================

void FPanaudiaJitterBuffer::UpdateJitterStats(double ArrivalTime)
{
    if (LastPacketTime > 0.0)
    {
        double InterArrival = ArrivalTime - LastPacketTime;

        if ((int32_t)InterArrivalTimes.size() >= MaxInterArrivalSamples)
        {
            InterArrivalTimes.erase(InterArrivalTimes.begin());
        }
        InterArrivalTimes.push_back(InterArrival);

        CurrentJitter = CalculateJitter();
    }

    LastPacketTime = ArrivalTime;
}

float FPanaudiaJitterBuffer::CalculateJitter() const
{
    if ((int32_t)InterArrivalTimes.size() < 2)
    {
        return 0.0f;
    }

    double Mean = 0.0;
    for (double Time : InterArrivalTimes)
    {
        Mean += Time;
    }
    Mean /= (double)InterArrivalTimes.size();

    double Variance = 0.0;
    for (double Time : InterArrivalTimes)
    {
        double Diff = Time - Mean;
        Variance += Diff * Diff;
    }
    Variance /= (double)InterArrivalTimes.size();

    return (float)(std::sqrt(Variance) * 1000.0); // ms
}

// ============================================================================
// Public Queries
// ============================================================================

FJitterBufferStats FPanaudiaJitterBuffer::GetStats()
{
    std::lock_guard<std::mutex> Lock(BufferLock);

    FJitterBufferStats Stats;
    Stats.FillLevelSamples = GetFillSamples();
    Stats.FillLevelMs = (SampleRate > 0) ? ((float)Stats.FillLevelSamples / SampleRate * 1000.0f) : 0.0f;
    Stats.CurrentZone = GetCurrentZone();
    Stats.UnderrunCount = UnderrunCount;
    Stats.OverrunCount = OverrunCount;
    Stats.SamplesDropped = TotalSamplesDropped;
    Stats.SamplesInserted = TotalSamplesInserted;
    Stats.TotalPacketsReceived = TotalPacketsReceived;
    Stats.AverageJitter = CurrentJitter;
    Stats.bIsPlaying = (State == EBufferState::Playing);

    return Stats;
}

float FPanaudiaJitterBuffer::GetCurrentLatencyMs()
{
    std::lock_guard<std::mutex> Lock(BufferLock);
    int32_t Fill = GetFillSamples();
    return (SampleRate > 0) ? ((float)Fill / SampleRate * 1000.0f) : 0.0f;
}
