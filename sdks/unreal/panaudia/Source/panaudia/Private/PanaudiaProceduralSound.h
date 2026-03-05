
#pragma once

#include "Sound/SoundWaveProcedural.h"
#include <atomic>

#include "PanaudiaProceduralSound.generated.h"

namespace panaudia { class PanaudiaCore; struct TrackHandle; }

/**
 * Custom procedural sound that reads decoded audio from PanaudiaCore
 * on the audio render thread. No game-tick involvement in the audio path.
 *
 * - Returns float PCM (no int16 conversion)
 * - Uses std::atomic for the Core/Track pointers (no mutex on audio thread)
 * - Pre-zeros output buffer so underruns produce silence
 */
UCLASS()
class PANAUDIA_API UPanaudiaProceduralSound : public USoundWaveProcedural
{
    GENERATED_BODY()

public:
    UPanaudiaProceduralSound(const FObjectInitializer& ObjectInitializer);

    /** Set the Core and Track pointers. Call from game thread only. Set both to nullptr before destroying Core. */
    void SetCore(panaudia::PanaudiaCore* InCore, panaudia::TrackHandle* InTrack);

    // USoundWaveProcedural overrides
    virtual Audio::EAudioMixerStreamDataFormat::Type GetGeneratedPCMDataFormat() const override;
    virtual int32 OnGeneratePCMAudio(TArray<uint8>& OutAudio, int32 NumSamples) override;

private:
    std::atomic<panaudia::PanaudiaCore*> CorePtr{nullptr};
    std::atomic<panaudia::TrackHandle*> TrackPtr{nullptr};
};
