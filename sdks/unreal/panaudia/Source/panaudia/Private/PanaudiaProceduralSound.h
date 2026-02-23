
#pragma once

#include "Sound/SoundWaveProcedural.h"
#include <atomic>

#include "PanaudiaProceduralSound.generated.h"

class FPanaudiaJitterBuffer;

/**
 * Custom procedural sound that reads directly from the jitter buffer
 * on the audio render thread. No game-tick involvement in the audio path.
 *
 * - Returns float PCM (no int16 conversion)
 * - Uses std::atomic for the jitter buffer pointer (no mutex on audio thread for pointer check)
 * - Pre-zeros output buffer so underruns produce silence
 */
UCLASS()
class PANAUDIA_API UPanaudiaProceduralSound : public USoundWaveProcedural
{
    GENERATED_BODY()

public:
    UPanaudiaProceduralSound(const FObjectInitializer& ObjectInitializer);

    /** Set the jitter buffer pointer. Call from game thread only. Set to nullptr before destroying the buffer. */
    void SetJitterBuffer(FPanaudiaJitterBuffer* InJitterBuffer);

    // USoundWaveProcedural overrides
    virtual Audio::EAudioMixerStreamDataFormat::Type GetGeneratedPCMDataFormat() const override;
    virtual int32 OnGeneratePCMAudio(TArray<uint8>& OutAudio, int32 NumSamples) override;

private:
    std::atomic<FPanaudiaJitterBuffer*> JitterBufferPtr{nullptr};
};
