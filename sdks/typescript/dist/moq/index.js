var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { C as ConnectionState, E as ENTITY_INFO3_SIZE, e as entityInfo3FromBytes, c as createEntityInfo3, a as entityInfo3ToBytes } from "../encoding.js";
import { b, i, u } from "../encoding.js";
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
  constructor(config = {}) {
    __publicField(this, "encoder", null);
    __publicField(this, "config");
    __publicField(this, "frameCallback", null);
    __publicField(this, "isInitialized", false);
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
    var _a;
    return ((_a = this.encoder) == null ? void 0 : _a.state) ?? "closed";
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
  constructor(config = {}) {
    __publicField(this, "audioContext", null);
    __publicField(this, "sourceNode", null);
    __publicField(this, "workletNode", null);
    __publicField(this, "encoder");
    __publicField(this, "config");
    __publicField(this, "sampleBuffer", []);
    __publicField(this, "bufferSize", 0);
    __publicField(this, "samplesPerFrame");
    __publicField(this, "frameDurationUs");
    __publicField(this, "timestampUs", 0);
    __publicField(this, "isRunning", false);
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
  constructor(defaultLabel, availableDevices) {
    super(
      `Default microphone is Bluetooth (${defaultLabel}). Please select a non-Bluetooth microphone to preserve stereo audio.`,
      "BLUETOOTH_MIC_DEFAULT",
      { defaultLabel, availableDevices }
    );
    __publicField(this, "availableDevices");
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
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "state", "idle");
    __publicField(this, "mediaStream", null);
    __publicField(this, "mediaRecorder", null);
    __publicField(this, "frameHandler", null);
    // WebCodecs encoder (preferred - produces raw Opus)
    __publicField(this, "webCodecsEncoder", null);
    __publicField(this, "useWebCodecs", false);
    // Timing
    __publicField(this, "startTime", 0);
    __publicField(this, "frameSequence", 0);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...args) {
    if (this.config.debug) {
      console.log("[AudioPublisher]", ...args);
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
var PanaudiaTrackType = /* @__PURE__ */ ((PanaudiaTrackType2) => {
  PanaudiaTrackType2["AUDIO_INPUT"] = "in/audio/opus-mono";
  PanaudiaTrackType2["AUDIO_OUTPUT"] = "out/audio/opus-stereo";
  PanaudiaTrackType2["STATE"] = "state";
  PanaudiaTrackType2["STATE_OUTPUT"] = "out/state";
  PanaudiaTrackType2["ATTRIBUTES_OUTPUT"] = "out/attributes";
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
  constructor() {
    __publicField(this, "chunks", []);
    __publicField(this, "totalLength", 0);
  }
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
function buildClientSetup(supportedVersions, role, path, maxSubscribeId) {
  const contentBuilder = new MessageBuilder();
  contentBuilder.writeVarint(supportedVersions.length);
  for (const version of supportedVersions) {
    contentBuilder.writeVarint(version);
  }
  let numParams = 1;
  if (path !== void 0) numParams++;
  if (maxSubscribeId !== void 0) numParams++;
  contentBuilder.writeVarint(numParams);
  contentBuilder.writeVarint(MoqSetupParameter.ROLE);
  contentBuilder.writeVarint(role);
  if (path !== void 0) {
    contentBuilder.writeVarint(MoqSetupParameter.PATH);
    const pathBytes = textEncoder.encode(path);
    contentBuilder.writeVarint(pathBytes.length);
    contentBuilder.writeRaw(pathBytes);
  }
  if (maxSubscribeId !== void 0) {
    contentBuilder.writeVarint(MoqSetupParameter.MAX_SUBSCRIBE_ID);
    contentBuilder.writeVarint(maxSubscribeId);
  }
  return wrapWithLengthFrame(MoqMessageType.CLIENT_SETUP, contentBuilder.build());
}
function buildSubscribe(subscription) {
  const contentBuilder = new MessageBuilder();
  contentBuilder.writeVarint(subscription.subscribeId);
  contentBuilder.writeVarint(subscription.namespace.length);
  for (const part of subscription.namespace) {
    contentBuilder.writeString(part);
  }
  contentBuilder.writeString(subscription.trackName);
  const priority = subscription.subscriberPriority ?? 128;
  contentBuilder.writeRaw(new Uint8Array([priority]));
  const groupOrder = subscription.groupOrder ?? 0;
  contentBuilder.writeRaw(new Uint8Array([groupOrder]));
  const forward = subscription.forward ?? 0;
  contentBuilder.writeRaw(new Uint8Array([forward]));
  contentBuilder.writeVarint(subscription.filterType);
  if (subscription.authorization) {
    contentBuilder.writeVarint(1);
    contentBuilder.writeVarint(3);
    const authBytes = textEncoder.encode(subscription.authorization);
    contentBuilder.writeVarint(authBytes.length);
    contentBuilder.writeRaw(authBytes);
  } else {
    contentBuilder.writeVarint(0);
  }
  return wrapWithLengthFrame(MoqMessageType.SUBSCRIBE, contentBuilder.build());
}
function buildAnnounce(announcement) {
  const contentBuilder = new MessageBuilder();
  contentBuilder.writeVarint(announcement.requestId);
  contentBuilder.writeVarint(announcement.namespace.length);
  for (const part of announcement.namespace) {
    contentBuilder.writeString(part);
  }
  if (announcement.parameters && announcement.parameters.size > 0) {
    contentBuilder.writeVarint(announcement.parameters.size);
    for (const [key, value] of announcement.parameters) {
      contentBuilder.writeVarint(key);
      contentBuilder.writeBytes(value);
    }
  } else {
    contentBuilder.writeVarint(0);
  }
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
  let pos = offset;
  const { value: version, bytesRead: versionBytes } = decodeVarint(data, pos);
  pos += versionBytes;
  const { value: numParams, bytesRead: numParamsBytes } = decodeVarint(data, pos);
  pos += numParamsBytes;
  const parameters = /* @__PURE__ */ new Map();
  for (let i2 = 0; i2 < Number(numParams); i2++) {
    const { value: paramType, bytesRead: paramTypeBytes } = decodeVarint(data, pos);
    pos += paramTypeBytes;
    const typeNum = Number(paramType);
    if (typeNum % 2 === 0) {
      const { value: paramValue, bytesRead: paramValueBytes } = decodeVarint(data, pos);
      pos += paramValueBytes;
      const valueBytes = encodeVarint(paramValue);
      parameters.set(typeNum, valueBytes);
    } else {
      const { value: paramValue, bytesRead: paramValueBytes } = decodeBytes(data, pos);
      pos += paramValueBytes;
      parameters.set(typeNum, paramValue);
    }
  }
  return {
    selectedVersion: Number(version),
    parameters
  };
}
function parseSubscribeOk(data, offset = 0) {
  let pos = offset;
  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);
  pos += subIdBytes;
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;
  const { value: expires, bytesRead: expiresBytes } = decodeVarint(data, pos);
  pos += expiresBytes;
  if (pos >= data.length) {
    throw new Error("Not enough data for GroupOrder in SUBSCRIBE_OK");
  }
  const groupOrder = data[pos];
  pos += 1;
  if (pos >= data.length) {
    throw new Error("Not enough data for ContentExists in SUBSCRIBE_OK");
  }
  const contentExists = data[pos] !== 0;
  pos += 1;
  const result = {
    subscribeId: Number(subscribeId),
    trackAlias: Number(trackAlias),
    expires,
    groupOrder,
    contentExists
  };
  if (result.contentExists) {
    const { value: largestGroupId, bytesRead: groupIdBytes } = decodeVarint(data, pos);
    pos += groupIdBytes;
    const { value: largestObjectId, bytesRead: objectIdBytes } = decodeVarint(data, pos);
    pos += objectIdBytes;
    result.largestGroupId = largestGroupId;
    result.largestObjectId = largestObjectId;
  }
  return result;
}
function parseSubscribeError(data, offset = 0) {
  let pos = offset;
  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);
  pos += subIdBytes;
  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);
  pos += errorCodeBytes;
  const { value: reasonPhrase, bytesRead: reasonBytes } = decodeString(data, pos);
  pos += reasonBytes;
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;
  return {
    subscribeId: Number(subscribeId),
    errorCode: Number(errorCode),
    reasonPhrase,
    trackAlias: Number(trackAlias)
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
const MOQ_TRANSPORT_VERSION = 4278190080 + 11;
class MoqConnection {
  constructor(serverUrl) {
    __publicField(this, "transport", null);
    __publicField(this, "state", ConnectionState.DISCONNECTED);
    __publicField(this, "handlers", {});
    __publicField(this, "datagramWriter", null);
    // Datagram dispatcher
    __publicField(this, "datagramHandlers", /* @__PURE__ */ new Map());
    __publicField(this, "datagramDispatcherRunning", false);
    this.serverUrl = serverUrl;
  }
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
    this.datagramHandlers.clear();
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
   * Register a datagram handler for a specific track alias.
   * Starts the dispatcher on first registration.
   */
  registerDatagramHandler(trackAlias, handler) {
    this.datagramHandlers.set(trackAlias, handler);
    if (!this.datagramDispatcherRunning) {
      this.startDatagramDispatcher();
    }
  }
  /**
   * Unregister a datagram handler for a track alias
   */
  unregisterDatagramHandler(trackAlias) {
    this.datagramHandlers.delete(trackAlias);
  }
  /**
   * Start the single datagram reader loop that dispatches to handlers by track alias
   */
  startDatagramDispatcher() {
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
            const handler = this.datagramHandlers.get(parsed.trackAlias);
            if (handler) {
              handler(parsed.payload, parsed.trackAlias, parsed.groupId, parsed.objectId);
            }
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
class TrackPublisher {
  constructor(config) {
    __publicField(this, "trackAlias");
    __publicField(this, "publisherPriority");
    __publicField(this, "connection", null);
    // Group/Object tracking
    __publicField(this, "currentGroupId", 0n);
    __publicField(this, "currentObjectId", 0n);
    __publicField(this, "lastGroupTimestamp", 0);
    __publicField(this, "groupDurationMs", 1e3);
    // Start new group every second
    // Statistics
    __publicField(this, "stats", {
      objectsPublished: 0,
      bytesPublished: 0,
      errors: 0,
      currentGroupId: 0n,
      currentObjectId: 0n
    });
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
  constructor(config) {
    super(config);
    __publicField(this, "frameSequence", 0n);
    __publicField(this, "sessionStartTime", 0);
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
  constructor(config) {
    super(config);
    __publicField(this, "updateSequence", 0n);
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
  constructor() {
    __publicField(this, "connection", null);
    __publicField(this, "state", "idle");
    __publicField(this, "frameHandler", null);
    __publicField(this, "trackAlias", 0);
    __publicField(this, "isListening", false);
    // Statistics
    __publicField(this, "stats", {
      framesReceived: 0,
      bytesReceived: 0,
      framesDropped: 0,
      currentGroupId: 0n,
      lastFrameTime: 0
    });
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
var AudioPlayerState = /* @__PURE__ */ ((AudioPlayerState2) => {
  AudioPlayerState2["IDLE"] = "idle";
  AudioPlayerState2["INITIALIZING"] = "initializing";
  AudioPlayerState2["READY"] = "ready";
  AudioPlayerState2["PLAYING"] = "playing";
  AudioPlayerState2["ERROR"] = "error";
  return AudioPlayerState2;
})(AudioPlayerState || {});
class AudioPlayer {
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "state", "idle");
    // Web Audio API
    __publicField(this, "audioContext", null);
    __publicField(this, "gainNode", null);
    // WebCodecs decoder
    __publicField(this, "decoder", null);
    // Playback scheduling
    __publicField(this, "nextPlayTime", 0);
    __publicField(this, "scheduledBuffers", []);
    // Statistics
    __publicField(this, "stats", {
      framesDecoded: 0,
      samplesPlayed: 0,
      underruns: 0,
      bufferLevel: 0,
      decodeErrors: 0
    });
    this.config = {
      sampleRate: config.sampleRate ?? 48e3,
      channelCount: config.channelCount ?? 2,
      bufferSize: config.bufferSize ?? 0.03,
      maxBufferSize: config.maxBufferSize ?? 0.15,
      latencyHint: config.latencyHint ?? "interactive",
      debug: config.debug ?? false
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
    return { ...this.stats };
  }
  /**
   * Initialize the audio player
   *
   * This creates the AudioContext and AudioDecoder.
   * Must be called in response to a user gesture on some browsers.
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
      this.decoder = new AudioDecoder({
        output: (audioData) => this.handleDecodedAudio(audioData),
        error: (error) => this.handleDecodeError(error)
      });
      this.decoder.configure({
        codec: "opus",
        sampleRate: this.config.sampleRate,
        numberOfChannels: this.config.channelCount
      });
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.state = "ready";
      this.log("initialized");
    } catch (error) {
      this.state = "error";
      throw error;
    }
  }
  /**
   * Start playback
   */
  start() {
    var _a;
    if (this.state !== "ready" && this.state !== "playing") {
      throw new MoqClientError(
        `Cannot start: must be in READY state, currently ${this.state}`,
        "INVALID_STATE"
      );
    }
    if (((_a = this.audioContext) == null ? void 0 : _a.state) === "suspended") {
      this.audioContext.resume();
    }
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime + this.config.bufferSize;
    }
    this.state = "playing";
    this.log("started");
  }
  /**
   * Stop playback
   */
  stop() {
    for (const source of this.scheduledBuffers) {
      try {
        source.stop();
      } catch {
      }
    }
    this.scheduledBuffers = [];
    this.state = "ready";
    this.log("stopped");
  }
  /**
   * Pause playback
   */
  pause() {
    var _a;
    if (((_a = this.audioContext) == null ? void 0 : _a.state) === "running") {
      this.audioContext.suspend();
    }
  }
  /**
   * Resume playback
   */
  resume() {
    var _a;
    if (((_a = this.audioContext) == null ? void 0 : _a.state) === "suspended") {
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
    var _a;
    return ((_a = this.gainNode) == null ? void 0 : _a.gain.value) ?? 1;
  }
  /**
   * Decode an Opus frame
   *
   * @param opusData - Opus-encoded audio data
   * @param timestamp - Frame timestamp in microseconds (optional)
   */
  decodeFrame(opusData, timestamp) {
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
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.state = "idle";
    this.log("disposed");
  }
  /**
   * Handle decoded audio data
   */
  handleDecodedAudio(audioData) {
    if (!this.audioContext || this.state !== "playing") {
      audioData.close();
      return;
    }
    try {
      const buffer = this.audioContext.createBuffer(
        audioData.numberOfChannels,
        audioData.numberOfFrames,
        audioData.sampleRate
      );
      for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        audioData.copyTo(channelData, {
          planeIndex: channel,
          format: "f32-planar"
        });
      }
      this.scheduleBuffer(buffer);
      this.stats.framesDecoded++;
      this.stats.samplesPlayed += audioData.numberOfFrames;
      if (this.audioContext) {
        this.stats.bufferLevel = Math.max(
          0,
          this.nextPlayTime - this.audioContext.currentTime
        );
      }
    } finally {
      audioData.close();
    }
  }
  /**
   * Schedule an audio buffer for playback
   */
  scheduleBuffer(buffer) {
    if (!this.audioContext) {
      return;
    }
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode ?? this.audioContext.destination);
    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.stats.underruns++;
      this.nextPlayTime = currentTime + this.config.bufferSize;
    } else if (this.nextPlayTime > currentTime + this.config.maxBufferSize) {
      this.nextPlayTime = currentTime + this.config.bufferSize;
    }
    source.start(this.nextPlayTime);
    this.scheduledBuffers.push(source);
    source.onended = () => {
      const index = this.scheduledBuffers.indexOf(source);
      if (index > -1) {
        this.scheduledBuffers.splice(index, 1);
      }
    };
    this.nextPlayTime += buffer.duration;
  }
  /**
   * Handle decode error
   */
  handleDecodeError(error) {
    console.error("Audio decode error:", error);
    this.stats.decodeErrors++;
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
class StateSubscriber {
  constructor() {
    __publicField(this, "connection", null);
    __publicField(this, "trackAlias", 0);
    __publicField(this, "isListening", false);
    __publicField(this, "entities", /* @__PURE__ */ new Map());
    __publicField(this, "stateHandler", null);
    // Statistics
    __publicField(this, "updatesReceived", 0);
    __publicField(this, "errorsDropped", 0);
  }
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
class AttributesSubscriber {
  constructor() {
    __publicField(this, "connection", null);
    __publicField(this, "trackAlias", 0);
    __publicField(this, "isListening", false);
    __publicField(this, "entities", /* @__PURE__ */ new Map());
    __publicField(this, "handler", null);
    // Statistics
    __publicField(this, "updatesReceived", 0);
    __publicField(this, "errorsDropped", 0);
  }
  /**
   * Set handler for attribute updates
   */
  onAttributes(handler) {
    this.handler = handler;
  }
  /**
   * Attach to a connection and track alias
   */
  attach(connection, trackAlias) {
    this.connection = connection;
    this.trackAlias = trackAlias;
  }
  /**
   * Start receiving attribute updates via the datagram dispatcher
   */
  start() {
    if (!this.connection || this.isListening) return;
    this.isListening = true;
    this.connection.registerDatagramHandler(this.trackAlias, (payload) => {
      if (!this.isListening) return;
      try {
        const json = new TextDecoder().decode(payload);
        const attrs = JSON.parse(json);
        if (!attrs.uuid) {
          this.errorsDropped++;
          return;
        }
        this.updatesReceived++;
        this.entities.set(attrs.uuid, attrs);
        if (this.handler) {
          this.handler(attrs);
        }
      } catch {
        this.errorsDropped++;
      }
    });
  }
  /**
   * Stop receiving attribute updates
   */
  stop() {
    this.isListening = false;
    if (this.connection) {
      this.connection.unregisterDatagramHandler(this.trackAlias);
    }
  }
  /**
   * Get all known entities
   */
  getKnownEntities() {
    return new Map(this.entities);
  }
  /**
   * Get attributes for a specific entity
   */
  getEntityAttributes(uuid) {
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
class EventEmitter {
  constructor() {
    __publicField(this, "handlers", /* @__PURE__ */ new Map());
  }
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
class MoqSession {
  constructor(connection, debug = false) {
    __publicField(this, "controlStream", null);
    __publicField(this, "writer", null);
    __publicField(this, "reader", null);
    __publicField(this, "readBuffer", new Uint8Array(0));
    __publicField(this, "nextSubscribeId", 1);
    __publicField(this, "nextTrackAlias", 1);
    __publicField(this, "nextAnnounceRequestId", 2);
    // Client uses even IDs for announces (to avoid collisions with server)
    // Track state
    __publicField(this, "subscriptions", /* @__PURE__ */ new Map());
    __publicField(this, "announcements", /* @__PURE__ */ new Map());
    __publicField(this, "incomingSubscriptions", /* @__PURE__ */ new Map());
    // Callbacks for when server subscribes to our tracks
    __publicField(this, "onIncomingSubscribeCallback", null);
    __publicField(this, "debug");
    this.connection = connection;
    this.debug = debug;
  }
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
  async subscribe(namespace, trackName, authorization) {
    const subscribeId = this.nextSubscribeId++;
    const subscribeMsg = buildSubscribe({
      subscribeId,
      namespace,
      trackName,
      filterType: MoqFilterType.LATEST_GROUP,
      authorization
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
    var _a;
    return (_a = this.subscriptions.get(subscribeId)) == null ? void 0 : _a.alias;
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
class PanaudiaMoqClient {
  constructor(config) {
    __publicField(this, "config");
    __publicField(this, "events", new EventEmitter());
    __publicField(this, "connection", null);
    __publicField(this, "session", null);
    __publicField(this, "state", ConnectionState.DISCONNECTED);
    // Audio publishing
    __publicField(this, "audioPublisher", null);
    __publicField(this, "audioTrackPublisher", null);
    // State publishing
    __publicField(this, "stateTrackPublisher", null);
    __publicField(this, "statePublishPending", false);
    __publicField(this, "statePublishThrottleMs", 50);
    // Throttle state updates to 20Hz max
    __publicField(this, "lastStatePublishTime", 0);
    // Audio playback
    __publicField(this, "audioSubscriber", null);
    __publicField(this, "audioPlayer", null);
    // State tracking
    __publicField(this, "stateSubscriber", null);
    // Control publishing
    __publicField(this, "controlTrackPublisher", null);
    __publicField(this, "controlTrackAlias", 3);
    // Attributes tracking
    __publicField(this, "attributesSubscriber", null);
    __publicField(this, "attributesOutputTrackAlias", 0);
    // Track aliases (assigned after announcement/subscription)
    __publicField(this, "audioInputTrackAlias", 1);
    __publicField(this, "stateTrackAlias", 2);
    __publicField(this, "audioOutputTrackAlias", 0);
    // Assigned by server
    __publicField(this, "stateOutputTrackAlias", 0);
    // Assigned by server
    // Node state
    __publicField(this, "position");
    __publicField(this, "rotation");
    if (!config.serverUrl) {
      throw new Error("serverUrl is required");
    }
    if (!config.ticket) {
      throw new Error("ticket is required");
    }
    const entityId = config.entityId ?? this.extractEntityIdFromJwt(config.ticket);
    this.config = {
      serverUrl: config.serverUrl,
      ticket: config.ticket,
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
            this.handleError("connection_error", (error == null ? void 0 : error.message) ?? "Connection failed");
          } else if (connState === ConnectionState.DISCONNECTED) {
            this.handleDisconnect();
          }
        }
      });
      await this.connection.connect(options);
      this.setState(ConnectionState.CONNECTED);
      this.log("WebTransport connected, initializing MOQ session...");
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
      this.log("Subscribing to attributes output:", attributesOutputNamespace.join("/"));
      const attrsSubscribeId = await this.session.subscribe(attributesOutputNamespace, "");
      this.attributesOutputTrackAlias = this.session.getTrackAlias(attrsSubscribeId) ?? 0;
      this.log("Attributes output subscribed, trackAlias:", this.attributesOutputTrackAlias);
      this.attributesSubscriber = new AttributesSubscriber();
      this.attributesSubscriber.attach(this.connection, this.attributesOutputTrackAlias);
      this.attributesSubscriber.onAttributes((attrs) => {
        this.events.emit("attributes", attrs);
      });
      this.attributesSubscriber.start();
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
    var _a;
    return ((_a = this.stateSubscriber) == null ? void 0 : _a.getEntities()) ?? /* @__PURE__ */ new Map();
  }
  /**
   * Get a specific entity by UUID
   */
  getEntity(uuid) {
    var _a;
    return (_a = this.stateSubscriber) == null ? void 0 : _a.getEntity(uuid);
  }
  /**
   * Register a handler for entity state updates (Panaudia coordinates)
   */
  onEntityState(handler) {
    this.events.on("entityState", handler);
  }
  /**
   * Get all known nodes and their attributes
   */
  getKnownEntities() {
    var _a;
    return ((_a = this.attributesSubscriber) == null ? void 0 : _a.getKnownEntities()) ?? /* @__PURE__ */ new Map();
  }
  /**
   * Register a handler for attribute updates
   */
  onAttributes(handler) {
    this.events.on("attributes", handler);
  }
  /**
   * Mute a remote entity (they will be silent in your mix)
   */
  async mute(entityId) {
    if (!this.controlTrackPublisher) {
      this.logWarn("Control publisher not ready, cannot mute");
      return;
    }
    await this.controlTrackPublisher.publishControlMessage({
      type: "mute",
      message: { node: entityId }
    });
  }
  /**
   * Unmute a remote entity
   */
  async unmute(entityId) {
    if (!this.controlTrackPublisher) {
      this.logWarn("Control publisher not ready, cannot unmute");
      return;
    }
    await this.controlTrackPublisher.publishControlMessage({
      type: "unmute",
      message: { node: entityId }
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
    var _a;
    return ((_a = this.audioPublisher) == null ? void 0 : _a.getState()) === AudioPublisherState.RECORDING;
  }
  /**
   * Pause microphone recording
   */
  pauseMicrophone() {
    var _a;
    (_a = this.audioPublisher) == null ? void 0 : _a.pause();
  }
  /**
   * Resume microphone recording
   */
  resumeMicrophone() {
    var _a;
    (_a = this.audioPublisher) == null ? void 0 : _a.resume();
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
    var _a;
    return ((_a = this.audioPlayer) == null ? void 0 : _a.getState()) === AudioPlayerState.PLAYING;
  }
  /**
   * Pause audio playback
   */
  pausePlayback() {
    var _a;
    (_a = this.audioPlayer) == null ? void 0 : _a.pause();
  }
  /**
   * Resume audio playback
   */
  resumePlayback() {
    var _a;
    (_a = this.audioPlayer) == null ? void 0 : _a.resume();
  }
  /**
   * Set playback volume.
   * @param volume - Volume level from 0.0 (silent) to 1.0 (full volume).
   */
  setVolume(volume) {
    var _a;
    (_a = this.audioPlayer) == null ? void 0 : _a.setVolume(volume);
  }
  /**
   * Get current playback volume.
   */
  getVolume() {
    var _a;
    return ((_a = this.audioPlayer) == null ? void 0 : _a.getVolume()) ?? 1;
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
    var _a;
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
      const entityId = claims.jti || ((_a = claims.panaudia) == null ? void 0 : _a.uuid);
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
    this.session = null;
    this.connection = null;
    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit("disconnected");
  }
}
class MoqTransportAdapter {
  constructor() {
    __publicField(this, "client", null);
    __publicField(this, "microphoneId");
    // Event registration — buffer handlers if client not yet created
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __publicField(this, "pendingHandlers", []);
  }
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
    await this.client.startMicrophone(
      this.microphoneId ? { deviceId: this.microphoneId } : void 0
    );
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
      sampleRate: config.sampleRate,
      channelCount: config.channelCount,
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
    var _a;
    return ((_a = this.client) == null ? void 0 : _a.getVolume()) ?? 1;
  }
  muteMic() {
    this.requireClient().stopMicrophone();
  }
  unmuteMic() {
    this.requireClient().startMicrophone();
  }
  async publishState(state) {
    const client = this.requireClient();
    client.setPosition(state.position);
    client.setRotation(state.rotation);
    await client.publishState();
  }
  async publishControl(msg) {
    const client = this.requireClient();
    if (msg.type === "mute") {
      await client.mute(msg.message.node);
    } else if (msg.type === "unmute") {
      await client.unmute(msg.message.node);
    }
  }
  onEntityState(handler) {
    this.registerHandler("entityState", handler);
  }
  onAttributes(handler) {
    this.registerHandler("attributes", handler);
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
  ConnectionError,
  ConnectionState,
  ControlTrackPublisher,
  ENTITY_INFO3_SIZE,
  InvalidStateError,
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
  babylonToPanaudia,
  buildAnnounce,
  buildClientSetup,
  buildObjectDatagram,
  buildSubscribe,
  buildUnannounce,
  buildUnsubscribe,
  b as bytesToUuid,
  createEntityInfo3,
  decodeBytes,
  decodeString,
  decodeVarint,
  encodeBytes,
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
  threejsToPanaudia,
  unityToPanaudia,
  unrealToPanaudia,
  u as uuidToBytes,
  webglToAmbisonicPosition,
  webglToAmbisonicRotation,
  wrapError
};
//# sourceMappingURL=index.js.map
