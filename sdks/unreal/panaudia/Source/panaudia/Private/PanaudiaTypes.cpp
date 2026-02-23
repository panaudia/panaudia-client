
#include "PanaudiaTypes.h"

FPanaudiaNodeState FPanaudiaNodeState::FromUnrealCoordinates(const FVector& Position, const FRotator& Rotation, float WorldExtent)
{
    FPanaudiaNodeState State;

    // Convert Unreal (Z-up, left-handed, cm) to Panaudia coordinates (0-1 range)
    // UE origin (0,0,0) maps to Panaudia center (0.5, 0.5, 0.5)
    // UE ±WorldExtent maps to Panaudia 0..1
    // Axis remapping: UE X (forward) -> Panaudia X, UE Z (up) -> Panaudia Y, UE Y (right) -> Panaudia Z
    float Scale = 1.0f / (2.0f * WorldExtent);  // cm to 0-1 range
    State.X = FMath::Clamp(Position.X * Scale + 0.5f, 0.0f, 1.0f);
    State.Y = FMath::Clamp(Position.Z * Scale + 0.5f, 0.0f, 1.0f);  // Z (up) -> Y
    State.Z = FMath::Clamp(Position.Y * Scale + 0.5f, 0.0f, 1.0f);  // Y (right) -> Z

    // Convert rotation — Panaudia expects degrees, intrinsic Tait-Bryan yaw-pitch-roll
    // Both systems use same semantic: yaw=horizontal, pitch=up/down, roll=tilt
    // UE is left-handed (positive yaw = clockwise from above)
    // Panaudia expects anti-clockwise positive yaw, so negate
    State.Yaw = -Rotation.Yaw;
    State.Pitch = Rotation.Pitch;
    State.Roll = Rotation.Roll;

    return State;
}

FVector FPanaudiaNodeState::GetUnrealPosition() const
{
    // Convert back from Panaudia (Y-up, meters) to Unreal (Z-up, cm)
    return FVector(
        X * 100.0f,  // X stays X
        Z * 100.0f,  // Z becomes Y
        Y * 100.0f   // Y becomes Z (up)
    );
}

FRotator FPanaudiaNodeState::GetUnrealRotation() const
{
    // Reverse of FromUnrealCoordinates: negate yaw back, direct pitch/roll
    return FRotator(
        Pitch,  // UE Pitch
        -Yaw,   // UE Yaw (negate back from anti-clockwise to clockwise)
        Roll    // UE Roll
    );
}

TArray<uint8> FPanaudiaNodeState::ToDataBuffer() const
{
    // Serialize as 6 floats (24 bytes) - matches JavaScript implementation
    TArray<uint8> Buffer;
    Buffer.SetNum(24);

    float* FloatData = reinterpret_cast<float*>(Buffer.GetData());
    FloatData[0] = X;
    FloatData[1] = Y;
    FloatData[2] = Z;
    FloatData[3] = Yaw;
    FloatData[4] = Pitch;
    FloatData[5] = Roll;

    return Buffer;
}

FPanaudiaNodeState FPanaudiaNodeState::FromDataBuffer(const uint8* Data, int32 Size)
{
    FPanaudiaNodeState State;

    if (Size >= 24)
    {
        const float* FloatData = reinterpret_cast<const float*>(Data);
        State.X = FloatData[0];
        State.Y = FloatData[1];
        State.Z = FloatData[2];
        State.Yaw = FloatData[3];
        State.Pitch = FloatData[4];
        State.Roll = FloatData[5];
    }

    return State;
}