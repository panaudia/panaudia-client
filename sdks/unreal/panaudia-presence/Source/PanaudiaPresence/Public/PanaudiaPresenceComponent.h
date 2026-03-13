#pragma once

#include "Components/ActorComponent.h"
#include "PanaudiaPresenceComponent.generated.h"

class UPanaudiaAudioComponent;

// Spawn info passed to the spawn delegate
struct FParticipantSpawnInfo
{
    FString Uuid;
    FVector Location;
    FRotator Rotation;
    FString AttributesJson;  // Raw JSON string — game code parses application-specific fields
};

// Spawn delegate — host returns the actor to use for a new participant
DECLARE_DELEGATE_RetVal_OneParam(AActor*, FOnSpawnParticipant, const FParticipantSpawnInfo& /*Info*/);

// Update delegate — if bound, the host handles positioning the actor instead of the plugin.
// Called on every state update and every interpolation tick.
DECLARE_DELEGATE_ThreeParams(FOnUpdateParticipant, AActor* /*Actor*/, const FVector& /*Location*/, const FRotator& /*Rotation*/);

// Delegates for game code / Blueprint
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnParticipantJoined, const FString&, NodeUuid, AActor*, Actor);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
    FOnParticipantLeft, const FString&, NodeUuid);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_FourParams(
    FOnParticipantStateChanged, const FString&, NodeUuid, FVector, Location, FRotator, Rotation, float, Volume);

UCLASS(ClassGroup=(Audio), meta=(BlueprintSpawnableComponent))
class PANAUDIAPRESENCE_API UPanaudiaPresenceComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPanaudiaPresenceComponent();

    // Configuration

    /** Actor class to spawn per remote participant. If null, spawns a default capsule. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PanaudiaPresence")
    TSubclassOf<AActor> RemotePlayerClass;

    /** Local player's node UUID — state updates with this UUID are ignored (no self-spawn). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PanaudiaPresence")
    FString LocalNodeUuid;

    /** Half-width of UE world in cm mapping to Panaudia 0-1 range. Must match the audio component's value. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PanaudiaPresence", meta = (ClampMin = "100", ClampMax = "100000"))
    float WorldExtent = 5000.0f;

    /** Auto-discover UPanaudiaAudioComponent on same actor in BeginPlay. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PanaudiaPresence")
    bool bAutoFindAudioComponent = true;

    /** Enable smooth interpolation of participant positions between state updates. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PanaudiaPresence")
    bool bEnableSmoothing = true;

    /** Smoothing factor — each frame moves 1/N of remaining distance. Higher = smoother, lower = snappier. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PanaudiaPresence", meta = (ClampMin = "2", ClampMax = "60", EditCondition = "bEnableSmoothing"))
    float InterpolationSpeed = 20.0f;

    // Public methods

    UFUNCTION(BlueprintPure, Category = "PanaudiaPresence")
    int32 GetParticipantCount() const;

    UFUNCTION(BlueprintPure, Category = "PanaudiaPresence")
    AActor* GetParticipantActor(const FString& NodeUuid) const;

    // Spawn delegate — bind to control what actor is created per participant.
    // If bound, RemotePlayerClass and SpawnDefaultActor are skipped.
    FOnSpawnParticipant SpawnParticipantDelegate;

    // Update delegate — bind to override how participant actors are positioned.
    // If bound, the plugin calls this instead of SetActorLocationAndRotation.
    FOnUpdateParticipant UpdateParticipantDelegate;

    // Delegates

    UPROPERTY(BlueprintAssignable, Category = "PanaudiaPresence")
    FOnParticipantJoined OnParticipantJoined;

    UPROPERTY(BlueprintAssignable, Category = "PanaudiaPresence")
    FOnParticipantLeft OnParticipantLeft;

    UPROPERTY(BlueprintAssignable, Category = "PanaudiaPresence")
    FOnParticipantStateChanged OnParticipantStateChanged;

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    struct FRemoteParticipant
    {
        FString Uuid;
        FVector Location;         // current (interpolated) position
        FRotator Rotation;        // current (interpolated) rotation
        FVector TargetLocation;   // latest received position
        FRotator TargetRotation;  // latest received rotation
        float Volume = 1.0f;
        FString AttributesJson;
        AActor* Actor = nullptr;
    };

    TMap<FString, FRemoteParticipant> Participants;

    // Attributes JSON received before the first state update (pre-spawn cache)
    TMap<FString, FString> PendingAttributes;

    // State received before the first attributes update (pre-spawn cache)
    struct FPendingStateData
    {
        FVector Location;
        FRotator Rotation;
        float Volume;
    };
    TMap<FString, FPendingStateData> PendingState;

    UFUNCTION()
    void OnDataTrackReceived(const FString& TrackName, const TArray<uint8>& Data);

    void HandleStateData(const TArray<uint8>& Data);
    void HandleAttributesData(const TArray<uint8>& Data);

    // Spawn a participant once we have both state and attributes
    void SpawnParticipant(const FString& Uuid, const FVector& Location, const FRotator& Rotation, float Volume, const FString& AttributesJson);

    AActor* SpawnDefaultActor(const FVector& Location);

    static FString UuidBytesToString(const uint8* Bytes);
};
