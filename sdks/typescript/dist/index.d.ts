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
 * const serverUrl = await resolveServer(ticket);
 * const client = new PanaudiaClient({ serverUrl, ticket });
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
export type { Vec3, Position, Rotation, EntityInfo3, ClientEventType, ClientEventHandler, ErrorEvent, WarningEvent, StateChangeEvent, EntityState, EntityAttributes, ControlMessage, } from './types.js';
export { ConnectionState } from './types.js';
export { threejsToPanaudia, panaudiaToThreejs, babylonToPanaudia, panaudiaToBabylon, aframeToPanaudia, panaudiaToAframe, playcanvasToPanaudia, panaudiaToPlaycanvas, unityToPanaudia, panaudiaToUnity, unrealToPanaudia, panaudiaToUnreal, pixiToPanaudia, panaudiaToPixi, webglToAmbisonicPosition, ambisonicToWebglPosition, webglToAmbisonicRotation, ambisonicToWebglRotation, } from './shared/coordinates.js';
export type { PanaudiaPose, Vec3Pose, FRotator, UnrealPose, Vec2, PixiPose, } from './shared/coordinates.js';
export { ENTITY_INFO3_SIZE, uuidToBytes, bytesToUuid, entityInfo3ToBytes, entityInfo3FromBytes, createEntityInfo3, isValidUuid, } from './shared/encoding.js';
export { selectBestMicrophone, classifyByLabel } from './shared/microphone-selection.js';
export type { MicrophoneType, ClassifiedMicrophone, MicrophoneSelectionResult, } from './shared/microphone-selection.js';
export { BluetoothMicDefaultError } from './moq/audio-publisher.js';
export { isWebTransportSupported, getWebTransportSupport } from './moq/connection.js';
export { resolveServer } from './gateway.js';
export type { ResolveServerOptions } from './gateway.js';
export type { Transport, TransportConfig, AudioCaptureConfig, AudioPlaybackConfig } from './transport.js';
export { PanaudiaClient } from './panaudia-client.js';
export type { PanaudiaClientConfig, TransportType, MicrophoneInfo } from './panaudia-client.js';
export { AttributeTree } from './shared/attribute-tree.js';
export type { AttributeNode, AttributeValue } from './shared/attribute-tree.js';
//# sourceMappingURL=index.d.ts.map