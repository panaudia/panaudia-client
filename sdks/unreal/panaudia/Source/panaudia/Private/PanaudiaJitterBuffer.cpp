
#include "PanaudiaJitterBuffer.h"

#include "CoreMinimal.h"
#include "HAL/PlatformTime.h"

FPanaudiaJitterBuffer::FPanaudiaJitterBuffer()
    : MinBufferSamples(960)        // 20ms at 48kHz
    , MaxBufferSamples(9600)       // 200ms at 48kHz
    , TargetBufferSamples(2880)    // 60ms at 48kHz
    , CurrentTargetSamples(2880)
    , SampleRate(48000)
    , bAdaptiveMode(true)
    , NextExpectedSequence(0)
    , LastReceivedSequence(-1)
    , CurrentSequence(0)
    , LastPacketTime(0.0)
    , FirstPacketTime(0.0)
    , TotalPacketsReceived(0)
    , PacketsLost(0)
    , UnderrunCount(0)
    , OverrunCount(0)
    , LastAdaptationTime(0.0)
    , CurrentJitter(0.0f)
    , MaxRecentJitter(0.0f)
    , AdaptationRate(0.1f)
    , UnderrunThreshold(0.05f)     // 5% threshold
    , OverrunThreshold(0.02f)      // 2% threshold
{
    InterArrivalTimes.Reserve(MaxInterArrivalSamples);
    JitterHistory.Reserve(JitterHistorySize);
}

FPanaudiaJitterBuffer::~FPanaudiaJitterBuffer()
{
    Reset();
}

void FPanaudiaJitterBuffer::Initialize(int32 MinBufferMs, int32 MaxBufferMs, int32 TargetBufferMs, int32 InSampleRate)
{
    FScopeLock Lock(&BufferLock);

    SampleRate = InSampleRate;

    // Convert milliseconds to samples
    MinBufferSamples = (MinBufferMs * SampleRate) / 1000;
    MaxBufferSamples = (MaxBufferMs * SampleRate) / 1000;
    TargetBufferSamples = (TargetBufferMs * SampleRate) / 1000;
    CurrentTargetSamples = TargetBufferSamples;

    Reset();

    UE_LOG(LogTemp, Log, TEXT("Jitter buffer initialized: Min=%dms, Max=%dms, Target=%dms"),
        MinBufferMs, MaxBufferMs, TargetBufferMs);
}

void FPanaudiaJitterBuffer::Reset()
{
    FScopeLock Lock(&BufferLock);

    PacketBuffer.Empty();
    InterArrivalTimes.Empty();
    JitterHistory.Empty();

    NextExpectedSequence = 0;
    LastReceivedSequence = -1;
    CurrentSequence = 0;
    LastPacketTime = 0.0;
    FirstPacketTime = 0.0;
    TotalPacketsReceived = 0;
    PacketsLost = 0;
    UnderrunCount = 0;
    OverrunCount = 0;
    CurrentJitter = 0.0f;
    MaxRecentJitter = 0.0f;
    CurrentTargetSamples = TargetBufferSamples;
    LastAdaptationTime = FPlatformTime::Seconds();
}

void FPanaudiaJitterBuffer::AddPacket(const TArray<float>& AudioData, int32 NumSamples, int32 NumChannels)
{
    FScopeLock Lock(&BufferLock);

    double CurrentTime = FPlatformTime::Seconds();

    // Create timed packet
    FTimedAudioPacket Packet;
    Packet.AudioData = AudioData;
    Packet.ReceiveTime = CurrentTime;
    Packet.SequenceNumber = CurrentSequence++;
    Packet.NumSamples = NumSamples;
    Packet.NumChannels = NumChannels;

    // Update timing statistics
    UpdateJitterStats(CurrentTime);

    // Add to buffer
    PacketBuffer.Add(Packet);
    TotalPacketsReceived++;

    // Track packet loss
    if (LastReceivedSequence >= 0)
    {
        int32 ExpectedSeq = LastReceivedSequence + 1;
        if (Packet.SequenceNumber > ExpectedSeq)
        {
            PacketsLost += (Packet.SequenceNumber - ExpectedSeq);
        }
    }
    LastReceivedSequence = Packet.SequenceNumber;

    // Remove old packets to prevent unbounded growth
    RemoveOldPackets();

    // Adapt buffer size if needed
    if (bAdaptiveMode && (CurrentTime - LastAdaptationTime) > AdaptationInterval)
    {
        AdaptBufferSize();
        LastAdaptationTime = CurrentTime;
    }
}

bool FPanaudiaJitterBuffer::GetAudio(float* OutAudioData, int32 RequestedSamples, int32 NumChannels)
{
    FScopeLock Lock(&BufferLock);

    int32 BufferedSamples = GetBufferedSampleCount();

    // Check if we have enough buffered audio
    if (BufferedSamples < CurrentTargetSamples)
    {
        // Buffer underrun - output silence
        FMemory::Memzero(OutAudioData, RequestedSamples * NumChannels * sizeof(float));
        UnderrunCount++;
        return false;
    }

    // Extract audio from oldest packets
    int32 SamplesNeeded = RequestedSamples;
    int32 OutputIndex = 0;

    while (SamplesNeeded > 0 && PacketBuffer.Num() > 0)
    {
        FTimedAudioPacket& Packet = PacketBuffer[0];
        int32 SamplesAvailable = Packet.NumSamples * Packet.NumChannels;
        int32 SamplesToCopy = FMath::Min(SamplesNeeded * NumChannels, SamplesAvailable);

        FMemory::Memcpy(
            OutAudioData + OutputIndex,
            Packet.AudioData.GetData(),
            SamplesToCopy * sizeof(float)
        );

        OutputIndex += SamplesToCopy;
        SamplesNeeded -= SamplesToCopy / NumChannels;

        // Remove consumed packet
        PacketBuffer.RemoveAt(0);
    }

    // Fill any remaining with silence (shouldn't happen if buffered correctly)
    if (SamplesNeeded > 0)
    {
        FMemory::Memzero(
            OutAudioData + OutputIndex,
            SamplesNeeded * NumChannels * sizeof(float)
        );
    }

    return true;
}

void FPanaudiaJitterBuffer::UpdateJitterStats(double ArrivalTime)
{
    if (LastPacketTime > 0.0)
    {
        double InterArrival = ArrivalTime - LastPacketTime;

        // Add to history
        if (InterArrivalTimes.Num() >= MaxInterArrivalSamples)
        {
            InterArrivalTimes.RemoveAt(0);
        }
        InterArrivalTimes.Add(InterArrival);

        // Calculate jitter
        CurrentJitter = CalculateJitter();

        // Track max jitter
        if (CurrentJitter > MaxRecentJitter)
        {
            MaxRecentJitter = CurrentJitter;
        }

        // Add to jitter history
        if (JitterHistory.Num() >= JitterHistorySize)
        {
            JitterHistory.RemoveAt(0);
        }
        JitterHistory.Add(CurrentJitter);
    }
    else
    {
        FirstPacketTime = ArrivalTime;
    }

    LastPacketTime = ArrivalTime;
}

float FPanaudiaJitterBuffer::CalculateJitter() const
{
    if (InterArrivalTimes.Num() < 2)
    {
        return 0.0f;
    }

    // Calculate mean
    double Mean = 0.0;
    for (double Time : InterArrivalTimes)
    {
        Mean += Time;
    }
    Mean /= InterArrivalTimes.Num();

    // Calculate standard deviation (jitter)
    double Variance = 0.0;
    for (double Time : InterArrivalTimes)
    {
        double Diff = Time - Mean;
        Variance += Diff * Diff;
    }
    Variance /= InterArrivalTimes.Num();

    return FMath::Sqrt(Variance) * 1000.0f; // Convert to milliseconds
}

float FPanaudiaJitterBuffer::CalculatePacketLossRate() const
{
    if (TotalPacketsReceived == 0)
    {
        return 0.0f;
    }

    int32 TotalExpected = TotalPacketsReceived + PacketsLost;
    return (float)PacketsLost / (float)TotalExpected;
}

void FPanaudiaJitterBuffer::AdaptBufferSize()
{
    if (!bAdaptiveMode)
    {
        return;
    }

    bool bShouldIncrease = ShouldIncreaseBuffer();
    bool bShouldDecrease = ShouldDecreaseBuffer();

    if (bShouldIncrease && !bShouldDecrease)
    {
        IncreaseBufferSize();
    }
    else if (bShouldDecrease && !bShouldIncrease)
    {
        DecreaseBufferSize();
    }

    // Reset max jitter after adaptation
    MaxRecentJitter = 0.0f;
}

bool FPanaudiaJitterBuffer::ShouldIncreaseBuffer() const
{
    // Increase if:
    // 1. High jitter
    // 2. Packet loss above threshold
    // 3. Frequent underruns

    float PacketLoss = CalculatePacketLossRate();
    bool bHighJitter = CurrentJitter > 30.0f; // 30ms jitter
    bool bHighPacketLoss = PacketLoss > 0.05f; // 5% loss
    bool bFrequentUnderruns = (TotalPacketsReceived > 100) &&
        ((float)UnderrunCount / TotalPacketsReceived > UnderrunThreshold);

    return bHighJitter || bHighPacketLoss || bFrequentUnderruns;
}

bool FPanaudiaJitterBuffer::ShouldDecreaseBuffer() const
{
    // Decrease if:
    // 1. Low jitter for extended period
    // 2. No packet loss
    // 3. No recent underruns
    // 4. Buffer is above minimum

    if (CurrentTargetSamples <= MinBufferSamples)
    {
        return false;
    }

    float PacketLoss = CalculatePacketLossRate();
    bool bLowJitter = CurrentJitter < 10.0f && MaxRecentJitter < 15.0f;
    bool bNoPacketLoss = PacketLoss < 0.01f; // Less than 1%
    bool bNoRecentUnderruns = (TotalPacketsReceived > 100) &&
        ((float)UnderrunCount / TotalPacketsReceived < OverrunThreshold);

    return bLowJitter && bNoPacketLoss && bNoRecentUnderruns;
}

void FPanaudiaJitterBuffer::IncreaseBufferSize()
{
    int32 Increase = (int32)(MinBufferSamples * 0.5f); // Increase by 50% of min buffer (10ms at 48kHz)
    CurrentTargetSamples = FMath::Min(CurrentTargetSamples + Increase, MaxBufferSamples);

    float NewLatencyMs = (float)CurrentTargetSamples / SampleRate * 1000.0f;
    UE_LOG(LogTemp, Log, TEXT("Jitter buffer increased to %.1fms (jitter: %.1fms, loss: %.2f%%)"),
        NewLatencyMs, CurrentJitter, CalculatePacketLossRate() * 100.0f);
}

void FPanaudiaJitterBuffer::DecreaseBufferSize()
{
    int32 Decrease = (int32)(MinBufferSamples * 0.25f); // Decrease by 25% of min buffer (5ms at 48kHz)
    CurrentTargetSamples = FMath::Max(CurrentTargetSamples - Decrease, MinBufferSamples);

    float NewLatencyMs = (float)CurrentTargetSamples / SampleRate * 1000.0f;
    UE_LOG(LogTemp, Log, TEXT("Jitter buffer decreased to %.1fms (low jitter: %.1fms)"),
        NewLatencyMs, CurrentJitter);
}

int32 FPanaudiaJitterBuffer::GetBufferedSampleCount() const
{
    int32 TotalSamples = 0;
    for (const FTimedAudioPacket& Packet : PacketBuffer)
    {
        TotalSamples += Packet.NumSamples;
    }
    return TotalSamples;
}

void FPanaudiaJitterBuffer::RemoveOldPackets()
{
    // Remove packets if buffer grows too large (double max size)
    int32 BufferedSamples = GetBufferedSampleCount();
    if (BufferedSamples > MaxBufferSamples * 2)
    {
        // Remove oldest packets until we're at max size
        while (BufferedSamples > MaxBufferSamples && PacketBuffer.Num() > 0)
        {
            BufferedSamples -= PacketBuffer[0].NumSamples;
            PacketBuffer.RemoveAt(0);
            OverrunCount++;
        }

        UE_LOG(LogTemp, Warning, TEXT("Jitter buffer overflow - removed old packets"));
    }
}

FJitterBufferStats FPanaudiaJitterBuffer::GetStats()
{
    FScopeLock Lock(&BufferLock);

    FJitterBufferStats Stats;
    Stats.AverageJitter = CurrentJitter;
    Stats.MaxJitter = MaxRecentJitter;
    Stats.PacketLossRate = CalculatePacketLossRate();
    Stats.BufferedPackets = PacketBuffer.Num();
    Stats.CurrentBufferSize = CurrentTargetSamples;
    Stats.UnderrunCount = UnderrunCount;
    Stats.TotalPacketsReceived = TotalPacketsReceived;

    return Stats;
}

void FPanaudiaJitterBuffer::SetAdaptiveMode(bool bEnabled)
{
    bAdaptiveMode = bEnabled;
    UE_LOG(LogTemp, Log, TEXT("Jitter buffer adaptive mode: %s"), bEnabled ? TEXT("enabled") : TEXT("disabled"));
}

float FPanaudiaJitterBuffer::GetCurrentLatencyMs()
{
    return (float)CurrentTargetSamples / SampleRate * 1000.0f;
}