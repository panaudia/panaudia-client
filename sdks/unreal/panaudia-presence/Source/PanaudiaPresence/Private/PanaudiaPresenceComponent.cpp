#include "PanaudiaPresenceComponent.h"
#include "PanaudiaPresenceModule.h"

#include "PanaudiaAudioComponent.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"
#include "Json.h"

// NodeInfo3 binary size: UUID(16) + Position(12) + Rotation(12) + Volume(4) + Gone(4)
static constexpr int32 NODE_INFO3_SIZE = 48;

UPanaudiaPresenceComponent::UPanaudiaPresenceComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UPanaudiaPresenceComponent::BeginPlay()
{
    Super::BeginPlay();

    UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence::BeginPlay on %s"), *GetOwner()->GetName());

    if (bAutoFindAudioComponent)
    {
        if (AActor* Owner = GetOwner())
        {
            UPanaudiaAudioComponent* AudioComp = Owner->FindComponentByClass<UPanaudiaAudioComponent>();
            if (AudioComp)
            {
                AudioComp->bEnablePresenceTracks = true;
                AudioComp->OnDataTrackReceived.AddDynamic(this, &UPanaudiaPresenceComponent::OnDataTrackReceived);
                // Attributes now arrive merged on the cache-aware delegates, not
                // as raw payloads on OnDataTrackReceived. Bind both.
                AudioComp->OnAttributeValuesChanged.AddDynamic(this, &UPanaudiaPresenceComponent::HandleAttributeValues);
                AudioComp->OnAttributesRemoved.AddDynamic(this, &UPanaudiaPresenceComponent::HandleAttributesRemoved);
                UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence: Bound to OnDataTrackReceived + attribute delegates on %s (presence tracks enabled)"), *Owner->GetName());
            }
            else
            {
                UE_LOG(LogPanaudiaPresence, Error, TEXT("PanaudiaPresence: NO PanaudiaAudioComponent found on %s!"), *Owner->GetName());
            }
        }
    }
}

void UPanaudiaPresenceComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // Unbind delegate
    if (bAutoFindAudioComponent)
    {
        if (AActor* Owner = GetOwner())
        {
            UPanaudiaAudioComponent* AudioComp = Owner->FindComponentByClass<UPanaudiaAudioComponent>();
            if (AudioComp)
            {
                AudioComp->OnDataTrackReceived.RemoveDynamic(this, &UPanaudiaPresenceComponent::OnDataTrackReceived);
                AudioComp->OnAttributeValuesChanged.RemoveDynamic(this, &UPanaudiaPresenceComponent::HandleAttributeValues);
                AudioComp->OnAttributesRemoved.RemoveDynamic(this, &UPanaudiaPresenceComponent::HandleAttributesRemoved);
            }
        }
    }

    // Destroy all spawned actors
    for (auto& Pair : Participants)
    {
        if (Pair.Value.Actor && IsValid(Pair.Value.Actor))
        {
            Pair.Value.Actor->Destroy();
        }
    }
    Participants.Empty();
    PendingAttributes.Empty();
    PendingState.Empty();
    NodeAttributes.Empty();

    Super::EndPlay(EndPlayReason);
}

// ============================================================================
// Tick — Smooth Interpolation
// ============================================================================

void UPanaudiaPresenceComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bEnableSmoothing)
    {
        return;
    }

    // Fixed-fraction interpolation (matches the three.js client behaviour).
    // Each frame, move 1/SmoothingFactor of the remaining distance.
    const float Factor = InterpolationSpeed;

    for (auto& Pair : Participants)
    {
        FRemoteParticipant& P = Pair.Value;
        if (!P.Actor || !IsValid(P.Actor))
        {
            continue;
        }

        FVector Delta = P.TargetLocation - P.Location;
        if (Delta.SizeSquared() > 0.01f)
        {
            P.Location += Delta / Factor;
        }
        else
        {
            P.Location = P.TargetLocation;
        }

        // Snap rotation directly (same as the JS client)
        P.Rotation = P.TargetRotation;

        if (UpdateParticipantDelegate.IsBound())
        {
            UpdateParticipantDelegate.Execute(P.Actor, P.Location, P.Rotation);
        }
        else
        {
            P.Actor->SetActorLocationAndRotation(P.Location, P.Rotation);
        }
    }
}

// ============================================================================
// Public API
// ============================================================================

int32 UPanaudiaPresenceComponent::GetParticipantCount() const
{
    return Participants.Num();
}

AActor* UPanaudiaPresenceComponent::GetParticipantActor(const FString& NodeUuid) const
{
    const FRemoteParticipant* P = Participants.Find(NodeUuid);
    return P ? P->Actor : nullptr;
}

// ============================================================================
// Data Track Dispatch
// ============================================================================

void UPanaudiaPresenceComponent::OnDataTrackReceived(const FString& TrackName, const TArray<uint8>& Data)
{
    if (TrackName == TEXT("state_output"))
    {
        HandleStateData(Data);
    }
    else if (TrackName == TEXT("attributes_output"))
    {
        HandleAttributesData(Data);
    }
}

// ============================================================================
// State Parsing (NodeInfo3 binary)
// ============================================================================

void UPanaudiaPresenceComponent::HandleStateData(const TArray<uint8>& Data)
{
    if (Data.Num() < NODE_INFO3_SIZE)
    {
        UE_LOG(LogPanaudiaPresence, Warning, TEXT("PanaudiaPresence: HandleStateData too short: %d < %d"), Data.Num(), NODE_INFO3_SIZE);
        return;
    }

    const uint8* Raw = Data.GetData();

    // Parse UUID (bytes 0-15)
    FString Uuid = UuidBytesToString(Raw);

    // Skip local player
    if (!LocalNodeUuid.IsEmpty() && Uuid == LocalNodeUuid)
    {
        return;
    }

    // Parse position (bytes 16-27, float32 LE — Panaudia 0-1 range)
    float PanX, PanY, PanZ;
    FMemory::Memcpy(&PanX, Raw + 16, 4);
    FMemory::Memcpy(&PanY, Raw + 20, 4);
    FMemory::Memcpy(&PanZ, Raw + 24, 4);

    // Parse rotation (bytes 28-39, float32 LE, degrees)
    float PanYaw, PanPitch, PanRoll;
    FMemory::Memcpy(&PanYaw,   Raw + 28, 4);
    FMemory::Memcpy(&PanPitch, Raw + 32, 4);
    FMemory::Memcpy(&PanRoll,  Raw + 36, 4);

    // Parse volume (bytes 40-43)
    float Volume;
    FMemory::Memcpy(&Volume, Raw + 40, 4);

    // Parse gone flag (bytes 44-47)
    int32 Gone;
    FMemory::Memcpy(&Gone, Raw + 44, 4);

    // Handle gone flag — participant left
    if (Gone != 0)
    {
        FRemoteParticipant* Existing = Participants.Find(Uuid);
        if (Existing)
        {
            if (Existing->Actor && IsValid(Existing->Actor))
            {
                Existing->Actor->Destroy();
            }
            Participants.Remove(Uuid);
            OnParticipantLeft.Broadcast(Uuid);
            UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence: Participant left: %s"), *Uuid);
        }
        // Also clean up any pending data for this UUID
        PendingAttributes.Remove(Uuid);
        PendingState.Remove(Uuid);
        return;
    }

    // Convert Panaudia coordinates (0-1 range) to UE coordinates
    // Panaudia: X forward, Y left, Z up.  UE: X forward, Y right, Z up.
    FVector UEPos;
    UEPos.X = (PanX - 0.5f) * 2.0f * WorldExtent;
    UEPos.Y = -(PanY - 0.5f) * 2.0f * WorldExtent;  // Panaudia Y (left) -> negate -> UE Y (right)
    UEPos.Z = (PanZ - 0.5f) * 2.0f * WorldExtent;

    // Reverse rotation: negate yaw (Panaudia anti-clockwise -> UE clockwise), swap pitch/roll
    FRotator UERot(PanPitch, -PanYaw, PanRoll);


    // Spawn or update
    FRemoteParticipant* P = Participants.Find(Uuid);
    if (!P)
    {
        // New participant — check if we already have attributes cached
        FString* CachedAttrs = PendingAttributes.Find(Uuid);
        if (CachedAttrs)
        {
            // We have both state and attributes — spawn now
            SpawnParticipant(Uuid, UEPos, UERot, Volume, *CachedAttrs);
            PendingAttributes.Remove(Uuid);
        }
        else
        {
            // No attributes yet — cache state and wait
            FPendingStateData StateData;
            StateData.Location = UEPos;
            StateData.Rotation = UERot;
            StateData.Volume = Volume;
            PendingState.Add(Uuid, StateData);
            UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence: State cached for %s (waiting for attributes)"), *Uuid);
        }
    }
    else
    {
        // Update existing — set target for interpolation
        P->TargetLocation = UEPos;
        P->TargetRotation = UERot;
        P->Volume = Volume;

        // If smoothing is off, snap immediately
        if (!bEnableSmoothing && P->Actor && IsValid(P->Actor))
        {
            P->Location = UEPos;
            P->Rotation = UERot;
            if (UpdateParticipantDelegate.IsBound())
            {
                UpdateParticipantDelegate.Execute(P->Actor, UEPos, UERot);
            }
            else
            {
                P->Actor->SetActorLocationAndRotation(UEPos, UERot);
            }
        }

        OnParticipantStateChanged.Broadcast(Uuid, UEPos, UERot, P->Volume);
    }
}

// ============================================================================
// Spawn — called once we have both state and attributes
// ============================================================================

void UPanaudiaPresenceComponent::SpawnParticipant(const FString& Uuid, const FVector& Location, const FRotator& Rotation, float Volume, const FString& AttributesJson)
{
    FRemoteParticipant NewP;
    NewP.Uuid = Uuid;
    NewP.Location = Location;
    NewP.Rotation = Rotation;
    NewP.TargetLocation = Location;
    NewP.TargetRotation = Rotation;
    NewP.Volume = Volume;
    NewP.AttributesJson = AttributesJson;

    FParticipantSpawnInfo Info;
    Info.Uuid = Uuid;
    Info.Location = Location;
    Info.Rotation = Rotation;
    Info.AttributesJson = AttributesJson;

    if (SpawnParticipantDelegate.IsBound())
    {
        NewP.Actor = SpawnParticipantDelegate.Execute(Info);
    }
    else if (RemotePlayerClass)
    {
        FActorSpawnParameters SpawnParams;
        SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
        NewP.Actor = GetWorld()->SpawnActor<AActor>(RemotePlayerClass, Location, Rotation, SpawnParams);
    }
    else
    {
        NewP.Actor = SpawnDefaultActor(Location);
    }

    if (NewP.Actor)
    {
        if (UpdateParticipantDelegate.IsBound())
        {
            UpdateParticipantDelegate.Execute(NewP.Actor, Location, Rotation);
        }
        else
        {
            NewP.Actor->SetActorLocationAndRotation(Location, Rotation);
        }
    }

    AActor* SpawnedActor = NewP.Actor;
    Participants.Add(Uuid, MoveTemp(NewP));

    OnParticipantJoined.Broadcast(Uuid, SpawnedActor);
    UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence: Spawned participant %s at (%.0f, %.0f, %.0f) actor=%s"),
        *Uuid,
        Location.X, Location.Y, Location.Z,
        SpawnedActor ? *SpawnedActor->GetName() : TEXT("NULL"));

    OnParticipantStateChanged.Broadcast(Uuid, Location, Rotation, Volume);
}

// ============================================================================
// Attributes Handling (JSON — passed through as opaque string)
// ============================================================================

void UPanaudiaPresenceComponent::HandleAttributesData(const TArray<uint8>& Data)
{
    if (Data.Num() == 0) return;

    // UTF-8 decode
    FUTF8ToTCHAR Conv(reinterpret_cast<const char*>(Data.GetData()), Data.Num());
    FString JsonString(Conv.Length(), Conv.Get());

    // Extract UUID — the only field the plugin needs
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);
    if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid())
    {
        return;
    }

    FString Uuid = JsonObject->GetStringField(TEXT("uuid"));
    if (Uuid.IsEmpty()) return;

    // Skip local player
    if (!LocalNodeUuid.IsEmpty() && Uuid == LocalNodeUuid)
    {
        return;
    }

    UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence: Attributes received for %s"), *Uuid);

    ApplyAttributesForNode(Uuid, JsonString);
}

// ============================================================================
// Cache-aware attribute path (panaudia-statecache per-key ops)
// ============================================================================
//
// The audio component decodes + opID-merges the attribute cache envelope and
// broadcasts per-key ops on the game thread. Keys are "{uuid}.<dotted.field>";
// values are JSON-serialised ("\"alice\"", "42", "true"). We fold the leaves
// back into a per-uuid object and reuse the spawn/pending machinery the old
// raw-JSON path used. Runs on the game thread (the audio component marshals
// the broadcast via AsyncTask), so touching Participants/spawning is safe.

void UPanaudiaPresenceComponent::HandleAttributeValues(const TArray<FPanaudiaAttributeValue>& Values)
{
    TSet<FString> Affected;

    for (const FPanaudiaAttributeValue& V : Values)
    {
        FString Uuid, FieldPath;
        if (!V.Key.Split(TEXT("."), &Uuid, &FieldPath))
        {
            // Bare uuid — node is known but carries no field to set.
            Uuid = V.Key;
            FieldPath.Empty();
        }
        if (Uuid.IsEmpty()) continue;
        if (!LocalNodeUuid.IsEmpty() && Uuid == LocalNodeUuid) continue;

        TSharedPtr<FJsonObject>& Node = NodeAttributes.FindOrAdd(Uuid);
        if (!Node.IsValid())
        {
            Node = MakeShared<FJsonObject>();
        }

        if (!FieldPath.IsEmpty())
        {
            // Parse the JSON-serialised value. UE's reader wants an object at
            // the root, so wrap the (possibly scalar) value and unwrap it.
            const FString Wrapped = FString::Printf(TEXT("{\"v\":%s}"), *V.Value);
            TSharedPtr<FJsonObject> Holder;
            TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Wrapped);
            if (FJsonSerializer::Deserialize(Reader, Holder) && Holder.IsValid())
            {
                TSharedPtr<FJsonValue> Parsed = Holder->TryGetField(TEXT("v"));
                if (Parsed.IsValid())
                {
                    // Walk/create the dotted path under the node, set the leaf.
                    TArray<FString> Parts;
                    FieldPath.ParseIntoArray(Parts, TEXT("."));
                    TSharedPtr<FJsonObject> Cursor = Node;
                    for (int32 i = 0; i + 1 < Parts.Num(); ++i)
                    {
                        const TSharedPtr<FJsonObject>* Child = nullptr;
                        if (Cursor->TryGetObjectField(Parts[i], Child) && Child && (*Child).IsValid())
                        {
                            Cursor = *Child;
                        }
                        else
                        {
                            TSharedPtr<FJsonObject> NewChild = MakeShared<FJsonObject>();
                            Cursor->SetObjectField(Parts[i], NewChild);
                            Cursor = NewChild;
                        }
                    }
                    if (Parts.Num() > 0)
                    {
                        Cursor->SetField(Parts.Last(), Parsed);
                    }
                }
            }
        }

        Affected.Add(Uuid);
    }

    for (const FString& Uuid : Affected)
    {
        ApplyAttributesForNode(Uuid, SerializeNodeAttributes(Uuid));
    }
}

void UPanaudiaPresenceComponent::HandleAttributesRemoved(const TArray<FString>& Keys)
{
    TSet<FString> Affected;

    for (const FString& Key : Keys)
    {
        FString Uuid, FieldPath;
        if (!Key.Split(TEXT("."), &Uuid, &FieldPath))
        {
            Uuid = Key;
            FieldPath.Empty();
        }
        if (Uuid.IsEmpty()) continue;
        if (!LocalNodeUuid.IsEmpty() && Uuid == LocalNodeUuid) continue;

        if (FieldPath.IsEmpty())
        {
            // Whole node removed (e.g. participant departed).
            NodeAttributes.Remove(Uuid);
            RemoveParticipant(Uuid);
            continue;
        }

        TSharedPtr<FJsonObject>* NodePtr = NodeAttributes.Find(Uuid);
        if (!NodePtr || !(*NodePtr).IsValid()) continue;

        // Remove the leaf at the dotted path.
        TArray<FString> Parts;
        FieldPath.ParseIntoArray(Parts, TEXT("."));
        TSharedPtr<FJsonObject> Cursor = *NodePtr;
        bool bPathValid = true;
        for (int32 i = 0; i + 1 < Parts.Num(); ++i)
        {
            const TSharedPtr<FJsonObject>* Child = nullptr;
            if (Cursor->TryGetObjectField(Parts[i], Child) && Child && (*Child).IsValid())
            {
                Cursor = *Child;
            }
            else
            {
                bPathValid = false;
                break;
            }
        }
        if (bPathValid && Parts.Num() > 0)
        {
            Cursor->RemoveField(Parts.Last());
        }

        if ((*NodePtr)->Values.Num() == 0)
        {
            // Last attribute gone — treat as a departed node.
            NodeAttributes.Remove(Uuid);
            RemoveParticipant(Uuid);
        }
        else
        {
            Affected.Add(Uuid);
        }
    }

    for (const FString& Uuid : Affected)
    {
        if (FRemoteParticipant* P = Participants.Find(Uuid))
        {
            P->AttributesJson = SerializeNodeAttributes(Uuid);
        }
    }
}

FString UPanaudiaPresenceComponent::SerializeNodeAttributes(const FString& Uuid) const
{
    // Build an output object: the node's accumulated fields plus a "uuid"
    // field, preserving the shape AttributesJson consumers saw on the old path.
    TSharedRef<FJsonObject> Out = MakeShared<FJsonObject>();
    if (const TSharedPtr<FJsonObject>* NodePtr = NodeAttributes.Find(Uuid))
    {
        if ((*NodePtr).IsValid())
        {
            Out->Values = (*NodePtr)->Values;  // shallow copy of the field map
        }
    }
    Out->SetStringField(TEXT("uuid"), Uuid);

    FString JsonString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonString);
    FJsonSerializer::Serialize(Out, Writer);
    return JsonString;
}

void UPanaudiaPresenceComponent::ApplyAttributesForNode(const FString& Uuid, const FString& AttributesJson)
{
    FRemoteParticipant* P = Participants.Find(Uuid);
    if (P)
    {
        // Update existing participant's attributes
        P->AttributesJson = AttributesJson;
    }
    else
    {
        // Check if we have pending state for this UUID
        FPendingStateData* CachedState = PendingState.Find(Uuid);
        if (CachedState)
        {
            // We have both state and attributes — spawn now
            SpawnParticipant(Uuid, CachedState->Location, CachedState->Rotation, CachedState->Volume, AttributesJson);
            PendingState.Remove(Uuid);
        }
        else
        {
            // No state yet — cache attributes and wait
            PendingAttributes.Add(Uuid, AttributesJson);
            UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence: Attributes cached for %s (waiting for state)"), *Uuid);
        }
    }
}

void UPanaudiaPresenceComponent::RemoveParticipant(const FString& Uuid)
{
    if (FRemoteParticipant* Existing = Participants.Find(Uuid))
    {
        if (Existing->Actor && IsValid(Existing->Actor))
        {
            Existing->Actor->Destroy();
        }
        Participants.Remove(Uuid);
        OnParticipantLeft.Broadcast(Uuid);
        UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence: Participant removed (attribute tombstone): %s"), *Uuid);
    }
    PendingAttributes.Remove(Uuid);
    PendingState.Remove(Uuid);
}

// ============================================================================
// Default Actor Spawning
// ============================================================================

AActor* UPanaudiaPresenceComponent::SpawnDefaultActor(const FVector& Location)
{
    UWorld* World = GetWorld();
    if (!World) return nullptr;

    FActorSpawnParameters SpawnParams;
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    AActor* NewActor = World->SpawnActor<AActor>(AActor::StaticClass(), Location, FRotator::ZeroRotator, SpawnParams);
    if (!NewActor) return nullptr;

    // Add a visible sphere mesh
    UStaticMeshComponent* Sphere = NewObject<UStaticMeshComponent>(NewActor, TEXT("SphereMesh"));
    Sphere->SetCollisionProfileName(TEXT("NoCollision"));

    UStaticMesh* SphereMesh = LoadObject<UStaticMesh>(nullptr,
        TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    if (SphereMesh)
    {
        Sphere->SetStaticMesh(SphereMesh);
    }

    Sphere->SetWorldScale3D(FVector(0.5f)); // ~50cm diameter
    Sphere->RegisterComponent();
    NewActor->SetRootComponent(Sphere);

    return NewActor;
}

// ============================================================================
// UUID Helpers
// ============================================================================

FString UPanaudiaPresenceComponent::UuidBytesToString(const uint8* Bytes)
{
    // 16 raw bytes -> "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    return FString::Printf(
        TEXT("%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x"),
        Bytes[0], Bytes[1], Bytes[2], Bytes[3],
        Bytes[4], Bytes[5],
        Bytes[6], Bytes[7],
        Bytes[8], Bytes[9],
        Bytes[10], Bytes[11], Bytes[12], Bytes[13], Bytes[14], Bytes[15]);
}
