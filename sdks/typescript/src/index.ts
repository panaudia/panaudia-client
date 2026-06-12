/**
 * Panaudia Client Library
 *
 * Unified client for connecting to the Panaudia spatial audio mixer.
 * Supports MOQ (Media over QUIC) and WebRTC transports.
 *
 * @example
 * ```typescript
 * import { PanaudiaClient, resolveServer } from '@panaudia/client';
 *
 * const server = await resolveServer(ticket); // { serverUrl, transport }
 * const client = new PanaudiaClient({ ...server, ticket });
 * await client.connect();
 * ```
 *
 * For direct MOQ access (testing/advanced usage):
 * ```typescript
 * import { PanaudiaMoqClient } from '@panaudia/client/moq';
 * ```
 *
 * @packageDocumentation
 */

// Shared types
export type {
  Vec3,
  Position,
  Rotation,
  EntityInfo3,
  ClientEventType,
  ClientEventHandler,
  ErrorEvent,
  WarningEvent,
  StateChangeEvent,
  EntityState,
  EntityAttributes,
  ControlMessage,
} from './types.js';

export { ConnectionState } from './types.js';

// Coordinate conversion utilities
export {
  // Framework converters
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
} from './shared/coordinates.js';

export type {
  PanaudiaPose,
  Vec3Pose,
  FRotator,
  UnrealPose,
  Vec2,
  PixiPose,
} from './shared/coordinates.js';

export {
  ENTITY_INFO3_SIZE,
  uuidToBytes,
  bytesToUuid,
  entityInfo3ToBytes,
  entityInfo3FromBytes,
  createEntityInfo3,
  isValidUuid,
} from './shared/encoding.js';

// Microphone selection
export { selectBestMicrophone, classifyByLabel, micPermissionGranted } from './shared/microphone-selection.js';
export type {
  MicrophoneType,
  ClassifiedMicrophone,
  MicrophoneSelectionResult,
} from './shared/microphone-selection.js';

// Transport support detection
export { isWebTransportSupported, getWebTransportSupport } from './moq/connection.js';

// Gateway resolution
export { resolveServer } from './gateway.js';
export type { ResolveServerOptions, ResolvedServer } from './gateway.js';

// Transport interface
export type { Transport, TransportConfig, AudioCaptureConfig, AudioPlaybackConfig, StereoDiagnostics } from './transport.js';

// Stereo diagnostics (mono-collapse localization — plan/stereo-diagnostics)
export { probeOutputDeviceSampleRate } from './moq/audio-player.js';
export type { StereoMeterReport } from './moq/stereo-meter-core.js';
export type { DecodedFormatInfo } from './moq/moq-worker-protocol.js';
export type { AudioGraphReport } from './moq/audio-player.js';

// Unified client
export { PanaudiaClient } from './panaudia-client.js';
export type { PanaudiaClientConfig, TransportType, MicrophoneInfo } from './panaudia-client.js';

// Typed catalog wrappers — exposed via `client.commands.*`. Types are
// re-exported here for callers that want to take a CommandsAPI subtree
// as a parameter (e.g. UI components scoped to a single namespace).
export type {
  CommandsAPI,
  SpaceEntityCommands,
  SpaceRoleCommands,
  PersonalEntityCommands,
  PersonalRoleCommands,
} from './commands.js';

// Structured per-uuid topic view (used internally by PanaudiaClient,
// exported for direct use by clients that bypass the unified API).
export { TopicTree } from './shared/topic-tree.js';
export type { TopicNode, TopicValue } from './shared/topic-tree.js';

// Single-record topic view — used for the `space` topic where keys
// are uuid-less and the reconstructed shape is one nested record
// rather than a per-uuid map.
export { SingleRecordTree } from './shared/single-record-tree.js';
export type { SingleRecordNode, SingleRecordValue } from './shared/single-record-tree.js';

// Per-key opId-gated merge applied by both transports before values
// reach the application — exported for tests and advanced consumers.
export { TopicMerger } from './shared/topic-merger.js';
export type { MergeResult, MergeDebugInfo } from './shared/topic-merger.js';
