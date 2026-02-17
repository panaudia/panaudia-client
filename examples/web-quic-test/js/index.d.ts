/**
 * Panaudia MOQ Client Library
 *
 * A TypeScript client for connecting to the Panaudia spatial audio mixer
 * via Media over QUIC (MOQ) transport.
 *
 * @example
 * ```typescript
 * import { PanaudiaMoqClient } from 'panaudia-moq-client';
 *
 * const client = new PanaudiaMoqClient({
 *   serverUrl: 'https://server.example.com:4433',
 *   ticket: 'your-jwt-token',
 *   initialPosition: { x: 0.5, y: 0.5, z: 0.5 },
 * });
 *
 * client.on('error', (e) => console.error('Error:', e));
 *
 * await client.connect();
 * await client.startMicrophone();
 * await client.startPlayback();
 *
 * // Update listener position
 * client.setPosition({ x: 0.6, y: 0.5, z: 0.5 });
 * ```
 *
 * @packageDocumentation
 */

/**
 * Error thrown when announcement fails
 */
export declare class AnnouncementError extends MoqClientError {
    readonly moqErrorCode?: number | undefined;
    readonly namespace?: string[] | undefined;
    constructor(message: string, moqErrorCode?: number | undefined, namespace?: string[] | undefined, details?: unknown);
}

/**
 * Error thrown when WebCodecs AudioDecoder is not supported
 */
export declare class AudioDecoderNotSupportedError extends MoqClientError {
    constructor(message: string);
}

export declare class AudioEncodingError extends MoqClientError {
    constructor(message: string, details?: unknown);
}

/**
 * Audio frame data ready for publishing
 */
export declare interface AudioFrame {
    /** Opus-encoded audio data */
    data: Uint8Array;
    /** Timestamp in milliseconds */
    timestamp: number;
    /** Duration in milliseconds */
    duration: number;
}

/**
 * Event handler for audio frames
 */
export declare type AudioFrameHandler = (frame: AudioFrame) => void;

/**
 * Handler for received audio frames
 */
export declare type AudioFrameReceivedHandler = (frame: ReceivedAudioFrame) => void;

export declare class AudioNotSupportedError extends MoqClientError {
    constructor(message: string);
}

/**
 * Error types for audio publisher
 */
export declare class AudioPermissionError extends MoqClientError {
    constructor(message: string, details?: unknown);
}

/**
 * Audio Player
 *
 * Decodes Opus audio and plays it through the Web Audio API.
 */
export declare class AudioPlayer {
    private config;
    private state;
    private audioContext;
    private decoder;
    private nextPlayTime;
    private scheduledBuffers;
    private stats;
    constructor(config?: AudioPlayerConfig);
    /**
     * Get current state
     */
    getState(): AudioPlayerState;
    /**
     * Get statistics
     */
    getStats(): AudioPlayerStats;
    /**
     * Initialize the audio player
     *
     * This creates the AudioContext and AudioDecoder.
     * Must be called in response to a user gesture on some browsers.
     */
    initialize(): Promise<void>;
    /**
     * Start playback
     */
    start(): void;
    /**
     * Stop playback
     */
    stop(): void;
    /**
     * Pause playback
     */
    pause(): void;
    /**
     * Resume playback
     */
    resume(): void;
    /**
     * Decode an Opus frame
     *
     * @param opusData - Opus-encoded audio data
     * @param timestamp - Frame timestamp in microseconds (optional)
     */
    decodeFrame(opusData: Uint8Array, timestamp?: number): void;
    /**
     * Release all resources
     */
    dispose(): Promise<void>;
    /**
     * Handle decoded audio data
     */
    private handleDecodedAudio;
    /**
     * Schedule an audio buffer for playback
     */
    private scheduleBuffer;
    /**
     * Handle decode error
     */
    private handleDecodeError;
}

/**
 * Audio player configuration
 */
export declare interface AudioPlayerConfig {
    /** Sample rate (default: 48000) */
    sampleRate?: number;
    /** Number of channels (default: 2 for stereo) */
    channelCount?: number;
    /** Buffer size in seconds (default: 0.1 = 100ms) */
    bufferSize?: number;
    /** Latency hint for AudioContext */
    latencyHint?: AudioContextLatencyCategory;
}

/**
 * Audio player state
 */
export declare enum AudioPlayerState {
    IDLE = "idle",
    INITIALIZING = "initializing",
    READY = "ready",
    PLAYING = "playing",
    ERROR = "error"
}

/**
 * Audio player statistics
 */
export declare interface AudioPlayerStats {
    /** Total frames decoded */
    framesDecoded: number;
    /** Total samples played */
    samplesPlayed: number;
    /** Buffer underruns (gaps in playback) */
    underruns: number;
    /** Current buffer level in seconds */
    bufferLevel: number;
    /** Decode errors */
    decodeErrors: number;
}

/**
 * Audio Publisher
 *
 * Captures audio from the microphone, encodes it to Opus, and provides
 * frames for publishing to the MOQ server.
 */
export declare class AudioPublisher {
    private config;
    private state;
    private mediaStream;
    private mediaRecorder;
    private frameHandler;
    private startTime;
    private frameSequence;
    constructor(config?: AudioPublisherConfig);
    /**
     * Get current state
     */
    getState(): AudioPublisherState;
    /**
     * Set handler for audio frames
     */
    onFrame(handler: AudioFrameHandler): void;
    /**
     * Request microphone access and prepare for recording
     */
    initialize(): Promise<void>;
    /**
     * Start recording and encoding audio
     */
    start(): void;
    /**
     * Pause recording
     */
    pause(): void;
    /**
     * Resume recording
     */
    resume(): void;
    /**
     * Stop recording
     */
    stop(): void;
    /**
     * Release all resources
     */
    dispose(): void;
    /**
     * Handle encoded audio data from MediaRecorder
     */
    private handleEncodedData;
    /**
     * Update state
     */
    private setState;
}

/**
 * Audio publisher configuration
 */
export declare interface AudioPublisherConfig {
    /** Sample rate in Hz (default: 48000) */
    sampleRate?: number;
    /** Number of channels (default: 1 for mono) */
    channelCount?: number;
    /** Target bitrate in bits per second (default: 64000) */
    bitrate?: number;
    /** Frame duration in milliseconds (default: 20) */
    frameDurationMs?: number;
    /** Enable echo cancellation (default: true) */
    echoCancellation?: boolean;
    /** Enable noise suppression (default: true) */
    noiseSuppression?: boolean;
    /** Enable auto gain control (default: true) */
    autoGainControl?: boolean;
}

/**
 * Audio publisher state
 */
export declare enum AudioPublisherState {
    IDLE = "idle",
    REQUESTING_PERMISSION = "requesting_permission",
    READY = "ready",
    RECORDING = "recording",
    PAUSED = "paused",
    ERROR = "error"
}

/**
 * Audio Subscriber
 *
 * Receives Opus-encoded audio frames from an MOQ track via datagrams.
 */
export declare class AudioSubscriber {
    private connection;
    private state;
    private frameHandler;
    private trackAlias;
    private isListening;
    private stats;
    /**
     * Get current state
     */
    getState(): AudioSubscriberState;
    /**
     * Get statistics
     */
    getStats(): AudioSubscriberStats;
    /**
     * Set handler for received audio frames
     */
    onFrame(handler: AudioFrameReceivedHandler): void;
    /**
     * Attach to a connection and start listening for datagrams
     *
     * @param connection - MOQ connection
     * @param trackAlias - Track alias to filter frames
     */
    attach(connection: MoqConnection, trackAlias: number): void;
    /**
     * Start receiving audio frames
     */
    start(): Promise<void>;
    /**
     * Stop receiving audio frames
     */
    stop(): void;
    /**
     * Detach from connection
     */
    detach(): void;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Read datagrams from the connection
     */
    private readDatagrams;
    /**
     * Handle a received datagram
     */
    private handleDatagram;
}

/**
 * Audio subscriber state
 */
export declare enum AudioSubscriberState {
    IDLE = "idle",
    SUBSCRIBING = "subscribing",
    ACTIVE = "active",
    ERROR = "error"
}

/**
 * Audio subscriber statistics
 */
export declare interface AudioSubscriberStats {
    /** Total frames received */
    framesReceived: number;
    /** Total bytes received */
    bytesReceived: number;
    /** Frames dropped due to errors */
    framesDropped: number;
    /** Current group ID */
    currentGroupId: bigint;
    /** Last frame receive time */
    lastFrameTime: number;
}

/**
 * Audio Track Publisher
 *
 * Specialized publisher for audio frames with timing-based group management.
 */
export declare class AudioTrackPublisher extends TrackPublisher {
    private frameSequence;
    private sessionStartTime;
    constructor(config: TrackPublisherConfig);
    /**
     * Start a new audio session
     */
    startSession(): void;
    /**
     * Publish an audio frame
     *
     * @param opusData - Opus-encoded audio data
     * @param timestampMs - Frame timestamp in milliseconds (relative to session start)
     */
    publishAudioFrame(opusData: Uint8Array, timestampMs?: number): Promise<void>;
}

/**
 * Error thrown when authentication fails
 */
export declare class AuthenticationError extends MoqClientError {
    readonly moqErrorCode?: number | undefined;
    constructor(message: string, moqErrorCode?: number | undefined, details?: unknown);
    /**
     * Check if this is an invalid token error
     */
    isInvalidToken(): boolean;
    /**
     * Check if this is an expired token error
     */
    isExpiredToken(): boolean;
}

/**
 * Build ANNOUNCE message
 */
export declare function buildAnnounce(announcement: MoqAnnouncement): Uint8Array;

/**
 * Build CLIENT_SETUP message
 */
export declare function buildClientSetup(supportedVersions: number[], role: MoqRole, path?: string, maxSubscribeId?: number): Uint8Array;

/**
 * Build OBJECT_DATAGRAM message (for sending audio/state data)
 */
export declare function buildObjectDatagram(trackAlias: number, groupId: bigint, objectId: bigint, publisherPriority: number, payload: Uint8Array): Uint8Array;

/**
 * Build SUBSCRIBE message
 */
export declare function buildSubscribe(subscription: MoqSubscription): Uint8Array;

/**
 * Build UNANNOUNCE message
 */
export declare function buildUnannounce(namespace: string[]): Uint8Array;

/**
 * Build UNSUBSCRIBE message
 */
export declare function buildUnsubscribe(subscribeId: number): Uint8Array;

/**
 * Convert 16 bytes to a UUID string
 *
 * @param bytes - 16-byte array
 * @returns UUID string with hyphens
 */
export declare function bytesToUuid(bytes: Uint8Array): string;

/**
 * Client event handler
 */
export declare type ClientEventHandler<T = unknown> = (event: T) => void;

/**
 * Client event types
 */
export declare type ClientEventType = 'connected' | 'disconnected' | 'authenticated' | 'error' | 'statechange';

/**
 * Error thrown when connection fails
 */
export declare class ConnectionError extends MoqClientError {
    constructor(message: string, details?: unknown);
}

/**
 * Connection event handlers
 */
declare interface ConnectionEventHandlers {
    onStateChange?: (state: ConnectionState, error?: Error) => void;
    onClose?: (info: WebTransportCloseInfo) => void;
}

/**
 * Connection state
 */
export declare enum ConnectionState {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    AUTHENTICATED = "authenticated",
    ERROR = "error"
}

/**
 * Create a default NodeInfo3 for a given node ID
 *
 * @param nodeId - UUID string
 * @param position - Initial position (defaults to center: 0.5, 0.5, 0.5)
 * @param rotation - Initial rotation (defaults to no rotation: 0, 0, 0)
 * @param volume - Initial volume (defaults to 1.0)
 */
export declare function createNodeInfo3(nodeId: string, position?: Partial<Position>, rotation?: Partial<Rotation>, volume?: number): NodeInfo3;

/**
 * Decode length-prefixed bytes
 */
export declare function decodeBytes(data: Uint8Array, offset?: number): {
    value: Uint8Array;
    bytesRead: number;
};

/**
 * Decode a length-prefixed string
 */
export declare function decodeString(data: Uint8Array, offset?: number): {
    value: string;
    bytesRead: number;
};

/**
 * Decode a QUIC-style variable-length integer from a byte array
 * Returns the decoded value and the number of bytes consumed
 */
export declare function decodeVarint(data: Uint8Array, offset?: number): {
    value: bigint;
    bytesRead: number;
};

/**
 * Encode bytes with length prefix (varint length + raw bytes)
 */
export declare function encodeBytes(bytes: Uint8Array): Uint8Array;

/**
 * Encode a string with length prefix (varint length + UTF-8 bytes)
 */
export declare function encodeString(str: string): Uint8Array;

/**
 * Encode a number as a QUIC-style variable-length integer
 * Returns the encoded bytes
 */
export declare function encodeVarint(value: number | bigint): Uint8Array;

/**
 * Error event payload
 */
declare interface ErrorEvent_2 {
    code: string | number;
    message: string;
    details?: unknown;
}
export { ErrorEvent_2 as ErrorEvent }

/**
 * Generate track namespace for Panaudia
 */
export declare function generateTrackNamespace(trackType: PanaudiaTrackType, nodeId: string): string[];

/**
 * Check browser audio capabilities
 */
export declare function getAudioCapabilities(): {
    getUserMedia: boolean;
    mediaRecorder: boolean;
    opusSupport: boolean;
    bestMimeType: string | null;
};

/**
 * Get audio decoder capabilities
 */
export declare function getAudioDecoderCapabilities(): Promise<{
    supported: boolean;
    opusSupported: boolean;
}>;

/**
 * Get audio playback capabilities
 */
export declare function getAudioPlaybackCapabilities(): Promise<{
    audioContext: boolean;
    webCodecs: boolean;
    opusDecoding: boolean;
}>;

/**
 * Get the best supported Opus MIME type
 */
export declare function getBestOpusMimeType(): string | null;

/**
 * Maps MOQ error codes to human-readable messages
 */
export declare function getMoqErrorMessage(code: number): string;

/**
 * Get WebTransport support information
 */
export declare function getWebTransportSupport(): {
    supported: boolean;
    datagrams: boolean;
    serverCertificateHashes: boolean;
};

/**
 * Error thrown when the client is in an invalid state for an operation
 */
export declare class InvalidStateError extends MoqClientError {
    constructor(expectedState: string, actualState: string);
}

/**
 * Check if WebCodecs AudioDecoder is supported
 */
export declare function isAudioDecoderSupported(): boolean;

/**
 * Check if audio playback is supported
 */
export declare function isAudioPlaybackSupported(): boolean;

/**
 * Check if Opus encoding is supported via MediaRecorder
 */
export declare function isOpusSupported(): boolean;

/**
 * Validate a UUID string format
 *
 * @param uuid - UUID string to validate
 * @returns true if valid UUID format
 */
export declare function isValidUuid(uuid: string): boolean;

/**
 * Check if WebTransport is supported in this browser
 */
export declare function isWebTransportSupported(): boolean;

/**
 * Error thrown when JWT parsing fails
 */
export declare class JwtParseError extends MoqClientError {
    constructor(message: string, details?: unknown);
}

/**
 * Buffer builder for constructing MOQ messages
 */
export declare class MessageBuilder {
    private chunks;
    private totalLength;
    /**
     * Append a varint to the message
     */
    writeVarint(value: number | bigint): this;
    /**
     * Append a length-prefixed string to the message
     */
    writeString(str: string): this;
    /**
     * Append length-prefixed bytes to the message
     */
    writeBytes(data: Uint8Array): this;
    /**
     * Append raw bytes (no length prefix) to the message
     */
    writeRaw(data: Uint8Array): this;
    /**
     * Build the final message
     */
    build(): Uint8Array;
}

/**
 * MOQ Transport version we support (draft-ietf-moq-transport-11)
 */
export declare const MOQ_TRANSPORT_VERSION: number;

/**
 * MOQ Announcement
 */
export declare interface MoqAnnouncement {
    namespace: string[];
    parameters?: Map<number, Uint8Array>;
}

/**
 * Custom error types for the Panaudia MOQ client
 */
/**
 * Base error class for all MOQ client errors
 */
export declare class MoqClientError extends Error {
    readonly code: string;
    readonly details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
}

/**
 * Manages a WebTransport connection to an MOQ server
 */
export declare class MoqConnection {
    private readonly serverUrl;
    private transport;
    private state;
    private handlers;
    constructor(serverUrl: string);
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Get the underlying WebTransport instance
     */
    getTransport(): WebTransport | null;
    /**
     * Set event handlers
     */
    setHandlers(handlers: ConnectionEventHandlers): void;
    /**
     * Connect to the MOQ server via WebTransport
     */
    connect(options?: WebTransportOptions_2): Promise<void>;
    /**
     * Close the connection gracefully
     */
    close(closeInfo?: WebTransportCloseInfo): void;
    /**
     * Create a bidirectional stream for the MOQ control channel
     */
    createControlStream(): Promise<WebTransportBidirectionalStream>;
    /**
     * Create a unidirectional stream for sending data
     */
    createSendStream(): Promise<WritableStream<Uint8Array>>;
    /**
     * Get the incoming unidirectional streams reader
     */
    getIncomingStreams(): ReadableStream<WebTransportReceiveStream>;
    /**
     * Get the datagram writer/reader for audio frames
     */
    getDatagrams(): WebTransportDatagramDuplexStream;
    /**
     * Get a reader for incoming datagrams
     */
    getDatagramReader(): ReadableStreamDefaultReader<Uint8Array> | null;
    /**
     * Send a datagram (used for audio frames)
     */
    sendDatagram(data: Uint8Array): Promise<void>;
    /**
     * Update connection state and notify handlers
     */
    private setState;
    /**
     * Handle connection close
     */
    private handleClose;
    /**
     * Handle connection error
     */
    private handleError;
}

/**
 * MOQ error codes
 */
export declare enum MoqErrorCode {
    NO_ERROR = 0,
    INTERNAL_ERROR = 1,
    UNAUTHORIZED = 2,
    PROTOCOL_VIOLATION = 3,
    DUPLICATE_TRACK_ALIAS = 4,
    PARAMETER_LENGTH_MISMATCH = 5,
    TOO_MANY_SUBSCRIBES = 6,
    GOAWAY_TIMEOUT = 16,
    INVALID_TOKEN = 1027
}

/**
 * MOQ filter type for subscriptions
 */
export declare enum MoqFilterType {
    LATEST_GROUP = 1,
    LATEST_OBJECT = 2,
    ABSOLUTE_START = 3,
    ABSOLUTE_RANGE = 4
}

/**
 * MOQ object forwarding preference
 */
export declare enum MoqForwardingPreference {
    DATAGRAM = 0,
    STREAM_TRACK = 1,
    STREAM_GROUP = 2,
    STREAM_OBJECT = 3
}

/**
 * MOQ message types (from draft-ietf-moq-transport-11)
 */
export declare enum MoqMessageType {
    CLIENT_SETUP = 64,
    SERVER_SETUP = 65,
    ANNOUNCE = 6,
    ANNOUNCE_OK = 7,
    ANNOUNCE_ERROR = 8,
    UNANNOUNCE = 9,
    SUBSCRIBE = 3,
    SUBSCRIBE_OK = 4,
    SUBSCRIBE_ERROR = 5,
    UNSUBSCRIBE = 10,
    SUBSCRIBE_DONE = 11,
    OBJECT_STREAM = 0,
    OBJECT_DATAGRAM = 1,
    GOAWAY = 16
}

/**
 * MOQ Object representation
 */
export declare interface MoqObject {
    trackAlias: number;
    groupId: bigint;
    objectId: bigint;
    publisherPriority: number;
    payload: Uint8Array;
}

/**
 * MOQ role values
 */
export declare enum MoqRole {
    PUBLISHER = 0,
    SUBSCRIBER = 1,
    PUBSUB = 2
}

/**
 * MOQ Subscription request
 */
export declare interface MoqSubscription {
    subscribeId: number;
    trackAlias: number;
    namespace: string[];
    trackName: string;
    filterType: MoqFilterType;
    authorization?: string;
}

/**
 * MOQ Track representation
 */
export declare interface MoqTrack {
    namespace: string[];
    name: string;
    alias?: number;
}

/**
 * Size of NodeInfo3 binary encoding in bytes
 */
export declare const NODE_INFO3_SIZE = 48;

/**
 * NodeInfo3 state data - matches the 48-byte binary format from Go server
 */
export declare interface NodeInfo3 {
    uuid: string;
    position: Position;
    rotation: Rotation;
    volume: number;
    gone: boolean;
}

/**
 * Decode 48 bytes to a NodeInfo3 struct
 *
 * @param bytes - 48-byte array
 * @returns NodeInfo3 data
 */
export declare function nodeInfo3FromBytes(bytes: Uint8Array): NodeInfo3;

/**
 * Encode a NodeInfo3 struct to 48 bytes
 *
 * @param info - NodeInfo3 data
 * @returns 48-byte Uint8Array
 */
export declare function nodeInfo3ToBytes(info: NodeInfo3): Uint8Array;

/**
 * Configuration for the Panaudia MOQ client
 */
export declare interface PanaudiaConfig {
    /** Server URL (e.g., "https://server.example.com:4433") */
    serverUrl: string;
    /** JWT authentication token */
    ticket: string;
    /** Node ID (UUID) - typically extracted from JWT, but can be provided */
    nodeId?: string;
    /** Initial position in Panaudia coordinates (0-1 range) */
    initialPosition?: Position;
    /** Initial rotation in degrees */
    initialRotation?: Rotation;
    /** Initial volume (0-1 range) */
    initialVolume?: number;
}

/**
 * Main Panaudia MOQ Client
 *
 * Usage:
 * ```typescript
 * const client = new PanaudiaMoqClient({
 *   serverUrl: 'https://server.example.com:4433',
 *   ticket: 'your-jwt-token',
 * });
 *
 * await client.connect();
 * await client.startMicrophone();
 * await client.startPlayback();
 *
 * client.setPosition({ x: 0.5, y: 0.5, z: 0.5 });
 * ```
 */
export declare class PanaudiaMoqClient {
    private readonly config;
    private readonly events;
    private connection;
    private session;
    private state;
    private audioPublisher;
    private audioTrackPublisher;
    private stateTrackPublisher;
    private statePublishPending;
    private statePublishThrottleMs;
    private lastStatePublishTime;
    private audioSubscriber;
    private audioPlayer;
    private audioInputTrackAlias;
    private stateTrackAlias;
    private audioOutputTrackAlias;
    private position;
    private rotation;
    private volume;
    constructor(config: PanaudiaConfig);
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Get the node ID
     */
    getNodeId(): string;
    /**
     * Register an event handler
     */
    on<T>(event: ClientEventType, handler: ClientEventHandler<T>): void;
    /**
     * Remove an event handler
     */
    off<T>(event: ClientEventType, handler: ClientEventHandler<T>): void;
    /**
     * Connect to the MOQ server
     */
    connect(options?: WebTransportOptions_2): Promise<void>;
    /**
     * Disconnect from the server
     */
    disconnect(): Promise<void>;
    /**
     * Update position (in Panaudia internal coordinates, 0-1 range)
     */
    setPosition(position: Position): void;
    /**
     * Update rotation (in degrees)
     */
    setRotation(rotation: Rotation): void;
    /**
     * Update volume (0-1 range)
     */
    setVolume(volume: number): void;
    /**
     * Get current position
     */
    getPosition(): Position;
    /**
     * Get current rotation
     */
    getRotation(): Rotation;
    /**
     * Get current volume
     */
    getVolume(): number;
    /**
     * Start capturing and publishing microphone audio
     *
     * @param config - Optional audio configuration
     */
    startMicrophone(config?: AudioPublisherConfig): Promise<void>;
    /**
     * Stop capturing microphone audio
     */
    stopMicrophone(): void;
    /**
     * Check if microphone is currently recording
     */
    isMicrophoneActive(): boolean;
    /**
     * Pause microphone recording
     */
    pauseMicrophone(): void;
    /**
     * Resume microphone recording
     */
    resumeMicrophone(): void;
    /**
     * Publish the current state immediately
     *
     * This sends the current position, rotation, and volume to the server.
     */
    publishState(): Promise<void>;
    /**
     * Configure state update throttling
     *
     * @param throttleMs - Minimum milliseconds between state updates (default: 50ms = 20Hz)
     */
    setStateThrottle(throttleMs: number): void;
    /**
     * Start receiving and playing audio from the server
     *
     * @param config - Optional audio player configuration
     */
    startPlayback(config?: AudioPlayerConfig): Promise<void>;
    /**
     * Stop receiving and playing audio
     */
    stopPlayback(): void;
    /**
     * Check if audio playback is currently active
     */
    isPlaybackActive(): boolean;
    /**
     * Pause audio playback
     */
    pausePlayback(): void;
    /**
     * Resume audio playback
     */
    resumePlayback(): void;
    /**
     * Get audio playback statistics
     */
    getPlaybackStats(): {
        subscriber: unknown;
        player: unknown;
    } | null;
    /**
     * Schedule a state publish with throttling
     *
     * If called multiple times rapidly, only one publish will occur
     * after the throttle delay.
     */
    private scheduleStatePublish;
    /**
     * Extract node ID from JWT token
     */
    private extractNodeIdFromJwt;
    /**
     * Update internal state and emit events
     */
    private setState;
    /**
     * Handle connection error
     */
    private handleError;
    /**
     * Handle disconnection
     */
    private handleDisconnect;
}

/**
 * Track types used by Panaudia
 */
export declare enum PanaudiaTrackType {
    AUDIO_INPUT = "in/audio/opus-mono",
    AUDIO_OUTPUT = "out/audio/opus-stereo",
    STATE = "state"
}

/**
 * Parse ANNOUNCE_ERROR message
 */
export declare function parseAnnounceError(data: Uint8Array, offset?: number): ParsedAnnounceError;

/**
 * Parse ANNOUNCE_OK message
 */
export declare function parseAnnounceOk(data: Uint8Array, offset?: number): ParsedAnnounceOk;

/**
 * Parsed ANNOUNCE_ERROR message
 */
export declare interface ParsedAnnounceError {
    namespace: string[];
    errorCode: number;
    reasonPhrase: string;
}

/**
 * Parsed ANNOUNCE_OK message
 */
export declare interface ParsedAnnounceOk {
    namespace: string[];
}

/**
 * Parsed OBJECT_DATAGRAM
 */
export declare interface ParsedObjectDatagram {
    trackAlias: number;
    groupId: bigint;
    objectId: bigint;
    publisherPriority: number;
    payload: Uint8Array;
}

/**
 * Parsed SERVER_SETUP message
 */
export declare interface ParsedServerSetup {
    selectedVersion: number;
    parameters: Map<number, Uint8Array>;
}

/**
 * Parsed SUBSCRIBE_ERROR message
 */
export declare interface ParsedSubscribeError {
    subscribeId: number;
    errorCode: number;
    reasonPhrase: string;
    trackAlias: number;
}

/**
 * Parsed SUBSCRIBE_OK message
 */
export declare interface ParsedSubscribeOk {
    subscribeId: number;
    expires: bigint;
    contentExists: boolean;
    largestGroupId?: bigint;
    largestObjectId?: bigint;
}

/**
 * Parse the message type from the beginning of a message
 */
export declare function parseMessageType(data: Uint8Array): {
    type: MoqMessageType;
    bytesRead: number;
};

/**
 * Parse OBJECT_DATAGRAM message
 */
export declare function parseObjectDatagram(data: Uint8Array, offset?: number): ParsedObjectDatagram;

/**
 * Parse SERVER_SETUP message
 */
export declare function parseServerSetup(data: Uint8Array, offset?: number): ParsedServerSetup;

/**
 * Parse SUBSCRIBE_ERROR message
 */
export declare function parseSubscribeError(data: Uint8Array, offset?: number): ParsedSubscribeError;

/**
 * Parse SUBSCRIBE_OK message
 */
export declare function parseSubscribeOk(data: Uint8Array, offset?: number): ParsedSubscribeOk;

/**
 * Core type definitions for the Panaudia MOQ client
 *
 * These types align with the MOQ Transport specification (draft-ietf-moq-transport-11)
 * and the Panaudia spatial mixer data structures.
 */
/**
 * 3D position in Panaudia internal coordinates (0 to 1 range)
 */
export declare interface Position {
    x: number;
    y: number;
    z: number;
}

/**
 * Error thrown when MOQ protocol error occurs
 */
export declare class ProtocolError extends MoqClientError {
    readonly moqErrorCode?: number | undefined;
    constructor(message: string, moqErrorCode?: number | undefined, details?: unknown);
}

/**
 * Audio frame received from server
 */
export declare interface ReceivedAudioFrame {
    /** Track alias this frame belongs to */
    trackAlias: number;
    /** Group ID (typically timestamp-based) */
    groupId: bigint;
    /** Object ID within the group */
    objectId: bigint;
    /** Publisher priority */
    publisherPriority: number;
    /** Opus-encoded audio data */
    data: Uint8Array;
    /** Receive timestamp (local) */
    receiveTime: number;
}

/**
 * 3D rotation in degrees
 */
export declare interface Rotation {
    yaw: number;
    pitch: number;
    roll: number;
}

/**
 * State change event payload
 */
export declare interface StateChangeEvent {
    previousState: ConnectionState;
    currentState: ConnectionState;
}

/**
 * State Track Publisher
 *
 * Specialized publisher for position/rotation state updates.
 */
export declare class StateTrackPublisher extends TrackPublisher {
    private updateSequence;
    constructor(config: TrackPublisherConfig);
    /**
     * Publish a state update (NodeInfo3 binary data)
     *
     * @param stateData - 48-byte NodeInfo3 binary data
     */
    publishState(stateData: Uint8Array): Promise<void>;
}

/**
 * Error thrown when subscription fails
 */
export declare class SubscriptionError extends MoqClientError {
    readonly moqErrorCode?: number | undefined;
    readonly trackNamespace?: string[] | undefined;
    constructor(message: string, moqErrorCode?: number | undefined, trackNamespace?: string[] | undefined, details?: unknown);
}

/**
 * Error thrown when a timeout occurs
 */
export declare class TimeoutError extends MoqClientError {
    constructor(operation: string, timeoutMs: number);
}

/**
 * Track Publisher
 *
 * Publishes data to an MOQ track using datagrams for low-latency delivery.
 */
export declare class TrackPublisher {
    private readonly trackAlias;
    private readonly publisherPriority;
    private connection;
    private currentGroupId;
    private currentObjectId;
    private lastGroupTimestamp;
    private groupDurationMs;
    private stats;
    constructor(config: TrackPublisherConfig);
    /**
     * Attach to a connection for publishing
     */
    attach(connection: MoqConnection): void;
    /**
     * Detach from the connection
     */
    detach(): void;
    /**
     * Get publishing statistics
     */
    getStats(): TrackPublisherStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Publish a data payload as an MOQ object
     *
     * @param payload - The data to publish
     * @param timestampMs - Optional timestamp in milliseconds (uses current time if not provided)
     */
    publish(payload: Uint8Array, timestampMs?: number): Promise<void>;
    /**
     * Publish with explicit group and object IDs
     *
     * @param groupId - Group ID for this object
     * @param objectId - Object ID within the group
     * @param payload - The data to publish
     */
    publishWithIds(groupId: bigint, objectId: bigint, payload: Uint8Array): Promise<void>;
    /**
     * Set the group duration for automatic group ID management
     */
    setGroupDuration(durationMs: number): void;
    /**
     * Force start a new group
     */
    startNewGroup(): void;
}

/**
 * Track publisher configuration
 */
export declare interface TrackPublisherConfig {
    /** Track alias assigned by the server */
    trackAlias: number;
    /** Publisher priority (0 = highest) */
    publisherPriority?: number;
}

/**
 * Statistics for track publishing
 */
export declare interface TrackPublisherStats {
    /** Total objects published */
    objectsPublished: number;
    /** Total bytes published */
    bytesPublished: number;
    /** Number of errors */
    errors: number;
    /** Current group ID */
    currentGroupId: bigint;
    /** Current object ID within group */
    currentObjectId: bigint;
}

/**
 * Parse a UUID string into 16 bytes (RFC 4122 binary format)
 *
 * @param uuid - UUID string like "550e8400-e29b-41d4-a716-446655440000"
 * @returns 16-byte Uint8Array
 */
export declare function uuidToBytes(uuid: string): Uint8Array;

/**
 * WebTransport hash for server certificate verification
 */
declare interface WebTransportHash_2 {
    algorithm: string;
    value: BufferSource;
}

/**
 * Error thrown when WebTransport is not supported
 */
export declare class WebTransportNotSupportedError extends MoqClientError {
    constructor();
}

/**
 * WebTransport connection options
 */
declare interface WebTransportOptions_2 {
    /** Server certificate hashes for self-signed certs (development) */
    serverCertificateHashes?: WebTransportHash_2[];
    /** Allow pooling with other connections */
    allowPooling?: boolean;
    /** Require unreliable transport (datagrams) */
    requireUnreliable?: boolean;
    /** Congestion control algorithm */
    congestionControl?: 'default' | 'throughput' | 'low-latency';
}
export { WebTransportOptions_2 as WebTransportOptions }

/**
 * Wraps an unknown error into a MoqClientError
 */
export declare function wrapError(error: unknown, defaultCode?: string): MoqClientError;

export { }
