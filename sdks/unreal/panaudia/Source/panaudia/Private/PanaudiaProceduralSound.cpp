
#include "PanaudiaProceduralSound.h"
#include <panaudia/core.h>

UPanaudiaProceduralSound::UPanaudiaProceduralSound(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
{
}

void UPanaudiaProceduralSound::SetCore(panaudia::PanaudiaCore* InCore, panaudia::TrackHandle* InTrack)
{
    // Store track first, then core (acquire reads core first, then track)
    TrackPtr.store(InTrack, std::memory_order_release);
    CorePtr.store(InCore, std::memory_order_release);
}

Audio::EAudioMixerStreamDataFormat::Type UPanaudiaProceduralSound::GetGeneratedPCMDataFormat() const
{
    return Audio::EAudioMixerStreamDataFormat::Float;
}

int32 UPanaudiaProceduralSound::OnGeneratePCMAudio(TArray<uint8>& OutAudio, int32 NumSamples)
{
    // NumSamples = total interleaved samples (all channels), not per-channel
    const int32 BytesNeeded = NumSamples * sizeof(float);
    OutAudio.SetNumZeroed(BytesNeeded); // Pre-zero: silence on underrun

    static int GenCount = 0;
    GenCount++;

    panaudia::PanaudiaCore* C = CorePtr.load(std::memory_order_acquire);
    panaudia::TrackHandle* T = TrackPtr.load(std::memory_order_acquire);

    if (GenCount <= 3 || GenCount % 500 == 0)
    {
        printf("[Panaudia] OnGeneratePCMAudio #%d: NumSamples=%d NumChannels=%d Core=%p Track=%p\n",
            GenCount, NumSamples, NumChannels, (void*)C, (void*)T);
    }

    if (C && T)
    {
        float* OutPtr = reinterpret_cast<float*>(OutAudio.GetData());
        int32 PerChannelSamples = NumSamples / NumChannels;
        uint32_t FramesRead = C->read_audio(T, OutPtr, PerChannelSamples, 0);

        if (GenCount <= 5 || GenCount % 500 == 0)
        {
            float Peak = 0.0f;
            for (int32 i = 0; i < NumSamples; ++i)
            {
                float Abs = OutPtr[i] > 0 ? OutPtr[i] : -OutPtr[i];
                if (Abs > Peak) Peak = Abs;
            }
            printf("[Panaudia] OnGeneratePCMAudio: framesRead=%u perCh=%d peak=%.6f outBytes=%d\n",
                FramesRead, PerChannelSamples, Peak, OutAudio.Num());
        }
    }

    // Always return NumSamples — silence is fine when no data available
    return NumSamples;
}
