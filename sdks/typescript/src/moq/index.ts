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

// Main client
export { PanaudiaMoqClient } from './client.js';

// Connection utilities
export { MoqConnection, isWebTransportSupported, getWebTransportSupport } from './connection.js';
export type { DatagramHandler } from './connection.js';

// Coordinate conversion (from shared)
export {
  // New framework converters
  threejsToPanaudia,
  panaudiaToThreejs,
  babylonToPanaudia,
  panaudiaToBabylon,
  aframeToPanaudia,
  panaudiaToAframe,
  playcanvasToPanaudia,
  panaudiaToPlaycanvas,
  unityToPanaudia,
  panaudiaToUnity,
  unrealToPanaudia,
  panaudiaToUnreal,
  pixiToPanaudia,
  panaudiaToPixi,
  // Legacy (deprecated)
  webglToAmbisonicPosition,
  ambisonicToWebglPosition,
  webglToAmbisonicRotation,
  ambisonicToWebglRotation,
} from '../shared/coordinates.js';

export type {
  Vec3,
  PanaudiaPose,
  Vec3Pose,
  FRotator,
  UnrealPose,
  Vec2,
  PixiPose,
} from '../shared/coordinates.js';

// Types — shared
export type {
  Position,
  Rotation,
  EntityInfo3,
  ClientEventType,
  ClientEventHandler,
  ErrorEvent,
  StateChangeEvent,
} from '../types.js';

export { ConnectionState } from '../types.js';

// Types — MOQ-specific
export type {
  PanaudiaConfig,
  WebTransportOptions,
  MoqTrack,
  MoqObject,
  MoqSubscription,
  MoqAnnouncement,
} from './types.js';

export {
  MoqMessageType,
  MoqRole,
  MoqFilterType,
  MoqForwardingPreference,
  MoqErrorCode,
  PanaudiaTrackType,
  generateTrackNamespace,
} from './types.js';

// MOQ Transport protocol utilities (for advanced usage)
export {
  // VARINT encoding
  encodeVarint,
  decodeVarint,

  // String/bytes encoding
  encodeString,
  decodeString,
  encodeBytes,
  decodeBytes,

  // Message building
  MessageBuilder,
  buildClientSetup,
  buildSubscribe,
  buildAnnounce,
  buildUnsubscribe,
  buildUnannounce,
  buildObjectDatagram,

  // Message parsing
  parseMessageType,
  parseServerSetup,
  parseSubscribeOk,
  parseSubscribeError,
  parseAnnounceOk,
  parseAnnounceError,
  parseObjectDatagram,

  // Protocol constants
  MOQ_TRANSPORT_VERSION,
} from './moq-transport.js';

// Re-export parsed message types
export type {
  ParsedServerSetup,
  ParsedSubscribeOk,
  ParsedSubscribeError,
  ParsedAnnounceOk,
  ParsedAnnounceError,
  ParsedObjectDatagram,
} from './moq-transport.js';

// Error types
export {
  MoqClientError,
  WebTransportNotSupportedError,
  ConnectionError,
  AuthenticationError,
  JwtParseError,
  ProtocolError,
  SubscriptionError,
  AnnouncementError,
  InvalidStateError,
  TimeoutError,
  getMoqErrorMessage,
  wrapError,
} from './errors.js';

// Audio publishing
export {
  AudioPublisher,
  AudioPublisherState,
  isOpusSupported,
  getBestOpusMimeType,
  getAudioCapabilities,
  AudioPermissionError,
  AudioEncodingError,
  AudioNotSupportedError,
} from './audio-publisher.js';

export type {
  AudioPublisherConfig,
  AudioFrame,
  AudioFrameHandler,
} from './audio-publisher.js';

// Track publishing
export {
  TrackPublisher,
  AudioTrackPublisher,
  StateTrackPublisher,
} from './track-publisher.js';

export type {
  TrackPublisherConfig,
  TrackPublisherStats,
} from './track-publisher.js';

// EntityInfo3 binary encoding/decoding (from shared)
export {
  ENTITY_INFO3_SIZE,
  uuidToBytes,
  bytesToUuid,
  entityInfo3ToBytes,
  entityInfo3FromBytes,
  createEntityInfo3,
  isValidUuid,
} from '../shared/encoding.js';

// Control publishing (mute/unmute)
export { ControlTrackPublisher } from './control-publisher.js';
export type { ControlMessage } from '../types.js';

// Attributes subscription
export { AttributesSubscriber } from './attributes-subscriber.js';
export type { EntityAttributes, AttributesHandler, AttributesRemovedHandler } from './attributes-subscriber.js';

// Cache (shared)
export { CacheMap } from '../shared/cache-map.js';
export type { CacheEntry, MergeResult, CacheChangeHandler } from '../shared/cache-map.js';
export { isCacheEnvelope, decodeCacheOp, encodeCacheOp } from '../shared/cache-wire.js';
export type { CacheOp } from '../shared/cache-wire.js';

// State subscription and entity tracking
export { StateSubscriber } from './state-subscriber.js';
export type { EntityState, EntityStateHandler } from './state-subscriber.js';

// Audio subscription and playback
export {
  AudioSubscriber,
  AudioSubscriberState,
  isAudioDecoderSupported,
  getAudioDecoderCapabilities,
} from './audio-subscriber.js';

export type {
  ReceivedAudioFrame,
  AudioFrameReceivedHandler,
  AudioSubscriberStats,
} from './audio-subscriber.js';

export {
  AudioPlayer,
  AudioPlayerState,
  AudioDecoderNotSupportedError,
  isAudioPlaybackSupported,
  getAudioPlaybackCapabilities,
} from './audio-player.js';

export type {
  AudioPlayerConfig,
  AudioPlayerStats,
} from './audio-player.js';

// Transport adapter (for use with PanaudiaClient)
export { MoqTransportAdapter } from './moq-transport-adapter.js';
