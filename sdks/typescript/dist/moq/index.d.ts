/**
 * Panaudia MOQ Client
 *
 * Direct access to the MOQ transport layer. For most applications,
 * use the unified PanaudiaClient from '@panaudia/client' instead.
 *
 * @example
 * ```typescript
 * import { PanaudiaMoqClient } from '@panaudia/client/moq';
 *
 * const client = new PanaudiaMoqClient({
 *   serverUrl: 'https://server.example.com:4433',
 *   ticket: 'your-jwt-token',
 * });
 *
 * await client.connect();
 * await client.startMicrophone();
 * await client.startPlayback();
 * ```
 *
 * @packageDocumentation
 */
export { PanaudiaMoqClient } from './client.js';
export { MoqConnection, isWebTransportSupported, getWebTransportSupport } from './connection.js';
export type { DatagramHandler } from './connection.js';
export { threejsToPanaudia, panaudiaToThreejs, babylonToPanaudia, panaudiaToBabylon, aframeToPanaudia, panaudiaToAframe, playcanvasToPanaudia, panaudiaToPlaycanvas, unityToPanaudia, panaudiaToUnity, unrealToPanaudia, panaudiaToUnreal, pixiToPanaudia, panaudiaToPixi, webglToAmbisonicPosition, ambisonicToWebglPosition, webglToAmbisonicRotation, ambisonicToWebglRotation, } from '../shared/coordinates.js';
export type { Vec3, PanaudiaPose, Vec3Pose, FRotator, UnrealPose, Vec2, PixiPose, } from '../shared/coordinates.js';
export type { Position, Rotation, EntityInfo3, ClientEventType, ClientEventHandler, ErrorEvent, WarningEvent, StateChangeEvent, } from '../types.js';
export { ConnectionState } from '../types.js';
export type { PanaudiaConfig, WebTransportOptions, MoqTrack, MoqObject, MoqSubscription, MoqAnnouncement, } from './types.js';
export { MoqMessageType, MoqRole, MoqFilterType, MoqForwardingPreference, MoqErrorCode, PanaudiaTrackType, generateTrackNamespace, } from './types.js';
export { encodeVarint, decodeVarint, encodeString, decodeString, encodeBytes, decodeBytes, MessageBuilder, buildClientSetup, buildSubscribe, buildAnnounce, buildUnsubscribe, buildUnannounce, buildObjectDatagram, parseMessageType, parseServerSetup, parseSubscribeOk, parseSubscribeError, parseAnnounceOk, parseAnnounceError, parseObjectDatagram, MOQ_TRANSPORT_VERSION, } from './moq-transport.js';
export type { ParsedServerSetup, ParsedSubscribeOk, ParsedSubscribeError, ParsedAnnounceOk, ParsedAnnounceError, ParsedObjectDatagram, } from './moq-transport.js';
export { MoqClientError, WebTransportNotSupportedError, ConnectionError, AuthenticationError, JwtParseError, ProtocolError, SubscriptionError, AnnouncementError, InvalidStateError, TimeoutError, getMoqErrorMessage, wrapError, } from './errors.js';
export { AudioPublisher, AudioPublisherState, isOpusSupported, getBestOpusMimeType, getAudioCapabilities, AudioPermissionError, AudioEncodingError, AudioNotSupportedError, BluetoothMicDefaultError, } from './audio-publisher.js';
export type { AudioPublisherConfig, AudioFrame, AudioFrameHandler, } from './audio-publisher.js';
export { TrackPublisher, AudioTrackPublisher, StateTrackPublisher, } from './track-publisher.js';
export type { TrackPublisherConfig, TrackPublisherStats, } from './track-publisher.js';
export { ENTITY_INFO3_SIZE, uuidToBytes, bytesToUuid, entityInfo3ToBytes, entityInfo3FromBytes, createEntityInfo3, isValidUuid, } from '../shared/encoding.js';
export { ControlTrackPublisher } from './control-publisher.js';
export type { ControlMessage } from '../types.js';
export { AttributesSubscriber } from './attributes-subscriber.js';
export type { ValuesHandler, RemovedHandler, AttributeValue } from './attributes-subscriber.js';
export { CacheMap } from '../shared/cache-map.js';
export type { CacheEntry, MergeResult, CacheChangeHandler } from '../shared/cache-map.js';
export { isCacheEnvelope, decodeCacheOp, encodeCacheOp } from '../shared/cache-wire.js';
export type { CacheOp } from '../shared/cache-wire.js';
export { StateSubscriber } from './state-subscriber.js';
export type { EntityState, EntityStateHandler } from './state-subscriber.js';
export { AudioSubscriber, AudioSubscriberState, isAudioDecoderSupported, getAudioDecoderCapabilities, } from './audio-subscriber.js';
export type { ReceivedAudioFrame, AudioFrameReceivedHandler, AudioSubscriberStats, } from './audio-subscriber.js';
export { AudioPlayer, AudioPlayerState, AudioDecoderNotSupportedError, isAudioPlaybackSupported, getAudioPlaybackCapabilities, } from './audio-player.js';
export type { AudioPlayerConfig, AudioPlayerStats, } from './audio-player.js';
export { MoqTransportAdapter } from './moq-transport-adapter.js';
//# sourceMappingURL=index.d.ts.map