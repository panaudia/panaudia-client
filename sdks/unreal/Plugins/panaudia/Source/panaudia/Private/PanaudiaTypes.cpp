
#include "PanaudiaTypes.h"

FPanaudiaNodeState FPanaudiaNodeState::FromUnrealCoordinates(const FVector& Position, const FRotator& Rotation)
{
    FPanaudiaNodeState State;

    // Convert Unreal (Z-up, cm) to Panaudia coordinates (Y-up, meters)
    // X (forward) -> X
    // Y (right) -> Z
    // Z (up) -> Y
    State.X = Position.X / 100.0f;  // cm to meters
    State.Y = Position.Z / 100.0f;  // Z becomes Y (up)
    State.Z = Position.Y / 100.0f;  // Y becomes Z

    // Convert rotation
    State.Yaw = FMath::DegreesToRadians(Rotation.Yaw);
    State.Pitch = FMath::DegreesToRadians(Rotation.Pitch);
    State.Roll = FMath::DegreesToRadians(Rotation.Roll);

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
    return FRotator(
        FMath::RadiansToDegrees(Pitch),
        FMath::RadiansToDegrees(Yaw),
        FMath::RadiansToDegrees(Roll)
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