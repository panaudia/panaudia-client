import { C as ConnectionState, E as ENTITY_INFO3_SIZE, e as entityInfo3FromBytes, T as TopicMerger, d as CacheMap, c as createEntityInfo3, a as entityInfo3ToBytes } from "../topic-merger.js";
import { b, f, g, h, i, u } from "../topic-merger.js";
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function radiansToDegrees(rad) {
  return rad / Math.PI * 180;
}
function degreesToRadians(deg) {
  return deg / 180 * Math.PI;
}
function eulerToQuaternion(ex, ey, ez, order) {
  const c1 = Math.cos(ex / 2);
  const c2 = Math.cos(ey / 2);
  const c3 = Math.cos(ez / 2);
  const s1 = Math.sin(ex / 2);
  const s2 = Math.sin(ey / 2);
  const s3 = Math.sin(ez / 2);
  switch (order) {
    case "XYZ":
      return {
        x: s1 * c2 * c3 + c1 * s2 * s3,
        y: c1 * s2 * c3 - s1 * c2 * s3,
        z: c1 * c2 * s3 + s1 * s2 * c3,
        w: c1 * c2 * c3 - s1 * s2 * s3
      };
    case "YXZ":
      return {
        x: s1 * c2 * c3 + c1 * s2 * s3,
        y: c1 * s2 * c3 - s1 * c2 * s3,
        z: c1 * c2 * s3 - s1 * s2 * c3,
        w: c1 * c2 * c3 + s1 * s2 * s3
      };
    case "ZXY":
      return {
        x: s1 * c2 * c3 - c1 * s2 * s3,
        y: c1 * s2 * c3 + s1 * c2 * s3,
        z: c1 * c2 * s3 + s1 * s2 * c3,
        w: c1 * c2 * c3 - s1 * s2 * s3
      };
    case "ZYX":
      return {
        x: s1 * c2 * c3 - c1 * s2 * s3,
        y: c1 * s2 * c3 + s1 * c2 * s3,
        z: c1 * c2 * s3 - s1 * s2 * c3,
        w: c1 * c2 * c3 + s1 * s2 * s3
      };
  }
}
function quaternionToMatrix(q) {
  const { x, y, z, w } = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    1 - (yy + zz),
    xy + wz,
    xz - wy,
    0,
    xy - wz,
    1 - (xx + zz),
    yz + wx,
    0,
    xz + wy,
    yz - wx,
    1 - (xx + yy),
    0,
    0,
    0,
    0,
    1
  ];
}
function matrixToEuler(te, order) {
  const m11 = te[0], m12 = te[4], m13 = te[8];
  const m21 = te[1], m22 = te[5], m23 = te[9];
  const m31 = te[2], m32 = te[6], m33 = te[10];
  switch (order) {
    case "XYZ": {
      const sy = clamp(m13, -1, 1);
      const ey = Math.asin(sy);
      if (Math.abs(sy) < 0.9999999) {
        return { x: Math.atan2(-m23, m33), y: ey, z: Math.atan2(-m12, m11) };
      } else {
        return { x: Math.atan2(m32, m22), y: ey, z: 0 };
      }
    }
    case "YXZ": {
      const sx = clamp(m23, -1, 1);
      const ex = Math.asin(-sx);
      if (Math.abs(sx) < 0.9999999) {
        return { x: ex, y: Math.atan2(m13, m33), z: Math.atan2(m21, m22) };
      } else {
        return { x: ex, y: Math.atan2(-m31, m11), z: 0 };
      }
    }
    case "ZXY": {
      const sx = clamp(m32, -1, 1);
      const ex = Math.asin(sx);
      if (Math.abs(sx) < 0.9999999) {
        return { x: ex, y: Math.atan2(-m31, m33), z: Math.atan2(-m12, m22) };
      } else {
        return { x: ex, y: 0, z: Math.atan2(m21, m11) };
      }
    }
    case "ZYX": {
      const sy = clamp(m31, -1, 1);
      const ey = Math.asin(-sy);
      if (Math.abs(sy) < 0.9999999) {
        return { x: Math.atan2(m32, m33), y: ey, z: Math.atan2(m21, m11) };
      } else {
        return { x: 0, y: ey, z: Math.atan2(-m12, m22) };
      }
    }
  }
}
function quaternionToEuler(q, order) {
  const m = quaternionToMatrix(q);
  return matrixToEuler(m, order);
}
function webglPositionToPanaudia(pos) {
  return { x: -pos.z, y: -pos.x, z: pos.y };
}
function panaudiaPositionToWebgl(pos) {
  return { x: -pos.y, y: pos.z, z: -pos.x };
}
function webglQuatToPanaudiaRotation(q) {
  const euler = quaternionToEuler(q, "YXZ");
  return {
    yaw: radiansToDegrees(euler.y),
    pitch: radiansToDegrees(euler.x),
    roll: radiansToDegrees(euler.z)
  };
}
function panaudiaRotationToWebglQuat(rot) {
  return eulerToQuaternion(
    degreesToRadians(rot.pitch),
    degreesToRadians(rot.yaw),
    degreesToRadians(rot.roll),
    "YXZ"
  );
}
function lhYupQuatToWebgl(q) {
  return { x: -q.x, y: -q.y, z: q.z, w: q.w };
}
function webglQuatToLhYup(q) {
  return { x: -q.x, y: -q.y, z: q.z, w: q.w };
}
function unrealQuatToWebgl(q) {
  return { x: -q.y, y: -q.z, z: q.x, w: q.w };
}
function webglQuatToUnreal(q) {
  return { x: q.z, y: -q.x, z: -q.y, w: q.w };
}
function threejsToPanaudia(position, rotation) {
  const q = eulerToQuaternion(rotation.x, rotation.y, rotation.z, "XYZ");
  return {
    position: webglPositionToPanaudia(position),
    rotation: webglQuatToPanaudiaRotation(q)
  };
}
function panaudiaToThreejs(position, rotation) {
  const q = panaudiaRotationToWebglQuat(rotation);
  const euler = quaternionToEuler(q, "XYZ");
  return {
    position: panaudiaPositionToWebgl(position),
    rotation: { x: euler.x, y: euler.y, z: euler.z }
  };
}
function babylonToPanaudia(position, rotation) {
  const webglPos = { x: position.x, y: position.y, z: -position.z };
  const qBab = eulerToQuaternion(rotation.x, rotation.y, rotation.z, "YXZ");
  const qWebgl = lhYupQuatToWebgl(qBab);
  return {
    position: webglPositionToPanaudia(webglPos),
    rotation: webglQuatToPanaudiaRotation(qWebgl)
  };
}
function panaudiaToBabylon(position, rotation) {
  const webglPos = panaudiaPositionToWebgl(position);
  const qWebgl = panaudiaRotationToWebglQuat(rotation);
  const qBab = webglQuatToLhYup(qWebgl);
  const euler = quaternionToEuler(qBab, "YXZ");
  return {
    position: { x: webglPos.x, y: webglPos.y, z: -webglPos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z }
  };
}
function aframeToPanaudia(position, rotation) {
  return {
    position: webglPositionToPanaudia(position),
    rotation: { yaw: rotation.y, pitch: rotation.x, roll: rotation.z }
  };
}
function panaudiaToAframe(position, rotation) {
  return {
    position: panaudiaPositionToWebgl(position),
    rotation: { x: rotation.pitch, y: rotation.yaw, z: rotation.roll }
  };
}
function playcanvasToPanaudia(position, rotation) {
  const q = eulerToQuaternion(
    degreesToRadians(rotation.x),
    degreesToRadians(rotation.y),
    degreesToRadians(rotation.z),
    "XYZ"
  );
  return {
    position: webglPositionToPanaudia(position),
    rotation: webglQuatToPanaudiaRotation(q)
  };
}
function panaudiaToPlaycanvas(position, rotation) {
  const q = panaudiaRotationToWebglQuat(rotation);
  const euler = quaternionToEuler(q, "XYZ");
  return {
    position: panaudiaPositionToWebgl(position),
    rotation: {
      x: radiansToDegrees(euler.x),
      y: radiansToDegrees(euler.y),
      z: radiansToDegrees(euler.z)
    }
  };
}
function unityToPanaudia(position, rotation) {
  const webglPos = { x: position.x, y: position.y, z: -position.z };
  const qUnity = eulerToQuaternion(
    degreesToRadians(rotation.x),
    degreesToRadians(rotation.y),
    degreesToRadians(rotation.z),
    "ZXY"
  );
  const qWebgl = lhYupQuatToWebgl(qUnity);
  return {
    position: webglPositionToPanaudia(webglPos),
    rotation: webglQuatToPanaudiaRotation(qWebgl)
  };
}
function panaudiaToUnity(position, rotation) {
  const webglPos = panaudiaPositionToWebgl(position);
  const qWebgl = panaudiaRotationToWebglQuat(rotation);
  const qUnity = webglQuatToLhYup(qWebgl);
  const euler = quaternionToEuler(qUnity, "ZXY");
  return {
    position: { x: webglPos.x, y: webglPos.y, z: -webglPos.z },
    rotation: {
      x: radiansToDegrees(euler.x),
      y: radiansToDegrees(euler.y),
      z: radiansToDegrees(euler.z)
    }
  };
}
function unrealToPanaudia(position, rotation) {
  const panPos = { x: position.x, y: -position.y, z: position.z };
  const qUe = eulerToQuaternion(
    degreesToRadians(-rotation.roll),
    degreesToRadians(-rotation.pitch),
    degreesToRadians(rotation.yaw),
    "ZYX"
  );
  const qWebgl = unrealQuatToWebgl(qUe);
  return {
    position: panPos,
    rotation: webglQuatToPanaudiaRotation(qWebgl)
  };
}
function panaudiaToUnreal(position, rotation) {
  const qWebgl = panaudiaRotationToWebglQuat(rotation);
  const qUe = webglQuatToUnreal(qWebgl);
  const euler = quaternionToEuler(qUe, "ZYX");
  return {
    position: { x: position.x, y: -position.y, z: position.z },
    rotation: {
      roll: radiansToDegrees(-euler.x),
      pitch: radiansToDegrees(-euler.y),
      yaw: radiansToDegrees(euler.z)
    }
  };
}
function pixiToPanaudia(position, rotation) {
  return {
    position: { x: -position.y, y: -position.x, z: 0 },
    rotation: {
      yaw: -radiansToDegrees(rotation),
      pitch: 0,
      roll: 0
    }
  };
}
function panaudiaToPixi(position, rotation) {
  return {
    position: { x: -position.y, y: -position.x },
    rotation: -degreesToRadians(rotation.yaw)
  };
}
function webglToAmbisonicPosition(pos) {
  return {
    x: -(pos.z / 2) + 0.5,
    y: -(pos.x / 2) + 0.5,
    z: pos.y / 2 + 0.5
  };
}
function ambisonicToWebglPosition(pos) {
  return {
    x: -(pos.y - 0.5) * 2,
    y: (pos.z - 0.5) * 2,
    z: -((pos.x - 0.5) * 2)
  };
}
function webglToAmbisonicRotation(rot) {
  const q = eulerToQuaternion(rot.x, rot.y, rot.z, "XYZ");
  return webglQuatToPanaudiaRotation(q);
}
function ambisonicToWebglRotation(rot) {
  const q = panaudiaRotationToWebglQuat(rot);
  const euler = quaternionToEuler(q, "XYZ");
  return { x: euler.x, y: euler.y, z: euler.z };
}
class MoqClientError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "MoqClientError";
  }
}
class WebTransportNotSupportedError extends MoqClientError {
  constructor() {
    super(
      "WebTransport is not supported in this browser. Try Chrome 97+, Edge 97+, or Safari 16.4+.",
      "WEBTRANSPORT_NOT_SUPPORTED"
    );
    this.name = "WebTransportNotSupportedError";
  }
}
class ConnectionError extends MoqClientError {
  constructor(message, details) {
    super(message, "CONNECTION_FAILED", details);
    this.name = "ConnectionError";
  }
}
class AuthenticationError extends MoqClientError {
  constructor(message, moqErrorCode, details) {
    super(message, "AUTHENTICATION_FAILED", details);
    this.moqErrorCode = moqErrorCode;
    this.name = "AuthenticationError";
  }
  /**
   * Check if this is an invalid token error
   */
  isInvalidToken() {
    return this.moqErrorCode === 2 || this.moqErrorCode === 1027;
  }
  /**
   * Check if this is an expired token error
   */
  isExpiredToken() {
    return this.message.toLowerCase().includes("expired");
  }
}
class JwtParseError extends MoqClientError {
  constructor(message, details) {
    super(message, "JWT_PARSE_FAILED", details);
    this.name = "JwtParseError";
  }
}
class ProtocolError extends MoqClientError {
  constructor(message, moqErrorCode, details) {
    super(message, "PROTOCOL_ERROR", details);
    this.moqErrorCode = moqErrorCode;
    this.name = "ProtocolError";
  }
}
class SubscriptionError extends MoqClientError {
  constructor(message, moqErrorCode, trackNamespace, details) {
    super(message, "SUBSCRIPTION_FAILED", details);
    this.moqErrorCode = moqErrorCode;
    this.trackNamespace = trackNamespace;
    this.name = "SubscriptionError";
  }
}
class AnnouncementError extends MoqClientError {
  constructor(message, moqErrorCode, namespace, details) {
    super(message, "ANNOUNCEMENT_FAILED", details);
    this.moqErrorCode = moqErrorCode;
    this.namespace = namespace;
    this.name = "AnnouncementError";
  }
}
class InvalidStateError extends MoqClientError {
  constructor(expectedState, actualState) {
    super(
      `Invalid state: expected ${expectedState}, but was ${actualState}`,
      "INVALID_STATE",
      { expectedState, actualState }
    );
    this.name = "InvalidStateError";
  }
}
class TimeoutError extends MoqClientError {
  constructor(operation, timeoutMs) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      "TIMEOUT",
      { operation, timeoutMs }
    );
    this.name = "TimeoutError";
  }
}
function getMoqErrorMessage(code) {
  switch (code) {
    case 0:
      return "No error";
    case 1:
      return "Internal error";
    case 2:
      return "Unauthorized";
    case 3:
      return "Protocol violation";
    case 4:
      return "Duplicate track alias";
    case 5:
      return "Parameter length mismatch";
    case 6:
      return "Too many subscribes";
    case 16:
      return "GOAWAY timeout";
    case 1027:
      return "Invalid token (custom)";
    default:
      return `Unknown error (0x${code.toString(16)})`;
  }
}
function wrapError(error, defaultCode = "UNKNOWN") {
  if (error instanceof MoqClientError) {
    return error;
  }
  if (error instanceof Error) {
    return new MoqClientError(error.message, defaultCode, error);
  }
  return new MoqClientError(String(error), defaultCode);
}
function isWebCodecsOpusSupported() {
  return typeof AudioEncoder !== "undefined";
}
class OpusEncoder {
  encoder = null;
  config;
  frameCallback = null;
  isInitialized = false;
  constructor(config = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48e3,
      channels: config.channels ?? 1,
      bitrate: config.bitrate ?? 64e3,
      frameDurationMs: config.frameDurationMs ?? 5,
      debug: config.debug ?? false
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...args) {
    if (this.config.debug) {
      console.log("[OpusEncoder]", ...args);
    }
  }
  /**
   * Set callback for encoded frames
   */
  onFrame(callback) {
    this.frameCallback = callback;
  }
  /**
   * Initialize the encoder
   */
  async initialize() {
    if (!isWebCodecsOpusSupported()) {
      throw new MoqClientError(
        "WebCodecs AudioEncoder is not supported in this browser",
        "WEBCODECS_NOT_SUPPORTED"
      );
    }
    const frameDurationUs = this.config.frameDurationMs * 1e3;
    const encoderConfig = {
      codec: "opus",
      sampleRate: this.config.sampleRate,
      numberOfChannels: this.config.channels,
      bitrate: this.config.bitrate,
      opus: { frameDuration: frameDurationUs }
    };
    const support = await AudioEncoder.isConfigSupported(encoderConfig);
    if (!support.supported) {
      throw new MoqClientError(
        `Opus encoding not supported (frameDuration=${this.config.frameDurationMs}ms)`,
        "OPUS_NOT_SUPPORTED"
      );
    }
    this.encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        this.handleEncodedChunk(chunk, metadata);
      },
      error: (error) => {
        console.error("AudioEncoder error:", error);
      }
    });
    this.encoder.configure(encoderConfig);
    this.isInitialized = true;
    this.log(`initialized: ${this.config.sampleRate}Hz, ${this.config.channels}ch, ${this.config.bitrate}bps, ${this.config.frameDurationMs}ms frames`);
  }
  /**
   * Encode PCM audio data
   *
   * @param pcmData - Float32 PCM samples (interleaved if stereo)
   * @param timestamp - Timestamp in microseconds
   */
  encode(pcmData, timestamp) {
    if (!this.encoder || !this.isInitialized) {
      throw new MoqClientError("Encoder not initialized", "NOT_INITIALIZED");
    }
    const audioData = new AudioData({
      format: "f32",
      sampleRate: this.config.sampleRate,
      numberOfFrames: pcmData.length / this.config.channels,
      numberOfChannels: this.config.channels,
      timestamp,
      data: pcmData.buffer
    });
    try {
      this.encoder.encode(audioData);
    } finally {
      audioData.close();
    }
  }
  /**
   * Flush any pending frames
   */
  async flush() {
    if (this.encoder && this.encoder.state === "configured") {
      await this.encoder.flush();
    }
  }
  /**
   * Close the encoder and release resources
   */
  close() {
    if (this.encoder) {
      if (this.encoder.state !== "closed") {
        this.encoder.close();
      }
      this.encoder = null;
    }
    this.isInitialized = false;
  }
  /**
   * Handle encoded chunk from WebCodecs
   */
  handleEncodedChunk(chunk, _metadata) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const frameDurationUs = this.config.frameDurationMs * 1e3;
    const frame = {
      data,
      timestamp: chunk.timestamp,
      duration: chunk.duration ?? frameDurationUs
    };
    if (this.frameCallback) {
      this.frameCallback(frame);
    }
  }
  /**
   * Get encoder state
   */
  getState() {
    return this.encoder?.state ?? "closed";
  }
}
const WORKLET_PROCESSOR_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;
class AudioCaptureEncoder {
  audioContext = null;
  sourceNode = null;
  workletNode = null;
  encoder;
  config;
  sampleBuffer = [];
  bufferSize = 0;
  samplesPerFrame;
  frameDurationUs;
  timestampUs = 0;
  isRunning = false;
  constructor(config = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48e3,
      channels: config.channels ?? 1,
      bitrate: config.bitrate ?? 64e3,
      frameDurationMs: config.frameDurationMs ?? 5,
      debug: config.debug ?? false
    };
    this.encoder = new OpusEncoder(this.config);
    this.samplesPerFrame = Math.floor(this.config.sampleRate * this.config.frameDurationMs / 1e3);
    this.frameDurationUs = this.config.frameDurationMs * 1e3;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...args) {
    if (this.config.debug) {
      console.log("[AudioCaptureEncoder]", ...args);
    }
  }
  /**
   * Set callback for encoded Opus frames
   */
  onFrame(callback) {
    this.encoder.onFrame(callback);
  }
  /**
   * Start capturing and encoding
   */
  async start(mediaStream) {
    await this.encoder.initialize();
    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate
    });
    const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, "audio-capture-processor");
    this.workletNode.port.onmessage = (event) => {
      if (!this.isRunning) return;
      this.addSamples(event.data);
    };
    this.sourceNode.connect(this.workletNode);
    this.isRunning = true;
    this.log(`started (AudioWorklet, ${this.config.frameDurationMs}ms frames, ${this.samplesPerFrame} samples/frame)`);
  }
  /**
   * Add samples to buffer and encode when we have enough
   */
  addSamples(samples) {
    this.sampleBuffer.push(samples);
    this.bufferSize += samples.length;
    while (this.bufferSize >= this.samplesPerFrame) {
      const frameData = new Float32Array(this.samplesPerFrame);
      let frameOffset = 0;
      while (frameOffset < this.samplesPerFrame && this.sampleBuffer.length > 0) {
        const chunk = this.sampleBuffer[0];
        const needed = this.samplesPerFrame - frameOffset;
        const available = chunk.length;
        if (available <= needed) {
          frameData.set(chunk, frameOffset);
          frameOffset += available;
          this.sampleBuffer.shift();
          this.bufferSize -= available;
        } else {
          frameData.set(chunk.subarray(0, needed), frameOffset);
          this.sampleBuffer[0] = chunk.subarray(needed);
          this.bufferSize -= needed;
          frameOffset += needed;
        }
      }
      this.encoder.encode(frameData, this.timestampUs);
      this.timestampUs += this.frameDurationUs;
    }
  }
  /**
   * Stop capturing and encoding
   */
  async stop() {
    this.isRunning = false;
    await this.encoder.flush();
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.encoder.close();
    this.sampleBuffer = [];
    this.bufferSize = 0;
    this.log("stopped");
  }
  /**
   * Check if currently running
   */
  isActive() {
    return this.isRunning;
  }
}
var AudioPublisherState = /* @__PURE__ */ ((AudioPublisherState2) => {
  AudioPublisherState2["IDLE"] = "idle";
  AudioPublisherState2["REQUESTING_PERMISSION"] = "requesting_permission";
  AudioPublisherState2["READY"] = "ready";
  AudioPublisherState2["RECORDING"] = "recording";
  AudioPublisherState2["PAUSED"] = "paused";
  AudioPublisherState2["ERROR"] = "error";
  return AudioPublisherState2;
})(AudioPublisherState || {});
class AudioPermissionError extends MoqClientError {
  constructor(message, details) {
    super(message, "AUDIO_PERMISSION_DENIED", details);
    this.name = "AudioPermissionError";
  }
}
class AudioEncodingError extends MoqClientError {
  constructor(message, details) {
    super(message, "AUDIO_ENCODING_FAILED", details);
    this.name = "AudioEncodingError";
  }
}
class AudioNotSupportedError extends MoqClientError {
  constructor(message) {
    super(message, "AUDIO_NOT_SUPPORTED");
    this.name = "AudioNotSupportedError";
  }
}
class BluetoothMicDefaultError extends MoqClientError {
  availableDevices;
  constructor(defaultLabel, availableDevices) {
    super(
      `Default microphone is Bluetooth (${defaultLabel}). Please select a non-Bluetooth microphone to preserve stereo audio.`,
      "BLUETOOTH_MIC_DEFAULT",
      { defaultLabel, availableDevices }
    );
    this.name = "BluetoothMicDefaultError";
    this.availableDevices = availableDevices;
  }
}
function isOpusSupported() {
  if (typeof MediaRecorder === "undefined") {
    return false;
  }
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm"
  ];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return true;
    }
  }
  return false;
}
function getBestOpusMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm"
  ];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return null;
}
class AudioPublisher {
  config;
  state = "idle";
  mediaStream = null;
  mediaRecorder = null;
  frameHandler = null;
  // WebCodecs encoder (preferred - produces raw Opus)
  webCodecsEncoder = null;
  useWebCodecs = false;
  // Timing
  startTime = 0;
  frameSequence = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...args) {
    if (this.config.debug) {
      console.log("[AudioPublisher]", ...args);
    }
  }
  constructor(config = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48e3,
      channelCount: config.channelCount ?? 1,
      bitrate: config.bitrate ?? 64e3,
      frameDurationMs: config.frameDurationMs ?? 5,
      echoCancellation: config.echoCancellation ?? false,
      noiseSuppression: config.noiseSuppression ?? false,
      autoGainControl: config.autoGainControl ?? false,
      deviceId: config.deviceId,
      debug: config.debug ?? false
    };
    this.useWebCodecs = isWebCodecsOpusSupported();
    if (this.useWebCodecs) {
      this.log("Using WebCodecs for raw Opus encoding");
    } else {
      this.log("WebCodecs not available, using MediaRecorder (WebM container)");
    }
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Set handler for audio frames
   */
  onFrame(handler) {
    this.frameHandler = handler;
  }
  /**
   * Request microphone access and prepare for recording
   */
  async initialize() {
    if (this.state !== "idle") {
      throw new MoqClientError(
        `Cannot initialize: already in state ${this.state}`,
        "INVALID_STATE"
      );
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new AudioNotSupportedError(
        "getUserMedia is not supported in this browser"
      );
    }
    if (!isOpusSupported()) {
      throw new AudioNotSupportedError(
        "Opus encoding is not supported in this browser. Try Chrome, Firefox, or Edge."
      );
    }
    this.setState(
      "requesting_permission"
      /* REQUESTING_PERMISSION */
    );
    try {
      const deviceId = this.config.deviceId;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.channelCount,
          sampleRate: this.config.sampleRate,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          latency: { ideal: 5e-3 },
          ...deviceId ? { deviceId: { exact: deviceId } } : {}
        },
        video: false
      });
      this.setState(
        "ready"
        /* READY */
      );
      this.log("Microphone access granted");
    } catch (error) {
      this.setState(
        "error"
        /* ERROR */
      );
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          throw new AudioPermissionError(
            "Microphone access denied. Please allow microphone access in your browser settings.",
            error
          );
        } else if (error.name === "NotFoundError") {
          throw new AudioPermissionError(
            "No microphone found. Please connect a microphone and try again.",
            error
          );
        } else if (error.name === "NotReadableError") {
          throw new AudioPermissionError(
            "Microphone is in use by another application.",
            error
          );
        }
      }
      throw new AudioPermissionError(
        `Failed to access microphone: ${error}`,
        error
      );
    }
  }
  /**
   * Start recording and encoding audio
   */
  start() {
    if (this.state !== "ready" && this.state !== "paused") {
      throw new MoqClientError(
        `Cannot start: must be in READY or PAUSED state, currently ${this.state}`,
        "INVALID_STATE"
      );
    }
    if (!this.mediaStream) {
      throw new MoqClientError("No media stream available", "INVALID_STATE");
    }
    if (this.useWebCodecs) {
      this.startWebCodecs();
      return;
    }
    this.startMediaRecorder();
  }
  /**
   * Start encoding using WebCodecs AudioEncoder (preferred - raw Opus)
   */
  startWebCodecs() {
    this.webCodecsEncoder = new AudioCaptureEncoder({
      sampleRate: this.config.sampleRate,
      channels: this.config.channelCount,
      bitrate: this.config.bitrate,
      frameDurationMs: this.config.frameDurationMs,
      debug: this.config.debug
    });
    this.webCodecsEncoder.onFrame((opusFrame) => {
      if (this.frameHandler) {
        const frame = {
          data: opusFrame.data,
          timestamp: Math.floor(opusFrame.timestamp / 1e3),
          // Convert us to ms
          duration: Math.floor(opusFrame.duration / 1e3)
        };
        this.frameHandler(frame);
      }
    });
    this.webCodecsEncoder.start(this.mediaStream).then(() => {
      this.setState(
        "recording"
        /* RECORDING */
      );
      this.log(`Recording started with WebCodecs, ${this.config.bitrate} bps (raw Opus)`);
    }).catch((error) => {
      console.error("Failed to start WebCodecs encoder:", error);
      this.setState(
        "error"
        /* ERROR */
      );
    });
  }
  /**
   * Start encoding using MediaRecorder (fallback - WebM container)
   */
  startMediaRecorder() {
    const mimeType = getBestOpusMimeType();
    if (!mimeType) {
      throw new AudioNotSupportedError("No supported Opus MIME type found");
    }
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType,
      audioBitsPerSecond: this.config.bitrate
    });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.handleEncodedData(event.data);
      }
    };
    this.mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event);
      this.setState(
        "error"
        /* ERROR */
      );
    };
    this.mediaRecorder.onstop = () => {
      this.log("MediaRecorder stopped");
    };
    this.startTime = performance.now();
    this.frameSequence = 0;
    this.mediaRecorder.start(this.config.frameDurationMs);
    this.setState(
      "recording"
      /* RECORDING */
    );
    this.log(`Recording started with ${mimeType}, ${this.config.bitrate} bps (WARNING: WebM container, server may not decode correctly)`);
  }
  /**
   * Pause recording
   */
  pause() {
    if (this.state !== "recording") {
      return;
    }
    if (this.webCodecsEncoder) {
      this.webCodecsEncoder.stop().catch(console.error);
      this.setState(
        "paused"
        /* PAUSED */
      );
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
      this.setState(
        "paused"
        /* PAUSED */
      );
    }
  }
  /**
   * Resume recording
   */
  resume() {
    if (this.state !== "paused") {
      return;
    }
    if (this.useWebCodecs && this.mediaStream) {
      this.startWebCodecs();
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      this.setState(
        "recording"
        /* RECORDING */
      );
    }
  }
  /**
   * Stop recording
   */
  stop() {
    if (this.webCodecsEncoder) {
      this.webCodecsEncoder.stop().catch((error) => {
        console.error("Error stopping WebCodecs encoder:", error);
      });
      this.webCodecsEncoder = null;
    }
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }
    this.setState(
      "ready"
      /* READY */
    );
  }
  /**
   * Enable or disable the mic tracks. Disabling makes the source emit
   * silent samples — the encoder + track publisher stay alive, MOQ
   * frames keep flowing as Opus DTX comfort-noise.
   */
  setMicEnabled(enabled) {
    if (!this.mediaStream) return;
    for (const track of this.mediaStream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }
  /**
   * Release all resources
   */
  dispose() {
    this.stop();
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    this.frameHandler = null;
    this.setState(
      "idle"
      /* IDLE */
    );
  }
  /**
   * Handle encoded audio data from MediaRecorder
   */
  async handleEncodedData(blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const timestamp = performance.now() - this.startTime;
      const frame = {
        data,
        timestamp: Math.floor(timestamp),
        duration: this.config.frameDurationMs
      };
      this.frameSequence++;
      if (this.frameHandler) {
        this.frameHandler(frame);
      }
    } catch (error) {
      console.error("Error processing encoded audio:", error);
    }
  }
  /**
   * Update state
   */
  setState(state) {
    this.state = state;
  }
}
function getAudioCapabilities() {
  const webCodecs = isWebCodecsOpusSupported();
  const mediaRecorder = isOpusSupported();
  let preferredEncoder = "none";
  if (webCodecs) {
    preferredEncoder = "webcodecs";
  } else if (mediaRecorder) {
    preferredEncoder = "mediarecorder";
  }
  return {
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    opusSupport: mediaRecorder,
    bestMimeType: getBestOpusMimeType(),
    webCodecs,
    preferredEncoder
  };
}
var MoqMessageType = /* @__PURE__ */ ((MoqMessageType2) => {
  MoqMessageType2[MoqMessageType2["CLIENT_SETUP"] = 32] = "CLIENT_SETUP";
  MoqMessageType2[MoqMessageType2["SERVER_SETUP"] = 33] = "SERVER_SETUP";
  MoqMessageType2[MoqMessageType2["ANNOUNCE"] = 6] = "ANNOUNCE";
  MoqMessageType2[MoqMessageType2["ANNOUNCE_OK"] = 7] = "ANNOUNCE_OK";
  MoqMessageType2[MoqMessageType2["ANNOUNCE_ERROR"] = 8] = "ANNOUNCE_ERROR";
  MoqMessageType2[MoqMessageType2["UNANNOUNCE"] = 9] = "UNANNOUNCE";
  MoqMessageType2[MoqMessageType2["SUBSCRIBE"] = 3] = "SUBSCRIBE";
  MoqMessageType2[MoqMessageType2["SUBSCRIBE_OK"] = 4] = "SUBSCRIBE_OK";
  MoqMessageType2[MoqMessageType2["SUBSCRIBE_ERROR"] = 5] = "SUBSCRIBE_ERROR";
  MoqMessageType2[MoqMessageType2["UNSUBSCRIBE"] = 10] = "UNSUBSCRIBE";
  MoqMessageType2[MoqMessageType2["SUBSCRIBE_DONE"] = 11] = "SUBSCRIBE_DONE";
  MoqMessageType2[MoqMessageType2["OBJECT_STREAM"] = 0] = "OBJECT_STREAM";
  MoqMessageType2[MoqMessageType2["OBJECT_DATAGRAM"] = 1] = "OBJECT_DATAGRAM";
  MoqMessageType2[MoqMessageType2["GOAWAY"] = 16] = "GOAWAY";
  return MoqMessageType2;
})(MoqMessageType || {});
var MoqSetupParameter = /* @__PURE__ */ ((MoqSetupParameter2) => {
  MoqSetupParameter2[MoqSetupParameter2["ROLE"] = 0] = "ROLE";
  MoqSetupParameter2[MoqSetupParameter2["PATH"] = 1] = "PATH";
  MoqSetupParameter2[MoqSetupParameter2["MAX_SUBSCRIBE_ID"] = 2] = "MAX_SUBSCRIBE_ID";
  return MoqSetupParameter2;
})(MoqSetupParameter || {});
var MoqRole = /* @__PURE__ */ ((MoqRole2) => {
  MoqRole2[MoqRole2["PUBLISHER"] = 0] = "PUBLISHER";
  MoqRole2[MoqRole2["SUBSCRIBER"] = 1] = "SUBSCRIBER";
  MoqRole2[MoqRole2["PUBSUB"] = 2] = "PUBSUB";
  return MoqRole2;
})(MoqRole || {});
var MoqFilterType = /* @__PURE__ */ ((MoqFilterType2) => {
  MoqFilterType2[MoqFilterType2["LATEST_GROUP"] = 1] = "LATEST_GROUP";
  MoqFilterType2[MoqFilterType2["LATEST_OBJECT"] = 2] = "LATEST_OBJECT";
  MoqFilterType2[MoqFilterType2["ABSOLUTE_START"] = 3] = "ABSOLUTE_START";
  MoqFilterType2[MoqFilterType2["ABSOLUTE_RANGE"] = 4] = "ABSOLUTE_RANGE";
  return MoqFilterType2;
})(MoqFilterType || {});
var MoqForwardingPreference = /* @__PURE__ */ ((MoqForwardingPreference2) => {
  MoqForwardingPreference2[MoqForwardingPreference2["DATAGRAM"] = 0] = "DATAGRAM";
  MoqForwardingPreference2[MoqForwardingPreference2["STREAM_TRACK"] = 1] = "STREAM_TRACK";
  MoqForwardingPreference2[MoqForwardingPreference2["STREAM_GROUP"] = 2] = "STREAM_GROUP";
  MoqForwardingPreference2[MoqForwardingPreference2["STREAM_OBJECT"] = 3] = "STREAM_OBJECT";
  return MoqForwardingPreference2;
})(MoqForwardingPreference || {});
var MoqErrorCode = /* @__PURE__ */ ((MoqErrorCode2) => {
  MoqErrorCode2[MoqErrorCode2["NO_ERROR"] = 0] = "NO_ERROR";
  MoqErrorCode2[MoqErrorCode2["INTERNAL_ERROR"] = 1] = "INTERNAL_ERROR";
  MoqErrorCode2[MoqErrorCode2["UNAUTHORIZED"] = 2] = "UNAUTHORIZED";
  MoqErrorCode2[MoqErrorCode2["PROTOCOL_VIOLATION"] = 3] = "PROTOCOL_VIOLATION";
  MoqErrorCode2[MoqErrorCode2["DUPLICATE_TRACK_ALIAS"] = 4] = "DUPLICATE_TRACK_ALIAS";
  MoqErrorCode2[MoqErrorCode2["PARAMETER_LENGTH_MISMATCH"] = 5] = "PARAMETER_LENGTH_MISMATCH";
  MoqErrorCode2[MoqErrorCode2["TOO_MANY_SUBSCRIBES"] = 6] = "TOO_MANY_SUBSCRIBES";
  MoqErrorCode2[MoqErrorCode2["GOAWAY_TIMEOUT"] = 16] = "GOAWAY_TIMEOUT";
  MoqErrorCode2[MoqErrorCode2["INVALID_TOKEN"] = 1027] = "INVALID_TOKEN";
  return MoqErrorCode2;
})(MoqErrorCode || {});
var MoqGroupOrder = /* @__PURE__ */ ((MoqGroupOrder2) => {
  MoqGroupOrder2[MoqGroupOrder2["NONE"] = 0] = "NONE";
  MoqGroupOrder2[MoqGroupOrder2["ASCENDING"] = 1] = "ASCENDING";
  MoqGroupOrder2[MoqGroupOrder2["DESCENDING"] = 2] = "DESCENDING";
  return MoqGroupOrder2;
})(MoqGroupOrder || {});
var PanaudiaTrackType = /* @__PURE__ */ ((PanaudiaTrackType2) => {
  PanaudiaTrackType2["AUDIO_INPUT"] = "in/audio/opus-mono";
  PanaudiaTrackType2["AUDIO_OUTPUT"] = "out/audio/opus-stereo";
  PanaudiaTrackType2["STATE"] = "state";
  PanaudiaTrackType2["STATE_OUTPUT"] = "out/state";
  PanaudiaTrackType2["ATTRIBUTES_OUTPUT"] = "out/attributes";
  PanaudiaTrackType2["ENTITY_OUTPUT"] = "out/entity";
  PanaudiaTrackType2["SPACE_OUTPUT"] = "out/space";
  PanaudiaTrackType2["CONTROL_INPUT"] = "in/control";
  return PanaudiaTrackType2;
})(PanaudiaTrackType || {});
function generateTrackNamespace(trackType, entityId) {
  switch (trackType) {
    case "in/audio/opus-mono":
      return ["in", "audio", "opus-mono", entityId];
    case "out/audio/opus-stereo":
      return ["out", "audio", "opus-stereo", entityId];
    case "state":
      return ["state", entityId];
    case "out/state":
      return ["out", "state", entityId];
    case "out/attributes":
      return ["out", "attributes", entityId];
    case "out/entity":
      return ["out", "entity", entityId];
    case "out/space":
      return ["out", "space", entityId];
    case "in/control":
      return ["in", "control", entityId];
    default:
      throw new Error(`Unknown track type: ${trackType}`);
  }
}
function encodeVarint(value) {
  const n = BigInt(value);
  if (n < 64n) {
    return new Uint8Array([Number(n)]);
  } else if (n < 16384n) {
    return new Uint8Array([Number(n >> 8n | 0x40n), Number(n & 0xffn)]);
  } else if (n < 1073741824n) {
    return new Uint8Array([
      Number(n >> 24n | 0x80n),
      Number(n >> 16n & 0xffn),
      Number(n >> 8n & 0xffn),
      Number(n & 0xffn)
    ]);
  } else {
    return new Uint8Array([
      Number(n >> 56n | 0xc0n),
      Number(n >> 48n & 0xffn),
      Number(n >> 40n & 0xffn),
      Number(n >> 32n & 0xffn),
      Number(n >> 24n & 0xffn),
      Number(n >> 16n & 0xffn),
      Number(n >> 8n & 0xffn),
      Number(n & 0xffn)
    ]);
  }
}
function decodeVarint(data, offset = 0) {
  if (offset >= data.length) {
    throw new Error("Not enough data to decode varint");
  }
  const firstByte = data[offset];
  const prefix = firstByte >> 6;
  switch (prefix) {
    case 0: {
      return { value: BigInt(firstByte), bytesRead: 1 };
    }
    case 1: {
      if (offset + 2 > data.length) {
        throw new Error("Not enough data for 2-byte varint");
      }
      const value = BigInt((firstByte & 63) << 8) | BigInt(data[offset + 1]);
      return { value, bytesRead: 2 };
    }
    case 2: {
      if (offset + 4 > data.length) {
        throw new Error("Not enough data for 4-byte varint");
      }
      const value = BigInt(firstByte & 63) << 24n | BigInt(data[offset + 1]) << 16n | BigInt(data[offset + 2]) << 8n | BigInt(data[offset + 3]);
      return { value, bytesRead: 4 };
    }
    case 3: {
      if (offset + 8 > data.length) {
        throw new Error("Not enough data for 8-byte varint");
      }
      const value = BigInt(firstByte & 63) << 56n | BigInt(data[offset + 1]) << 48n | BigInt(data[offset + 2]) << 40n | BigInt(data[offset + 3]) << 32n | BigInt(data[offset + 4]) << 24n | BigInt(data[offset + 5]) << 16n | BigInt(data[offset + 6]) << 8n | BigInt(data[offset + 7]);
      return { value, bytesRead: 8 };
    }
    default:
      throw new Error("Invalid varint prefix");
  }
}
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
function encodeString(str) {
  const bytes = textEncoder.encode(str);
  const lengthBytes = encodeVarint(bytes.length);
  const result = new Uint8Array(lengthBytes.length + bytes.length);
  result.set(lengthBytes, 0);
  result.set(bytes, lengthBytes.length);
  return result;
}
function decodeString(data, offset = 0) {
  const { value: length, bytesRead: lengthBytes } = decodeVarint(data, offset);
  const stringLength = Number(length);
  const stringStart = offset + lengthBytes;
  const stringEnd = stringStart + stringLength;
  if (stringEnd > data.length) {
    throw new Error("Not enough data for string");
  }
  const value = textDecoder.decode(data.subarray(stringStart, stringEnd));
  return { value, bytesRead: lengthBytes + stringLength };
}
function encodeBytes(bytes) {
  const lengthBytes = encodeVarint(bytes.length);
  const result = new Uint8Array(lengthBytes.length + bytes.length);
  result.set(lengthBytes, 0);
  result.set(bytes, lengthBytes.length);
  return result;
}
function decodeBytes(data, offset = 0) {
  const { value: length, bytesRead: lengthBytes } = decodeVarint(data, offset);
  const bytesLength = Number(length);
  const bytesStart = offset + lengthBytes;
  const bytesEnd = bytesStart + bytesLength;
  if (bytesEnd > data.length) {
    throw new Error("Not enough data for bytes");
  }
  const value = data.subarray(bytesStart, bytesEnd);
  return { value, bytesRead: lengthBytes + bytesLength };
}
class MessageBuilder {
  chunks = [];
  totalLength = 0;
  /**
   * Append a varint to the message
   */
  writeVarint(value) {
    const bytes = encodeVarint(value);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }
  /**
   * Append a length-prefixed string to the message
   */
  writeString(str) {
    const bytes = encodeString(str);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }
  /**
   * Append length-prefixed bytes to the message
   */
  writeBytes(data) {
    const bytes = encodeBytes(data);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }
  /**
   * Append raw bytes (no length prefix) to the message
   */
  writeRaw(data) {
    this.chunks.push(data);
    this.totalLength += data.length;
    return this;
  }
  /**
   * Build the final message
   */
  build() {
    const result = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}
function wrapWithLengthFrame(messageType, content) {
  const typeBytes = encodeVarint(messageType);
  const length = content.length;
  const lengthBytes = new Uint8Array(2);
  lengthBytes[0] = length >> 8 & 255;
  lengthBytes[1] = length & 255;
  const result = new Uint8Array(typeBytes.length + 2 + content.length);
  result.set(typeBytes, 0);
  result.set(lengthBytes, typeBytes.length);
  result.set(content, typeBytes.length + 2);
  return result;
}
function encodeParams(builder, params) {
  const sorted = [...params].sort((a, b2) => a.type - b2.type);
  builder.writeVarint(sorted.length);
  let prev = 0;
  for (const p of sorted) {
    builder.writeVarint(p.type - prev);
    prev = p.type;
    if (p.type % 2 === 1) {
      const bytes = p.value;
      builder.writeVarint(bytes.length);
      builder.writeRaw(bytes);
    } else {
      builder.writeVarint(p.value);
    }
  }
}
function decodeParams(data, offset = 0) {
  let pos = offset;
  const { value: count, bytesRead: countBytes } = decodeVarint(data, pos);
  pos += countBytes;
  const params = /* @__PURE__ */ new Map();
  let prev = 0;
  for (let i2 = 0; i2 < Number(count); i2++) {
    const { value: delta, bytesRead: deltaBytes } = decodeVarint(data, pos);
    pos += deltaBytes;
    const type = prev + Number(delta);
    prev = type;
    if (type % 2 === 1) {
      const { value: blob, bytesRead: blobBytes } = decodeBytes(data, pos);
      pos += blobBytes;
      params.set(type, blob);
    } else {
      const { value: v, bytesRead: vBytes } = decodeVarint(data, pos);
      pos += vBytes;
      params.set(type, v);
    }
  }
  return { params, bytesRead: pos - offset };
}
function buildClientSetup(_supportedVersions, _role, path, maxSubscribeId) {
  const contentBuilder = new MessageBuilder();
  const params = [];
  if (path !== void 0) {
    params.push({ type: MoqSetupParameter.PATH, value: textEncoder.encode(path) });
  }
  if (maxSubscribeId !== void 0) {
    params.push({ type: MoqSetupParameter.MAX_SUBSCRIBE_ID, value: BigInt(maxSubscribeId) });
  }
  encodeParams(contentBuilder, params);
  return wrapWithLengthFrame(MoqMessageType.CLIENT_SETUP, contentBuilder.build());
}
const SUB_PARAM_FORWARD = 16;
const SUB_PARAM_PRIORITY = 32;
const SUB_PARAM_FILTER = 33;
const SUB_PARAM_GROUP_ORDER = 34;
const SUB_OK_PARAM_EXPIRES = 8;
const SUB_OK_PARAM_LARGEST = 9;
const PARAM_AUTHORIZATION = 3;
const PARAM_RESUME_HLC = 65281;
function buildSubscribe(subscription) {
  const contentBuilder = new MessageBuilder();
  contentBuilder.writeVarint(subscription.subscribeId);
  contentBuilder.writeVarint(subscription.namespace.length);
  for (const part of subscription.namespace) {
    contentBuilder.writeString(part);
  }
  contentBuilder.writeString(subscription.trackName);
  const params = [];
  params.push({ type: SUB_PARAM_PRIORITY, value: BigInt(subscription.subscriberPriority ?? 128) });
  params.push({ type: SUB_PARAM_GROUP_ORDER, value: BigInt(subscription.groupOrder ?? MoqGroupOrder.ASCENDING) });
  params.push({ type: SUB_PARAM_FORWARD, value: BigInt(subscription.forward ?? 1) });
  const filterBuilder = new MessageBuilder();
  filterBuilder.writeVarint(subscription.filterType);
  params.push({ type: SUB_PARAM_FILTER, value: filterBuilder.build() });
  if (subscription.authorization) {
    params.push({ type: PARAM_AUTHORIZATION, value: textEncoder.encode(subscription.authorization) });
  }
  if (subscription.resumeOpId !== void 0 && subscription.resumeOpId > 0n) {
    const opIdBuf = new Uint8Array(8);
    new DataView(opIdBuf.buffer).setBigUint64(0, subscription.resumeOpId, false);
    params.push({ type: PARAM_RESUME_HLC, value: opIdBuf });
  }
  encodeParams(contentBuilder, params);
  return wrapWithLengthFrame(MoqMessageType.SUBSCRIBE, contentBuilder.build());
}
function buildAnnounce(announcement) {
  const contentBuilder = new MessageBuilder();
  contentBuilder.writeVarint(announcement.requestId);
  contentBuilder.writeVarint(announcement.namespace.length);
  for (const part of announcement.namespace) {
    contentBuilder.writeString(part);
  }
  const params = [];
  if (announcement.parameters) {
    for (const [key, value] of announcement.parameters) {
      params.push({ type: key, value });
    }
  }
  encodeParams(contentBuilder, params);
  return wrapWithLengthFrame(MoqMessageType.ANNOUNCE, contentBuilder.build());
}
function buildUnsubscribe(subscribeId) {
  const contentBuilder = new MessageBuilder();
  contentBuilder.writeVarint(subscribeId);
  return wrapWithLengthFrame(MoqMessageType.UNSUBSCRIBE, contentBuilder.build());
}
function buildUnannounce(namespace) {
  const contentBuilder = new MessageBuilder();
  contentBuilder.writeVarint(namespace.length);
  for (const part of namespace) {
    contentBuilder.writeString(part);
  }
  return wrapWithLengthFrame(MoqMessageType.UNANNOUNCE, contentBuilder.build());
}
function buildObjectDatagram(trackAlias, groupId, objectId, publisherPriority, payload) {
  const builder = new MessageBuilder();
  builder.writeVarint(0);
  builder.writeVarint(trackAlias);
  builder.writeVarint(groupId);
  builder.writeVarint(objectId);
  builder.writeRaw(new Uint8Array([publisherPriority & 255]));
  builder.writeRaw(payload);
  return builder.build();
}
function parseMessageType(data) {
  const { value, bytesRead } = decodeVarint(data, 0);
  return { type: Number(value), bytesRead };
}
function parseServerSetup(data, offset = 0) {
  const { params } = decodeParams(data, offset);
  const parameters = /* @__PURE__ */ new Map();
  for (const [type, value] of params) {
    parameters.set(type, value instanceof Uint8Array ? value : encodeVarint(value));
  }
  return {
    selectedVersion: MOQ_TRANSPORT_VERSION,
    parameters
  };
}
function parseSubscribeOk(data, offset = 0) {
  let pos = offset;
  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);
  pos += subIdBytes;
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;
  const { params } = decodeParams(data, pos);
  const result = {
    subscribeId: Number(subscribeId),
    trackAlias: Number(trackAlias),
    expires: 0n,
    groupOrder: 0,
    contentExists: false
  };
  const expires = params.get(SUB_OK_PARAM_EXPIRES);
  if (typeof expires === "bigint") result.expires = expires;
  const groupOrder = params.get(SUB_PARAM_GROUP_ORDER);
  if (typeof groupOrder === "bigint") result.groupOrder = Number(groupOrder);
  const largest = params.get(SUB_OK_PARAM_LARGEST);
  if (largest instanceof Uint8Array) {
    result.contentExists = true;
    const g2 = decodeVarint(largest, 0);
    const o = decodeVarint(largest, g2.bytesRead);
    result.largestGroupId = g2.value;
    result.largestObjectId = o.value;
  }
  return result;
}
function parseSubscribeError(data, offset = 0) {
  let pos = offset;
  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);
  pos += subIdBytes;
  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);
  pos += errorCodeBytes;
  const { bytesRead: retryBytes } = decodeVarint(data, pos);
  pos += retryBytes;
  const { value: reasonPhrase } = decodeString(data, pos);
  return {
    subscribeId: Number(subscribeId),
    errorCode: Number(errorCode),
    reasonPhrase,
    trackAlias: 0
  };
}
function parseAnnounceOk(data, offset = 0) {
  const { value: requestId } = decodeVarint(data, offset);
  return { requestId: Number(requestId) };
}
function parseAnnounceError(data, offset = 0) {
  let pos = offset;
  const { value: nsLength, bytesRead: nsLengthBytes } = decodeVarint(data, pos);
  pos += nsLengthBytes;
  const namespace = [];
  for (let i2 = 0; i2 < Number(nsLength); i2++) {
    const { value: part, bytesRead: partBytes } = decodeString(data, pos);
    pos += partBytes;
    namespace.push(part);
  }
  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);
  pos += errorCodeBytes;
  const { value: reasonPhrase, bytesRead: reasonBytes } = decodeString(data, pos);
  pos += reasonBytes;
  return {
    namespace,
    errorCode: Number(errorCode),
    reasonPhrase
  };
}
function parseObjectDatagram(data, offset = 0) {
  let pos = offset;
  const { value: _type, bytesRead: typeBytes } = decodeVarint(data, pos);
  pos += typeBytes;
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;
  const { value: groupId, bytesRead: groupIdBytes } = decodeVarint(data, pos);
  pos += groupIdBytes;
  const { value: objectId, bytesRead: objectIdBytes } = decodeVarint(data, pos);
  pos += objectIdBytes;
  if (pos >= data.length) {
    throw new Error("Not enough data for publisher priority");
  }
  const publisherPriority = data[pos];
  pos += 1;
  const payload = data.subarray(pos);
  return {
    trackAlias: Number(trackAlias),
    groupId,
    objectId,
    publisherPriority,
    payload
  };
}
const MOQ_TRANSPORT_VERSION = 4278190080 + 16;
const PENDING_DATAGRAM_MAX_BYTES = 1 * 1024 * 1024;
class DatagramRouter {
  handlers = /* @__PURE__ */ new Map();
  // Pre-handler buffer, FIFO across all aliases; oldest dropped when the byte cap
  // is exceeded. Cleared on clear().
  pending = [];
  pendingBytes = 0;
  /**
   * Register a handler for a track alias and drain any datagrams that arrived for
   * it before registration (the SUBSCRIBE_OK race), in arrival order.
   */
  register(trackAlias, handler) {
    this.handlers.set(trackAlias, handler);
    if (this.pending.length > 0) this.drainForAlias(trackAlias, handler);
  }
  /** Unregister a handler and discard any still-buffered datagrams for its alias. */
  unregister(trackAlias) {
    this.handlers.delete(trackAlias);
    if (this.pending.length > 0) this.discardForAlias(trackAlias);
  }
  /** Route a parsed datagram to its handler, or buffer it if none is registered yet. */
  ingest(d) {
    const handler = this.handlers.get(d.trackAlias);
    if (handler) {
      handler(d.payload, d.trackAlias, d.groupId, d.objectId);
    } else {
      this.bufferUnknown(d);
    }
  }
  /** Number of buffered pre-handler datagrams (tests/diagnostics). */
  pendingCount() {
    return this.pending.length;
  }
  /** Drop all handlers + buffered datagrams (connection close). */
  clear() {
    this.handlers.clear();
    this.pending = [];
    this.pendingBytes = 0;
  }
  drainForAlias(trackAlias, handler) {
    const remaining = [];
    let drainedBytes = 0;
    for (const d of this.pending) {
      if (d.trackAlias === trackAlias) {
        try {
          handler(d.payload, d.trackAlias, d.groupId, d.objectId);
        } catch {
        }
        drainedBytes += d.payload.length;
      } else {
        remaining.push(d);
      }
    }
    this.pending = remaining;
    this.pendingBytes -= drainedBytes;
  }
  discardForAlias(trackAlias) {
    const remaining = [];
    let discardedBytes = 0;
    for (const d of this.pending) {
      if (d.trackAlias === trackAlias) {
        discardedBytes += d.payload.length;
      } else {
        remaining.push(d);
      }
    }
    this.pending = remaining;
    this.pendingBytes -= discardedBytes;
  }
  bufferUnknown(d) {
    this.pending.push(d);
    this.pendingBytes += d.payload.length;
    while (this.pendingBytes > PENDING_DATAGRAM_MAX_BYTES && this.pending.length > 0) {
      const dropped = this.pending.shift();
      this.pendingBytes -= dropped.payload.length;
    }
  }
}
class MoqConnection {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }
  transport = null;
  state = ConnectionState.DISCONNECTED;
  handlers = {};
  datagramWriter = null;
  // Datagram dispatcher: the read loop lives here (transport concern); the
  // trackAlias→handler routing + SUBSCRIBE_OK race buffer live in the router
  // (Phase 1 extraction — worker-transport-plan.md).
  router = new DatagramRouter();
  datagramDispatcherRunning = false;
  // 'main' = this class reads the datagram readable directly (default/fallback).
  // 'worker' = the receive Worker owns the read loop (design §11.4); the main
  // dispatcher is suppressed and parsed non-audio datagrams arrive via
  // ingestForwardedDatagram(), still routed through the same DatagramRouter
  // (handler map + SUBSCRIBE_OK race buffer), unchanged.
  datagramMode = "main";
  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }
  /**
   * Get the underlying WebTransport instance
   */
  getTransport() {
    return this.transport;
  }
  /**
   * Set event handlers
   */
  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }
  /**
   * Connect to the MOQ server via WebTransport
   */
  async connect(options) {
    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new Error(`Cannot connect: already in state ${this.state}`);
    }
    this.setState(ConnectionState.CONNECTING);
    try {
      const wtOptions = {
        allowPooling: false,
        requireUnreliable: true,
        // We use datagrams for audio
        congestionControl: "low-latency",
        // Negotiate the MOQ draft-16 subprotocol over WebTransport so the server
        // selects draft-16 (it falls back to draft-14 if no subprotocol is set).
        protocols: ["moqt-16"],
        ...options
      };
      this.transport = new WebTransport(this.serverUrl, wtOptions);
      this.transport.closed.then((info) => {
        this.handleClose(info);
      }).catch((error) => {
        this.handleError(error);
      });
      await this.transport.ready;
      this.setState(ConnectionState.CONNECTED);
    } catch (error) {
      this.setState(ConnectionState.ERROR, error);
      throw error;
    }
  }
  /**
   * Close the connection gracefully
   */
  close(closeInfo) {
    this.datagramDispatcherRunning = false;
    this.datagramMode = "main";
    this.router.clear();
    if (this.datagramWriter) {
      this.datagramWriter.releaseLock();
      this.datagramWriter = null;
    }
    if (this.transport) {
      this.transport.close(closeInfo);
      this.transport = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
  }
  /**
   * Create a bidirectional stream for the MOQ control channel
   */
  async createControlStream() {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    return this.transport.createBidirectionalStream();
  }
  /**
   * Create a unidirectional stream for sending data
   */
  async createSendStream() {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    return this.transport.createUnidirectionalStream();
  }
  /**
   * Get the incoming unidirectional streams reader
   */
  getIncomingStreams() {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    return this.transport.incomingUnidirectionalStreams;
  }
  /**
   * Get the datagram writer/reader for audio frames
   */
  getDatagrams() {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    return this.transport.datagrams;
  }
  /**
   * Get a reader for incoming datagrams
   */
  getDatagramReader() {
    if (!this.transport) {
      return null;
    }
    return this.transport.datagrams.readable.getReader();
  }
  /**
   * Send a datagram (used for audio frames)
   */
  async sendDatagram(data) {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    if (!this.datagramWriter) {
      this.datagramWriter = this.transport.datagrams.writable.getWriter();
    }
    try {
      await this.datagramWriter.write(data);
    } catch (error) {
      try {
        this.datagramWriter.releaseLock();
      } catch {
      }
      this.datagramWriter = null;
      throw error;
    }
  }
  /**
   * Switch to worker datagram mode (design §11.4): the receive Worker reads the
   * datagram readable, so the main dispatcher must NOT. Returns the unlocked
   * `datagrams.readable` for transfer into the worker. Must be called before any
   * `registerDatagramHandler` (which would otherwise start the main dispatcher
   * and lock the stream). Returns null if not connected.
   */
  takeDatagramReadableForWorker() {
    if (!this.transport) return null;
    if (this.datagramDispatcherRunning) {
      throw new Error("Cannot switch to worker datagram mode: main dispatcher already reading");
    }
    this.datagramMode = "worker";
    return this.transport.datagrams.readable;
  }
  /**
   * Revert to main datagram mode if worker setup failed before locking the
   * stream (so a later registerDatagramHandler starts the main dispatcher).
   */
  revertToMainDatagramMode() {
    this.datagramMode = "main";
  }
  /**
   * Feed a parsed datagram forwarded from the receive Worker through the normal
   * dispatch path (handlers map + SUBSCRIBE_OK pending buffer). The worker only
   * forwards non-audio tracks; audio is decoded in the worker and never arrives
   * here.
   */
  ingestForwardedDatagram(trackAlias, payload, groupId, objectId) {
    this.router.ingest({ trackAlias, payload, groupId, objectId });
  }
  /**
   * Register a datagram handler for a specific track alias. Starts the dispatcher
   * on first registration (transport concern); the router drains any datagrams
   * that arrived for this alias before registration (the SUBSCRIBE_OK race).
   */
  registerDatagramHandler(trackAlias, handler) {
    if (!this.datagramDispatcherRunning) {
      this.startDatagramDispatcher();
    }
    this.router.register(trackAlias, handler);
  }
  /** Unregister a datagram handler; the router discards any still-buffered datagrams for it. */
  unregisterDatagramHandler(trackAlias) {
    this.router.unregister(trackAlias);
  }
  /**
   * Number of buffered pre-handler datagrams currently held. Exposed for tests and
   * diagnostics; production callers shouldn't need it.
   */
  getPendingDatagramCount() {
    return this.router.pendingCount();
  }
  /**
   * Start the single datagram reader loop that dispatches to handlers by track alias
   */
  startDatagramDispatcher() {
    if (this.datagramMode === "worker") {
      return;
    }
    if (this.datagramDispatcherRunning || !this.transport) {
      return;
    }
    this.datagramDispatcherRunning = true;
    const reader = this.transport.datagrams.readable.getReader();
    const loop = async () => {
      try {
        while (this.datagramDispatcherRunning) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          try {
            const parsed = parseObjectDatagram(value);
            this.router.ingest(parsed);
          } catch {
          }
        }
      } catch (error) {
        if (this.datagramDispatcherRunning) {
          console.error("Datagram dispatcher error:", error);
        }
      } finally {
        this.datagramDispatcherRunning = false;
      }
    };
    loop();
  }
  /**
   * Update connection state and notify handlers
   */
  setState(state, error) {
    this.state = state;
    if (this.handlers.onStateChange) {
      this.handlers.onStateChange(state, error);
    }
  }
  /**
   * Handle connection close
   */
  handleClose(info) {
    if (this.datagramWriter) {
      try {
        this.datagramWriter.releaseLock();
      } catch {
      }
      this.datagramWriter = null;
    }
    this.transport = null;
    this.setState(ConnectionState.DISCONNECTED);
    if (this.handlers.onClose) {
      this.handlers.onClose(info);
    }
  }
  /**
   * Handle connection error
   */
  handleError(error) {
    console.error("WebTransport connection error:", error);
    if (this.datagramWriter) {
      try {
        this.datagramWriter.releaseLock();
      } catch {
      }
      this.datagramWriter = null;
    }
    this.transport = null;
    this.setState(ConnectionState.ERROR, error);
  }
}
function isWebTransportSupported() {
  return typeof WebTransport !== "undefined";
}
function getWebTransportSupport() {
  const supported = isWebTransportSupported();
  return {
    supported,
    // These are typically supported if WebTransport is available
    datagrams: supported,
    serverCertificateHashes: supported
  };
}
class MoqSession {
  constructor(connection, debug = false) {
    this.connection = connection;
    this.debug = debug;
  }
  controlStream = null;
  writer = null;
  reader = null;
  readBuffer = new Uint8Array(0);
  nextSubscribeId = 1;
  nextTrackAlias = 1;
  nextAnnounceRequestId = 2;
  // Client uses even IDs for announces (to avoid collisions with server)
  // Track state
  subscriptions = /* @__PURE__ */ new Map();
  announcements = /* @__PURE__ */ new Map();
  incomingSubscriptions = /* @__PURE__ */ new Map();
  // Callbacks for when server subscribes to our tracks
  onIncomingSubscribeCallback = null;
  debug;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...args) {
    if (this.debug) {
      console.log("[MOQ]", ...args);
    }
  }
  /**
   * Set callback for when server subscribes to one of our announced tracks
   */
  onIncomingSubscribe(callback) {
    this.onIncomingSubscribeCallback = callback;
  }
  /**
   * Initialize the MOQ session over the control stream
   * @param role - The MOQ role (publisher, subscriber, or pubsub)
   * @param path - Optional path parameter
   * @param maxSubscribeId - Max number of requests server can send to client (default: 100)
   */
  async initialize(role, path, maxSubscribeId = 100) {
    this.log("Creating control stream...");
    this.controlStream = await this.connection.createControlStream();
    this.writer = this.controlStream.writable.getWriter();
    this.reader = this.controlStream.readable.getReader();
    this.log("Control stream created, sending CLIENT_SETUP...");
    const setupMsg = buildClientSetup([MOQ_TRANSPORT_VERSION], role, path, maxSubscribeId);
    this.log("CLIENT_SETUP message size:", setupMsg.length, "bytes");
    this.log("CLIENT_SETUP hex:", Array.from(setupMsg).map((b2) => b2.toString(16).padStart(2, "0")).join(" "));
    await this.writer.write(setupMsg);
    this.log("CLIENT_SETUP sent, waiting for SERVER_SETUP...");
    const { type, content } = await this.readFramedMessage();
    this.log("Received response type: 0x" + type.toString(16) + ", content size:", content.length, "bytes");
    if (type !== MoqMessageType.SERVER_SETUP) {
      throw new ProtocolError(
        `Expected SERVER_SETUP (0x41), got message type 0x${type.toString(16)}`,
        type
      );
    }
    const serverSetup = parseServerSetup(content, 0);
    this.log("Session established, server version:", serverSetup.selectedVersion.toString(16));
  }
  /**
   * Subscribe to a track with JWT authorization
   */
  async subscribe(namespace, trackName, authorization, resumeOpId) {
    const subscribeId = this.nextSubscribeId++;
    const subscribeMsg = buildSubscribe({
      subscribeId,
      namespace,
      trackName,
      filterType: MoqFilterType.LATEST_GROUP,
      authorization,
      resumeOpId
    });
    this.log("SUBSCRIBE message size:", subscribeMsg.length, "bytes");
    await this.writer.write(subscribeMsg);
    const { type, content } = await this.waitForMessage([
      MoqMessageType.SUBSCRIBE_OK,
      MoqMessageType.SUBSCRIBE_ERROR
    ]);
    if (type === MoqMessageType.SUBSCRIBE_OK) {
      const ok = parseSubscribeOk(content, 0);
      this.log("Subscribed successfully, subscribeId:", ok.subscribeId, "trackAlias:", ok.trackAlias);
      this.subscriptions.set(subscribeId, { namespace, trackName, alias: ok.trackAlias });
      return subscribeId;
    } else if (type === MoqMessageType.SUBSCRIBE_ERROR) {
      const error = parseSubscribeError(content, 0);
      const errorMessage = `${error.reasonPhrase} (${getMoqErrorMessage(error.errorCode)})`;
      if (error.errorCode === 2 || error.errorCode === 1027) {
        throw new AuthenticationError(errorMessage, error.errorCode, { namespace, trackName });
      }
      throw new SubscriptionError(errorMessage, error.errorCode, namespace);
    } else {
      throw new ProtocolError(
        `Expected SUBSCRIBE_OK or SUBSCRIBE_ERROR, got message type 0x${type.toString(16)}`,
        type
      );
    }
  }
  /**
   * Wait for a specific message type, handling other messages that arrive first
   */
  async waitForMessage(expectedTypes) {
    const maxAttempts = 20;
    for (let i2 = 0; i2 < maxAttempts; i2++) {
      const { type, content } = await this.readFramedMessage();
      if (expectedTypes.includes(type)) {
        return { type, content };
      }
      this.log(`Received unexpected message type 0x${type.toString(16)} while waiting, handling it`);
      await this.handleUnexpectedMessage(type, content);
    }
    throw new ProtocolError(
      `Timeout waiting for message types: ${expectedTypes.map((t) => "0x" + t.toString(16)).join(", ")}`,
      0
    );
  }
  /**
   * Handle messages that arrive when we're waiting for something else
   */
  async handleUnexpectedMessage(type, content) {
    switch (type) {
      case MoqMessageType.ANNOUNCE:
        this.log("Received ANNOUNCE from server, sending ANNOUNCE_OK");
        await this.sendAnnounceOk(content);
        break;
      case 17:
        this.log("Received SUBSCRIBE_ANNOUNCES from server, sending OK");
        await this.sendSubscribeAnnouncesOk(content);
        break;
      case MoqMessageType.SUBSCRIBE:
        this.log("Received SUBSCRIBE from server, sending SUBSCRIBE_OK");
        await this.handleIncomingSubscribe(content);
        break;
      default:
        this.log(`Skipping unhandled message type 0x${type.toString(16)}`);
    }
  }
  /**
   * Handle incoming SUBSCRIBE from server and respond with SUBSCRIBE_OK
   *
   * Per moqtransport v0.5.1 / draft-ietf-moq-transport-11, the SUBSCRIBE
   * wire format does NOT include TrackAlias. The publisher (us) assigns a
   * TrackAlias and returns it in SUBSCRIBE_OK.
   *
   * SUBSCRIBE wire format: RequestID, Namespace, TrackName, Priority,
   *   GroupOrder, Forward, FilterType, Parameters
   *
   * SUBSCRIBE_OK wire format: RequestID, TrackAlias, Expires, GroupOrder,
   *   ContentExists, [LargestLocation], Parameters
   */
  async handleIncomingSubscribe(content) {
    let pos = 0;
    const requestIdByte = content[pos];
    let requestId;
    if (requestIdByte < 64) {
      requestId = requestIdByte;
      pos += 1;
    } else if ((requestIdByte & 192) === 64) {
      requestId = (requestIdByte & 63) << 8 | content[pos + 1];
      pos += 2;
    } else {
      requestId = requestIdByte & 63;
      pos += 1;
    }
    const namespace = this.parseNamespaceFromContent(content, pos);
    const trackAlias = this.nextTrackAlias++;
    this.log(`Server subscribing to: ${namespace.join("/")}, assigning trackAlias=${trackAlias}`);
    const builder = new MessageBuilder();
    builder.writeVarint(requestId);
    builder.writeVarint(trackAlias);
    builder.writeVarint(0);
    builder.writeRaw(new Uint8Array([1]));
    builder.writeRaw(new Uint8Array([0]));
    builder.writeVarint(0);
    const msg = wrapWithLengthFrame(MoqMessageType.SUBSCRIBE_OK, builder.build());
    await this.writer.write(msg);
    this.log("Sent SUBSCRIBE_OK for requestId:", requestId, "trackAlias:", trackAlias);
    this.incomingSubscriptions.set(requestId, { trackAlias, namespace });
    if (this.onIncomingSubscribeCallback) {
      this.onIncomingSubscribeCallback(namespace, trackAlias);
    }
  }
  /**
   * Get track alias for an incoming subscription by namespace
   */
  getIncomingTrackAlias(namespacePrefix) {
    for (const [, sub] of this.incomingSubscriptions) {
      if (sub.namespace.join("/").startsWith(namespacePrefix)) {
        return sub.trackAlias;
      }
    }
    return void 0;
  }
  /**
   * Parse namespace from content starting at given position
   */
  parseNamespaceFromContent(content, startPos) {
    let pos = startPos;
    const namespace = [];
    if (pos >= content.length) return namespace;
    const firstByte = content[pos];
    let nsLength;
    if (firstByte < 64) {
      nsLength = firstByte;
      pos += 1;
    } else if ((firstByte & 192) === 64) {
      nsLength = (firstByte & 63) << 8 | content[pos + 1];
      pos += 2;
    } else {
      nsLength = firstByte & 63;
      pos += 1;
    }
    for (let i2 = 0; i2 < nsLength && pos < content.length; i2++) {
      const partLenByte = content[pos];
      let partLen;
      if (partLenByte < 64) {
        partLen = partLenByte;
        pos += 1;
      } else if ((partLenByte & 192) === 64) {
        partLen = (partLenByte & 63) << 8 | content[pos + 1];
        pos += 2;
      } else {
        partLen = partLenByte & 63;
        pos += 1;
      }
      if (pos + partLen <= content.length) {
        const part = new TextDecoder().decode(content.slice(pos, pos + partLen));
        namespace.push(part);
        pos += partLen;
      }
    }
    return namespace;
  }
  /**
   * Send ANNOUNCE_OK response
   */
  async sendAnnounceOk(announceContent) {
    const requestId = this.parseRequestId(announceContent);
    this.log("Sending ANNOUNCE_OK for requestId:", requestId);
    const builder = new MessageBuilder();
    builder.writeVarint(requestId);
    const msg = wrapWithLengthFrame(MoqMessageType.ANNOUNCE_OK, builder.build());
    this.log("ANNOUNCE_OK message size:", msg.length, "bytes");
    await this.writer.write(msg);
  }
  /**
   * Send SUBSCRIBE_ANNOUNCES_OK response
   */
  async sendSubscribeAnnouncesOk(subscribeAnnouncesContent) {
    const requestId = this.parseRequestId(subscribeAnnouncesContent);
    this.log("Sending SUBSCRIBE_ANNOUNCES_OK for requestId:", requestId);
    const builder = new MessageBuilder();
    builder.writeVarint(requestId);
    const msg = wrapWithLengthFrame(18, builder.build());
    await this.writer.write(msg);
  }
  /**
   * Parse RequestID (first varint) from message content
   */
  parseRequestId(content) {
    const firstByte = content[0];
    if (firstByte < 64) {
      return firstByte;
    } else if ((firstByte & 192) === 64) {
      return (firstByte & 63) << 8 | content[1];
    } else if ((firstByte & 192) === 128) {
      return (firstByte & 63) << 24 | content[1] << 16 | content[2] << 8 | content[3];
    } else {
      return content[4] << 24 | content[5] << 16 | content[6] << 8 | content[7];
    }
  }
  /**
   * Announce a track namespace
   */
  async announce(namespace, authorization) {
    const requestId = this.nextAnnounceRequestId;
    this.nextAnnounceRequestId += 2;
    const parameters = /* @__PURE__ */ new Map();
    if (authorization) {
      const encoder = new TextEncoder();
      parameters.set(3, encoder.encode(authorization));
    }
    const announceMsg = buildAnnounce({ requestId, namespace, parameters: parameters.size > 0 ? parameters : void 0 });
    this.log("ANNOUNCE message size:", announceMsg.length, "bytes, requestId:", requestId);
    await this.writer.write(announceMsg);
    const { type, content } = await this.waitForMessage([
      MoqMessageType.ANNOUNCE_OK,
      MoqMessageType.ANNOUNCE_ERROR
    ]);
    if (type === MoqMessageType.ANNOUNCE_OK) {
      const ok = parseAnnounceOk(content, 0);
      const nsKey = namespace.join("/");
      this.announcements.set(nsKey, { namespace });
      this.log("Announced successfully:", nsKey, "requestId:", ok.requestId);
    } else if (type === MoqMessageType.ANNOUNCE_ERROR) {
      const error = parseAnnounceError(content, 0);
      const errorMessage = `${error.reasonPhrase} (${getMoqErrorMessage(error.errorCode)})`;
      throw new AnnouncementError(errorMessage, error.errorCode, namespace);
    } else {
      throw new ProtocolError(
        `Expected ANNOUNCE_OK or ANNOUNCE_ERROR, got message type 0x${type.toString(16)}`,
        type
      );
    }
  }
  /**
   * Get track alias for a subscription
   */
  getTrackAlias(subscribeId) {
    return this.subscriptions.get(subscribeId)?.alias;
  }
  /**
   * Start background message processing loop
   * This handles messages that arrive after initial connection setup
   */
  startMessageLoop() {
    this.processMessages().catch((error) => {
      this.log("Message loop ended:", error.message);
    });
  }
  /**
   * Background message processing
   */
  async processMessages() {
    this.log("Starting background message processing loop");
    while (this.reader) {
      try {
        const { type, content } = await this.readFramedMessage();
        this.log(`Background received message type 0x${type.toString(16)}`);
        await this.handleUnexpectedMessage(type, content);
      } catch (error) {
        this.log("Message processing stopped:", error.message);
        break;
      }
    }
  }
  /**
   * Close the session
   */
  async close() {
    if (this.writer) {
      try {
        await this.writer.close();
      } catch {
      }
      this.writer = null;
    }
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
      }
      this.reader = null;
    }
    this.controlStream = null;
  }
  /**
   * Read a complete message from the control stream with proper length framing
   * Format: [Type varint] [Length: 2 bytes big-endian] [Content: length bytes]
   * Returns: { type, content } where content is the message body without type/length
   */
  async readFramedMessage() {
    while (this.readBuffer.length < 3) {
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error("Control stream closed unexpectedly");
      }
      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
      newBuffer.set(this.readBuffer);
      newBuffer.set(value, this.readBuffer.length);
      this.readBuffer = newBuffer;
    }
    let typeLength = 1;
    const firstByte = this.readBuffer[0];
    const prefix = firstByte >> 6;
    if (prefix === 1) typeLength = 2;
    else if (prefix === 2) typeLength = 4;
    else if (prefix === 3) typeLength = 8;
    const headerSize = typeLength + 2;
    while (this.readBuffer.length < headerSize) {
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error("Control stream closed unexpectedly");
      }
      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
      newBuffer.set(this.readBuffer);
      newBuffer.set(value, this.readBuffer.length);
      this.readBuffer = newBuffer;
    }
    let type;
    if (typeLength === 1) {
      type = firstByte;
    } else if (typeLength === 2) {
      type = (firstByte & 63) << 8 | this.readBuffer[1];
    } else {
      throw new Error(`Unsupported varint length: ${typeLength}`);
    }
    const lengthOffset = typeLength;
    const contentLength = this.readBuffer[lengthOffset] << 8 | this.readBuffer[lengthOffset + 1];
    this.log("readFramedMessage: type=0x" + type.toString(16) + ", contentLength=" + contentLength);
    const totalSize = headerSize + contentLength;
    while (this.readBuffer.length < totalSize) {
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error("Control stream closed unexpectedly");
      }
      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
      newBuffer.set(this.readBuffer);
      newBuffer.set(value, this.readBuffer.length);
      this.readBuffer = newBuffer;
    }
    const content = this.readBuffer.slice(headerSize, totalSize);
    this.readBuffer = this.readBuffer.slice(totalSize);
    this.log("readFramedMessage: returning type=0x" + type.toString(16) + ", content.length=" + content.length);
    return { type, content };
  }
}
class TrackPublisher {
  trackAlias;
  publisherPriority;
  connection = null;
  // Group/Object tracking
  currentGroupId = 0n;
  currentObjectId = 0n;
  lastGroupTimestamp = 0;
  groupDurationMs = 1e3;
  // Start new group every second
  // Statistics
  stats = {
    objectsPublished: 0,
    bytesPublished: 0,
    errors: 0,
    currentGroupId: 0n,
    currentObjectId: 0n
  };
  constructor(config) {
    this.trackAlias = config.trackAlias;
    this.publisherPriority = config.publisherPriority ?? 0;
  }
  /**
   * Get the track alias
   */
  getTrackAlias() {
    return this.trackAlias;
  }
  /**
   * Attach to a connection for publishing
   */
  attach(connection) {
    this.connection = connection;
  }
  /**
   * Detach from the connection
   */
  detach() {
    this.connection = null;
  }
  /**
   * Get publishing statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentGroupId: this.currentGroupId,
      currentObjectId: this.currentObjectId
    };
  }
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      objectsPublished: 0,
      bytesPublished: 0,
      errors: 0,
      currentGroupId: this.currentGroupId,
      currentObjectId: this.currentObjectId
    };
  }
  /**
   * Publish a data payload as an MOQ object
   *
   * @param payload - The data to publish
   * @param timestampMs - Optional timestamp in milliseconds (uses current time if not provided)
   */
  async publish(payload, timestampMs) {
    if (!this.connection) {
      throw new MoqClientError("Not attached to a connection", "NOT_CONNECTED");
    }
    const timestamp = timestampMs ?? Date.now();
    if (timestamp - this.lastGroupTimestamp >= this.groupDurationMs) {
      this.currentGroupId++;
      this.currentObjectId = 0n;
      this.lastGroupTimestamp = timestamp;
    }
    const datagram = buildObjectDatagram(
      this.trackAlias,
      this.currentGroupId,
      this.currentObjectId,
      this.publisherPriority,
      payload
    );
    try {
      await this.connection.sendDatagram(datagram);
      this.currentObjectId++;
      this.stats.objectsPublished++;
      this.stats.bytesPublished += payload.length;
    } catch (error) {
      this.stats.errors++;
      console.error("Failed to publish object:", error);
      throw new MoqClientError(
        `Failed to publish object: ${error}`,
        "PUBLISH_FAILED",
        error
      );
    }
  }
  /**
   * Publish with explicit group and object IDs
   *
   * @param groupId - Group ID for this object
   * @param objectId - Object ID within the group
   * @param payload - The data to publish
   */
  async publishWithIds(groupId, objectId, payload) {
    if (!this.connection) {
      throw new MoqClientError("Not attached to a connection", "NOT_CONNECTED");
    }
    const datagram = buildObjectDatagram(
      this.trackAlias,
      groupId,
      objectId,
      this.publisherPriority,
      payload
    );
    try {
      await this.connection.sendDatagram(datagram);
      this.stats.objectsPublished++;
      this.stats.bytesPublished += payload.length;
    } catch (error) {
      this.stats.errors++;
      throw new MoqClientError(
        `Failed to publish object: ${error}`,
        "PUBLISH_FAILED",
        error
      );
    }
  }
  /**
   * Set the group duration for automatic group ID management
   */
  setGroupDuration(durationMs) {
    this.groupDurationMs = durationMs;
  }
  /**
   * Force start a new group
   */
  startNewGroup() {
    this.currentGroupId++;
    this.currentObjectId = 0n;
    this.lastGroupTimestamp = Date.now();
  }
}
class AudioTrackPublisher extends TrackPublisher {
  frameSequence = 0n;
  sessionStartTime = 0;
  constructor(config) {
    super(config);
    this.setGroupDuration(20);
  }
  /**
   * Start a new audio session
   */
  startSession() {
    this.sessionStartTime = Date.now();
    this.frameSequence = 0n;
    this.startNewGroup();
  }
  /**
   * Publish an audio frame
   *
   * @param opusData - Opus-encoded audio data
   * @param timestampMs - Frame timestamp in milliseconds (relative to session start)
   */
  async publishAudioFrame(opusData, timestampMs) {
    const timestamp = timestampMs ?? Date.now() - this.sessionStartTime;
    const groupId = BigInt(Math.floor(timestamp));
    const objectId = this.frameSequence++;
    await this.publishWithIds(groupId, objectId, opusData);
  }
}
class StateTrackPublisher extends TrackPublisher {
  updateSequence = 0n;
  constructor(config) {
    super(config);
    this.setGroupDuration(1e3);
  }
  /**
   * Publish a state update (EntityInfo3 binary data)
   *
   * @param stateData - 48-byte EntityInfo3 binary data
   */
  async publishState(stateData) {
    if (stateData.length !== 48) {
      throw new MoqClientError(
        `Invalid state data size: expected 48 bytes, got ${stateData.length}`,
        "INVALID_DATA"
      );
    }
    const timestamp = Date.now();
    const groupId = BigInt(Math.floor(timestamp / 1e3));
    const objectId = this.updateSequence++;
    await this.publishWithIds(groupId, objectId, stateData);
  }
}
var AudioSubscriberState = /* @__PURE__ */ ((AudioSubscriberState2) => {
  AudioSubscriberState2["IDLE"] = "idle";
  AudioSubscriberState2["SUBSCRIBING"] = "subscribing";
  AudioSubscriberState2["ACTIVE"] = "active";
  AudioSubscriberState2["ERROR"] = "error";
  return AudioSubscriberState2;
})(AudioSubscriberState || {});
class AudioSubscriber {
  connection = null;
  state = "idle";
  frameHandler = null;
  trackAlias = 0;
  isListening = false;
  // Statistics
  stats = {
    framesReceived: 0,
    bytesReceived: 0,
    framesDropped: 0,
    currentGroupId: 0n,
    lastFrameTime: 0
  };
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }
  /**
   * Set handler for received audio frames
   */
  onFrame(handler) {
    this.frameHandler = handler;
  }
  /**
   * Attach to a connection and start listening for datagrams
   *
   * @param connection - MOQ connection
   * @param trackAlias - Track alias to filter frames
   */
  attach(connection, trackAlias) {
    this.connection = connection;
    this.trackAlias = trackAlias;
    this.state = "subscribing";
  }
  /**
   * Start receiving audio frames via the connection's datagram dispatcher
   */
  async start() {
    if (!this.connection) {
      throw new MoqClientError("Not attached to a connection", "NOT_CONNECTED");
    }
    if (this.isListening) {
      return;
    }
    this.isListening = true;
    this.state = "active";
    this.connection.registerDatagramHandler(this.trackAlias, (payload, _trackAlias, groupId, _objectId) => {
      if (!this.isListening) return;
      this.stats.framesReceived++;
      this.stats.bytesReceived += payload.length;
      this.stats.currentGroupId = groupId;
      this.stats.lastFrameTime = performance.now();
      if (this.frameHandler) {
        this.frameHandler(payload, groupId);
      }
    });
  }
  /**
   * Stop receiving audio frames
   */
  stop() {
    this.isListening = false;
    if (this.connection) {
      this.connection.unregisterDatagramHandler(this.trackAlias);
    }
    this.state = "idle";
  }
  /**
   * Detach from connection
   */
  detach() {
    this.stop();
    this.connection = null;
    this.state = "idle";
  }
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      framesReceived: 0,
      bytesReceived: 0,
      framesDropped: 0,
      currentGroupId: 0n,
      lastFrameTime: 0
    };
  }
}
function isAudioDecoderSupported() {
  return typeof AudioDecoder !== "undefined";
}
async function getAudioDecoderCapabilities() {
  if (!isAudioDecoderSupported()) {
    return { supported: false, opusSupported: false };
  }
  try {
    const support = await AudioDecoder.isConfigSupported({
      codec: "opus",
      sampleRate: 48e3,
      numberOfChannels: 2
    });
    return {
      supported: true,
      opusSupported: support.supported ?? false
    };
  } catch {
    return { supported: true, opusSupported: false };
  }
}
const PLAYOUT_TUNING = {
  safetyMs: 1,
  // S — floor pad above the underrun edge
  lowInitMs: 5,
  // warm-start L (server output is low-jitter MOQ datagrams)
  lowMinMs: 2,
  // baseline late cushion
  lowMaxMs: 30,
  // latency ceiling
  highMaxMultiple: 3,
  // H_max = 3·W
  windowReads: 750,
  // N — 2.0s at the 2.667ms worklet cadence (Go uses 400 = 2.0s at 5ms)
  widenThreshold: 5,
  // corrections/side/window to call it jitter
  widenStepMs: 2,
  // eager up
  narrowStepMicros: 500
  // 0.5ms — reluctant down (¼ of widen)
};
function computeJitterCapacity(cfg = {}) {
  const sr = cfg.sampleRate ?? 48e3;
  const nc = cfg.numChannels ?? 1;
  const f2 = (ms) => Math.floor(sr * ms / 1e3);
  const W = cfg.writerFrame ?? f2(20);
  const R = cfg.readerFrame ?? f2(5);
  const S = cfg.safety ?? f2(1);
  const lMax = cfg.lowMax ?? f2(30);
  const hMax = cfg.highMax ?? 3 * W;
  const maxWR = Math.max(W, R);
  const bandTopMax = R + S + lMax + 2 * W + hMax;
  return { capacity: 2 * bandTopMax + 2 * maxWR, nc };
}
class JitterBufferCore {
  // ---- immutable geometry (frames) ----
  capacity;
  floor;
  w;
  nc;
  sampleRate;
  lMin;
  lMax;
  hMin;
  hMax;
  // ---- immutable controller constants ----
  windowReads;
  widenThreshold;
  widenStep;
  narrowStep;
  // ---- storage: capacity * nc interleaved floats ----
  data;
  // ---- SPSC heads — cumulative (never wrap). Index via (pos % capacity) * nc. ----
  // writePos crosses the writer→reader thread boundary in SAB mode, so it is
  // backed by an atomic cell when `sharedWritePos` is given; otherwise a plain
  // number. The Atomics.store/load act as the release/acquire fence pairing the
  // ring writes (writer) with the ring reads (reader) — the Go SPSC contract.
  // readPos is reader-owned (the writer never touches it), so it stays plain.
  _writePos = 0;
  wpCell = null;
  get writePos() {
    return this.wpCell ? Number(Atomics.load(this.wpCell, 0)) : this._writePos;
  }
  set writePos(v) {
    if (this.wpCell) Atomics.store(this.wpCell, 0, BigInt(v));
    else this._writePos = v;
  }
  readPos = 0;
  // ---- live adaptive window ----
  currentL;
  currentH;
  // ---- tumbling-window controller state (reader-owned) ----
  insertCount = 0;
  dropCount = 0;
  readsThisWindow = 0;
  // ---- last completed window's counts, for observation ----
  lastWinInserts = 0;
  lastWinDrops = 0;
  // ---- cumulative stats ----
  underruns = 0;
  overruns = 0;
  laps = 0;
  samplesDropped = 0;
  samplesInserted = 0;
  constructor(cfg = {}) {
    const sr = cfg.sampleRate ?? 48e3;
    const nc = cfg.numChannels ?? 1;
    const f2 = (ms) => Math.floor(sr * ms / 1e3);
    const W = cfg.writerFrame ?? f2(20);
    const R = cfg.readerFrame ?? f2(5);
    const S = cfg.safety ?? f2(1);
    const lInit = cfg.lowInit ?? f2(5);
    const lMin = cfg.lowMin ?? f2(2);
    const lMax = cfg.lowMax ?? f2(30);
    const hInit = cfg.highInit ?? W;
    const hMin = cfg.highMin ?? W;
    const hMax = cfg.highMax ?? 3 * W;
    if (R <= 0 || W <= 0) {
      throw new Error("JitterBufferCore: readerFrame and writerFrame must be > 0");
    }
    if (S < 0) {
      throw new Error("JitterBufferCore: safety must be >= 0");
    }
    if (!(0 <= lMin && lMin <= lInit && lInit <= lMax)) {
      throw new Error("JitterBufferCore: require 0 <= lowMin <= lowInit <= lowMax");
    }
    if (!(0 <= hMin && hMin <= hInit && hInit <= hMax)) {
      throw new Error("JitterBufferCore: require 0 <= highMin <= highInit <= highMax");
    }
    const floor = R + S;
    const maxWR = Math.max(W, R);
    const bandTopMax = R + S + lMax + 2 * W + hMax;
    const capacity = 2 * bandTopMax + 2 * maxWR;
    this.capacity = capacity;
    this.floor = floor;
    this.w = W;
    this.nc = nc;
    this.sampleRate = sr;
    this.lMin = lMin;
    this.lMax = lMax;
    this.hMin = hMin;
    this.hMax = hMax;
    this.windowReads = cfg.windowReads ?? 750;
    this.widenThreshold = cfg.widenThreshold ?? 5;
    this.widenStep = cfg.widenStep ?? f2(2);
    this.narrowStep = cfg.narrowStep ?? Math.floor(sr * 500 / 1e6);
    if (cfg.sharedStorage) {
      if (cfg.sharedStorage.length !== capacity * nc) {
        throw new Error(
          `JitterBufferCore: sharedStorage length ${cfg.sharedStorage.length} != capacity*nc ${capacity * nc} (size it with computeJitterCapacity using the same config)`
        );
      }
      this.data = cfg.sharedStorage;
    } else {
      this.data = new Float32Array(capacity * nc);
    }
    if (cfg.sharedWritePos) {
      if (cfg.sharedWritePos.length < 1) {
        throw new Error("JitterBufferCore: sharedWritePos must be a length-1 BigInt64Array");
      }
      this.wpCell = cfg.sharedWritePos;
    }
    this.currentL = lInit;
    this.currentH = hInit;
  }
  /**
   * Derive the operating thresholds from the (loaded-once) window allowances
   * `l`, `h` plus the immutable floor and writer frame. Pure function; all
   * branches of {@link read} use one consistent snapshot.
   */
  levels(l, h2) {
    const t = this.floor + l;
    return { t, snapTarget: t + this.w, dropLine: t + this.w + h2, overrunAt: t + 2 * this.w + h2 };
  }
  /**
   * Copy `src` (interleaved, length a multiple of `nc`) into the ring. Never
   * blocks. Writes longer than capacity are clipped to the most-recent
   * `capacity` frames.
   */
  write(src) {
    let nFrames = Math.floor(src.length / this.nc);
    if (nFrames === 0) return;
    if (nFrames > this.capacity) {
      const skip = nFrames - this.capacity;
      src = src.subarray(skip * this.nc);
      nFrames = this.capacity;
    }
    const wp = this.writePos;
    this.writeToRing(src, wp, nFrames);
    this.writePos = wp + nFrames;
  }
  /**
   * Copy up to `dst.length` interleaved samples from the ring into `dst`.
   * Returns true when audio was produced, false on silence. See design §4. The
   * window allowances L and H are read exactly once at the top so every branch
   * sees consistent geometry. No debounce: corrections fire on the first
   * out-of-band read.
   */
  read(dst) {
    const nc = this.nc;
    const nFrames = Math.floor(dst.length / nc);
    if (nFrames === 0) return true;
    let wp = this.writePos;
    let rp = this.readPos;
    let fill = wp - rp;
    const { snapTarget, dropLine, overrunAt } = this.levels(this.currentL, this.currentH);
    if (rp === 0) {
      if (fill < snapTarget) {
        dst.fill(0);
        this.adapt();
        return false;
      }
      rp = wp - snapTarget;
      this.readPos = rp;
      fill = snapTarget;
    }
    if (fill >= this.capacity) {
      rp = wp - snapTarget;
      this.readPos = rp;
      fill = snapTarget;
      this.laps++;
    } else if (fill > overrunAt) {
      rp = wp - snapTarget;
      this.readPos = rp;
      fill = snapTarget;
      this.overruns++;
    }
    if (fill < nFrames) {
      dst.fill(0);
      this.underruns++;
      this.adapt();
      return false;
    }
    let corr = 0;
    if (fill > dropLine && fill >= nFrames + 1) {
      corr = 1;
    } else if (fill < this.floor && nFrames >= 2) {
      corr = -1;
    }
    if (corr === 1) {
      this.readFromRing(dst, rp, nFrames);
      const skipBase = (rp + nFrames) % this.capacity * nc;
      const dstBase = (nFrames - 1) * nc;
      for (let ch = 0; ch < nc; ch++) {
        const a = dst[dstBase + ch];
        const b2 = this.data[skipBase + ch];
        dst[dstBase + ch] = (a + b2) * 0.5;
      }
      this.readPos = rp + nFrames + 1;
      this.samplesDropped++;
      this.dropCount++;
    } else if (corr === -1) {
      const realFrames = nFrames - 1;
      this.readFromRing(dst.subarray(0, realFrames * nc), rp, realFrames);
      const peekBase = (rp + realFrames) % this.capacity * nc;
      const lastBase = (realFrames - 1) * nc;
      const tailBase = realFrames * nc;
      for (let ch = 0; ch < nc; ch++) {
        const a = dst[lastBase + ch];
        const b2 = this.data[peekBase + ch];
        dst[tailBase + ch] = (a + b2) * 0.5;
      }
      this.readPos = rp + realFrames;
      this.samplesInserted++;
      this.insertCount++;
    } else {
      this.readFromRing(dst, rp, nFrames);
      this.readPos = rp + nFrames;
    }
    this.adapt();
    return true;
  }
  /**
   * Tick the tumbling window once per Read and, every `windowReads`, run the
   * decision off the accumulated correction counts, then reset them. No
   * wall-clock: the window is a read count, the inputs are correction counts.
   */
  adapt() {
    if (this.windowReads <= 0) return;
    this.readsThisWindow++;
    if (this.readsThisWindow < this.windowReads) return;
    this.lastWinInserts = this.insertCount;
    this.lastWinDrops = this.dropCount;
    this.decide(this.insertCount, this.dropCount);
    this.insertCount = 0;
    this.dropCount = 0;
    this.readsThisWindow = 0;
  }
  /**
   * Move the window allowances from one window's correction counts (design §6):
   *   - both sides breached (min ≥ threshold) ⇒ jitter ⇒ widen the breaching
   *     side(s) by widenStep, capped at max (eager);
   *   - otherwise a fully-calm side (count 0) narrows by narrowStep, floored at
   *     min; a side that is lit but un-gated is drift — left to the ±1 corrector.
   * `narrowStep < widenStep` makes it eager-up / reluctant-down — the stability
   * guarantee.
   */
  decide(insertCount, dropCount) {
    if (Math.min(insertCount, dropCount) >= this.widenThreshold) {
      if (insertCount >= this.widenThreshold && this.currentL < this.lMax) {
        this.currentL = Math.min(this.currentL + this.widenStep, this.lMax);
      }
      if (dropCount >= this.widenThreshold && this.currentH < this.hMax) {
        this.currentH = Math.min(this.currentH + this.widenStep, this.hMax);
      }
      return;
    }
    if (insertCount === 0 && this.currentL > this.lMin) {
      this.currentL = Math.max(this.currentL - this.narrowStep, this.lMin);
    }
    if (dropCount === 0 && this.currentH > this.hMin) {
      this.currentH = Math.max(this.currentH - this.narrowStep, this.hMin);
    }
  }
  /** Current fill in frames. */
  fillFrames() {
    return this.writePos - this.readPos;
  }
  /** Fill in interleaved floats (matching the Go ICircularBuffer convention). */
  getBehind() {
    return this.fillFrames() * this.nc;
  }
  /** Rich snapshot for tuning/observability. */
  snapshot() {
    const fill = this.fillFrames();
    const l = this.currentL;
    const h2 = this.currentH;
    const srMs = this.sampleRate / 1e3;
    const { dropLine } = this.levels(l, h2);
    let zone = 0;
    if (fill < this.floor) zone = -1;
    else if (fill > dropLine) zone = 1;
    return {
      fillFrames: fill,
      fillMs: fill / srMs,
      floorFrames: this.floor,
      lowAllowanceFrames: l,
      lowAllowanceMs: l / srMs,
      highAllowanceFrames: h2,
      highAllowanceMs: h2 / srMs,
      targetFrames: this.floor + l,
      started: this.readPos > 0,
      underruns: this.underruns,
      overruns: this.overruns,
      laps: this.laps,
      samplesDropped: this.samplesDropped,
      samplesInserted: this.samplesInserted,
      lastWindowInserts: this.lastWinInserts,
      lastWindowDrops: this.lastWinDrops,
      zone
    };
  }
  /**
   * Copy `nFrames` frames from `src` into the ring at frame position `wp`,
   * handling wraparound. Caller guarantees `nFrames <= capacity`.
   */
  writeToRing(src, wp, nFrames) {
    const cap = this.capacity;
    const nc = this.nc;
    const startFrame = wp % cap;
    if (startFrame + nFrames <= cap) {
      this.data.set(src.subarray(0, nFrames * nc), startFrame * nc);
      return;
    }
    const first = cap - startFrame;
    this.data.set(src.subarray(0, first * nc), startFrame * nc);
    this.data.set(src.subarray(first * nc, nFrames * nc), 0);
  }
  /**
   * Copy `nFrames` frames from the ring at frame position `rp` into `dst`,
   * handling wraparound. Caller guarantees `nFrames <= capacity`.
   */
  readFromRing(dst, rp, nFrames) {
    const cap = this.capacity;
    const nc = this.nc;
    const startFrame = rp % cap;
    if (startFrame + nFrames <= cap) {
      dst.set(this.data.subarray(startFrame * nc, (startFrame + nFrames) * nc));
      return;
    }
    const first = cap - startFrame;
    dst.set(this.data.subarray(startFrame * nc, cap * nc), 0);
    dst.set(this.data.subarray(0, (nFrames - first) * nc), first * nc);
  }
}
const PLAYOUT_PROCESSOR_NAME = "playout-processor";
const PLAYOUT_PROCESSOR_SOURCE = `
class PlayoutRingProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.core = new JitterBufferCore(opts.config || {});
    this.nc = this.core.nc;
    this.statsEvery = opts.statsEvery || 94;
    this.readsSinceStats = 0;
    this.scratch = new Float32Array(128 * this.nc);
    this.pcmPort = null;
    // WRITER inputs arrive on this.port:
    //   • {type:'pcmPort', port} — a transferred MessagePort whose other end is
    //     held by the receive Worker (worker mode, design §11.3); PCM flows
    //     worker → worklet directly, never touching the main thread.
    //   • a Float32Array — decoded PCM posted directly from the main thread
    //     (fallback path when the receive Worker is unavailable, design §11.8).
    // this.port stays the OUTBOUND stats channel either way.
    const onPcm = (pcm) => { if (pcm && pcm.length) this.core.write(pcm); };
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.type === 'pcmPort' && d.port) {
        this.pcmPort = d.port;
        this.pcmPort.onmessage = (ev) => onPcm(ev.data);
        if (this.pcmPort.start) this.pcmPort.start();
        return;
      }
      onPcm(d);
    };
  }

  // READER: pull one render quantum from the ring, deinterleave to outputs.
  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0 || !out[0]) return true;
    const nFrames = out[0].length;
    const nc = this.nc;
    const need = nFrames * nc;
    if (this.scratch.length < need) this.scratch = new Float32Array(need);
    const block = this.scratch.subarray(0, need);
    // core.read zeroes the block on startup/underrun, so silence falls through.
    this.core.read(block);
    for (let ch = 0; ch < out.length; ch++) {
      const dst = out[ch];
      const srcCh = ch < nc ? ch : nc - 1;
      for (let i = 0; i < nFrames; i++) dst[i] = block[i * nc + srcCh];
    }
    if (++this.readsSinceStats >= this.statsEvery) {
      this.readsSinceStats = 0;
      this.port.postMessage({ type: 'stats', snapshot: this.core.snapshot() });
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(PLAYOUT_PROCESSOR_NAME)}, PlayoutRingProcessor);
`;
function buildPlayoutWorkletCode() {
  const coreSource = JitterBufferCore.toString();
  if (!coreSource.startsWith("class")) {
    throw new Error("playout-worklet: JitterBufferCore.toString() is not a class declaration");
  }
  const helper = /\b__(publicField|privateField|decorateClass|decorateParam|name|esDecorate)\b/.exec(coreSource);
  if (helper) {
    throw new Error(
      `playout-worklet: serialized JitterBufferCore references the bundler helper "${helper[0]}" — it would be undefined in the worklet. Ensure the build target keeps native class fields (es2022+).`
    );
  }
  return `const JitterBufferCore = ${coreSource};
${PLAYOUT_PROCESSOR_SOURCE}`;
}
function createPlayoutWorkletUrl() {
  const blob = new Blob([buildPlayoutWorkletCode()], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}
const RENDER_QUANTUM = 128;
const DEFAULT_WRITER_FRAME = 240;
var AudioPlayerState = /* @__PURE__ */ ((AudioPlayerState2) => {
  AudioPlayerState2["IDLE"] = "idle";
  AudioPlayerState2["INITIALIZING"] = "initializing";
  AudioPlayerState2["READY"] = "ready";
  AudioPlayerState2["PLAYING"] = "playing";
  AudioPlayerState2["ERROR"] = "error";
  return AudioPlayerState2;
})(AudioPlayerState || {});
class AudioPlayer {
  config;
  state = "idle";
  // Web Audio API
  audioContext = null;
  gainNode = null;
  workletNode = null;
  // WebCodecs decoder
  decoder = null;
  // Latest stats snapshot pushed from the worklet.
  lastSnapshot = null;
  // Main-thread decode counters (the worklet owns playout/buffer stats).
  decodeStats = { framesDecoded: 0, samplesPlayed: 0, decodeErrors: 0 };
  // Throttle counter for the [JBUF] observation log.
  jbufLogCount = 0;
  // Worker mode: when the receive Worker decodes (design §11), AudioPlayer's own
  // main-thread AudioDecoder is bypassed (decodeFrame becomes a no-op) and PCM
  // reaches the worklet ring via the SAB (or the pcmPort fallback).
  workerDecodeMode = false;
  // SAB ring (design §11.3, set in initialize() when the page is cross-origin
  // isolated). The worklet reads this shared ring; the writer (worker, or the
  // main-thread decoder in fallback) writes it. Null ⇒ postMessage path.
  sharedStorage = null;
  sharedWritePos = null;
  jbConfigBase = null;
  constructor(config = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48e3,
      channelCount: config.channelCount ?? 2,
      bufferSize: config.bufferSize ?? 0.03,
      maxBufferSize: config.maxBufferSize ?? 0.15,
      latencyHint: config.latencyHint ?? "interactive",
      debug: config.debug ?? false,
      writerFrameSamples: config.writerFrameSamples ?? DEFAULT_WRITER_FRAME,
      jitterConfig: config.jitterConfig ?? {}
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...args) {
    if (this.config.debug) {
      console.log("[AudioPlayer]", ...args);
    }
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Get statistics
   */
  getStats() {
    const snap = this.lastSnapshot;
    return {
      framesDecoded: this.decodeStats.framesDecoded,
      samplesPlayed: this.decodeStats.samplesPlayed,
      underruns: snap ? snap.underruns : 0,
      bufferLevel: snap ? snap.fillMs / 1e3 : 0,
      decodeErrors: this.decodeStats.decodeErrors
    };
  }
  /**
   * Get the rich v3 jitter-buffer snapshot (live L/H, fill, corrections, …) for
   * tuning/observability, or null if no snapshot has arrived yet.
   */
  getJitterStats() {
    return this.lastSnapshot ? { ...this.lastSnapshot } : null;
  }
  /** The decoder config the receive Worker should use (mirrors this player's config). */
  getDecoderConfig() {
    return { codec: "opus", sampleRate: this.config.sampleRate, numberOfChannels: this.config.channelCount };
  }
  /**
   * Prepare to hand decode off to the receive Worker (design §11.3) and flip this
   * player into worker-decode mode (its own `decodeFrame` becomes a no-op).
   * Returns how the worker should deliver PCM:
   *  - **`sab`**: the worklet already reads a SharedArrayBuffer ring (cross-origin
   *    isolated); the worker constructs a writer view of the same ring and writes
   *    directly — real-time-safe, no `postMessage`.
   *  - **`port`**: fallback — a MessageChannel whose worklet end is handed to the
   *    worklet here; the worker posts PCM frames over it.
   * Must be called after {@link initialize}. Returns null if the worklet isn't ready.
   */
  prepareForWorker() {
    if (!this.workletNode) return null;
    this.workerDecodeMode = true;
    if (this.sharedStorage && this.sharedWritePos && this.jbConfigBase) {
      this.log("worker-decode mode: SAB ring (no postMessage for PCM)");
      return {
        mode: "sab",
        jbufConfig: this.jbConfigBase,
        sharedStorage: this.sharedStorage,
        sharedWritePos: this.sharedWritePos
      };
    }
    const channel = new MessageChannel();
    this.workletNode.port.postMessage({ type: "pcmPort", port: channel.port2 }, [channel.port2]);
    this.log("worker-decode mode: pcmPort fallback (page is not cross-origin isolated)");
    return { mode: "port", pcmPort: channel.port1 };
  }
  /**
   * Initialize the audio player
   *
   * This creates the AudioContext, loads the playout worklet, and creates the
   * AudioDecoder. Must be called in response to a user gesture on some browsers.
   */
  async initialize() {
    if (this.state !== "idle") {
      throw new MoqClientError(
        `Cannot initialize: already in state ${this.state}`,
        "INVALID_STATE"
      );
    }
    this.state = "initializing";
    try {
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latencyHint
      });
      if (typeof AudioDecoder === "undefined") {
        throw new AudioDecoderNotSupportedError(
          "WebCodecs AudioDecoder is not supported in this browser"
        );
      }
      const support = await AudioDecoder.isConfigSupported({
        codec: "opus",
        sampleRate: this.config.sampleRate,
        numberOfChannels: this.config.channelCount
      });
      if (!support.supported) {
        throw new AudioDecoderNotSupportedError(
          "Opus decoding is not supported in this browser"
        );
      }
      const url = createPlayoutWorkletUrl();
      try {
        await this.audioContext.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const jbConfig = {
        sampleRate: this.audioContext.sampleRate,
        numChannels: this.config.channelCount,
        readerFrame: RENDER_QUANTUM,
        writerFrame: this.config.writerFrameSamples,
        ...this.config.jitterConfig
      };
      this.jbConfigBase = jbConfig;
      let workletConfig = jbConfig;
      if (typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated === true) {
        const { capacity, nc } = computeJitterCapacity(jbConfig);
        this.sharedStorage = new Float32Array(new SharedArrayBuffer(capacity * nc * 4));
        this.sharedWritePos = new BigInt64Array(new SharedArrayBuffer(8));
        workletConfig = { ...jbConfig, sharedStorage: this.sharedStorage, sharedWritePos: this.sharedWritePos };
        this.log(`SAB ring active (capacity=${capacity} frames, nc=${nc})`);
      } else {
        this.log("SAB unavailable (not cross-origin isolated) — PCM via postMessage");
      }
      this.workletNode = new AudioWorkletNode(this.audioContext, PLAYOUT_PROCESSOR_NAME, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [this.config.channelCount],
        processorOptions: { config: workletConfig }
      });
      this.workletNode.port.onmessage = (e) => {
        const msg = e.data;
        if (msg && msg.type === "stats") {
          this.lastSnapshot = msg.snapshot;
          this.logJitter(msg.snapshot);
        }
      };
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.workletNode.connect(this.gainNode);
      this.decoder = new AudioDecoder({
        output: (audioData) => this.handleDecodedAudio(audioData),
        error: (error) => this.handleDecodeError(error)
      });
      this.decoder.configure({
        codec: "opus",
        sampleRate: this.config.sampleRate,
        numberOfChannels: this.config.channelCount,
        // Real-time hint: don't batch input chunks before emitting output.
        // (Not yet in lib.dom AudioDecoderConfig; honored at runtime, ignored if unknown.)
        optimizeForLatency: true
      });
      this.state = "ready";
      this.log("initialized (v3 worklet playout)");
    } catch (error) {
      this.state = "error";
      throw error;
    }
  }
  /**
   * Start playback
   */
  start() {
    if (this.state !== "ready" && this.state !== "playing") {
      throw new MoqClientError(
        `Cannot start: must be in READY state, currently ${this.state}`,
        "INVALID_STATE"
      );
    }
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }
    this.state = "playing";
    this.log("started");
  }
  /**
   * Stop playback. The worklet keeps running (and drains to silence); no new
   * frames are written until PLAYING resumes.
   */
  stop() {
    this.state = "ready";
    this.log("stopped");
  }
  /**
   * Pause playback
   */
  pause() {
    if (this.audioContext?.state === "running") {
      this.audioContext.suspend();
    }
  }
  /**
   * Resume playback
   */
  resume() {
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }
  }
  /**
   * Set playback volume.
   * @param volume - Volume level from 0.0 (silent) to 1.0 (full volume).
   */
  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  /**
   * Get current playback volume.
   */
  getVolume() {
    return this.gainNode?.gain.value ?? 1;
  }
  /**
   * Decode an Opus frame
   *
   * @param opusData - Opus-encoded audio data
   * @param timestamp - Frame timestamp in microseconds (optional)
   */
  decodeFrame(opusData, timestamp) {
    if (this.workerDecodeMode) return;
    if (!this.decoder) {
      throw new MoqClientError("Decoder not initialized", "NOT_INITIALIZED");
    }
    if (this.decoder.state === "closed") {
      throw new MoqClientError("Decoder is closed", "DECODER_CLOSED");
    }
    const chunk = new EncodedAudioChunk({
      type: "key",
      // Opus frames are always key frames
      timestamp: timestamp ?? performance.now() * 1e3,
      data: opusData
    });
    this.decoder.decode(chunk);
  }
  /**
   * Release all resources
   */
  async dispose() {
    this.stop();
    if (this.decoder) {
      if (this.decoder.state !== "closed") {
        this.decoder.close();
      }
      this.decoder = null;
    }
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      try {
        this.workletNode.disconnect();
      } catch {
      }
      this.workletNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.lastSnapshot = null;
    this.state = "idle";
    this.log("disposed");
  }
  /**
   * Handle decoded audio data: copy interleaved PCM and transfer it to the
   * worklet ring (zero-copy). The worklet does all buffering and playout.
   */
  handleDecodedAudio(audioData) {
    try {
      if (this.state !== "playing" || !this.workletNode) {
        return;
      }
      const frames = audioData.numberOfFrames;
      const channels = audioData.numberOfChannels;
      const pcm = new Float32Array(frames * channels);
      audioData.copyTo(pcm, { planeIndex: 0, format: "f32" });
      this.workletNode.port.postMessage(pcm, [pcm.buffer]);
      this.decodeStats.framesDecoded++;
      this.decodeStats.samplesPlayed += frames;
    } finally {
      audioData.close();
    }
  }
  /**
   * One-line [JBUF] observation log — the browser analog of the Go server's
   * [JBUF] tuning line (design §10 / plan Phase 4). Gated by `debug`; throttled
   * to ~1/s (the worklet posts stats ~4/s). Filter devtools by "JBUF" during soak.
   */
  logJitter(s) {
    if (!this.config.debug) return;
    if (this.jbufLogCount++ % 4 !== 0) return;
    console.log(
      `[JBUF] fill=${s.fillMs.toFixed(1)}ms L=${s.lowAllowanceMs.toFixed(1)} H=${s.highAllowanceMs.toFixed(1)} tgt=${s.targetFrames}fr zone=${s.zone} win=${s.lastWindowInserts}/${s.lastWindowDrops} und=${s.underruns} ovr=${s.overruns} lap=${s.laps} ins=${s.samplesInserted} drop=${s.samplesDropped}`
    );
  }
  /**
   * Handle decode error
   */
  handleDecodeError(error) {
    console.error("Audio decode error:", error);
    this.decodeStats.decodeErrors++;
  }
}
class AudioDecoderNotSupportedError extends MoqClientError {
  constructor(message) {
    super(message, "AUDIO_DECODER_NOT_SUPPORTED");
    this.name = "AudioDecoderNotSupportedError";
  }
}
function isAudioPlaybackSupported() {
  return typeof AudioContext !== "undefined" && typeof AudioDecoder !== "undefined";
}
async function getAudioPlaybackCapabilities() {
  const hasAudioContext = typeof AudioContext !== "undefined";
  const hasWebCodecs = typeof AudioDecoder !== "undefined";
  let opusDecoding = false;
  if (hasWebCodecs) {
    try {
      const support = await AudioDecoder.isConfigSupported({
        codec: "opus",
        sampleRate: 48e3,
        numberOfChannels: 2
      });
      opusDecoding = support.supported ?? false;
    } catch {
      opusDecoding = false;
    }
  }
  return {
    audioContext: hasAudioContext,
    webCodecs: hasWebCodecs,
    opusDecoding
  };
}
function audioReceiveWorkerSupported() {
  return typeof Worker !== "undefined" && typeof MessageChannel !== "undefined" && typeof WebTransport !== "undefined" && typeof AudioDecoder !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
}
function routeDatagram(trackAlias, audioTrackAlias) {
  return audioTrackAlias !== void 0 && trackAlias === audioTrackAlias ? "decode" : "forward";
}
const RECEIVE_WORKER_SOURCE = `
'use strict';
let reader = null;
let pcmPort = null;     // non-isolated fallback PCM sink
let jbuf = null;        // SAB writer-view JitterBufferCore (preferred PCM sink)
let decoder = null;
let audioTrackAlias = undefined;
let running = false;

function post(msg, transfer) { self.postMessage(msg, transfer || []); }

function configureDecoder(cfg) {
  if (decoder) { try { decoder.close(); } catch (e) {} decoder = null; }
  decoder = new AudioDecoder({
    output: (audioData) => {
      try {
        const frames = audioData.numberOfFrames;
        const channels = audioData.numberOfChannels;
        const pcm = new Float32Array(frames * channels);
        // Interleaved single-plane copy — matches the worklet ring's interleaved layout.
        audioData.copyTo(pcm, { planeIndex: 0, format: 'f32' });
        // SAB mode: write straight into the shared ring (real-time-safe, no
        // postMessage). Fallback: post to the worklet's port.
        if (jbuf) jbuf.write(pcm);
        else if (pcmPort) pcmPort.postMessage(pcm, [pcm.buffer]);
      } catch (e) {
        post({ type: 'notice', event: 'decode-error', detail: String(e) });
      } finally {
        audioData.close();
      }
    },
    error: (e) => post({ type: 'notice', event: 'decode-error', detail: String(e) }),
  });
  // optimizeForLatency: minimise how many input chunks the decoder buffers before
  // emitting output (WebCodecs real-time hint) — without it some decoders batch
  // several frames, adding burstiness on top of the transport.
  decoder.configure({ codec: cfg.codec, sampleRate: cfg.sampleRate, numberOfChannels: cfg.numberOfChannels, optimizeForLatency: true });
}

async function readLoop() {
  if (!reader || running) return;
  running = true;
  try {
    while (running) {
      const { value, done } = await reader.read();
      if (done) { post({ type: 'notice', event: 'reader-done' }); break; }
      if (!value) continue;
      let parsed;
      try { parsed = parseObjectDatagram(value); } catch (e) { continue; } // malformed — skip
      const isAudio = audioTrackAlias !== undefined && parsed.trackAlias === audioTrackAlias && decoder;
      if (isAudio) {
        try {
          const chunk = new EncodedAudioChunk({
            type: 'key', // Opus frames are always key frames
            timestamp: Number(parsed.groupId) * 1000,
            data: parsed.payload,
          });
          decoder.decode(chunk);
        } catch (e) {
          post({ type: 'notice', event: 'decode-error', detail: String(e) });
        }
      } else {
        // Forward non-audio to the main thread. Copy the payload (it is a
        // subarray of the read chunk) into its own buffer so it can be transferred.
        const copy = parsed.payload.slice();
        post({
          type: 'datagram',
          trackAlias: parsed.trackAlias,
          groupId: parsed.groupId,
          objectId: parsed.objectId,
          publisherPriority: parsed.publisherPriority,
          payload: copy,
        }, [copy.buffer]);
      }
    }
  } catch (e) {
    if (running) post({ type: 'notice', event: 'reader-error', detail: String(e) });
  } finally {
    running = false;
  }
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'init') {
    if (msg.pcmPort) pcmPort = msg.pcmPort;
    if (msg.readable) { reader = msg.readable.getReader(); readLoop(); }
  } else if (msg.type === 'audio') {
    if (msg.pcmPort) pcmPort = msg.pcmPort;
    if (msg.sharedStorage && msg.sharedWritePos && msg.jbufConfig) {
      // SAB mode: writer-view core over the shared ring (same config the worklet
      // reader uses, plus the shared arrays).
      const c = Object.assign({}, msg.jbufConfig, {
        sharedStorage: msg.sharedStorage,
        sharedWritePos: msg.sharedWritePos,
      });
      jbuf = new JitterBufferCore(c);
    }
    configureDecoder(msg.decoderConfig);
    audioTrackAlias = msg.audioTrackAlias;
  } else if (msg.type === 'stop') {
    running = false;
    if (decoder) { try { decoder.close(); } catch (e2) {} decoder = null; }
    if (reader) { try { reader.cancel(); } catch (e2) {} reader = null; }
  }
};
`;
function buildReceiveWorkerCode() {
  const coreSrc = JitterBufferCore.toString();
  const varintSrc = decodeVarint.toString();
  const parseSrc = parseObjectDatagram.toString();
  if (!coreSrc.startsWith("class")) {
    throw new Error("audio-receive-worker: JitterBufferCore.toString() is not a class declaration");
  }
  for (const [name, src] of [
    ["decodeVarint", varintSrc],
    ["parseObjectDatagram", parseSrc]
  ]) {
    if (!src.startsWith("function")) {
      throw new Error(`audio-receive-worker: ${name}.toString() is not a function declaration`);
    }
  }
  const helper = /\b__(publicField|privateField|decorateClass|decorateParam|name|esDecorate)\b/.exec(
    coreSrc + varintSrc + parseSrc
  );
  if (helper) {
    throw new Error(
      `audio-receive-worker: serialized source references bundler helper "${helper[0]}" — it would be undefined in the worker. Keep native output (es2022+).`
    );
  }
  return `const JitterBufferCore = ${coreSrc};
${varintSrc}
${parseSrc}
${RECEIVE_WORKER_SOURCE}`;
}
function createReceiveWorkerUrl() {
  const blob = new Blob([buildReceiveWorkerCode()], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}
class StateSubscriber {
  connection = null;
  trackAlias = 0;
  isListening = false;
  entities = /* @__PURE__ */ new Map();
  stateHandler = null;
  // Statistics
  updatesReceived = 0;
  errorsDropped = 0;
  /**
   * Set handler for entity state updates
   */
  onState(handler) {
    this.stateHandler = handler;
  }
  /**
   * Attach to a connection and track alias
   */
  attach(connection, trackAlias) {
    this.connection = connection;
    this.trackAlias = trackAlias;
  }
  /**
   * Start receiving state updates via the datagram dispatcher
   */
  start() {
    if (!this.connection || this.isListening) return;
    this.isListening = true;
    this.connection.registerDatagramHandler(this.trackAlias, (payload) => {
      if (!this.isListening) return;
      if (payload.length !== ENTITY_INFO3_SIZE) {
        this.errorsDropped++;
        return;
      }
      try {
        const info = entityInfo3FromBytes(payload);
        const state = {
          uuid: info.uuid,
          position: { ...info.position },
          rotation: { ...info.rotation },
          volume: info.volume,
          gone: info.gone
        };
        this.updatesReceived++;
        if (info.gone) {
          this.entities.delete(info.uuid);
        } else {
          this.entities.set(info.uuid, state);
        }
        if (this.stateHandler) {
          this.stateHandler(state);
        }
      } catch {
        this.errorsDropped++;
      }
    });
  }
  /**
   * Stop receiving state updates
   */
  stop() {
    this.isListening = false;
    if (this.connection) {
      this.connection.unregisterDatagramHandler(this.trackAlias);
    }
  }
  /**
   * Get all known entities (not gone)
   */
  getEntities() {
    return new Map(this.entities);
  }
  /**
   * Get a specific entity by UUID
   */
  getEntity(uuid) {
    return this.entities.get(uuid);
  }
  /**
   * Get statistics
   */
  getStats() {
    return {
      updatesReceived: this.updatesReceived,
      errorsDropped: this.errorsDropped,
      entityCount: this.entities.size
    };
  }
}
class ControlTrackPublisher extends TrackPublisher {
  constructor(config) {
    super(config);
    this.setGroupDuration(5e3);
  }
  /**
   * Publish a control message
   */
  async publishControlMessage(msg) {
    const json = JSON.stringify(msg);
    const data = new TextEncoder().encode(json);
    await this.publish(data);
  }
}
class CacheTopicSubscriber {
  connection = null;
  trackAlias = 0;
  isListening = false;
  valuesHandler = null;
  removedHandler = null;
  merger;
  constructor(cache) {
    this.merger = new TopicMerger(cache);
  }
  /** Underlying CacheMap. Exposed so callers (PanaudiaMoqClient) can pass
   *  a shared instance to preserve resume state across subscriber lifetimes. */
  get cache() {
    return this.merger.cache;
  }
  /** Install a per-envelope diagnostic callback that fires after every
   *  applyEnvelope. Used by the test page to distinguish "envelope
   *  arrived but every op was stale" from "no envelope arrived". */
  setDebugHandler(handler) {
    this.merger.setDebugHandler(handler);
  }
  /**
   * Set handler called once per envelope with all accepted values.
   * Each value is `{key, value}` where value is the JSON-serialised value
   * from the operation. Single-op messages are delivered as a one-element
   * array so the atomicity of batches is preserved at the API.
   */
  onValues(handler) {
    this.valuesHandler = handler;
  }
  /**
   * Set handler called once per envelope with all tombstoned keys.
   * Single-op messages are delivered as a one-element array.
   */
  onRemoved(handler) {
    this.removedHandler = handler;
  }
  /**
   * Attach to a connection and track alias.
   */
  attach(connection, trackAlias) {
    this.connection = connection;
    this.trackAlias = trackAlias;
  }
  /**
   * Start receiving updates via the datagram dispatcher.
   */
  start() {
    if (!this.connection || this.isListening) return;
    this.isListening = true;
    this.connection.registerDatagramHandler(this.trackAlias, (payload) => {
      if (!this.isListening) return;
      const result = this.merger.applyEnvelope(payload);
      if (!result) return;
      if (result.accepted.length > 0) {
        this.valuesHandler?.(result.accepted);
      }
      if (result.tombstoned.length > 0) {
        this.removedHandler?.(result.tombstoned);
      }
    });
  }
  /**
   * Stop receiving updates.
   */
  stop() {
    this.isListening = false;
    if (this.connection) {
      this.connection.unregisterDatagramHandler(this.trackAlias);
    }
  }
  /**
   * Get a single cache entry by key.
   */
  get(key) {
    return this.merger.get(key);
  }
  /**
   * Get all cache entries as a read-only map.
   */
  getAll() {
    return this.merger.getAll();
  }
  /**
   * Get the highest opId seen, for use as resume point on reconnection.
   */
  getResumeOpId() {
    return this.merger.getResumeOpId();
  }
  /**
   * Get statistics.
   */
  getStats() {
    return this.merger.getStats();
  }
}
class AttributesSubscriber extends CacheTopicSubscriber {
}
class EntitySubscriber extends CacheTopicSubscriber {
}
class SpaceSubscriber extends CacheTopicSubscriber {
}
class EventEmitter {
  handlers = /* @__PURE__ */ new Map();
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, /* @__PURE__ */ new Set());
    }
    this.handlers.get(event).add(handler);
  }
  off(event, handler) {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }
  emit(event, data) {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }
}
class PanaudiaMoqClient {
  config;
  events = new EventEmitter();
  connection = null;
  session = null;
  state = ConnectionState.DISCONNECTED;
  // Audio publishing
  audioPublisher = null;
  audioTrackPublisher = null;
  // State publishing
  stateTrackPublisher = null;
  statePublishPending = false;
  statePublishThrottleMs = 50;
  // Throttle state updates to 20Hz max
  lastStatePublishTime = 0;
  // Audio playback
  audioSubscriber = null;
  audioPlayer = null;
  // Receive Worker: owns the datagram read loop + Opus decode off the main
  // thread (design §11). Null when unsupported/failed ⇒ main-thread fallback.
  receiveWorker = null;
  // State tracking
  stateSubscriber = null;
  // Control publishing
  controlTrackPublisher = null;
  controlTrackAlias = 3;
  // Attributes tracking
  attributesSubscriber = null;
  attributesOutputTrackAlias = 0;
  attributesCache = new CacheMap();
  // Entity tracking (per-client filtered: only this client's own uuid keys)
  entitySubscriber = null;
  entityOutputTrackAlias = 0;
  entityCache = new CacheMap();
  // Space tracking (gated server-side by commands.ReadCapSpaceRead).
  // The server only announces the space output track to holders with
  // the cap; if the announce never arrives we leave the subscriber
  // null and never subscribe. Cache is persistent across subscriber
  // lifetimes to support resume HLC on reconnect.
  spaceSubscriber = null;
  spaceOutputTrackAlias = 0;
  spaceCache = new CacheMap();
  // Track aliases (assigned after announcement/subscription)
  audioInputTrackAlias = 1;
  stateTrackAlias = 2;
  audioOutputTrackAlias = 0;
  // Assigned by server
  stateOutputTrackAlias = 0;
  // Assigned by server
  // Node state
  position;
  rotation;
  constructor(config) {
    if (!config.serverUrl) {
      throw new Error("serverUrl is required");
    }
    if (!config.ticket && !config.entityId) {
      throw new Error("either ticket or entityId is required");
    }
    const entityId = config.entityId ?? this.extractEntityIdFromJwt(config.ticket);
    this.config = {
      serverUrl: config.serverUrl,
      // Empty string means "tokenless" — SUBSCRIBE/ANNOUNCE path treats an
      // empty auth token as absent and skips the Authorization KVP.
      ticket: config.ticket ?? "",
      entityId,
      initialPosition: config.initialPosition ?? { x: 0.5, y: 0.5, z: 0.5 },
      initialRotation: config.initialRotation ?? { yaw: 0, pitch: 0, roll: 0 },
      debug: config.debug ?? false
    };
    this.position = { ...this.config.initialPosition };
    this.rotation = { ...this.config.initialRotation };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...args) {
    if (this.config.debug) {
      console.log("[MOQ]", ...args);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logWarn(...args) {
    if (this.config.debug) {
      console.warn("[MOQ]", ...args);
    }
  }
  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }
  /**
   * Get the node ID
   */
  getEntityId() {
    return this.config.entityId;
  }
  /**
   * Register an event handler
   */
  on(event, handler) {
    this.events.on(event, handler);
  }
  /**
   * Remove an event handler
   */
  off(event, handler) {
    this.events.off(event, handler);
  }
  /**
   * Connect to the MOQ server
   */
  async connect(options) {
    if (!isWebTransportSupported()) {
      throw new WebTransportNotSupportedError();
    }
    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new InvalidStateError("disconnected", this.state);
    }
    this.setState(ConnectionState.CONNECTING);
    try {
      this.connection = new MoqConnection(this.config.serverUrl);
      this.connection.setHandlers({
        onStateChange: (connState, error) => {
          if (connState === ConnectionState.ERROR) {
            this.handleError("connection_error", error?.message ?? "Connection failed");
          } else if (connState === ConnectionState.DISCONNECTED) {
            this.handleDisconnect();
          }
        }
      });
      await this.connection.connect(options);
      this.setState(ConnectionState.CONNECTED);
      this.log("WebTransport connected, initializing MOQ session...");
      this.setupReceiveWorker();
      this.session = new MoqSession(this.connection, this.config.debug);
      this.session.onIncomingSubscribe((namespace, trackAlias) => {
        const nsPath = namespace.join("/");
        this.log(`Server subscribed to ${nsPath} with trackAlias=${trackAlias}`);
        if (nsPath.includes("in/audio")) {
          this.audioInputTrackAlias = trackAlias;
          this.log(`Updated audioInputTrackAlias to ${trackAlias}`);
          if (this.audioTrackPublisher) {
            this.audioTrackPublisher.detach();
            this.audioTrackPublisher = new AudioTrackPublisher({
              trackAlias,
              publisherPriority: 0
            });
            this.audioTrackPublisher.attach(this.connection);
            this.audioTrackPublisher.startSession();
            this.log(`Recreated audioTrackPublisher with trackAlias=${trackAlias}`);
          }
        }
        if (nsPath.includes("state/") && !nsPath.includes("out/state")) {
          this.stateTrackAlias = trackAlias;
          this.log(`Updated stateTrackAlias to ${this.stateTrackAlias}`);
          if (this.stateTrackPublisher) {
            this.stateTrackPublisher.detach();
          }
          this.stateTrackPublisher = new StateTrackPublisher({
            trackAlias: this.stateTrackAlias,
            publisherPriority: 1
          });
          this.stateTrackPublisher.attach(this.connection);
          this.log(`Recreated stateTrackPublisher with trackAlias=${this.stateTrackAlias}`);
        }
        if (nsPath.includes("in/control")) {
          this.controlTrackAlias = trackAlias;
          this.log(`Updated controlTrackAlias to ${this.controlTrackAlias}`);
          if (this.controlTrackPublisher) {
            this.controlTrackPublisher.detach();
          }
          this.controlTrackPublisher = new ControlTrackPublisher({
            trackAlias: this.controlTrackAlias,
            publisherPriority: 2
          });
          this.controlTrackPublisher.attach(this.connection);
          this.log(`Created controlTrackPublisher with trackAlias=${this.controlTrackAlias}`);
        }
      });
      await this.session.initialize(MoqRole.PUBSUB);
      this.log("Session initialized, subscribing to output track...");
      const outputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_OUTPUT, this.config.entityId);
      this.log("Subscribing to:", outputNamespace.join("/"));
      const subscribeId = await this.session.subscribe(outputNamespace, "", this.config.ticket);
      this.log("Subscribe successful, id:", subscribeId);
      this.audioOutputTrackAlias = this.session.getTrackAlias(subscribeId) ?? 0;
      const stateOutputNamespace = generateTrackNamespace(PanaudiaTrackType.STATE_OUTPUT, this.config.entityId);
      this.log("Subscribing to state output:", stateOutputNamespace.join("/"));
      const stateSubscribeId = await this.session.subscribe(stateOutputNamespace, "");
      this.stateOutputTrackAlias = this.session.getTrackAlias(stateSubscribeId) ?? 0;
      this.log("State output subscribed, trackAlias:", this.stateOutputTrackAlias);
      this.stateSubscriber = new StateSubscriber();
      this.stateSubscriber.attach(this.connection, this.stateOutputTrackAlias);
      this.stateSubscriber.onState((state) => {
        this.events.emit("entityState", state);
      });
      this.stateSubscriber.start();
      const attributesOutputNamespace = generateTrackNamespace(PanaudiaTrackType.ATTRIBUTES_OUTPUT, this.config.entityId);
      const resumeOpId = this.attributesCache.getHighestOpId();
      this.log(
        "Subscribing to attributes output:",
        attributesOutputNamespace.join("/"),
        resumeOpId > 0n ? `resumeOpId: ${resumeOpId}` : ""
      );
      const attrsSubscribeId = await this.session.subscribe(
        attributesOutputNamespace,
        "",
        void 0,
        resumeOpId > 0n ? resumeOpId : void 0
      );
      this.attributesOutputTrackAlias = this.session.getTrackAlias(attrsSubscribeId) ?? 0;
      this.log("Attributes output subscribed, trackAlias:", this.attributesOutputTrackAlias);
      this.attributesSubscriber = new AttributesSubscriber(this.attributesCache);
      this.attributesSubscriber.attach(this.connection, this.attributesOutputTrackAlias);
      this.attributesSubscriber.onValues((values) => {
        this.events.emit("attributes", values);
      });
      this.attributesSubscriber.onRemoved((keys) => {
        this.events.emit("attributesRemoved", keys);
      });
      this.attributesSubscriber.setDebugHandler((info) => {
        this.events.emit("cacheDebug", info);
      });
      this.attributesSubscriber.start();
      const entityOutputNamespace = generateTrackNamespace(PanaudiaTrackType.ENTITY_OUTPUT, this.config.entityId);
      const entityResumeOpId = this.entityCache.getHighestOpId();
      this.log(
        "Subscribing to entity output:",
        entityOutputNamespace.join("/"),
        entityResumeOpId > 0n ? `resumeOpId: ${entityResumeOpId}` : ""
      );
      const entitySubscribeId = await this.session.subscribe(
        entityOutputNamespace,
        "",
        void 0,
        entityResumeOpId > 0n ? entityResumeOpId : void 0
      );
      this.entityOutputTrackAlias = this.session.getTrackAlias(entitySubscribeId) ?? 0;
      this.log("Entity output subscribed, trackAlias:", this.entityOutputTrackAlias);
      this.entitySubscriber = new EntitySubscriber(this.entityCache);
      this.entitySubscriber.attach(this.connection, this.entityOutputTrackAlias);
      this.entitySubscriber.onValues((values) => {
        this.events.emit("entity", values);
      });
      this.entitySubscriber.onRemoved((keys) => {
        this.events.emit("entityRemoved", keys);
      });
      this.entitySubscriber.setDebugHandler((info) => {
        this.events.emit("cacheDebug", info);
      });
      this.entitySubscriber.start();
      try {
        const spaceOutputNamespace = generateTrackNamespace(PanaudiaTrackType.SPACE_OUTPUT, this.config.entityId);
        const spaceResumeOpId = this.spaceCache.getHighestOpId();
        this.log(
          "Subscribing to space output:",
          spaceOutputNamespace.join("/"),
          spaceResumeOpId > 0n ? `resumeOpId: ${spaceResumeOpId}` : ""
        );
        const spaceSubscribeId = await this.session.subscribe(
          spaceOutputNamespace,
          "",
          void 0,
          spaceResumeOpId > 0n ? spaceResumeOpId : void 0
        );
        this.spaceOutputTrackAlias = this.session.getTrackAlias(spaceSubscribeId) ?? 0;
        this.log("Space output subscribed, trackAlias:", this.spaceOutputTrackAlias);
        this.spaceSubscriber = new SpaceSubscriber(this.spaceCache);
        this.spaceSubscriber.attach(this.connection, this.spaceOutputTrackAlias);
        this.spaceSubscriber.onValues((values) => {
          this.events.emit("space", values);
        });
        this.spaceSubscriber.onRemoved((keys) => {
          this.events.emit("spaceRemoved", keys);
        });
        this.spaceSubscriber.setDebugHandler((info) => {
          this.events.emit("cacheDebug", info);
        });
        this.spaceSubscriber.start();
      } catch (err) {
        this.log("Space output subscribe failed (likely no space.read cap):", err);
      }
      this.setState(ConnectionState.AUTHENTICATED);
      this.events.emit("authenticated");
      const audioInputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_INPUT, this.config.entityId);
      const stateNamespace = generateTrackNamespace(PanaudiaTrackType.STATE, this.config.entityId);
      const controlNamespace = generateTrackNamespace(PanaudiaTrackType.CONTROL_INPUT, this.config.entityId);
      await this.session.announce(audioInputNamespace, this.config.ticket);
      await this.session.announce(stateNamespace, this.config.ticket);
      await this.session.announce(controlNamespace, this.config.ticket);
      this.session.startMessageLoop();
      this.events.emit("connected");
      await this.publishState();
    } catch (error) {
      this.setState(ConnectionState.ERROR);
      let code = "connect_failed";
      let message = "Unknown error";
      let details = void 0;
      if (error instanceof AuthenticationError) {
        code = error.code;
        message = error.message;
        details = { moqErrorCode: error.moqErrorCode };
      } else if (error instanceof ProtocolError) {
        code = error.code;
        message = error.message;
        details = { moqErrorCode: error.moqErrorCode };
      } else if (error instanceof Error) {
        message = error.message;
        if (message.includes("net::ERR_")) {
          code = "network_error";
        } else if (message.includes("certificate")) {
          code = "certificate_error";
          message = `Certificate error: ${message}. For local testing, use a trusted certificate or add an exception.`;
        }
      }
      this.events.emit("error", { code, message, details });
      throw error;
    }
  }
  /**
   * Disconnect from the server
   */
  async disconnect() {
    if (this.stateSubscriber) {
      this.stateSubscriber.stop();
      this.stateSubscriber = null;
    }
    if (this.attributesSubscriber) {
      this.attributesSubscriber.stop();
      this.attributesSubscriber = null;
    }
    if (this.entitySubscriber) {
      this.entitySubscriber.stop();
      this.entitySubscriber = null;
    }
    if (this.spaceSubscriber) {
      this.spaceSubscriber.stop();
      this.spaceSubscriber = null;
    }
    this.teardownReceiveWorker();
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit("disconnected");
  }
  /**
   * Update position (in Panaudia internal coordinates, 0-1 range)
   */
  setPosition(position) {
    this.position = { ...position };
    this.scheduleStatePublish();
  }
  /**
   * Update rotation (in degrees)
   */
  setRotation(rotation) {
    this.rotation = { ...rotation };
    this.scheduleStatePublish();
  }
  /**
   * Get current position
   */
  getPosition() {
    return { ...this.position };
  }
  /**
   * Get current rotation
   */
  getRotation() {
    return { ...this.rotation };
  }
  /**
   * Update position using WebGL coordinates (-1 to 1 range, Three.js convention)
   */
  setPositionWebGL(pos) {
    this.position = webglToAmbisonicPosition(pos);
    this.scheduleStatePublish();
  }
  /**
   * Update rotation using WebGL Euler angles (XYZ order, radians)
   */
  setRotationWebGL(rot) {
    this.rotation = webglToAmbisonicRotation(rot);
    this.scheduleStatePublish();
  }
  /**
   * Get current position in WebGL coordinates
   */
  getPositionWebGL() {
    return ambisonicToWebglPosition(this.position);
  }
  /**
   * Get current rotation in WebGL Euler angles (XYZ order, radians)
   */
  getRotationWebGL() {
    return ambisonicToWebglRotation(this.rotation);
  }
  /**
   * Get all known entities (not gone)
   */
  getEntities() {
    return this.stateSubscriber?.getEntities() ?? /* @__PURE__ */ new Map();
  }
  /**
   * Get a specific entity by UUID
   */
  getEntity(uuid) {
    return this.stateSubscriber?.getEntity(uuid);
  }
  /**
   * Register a handler for entity state updates (Panaudia coordinates)
   */
  onEntityState(handler) {
    this.events.on("entityState", handler);
  }
  /**
   * Get the attributes cache containing all current key-value entries.
   */
  getAttributesCache() {
    return this.attributesSubscriber?.getAll() ?? /* @__PURE__ */ new Map();
  }
  /**
   * Register a handler for batches of attribute values.
   * Fired once per envelope with all accepted (added/updated) values.
   * A single-op envelope is delivered as a one-element array.
   */
  onAttributeValues(handler) {
    this.events.on("attributes", ((values) => {
      handler(values);
    }));
  }
  /**
   * Register a handler for batches of attribute key removals (tombstones).
   * Fired once per envelope with all tombstoned keys.
   */
  onAttributeRemoved(handler) {
    this.events.on("attributesRemoved", ((keys) => {
      handler(keys);
    }));
  }
  /**
   * Register a handler for batches of entity values. Mirrors
   * `onAttributeValues` but for the per-client entity stream — only ops
   * whose key starts with this client's own uuid arrive here.
   */
  onEntityValues(handler) {
    this.events.on("entity", ((values) => {
      handler(values);
    }));
  }
  /**
   * Register a handler for batches of entity key removals (tombstones).
   */
  onEntityRemoved(handler) {
    this.events.on("entityRemoved", ((keys) => {
      handler(keys);
    }));
  }
  /**
   * Invoke a named command from the server's command catalog.
   *
   * Strict-MVC: this fires-and-forgets. The command's effect (if any)
   * arrives later as an echoed entity / attribute op via the existing
   * subscriber path. There is no per-call error response — failed
   * authorisation, unknown command names and bad args all silently
   * drop on the server.
   */
  async command(name, args = {}) {
    if (!this.controlTrackPublisher) {
      this.logWarn("Control publisher not ready, cannot send command");
      return;
    }
    await this.controlTrackPublisher.publishControlMessage({
      type: "command",
      message: { command: name, args }
    });
  }
  /**
   * Start capturing and publishing microphone audio
   *
   * @param config - Optional audio configuration
   */
  async startMicrophone(config) {
    if (this.state !== ConnectionState.CONNECTED && this.state !== ConnectionState.AUTHENTICATED) {
      throw new InvalidStateError("connected or authenticated", this.state);
    }
    if (!this.connection) {
      throw new MoqClientError("No connection available", "NOT_CONNECTED");
    }
    if (!this.audioPublisher) {
      this.audioPublisher = new AudioPublisher({ ...config, debug: this.config.debug });
    }
    if (!this.audioTrackPublisher) {
      this.audioTrackPublisher = new AudioTrackPublisher({
        trackAlias: this.audioInputTrackAlias,
        publisherPriority: 0
        // High priority for audio
      });
      this.audioTrackPublisher.attach(this.connection);
    }
    await this.audioPublisher.initialize();
    this.audioPublisher.onFrame((frame) => {
      if (frame.data.length < 10) return;
      if (this.audioTrackPublisher && this.state === ConnectionState.AUTHENTICATED) {
        this.audioTrackPublisher.publishAudioFrame(frame.data, frame.timestamp).catch((error) => {
          console.error("Failed to publish audio frame:", error);
        });
      }
    });
    this.audioTrackPublisher.startSession();
    this.audioPublisher.start();
    this.log("Microphone started");
  }
  /**
   * Stop capturing microphone audio
   */
  stopMicrophone() {
    if (this.audioPublisher) {
      this.audioPublisher.stop();
      this.log("Microphone stopped");
    }
  }
  /**
   * Check if microphone is currently recording
   */
  isMicrophoneActive() {
    return this.audioPublisher?.getState() === AudioPublisherState.RECORDING;
  }
  /**
   * Enable or disable mic capture without tearing down the publisher.
   * Disabled tracks emit silence; the encoder and track publisher stay
   * alive so MOQ frames keep flowing as Opus DTX.
   */
  setMicEnabled(enabled) {
    this.audioPublisher?.setMicEnabled(enabled);
  }
  /**
   * Pause microphone recording
   */
  pauseMicrophone() {
    this.audioPublisher?.pause();
  }
  /**
   * Resume microphone recording
   */
  resumeMicrophone() {
    this.audioPublisher?.resume();
  }
  /**
   * Publish the current state immediately
   *
   * This sends the current position, rotation, and volume to the server.
   */
  async publishState() {
    if (!this.stateTrackPublisher || this.state !== ConnectionState.AUTHENTICATED) {
      return;
    }
    try {
      const entityInfo = createEntityInfo3(
        this.config.entityId,
        this.position,
        this.rotation,
        0
      );
      const stateBytes = entityInfo3ToBytes(entityInfo);
      await this.stateTrackPublisher.publishState(stateBytes);
      this.lastStatePublishTime = Date.now();
    } catch (error) {
      console.error("Failed to publish state:", error);
    }
  }
  /**
   * Configure state update throttling
   *
   * @param throttleMs - Minimum milliseconds between state updates (default: 50ms = 20Hz)
   */
  setStateThrottle(throttleMs) {
    this.statePublishThrottleMs = Math.max(0, throttleMs);
  }
  /**
   * Start receiving and playing audio from the server
   *
   * @param config - Optional audio player configuration
   */
  async startPlayback(config) {
    if (this.state !== ConnectionState.CONNECTED && this.state !== ConnectionState.AUTHENTICATED) {
      throw new InvalidStateError("connected or authenticated", this.state);
    }
    if (!this.connection) {
      throw new MoqClientError("No connection available", "NOT_CONNECTED");
    }
    if (!this.audioPlayer) {
      this.audioPlayer = new AudioPlayer({ ...config, debug: this.config.debug });
    }
    if (this.audioPlayer.getState() === AudioPlayerState.IDLE) {
      await this.audioPlayer.initialize();
    }
    if (!this.audioSubscriber) {
      this.audioSubscriber = new AudioSubscriber();
    }
    this.audioSubscriber.attach(this.connection, this.audioOutputTrackAlias);
    this.audioSubscriber.onFrame((data, groupId) => {
      if (this.audioPlayer && this.audioPlayer.getState() === AudioPlayerState.PLAYING) {
        try {
          const timestamp = Number(groupId) * 1e3;
          this.audioPlayer.decodeFrame(data, timestamp);
        } catch (error) {
          console.error("Failed to decode audio frame:", error);
        }
      }
    });
    this.audioPlayer.start();
    if (this.receiveWorker && this.audioPlayer) {
      const handoff = this.audioPlayer.prepareForWorker();
      if (handoff?.mode === "sab") {
        this.receiveWorker.postMessage({
          type: "audio",
          audioTrackAlias: this.audioOutputTrackAlias,
          decoderConfig: this.audioPlayer.getDecoderConfig(),
          jbufConfig: handoff.jbufConfig,
          sharedStorage: handoff.sharedStorage,
          sharedWritePos: handoff.sharedWritePos
        });
        this.log(`receive worker decoding audio trackAlias=${this.audioOutputTrackAlias} via SAB ring`);
      } else if (handoff?.mode === "port") {
        this.receiveWorker.postMessage(
          {
            type: "audio",
            audioTrackAlias: this.audioOutputTrackAlias,
            decoderConfig: this.audioPlayer.getDecoderConfig(),
            pcmPort: handoff.pcmPort
          },
          [handoff.pcmPort]
        );
        this.log(`receive worker decoding audio trackAlias=${this.audioOutputTrackAlias} via pcmPort (fallback)`);
      }
    }
    await this.audioSubscriber.start();
    this.log("Playback started");
  }
  /**
   * Stop receiving and playing audio
   */
  stopPlayback() {
    if (this.audioSubscriber) {
      this.audioSubscriber.stop();
    }
    if (this.audioPlayer) {
      this.audioPlayer.stop();
    }
    this.log("Playback stopped");
  }
  /**
   * Check if audio playback is currently active
   */
  isPlaybackActive() {
    return this.audioPlayer?.getState() === AudioPlayerState.PLAYING;
  }
  /**
   * Pause audio playback
   */
  pausePlayback() {
    this.audioPlayer?.pause();
  }
  /**
   * Resume audio playback
   */
  resumePlayback() {
    this.audioPlayer?.resume();
  }
  /**
   * Set playback volume.
   * @param volume - Volume level from 0.0 (silent) to 1.0 (full volume).
   */
  setVolume(volume) {
    this.audioPlayer?.setVolume(volume);
  }
  /**
   * Get current playback volume.
   */
  getVolume() {
    return this.audioPlayer?.getVolume() ?? 1;
  }
  /**
   * Get audio playback statistics
   */
  getPlaybackStats() {
    if (!this.audioSubscriber || !this.audioPlayer) {
      return null;
    }
    return {
      subscriber: this.audioSubscriber.getStats(),
      player: this.audioPlayer.getStats()
    };
  }
  /**
   * Schedule a state publish with throttling
   *
   * If called multiple times rapidly, only one publish will occur
   * after the throttle delay.
   */
  scheduleStatePublish() {
    if (this.state !== ConnectionState.AUTHENTICATED) {
      return;
    }
    if (this.statePublishPending) {
      return;
    }
    const now = Date.now();
    const timeSinceLastPublish = now - this.lastStatePublishTime;
    if (timeSinceLastPublish >= this.statePublishThrottleMs) {
      this.publishState();
    } else {
      this.statePublishPending = true;
      const delay = this.statePublishThrottleMs - timeSinceLastPublish;
      setTimeout(() => {
        this.statePublishPending = false;
        if (this.state === ConnectionState.AUTHENTICATED) {
          this.publishState();
        }
      }, delay);
    }
  }
  /**
   * Extract node ID from JWT token
   */
  extractEntityIdFromJwt(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new JwtParseError("Invalid JWT format: expected 3 parts separated by dots");
      }
      const payload = parts[1];
      let decoded;
      try {
        decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      } catch {
        throw new JwtParseError("Invalid JWT format: payload is not valid base64");
      }
      let claims;
      try {
        claims = JSON.parse(decoded);
      } catch {
        throw new JwtParseError("Invalid JWT format: payload is not valid JSON");
      }
      const entityId = claims.jti || claims.panaudia?.uuid;
      if (!entityId) {
        throw new JwtParseError("No entity ID found in JWT: missing jti or panaudia.uuid claim");
      }
      if (typeof entityId !== "string" || entityId.length < 32) {
        throw new JwtParseError(`Invalid entity ID in JWT: expected UUID string, got ${typeof entityId}`);
      }
      return entityId;
    } catch (error) {
      if (error instanceof JwtParseError) {
        throw error;
      }
      throw new JwtParseError(`Failed to extract entity ID from JWT: ${error}`);
    }
  }
  /**
   * Update internal state and emit events
   */
  setState(newState) {
    const previousState = this.state;
    this.state = newState;
    this.events.emit("statechange", {
      previousState,
      currentState: newState
    });
  }
  /**
   * Move datagram receive + Opus decode off the main thread into the receive
   * Worker (design §11). Best-effort: if the worker can't be created the
   * connection stays in main-thread mode and the worklet is fed by the
   * main-thread decoder (fallback, design §11.8) — audio still plays. MUST run
   * after connect() and BEFORE any subscriber starts (which would lock the
   * datagram stream on the main thread).
   */
  setupReceiveWorker() {
    if (!this.connection) return;
    if (!audioReceiveWorkerSupported()) {
      this.log("receive worker unsupported — main-thread decode (fallback)");
      return;
    }
    let url = null;
    try {
      url = createReceiveWorkerUrl();
      const worker = new Worker(url);
      worker.onmessage = (e) => {
        const msg = e.data;
        if (!msg) return;
        if (msg.type === "datagram") {
          this.connection?.ingestForwardedDatagram(msg.trackAlias, msg.payload, msg.groupId, msg.objectId);
        } else if (msg.type === "notice") {
          this.log(`[receive-worker] ${msg.event}${msg.detail ? ": " + msg.detail : ""}`);
        }
      };
      worker.onerror = (e) => this.log("[receive-worker] error", e.message);
      const readable = this.connection.takeDatagramReadableForWorker();
      if (!readable) {
        worker.terminate();
        return;
      }
      worker.postMessage({ type: "init", readable }, [readable]);
      this.receiveWorker = worker;
      console.info("[panaudia] receive worker ACTIVE — datagram read + decode OFF the main thread");
    } catch (err) {
      console.warn(
        "[panaudia] receive worker setup FAILED — falling back to MAIN-THREAD decode (audio will be coupled to main-thread jank). Cause:",
        err
      );
      this.receiveWorker?.terminate();
      this.receiveWorker = null;
      this.connection?.revertToMainDatagramMode();
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }
  /** Stop and release the receive Worker, if any. */
  teardownReceiveWorker() {
    if (this.receiveWorker) {
      try {
        this.receiveWorker.postMessage({ type: "stop" });
      } catch {
      }
      this.receiveWorker.terminate();
      this.receiveWorker = null;
    }
  }
  /**
   * Handle connection error
   */
  handleError(code, message) {
    this.setState(ConnectionState.ERROR);
    this.events.emit("error", { code, message });
  }
  /**
   * Handle disconnection
   */
  handleDisconnect() {
    this.teardownReceiveWorker();
    this.session = null;
    this.connection = null;
    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit("disconnected");
  }
}
class MoqTransportAdapter {
  client = null;
  microphoneId;
  async connect(config) {
    this.microphoneId = config.microphoneId;
    let serverUrl = config.serverUrl;
    const url = new URL(serverUrl);
    if (config.initialPosition) {
      url.searchParams.set("x", String(config.initialPosition.x));
      url.searchParams.set("y", String(config.initialPosition.y));
      url.searchParams.set("z", String(config.initialPosition.z));
    }
    if (config.initialRotation) {
      url.searchParams.set("yaw", String(config.initialRotation.yaw));
      url.searchParams.set("pitch", String(config.initialRotation.pitch));
      url.searchParams.set("roll", String(config.initialRotation.roll));
    }
    if (config.presence !== false) {
      url.searchParams.set("presence", "true");
    }
    if (config.queryParams) {
      for (const [key, value] of Object.entries(config.queryParams)) {
        url.searchParams.set(key, value);
      }
    }
    serverUrl = url.toString();
    const moqConfig = {
      serverUrl,
      ticket: config.ticket,
      entityId: config.entityId,
      initialPosition: config.initialPosition,
      initialRotation: config.initialRotation,
      debug: config.debug
    };
    this.client = new PanaudiaMoqClient(moqConfig);
    for (const [event, handler] of this.pendingHandlers) {
      this.client.on(event, handler);
    }
    this.pendingHandlers = [];
    await this.client.connect();
    const audio = config.audio;
    await this.client.startMicrophone({
      ...this.microphoneId ? { deviceId: this.microphoneId } : {},
      ...audio?.echoCancellation !== void 0 ? { echoCancellation: audio.echoCancellation } : {},
      ...audio?.noiseSuppression !== void 0 ? { noiseSuppression: audio.noiseSuppression } : {},
      ...audio?.autoGainControl !== void 0 ? { autoGainControl: audio.autoGainControl } : {}
    });
    await this.client.startPlayback();
  }
  async disconnect() {
    if (this.client) {
      this.client.stopMicrophone();
      this.client.stopPlayback();
      await this.client.disconnect();
      this.client = null;
    }
  }
  getState() {
    if (!this.client) return ConnectionState.DISCONNECTED;
    return this.client.getState();
  }
  getEntityId() {
    if (!this.client) throw new Error("Not connected");
    return this.client.getEntityId();
  }
  async startAudioCapture(config) {
    await this.requireClient().startMicrophone(config ? {
      echoCancellation: config.echoCancellation,
      noiseSuppression: config.noiseSuppression,
      autoGainControl: config.autoGainControl
    } : void 0);
  }
  async stopAudioCapture() {
    this.requireClient().stopMicrophone();
  }
  async startAudioPlayback(config) {
    await this.requireClient().startPlayback(config ? {
      sampleRate: config.sampleRate,
      channelCount: config.channelCount
    } : void 0);
  }
  async stopAudioPlayback() {
    this.requireClient().stopPlayback();
  }
  setVolume(volume) {
    this.requireClient().setVolume(volume);
  }
  getVolume() {
    return this.client?.getVolume() ?? 1;
  }
  muteMic() {
    this.requireClient().setMicEnabled(false);
  }
  unmuteMic() {
    this.requireClient().setMicEnabled(true);
  }
  async publishState(state) {
    const client = this.requireClient();
    client.setPosition(state.position);
    client.setRotation(state.rotation);
    await client.publishState();
  }
  async publishControl(msg) {
    const client = this.requireClient();
    if (msg.type === "command") {
      await client.command(msg.message.command, msg.message.args);
    }
  }
  // Event registration — buffer handlers if client not yet created
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingHandlers = [];
  onEntityState(handler) {
    this.registerHandler("entityState", handler);
  }
  onAttributeValues(handler) {
    this.registerHandler("attributes", handler);
  }
  onAttributeRemoved(handler) {
    this.registerHandler("attributesRemoved", handler);
  }
  onEntityValues(handler) {
    this.registerHandler("entity", handler);
  }
  onEntityRemoved(handler) {
    this.registerHandler("entityRemoved", handler);
  }
  onSpaceValues(handler) {
    this.registerHandler("space", handler);
  }
  onSpaceRemoved(handler) {
    this.registerHandler("spaceRemoved", handler);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCacheDebug(handler) {
    this.registerHandler("cacheDebug", handler);
  }
  onConnectionStateChange(handler) {
    this.registerHandler("statechange", (event) => {
      handler(event.currentState);
    });
  }
  onError(handler) {
    this.registerHandler("error", (event) => {
      handler(new Error(event.message));
    });
  }
  onWarning(handler) {
    this.registerHandler("warning", handler);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerHandler(event, handler) {
    if (this.client) {
      this.client.on(event, handler);
    } else {
      this.pendingHandlers.push([event, handler]);
    }
  }
  requireClient() {
    if (!this.client) throw new Error("Not connected");
    return this.client;
  }
}
export {
  AnnouncementError,
  AttributesSubscriber,
  AudioDecoderNotSupportedError,
  AudioEncodingError,
  AudioNotSupportedError,
  AudioPermissionError,
  AudioPlayer,
  AudioPlayerState,
  AudioPublisher,
  AudioPublisherState,
  AudioSubscriber,
  AudioSubscriberState,
  AudioTrackPublisher,
  AuthenticationError,
  BluetoothMicDefaultError,
  CacheMap,
  CacheTopicSubscriber,
  ConnectionError,
  ConnectionState,
  ControlTrackPublisher,
  ENTITY_INFO3_SIZE,
  EntitySubscriber,
  InvalidStateError,
  JitterBufferCore,
  JwtParseError,
  MOQ_TRANSPORT_VERSION,
  MessageBuilder,
  MoqClientError,
  MoqConnection,
  MoqErrorCode,
  MoqFilterType,
  MoqForwardingPreference,
  MoqMessageType,
  MoqRole,
  MoqTransportAdapter,
  PLAYOUT_PROCESSOR_NAME,
  PLAYOUT_TUNING,
  PanaudiaMoqClient,
  PanaudiaTrackType,
  ProtocolError,
  StateSubscriber,
  StateTrackPublisher,
  SubscriptionError,
  TimeoutError,
  TrackPublisher,
  WebTransportNotSupportedError,
  aframeToPanaudia,
  ambisonicToWebglPosition,
  ambisonicToWebglRotation,
  audioReceiveWorkerSupported,
  babylonToPanaudia,
  buildAnnounce,
  buildClientSetup,
  buildObjectDatagram,
  buildPlayoutWorkletCode,
  buildReceiveWorkerCode,
  buildSubscribe,
  buildUnannounce,
  buildUnsubscribe,
  b as bytesToUuid,
  computeJitterCapacity,
  createEntityInfo3,
  createPlayoutWorkletUrl,
  createReceiveWorkerUrl,
  decodeBytes,
  f as decodeCacheOp,
  decodeString,
  decodeVarint,
  encodeBytes,
  g as encodeCacheOp,
  encodeString,
  encodeVarint,
  entityInfo3FromBytes,
  entityInfo3ToBytes,
  generateTrackNamespace,
  getAudioCapabilities,
  getAudioDecoderCapabilities,
  getAudioPlaybackCapabilities,
  getBestOpusMimeType,
  getMoqErrorMessage,
  getWebTransportSupport,
  isAudioDecoderSupported,
  isAudioPlaybackSupported,
  h as isCacheEnvelope,
  isOpusSupported,
  i as isValidUuid,
  isWebTransportSupported,
  panaudiaToAframe,
  panaudiaToBabylon,
  panaudiaToPixi,
  panaudiaToPlaycanvas,
  panaudiaToThreejs,
  panaudiaToUnity,
  panaudiaToUnreal,
  parseAnnounceError,
  parseAnnounceOk,
  parseMessageType,
  parseObjectDatagram,
  parseServerSetup,
  parseSubscribeError,
  parseSubscribeOk,
  pixiToPanaudia,
  playcanvasToPanaudia,
  routeDatagram,
  threejsToPanaudia,
  unityToPanaudia,
  unrealToPanaudia,
  u as uuidToBytes,
  webglToAmbisonicPosition,
  webglToAmbisonicRotation,
  wrapError
};
//# sourceMappingURL=index.js.map
