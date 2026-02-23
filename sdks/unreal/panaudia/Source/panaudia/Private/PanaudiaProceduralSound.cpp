
#include "PanaudiaProceduralSound.h"
#include "PanaudiaJitterBuffer.h"

UPanaudiaProceduralSound::UPanaudiaProceduralSound(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
{
}

void UPanaudiaProceduralSound::SetJitterBuffer(FPanaudiaJitterBuffer* InJitterBuffer)
{
    JitterBufferPtr.store(InJitterBuffer, std::memory_order_release);
}

Audio::EAudioMixerStreamDataFormat::Type UPanaudiaProceduralSound::GetGeneratedPCMDataFormat() const
{
    return Audio::EAudioMixerStreamDataFormat::Float;
}

int32 UPanaudiaProceduralSound::OnGeneratePCMAudio(TArray<uint8>& OutAudio, int32 NumSamples)
{
    // NumSamples = total interleaved samples (all channels), not per-channel
    // OutAudio must be sized for NumSamples * sizeof(float)
    const int32 BytesNeeded = NumSamples * sizeof(float);
    OutAudio.SetNumZeroed(BytesNeeded); // Pre-zero: silence on underrun

    // Debug: log first few calls and then periodically
    static int GenCount = 0;
    GenCount++;

    FPanaudiaJitterBuffer* JB = JitterBufferPtr.load(std::memory_order_acquire);
    if (GenCount <= 3 || GenCount % 500 == 0)
    {
        printf("[Panaudia] OnGeneratePCMAudio #%d: NumSamples=%d NumChannels=%d JB=%p\n",
            GenCount, NumSamples, NumChannels, (void*)JB);
    }

    if (JB)
    {
        float* OutPtr = reinterpret_cast<float*>(OutAudio.GetData());
        int32 PerChannelSamples = NumSamples / NumChannels;
        bool GotAudio = JB->GetAudio(OutPtr, PerChannelSamples, NumChannels);

        if (GenCount <= 5 || GenCount % 500 == 0)
        {
            // Check peak amplitude
            float Peak = 0.0f;
            for (int32 i = 0; i < NumSamples; ++i)
            {
                float Abs = OutPtr[i] > 0 ? OutPtr[i] : -OutPtr[i];
                if (Abs > Peak) Peak = Abs;
            }
            printf("[Panaudia] OnGeneratePCMAudio: got=%d perCh=%d peak=%.6f outBytes=%d\n",
                GotAudio ? 1 : 0, PerChannelSamples, Peak, OutAudio.Num());
        }
    }

    // Always return NumSamples — silence is fine when no data available
    return NumSamples;
}
