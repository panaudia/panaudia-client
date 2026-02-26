#include "PanaudiaMoqProtocol.h"

namespace MoqProtocol
{

// --- Varint ---

int32 EncodeVarint(uint64 Value, uint8* Buffer)
{
    if (Value <= 63)
    {
        Buffer[0] = static_cast<uint8>(Value);
        return 1;
    }
    else if (Value <= 16383)
    {
        Buffer[0] = static_cast<uint8>((Value >> 8) | 0x40);
        Buffer[1] = static_cast<uint8>(Value & 0xFF);
        return 2;
    }
    else if (Value <= 1073741823)
    {
        Buffer[0] = static_cast<uint8>((Value >> 24) | 0x80);
        Buffer[1] = static_cast<uint8>((Value >> 16) & 0xFF);
        Buffer[2] = static_cast<uint8>((Value >> 8) & 0xFF);
        Buffer[3] = static_cast<uint8>(Value & 0xFF);
        return 4;
    }
    else
    {
        Buffer[0] = static_cast<uint8>((Value >> 56) | 0xC0);
        Buffer[1] = static_cast<uint8>((Value >> 48) & 0xFF);
        Buffer[2] = static_cast<uint8>((Value >> 40) & 0xFF);
        Buffer[3] = static_cast<uint8>((Value >> 32) & 0xFF);
        Buffer[4] = static_cast<uint8>((Value >> 24) & 0xFF);
        Buffer[5] = static_cast<uint8>((Value >> 16) & 0xFF);
        Buffer[6] = static_cast<uint8>((Value >> 8) & 0xFF);
        Buffer[7] = static_cast<uint8>(Value & 0xFF);
        return 8;
    }
}

uint64 DecodeVarint(const uint8* Buffer, int32 BufferLen, int32& BytesRead)
{
    if (BufferLen < 1)
    {
        BytesRead = 0;
        return 0;
    }

    uint8 Prefix = Buffer[0] >> 6;

    switch (Prefix)
    {
    case 0: // 1 byte
        BytesRead = 1;
        return Buffer[0] & 0x3F;

    case 1: // 2 bytes
        if (BufferLen < 2) { BytesRead = 0; return 0; }
        BytesRead = 2;
        return (static_cast<uint64>(Buffer[0] & 0x3F) << 8) |
               static_cast<uint64>(Buffer[1]);

    case 2: // 4 bytes
        if (BufferLen < 4) { BytesRead = 0; return 0; }
        BytesRead = 4;
        return (static_cast<uint64>(Buffer[0] & 0x3F) << 24) |
               (static_cast<uint64>(Buffer[1]) << 16) |
               (static_cast<uint64>(Buffer[2]) << 8) |
               static_cast<uint64>(Buffer[3]);

    case 3: // 8 bytes
        if (BufferLen < 8) { BytesRead = 0; return 0; }
        BytesRead = 8;
        return (static_cast<uint64>(Buffer[0] & 0x3F) << 56) |
               (static_cast<uint64>(Buffer[1]) << 48) |
               (static_cast<uint64>(Buffer[2]) << 40) |
               (static_cast<uint64>(Buffer[3]) << 32) |
               (static_cast<uint64>(Buffer[4]) << 24) |
               (static_cast<uint64>(Buffer[5]) << 16) |
               (static_cast<uint64>(Buffer[6]) << 8) |
               static_cast<uint64>(Buffer[7]);

    default:
        BytesRead = 0;
        return 0;
    }
}

int32 VarintSize(uint64 Value)
{
    if (Value <= 63) return 1;
    if (Value <= 16383) return 2;
    if (Value <= 1073741823) return 4;
    return 8;
}

// Helper: append varint to TArray
static void AppendVarint(TArray<uint8>& Arr, uint64 Value)
{
    uint8 Buf[8];
    int32 Len = EncodeVarint(Value, Buf);
    Arr.Append(Buf, Len);
}

// Helper: append raw bytes from FString (UTF-8)
static void AppendStringBytes(TArray<uint8>& Arr, const FString& Str)
{
    FTCHARToUTF8 Converter(*Str);
    int32 Len = Converter.Length();
    AppendVarint(Arr, static_cast<uint64>(Len));
    Arr.Append(reinterpret_cast<const uint8*>(Converter.Get()), Len);
}

// --- Message Framing ---

TArray<uint8> BuildControlMessage(EMoqMessageType Type, const TArray<uint8>& Content)
{
    TArray<uint8> Result;
    // [Type varint]
    AppendVarint(Result, static_cast<uint64>(Type));
    // [Length 2-byte big-endian]
    uint16 Len = static_cast<uint16>(Content.Num());
    Result.Add(static_cast<uint8>(Len >> 8));
    Result.Add(static_cast<uint8>(Len & 0xFF));
    // [Content]
    Result.Append(Content);
    return Result;
}

// --- Object Datagram ---

TArray<uint8> BuildObjectDatagram(
    uint64 TrackAlias, uint64 GroupID, uint64 ObjectID,
    uint8 Priority, const uint8* Payload, int32 PayloadLen)
{
    TArray<uint8> Result;
    AppendVarint(Result, 0x00); // Type = Object Datagram
    AppendVarint(Result, TrackAlias);
    AppendVarint(Result, GroupID);
    AppendVarint(Result, ObjectID);
    Result.Add(Priority); // Priority is a single byte, NOT varint
    Result.Append(Payload, PayloadLen);
    return Result;
}

bool ParseObjectDatagram(
    const uint8* Data, int32 Len,
    uint64& TrackAlias, uint64& GroupID, uint64& ObjectID,
    uint8& Priority, const uint8*& Payload, int32& PayloadLen)
{
    int32 Offset = 0;
    int32 BytesRead = 0;

    // Type
    uint64 Type = DecodeVarint(Data + Offset, Len - Offset, BytesRead);
    if (BytesRead == 0 || (Type != 0x00 && Type != 0x01)) return false;
    Offset += BytesRead;

    // TrackAlias
    TrackAlias = DecodeVarint(Data + Offset, Len - Offset, BytesRead);
    if (BytesRead == 0) return false;
    Offset += BytesRead;

    // GroupID
    GroupID = DecodeVarint(Data + Offset, Len - Offset, BytesRead);
    if (BytesRead == 0) return false;
    Offset += BytesRead;

    // ObjectID
    ObjectID = DecodeVarint(Data + Offset, Len - Offset, BytesRead);
    if (BytesRead == 0) return false;
    Offset += BytesRead;

    // Priority (1 byte)
    if (Offset >= Len) return false;
    Priority = Data[Offset];
    Offset += 1;

    // If Type == 0x01 (datagram with extensions), skip extensions
    if (Type == 0x01)
    {
        // Extensions: [Count varint][Extension pairs...]
        // For now, skip by reading count and each key-value pair
        uint64 ExtCount = DecodeVarint(Data + Offset, Len - Offset, BytesRead);
        if (BytesRead == 0) return false;
        Offset += BytesRead;
        for (uint64 i = 0; i < ExtCount; i++)
        {
            // Key varint
            DecodeVarint(Data + Offset, Len - Offset, BytesRead);
            if (BytesRead == 0) return false;
            Offset += BytesRead;
            // Value length varint + value bytes
            uint64 ValLen = DecodeVarint(Data + Offset, Len - Offset, BytesRead);
            if (BytesRead == 0) return false;
            Offset += BytesRead;
            Offset += static_cast<int32>(ValLen);
            if (Offset > Len) return false;
        }
    }

    // Payload is the remainder
    Payload = Data + Offset;
    PayloadLen = Len - Offset;
    return true;
}

// --- Namespace Tuple ---

TArray<uint8> EncodeNamespaceTuple(const TArray<FString>& Parts)
{
    TArray<uint8> Result;
    AppendVarint(Result, static_cast<uint64>(Parts.Num()));
    for (const FString& Part : Parts)
    {
        AppendStringBytes(Result, Part);
    }
    return Result;
}

// --- CLIENT_SETUP ---

TArray<uint8> BuildClientSetup(uint64 Version, const FString& Path)
{
    TArray<uint8> Content;

    // Supported versions: count=1, then the version
    AppendVarint(Content, 1); // 1 supported version
    AppendVarint(Content, Version);

    // Parameters
    // Number of parameters
    if (Path.Len() > 0)
    {
        AppendVarint(Content, 1); // 1 parameter (path)
        // Path parameter: key=0x01, value=path bytes
        AppendVarint(Content, 0x01); // PathParameterKey
        AppendStringBytes(Content, Path);
    }
    else
    {
        AppendVarint(Content, 0); // 0 parameters
    }

    return BuildControlMessage(EMoqMessageType::ClientSetup, Content);
}

// --- ANNOUNCE ---

TArray<uint8> BuildAnnounce(uint64 RequestId, const TArray<FString>& Namespace)
{
    TArray<uint8> Content;
    AppendVarint(Content, RequestId);
    Content.Append(EncodeNamespaceTuple(Namespace));
    AppendVarint(Content, 0); // 0 parameters
    return BuildControlMessage(EMoqMessageType::Announce, Content);
}

// --- SUBSCRIBE ---

TArray<uint8> BuildSubscribe(
    uint64 RequestId,
    const TArray<FString>& Namespace, const FString& TrackName,
    uint8 Priority, const FString& Authorization)
{
    TArray<uint8> Content;
    AppendVarint(Content, RequestId);
    // NOTE: TrackAlias is NOT in SUBSCRIBE per draft-11 / moqtransport v0.5.1.
    // The publisher assigns a TrackAlias and returns it in SUBSCRIBE_OK.
    Content.Append(EncodeNamespaceTuple(Namespace));
    AppendStringBytes(Content, TrackName);

    // SubscriberPriority (1 byte)
    Content.Add(Priority);
    // GroupOrder (1 byte): 0 = default
    Content.Add(0x00);
    // Forward (1 byte): 0 = default
    Content.Add(0x00);
    // FilterType (varint): 0x01 = LatestGroup
    AppendVarint(Content, 0x01);

    // Parameters
    if (Authorization.Len() > 0)
    {
        AppendVarint(Content, 1); // 1 parameter
        // Authorization: key=0x03 (AuthorizationTokenParameterKey per moqtransport v0.5.1)
        AppendVarint(Content, 0x03);
        AppendStringBytes(Content, Authorization);
    }
    else
    {
        AppendVarint(Content, 0); // 0 parameters
    }

    return BuildControlMessage(EMoqMessageType::Subscribe, Content);
}

// --- SUBSCRIBE_OK ---

TArray<uint8> BuildSubscribeOk(uint64 RequestId, uint64 TrackAlias)
{
    TArray<uint8> Content;
    AppendVarint(Content, RequestId);
    AppendVarint(Content, TrackAlias); // Track alias assigned by us (the publisher)
    AppendVarint(Content, 0); // Expires: 0 = never
    Content.Add(0x00); // GroupOrder: 0 = default
    Content.Add(0x00); // ContentExists: 0 = no
    AppendVarint(Content, 0); // 0 parameters
    return BuildControlMessage(EMoqMessageType::SubscribeOk, Content);
}

} // namespace MoqProtocol
