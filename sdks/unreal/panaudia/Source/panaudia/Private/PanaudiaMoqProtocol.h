#pragma once

#include "Containers/Array.h"
#include "Containers/UnrealString.h"
#include <cstdint>

// MOQ draft-11 message types (matching mengelbart/moqtransport v0.5.0)
enum class EMoqMessageType : uint64
{
    ObjectDatagram       = 0x00,
    ObjectDatagramExt    = 0x01,
    Subscribe            = 0x03,
    SubscribeOk          = 0x04,
    SubscribeError       = 0x05,
    Announce             = 0x06,
    AnnounceOk           = 0x07,
    AnnounceError        = 0x08,
    SubscribeAnnounces   = 0x11,
    SubscribeAnnouncesOk = 0x12,
    ClientSetup          = 0x20,
    ServerSetup          = 0x21,
};

namespace MoqProtocol
{
    // --- QUIC Varint Encoding (RFC 9000 Section 16) ---
    // 1-byte: 0-63, 2-byte: 64-16383, 4-byte: 16384-1073741823, 8-byte: larger

    // Encode a varint into Buffer. Returns number of bytes written (1, 2, 4, or 8).
    int32 EncodeVarint(uint64 Value, uint8* Buffer);

    // Decode a varint from Buffer. Sets BytesRead to number of bytes consumed.
    uint64 DecodeVarint(const uint8* Buffer, int32 BufferLen, int32& BytesRead);

    // Returns the number of bytes needed to encode Value as a varint.
    int32 VarintSize(uint64 Value);

    // --- Message Framing ---
    // moqtransport v0.5.0 uses: [Type varint][Length 2-byte big-endian][Content]

    // Build a framed control message.
    TArray<uint8> BuildControlMessage(EMoqMessageType Type, const TArray<uint8>& Content);

    // --- Object Datagram ---
    // Format: [Type=0x00 varint][TrackAlias varint][GroupID varint]
    //         [ObjectID varint][Priority 1 byte][Payload...]

    TArray<uint8> BuildObjectDatagram(
        uint64 TrackAlias, uint64 GroupID, uint64 ObjectID,
        uint8 Priority, const uint8* Payload, int32 PayloadLen);

    bool ParseObjectDatagram(
        const uint8* Data, int32 Len,
        uint64& TrackAlias, uint64& GroupID, uint64& ObjectID,
        uint8& Priority, const uint8*& Payload, int32& PayloadLen);

    // --- Namespace Tuple ---
    // Encoding: [Count varint][Len varint][Bytes]...
    TArray<uint8> EncodeNamespaceTuple(const TArray<FString>& Parts);

    // --- CLIENT_SETUP / SERVER_SETUP ---
    // CLIENT_SETUP: [SupportedVersions count varint][Version varint]...[Parameters]
    TArray<uint8> BuildClientSetup(uint64 Version, const FString& Path = TEXT(""));

    // --- ANNOUNCE ---
    // ANNOUNCE: [RequestID varint][Namespace Tuple][Parameters (empty)]
    TArray<uint8> BuildAnnounce(uint64 RequestId, const TArray<FString>& Namespace);

    // --- SUBSCRIBE ---
    // SUBSCRIBE: [RequestID varint][TrackAlias varint][Namespace Tuple]
    //            [TrackName bytes][SubscriberPriority 1B][GroupOrder 1B]
    //            [Forward 1B][FilterType varint]
    TArray<uint8> BuildSubscribe(
        uint64 RequestId, uint64 TrackAlias,
        const TArray<FString>& Namespace, const FString& TrackName,
        uint8 Priority = 128, const FString& Authorization = TEXT(""));

    // --- SUBSCRIBE_OK ---
    // SUBSCRIBE_OK: [RequestID varint][Expires varint][GroupOrder 1B]
    //               [ContentExists 1B][Parameters]
    TArray<uint8> BuildSubscribeOk(uint64 RequestId);
}
