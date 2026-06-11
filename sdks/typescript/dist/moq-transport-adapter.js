import { a as ConnectionState, E as ENTITY_INFO3_SIZE, f as entityInfo3FromBytes, T as TopicMerger, C as CacheMap, c as createEntityInfo3, g as entityInfo3ToBytes } from "./topic-merger.js";
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
function captureCapacityFrames() {
  return 2048;
}
class CaptureRing {
  nc;
  capacity;
  data;
  wpCell;
  rpCell;
  /** Count of quanta dropped because the consumer stalled past capacity (§5.1). */
  overflows;
  constructor(cfg) {
    const nc = cfg.numChannels ?? 1;
    const capacity = cfg.capacityFrames ?? 2048;
    if (nc < 1) {
      throw new Error("CaptureRing: numChannels must be >= 1");
    }
    if (capacity < 1) {
      throw new Error("CaptureRing: capacityFrames must be >= 1");
    }
    if (cfg.sharedStorage.length !== capacity * nc) {
      throw new Error(
        `CaptureRing: sharedStorage length ${cfg.sharedStorage.length} != capacity*nc ${capacity * nc} (allocate capacityFrames * numChannels floats)`
      );
    }
    if (cfg.sharedWritePos.length < 1 || cfg.sharedReadPos.length < 1) {
      throw new Error("CaptureRing: sharedWritePos/sharedReadPos must be length-1 BigInt64Arrays");
    }
    this.nc = nc;
    this.capacity = capacity;
    this.data = cfg.sharedStorage;
    this.wpCell = cfg.sharedWritePos;
    this.rpCell = cfg.sharedReadPos;
    this.overflows = 0;
  }
  /** Cumulative producer position (frames), acquire-loaded. */
  get writePos() {
    return Number(Atomics.load(this.wpCell, 0));
  }
  /** Cumulative consumer position (frames), acquire-loaded. */
  get readPos() {
    return Number(Atomics.load(this.rpCell, 0));
  }
  /** Current fill in frames (unambiguous: positions are cumulative). */
  fillFrames() {
    return this.writePos - this.readPos;
  }
  /**
   * PRODUCER (capture worklet). Interleave one render quantum of planar channels into
   * the ring. `planar[ch]` is a Float32Array of `nFrames` samples (Web Audio is
   * planar; all channels equal length). Channels beyond `planar.length` reuse the last
   * (mono→stereo dup); channels beyond `nc` are ignored. If the consumer has stalled
   * and the quantum would not fit, the WHOLE quantum is dropped and `overflows` is
   * bumped — never blocks, never overwrites unread data (§5.1). Returns true if written.
   */
  write(planar) {
    if (!planar || planar.length === 0 || !planar[0]) {
      return false;
    }
    const nc = this.nc;
    const cap = this.capacity;
    const nFrames = planar[0].length;
    if (nFrames === 0) {
      return false;
    }
    const wp = this.writePos;
    const rp = this.readPos;
    if (wp - rp + nFrames > cap) {
      this.overflows++;
      return false;
    }
    const data = this.data;
    const startFrame = wp % cap;
    for (let i = 0; i < nFrames; i++) {
      const ringBase = (startFrame + i) % cap * nc;
      for (let ch = 0; ch < nc; ch++) {
        const src = planar[ch < planar.length ? ch : planar.length - 1];
        data[ringBase + ch] = src[i];
      }
    }
    Atomics.store(this.wpCell, 0, BigInt(wp + nFrames));
    return true;
  }
  /**
   * CONSUMER (MOQ worker). Copy all whole frames currently available into `dst`
   * (interleaved), up to `dst`'s capacity, then free that space. Returns the number of
   * interleaved SAMPLES written (`frames * nc`), or 0 if nothing was ready. Drain to
   * empty: leaves only what the producer hasn't yet published.
   */
  drain(dst) {
    const nc = this.nc;
    const cap = this.capacity;
    const wp = this.writePos;
    const rp = this.readPos;
    const avail = wp - rp;
    const room = Math.floor(dst.length / nc);
    const nFrames = avail < room ? avail : room;
    if (nFrames <= 0) {
      return 0;
    }
    const data = this.data;
    const startFrame = rp % cap;
    if (startFrame + nFrames <= cap) {
      dst.set(data.subarray(startFrame * nc, (startFrame + nFrames) * nc));
    } else {
      const first = cap - startFrame;
      dst.set(data.subarray(startFrame * nc, cap * nc), 0);
      dst.set(data.subarray(0, (nFrames - first) * nc), first * nc);
    }
    Atomics.store(this.rpCell, 0, BigInt(rp + nFrames));
    return nFrames * nc;
  }
}
const CAPTURE_PROCESSOR_NAME = "capture-processor";
const CAPTURE_PROCESSOR_SOURCE = `
class CaptureRingProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.signal = opts.signal;
    this.ring = new CaptureRing({
      numChannels: opts.numChannels,
      capacityFrames: opts.capacityFrames,
      sharedStorage: opts.sharedStorage,
      sharedWritePos: opts.sharedWritePos,
      sharedReadPos: opts.sharedReadPos,
    });
  }

  // PRODUCER: interleave the input quantum into the ring; wake the worker if we wrote.
  // inputs[0] is the planar input (array of per-channel Float32Arrays); empty when no
  // source is connected. CaptureRing.write guards the empty/overflow cases.
  process(inputs) {
    const input = inputs[0];
    if (input && this.ring.write(input)) {
      // Clock-free wake (design §6.1): bump + notify the signal cell. One bounded
      // futex wake, one waiter (the MOQ worker's Atomics.waitAsync). Real-time-safe:
      // no allocation, no lock, the caller never blocks.
      Atomics.add(this.signal, 0, 1);
      Atomics.notify(this.signal, 0, 1);
    }
    return true; // keep the processor alive
  }
}
registerProcessor(${JSON.stringify(CAPTURE_PROCESSOR_NAME)}, CaptureRingProcessor);
`;
function buildCaptureWorkletCode() {
  const coreSource = CaptureRing.toString();
  if (!coreSource.startsWith("class")) {
    throw new Error("capture-worklet: CaptureRing.toString() is not a class declaration");
  }
  const helper = /\b__(publicField|privateField|decorateClass|decorateParam|name|esDecorate)\b/.exec(coreSource);
  if (helper) {
    throw new Error(
      `capture-worklet: serialized CaptureRing references the bundler helper "${helper[0]}" — it would be undefined in the worklet. Ensure the build keeps native class output.`
    );
  }
  return `const CaptureRing = ${coreSource};
${CAPTURE_PROCESSOR_SOURCE}`;
}
function createCaptureWorkletUrl() {
  const blob2 = new Blob([buildCaptureWorkletCode()], { type: "application/javascript" });
  return URL.createObjectURL(blob2);
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
  const mimeTypes = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
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
  const mimeTypes = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
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
  // Capture half of the Web Audio graph (main thread).
  audioContext = null;
  sourceNode = null;
  workletNode = null;
  // SAB ring shared with the worklet (producer) and the worker (consumer).
  sharedStorage = null;
  sharedWritePos = null;
  sharedReadPos = null;
  sharedSignal = null;
  numChannels;
  capacityFrames;
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
    this.numChannels = this.config.channelCount;
    this.capacityFrames = captureCapacityFrames();
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * The Opus encoder config the worker should use (worker constructs WebCodecs
   * AudioEncoder from this). Matches the capture sample rate / channel count.
   */
  getEncoderConfig() {
    return {
      codec: "opus",
      sampleRate: this.config.sampleRate,
      numberOfChannels: this.config.channelCount,
      bitrate: this.config.bitrate,
      frameDurationUs: Math.round(this.config.frameDurationMs * 1e3)
    };
  }
  /**
   * The shared capture ring + geometry to hand to the worker, or null if capture is
   * not running / the SAB could not be allocated (not cross-origin isolated).
   */
  getCaptureHandoff() {
    if (!this.sharedStorage || !this.sharedWritePos || !this.sharedReadPos || !this.sharedSignal) {
      return null;
    }
    return {
      numChannels: this.numChannels,
      capacityFrames: this.capacityFrames,
      sharedStorage: this.sharedStorage,
      sharedWritePos: this.sharedWritePos,
      sharedReadPos: this.sharedReadPos,
      sharedSignal: this.sharedSignal
    };
  }
  /**
   * Request microphone access and prepare for capture.
   */
  async initialize() {
    if (this.state !== "idle") {
      throw new MoqClientError(`Cannot initialize: already in state ${this.state}`, "INVALID_STATE");
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new AudioNotSupportedError("getUserMedia is not supported in this browser");
    }
    if (!isWebCodecsOpusSupported()) {
      throw new AudioNotSupportedError(
        "WebCodecs Opus encoding is not supported in this browser. Try Chrome, Edge, Firefox, or Safari 26.4+."
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
          throw new AudioPermissionError("No microphone found. Please connect a microphone and try again.", error);
        } else if (error.name === "NotReadableError") {
          throw new AudioPermissionError("Microphone is in use by another application.", error);
        }
      }
      throw new AudioPermissionError(`Failed to access microphone: ${error}`, error);
    }
  }
  /**
   * Start capturing: build the AudioContext + capture worklet and allocate the SAB
   * ring the worklet fills. Requires cross-origin isolation (the SAB is mandatory —
   * there is no main-thread-encode fallback).
   */
  async start() {
    if (this.state !== "ready" && this.state !== "paused") {
      throw new MoqClientError(
        `Cannot start: must be in READY or PAUSED state, currently ${this.state}`,
        "INVALID_STATE"
      );
    }
    if (!this.mediaStream) {
      throw new MoqClientError("No media stream available", "INVALID_STATE");
    }
    if (typeof SharedArrayBuffer === "undefined" || globalThis.crossOriginIsolated !== true) {
      throw new AudioNotSupportedError(
        "Microphone capture requires cross-origin isolation (COOP/COEP) for the SharedArrayBuffer ring"
      );
    }
    if (typeof AudioWorkletNode === "undefined") {
      throw new AudioNotSupportedError("AudioWorklet is not supported in this browser");
    }
    if (this.state === "paused" && this.audioContext && this.sourceNode && this.workletNode) {
      this.sourceNode.connect(this.workletNode);
      this.setState(
        "recording"
        /* RECORDING */
      );
      this.log("Microphone resumed");
      return;
    }
    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
    const url = createCaptureWorkletUrl();
    try {
      await this.audioContext.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const nc = this.numChannels;
    const cap = this.capacityFrames;
    this.sharedStorage = new Float32Array(new SharedArrayBuffer(cap * nc * 4));
    this.sharedWritePos = new BigInt64Array(new SharedArrayBuffer(8));
    this.sharedReadPos = new BigInt64Array(new SharedArrayBuffer(8));
    this.sharedSignal = new Int32Array(new SharedArrayBuffer(4));
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, CAPTURE_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: {
        numChannels: nc,
        capacityFrames: cap,
        sharedStorage: this.sharedStorage,
        sharedWritePos: this.sharedWritePos,
        sharedReadPos: this.sharedReadPos,
        signal: this.sharedSignal
      }
    });
    this.sourceNode.connect(this.workletNode);
    this.setState(
      "recording"
      /* RECORDING */
    );
    this.log(`Capture started (SAB ring, ${nc}ch, capacity=${cap} frames)`);
  }
  /**
   * Pause capture: disconnect the mic from the worklet so the ring stops filling (the
   * worker then has nothing to encode). The graph + SAB are kept for resume.
   */
  pause() {
    if (this.state !== "recording") {
      return;
    }
    if (this.sourceNode && this.workletNode) {
      try {
        this.sourceNode.disconnect(this.workletNode);
      } catch {
      }
    }
    this.setState(
      "paused"
      /* PAUSED */
    );
    this.log("Microphone paused");
  }
  /**
   * Resume capture (reconnect the mic to the worklet).
   */
  resume() {
    if (this.state !== "paused") {
      return;
    }
    if (this.sourceNode && this.workletNode) {
      this.sourceNode.connect(this.workletNode);
      this.setState(
        "recording"
        /* RECORDING */
      );
      this.log("Microphone resumed");
    }
  }
  /**
   * Enable or disable the mic tracks. Disabling makes the source emit silent samples —
   * the capture graph + worker encoder stay alive, so MOQ frames keep flowing as Opus
   * DTX comfort-noise.
   */
  setMicEnabled(enabled) {
    if (!this.mediaStream) return;
    for (const track of this.mediaStream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }
  /**
   * Stop capturing: tear down the capture graph (keeps the media stream so it can be
   * restarted). The SAB views are released; the worker should be told to `stopCapture`.
   */
  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.sharedStorage = null;
    this.sharedWritePos = null;
    this.sharedReadPos = null;
    this.sharedSignal = null;
    if (this.state !== "idle" && this.state !== "error") {
      this.setState(
        "ready"
        /* READY */
      );
    }
  }
  /**
   * Release all resources (tears down the graph and stops the mic tracks).
   */
  dispose() {
    this.stop();
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    this.setState(
      "idle"
      /* IDLE */
    );
  }
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
  const sorted = [...params].sort((a, b) => a.type - b.type);
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
  for (let i = 0; i < Number(count); i++) {
    const { value: delta, bytesRead: deltaBytes } = decodeVarint(data, pos);
    pos += deltaBytes;
    const type = prev + Number(delta);
    prev = type;
    if (type % 2 === 1) {
      const { value: blob2, bytesRead: blobBytes } = decodeBytes(data, pos);
      pos += blobBytes;
      params.set(type, blob2);
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
function writeVarintInto(buf, offset, value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`writeVarintInto: value must be a non-negative integer, got ${value}`);
    }
    if (value < 64) {
      buf[offset] = value;
      return offset + 1;
    }
    if (value < 16384) {
      buf[offset] = value >> 8 | 64;
      buf[offset + 1] = value & 255;
      return offset + 2;
    }
    if (value < 1073741824) {
      buf[offset] = value >>> 24 | 128;
      buf[offset + 1] = value >>> 16 & 255;
      buf[offset + 2] = value >>> 8 & 255;
      buf[offset + 3] = value & 255;
      return offset + 4;
    }
    value = BigInt(value);
  }
  const n = value;
  if (n < 0n) {
    throw new RangeError(`writeVarintInto: value must be non-negative, got ${n}`);
  }
  if (n < 0x40n) {
    buf[offset] = Number(n);
    return offset + 1;
  }
  if (n < 0x4000n) {
    buf[offset] = Number(n >> 8n | 0x40n);
    buf[offset + 1] = Number(n & 0xffn);
    return offset + 2;
  }
  if (n < 0x40000000n) {
    buf[offset] = Number(n >> 24n | 0x80n);
    buf[offset + 1] = Number(n >> 16n & 0xffn);
    buf[offset + 2] = Number(n >> 8n & 0xffn);
    buf[offset + 3] = Number(n & 0xffn);
    return offset + 4;
  }
  buf[offset] = Number(n >> 56n | 0xc0n);
  buf[offset + 1] = Number(n >> 48n & 0xffn);
  buf[offset + 2] = Number(n >> 40n & 0xffn);
  buf[offset + 3] = Number(n >> 32n & 0xffn);
  buf[offset + 4] = Number(n >> 24n & 0xffn);
  buf[offset + 5] = Number(n >> 16n & 0xffn);
  buf[offset + 6] = Number(n >> 8n & 0xffn);
  buf[offset + 7] = Number(n & 0xffn);
  return offset + 8;
}
function maxObjectDatagramSize(maxPayload) {
  return 1 + 8 + 8 + 8 + 1 + maxPayload;
}
function encodeObjectDatagramInto(buf, trackAlias, groupId, objectId, publisherPriority, payload) {
  let pos = 0;
  pos = writeVarintInto(buf, pos, 0);
  pos = writeVarintInto(buf, pos, trackAlias);
  pos = writeVarintInto(buf, pos, groupId);
  pos = writeVarintInto(buf, pos, objectId);
  buf[pos++] = publisherPriority & 255;
  buf.set(payload, pos);
  return pos + payload.length;
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
    const g = decodeVarint(largest, 0);
    const o = decodeVarint(largest, g.bytesRead);
    result.largestGroupId = g.value;
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
  for (let i = 0; i < Number(nsLength); i++) {
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
  // DatagramReceiver surface (same names as MoqConnection) so subscribers can take
  // either. These are the public aliases of register()/unregister().
  registerDatagramHandler(trackAlias, handler) {
    this.register(trackAlias, handler);
  }
  unregisterDatagramHandler(trackAlias) {
    this.unregister(trackAlias);
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
  constructor(serverUrl, debug = false) {
    this.serverUrl = serverUrl;
    this.debug = debug;
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
      try {
        this.transport = await this.openTransport(wtOptions);
      } catch (firstError) {
        if (wtOptions.protocols === void 0) throw firstError;
        if (this.debug) {
          console.log(
            `[MOQ] WebTransport connect failed with protocols=${JSON.stringify(wtOptions.protocols)} (${String(firstError)}) — retrying without subprotocol negotiation`
          );
        }
        const { protocols: _omitted, ...withoutProtocols } = wtOptions;
        this.transport = await this.openTransport(withoutProtocols);
      }
      if (this.debug) {
        console.log(
          `[MOQ] WebTransport ready — negotiated subprotocol: ${JSON.stringify(this.getNegotiatedSubprotocol())}`
        );
      }
      this.setState(ConnectionState.CONNECTED);
    } catch (error) {
      this.setState(ConnectionState.ERROR, error);
      throw error;
    }
  }
  /**
   * Open one WebTransport and await `ready`; wires the close handler. On
   * failure the instance is discarded (closed defensively) so connect() can
   * retry with different options.
   */
  async openTransport(wtOptions) {
    const transport = new WebTransport(this.serverUrl, wtOptions);
    try {
      await transport.ready;
    } catch (error) {
      transport.closed.catch(() => void 0);
      try {
        transport.close();
      } catch {
      }
      throw error;
    }
    transport.closed.then((info) => {
      this.handleClose(info);
    }).catch((error) => {
      this.handleError(error);
    });
    return transport;
  }
  /**
   * The WebTransport subprotocol the server selected ('moqt-16' when draft-16
   * negotiation worked; empty/undefined on engines without subprotocol support).
   * Null before connect. Used by the stereo diagnostics snapshot.
   */
  getNegotiatedSubprotocol() {
    if (!this.transport) return null;
    return this.transport.protocol ?? null;
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
    if (data.length === 0) {
      return;
    }
    if (!this.datagramWriter) {
      const dg = this.transport.datagrams;
      const writable = dg.writable ?? dg.createWritable?.();
      if (!writable) {
        throw new Error("WebTransport datagrams are not writable in this browser");
      }
      this.datagramWriter = writable.getWriter();
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
class MoqWorkerClient {
  constructor(worker, onEvent) {
    this.worker = worker;
    this.worker.onmessage = (e) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.kind === "res") {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.result);
        else p.reject(new Error(msg.error));
      } else if (msg.kind === "evt") {
        onEvent(msg);
      }
    };
  }
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  /** Issue an RPC and resolve with its result. `transfer` moves buffers into the worker. */
  call(method, args, transfer) {
    const id = this.nextId++;
    const req = { kind: "req", id, method, args };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage(req, transfer ?? []);
      } catch (e) {
        this.pending.delete(id);
        reject(e);
      }
    });
  }
  /** Terminate the worker and reject any in-flight calls. */
  dispose() {
    for (const { reject } of this.pending.values()) reject(new Error("worker disposed"));
    this.pending.clear();
    this.worker.terminate();
  }
}
const jsContent = 'var ConnectionState = /* @__PURE__ */ ((ConnectionState2) => {\n  ConnectionState2["DISCONNECTED"] = "disconnected";\n  ConnectionState2["CONNECTING"] = "connecting";\n  ConnectionState2["CONNECTED"] = "connected";\n  ConnectionState2["AUTHENTICATED"] = "authenticated";\n  ConnectionState2["ERROR"] = "error";\n  return ConnectionState2;\n})(ConnectionState || {});\nvar MoqMessageType = /* @__PURE__ */ ((MoqMessageType2) => {\n  MoqMessageType2[MoqMessageType2["CLIENT_SETUP"] = 32] = "CLIENT_SETUP";\n  MoqMessageType2[MoqMessageType2["SERVER_SETUP"] = 33] = "SERVER_SETUP";\n  MoqMessageType2[MoqMessageType2["ANNOUNCE"] = 6] = "ANNOUNCE";\n  MoqMessageType2[MoqMessageType2["ANNOUNCE_OK"] = 7] = "ANNOUNCE_OK";\n  MoqMessageType2[MoqMessageType2["ANNOUNCE_ERROR"] = 8] = "ANNOUNCE_ERROR";\n  MoqMessageType2[MoqMessageType2["UNANNOUNCE"] = 9] = "UNANNOUNCE";\n  MoqMessageType2[MoqMessageType2["SUBSCRIBE"] = 3] = "SUBSCRIBE";\n  MoqMessageType2[MoqMessageType2["SUBSCRIBE_OK"] = 4] = "SUBSCRIBE_OK";\n  MoqMessageType2[MoqMessageType2["SUBSCRIBE_ERROR"] = 5] = "SUBSCRIBE_ERROR";\n  MoqMessageType2[MoqMessageType2["UNSUBSCRIBE"] = 10] = "UNSUBSCRIBE";\n  MoqMessageType2[MoqMessageType2["SUBSCRIBE_DONE"] = 11] = "SUBSCRIBE_DONE";\n  MoqMessageType2[MoqMessageType2["OBJECT_STREAM"] = 0] = "OBJECT_STREAM";\n  MoqMessageType2[MoqMessageType2["OBJECT_DATAGRAM"] = 1] = "OBJECT_DATAGRAM";\n  MoqMessageType2[MoqMessageType2["GOAWAY"] = 16] = "GOAWAY";\n  return MoqMessageType2;\n})(MoqMessageType || {});\nvar MoqSetupParameter = /* @__PURE__ */ ((MoqSetupParameter2) => {\n  MoqSetupParameter2[MoqSetupParameter2["ROLE"] = 0] = "ROLE";\n  MoqSetupParameter2[MoqSetupParameter2["PATH"] = 1] = "PATH";\n  MoqSetupParameter2[MoqSetupParameter2["MAX_SUBSCRIBE_ID"] = 2] = "MAX_SUBSCRIBE_ID";\n  return MoqSetupParameter2;\n})(MoqSetupParameter || {});\nvar MoqFilterType = /* @__PURE__ */ ((MoqFilterType2) => {\n  MoqFilterType2[MoqFilterType2["LATEST_GROUP"] = 1] = "LATEST_GROUP";\n  MoqFilterType2[MoqFilterType2["LATEST_OBJECT"] = 2] = "LATEST_OBJECT";\n  MoqFilterType2[MoqFilterType2["ABSOLUTE_START"] = 3] = "ABSOLUTE_START";\n  MoqFilterType2[MoqFilterType2["ABSOLUTE_RANGE"] = 4] = "ABSOLUTE_RANGE";\n  return MoqFilterType2;\n})(MoqFilterType || {});\nvar MoqGroupOrder = /* @__PURE__ */ ((MoqGroupOrder2) => {\n  MoqGroupOrder2[MoqGroupOrder2["NONE"] = 0] = "NONE";\n  MoqGroupOrder2[MoqGroupOrder2["ASCENDING"] = 1] = "ASCENDING";\n  MoqGroupOrder2[MoqGroupOrder2["DESCENDING"] = 2] = "DESCENDING";\n  return MoqGroupOrder2;\n})(MoqGroupOrder || {});\nfunction encodeVarint(value) {\n  const n = BigInt(value);\n  if (n < 64n) {\n    return new Uint8Array([Number(n)]);\n  } else if (n < 16384n) {\n    return new Uint8Array([Number(n >> 8n | 0x40n), Number(n & 0xffn)]);\n  } else if (n < 1073741824n) {\n    return new Uint8Array([\n      Number(n >> 24n | 0x80n),\n      Number(n >> 16n & 0xffn),\n      Number(n >> 8n & 0xffn),\n      Number(n & 0xffn)\n    ]);\n  } else {\n    return new Uint8Array([\n      Number(n >> 56n | 0xc0n),\n      Number(n >> 48n & 0xffn),\n      Number(n >> 40n & 0xffn),\n      Number(n >> 32n & 0xffn),\n      Number(n >> 24n & 0xffn),\n      Number(n >> 16n & 0xffn),\n      Number(n >> 8n & 0xffn),\n      Number(n & 0xffn)\n    ]);\n  }\n}\nfunction decodeVarint(data, offset = 0) {\n  if (offset >= data.length) {\n    throw new Error("Not enough data to decode varint");\n  }\n  const firstByte = data[offset];\n  const prefix = firstByte >> 6;\n  switch (prefix) {\n    case 0: {\n      return { value: BigInt(firstByte), bytesRead: 1 };\n    }\n    case 1: {\n      if (offset + 2 > data.length) {\n        throw new Error("Not enough data for 2-byte varint");\n      }\n      const value = BigInt((firstByte & 63) << 8) | BigInt(data[offset + 1]);\n      return { value, bytesRead: 2 };\n    }\n    case 2: {\n      if (offset + 4 > data.length) {\n        throw new Error("Not enough data for 4-byte varint");\n      }\n      const value = BigInt(firstByte & 63) << 24n | BigInt(data[offset + 1]) << 16n | BigInt(data[offset + 2]) << 8n | BigInt(data[offset + 3]);\n      return { value, bytesRead: 4 };\n    }\n    case 3: {\n      if (offset + 8 > data.length) {\n        throw new Error("Not enough data for 8-byte varint");\n      }\n      const value = BigInt(firstByte & 63) << 56n | BigInt(data[offset + 1]) << 48n | BigInt(data[offset + 2]) << 40n | BigInt(data[offset + 3]) << 32n | BigInt(data[offset + 4]) << 24n | BigInt(data[offset + 5]) << 16n | BigInt(data[offset + 6]) << 8n | BigInt(data[offset + 7]);\n      return { value, bytesRead: 8 };\n    }\n    default:\n      throw new Error("Invalid varint prefix");\n  }\n}\nconst textEncoder = new TextEncoder();\nconst textDecoder = new TextDecoder();\nfunction encodeString(str) {\n  const bytes = textEncoder.encode(str);\n  const lengthBytes = encodeVarint(bytes.length);\n  const result = new Uint8Array(lengthBytes.length + bytes.length);\n  result.set(lengthBytes, 0);\n  result.set(bytes, lengthBytes.length);\n  return result;\n}\nfunction decodeString(data, offset = 0) {\n  const { value: length, bytesRead: lengthBytes } = decodeVarint(data, offset);\n  const stringLength = Number(length);\n  const stringStart = offset + lengthBytes;\n  const stringEnd = stringStart + stringLength;\n  if (stringEnd > data.length) {\n    throw new Error("Not enough data for string");\n  }\n  const value = textDecoder.decode(data.subarray(stringStart, stringEnd));\n  return { value, bytesRead: lengthBytes + stringLength };\n}\nfunction encodeBytes(bytes) {\n  const lengthBytes = encodeVarint(bytes.length);\n  const result = new Uint8Array(lengthBytes.length + bytes.length);\n  result.set(lengthBytes, 0);\n  result.set(bytes, lengthBytes.length);\n  return result;\n}\nfunction decodeBytes(data, offset = 0) {\n  const { value: length, bytesRead: lengthBytes } = decodeVarint(data, offset);\n  const bytesLength = Number(length);\n  const bytesStart = offset + lengthBytes;\n  const bytesEnd = bytesStart + bytesLength;\n  if (bytesEnd > data.length) {\n    throw new Error("Not enough data for bytes");\n  }\n  const value = data.subarray(bytesStart, bytesEnd);\n  return { value, bytesRead: lengthBytes + bytesLength };\n}\nclass MessageBuilder {\n  chunks = [];\n  totalLength = 0;\n  /**\n   * Append a varint to the message\n   */\n  writeVarint(value) {\n    const bytes = encodeVarint(value);\n    this.chunks.push(bytes);\n    this.totalLength += bytes.length;\n    return this;\n  }\n  /**\n   * Append a length-prefixed string to the message\n   */\n  writeString(str) {\n    const bytes = encodeString(str);\n    this.chunks.push(bytes);\n    this.totalLength += bytes.length;\n    return this;\n  }\n  /**\n   * Append length-prefixed bytes to the message\n   */\n  writeBytes(data) {\n    const bytes = encodeBytes(data);\n    this.chunks.push(bytes);\n    this.totalLength += bytes.length;\n    return this;\n  }\n  /**\n   * Append raw bytes (no length prefix) to the message\n   */\n  writeRaw(data) {\n    this.chunks.push(data);\n    this.totalLength += data.length;\n    return this;\n  }\n  /**\n   * Build the final message\n   */\n  build() {\n    const result = new Uint8Array(this.totalLength);\n    let offset = 0;\n    for (const chunk of this.chunks) {\n      result.set(chunk, offset);\n      offset += chunk.length;\n    }\n    return result;\n  }\n}\nfunction wrapWithLengthFrame(messageType, content) {\n  const typeBytes = encodeVarint(messageType);\n  const length = content.length;\n  const lengthBytes = new Uint8Array(2);\n  lengthBytes[0] = length >> 8 & 255;\n  lengthBytes[1] = length & 255;\n  const result = new Uint8Array(typeBytes.length + 2 + content.length);\n  result.set(typeBytes, 0);\n  result.set(lengthBytes, typeBytes.length);\n  result.set(content, typeBytes.length + 2);\n  return result;\n}\nfunction encodeParams(builder, params) {\n  const sorted = [...params].sort((a, b) => a.type - b.type);\n  builder.writeVarint(sorted.length);\n  let prev = 0;\n  for (const p of sorted) {\n    builder.writeVarint(p.type - prev);\n    prev = p.type;\n    if (p.type % 2 === 1) {\n      const bytes = p.value;\n      builder.writeVarint(bytes.length);\n      builder.writeRaw(bytes);\n    } else {\n      builder.writeVarint(p.value);\n    }\n  }\n}\nfunction decodeParams(data, offset = 0) {\n  let pos = offset;\n  const { value: count, bytesRead: countBytes } = decodeVarint(data, pos);\n  pos += countBytes;\n  const params = /* @__PURE__ */ new Map();\n  let prev = 0;\n  for (let i = 0; i < Number(count); i++) {\n    const { value: delta, bytesRead: deltaBytes } = decodeVarint(data, pos);\n    pos += deltaBytes;\n    const type = prev + Number(delta);\n    prev = type;\n    if (type % 2 === 1) {\n      const { value: blob, bytesRead: blobBytes } = decodeBytes(data, pos);\n      pos += blobBytes;\n      params.set(type, blob);\n    } else {\n      const { value: v, bytesRead: vBytes } = decodeVarint(data, pos);\n      pos += vBytes;\n      params.set(type, v);\n    }\n  }\n  return { params, bytesRead: pos - offset };\n}\nfunction buildClientSetup(_supportedVersions, _role, path, maxSubscribeId) {\n  const contentBuilder = new MessageBuilder();\n  const params = [];\n  if (path !== void 0) {\n    params.push({ type: MoqSetupParameter.PATH, value: textEncoder.encode(path) });\n  }\n  if (maxSubscribeId !== void 0) {\n    params.push({ type: MoqSetupParameter.MAX_SUBSCRIBE_ID, value: BigInt(maxSubscribeId) });\n  }\n  encodeParams(contentBuilder, params);\n  return wrapWithLengthFrame(MoqMessageType.CLIENT_SETUP, contentBuilder.build());\n}\nconst SUB_PARAM_FORWARD = 16;\nconst SUB_PARAM_PRIORITY = 32;\nconst SUB_PARAM_FILTER = 33;\nconst SUB_PARAM_GROUP_ORDER = 34;\nconst SUB_OK_PARAM_EXPIRES = 8;\nconst SUB_OK_PARAM_LARGEST = 9;\nconst PARAM_AUTHORIZATION = 3;\nconst PARAM_RESUME_HLC = 65281;\nfunction buildSubscribe(subscription) {\n  const contentBuilder = new MessageBuilder();\n  contentBuilder.writeVarint(subscription.subscribeId);\n  contentBuilder.writeVarint(subscription.namespace.length);\n  for (const part of subscription.namespace) {\n    contentBuilder.writeString(part);\n  }\n  contentBuilder.writeString(subscription.trackName);\n  const params = [];\n  params.push({ type: SUB_PARAM_PRIORITY, value: BigInt(subscription.subscriberPriority ?? 128) });\n  params.push({ type: SUB_PARAM_GROUP_ORDER, value: BigInt(subscription.groupOrder ?? MoqGroupOrder.ASCENDING) });\n  params.push({ type: SUB_PARAM_FORWARD, value: BigInt(subscription.forward ?? 1) });\n  const filterBuilder = new MessageBuilder();\n  filterBuilder.writeVarint(subscription.filterType);\n  params.push({ type: SUB_PARAM_FILTER, value: filterBuilder.build() });\n  if (subscription.authorization) {\n    params.push({ type: PARAM_AUTHORIZATION, value: textEncoder.encode(subscription.authorization) });\n  }\n  if (subscription.resumeOpId !== void 0 && subscription.resumeOpId > 0n) {\n    const opIdBuf = new Uint8Array(8);\n    new DataView(opIdBuf.buffer).setBigUint64(0, subscription.resumeOpId, false);\n    params.push({ type: PARAM_RESUME_HLC, value: opIdBuf });\n  }\n  encodeParams(contentBuilder, params);\n  return wrapWithLengthFrame(MoqMessageType.SUBSCRIBE, contentBuilder.build());\n}\nfunction buildAnnounce(announcement) {\n  const contentBuilder = new MessageBuilder();\n  contentBuilder.writeVarint(announcement.requestId);\n  contentBuilder.writeVarint(announcement.namespace.length);\n  for (const part of announcement.namespace) {\n    contentBuilder.writeString(part);\n  }\n  const params = [];\n  if (announcement.parameters) {\n    for (const [key, value] of announcement.parameters) {\n      params.push({ type: key, value });\n    }\n  }\n  encodeParams(contentBuilder, params);\n  return wrapWithLengthFrame(MoqMessageType.ANNOUNCE, contentBuilder.build());\n}\nfunction writeVarintInto(buf, offset, value) {\n  if (typeof value === "number") {\n    if (!Number.isInteger(value) || value < 0) {\n      throw new RangeError(`writeVarintInto: value must be a non-negative integer, got ${value}`);\n    }\n    if (value < 64) {\n      buf[offset] = value;\n      return offset + 1;\n    }\n    if (value < 16384) {\n      buf[offset] = value >> 8 | 64;\n      buf[offset + 1] = value & 255;\n      return offset + 2;\n    }\n    if (value < 1073741824) {\n      buf[offset] = value >>> 24 | 128;\n      buf[offset + 1] = value >>> 16 & 255;\n      buf[offset + 2] = value >>> 8 & 255;\n      buf[offset + 3] = value & 255;\n      return offset + 4;\n    }\n    value = BigInt(value);\n  }\n  const n = value;\n  if (n < 0n) {\n    throw new RangeError(`writeVarintInto: value must be non-negative, got ${n}`);\n  }\n  if (n < 0x40n) {\n    buf[offset] = Number(n);\n    return offset + 1;\n  }\n  if (n < 0x4000n) {\n    buf[offset] = Number(n >> 8n | 0x40n);\n    buf[offset + 1] = Number(n & 0xffn);\n    return offset + 2;\n  }\n  if (n < 0x40000000n) {\n    buf[offset] = Number(n >> 24n | 0x80n);\n    buf[offset + 1] = Number(n >> 16n & 0xffn);\n    buf[offset + 2] = Number(n >> 8n & 0xffn);\n    buf[offset + 3] = Number(n & 0xffn);\n    return offset + 4;\n  }\n  buf[offset] = Number(n >> 56n | 0xc0n);\n  buf[offset + 1] = Number(n >> 48n & 0xffn);\n  buf[offset + 2] = Number(n >> 40n & 0xffn);\n  buf[offset + 3] = Number(n >> 32n & 0xffn);\n  buf[offset + 4] = Number(n >> 24n & 0xffn);\n  buf[offset + 5] = Number(n >> 16n & 0xffn);\n  buf[offset + 6] = Number(n >> 8n & 0xffn);\n  buf[offset + 7] = Number(n & 0xffn);\n  return offset + 8;\n}\nfunction maxObjectDatagramSize(maxPayload) {\n  return 1 + 8 + 8 + 8 + 1 + maxPayload;\n}\nfunction encodeObjectDatagramInto(buf, trackAlias, groupId, objectId, publisherPriority, payload) {\n  let pos = 0;\n  pos = writeVarintInto(buf, pos, 0);\n  pos = writeVarintInto(buf, pos, trackAlias);\n  pos = writeVarintInto(buf, pos, groupId);\n  pos = writeVarintInto(buf, pos, objectId);\n  buf[pos++] = publisherPriority & 255;\n  buf.set(payload, pos);\n  return pos + payload.length;\n}\nfunction parseServerSetup(data, offset = 0) {\n  const { params } = decodeParams(data, offset);\n  const parameters = /* @__PURE__ */ new Map();\n  for (const [type, value] of params) {\n    parameters.set(type, value instanceof Uint8Array ? value : encodeVarint(value));\n  }\n  return {\n    selectedVersion: MOQ_TRANSPORT_VERSION,\n    parameters\n  };\n}\nfunction parseSubscribeOk(data, offset = 0) {\n  let pos = offset;\n  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);\n  pos += subIdBytes;\n  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);\n  pos += aliasBytes;\n  const { params } = decodeParams(data, pos);\n  const result = {\n    subscribeId: Number(subscribeId),\n    trackAlias: Number(trackAlias),\n    expires: 0n,\n    groupOrder: 0,\n    contentExists: false\n  };\n  const expires = params.get(SUB_OK_PARAM_EXPIRES);\n  if (typeof expires === "bigint") result.expires = expires;\n  const groupOrder = params.get(SUB_PARAM_GROUP_ORDER);\n  if (typeof groupOrder === "bigint") result.groupOrder = Number(groupOrder);\n  const largest = params.get(SUB_OK_PARAM_LARGEST);\n  if (largest instanceof Uint8Array) {\n    result.contentExists = true;\n    const g = decodeVarint(largest, 0);\n    const o = decodeVarint(largest, g.bytesRead);\n    result.largestGroupId = g.value;\n    result.largestObjectId = o.value;\n  }\n  return result;\n}\nfunction parseSubscribeError(data, offset = 0) {\n  let pos = offset;\n  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);\n  pos += subIdBytes;\n  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);\n  pos += errorCodeBytes;\n  const { bytesRead: retryBytes } = decodeVarint(data, pos);\n  pos += retryBytes;\n  const { value: reasonPhrase } = decodeString(data, pos);\n  return {\n    subscribeId: Number(subscribeId),\n    errorCode: Number(errorCode),\n    reasonPhrase,\n    trackAlias: 0\n  };\n}\nfunction parseAnnounceOk(data, offset = 0) {\n  const { value: requestId } = decodeVarint(data, offset);\n  return { requestId: Number(requestId) };\n}\nfunction parseAnnounceError(data, offset = 0) {\n  let pos = offset;\n  const { value: nsLength, bytesRead: nsLengthBytes } = decodeVarint(data, pos);\n  pos += nsLengthBytes;\n  const namespace = [];\n  for (let i = 0; i < Number(nsLength); i++) {\n    const { value: part, bytesRead: partBytes } = decodeString(data, pos);\n    pos += partBytes;\n    namespace.push(part);\n  }\n  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);\n  pos += errorCodeBytes;\n  const { value: reasonPhrase, bytesRead: reasonBytes } = decodeString(data, pos);\n  pos += reasonBytes;\n  return {\n    namespace,\n    errorCode: Number(errorCode),\n    reasonPhrase\n  };\n}\nfunction parseObjectDatagram(data, offset = 0) {\n  let pos = offset;\n  const { value: _type, bytesRead: typeBytes } = decodeVarint(data, pos);\n  pos += typeBytes;\n  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);\n  pos += aliasBytes;\n  const { value: groupId, bytesRead: groupIdBytes } = decodeVarint(data, pos);\n  pos += groupIdBytes;\n  const { value: objectId, bytesRead: objectIdBytes } = decodeVarint(data, pos);\n  pos += objectIdBytes;\n  if (pos >= data.length) {\n    throw new Error("Not enough data for publisher priority");\n  }\n  const publisherPriority = data[pos];\n  pos += 1;\n  const payload = data.subarray(pos);\n  return {\n    trackAlias: Number(trackAlias),\n    groupId,\n    objectId,\n    publisherPriority,\n    payload\n  };\n}\nconst MOQ_TRANSPORT_VERSION = 4278190080 + 16;\nconst PENDING_DATAGRAM_MAX_BYTES = 1 * 1024 * 1024;\nclass DatagramRouter {\n  handlers = /* @__PURE__ */ new Map();\n  // Pre-handler buffer, FIFO across all aliases; oldest dropped when the byte cap\n  // is exceeded. Cleared on clear().\n  pending = [];\n  pendingBytes = 0;\n  /**\n   * Register a handler for a track alias and drain any datagrams that arrived for\n   * it before registration (the SUBSCRIBE_OK race), in arrival order.\n   */\n  register(trackAlias, handler) {\n    this.handlers.set(trackAlias, handler);\n    if (this.pending.length > 0) this.drainForAlias(trackAlias, handler);\n  }\n  /** Unregister a handler and discard any still-buffered datagrams for its alias. */\n  unregister(trackAlias) {\n    this.handlers.delete(trackAlias);\n    if (this.pending.length > 0) this.discardForAlias(trackAlias);\n  }\n  /** Route a parsed datagram to its handler, or buffer it if none is registered yet. */\n  ingest(d) {\n    const handler = this.handlers.get(d.trackAlias);\n    if (handler) {\n      handler(d.payload, d.trackAlias, d.groupId, d.objectId);\n    } else {\n      this.bufferUnknown(d);\n    }\n  }\n  // DatagramReceiver surface (same names as MoqConnection) so subscribers can take\n  // either. These are the public aliases of register()/unregister().\n  registerDatagramHandler(trackAlias, handler) {\n    this.register(trackAlias, handler);\n  }\n  unregisterDatagramHandler(trackAlias) {\n    this.unregister(trackAlias);\n  }\n  /** Number of buffered pre-handler datagrams (tests/diagnostics). */\n  pendingCount() {\n    return this.pending.length;\n  }\n  /** Drop all handlers + buffered datagrams (connection close). */\n  clear() {\n    this.handlers.clear();\n    this.pending = [];\n    this.pendingBytes = 0;\n  }\n  drainForAlias(trackAlias, handler) {\n    const remaining = [];\n    let drainedBytes = 0;\n    for (const d of this.pending) {\n      if (d.trackAlias === trackAlias) {\n        try {\n          handler(d.payload, d.trackAlias, d.groupId, d.objectId);\n        } catch {\n        }\n        drainedBytes += d.payload.length;\n      } else {\n        remaining.push(d);\n      }\n    }\n    this.pending = remaining;\n    this.pendingBytes -= drainedBytes;\n  }\n  discardForAlias(trackAlias) {\n    const remaining = [];\n    let discardedBytes = 0;\n    for (const d of this.pending) {\n      if (d.trackAlias === trackAlias) {\n        discardedBytes += d.payload.length;\n      } else {\n        remaining.push(d);\n      }\n    }\n    this.pending = remaining;\n    this.pendingBytes -= discardedBytes;\n  }\n  bufferUnknown(d) {\n    this.pending.push(d);\n    this.pendingBytes += d.payload.length;\n    while (this.pendingBytes > PENDING_DATAGRAM_MAX_BYTES && this.pending.length > 0) {\n      const dropped = this.pending.shift();\n      this.pendingBytes -= dropped.payload.length;\n    }\n  }\n}\nclass MoqConnection {\n  constructor(serverUrl, debug = false) {\n    this.serverUrl = serverUrl;\n    this.debug = debug;\n  }\n  transport = null;\n  state = ConnectionState.DISCONNECTED;\n  handlers = {};\n  datagramWriter = null;\n  // Datagram dispatcher: the read loop lives here (transport concern); the\n  // trackAlias→handler routing + SUBSCRIBE_OK race buffer live in the router\n  // (Phase 1 extraction — worker-transport-plan.md).\n  router = new DatagramRouter();\n  datagramDispatcherRunning = false;\n  // \'main\' = this class reads the datagram readable directly (default/fallback).\n  // \'worker\' = the receive Worker owns the read loop (design §11.4); the main\n  // dispatcher is suppressed and parsed non-audio datagrams arrive via\n  // ingestForwardedDatagram(), still routed through the same DatagramRouter\n  // (handler map + SUBSCRIBE_OK race buffer), unchanged.\n  datagramMode = "main";\n  /**\n   * Get current connection state\n   */\n  getState() {\n    return this.state;\n  }\n  /**\n   * Get the underlying WebTransport instance\n   */\n  getTransport() {\n    return this.transport;\n  }\n  /**\n   * Set event handlers\n   */\n  setHandlers(handlers) {\n    this.handlers = { ...this.handlers, ...handlers };\n  }\n  /**\n   * Connect to the MOQ server via WebTransport\n   */\n  async connect(options) {\n    if (this.state !== ConnectionState.DISCONNECTED) {\n      throw new Error(`Cannot connect: already in state ${this.state}`);\n    }\n    this.setState(ConnectionState.CONNECTING);\n    try {\n      const wtOptions = {\n        allowPooling: false,\n        requireUnreliable: true,\n        // We use datagrams for audio\n        congestionControl: "low-latency",\n        // Negotiate the MOQ draft-16 subprotocol over WebTransport so the server\n        // selects draft-16 (it falls back to draft-14 if no subprotocol is set).\n        protocols: ["moqt-16"],\n        ...options\n      };\n      try {\n        this.transport = await this.openTransport(wtOptions);\n      } catch (firstError) {\n        if (wtOptions.protocols === void 0) throw firstError;\n        if (this.debug) {\n          console.log(\n            `[MOQ] WebTransport connect failed with protocols=${JSON.stringify(wtOptions.protocols)} (${String(firstError)}) — retrying without subprotocol negotiation`\n          );\n        }\n        const { protocols: _omitted, ...withoutProtocols } = wtOptions;\n        this.transport = await this.openTransport(withoutProtocols);\n      }\n      if (this.debug) {\n        console.log(\n          `[MOQ] WebTransport ready — negotiated subprotocol: ${JSON.stringify(this.getNegotiatedSubprotocol())}`\n        );\n      }\n      this.setState(ConnectionState.CONNECTED);\n    } catch (error) {\n      this.setState(ConnectionState.ERROR, error);\n      throw error;\n    }\n  }\n  /**\n   * Open one WebTransport and await `ready`; wires the close handler. On\n   * failure the instance is discarded (closed defensively) so connect() can\n   * retry with different options.\n   */\n  async openTransport(wtOptions) {\n    const transport = new WebTransport(this.serverUrl, wtOptions);\n    try {\n      await transport.ready;\n    } catch (error) {\n      transport.closed.catch(() => void 0);\n      try {\n        transport.close();\n      } catch {\n      }\n      throw error;\n    }\n    transport.closed.then((info) => {\n      this.handleClose(info);\n    }).catch((error) => {\n      this.handleError(error);\n    });\n    return transport;\n  }\n  /**\n   * The WebTransport subprotocol the server selected (\'moqt-16\' when draft-16\n   * negotiation worked; empty/undefined on engines without subprotocol support).\n   * Null before connect. Used by the stereo diagnostics snapshot.\n   */\n  getNegotiatedSubprotocol() {\n    if (!this.transport) return null;\n    return this.transport.protocol ?? null;\n  }\n  /**\n   * Close the connection gracefully\n   */\n  close(closeInfo) {\n    this.datagramDispatcherRunning = false;\n    this.datagramMode = "main";\n    this.router.clear();\n    if (this.datagramWriter) {\n      this.datagramWriter.releaseLock();\n      this.datagramWriter = null;\n    }\n    if (this.transport) {\n      this.transport.close(closeInfo);\n      this.transport = null;\n    }\n    this.setState(ConnectionState.DISCONNECTED);\n  }\n  /**\n   * Create a bidirectional stream for the MOQ control channel\n   */\n  async createControlStream() {\n    if (!this.transport) {\n      throw new Error("Not connected");\n    }\n    return this.transport.createBidirectionalStream();\n  }\n  /**\n   * Create a unidirectional stream for sending data\n   */\n  async createSendStream() {\n    if (!this.transport) {\n      throw new Error("Not connected");\n    }\n    return this.transport.createUnidirectionalStream();\n  }\n  /**\n   * Get the incoming unidirectional streams reader\n   */\n  getIncomingStreams() {\n    if (!this.transport) {\n      throw new Error("Not connected");\n    }\n    return this.transport.incomingUnidirectionalStreams;\n  }\n  /**\n   * Get the datagram writer/reader for audio frames\n   */\n  getDatagrams() {\n    if (!this.transport) {\n      throw new Error("Not connected");\n    }\n    return this.transport.datagrams;\n  }\n  /**\n   * Get a reader for incoming datagrams\n   */\n  getDatagramReader() {\n    if (!this.transport) {\n      return null;\n    }\n    return this.transport.datagrams.readable.getReader();\n  }\n  /**\n   * Send a datagram (used for audio frames)\n   */\n  async sendDatagram(data) {\n    if (!this.transport) {\n      throw new Error("Not connected");\n    }\n    if (data.length === 0) {\n      return;\n    }\n    if (!this.datagramWriter) {\n      const dg = this.transport.datagrams;\n      const writable = dg.writable ?? dg.createWritable?.();\n      if (!writable) {\n        throw new Error("WebTransport datagrams are not writable in this browser");\n      }\n      this.datagramWriter = writable.getWriter();\n    }\n    try {\n      await this.datagramWriter.write(data);\n    } catch (error) {\n      try {\n        this.datagramWriter.releaseLock();\n      } catch {\n      }\n      this.datagramWriter = null;\n      throw error;\n    }\n  }\n  /**\n   * Switch to worker datagram mode (design §11.4): the receive Worker reads the\n   * datagram readable, so the main dispatcher must NOT. Returns the unlocked\n   * `datagrams.readable` for transfer into the worker. Must be called before any\n   * `registerDatagramHandler` (which would otherwise start the main dispatcher\n   * and lock the stream). Returns null if not connected.\n   */\n  takeDatagramReadableForWorker() {\n    if (!this.transport) return null;\n    if (this.datagramDispatcherRunning) {\n      throw new Error("Cannot switch to worker datagram mode: main dispatcher already reading");\n    }\n    this.datagramMode = "worker";\n    return this.transport.datagrams.readable;\n  }\n  /**\n   * Revert to main datagram mode if worker setup failed before locking the\n   * stream (so a later registerDatagramHandler starts the main dispatcher).\n   */\n  revertToMainDatagramMode() {\n    this.datagramMode = "main";\n  }\n  /**\n   * Feed a parsed datagram forwarded from the receive Worker through the normal\n   * dispatch path (handlers map + SUBSCRIBE_OK pending buffer). The worker only\n   * forwards non-audio tracks; audio is decoded in the worker and never arrives\n   * here.\n   */\n  ingestForwardedDatagram(trackAlias, payload, groupId, objectId) {\n    this.router.ingest({ trackAlias, payload, groupId, objectId });\n  }\n  /**\n   * Register a datagram handler for a specific track alias. Starts the dispatcher\n   * on first registration (transport concern); the router drains any datagrams\n   * that arrived for this alias before registration (the SUBSCRIBE_OK race).\n   */\n  registerDatagramHandler(trackAlias, handler) {\n    if (!this.datagramDispatcherRunning) {\n      this.startDatagramDispatcher();\n    }\n    this.router.register(trackAlias, handler);\n  }\n  /** Unregister a datagram handler; the router discards any still-buffered datagrams for it. */\n  unregisterDatagramHandler(trackAlias) {\n    this.router.unregister(trackAlias);\n  }\n  /**\n   * Number of buffered pre-handler datagrams currently held. Exposed for tests and\n   * diagnostics; production callers shouldn\'t need it.\n   */\n  getPendingDatagramCount() {\n    return this.router.pendingCount();\n  }\n  /**\n   * Start the single datagram reader loop that dispatches to handlers by track alias\n   */\n  startDatagramDispatcher() {\n    if (this.datagramMode === "worker") {\n      return;\n    }\n    if (this.datagramDispatcherRunning || !this.transport) {\n      return;\n    }\n    this.datagramDispatcherRunning = true;\n    const reader = this.transport.datagrams.readable.getReader();\n    const loop = async () => {\n      try {\n        while (this.datagramDispatcherRunning) {\n          const { value, done } = await reader.read();\n          if (done) break;\n          if (!value) continue;\n          try {\n            const parsed = parseObjectDatagram(value);\n            this.router.ingest(parsed);\n          } catch {\n          }\n        }\n      } catch (error) {\n        if (this.datagramDispatcherRunning) {\n          console.error("Datagram dispatcher error:", error);\n        }\n      } finally {\n        this.datagramDispatcherRunning = false;\n      }\n    };\n    loop();\n  }\n  /**\n   * Update connection state and notify handlers\n   */\n  setState(state, error) {\n    this.state = state;\n    if (this.handlers.onStateChange) {\n      this.handlers.onStateChange(state, error);\n    }\n  }\n  /**\n   * Handle connection close\n   */\n  handleClose(info) {\n    if (this.datagramWriter) {\n      try {\n        this.datagramWriter.releaseLock();\n      } catch {\n      }\n      this.datagramWriter = null;\n    }\n    this.transport = null;\n    this.setState(ConnectionState.DISCONNECTED);\n    if (this.handlers.onClose) {\n      this.handlers.onClose(info);\n    }\n  }\n  /**\n   * Handle connection error\n   */\n  handleError(error) {\n    console.error("WebTransport connection error:", error);\n    if (this.datagramWriter) {\n      try {\n        this.datagramWriter.releaseLock();\n      } catch {\n      }\n      this.datagramWriter = null;\n    }\n    this.transport = null;\n    this.setState(ConnectionState.ERROR, error);\n  }\n}\nclass MoqClientError extends Error {\n  constructor(message, code, details) {\n    super(message);\n    this.code = code;\n    this.details = details;\n    this.name = "MoqClientError";\n  }\n}\nclass AuthenticationError extends MoqClientError {\n  constructor(message, moqErrorCode, details) {\n    super(message, "AUTHENTICATION_FAILED", details);\n    this.moqErrorCode = moqErrorCode;\n    this.name = "AuthenticationError";\n  }\n  /**\n   * Check if this is an invalid token error\n   */\n  isInvalidToken() {\n    return this.moqErrorCode === 2 || this.moqErrorCode === 1027;\n  }\n  /**\n   * Check if this is an expired token error\n   */\n  isExpiredToken() {\n    return this.message.toLowerCase().includes("expired");\n  }\n}\nclass ProtocolError extends MoqClientError {\n  constructor(message, moqErrorCode, details) {\n    super(message, "PROTOCOL_ERROR", details);\n    this.moqErrorCode = moqErrorCode;\n    this.name = "ProtocolError";\n  }\n}\nclass SubscriptionError extends MoqClientError {\n  constructor(message, moqErrorCode, trackNamespace, details) {\n    super(message, "SUBSCRIPTION_FAILED", details);\n    this.moqErrorCode = moqErrorCode;\n    this.trackNamespace = trackNamespace;\n    this.name = "SubscriptionError";\n  }\n}\nclass AnnouncementError extends MoqClientError {\n  constructor(message, moqErrorCode, namespace, details) {\n    super(message, "ANNOUNCEMENT_FAILED", details);\n    this.moqErrorCode = moqErrorCode;\n    this.namespace = namespace;\n    this.name = "AnnouncementError";\n  }\n}\nfunction getMoqErrorMessage(code) {\n  switch (code) {\n    case 0:\n      return "No error";\n    case 1:\n      return "Internal error";\n    case 2:\n      return "Unauthorized";\n    case 3:\n      return "Protocol violation";\n    case 4:\n      return "Duplicate track alias";\n    case 5:\n      return "Parameter length mismatch";\n    case 6:\n      return "Too many subscribes";\n    case 16:\n      return "GOAWAY timeout";\n    case 1027:\n      return "Invalid token (custom)";\n    default:\n      return `Unknown error (0x${code.toString(16)})`;\n  }\n}\nclass MoqSession {\n  constructor(connection2, debug = false) {\n    this.connection = connection2;\n    this.debug = debug;\n  }\n  controlStream = null;\n  writer = null;\n  reader = null;\n  readBuffer = new Uint8Array(0);\n  nextSubscribeId = 1;\n  nextTrackAlias = 1;\n  nextAnnounceRequestId = 2;\n  // Client uses even IDs for announces (to avoid collisions with server)\n  // Track state\n  subscriptions = /* @__PURE__ */ new Map();\n  announcements = /* @__PURE__ */ new Map();\n  incomingSubscriptions = /* @__PURE__ */ new Map();\n  // Callbacks for when server subscribes to our tracks\n  onIncomingSubscribeCallback = null;\n  debug;\n  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n  log(...args) {\n    if (this.debug) {\n      console.log("[MOQ]", ...args);\n    }\n  }\n  /**\n   * Set callback for when server subscribes to one of our announced tracks\n   */\n  onIncomingSubscribe(callback) {\n    this.onIncomingSubscribeCallback = callback;\n  }\n  /**\n   * Initialize the MOQ session over the control stream\n   * @param role - The MOQ role (publisher, subscriber, or pubsub)\n   * @param path - Optional path parameter\n   * @param maxSubscribeId - Max number of requests server can send to client (default: 100)\n   */\n  async initialize(role, path, maxSubscribeId = 100) {\n    this.log("Creating control stream...");\n    this.controlStream = await this.connection.createControlStream();\n    this.writer = this.controlStream.writable.getWriter();\n    this.reader = this.controlStream.readable.getReader();\n    this.log("Control stream created, sending CLIENT_SETUP...");\n    const setupMsg = buildClientSetup([MOQ_TRANSPORT_VERSION], role, path, maxSubscribeId);\n    this.log("CLIENT_SETUP message size:", setupMsg.length, "bytes");\n    this.log("CLIENT_SETUP hex:", Array.from(setupMsg).map((b) => b.toString(16).padStart(2, "0")).join(" "));\n    await this.writer.write(setupMsg);\n    this.log("CLIENT_SETUP sent, waiting for SERVER_SETUP...");\n    const { type, content } = await this.readFramedMessage();\n    this.log("Received response type: 0x" + type.toString(16) + ", content size:", content.length, "bytes");\n    if (type !== MoqMessageType.SERVER_SETUP) {\n      throw new ProtocolError(\n        `Expected SERVER_SETUP (0x41), got message type 0x${type.toString(16)}`,\n        type\n      );\n    }\n    const serverSetup = parseServerSetup(content, 0);\n    this.log("Session established, server version:", serverSetup.selectedVersion.toString(16));\n  }\n  /**\n   * Subscribe to a track with JWT authorization\n   */\n  async subscribe(namespace, trackName, authorization, resumeOpId) {\n    const subscribeId = this.nextSubscribeId++;\n    const subscribeMsg = buildSubscribe({\n      subscribeId,\n      namespace,\n      trackName,\n      filterType: MoqFilterType.LATEST_GROUP,\n      authorization,\n      resumeOpId\n    });\n    this.log("SUBSCRIBE message size:", subscribeMsg.length, "bytes");\n    await this.writer.write(subscribeMsg);\n    const { type, content } = await this.waitForMessage([\n      MoqMessageType.SUBSCRIBE_OK,\n      MoqMessageType.SUBSCRIBE_ERROR\n    ]);\n    if (type === MoqMessageType.SUBSCRIBE_OK) {\n      const ok = parseSubscribeOk(content, 0);\n      this.log("Subscribed successfully, subscribeId:", ok.subscribeId, "trackAlias:", ok.trackAlias);\n      this.subscriptions.set(subscribeId, { namespace, trackName, alias: ok.trackAlias });\n      return subscribeId;\n    } else if (type === MoqMessageType.SUBSCRIBE_ERROR) {\n      const error = parseSubscribeError(content, 0);\n      const errorMessage = `${error.reasonPhrase} (${getMoqErrorMessage(error.errorCode)})`;\n      if (error.errorCode === 2 || error.errorCode === 1027) {\n        throw new AuthenticationError(errorMessage, error.errorCode, { namespace, trackName });\n      }\n      throw new SubscriptionError(errorMessage, error.errorCode, namespace);\n    } else {\n      throw new ProtocolError(\n        `Expected SUBSCRIBE_OK or SUBSCRIBE_ERROR, got message type 0x${type.toString(16)}`,\n        type\n      );\n    }\n  }\n  /**\n   * Wait for a specific message type, handling other messages that arrive first\n   */\n  async waitForMessage(expectedTypes) {\n    const maxAttempts = 20;\n    for (let i = 0; i < maxAttempts; i++) {\n      const { type, content } = await this.readFramedMessage();\n      if (expectedTypes.includes(type)) {\n        return { type, content };\n      }\n      this.log(`Received unexpected message type 0x${type.toString(16)} while waiting, handling it`);\n      await this.handleUnexpectedMessage(type, content);\n    }\n    throw new ProtocolError(\n      `Timeout waiting for message types: ${expectedTypes.map((t) => "0x" + t.toString(16)).join(", ")}`,\n      0\n    );\n  }\n  /**\n   * Handle messages that arrive when we\'re waiting for something else\n   */\n  async handleUnexpectedMessage(type, content) {\n    switch (type) {\n      case MoqMessageType.ANNOUNCE:\n        this.log("Received ANNOUNCE from server, sending ANNOUNCE_OK");\n        await this.sendAnnounceOk(content);\n        break;\n      case 17:\n        this.log("Received SUBSCRIBE_ANNOUNCES from server, sending OK");\n        await this.sendSubscribeAnnouncesOk(content);\n        break;\n      case MoqMessageType.SUBSCRIBE:\n        this.log("Received SUBSCRIBE from server, sending SUBSCRIBE_OK");\n        await this.handleIncomingSubscribe(content);\n        break;\n      default:\n        this.log(`Skipping unhandled message type 0x${type.toString(16)}`);\n    }\n  }\n  /**\n   * Handle incoming SUBSCRIBE from server and respond with SUBSCRIBE_OK\n   *\n   * Per moqtransport v0.5.1 / draft-ietf-moq-transport-11, the SUBSCRIBE\n   * wire format does NOT include TrackAlias. The publisher (us) assigns a\n   * TrackAlias and returns it in SUBSCRIBE_OK.\n   *\n   * SUBSCRIBE wire format: RequestID, Namespace, TrackName, Priority,\n   *   GroupOrder, Forward, FilterType, Parameters\n   *\n   * SUBSCRIBE_OK wire format: RequestID, TrackAlias, Expires, GroupOrder,\n   *   ContentExists, [LargestLocation], Parameters\n   */\n  async handleIncomingSubscribe(content) {\n    let pos = 0;\n    const requestIdByte = content[pos];\n    let requestId;\n    if (requestIdByte < 64) {\n      requestId = requestIdByte;\n      pos += 1;\n    } else if ((requestIdByte & 192) === 64) {\n      requestId = (requestIdByte & 63) << 8 | content[pos + 1];\n      pos += 2;\n    } else {\n      requestId = requestIdByte & 63;\n      pos += 1;\n    }\n    const namespace = this.parseNamespaceFromContent(content, pos);\n    const trackAlias = this.nextTrackAlias++;\n    this.log(`Server subscribing to: ${namespace.join("/")}, assigning trackAlias=${trackAlias}`);\n    const builder = new MessageBuilder();\n    builder.writeVarint(requestId);\n    builder.writeVarint(trackAlias);\n    builder.writeVarint(0);\n    builder.writeRaw(new Uint8Array([1]));\n    builder.writeRaw(new Uint8Array([0]));\n    builder.writeVarint(0);\n    const msg = wrapWithLengthFrame(MoqMessageType.SUBSCRIBE_OK, builder.build());\n    await this.writer.write(msg);\n    this.log("Sent SUBSCRIBE_OK for requestId:", requestId, "trackAlias:", trackAlias);\n    this.incomingSubscriptions.set(requestId, { trackAlias, namespace });\n    if (this.onIncomingSubscribeCallback) {\n      this.onIncomingSubscribeCallback(namespace, trackAlias);\n    }\n  }\n  /**\n   * Get track alias for an incoming subscription by namespace\n   */\n  getIncomingTrackAlias(namespacePrefix) {\n    for (const [, sub] of this.incomingSubscriptions) {\n      if (sub.namespace.join("/").startsWith(namespacePrefix)) {\n        return sub.trackAlias;\n      }\n    }\n    return void 0;\n  }\n  /**\n   * Parse namespace from content starting at given position\n   */\n  parseNamespaceFromContent(content, startPos) {\n    let pos = startPos;\n    const namespace = [];\n    if (pos >= content.length) return namespace;\n    const firstByte = content[pos];\n    let nsLength;\n    if (firstByte < 64) {\n      nsLength = firstByte;\n      pos += 1;\n    } else if ((firstByte & 192) === 64) {\n      nsLength = (firstByte & 63) << 8 | content[pos + 1];\n      pos += 2;\n    } else {\n      nsLength = firstByte & 63;\n      pos += 1;\n    }\n    for (let i = 0; i < nsLength && pos < content.length; i++) {\n      const partLenByte = content[pos];\n      let partLen;\n      if (partLenByte < 64) {\n        partLen = partLenByte;\n        pos += 1;\n      } else if ((partLenByte & 192) === 64) {\n        partLen = (partLenByte & 63) << 8 | content[pos + 1];\n        pos += 2;\n      } else {\n        partLen = partLenByte & 63;\n        pos += 1;\n      }\n      if (pos + partLen <= content.length) {\n        const part = new TextDecoder().decode(content.slice(pos, pos + partLen));\n        namespace.push(part);\n        pos += partLen;\n      }\n    }\n    return namespace;\n  }\n  /**\n   * Send ANNOUNCE_OK response\n   */\n  async sendAnnounceOk(announceContent) {\n    const requestId = this.parseRequestId(announceContent);\n    this.log("Sending ANNOUNCE_OK for requestId:", requestId);\n    const builder = new MessageBuilder();\n    builder.writeVarint(requestId);\n    const msg = wrapWithLengthFrame(MoqMessageType.ANNOUNCE_OK, builder.build());\n    this.log("ANNOUNCE_OK message size:", msg.length, "bytes");\n    await this.writer.write(msg);\n  }\n  /**\n   * Send SUBSCRIBE_ANNOUNCES_OK response\n   */\n  async sendSubscribeAnnouncesOk(subscribeAnnouncesContent) {\n    const requestId = this.parseRequestId(subscribeAnnouncesContent);\n    this.log("Sending SUBSCRIBE_ANNOUNCES_OK for requestId:", requestId);\n    const builder = new MessageBuilder();\n    builder.writeVarint(requestId);\n    const msg = wrapWithLengthFrame(18, builder.build());\n    await this.writer.write(msg);\n  }\n  /**\n   * Parse RequestID (first varint) from message content\n   */\n  parseRequestId(content) {\n    const firstByte = content[0];\n    if (firstByte < 64) {\n      return firstByte;\n    } else if ((firstByte & 192) === 64) {\n      return (firstByte & 63) << 8 | content[1];\n    } else if ((firstByte & 192) === 128) {\n      return (firstByte & 63) << 24 | content[1] << 16 | content[2] << 8 | content[3];\n    } else {\n      return content[4] << 24 | content[5] << 16 | content[6] << 8 | content[7];\n    }\n  }\n  /**\n   * Announce a track namespace\n   */\n  async announce(namespace, authorization) {\n    const requestId = this.nextAnnounceRequestId;\n    this.nextAnnounceRequestId += 2;\n    const parameters = /* @__PURE__ */ new Map();\n    if (authorization) {\n      const encoder = new TextEncoder();\n      parameters.set(3, encoder.encode(authorization));\n    }\n    const announceMsg = buildAnnounce({ requestId, namespace, parameters: parameters.size > 0 ? parameters : void 0 });\n    this.log("ANNOUNCE message size:", announceMsg.length, "bytes, requestId:", requestId);\n    await this.writer.write(announceMsg);\n    const { type, content } = await this.waitForMessage([\n      MoqMessageType.ANNOUNCE_OK,\n      MoqMessageType.ANNOUNCE_ERROR\n    ]);\n    if (type === MoqMessageType.ANNOUNCE_OK) {\n      const ok = parseAnnounceOk(content, 0);\n      const nsKey = namespace.join("/");\n      this.announcements.set(nsKey, { namespace });\n      this.log("Announced successfully:", nsKey, "requestId:", ok.requestId);\n    } else if (type === MoqMessageType.ANNOUNCE_ERROR) {\n      const error = parseAnnounceError(content, 0);\n      const errorMessage = `${error.reasonPhrase} (${getMoqErrorMessage(error.errorCode)})`;\n      throw new AnnouncementError(errorMessage, error.errorCode, namespace);\n    } else {\n      throw new ProtocolError(\n        `Expected ANNOUNCE_OK or ANNOUNCE_ERROR, got message type 0x${type.toString(16)}`,\n        type\n      );\n    }\n  }\n  /**\n   * Get track alias for a subscription\n   */\n  getTrackAlias(subscribeId) {\n    return this.subscriptions.get(subscribeId)?.alias;\n  }\n  /**\n   * Start background message processing loop\n   * This handles messages that arrive after initial connection setup\n   */\n  startMessageLoop() {\n    this.processMessages().catch((error) => {\n      this.log("Message loop ended:", error.message);\n    });\n  }\n  /**\n   * Background message processing\n   */\n  async processMessages() {\n    this.log("Starting background message processing loop");\n    while (this.reader) {\n      try {\n        const { type, content } = await this.readFramedMessage();\n        this.log(`Background received message type 0x${type.toString(16)}`);\n        await this.handleUnexpectedMessage(type, content);\n      } catch (error) {\n        this.log("Message processing stopped:", error.message);\n        break;\n      }\n    }\n  }\n  /**\n   * Close the session\n   */\n  async close() {\n    if (this.writer) {\n      try {\n        await this.writer.close();\n      } catch {\n      }\n      this.writer = null;\n    }\n    if (this.reader) {\n      try {\n        await this.reader.cancel();\n      } catch {\n      }\n      this.reader = null;\n    }\n    this.controlStream = null;\n  }\n  /**\n   * Read a complete message from the control stream with proper length framing\n   * Format: [Type varint] [Length: 2 bytes big-endian] [Content: length bytes]\n   * Returns: { type, content } where content is the message body without type/length\n   */\n  async readFramedMessage() {\n    while (this.readBuffer.length < 3) {\n      const { value, done } = await this.reader.read();\n      if (done) {\n        throw new Error("Control stream closed unexpectedly");\n      }\n      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);\n      newBuffer.set(this.readBuffer);\n      newBuffer.set(value, this.readBuffer.length);\n      this.readBuffer = newBuffer;\n    }\n    let typeLength = 1;\n    const firstByte = this.readBuffer[0];\n    const prefix = firstByte >> 6;\n    if (prefix === 1) typeLength = 2;\n    else if (prefix === 2) typeLength = 4;\n    else if (prefix === 3) typeLength = 8;\n    const headerSize = typeLength + 2;\n    while (this.readBuffer.length < headerSize) {\n      const { value, done } = await this.reader.read();\n      if (done) {\n        throw new Error("Control stream closed unexpectedly");\n      }\n      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);\n      newBuffer.set(this.readBuffer);\n      newBuffer.set(value, this.readBuffer.length);\n      this.readBuffer = newBuffer;\n    }\n    let type;\n    if (typeLength === 1) {\n      type = firstByte;\n    } else if (typeLength === 2) {\n      type = (firstByte & 63) << 8 | this.readBuffer[1];\n    } else {\n      throw new Error(`Unsupported varint length: ${typeLength}`);\n    }\n    const lengthOffset = typeLength;\n    const contentLength = this.readBuffer[lengthOffset] << 8 | this.readBuffer[lengthOffset + 1];\n    this.log("readFramedMessage: type=0x" + type.toString(16) + ", contentLength=" + contentLength);\n    const totalSize = headerSize + contentLength;\n    while (this.readBuffer.length < totalSize) {\n      const { value, done } = await this.reader.read();\n      if (done) {\n        throw new Error("Control stream closed unexpectedly");\n      }\n      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);\n      newBuffer.set(this.readBuffer);\n      newBuffer.set(value, this.readBuffer.length);\n      this.readBuffer = newBuffer;\n    }\n    const content = this.readBuffer.slice(headerSize, totalSize);\n    this.readBuffer = this.readBuffer.slice(totalSize);\n    this.log("readFramedMessage: returning type=0x" + type.toString(16) + ", content.length=" + content.length);\n    return { type, content };\n  }\n}\nclass JitterBufferCore {\n  // ---- immutable geometry (frames) ----\n  capacity;\n  floor;\n  w;\n  nc;\n  sampleRate;\n  lMin;\n  lMax;\n  hMin;\n  hMax;\n  // ---- immutable controller constants ----\n  windowReads;\n  widenThreshold;\n  widenStep;\n  narrowStep;\n  // ---- storage: capacity * nc interleaved floats ----\n  data;\n  // ---- SPSC heads — cumulative (never wrap). Index via (pos % capacity) * nc. ----\n  // writePos crosses the writer→reader thread boundary in SAB mode, so it is\n  // backed by an atomic cell when `sharedWritePos` is given; otherwise a plain\n  // number. The Atomics.store/load act as the release/acquire fence pairing the\n  // ring writes (writer) with the ring reads (reader) — the Go SPSC contract.\n  // readPos is reader-owned (the writer never touches it), so it stays plain.\n  _writePos = 0;\n  wpCell = null;\n  get writePos() {\n    return this.wpCell ? Number(Atomics.load(this.wpCell, 0)) : this._writePos;\n  }\n  set writePos(v) {\n    if (this.wpCell) Atomics.store(this.wpCell, 0, BigInt(v));\n    else this._writePos = v;\n  }\n  readPos = 0;\n  // ---- live adaptive window ----\n  currentL;\n  currentH;\n  // ---- tumbling-window controller state (reader-owned) ----\n  insertCount = 0;\n  dropCount = 0;\n  readsThisWindow = 0;\n  // ---- last completed window\'s counts, for observation ----\n  lastWinInserts = 0;\n  lastWinDrops = 0;\n  // ---- cumulative stats ----\n  underruns = 0;\n  overruns = 0;\n  laps = 0;\n  samplesDropped = 0;\n  samplesInserted = 0;\n  constructor(cfg = {}) {\n    const sr = cfg.sampleRate ?? 48e3;\n    const nc = cfg.numChannels ?? 1;\n    const f = (ms) => Math.floor(sr * ms / 1e3);\n    const W = cfg.writerFrame ?? f(20);\n    const R = cfg.readerFrame ?? f(5);\n    const S = cfg.safety ?? f(1);\n    const lInit = cfg.lowInit ?? f(10);\n    const lMin = cfg.lowMin ?? f(7);\n    const lMax = cfg.lowMax ?? f(30);\n    const hInit = cfg.highInit ?? f(16);\n    const hMin = cfg.highMin ?? f(14);\n    const hMax = cfg.highMax ?? f(30);\n    if (R <= 0 || W <= 0) {\n      throw new Error("JitterBufferCore: readerFrame and writerFrame must be > 0");\n    }\n    if (S < 0) {\n      throw new Error("JitterBufferCore: safety must be >= 0");\n    }\n    if (!(0 <= lMin && lMin <= lInit && lInit <= lMax)) {\n      throw new Error("JitterBufferCore: require 0 <= lowMin <= lowInit <= lowMax");\n    }\n    if (!(0 <= hMin && hMin <= hInit && hInit <= hMax)) {\n      throw new Error("JitterBufferCore: require 0 <= highMin <= highInit <= highMax");\n    }\n    const floor = R + S;\n    const maxWR = Math.max(W, R);\n    const bandTopMax = R + S + lMax + 2 * W + hMax;\n    const capacity = 2 * bandTopMax + 2 * maxWR;\n    this.capacity = capacity;\n    this.floor = floor;\n    this.w = W;\n    this.nc = nc;\n    this.sampleRate = sr;\n    this.lMin = lMin;\n    this.lMax = lMax;\n    this.hMin = hMin;\n    this.hMax = hMax;\n    this.windowReads = cfg.windowReads ?? 750;\n    this.widenThreshold = cfg.widenThreshold ?? 5;\n    this.widenStep = cfg.widenStep ?? f(2);\n    this.narrowStep = cfg.narrowStep ?? Math.floor(sr * 500 / 1e6);\n    if (cfg.sharedStorage) {\n      if (cfg.sharedStorage.length !== capacity * nc) {\n        throw new Error(\n          `JitterBufferCore: sharedStorage length ${cfg.sharedStorage.length} != capacity*nc ${capacity * nc} (size it with computeJitterCapacity using the same config)`\n        );\n      }\n      this.data = cfg.sharedStorage;\n    } else {\n      this.data = new Float32Array(capacity * nc);\n    }\n    if (cfg.sharedWritePos) {\n      if (cfg.sharedWritePos.length < 1) {\n        throw new Error("JitterBufferCore: sharedWritePos must be a length-1 BigInt64Array");\n      }\n      this.wpCell = cfg.sharedWritePos;\n    }\n    this.currentL = lInit;\n    this.currentH = hInit;\n  }\n  /**\n   * Derive the operating thresholds from the (loaded-once) window allowances\n   * `l`, `h` plus the immutable floor and writer frame. Pure function; all\n   * branches of {@link read} use one consistent snapshot.\n   */\n  levels(l, h) {\n    const t = this.floor + l;\n    return { t, snapTarget: t + this.w, dropLine: t + this.w + h, overrunAt: t + 2 * this.w + h };\n  }\n  /**\n   * Copy `src` (interleaved, length a multiple of `nc`) into the ring. Never\n   * blocks. Writes longer than capacity are clipped to the most-recent\n   * `capacity` frames.\n   */\n  write(src) {\n    let nFrames = Math.floor(src.length / this.nc);\n    if (nFrames === 0) return;\n    if (nFrames > this.capacity) {\n      const skip = nFrames - this.capacity;\n      src = src.subarray(skip * this.nc);\n      nFrames = this.capacity;\n    }\n    const wp = this.writePos;\n    this.writeToRing(src, wp, nFrames);\n    this.writePos = wp + nFrames;\n  }\n  /**\n   * Copy up to `dst.length` interleaved samples from the ring into `dst`.\n   * Returns true when audio was produced, false on silence. See design §4. The\n   * window allowances L and H are read exactly once at the top so every branch\n   * sees consistent geometry. No debounce: corrections fire on the first\n   * out-of-band read.\n   */\n  read(dst) {\n    const nc = this.nc;\n    const nFrames = Math.floor(dst.length / nc);\n    if (nFrames === 0) return true;\n    let wp = this.writePos;\n    let rp = this.readPos;\n    let fill = wp - rp;\n    const { snapTarget, dropLine, overrunAt } = this.levels(this.currentL, this.currentH);\n    if (rp === 0) {\n      if (fill < snapTarget) {\n        dst.fill(0);\n        this.adapt();\n        return false;\n      }\n      rp = wp - snapTarget;\n      this.readPos = rp;\n      fill = snapTarget;\n    }\n    if (fill >= this.capacity) {\n      rp = wp - snapTarget;\n      this.readPos = rp;\n      fill = snapTarget;\n      this.laps++;\n    } else if (fill > overrunAt) {\n      rp = wp - snapTarget;\n      this.readPos = rp;\n      fill = snapTarget;\n      this.overruns++;\n    }\n    if (fill < nFrames) {\n      dst.fill(0);\n      this.underruns++;\n      this.adapt();\n      return false;\n    }\n    let corr = 0;\n    if (fill > dropLine && fill >= nFrames + 1) {\n      corr = 1;\n    } else if (fill < this.floor && nFrames >= 2) {\n      corr = -1;\n    }\n    if (corr === 1) {\n      this.readFromRing(dst, rp, nFrames);\n      const skipBase = (rp + nFrames) % this.capacity * nc;\n      const dstBase = (nFrames - 1) * nc;\n      for (let ch = 0; ch < nc; ch++) {\n        const a = dst[dstBase + ch];\n        const b = this.data[skipBase + ch];\n        dst[dstBase + ch] = (a + b) * 0.5;\n      }\n      this.readPos = rp + nFrames + 1;\n      this.samplesDropped++;\n      this.dropCount++;\n    } else if (corr === -1) {\n      const realFrames = nFrames - 1;\n      this.readFromRing(dst.subarray(0, realFrames * nc), rp, realFrames);\n      const peekBase = (rp + realFrames) % this.capacity * nc;\n      const lastBase = (realFrames - 1) * nc;\n      const tailBase = realFrames * nc;\n      for (let ch = 0; ch < nc; ch++) {\n        const a = dst[lastBase + ch];\n        const b = this.data[peekBase + ch];\n        dst[tailBase + ch] = (a + b) * 0.5;\n      }\n      this.readPos = rp + realFrames;\n      this.samplesInserted++;\n      this.insertCount++;\n    } else {\n      this.readFromRing(dst, rp, nFrames);\n      this.readPos = rp + nFrames;\n    }\n    this.adapt();\n    return true;\n  }\n  /**\n   * Tick the tumbling window once per Read and, every `windowReads`, run the\n   * decision off the accumulated correction counts, then reset them. No\n   * wall-clock: the window is a read count, the inputs are correction counts.\n   */\n  adapt() {\n    if (this.windowReads <= 0) return;\n    this.readsThisWindow++;\n    if (this.readsThisWindow < this.windowReads) return;\n    this.lastWinInserts = this.insertCount;\n    this.lastWinDrops = this.dropCount;\n    this.decide(this.insertCount, this.dropCount);\n    this.insertCount = 0;\n    this.dropCount = 0;\n    this.readsThisWindow = 0;\n  }\n  /**\n   * Move the window allowances from one window\'s correction counts (design §6):\n   *   - both sides breached (min ≥ threshold) ⇒ jitter ⇒ widen the breaching\n   *     side(s) by widenStep, capped at max (eager);\n   *   - otherwise a fully-calm side (count 0) narrows by narrowStep, floored at\n   *     min; a side that is lit but un-gated is drift — left to the ±1 corrector.\n   * `narrowStep < widenStep` makes it eager-up / reluctant-down — the stability\n   * guarantee.\n   */\n  decide(insertCount, dropCount) {\n    if (Math.min(insertCount, dropCount) >= this.widenThreshold) {\n      if (insertCount >= this.widenThreshold && this.currentL < this.lMax) {\n        this.currentL = Math.min(this.currentL + this.widenStep, this.lMax);\n      }\n      if (dropCount >= this.widenThreshold && this.currentH < this.hMax) {\n        this.currentH = Math.min(this.currentH + this.widenStep, this.hMax);\n      }\n      return;\n    }\n    if (insertCount === 0 && this.currentL > this.lMin) {\n      this.currentL = Math.max(this.currentL - this.narrowStep, this.lMin);\n    }\n    if (dropCount === 0 && this.currentH > this.hMin) {\n      this.currentH = Math.max(this.currentH - this.narrowStep, this.hMin);\n    }\n  }\n  /** Current fill in frames. */\n  fillFrames() {\n    return this.writePos - this.readPos;\n  }\n  /** Fill in interleaved floats (matching the Go ICircularBuffer convention). */\n  getBehind() {\n    return this.fillFrames() * this.nc;\n  }\n  /** Rich snapshot for tuning/observability. */\n  snapshot() {\n    const fill = this.fillFrames();\n    const l = this.currentL;\n    const h = this.currentH;\n    const srMs = this.sampleRate / 1e3;\n    const { dropLine } = this.levels(l, h);\n    let zone = 0;\n    if (fill < this.floor) zone = -1;\n    else if (fill > dropLine) zone = 1;\n    return {\n      fillFrames: fill,\n      fillMs: fill / srMs,\n      floorFrames: this.floor,\n      lowAllowanceFrames: l,\n      lowAllowanceMs: l / srMs,\n      highAllowanceFrames: h,\n      highAllowanceMs: h / srMs,\n      targetFrames: this.floor + l,\n      started: this.readPos > 0,\n      underruns: this.underruns,\n      overruns: this.overruns,\n      laps: this.laps,\n      samplesDropped: this.samplesDropped,\n      samplesInserted: this.samplesInserted,\n      lastWindowInserts: this.lastWinInserts,\n      lastWindowDrops: this.lastWinDrops,\n      zone\n    };\n  }\n  /**\n   * Copy `nFrames` frames from `src` into the ring at frame position `wp`,\n   * handling wraparound. Caller guarantees `nFrames <= capacity`.\n   */\n  writeToRing(src, wp, nFrames) {\n    const cap = this.capacity;\n    const nc = this.nc;\n    const startFrame = wp % cap;\n    if (startFrame + nFrames <= cap) {\n      this.data.set(src.subarray(0, nFrames * nc), startFrame * nc);\n      return;\n    }\n    const first = cap - startFrame;\n    this.data.set(src.subarray(0, first * nc), startFrame * nc);\n    this.data.set(src.subarray(first * nc, nFrames * nc), 0);\n  }\n  /**\n   * Copy `nFrames` frames from the ring at frame position `rp` into `dst`,\n   * handling wraparound. Caller guarantees `nFrames <= capacity`.\n   */\n  readFromRing(dst, rp, nFrames) {\n    const cap = this.capacity;\n    const nc = this.nc;\n    const startFrame = rp % cap;\n    if (startFrame + nFrames <= cap) {\n      dst.set(this.data.subarray(startFrame * nc, (startFrame + nFrames) * nc));\n      return;\n    }\n    const first = cap - startFrame;\n    dst.set(this.data.subarray(startFrame * nc, cap * nc), 0);\n    dst.set(this.data.subarray(0, (nFrames - first) * nc), first * nc);\n  }\n}\nclass CaptureRing {\n  nc;\n  capacity;\n  data;\n  wpCell;\n  rpCell;\n  /** Count of quanta dropped because the consumer stalled past capacity (§5.1). */\n  overflows;\n  constructor(cfg) {\n    const nc = cfg.numChannels ?? 1;\n    const capacity = cfg.capacityFrames ?? 2048;\n    if (nc < 1) {\n      throw new Error("CaptureRing: numChannels must be >= 1");\n    }\n    if (capacity < 1) {\n      throw new Error("CaptureRing: capacityFrames must be >= 1");\n    }\n    if (cfg.sharedStorage.length !== capacity * nc) {\n      throw new Error(\n        `CaptureRing: sharedStorage length ${cfg.sharedStorage.length} != capacity*nc ${capacity * nc} (allocate capacityFrames * numChannels floats)`\n      );\n    }\n    if (cfg.sharedWritePos.length < 1 || cfg.sharedReadPos.length < 1) {\n      throw new Error("CaptureRing: sharedWritePos/sharedReadPos must be length-1 BigInt64Arrays");\n    }\n    this.nc = nc;\n    this.capacity = capacity;\n    this.data = cfg.sharedStorage;\n    this.wpCell = cfg.sharedWritePos;\n    this.rpCell = cfg.sharedReadPos;\n    this.overflows = 0;\n  }\n  /** Cumulative producer position (frames), acquire-loaded. */\n  get writePos() {\n    return Number(Atomics.load(this.wpCell, 0));\n  }\n  /** Cumulative consumer position (frames), acquire-loaded. */\n  get readPos() {\n    return Number(Atomics.load(this.rpCell, 0));\n  }\n  /** Current fill in frames (unambiguous: positions are cumulative). */\n  fillFrames() {\n    return this.writePos - this.readPos;\n  }\n  /**\n   * PRODUCER (capture worklet). Interleave one render quantum of planar channels into\n   * the ring. `planar[ch]` is a Float32Array of `nFrames` samples (Web Audio is\n   * planar; all channels equal length). Channels beyond `planar.length` reuse the last\n   * (mono→stereo dup); channels beyond `nc` are ignored. If the consumer has stalled\n   * and the quantum would not fit, the WHOLE quantum is dropped and `overflows` is\n   * bumped — never blocks, never overwrites unread data (§5.1). Returns true if written.\n   */\n  write(planar) {\n    if (!planar || planar.length === 0 || !planar[0]) {\n      return false;\n    }\n    const nc = this.nc;\n    const cap = this.capacity;\n    const nFrames = planar[0].length;\n    if (nFrames === 0) {\n      return false;\n    }\n    const wp = this.writePos;\n    const rp = this.readPos;\n    if (wp - rp + nFrames > cap) {\n      this.overflows++;\n      return false;\n    }\n    const data = this.data;\n    const startFrame = wp % cap;\n    for (let i = 0; i < nFrames; i++) {\n      const ringBase = (startFrame + i) % cap * nc;\n      for (let ch = 0; ch < nc; ch++) {\n        const src = planar[ch < planar.length ? ch : planar.length - 1];\n        data[ringBase + ch] = src[i];\n      }\n    }\n    Atomics.store(this.wpCell, 0, BigInt(wp + nFrames));\n    return true;\n  }\n  /**\n   * CONSUMER (MOQ worker). Copy all whole frames currently available into `dst`\n   * (interleaved), up to `dst`\'s capacity, then free that space. Returns the number of\n   * interleaved SAMPLES written (`frames * nc`), or 0 if nothing was ready. Drain to\n   * empty: leaves only what the producer hasn\'t yet published.\n   */\n  drain(dst) {\n    const nc = this.nc;\n    const cap = this.capacity;\n    const wp = this.writePos;\n    const rp = this.readPos;\n    const avail = wp - rp;\n    const room = Math.floor(dst.length / nc);\n    const nFrames = avail < room ? avail : room;\n    if (nFrames <= 0) {\n      return 0;\n    }\n    const data = this.data;\n    const startFrame = rp % cap;\n    if (startFrame + nFrames <= cap) {\n      dst.set(data.subarray(startFrame * nc, (startFrame + nFrames) * nc));\n    } else {\n      const first = cap - startFrame;\n      dst.set(data.subarray(startFrame * nc, cap * nc), 0);\n      dst.set(data.subarray(0, (nFrames - first) * nc), first * nc);\n    }\n    Atomics.store(this.rpCell, 0, BigInt(rp + nFrames));\n    return nFrames * nc;\n  }\n}\nclass CaptureEncoder {\n  ring;\n  trackAlias;\n  sampleRate;\n  nc;\n  priority;\n  encoder;\n  send;\n  // Reused scratch — the zero-alloc hot path (design §6/§8).\n  pcmScratch;\n  // drained interleaved PCM\n  bytesScratch;\n  // Opus bytes (encoder output copyTo)\n  dgPool;\n  // framed OBJECT_DATAGRAMs, round-robin (see config)\n  dgPoolIdx;\n  // Sequencing (lifted from AudioTrackPublisher): input timestamp is a running sample\n  // count; objectId is a monotonic counter; groupId is the chunk timestamp in ms.\n  samplesSent;\n  objectSeq;\n  // Observability.\n  encodedBatches;\n  sentDatagrams;\n  droppedOversize;\n  constructor(cfg) {\n    this.ring = cfg.ring;\n    this.trackAlias = cfg.trackAlias;\n    this.sampleRate = cfg.sampleRate;\n    this.nc = cfg.numChannels;\n    this.priority = cfg.publisherPriority ?? 0;\n    this.send = cfg.send;\n    const maxPayload = cfg.maxPayloadBytes ?? 4e3;\n    this.pcmScratch = new Float32Array(cfg.ring.capacity * this.nc);\n    this.bytesScratch = new Uint8Array(maxPayload);\n    const poolSize = cfg.datagramPoolSize ?? 8;\n    this.dgPool = [];\n    for (let i = 0; i < poolSize; i++) {\n      this.dgPool.push(new Uint8Array(maxObjectDatagramSize(maxPayload)));\n    }\n    this.dgPoolIdx = 0;\n    this.samplesSent = 0;\n    this.objectSeq = 0n;\n    this.encodedBatches = 0;\n    this.sentDatagrams = 0;\n    this.droppedOversize = 0;\n    this.encoder = cfg.makeEncoder((chunk) => this.handleChunk(chunk));\n  }\n  /**\n   * Drain all PCM currently in the ring and feed it to the encoder as one AudioData.\n   * Called on each wake (design §6.1). Returns the interleaved sample count encoded (0\n   * if the ring was empty). Opus does the 240-frame packetization internally.\n   */\n  pump() {\n    const n = this.ring.drain(this.pcmScratch);\n    if (n <= 0) {\n      return 0;\n    }\n    const frames = n / this.nc;\n    const timestampUs = Math.round(this.samplesSent / this.sampleRate * 1e6);\n    this.encoder.encode(this.pcmScratch.subarray(0, n), frames, timestampUs);\n    this.samplesSent += frames;\n    this.encodedBatches++;\n    return n;\n  }\n  /** Encoder output: frame the Opus packet into reused scratch and send it. No alloc. */\n  handleChunk(chunk) {\n    const size = chunk.byteLength;\n    if (size === 0) {\n      return;\n    }\n    if (size > this.bytesScratch.length) {\n      this.droppedOversize++;\n      return;\n    }\n    chunk.copyTo(this.bytesScratch);\n    const groupId = BigInt(Math.floor(chunk.timestamp / 1e3));\n    const objectId = this.objectSeq++;\n    const dg = this.dgPool[this.dgPoolIdx];\n    this.dgPoolIdx = (this.dgPoolIdx + 1) % this.dgPool.length;\n    const len = encodeObjectDatagramInto(\n      dg,\n      this.trackAlias,\n      groupId,\n      objectId,\n      this.priority,\n      this.bytesScratch.subarray(0, size)\n    );\n    this.send(dg.subarray(0, len));\n    this.sentDatagrams++;\n  }\n  /** Flush any buffered Opus packet (fires `handleChunk`) and close the encoder. */\n  async stop() {\n    try {\n      await this.encoder.flush();\n    } catch {\n    }\n    this.encoder.close();\n  }\n}\nclass StereoMeterCore {\n  sumLL = 0;\n  sumRR = 0;\n  sumLR = 0;\n  frames = 0;\n  /** Frames accumulated since the last snapshot (drives window emission). */\n  get frameCount() {\n    return this.frames;\n  }\n  /**\n   * Accumulate interleaved PCM (LRLR… for stereo). `channels` is the interleave\n   * stride; only the first two channels are measured. Mono input (channels=1)\n   * is treated as L=R — it reports correlation 1 / sideRms 0, which is the\n   * correct verdict for it.\n   */\n  writeInterleaved(pcm, channels) {\n    if (channels < 1) return;\n    const n = Math.floor(pcm.length / channels);\n    for (let i = 0; i < n; i++) {\n      const l = pcm[i * channels];\n      const r = channels > 1 ? pcm[i * channels + 1] : l;\n      this.sumLL += l * l;\n      this.sumRR += r * r;\n      this.sumLR += l * r;\n    }\n    this.frames += n;\n  }\n  /** Accumulate planar channels (the worklet\'s output layout). `right` null ⇒ mono. */\n  writePlanar(left, right, count) {\n    for (let i = 0; i < count; i++) {\n      const l = left[i];\n      const r = right ? right[i] : l;\n      this.sumLL += l * l;\n      this.sumRR += r * r;\n      this.sumLR += l * r;\n    }\n    this.frames += count;\n  }\n  /** Produce the window report and reset the accumulators. */\n  snapshotAndReset() {\n    const f = this.frames;\n    const ll = this.sumLL;\n    const rr = this.sumRR;\n    const lr = this.sumLR;\n    this.sumLL = 0;\n    this.sumRR = 0;\n    this.sumLR = 0;\n    this.frames = 0;\n    if (f === 0) {\n      return { frames: 0, rmsL: 0, rmsR: 0, midRms: 0, sideRms: 0, correlation: 0 };\n    }\n    const rmsL = Math.sqrt(ll / f);\n    const rmsR = Math.sqrt(rr / f);\n    const midRms = Math.sqrt(Math.max(0, ll + rr + 2 * lr) / (4 * f));\n    const sideRms = Math.sqrt(Math.max(0, ll + rr - 2 * lr) / (4 * f));\n    const denom = Math.sqrt(ll * rr);\n    const correlation = denom > 1e-20 ? Math.max(-1, Math.min(1, lr / denom)) : 0;\n    return { frames: f, rmsL, rmsR, midRms, sideRms, correlation };\n  }\n}\nconst ctx = self;\nlet connection = null;\nlet session = null;\nlet jbuf = null;\nlet decoder = null;\nlet audioTrackAlias;\nlet reading = false;\nlet decodePcm = new Float32Array(0);\nlet copyPath = null;\nlet planarScratch = new Float32Array(0);\nlet decodedFormatKey = "";\nlet tapAMeter = null;\nlet tapAWindowFrames = 12e3;\nfunction copyDecoded(audioData, pcm, frames, channels) {\n  if (copyPath !== "f32-planar") {\n    try {\n      audioData.copyTo(pcm, { planeIndex: 0, format: "f32" });\n      copyPath = "f32";\n      return;\n    } catch {\n      copyPath = "f32-planar";\n    }\n  }\n  if (planarScratch.length < frames) planarScratch = new Float32Array(frames);\n  const plane = planarScratch.subarray(0, frames);\n  for (let ch = 0; ch < channels; ch++) {\n    audioData.copyTo(plane, { planeIndex: ch, format: "f32-planar" });\n    for (let i = 0; i < frames; i++) pcm[i * channels + ch] = plane[i];\n  }\n}\nlet diagEnabled = false;\nconst ENABLE_CLOCK_PROBE = false;\nlet decFrames = 0;\nlet decRateStart = 0;\nfunction newGapStats() {\n  return { count: 0, clumped: 0, tight: 0, cadence: 0, gap: 0, last: 0 };\n}\nfunction recordGap(s, now) {\n  if (s.last > 0) {\n    const g = now - s.last;\n    if (g < 1) s.clumped++;\n    else if (g < 4) s.tight++;\n    else if (g <= 6) s.cadence++;\n    else s.gap++;\n  }\n  s.last = now;\n  s.count++;\n}\nfunction resetGapBuckets(s) {\n  s.count = 0;\n  s.clumped = 0;\n  s.tight = 0;\n  s.cadence = 0;\n  s.gap = 0;\n}\nconst dgGaps = newGapStats();\nconst outGaps = newGapStats();\nlet outFmin = Number.MAX_SAFE_INTEGER;\nlet outFmax = 0;\nlet decTotal = 0;\nlet decTotalStart = 0;\nlet decTotalDone = false;\nlet captureEncoder = null;\nlet captureSignal = null;\nlet captureRunning = false;\nfunction emit(evt) {\n  ctx.postMessage(evt);\n}\nfunction configureDecoder(cfg) {\n  if (decoder) {\n    try {\n      decoder.close();\n    } catch {\n    }\n  }\n  decoder = new AudioDecoder({\n    output: (audioData) => {\n      try {\n        const frames = audioData.numberOfFrames;\n        const channels = audioData.numberOfChannels;\n        const need = frames * channels;\n        if (decodePcm.length < need) decodePcm = new Float32Array(need);\n        const pcm = decodePcm.subarray(0, need);\n        copyDecoded(audioData, pcm, frames, channels);\n        jbuf?.write(pcm);\n        const fmtKey = `${channels}|${audioData.sampleRate}|${audioData.format ?? "?"}|${copyPath}`;\n        if (fmtKey !== decodedFormatKey) {\n          decodedFormatKey = fmtKey;\n          emit({\n            kind: "evt",\n            type: "decodedFormat",\n            format: {\n              numberOfChannels: channels,\n              sampleRate: audioData.sampleRate,\n              nativeFormat: audioData.format ?? null,\n              copyPath\n            }\n          });\n        }\n        if (diagEnabled && tapAMeter) {\n          tapAMeter.writeInterleaved(pcm, channels);\n          if (tapAMeter.frameCount >= tapAWindowFrames) {\n            emit({ kind: "evt", type: "stereoMetrics", tap: "decoded", report: tapAMeter.snapshotAndReset() });\n          }\n        }\n        if (diagEnabled) {\n          decFrames += frames;\n          const tNow = performance.now();\n          recordGap(outGaps, tNow);\n          if (frames < outFmin) outFmin = frames;\n          if (frames > outFmax) outFmax = frames;\n          if (decRateStart === 0) decRateStart = tNow;\n          const elapsed = tNow - decRateStart;\n          if (elapsed >= 2e3) {\n            const fps = decFrames / elapsed * 1e3;\n            emit({\n              kind: "evt",\n              type: "notice",\n              event: "decode-rate",\n              detail: `${fps.toFixed(1)} frames/wall-sec (${decFrames} frames / ${(elapsed / 1e3).toFixed(2)}s)`\n            });\n            const fmt = (s) => `n=${s.count} <1:${s.clumped} 1-4:${s.tight} ~5:${s.cadence} >6:${s.gap}`;\n            emit({\n              kind: "evt",\n              type: "notice",\n              event: "burst",\n              detail: `dg[${fmt(dgGaps)}] out[${fmt(outGaps)}] fpo=${outFmin === Number.MAX_SAFE_INTEGER ? 0 : outFmin}-${outFmax}`\n            });\n            decFrames = 0;\n            decRateStart = tNow;\n            resetGapBuckets(dgGaps);\n            resetGapBuckets(outGaps);\n            outFmin = Number.MAX_SAFE_INTEGER;\n            outFmax = 0;\n          }\n        }\n        if (ENABLE_CLOCK_PROBE && !decTotalDone) ;\n      } catch (e) {\n        emit({ kind: "evt", type: "notice", event: "decode-error", detail: String(e) });\n      } finally {\n        audioData.close();\n      }\n    },\n    error: (e) => emit({ kind: "evt", type: "notice", event: "decode-error", detail: String(e) })\n  });\n  decoder.configure({\n    codec: cfg.codec,\n    sampleRate: cfg.sampleRate,\n    numberOfChannels: cfg.numberOfChannels,\n    optimizeForLatency: true\n  });\n  decodedFormatKey = "";\n  tapAWindowFrames = Math.max(1, Math.round(cfg.sampleRate / 4));\n  tapAMeter = diagEnabled ? new StereoMeterCore() : null;\n}\nfunction startReadLoop() {\n  if (reading || !connection) return;\n  const datagrams = connection.getDatagrams();\n  const reader = datagrams.readable.getReader();\n  reading = true;\n  (async () => {\n    try {\n      while (reading) {\n        const { value, done } = await reader.read();\n        if (done) {\n          emit({ kind: "evt", type: "notice", event: "reader-done" });\n          break;\n        }\n        if (!value) continue;\n        let parsed;\n        try {\n          parsed = parseObjectDatagram(value);\n        } catch {\n          continue;\n        }\n        if (audioTrackAlias !== void 0 && parsed.trackAlias === audioTrackAlias && jbuf && decoder) {\n          if (diagEnabled) recordGap(dgGaps, performance.now());\n          try {\n            decoder.decode(\n              new EncodedAudioChunk({\n                type: "key",\n                // Opus frames are always key frames\n                timestamp: Number(parsed.groupId) * 1e3,\n                data: parsed.payload\n              })\n            );\n          } catch (e) {\n            emit({ kind: "evt", type: "notice", event: "decode-error", detail: String(e) });\n          }\n        } else {\n          const copy = parsed.payload.slice();\n          ctx.postMessage(\n            {\n              kind: "evt",\n              type: "datagram",\n              trackAlias: parsed.trackAlias,\n              payload: copy,\n              groupId: parsed.groupId,\n              objectId: parsed.objectId\n            },\n            // transfer the copy\'s buffer\n            [copy.buffer]\n          );\n        }\n      }\n    } catch (e) {\n      if (reading) emit({ kind: "evt", type: "notice", event: "reader-error", detail: String(e) });\n    } finally {\n      reading = false;\n    }\n  })();\n}\nfunction startCaptureLoop() {\n  if (captureRunning || !captureEncoder || !captureSignal) return;\n  captureRunning = true;\n  const signal = captureSignal;\n  const enc = captureEncoder;\n  const waitAsync = Atomics.waitAsync;\n  void (async () => {\n    let seen = Atomics.load(signal, 0);\n    while (captureRunning) {\n      enc.pump();\n      if (waitAsync) {\n        const r = waitAsync(signal, 0, seen);\n        if (r.async) await r.value;\n      } else {\n        await new Promise((res) => setTimeout(res, 2));\n      }\n      seen = Atomics.load(signal, 0);\n    }\n  })();\n}\nasync function stopCapture() {\n  captureRunning = false;\n  if (captureSignal) {\n    Atomics.add(captureSignal, 0, 1);\n    Atomics.notify(captureSignal, 0, 1);\n  }\n  if (captureEncoder) {\n    await captureEncoder.stop();\n    captureEncoder = null;\n  }\n  captureSignal = null;\n}\nasync function handle(method, args) {\n  switch (method) {\n    case "connect": {\n      const a = args;\n      diagEnabled = a.debug ?? false;\n      connection = new MoqConnection(a.serverUrl, a.debug ?? false);\n      connection.setHandlers({\n        onStateChange: (state, error) => emit({ kind: "evt", type: "connectionState", state: String(state), detail: error?.message })\n      });\n      await connection.connect(a.options);\n      session = new MoqSession(connection);\n      session.onIncomingSubscribe(\n        (namespace, trackAlias) => emit({ kind: "evt", type: "incomingSubscribe", namespace, trackAlias })\n      );\n      return { subprotocol: connection.getNegotiatedSubprotocol() };\n    }\n    case "initSession": {\n      const a = args;\n      if (!session) throw new Error("initSession before connect");\n      await session.initialize(a.role, void 0, a.maxSubscribeId);\n      startReadLoop();\n      return;\n    }\n    case "subscribe": {\n      const a = args;\n      if (!session) throw new Error("subscribe before connect");\n      const subscribeId = await session.subscribe(a.namespace, a.trackName, a.authorization, a.resumeOpId);\n      return { subscribeId, trackAlias: session.getTrackAlias(subscribeId) };\n    }\n    case "announce": {\n      const a = args;\n      if (!session) throw new Error("announce before connect");\n      await session.announce(a.namespace, a.authorization);\n      return;\n    }\n    case "setAudioTrack": {\n      const a = args;\n      jbuf = new JitterBufferCore({\n        ...a.jbufConfig,\n        sharedStorage: a.sharedStorage,\n        sharedWritePos: a.sharedWritePos\n      });\n      configureDecoder(a.decoderConfig);\n      audioTrackAlias = a.trackAlias;\n      return;\n    }\n    case "sendDatagram": {\n      const a = args;\n      if (!connection) throw new Error("sendDatagram before connect");\n      await connection.sendDatagram(a.bytes);\n      return;\n    }\n    case "setCaptureTrack": {\n      const a = args;\n      if (!connection) throw new Error("setCaptureTrack before connect");\n      await stopCapture();\n      const conn = connection;\n      const ring = new CaptureRing({\n        numChannels: a.numChannels,\n        capacityFrames: a.capacityFrames,\n        sharedStorage: a.sharedStorage,\n        sharedWritePos: a.sharedWritePos,\n        sharedReadPos: a.sharedReadPos\n      });\n      const ec = a.encoderConfig;\n      captureEncoder = new CaptureEncoder({\n        ring,\n        trackAlias: a.trackAlias,\n        sampleRate: ec.sampleRate,\n        numChannels: ec.numberOfChannels,\n        publisherPriority: a.publisherPriority,\n        // Inject the real WebCodecs encoder + AudioData (kept out of CaptureEncoder so\n        // its logic stays unit-testable). The output callback drives framing + send.\n        makeEncoder: (onChunk) => {\n          const audioEncoder = new AudioEncoder({\n            output: (chunk) => onChunk(chunk),\n            error: (e) => emit({ kind: "evt", type: "notice", event: "encode-error", detail: String(e) })\n          });\n          audioEncoder.configure({\n            codec: ec.codec,\n            sampleRate: ec.sampleRate,\n            numberOfChannels: ec.numberOfChannels,\n            bitrate: ec.bitrate,\n            opus: { frameDuration: ec.frameDurationUs }\n          });\n          return {\n            encode: (samples, frames, timestampUs) => {\n              const audioData = new AudioData({\n                format: "f32",\n                sampleRate: ec.sampleRate,\n                numberOfFrames: frames,\n                numberOfChannels: ec.numberOfChannels,\n                timestamp: timestampUs,\n                // The view is the non-shared pcmScratch (offset 0); cast past the\n                // ArrayBufferLike-vs-ArrayBuffer strictness. AudioData copies it\n                // synchronously, so the scratch is reusable right after.\n                data: samples\n              });\n              try {\n                audioEncoder.encode(audioData);\n              } finally {\n                audioData.close();\n              }\n            },\n            flush: () => audioEncoder.flush(),\n            close: () => {\n              if (audioEncoder.state !== "closed") audioEncoder.close();\n            }\n          };\n        },\n        send: (bytes) => {\n          void conn.sendDatagram(bytes);\n        }\n      });\n      captureSignal = a.sharedSignal;\n      startCaptureLoop();\n      return;\n    }\n    case "stopCapture": {\n      await stopCapture();\n      return;\n    }\n    case "startMessageLoop": {\n      if (!session) throw new Error("startMessageLoop before connect");\n      session.startMessageLoop();\n      return;\n    }\n    case "disconnect": {\n      reading = false;\n      await stopCapture();\n      if (decoder) {\n        try {\n          decoder.close();\n        } catch {\n        }\n        decoder = null;\n      }\n      if (session) {\n        await session.close();\n        session = null;\n      }\n      if (connection) {\n        connection.close();\n        connection = null;\n      }\n      jbuf = null;\n      audioTrackAlias = void 0;\n      return;\n    }\n    default: {\n      throw new Error(`unknown method: ${String(method)}`);\n    }\n  }\n}\nctx.onmessage = (e) => {\n  const msg = e.data;\n  if (!msg || msg.kind !== "req") return;\n  handle(msg.method, msg.args).then(\n    (result) => ctx.postMessage({ kind: "res", id: msg.id, ok: true, result }),\n    (err) => ctx.postMessage({ kind: "res", id: msg.id, ok: false, error: String(err) })\n  );\n};\n';
const blob = typeof self !== "undefined" && self.Blob && new Blob(["URL.revokeObjectURL(import.meta.url);", jsContent], { type: "text/javascript;charset=utf-8" });
function WorkerWrapper(options) {
  let objURL;
  try {
    objURL = blob && (self.URL || self.webkitURL).createObjectURL(blob);
    if (!objURL) throw "";
    const worker = new Worker(objURL, {
      type: "module",
      name: options?.name
    });
    worker.addEventListener("error", () => {
      (self.URL || self.webkitURL).revokeObjectURL(objURL);
    });
    return worker;
  } catch (e) {
    return new Worker(
      "data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent),
      {
        type: "module",
        name: options?.name
      }
    );
  }
}
function createMoqWorker() {
  return new WorkerWrapper();
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
const PLAYOUT_TUNING = {
  safetyMs: 1,
  // S — floor pad above the underrun edge
  // Deepened 2026-06-10 to absorb the browser reader-burst sawtooth. Measured: the
  // AudioWorklet consumes in ~device-buffer clumps (~13 ms swing; outputLatency 37 ms)
  // while the worker feeds smoothly at 5 ms, so `fill` sawtooths ~13 ms. The operating
  // band floor→dropLine (= L + W + H) must exceed that, and the MINIMUMS must hold it
  // there: the controller narrows on one-sided drops, and a reader-burst looks exactly
  // like one-sided drops, so without high minimums it shrinks the band into the sawtooth.
  // Retuned 2026-06-10 (robustness > latency): the controller narrows to the MINIMUMS
  // under a reader-burst (one-sided drops), so lowMin/highMin ARE the steady-state
  // operating point and must hold the WORST observed swing (~19 ms), not the median
  // (~12 ms). Inits govern the warm-up window before adaptation (cures early crackle).
  lowInitMs: 10,
  // warm-start L — keeps the sawtooth trough off the floor during warm-up
  lowMinMs: 7,
  // late-cushion floor (steady-state min)
  lowMaxMs: 30,
  // latency ceiling
  highInitMs: 16,
  // warm-start H — headroom for the reader-burst peak + warm-up transients
  highMinMs: 14,
  // H floor (steady-state min) — sized for the worst reader-burst swing
  highMaxMs: 30,
  // H ceiling — headroom for deeper-buffered output devices
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
  const f = (ms) => Math.floor(sr * ms / 1e3);
  const W = cfg.writerFrame ?? f(20);
  const R = cfg.readerFrame ?? f(5);
  const S = cfg.safety ?? f(1);
  const lMax = cfg.lowMax ?? f(30);
  const hMax = cfg.highMax ?? f(30);
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
    const f = (ms) => Math.floor(sr * ms / 1e3);
    const W = cfg.writerFrame ?? f(20);
    const R = cfg.readerFrame ?? f(5);
    const S = cfg.safety ?? f(1);
    const lInit = cfg.lowInit ?? f(10);
    const lMin = cfg.lowMin ?? f(7);
    const lMax = cfg.lowMax ?? f(30);
    const hInit = cfg.highInit ?? f(16);
    const hMin = cfg.highMin ?? f(14);
    const hMax = cfg.highMax ?? f(30);
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
    this.widenStep = cfg.widenStep ?? f(2);
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
  levels(l, h) {
    const t = this.floor + l;
    return { t, snapTarget: t + this.w, dropLine: t + this.w + h, overrunAt: t + 2 * this.w + h };
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
        const b = this.data[skipBase + ch];
        dst[dstBase + ch] = (a + b) * 0.5;
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
        const b = this.data[peekBase + ch];
        dst[tailBase + ch] = (a + b) * 0.5;
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
    const h = this.currentH;
    const srMs = this.sampleRate / 1e3;
    const { dropLine } = this.levels(l, h);
    let zone = 0;
    if (fill < this.floor) zone = -1;
    else if (fill > dropLine) zone = 1;
    return {
      fillFrames: fill,
      fillMs: fill / srMs,
      floorFrames: this.floor,
      lowAllowanceFrames: l,
      lowAllowanceMs: l / srMs,
      highAllowanceFrames: h,
      highAllowanceMs: h / srMs,
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
class StereoMeterCore {
  sumLL = 0;
  sumRR = 0;
  sumLR = 0;
  frames = 0;
  /** Frames accumulated since the last snapshot (drives window emission). */
  get frameCount() {
    return this.frames;
  }
  /**
   * Accumulate interleaved PCM (LRLR… for stereo). `channels` is the interleave
   * stride; only the first two channels are measured. Mono input (channels=1)
   * is treated as L=R — it reports correlation 1 / sideRms 0, which is the
   * correct verdict for it.
   */
  writeInterleaved(pcm, channels) {
    if (channels < 1) return;
    const n = Math.floor(pcm.length / channels);
    for (let i = 0; i < n; i++) {
      const l = pcm[i * channels];
      const r = channels > 1 ? pcm[i * channels + 1] : l;
      this.sumLL += l * l;
      this.sumRR += r * r;
      this.sumLR += l * r;
    }
    this.frames += n;
  }
  /** Accumulate planar channels (the worklet's output layout). `right` null ⇒ mono. */
  writePlanar(left, right, count) {
    for (let i = 0; i < count; i++) {
      const l = left[i];
      const r = right ? right[i] : l;
      this.sumLL += l * l;
      this.sumRR += r * r;
      this.sumLR += l * r;
    }
    this.frames += count;
  }
  /** Produce the window report and reset the accumulators. */
  snapshotAndReset() {
    const f = this.frames;
    const ll = this.sumLL;
    const rr = this.sumRR;
    const lr = this.sumLR;
    this.sumLL = 0;
    this.sumRR = 0;
    this.sumLR = 0;
    this.frames = 0;
    if (f === 0) {
      return { frames: 0, rmsL: 0, rmsR: 0, midRms: 0, sideRms: 0, correlation: 0 };
    }
    const rmsL = Math.sqrt(ll / f);
    const rmsR = Math.sqrt(rr / f);
    const midRms = Math.sqrt(Math.max(0, ll + rr + 2 * lr) / (4 * f));
    const sideRms = Math.sqrt(Math.max(0, ll + rr - 2 * lr) / (4 * f));
    const denom = Math.sqrt(ll * rr);
    const correlation = denom > 1e-20 ? Math.max(-1, Math.min(1, lr / denom)) : 0;
    return { frames: f, rmsL, rmsR, midRms, sideRms, correlation };
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
    // CLOCKTEST: true fill min/max across the stats window (every read, not the
    // 250ms point-sample) — reveals the real sawtooth amplitude from reader-burst.
    this.winFillMin = 1e9;
    this.winFillMax = 0;
    this.scratch = new Float32Array(128 * this.nc);
    // Tap B stereo meter over the rendered output (3 multiply-adds per frame —
    // negligible, so it is unconditionally on; the main thread decides usage).
    this.meter = new StereoMeterCore();
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
    const fill = this.core.fillFrames();
    if (fill < this.winFillMin) this.winFillMin = fill;
    if (fill > this.winFillMax) this.winFillMax = fill;
    for (let ch = 0; ch < out.length; ch++) {
      const dst = out[ch];
      const srcCh = ch < nc ? ch : nc - 1;
      for (let i = 0; i < nFrames; i++) dst[i] = block[i * nc + srcCh];
    }
    // Tap B: meter the planar output as rendered (mono if the node only has one
    // output channel — that itself is a finding).
    this.meter.writePlanar(out[0], out.length > 1 ? out[1] : null, nFrames);
    if (++this.readsSinceStats >= this.statsEvery) {
      this.readsSinceStats = 0;
      this.port.postMessage({
        type: 'stats',
        snapshot: this.core.snapshot(),
        fillMin: this.winFillMin,
        fillMax: this.winFillMax,
        stereo: this.meter.snapshotAndReset(),
      });
      this.winFillMin = 1e9;
      this.winFillMax = 0;
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(PLAYOUT_PROCESSOR_NAME)}, PlayoutRingProcessor);
`;
function buildPlayoutWorkletCode() {
  const coreSource = JitterBufferCore.toString();
  const meterSource = StereoMeterCore.toString();
  if (!coreSource.startsWith("class")) {
    throw new Error("playout-worklet: JitterBufferCore.toString() is not a class declaration");
  }
  if (!meterSource.startsWith("class")) {
    throw new Error("playout-worklet: StereoMeterCore.toString() is not a class declaration");
  }
  const helper = /\b__(publicField|privateField|decorateClass|decorateParam|name|esDecorate)\b/.exec(
    coreSource + meterSource
  );
  if (helper) {
    throw new Error(
      `playout-worklet: serialized source references the bundler helper "${helper[0]}" — it would be undefined in the worklet. Ensure the build target keeps native class fields (es2022+).`
    );
  }
  return `const JitterBufferCore = ${coreSource};
const StereoMeterCore = ${meterSource};
${PLAYOUT_PROCESSOR_SOURCE}`;
}
function createPlayoutWorkletUrl() {
  const blob2 = new Blob([buildPlayoutWorkletCode()], { type: "application/javascript" });
  return URL.createObjectURL(blob2);
}
const RENDER_QUANTUM = 128;
const DEFAULT_WRITER_FRAME = 240;
const ENABLE_CLOCK_PROBE = false;
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
  // Latest Tap B stereo window (rendered output), piggybacked on worklet stats.
  lastTapB = null;
  // Main-thread decode counters (the worklet owns playout/buffer stats).
  decodeStats = { framesDecoded: 0, samplesPlayed: 0, decodeErrors: 0 };
  // Throttle counter for the [JBUF] observation log.
  jbufLogCount = 0;
  // CLOCKTEST (playout-drift investigation): audio-output (DAC) clock vs wall clock.
  // Compares audioContext.currentTime advance to performance.now() advance over ~60s —
  // the decisive check for whether the audio device clock really differs from the
  // CPU/server clock by the suspected ~290 ppm. Fires once.
  clockT0Wall = 0;
  clockT0Ctx = 0;
  clockLogged = false;
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
  /** Latest Tap B window (stereo-ness of the worklet's rendered output), or null. */
  getTapB() {
    return this.lastTapB ? { ...this.lastTapB } : null;
  }
  /**
   * Snapshot the playout graph's channel-count-relevant state
   * (plan/stereo-diagnostics Phase 3). Null before initialize()/after dispose().
   */
  getAudioGraphReport() {
    const ctx = this.audioContext;
    if (!ctx) return null;
    const dest = ctx.destination;
    const extCtx = ctx;
    return {
      context: {
        sampleRate: ctx.sampleRate,
        state: ctx.state,
        baseLatencyMs: typeof ctx.baseLatency === "number" ? ctx.baseLatency * 1e3 : null,
        outputLatencyMs: typeof extCtx.outputLatency === "number" ? extCtx.outputLatency * 1e3 : null
      },
      destination: {
        channelCount: dest.channelCount,
        maxChannelCount: dest.maxChannelCount,
        channelCountMode: dest.channelCountMode,
        channelInterpretation: dest.channelInterpretation
      },
      worklet: this.workletNode ? {
        outputChannelCount: this.config.channelCount,
        channelCount: this.workletNode.channelCount,
        channelCountMode: this.workletNode.channelCountMode,
        channelInterpretation: this.workletNode.channelInterpretation
      } : null,
      ring: {
        mode: this.sharedStorage ? "sab" : "port",
        writerFrameSamples: this.config.writerFrameSamples,
        numChannels: this.config.channelCount
      },
      configured: {
        sampleRate: this.config.sampleRate,
        channelCount: this.config.channelCount,
        latencyHint: String(this.config.latencyHint)
      }
    };
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
          if (msg.stereo) this.lastTapB = msg.stereo;
          this.logJitter(msg.snapshot, msg.fillMin, msg.fillMax);
          if (ENABLE_CLOCK_PROBE) ;
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
    this.lastTapB = null;
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
  /**
   * CLOCKTEST: compare the audio-output (DAC) clock to the wall clock. `currentTime`
   * advances in the audio render domain; `performance.now()` in the CPU domain. Over
   * ~60s, if the DAC is slower than the CPU/server clock, `currentTime` advances less →
   * negative ppm — which is exactly what produces the drop-dominant ±1 splices. Fires
   * once. Logged unconditionally (it's a deliberate diagnostic).
   */
  clockProbe() {
    if (this.clockLogged || !this.audioContext) return;
    const wall = performance.now();
    const ctxMs = this.audioContext.currentTime * 1e3;
    if (this.clockT0Wall === 0) {
      this.clockT0Wall = wall;
      this.clockT0Ctx = ctxMs;
      const ctx = this.audioContext;
      const base = (ctx.baseLatency ?? 0) * 1e3;
      const out = (ctx.outputLatency ?? 0) * 1e3;
      console.log(
        `[CLOCKTEST] AudioContext baseLatency=${base.toFixed(2)}ms outputLatency=${out.toFixed(2)}ms sampleRate=${this.audioContext.sampleRate} (render-buffer ≈ fill-swing if reader-burst is the cause)`
      );
      return;
    }
    const dWall = wall - this.clockT0Wall;
    if (dWall < 6e4) return;
    const dCtx = ctxMs - this.clockT0Ctx;
    const ppm = (dCtx / dWall - 1) * 1e6;
    console.log(
      `[CLOCKTEST] audio(DAC) clock vs wall: currentTime +${dCtx.toFixed(1)}ms vs performance.now +${dWall.toFixed(1)}ms over ~60s → DAC drift ${ppm >= 0 ? "+" : ""}${ppm.toFixed(1)} ppm (negative = DAC slower than CPU; that's the drop source)`
    );
    this.clockLogged = true;
  }
  logJitter(s, fillMin, fillMax) {
    if (!this.config.debug) return;
    if (this.jbufLogCount++ % 4 !== 0) return;
    const srMs = this.config.sampleRate / 1e3;
    const swing = fillMin !== void 0 && fillMax !== void 0 ? ` swing=${(fillMin / srMs).toFixed(1)}-${(fillMax / srMs).toFixed(1)}ms` : "";
    console.log(
      `[JBUF] fill=${s.fillMs.toFixed(1)}ms${swing} L=${s.lowAllowanceMs.toFixed(1)} H=${s.highAllowanceMs.toFixed(1)} tgt=${s.targetFrames}fr zone=${s.zone} win=${s.lastWindowInserts}/${s.lastWindowDrops} und=${s.underruns} ovr=${s.overruns} lap=${s.laps} ins=${s.samplesInserted} drop=${s.samplesDropped}`
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
  // The MOQ worker hosts the WebTransport + session + datagram read loop + decode
  // (design §11). The main thread drives it by RPC and routes its events. The
  // main-side DatagramRouter is fed by the worker's forwarded non-audio datagrams;
  // subscribers register on it. `sender` proxies publisher sends to the worker.
  workerClient = null;
  datagramRouter = new DatagramRouter();
  sender = null;
  state = ConnectionState.DISCONNECTED;
  // Audio publishing — the capture worklet fills a SAB ring; the worker encodes/sends
  // it (worker-capture-design.md). No main-thread track publisher for audio.
  audioPublisher = null;
  micStarted = false;
  // State publishing
  stateTrackPublisher = null;
  statePublishPending = false;
  statePublishThrottleMs = 50;
  // Throttle state updates to 20Hz max
  lastStatePublishTime = 0;
  // Audio playback
  audioSubscriber = null;
  audioPlayer = null;
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
  // Stereo diagnostics (plan/stereo-diagnostics): latest Tap A window from the
  // worker's decoded-PCM meter + the observed decoder output format.
  lastTapAReport = null;
  lastDecodedFormat = null;
  lastTapALogMs = 0;
  negotiatedSubprotocol = null;
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
      this.workerClient = new MoqWorkerClient(createMoqWorker(), (evt) => this.handleWorkerEvent(evt));
      this.sender = { sendDatagram: (bytes) => this.workerClient.call("sendDatagram", { bytes }) };
      const connectResult = await this.workerClient.call("connect", {
        serverUrl: this.config.serverUrl,
        options,
        debug: this.config.debug
      });
      this.negotiatedSubprotocol = connectResult?.subprotocol ?? null;
      this.setState(ConnectionState.CONNECTED);
      this.log("WebTransport connected (worker), initializing MOQ session...");
      await this.workerClient.call("initSession", { role: MoqRole.PUBSUB });
      this.log("Session initialized, subscribing to output track...");
      const wc = this.workerClient;
      const outputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_OUTPUT, this.config.entityId);
      this.log("Subscribing to:", outputNamespace.join("/"));
      const audioSub = await wc.call("subscribe", { namespace: outputNamespace, trackName: "", authorization: this.config.ticket });
      this.audioOutputTrackAlias = audioSub.trackAlias ?? 0;
      this.log("Audio output subscribed, trackAlias:", this.audioOutputTrackAlias);
      const stateOutputNamespace = generateTrackNamespace(PanaudiaTrackType.STATE_OUTPUT, this.config.entityId);
      const stateSub = await wc.call("subscribe", { namespace: stateOutputNamespace, trackName: "" });
      this.stateOutputTrackAlias = stateSub.trackAlias ?? 0;
      this.log("State output subscribed, trackAlias:", this.stateOutputTrackAlias);
      this.stateSubscriber = new StateSubscriber();
      this.stateSubscriber.attach(this.datagramRouter, this.stateOutputTrackAlias);
      this.stateSubscriber.onState((state) => {
        this.events.emit("entityState", state);
      });
      this.stateSubscriber.start();
      const attributesOutputNamespace = generateTrackNamespace(PanaudiaTrackType.ATTRIBUTES_OUTPUT, this.config.entityId);
      const resumeOpId = this.attributesCache.getHighestOpId();
      const attrsSub = await wc.call("subscribe", {
        namespace: attributesOutputNamespace,
        trackName: "",
        resumeOpId: resumeOpId > 0n ? resumeOpId : void 0
      });
      this.attributesOutputTrackAlias = attrsSub.trackAlias ?? 0;
      this.log("Attributes output subscribed, trackAlias:", this.attributesOutputTrackAlias);
      this.attributesSubscriber = new AttributesSubscriber(this.attributesCache);
      this.attributesSubscriber.attach(this.datagramRouter, this.attributesOutputTrackAlias);
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
      const entitySub = await wc.call("subscribe", {
        namespace: entityOutputNamespace,
        trackName: "",
        resumeOpId: entityResumeOpId > 0n ? entityResumeOpId : void 0
      });
      this.entityOutputTrackAlias = entitySub.trackAlias ?? 0;
      this.log("Entity output subscribed, trackAlias:", this.entityOutputTrackAlias);
      this.entitySubscriber = new EntitySubscriber(this.entityCache);
      this.entitySubscriber.attach(this.datagramRouter, this.entityOutputTrackAlias);
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
        const spaceSub = await wc.call("subscribe", {
          namespace: spaceOutputNamespace,
          trackName: "",
          resumeOpId: spaceResumeOpId > 0n ? spaceResumeOpId : void 0
        });
        this.spaceOutputTrackAlias = spaceSub.trackAlias ?? 0;
        this.log("Space output subscribed, trackAlias:", this.spaceOutputTrackAlias);
        this.spaceSubscriber = new SpaceSubscriber(this.spaceCache);
        this.spaceSubscriber.attach(this.datagramRouter, this.spaceOutputTrackAlias);
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
      await wc.call("announce", { namespace: audioInputNamespace, authorization: this.config.ticket });
      await wc.call("announce", { namespace: stateNamespace, authorization: this.config.ticket });
      await wc.call("announce", { namespace: controlNamespace, authorization: this.config.ticket });
      await wc.call("startMessageLoop", {});
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
    if (this.workerClient) {
      try {
        await this.workerClient.call("disconnect", {});
      } catch {
      }
      this.workerClient.dispose();
      this.workerClient = null;
    }
    this.sender = null;
    this.datagramRouter.clear();
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
    if (!this.workerClient || !this.sender) {
      throw new MoqClientError("No connection available", "NOT_CONNECTED");
    }
    if (!this.audioPublisher) {
      this.audioPublisher = new AudioPublisher({ ...config, debug: this.config.debug });
    }
    await this.audioPublisher.initialize();
    await this.audioPublisher.start();
    this.micStarted = true;
    this.startWorkerCapture();
    this.log("Microphone started");
  }
  /**
   * (Re)start the worker's encode/send for the capture ring. Idempotent on the worker
   * side (`setCaptureTrack` stops any prior capture first), so it is safe to call both
   * when the mic starts and when the in/audio track alias is (re)assigned.
   */
  startWorkerCapture() {
    if (!this.workerClient || !this.audioPublisher || !this.micStarted) return;
    const handoff = this.audioPublisher.getCaptureHandoff();
    if (!handoff) {
      this.logWarn("mic capture needs cross-origin isolation (SAB) — not publishing on this page");
      return;
    }
    void this.workerClient.call("setCaptureTrack", {
      trackAlias: this.audioInputTrackAlias,
      publisherPriority: 0,
      // high priority for audio
      encoderConfig: this.audioPublisher.getEncoderConfig(),
      numChannels: handoff.numChannels,
      capacityFrames: handoff.capacityFrames,
      sharedStorage: handoff.sharedStorage,
      sharedWritePos: handoff.sharedWritePos,
      sharedReadPos: handoff.sharedReadPos,
      sharedSignal: handoff.sharedSignal
    });
    this.log(`worker encoding mic → trackAlias=${this.audioInputTrackAlias} via SAB ring`);
  }
  /**
   * Stop capturing microphone audio
   */
  stopMicrophone() {
    this.micStarted = false;
    if (this.workerClient) {
      void this.workerClient.call("stopCapture", {});
    }
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
    if (!this.workerClient) {
      throw new MoqClientError("No connection available", "NOT_CONNECTED");
    }
    if (!this.audioPlayer) {
      this.audioPlayer = new AudioPlayer({ ...config, debug: this.config.debug });
    }
    if (this.audioPlayer.getState() === AudioPlayerState.IDLE) {
      await this.audioPlayer.initialize();
    }
    this.audioPlayer.start();
    const handoff = this.audioPlayer.prepareForWorker();
    if (handoff?.mode === "sab") {
      await this.workerClient.call("setAudioTrack", {
        trackAlias: this.audioOutputTrackAlias,
        decoderConfig: this.audioPlayer.getDecoderConfig(),
        jbufConfig: handoff.jbufConfig,
        sharedStorage: handoff.sharedStorage,
        sharedWritePos: handoff.sharedWritePos
      });
      this.log(`worker decoding audio trackAlias=${this.audioOutputTrackAlias} via SAB ring`);
    } else {
      this.logWarn("audio playback needs cross-origin isolation (SAB) — not active on this page");
    }
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
   * Stereo diagnostics (plan/stereo-diagnostics): everything needed to localize
   * a mono collapse —
   *  - `tapA`: decoded-PCM stereo-ness (worker; debug mode only)
   *  - `tapB`: rendered-output stereo-ness (playout worklet; always on)
   *  - `decodedFormat`: the decoder's observed output format + copyTo path
   *  - `graph`: channel-count-relevant state of context/destination/worklet/ring
   *  - `userAgent` / `subprotocol`: per-matrix-cell identification
   * Tap A stereo + Tap B mono → graph collapse; both stereo but it *sounds*
   * mono → OS/device (e.g. Bluetooth HFP) or output routing.
   */
  getStereoDiagnostics() {
    return {
      tapA: this.lastTapAReport,
      tapB: this.audioPlayer?.getTapB() ?? null,
      decodedFormat: this.lastDecodedFormat,
      graph: this.audioPlayer?.getAudioGraphReport() ?? null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      subprotocol: this.negotiatedSubprotocol
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
   * Route an event from the MOQ worker (design §11 / worker-transport-design §4):
   * connection-state changes, the server subscribing back to our tracks (→ create
   * publishers), forwarded non-audio datagrams (→ the main-side DatagramRouter,
   * where the subscribers handle them), and diagnostic notices. Audio PCM never
   * arrives here — it goes worker → SAB ring → worklet.
   */
  handleWorkerEvent(evt) {
    switch (evt.type) {
      case "connectionState":
        if (evt.state === String(ConnectionState.ERROR)) {
          this.handleError("connection_error", evt.detail ?? "Connection failed");
        } else if (evt.state === String(ConnectionState.DISCONNECTED)) {
          this.handleDisconnect();
        }
        break;
      case "incomingSubscribe":
        this.handleIncomingSubscribe(evt.namespace, evt.trackAlias);
        break;
      case "datagram":
        this.datagramRouter.ingest({
          trackAlias: evt.trackAlias,
          payload: evt.payload,
          groupId: evt.groupId,
          objectId: evt.objectId
        });
        break;
      case "notice":
        this.log(`[moq-worker] ${evt.event}${evt.detail ? ": " + evt.detail : ""}`);
        break;
      case "stereoMetrics": {
        this.lastTapAReport = evt.report;
        const now = Date.now();
        if (now - this.lastTapALogMs >= 1e3) {
          this.lastTapALogMs = now;
          const r = evt.report;
          this.log(
            `[stereo] tapA rmsL=${r.rmsL.toFixed(4)} rmsR=${r.rmsR.toFixed(4)} corr=${r.correlation.toFixed(3)} side=${r.sideRms.toFixed(4)} mid=${r.midRms.toFixed(4)}`
          );
        }
        break;
      }
      case "decodedFormat": {
        this.lastDecodedFormat = evt.format;
        const f = evt.format;
        this.log(
          `[stereo] decoded format: ${f.numberOfChannels}ch @ ${f.sampleRate}Hz native=${f.nativeFormat ?? "?"} copy=${f.copyPath}`
        );
        break;
      }
    }
  }
  /**
   * The server subscribed to one of our announced input tracks — (re)create the
   * matching publisher bound to the worker-backed sender. (Was the inline
   * session.onIncomingSubscribe callback before the transport moved to the worker.)
   */
  handleIncomingSubscribe(namespace, trackAlias) {
    const nsPath = namespace.join("/");
    this.log(`Server subscribed to ${nsPath} with trackAlias=${trackAlias}`);
    if (!this.sender) return;
    if (nsPath.includes("in/audio")) {
      this.audioInputTrackAlias = trackAlias;
      this.startWorkerCapture();
    }
    if (nsPath.includes("state/") && !nsPath.includes("out/state")) {
      this.stateTrackAlias = trackAlias;
      if (this.stateTrackPublisher) this.stateTrackPublisher.detach();
      this.stateTrackPublisher = new StateTrackPublisher({ trackAlias: this.stateTrackAlias, publisherPriority: 1 });
      this.stateTrackPublisher.attach(this.sender);
      this.log(`Recreated stateTrackPublisher with trackAlias=${this.stateTrackAlias}`);
    }
    if (nsPath.includes("in/control")) {
      this.controlTrackAlias = trackAlias;
      if (this.controlTrackPublisher) this.controlTrackPublisher.detach();
      this.controlTrackPublisher = new ControlTrackPublisher({ trackAlias: this.controlTrackAlias, publisherPriority: 2 });
      this.controlTrackPublisher.attach(this.sender);
      this.log(`Created controlTrackPublisher with trackAlias=${this.controlTrackAlias}`);
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
    if (this.workerClient) {
      this.workerClient.dispose();
      this.workerClient = null;
    }
    this.sender = null;
    this.datagramRouter.clear();
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
    try {
      await this.client.startMicrophone({
        ...this.microphoneId ? { deviceId: this.microphoneId } : {},
        ...audio?.echoCancellation !== void 0 ? { echoCancellation: audio.echoCancellation } : {},
        ...audio?.noiseSuppression !== void 0 ? { noiseSuppression: audio.noiseSuppression } : {},
        ...audio?.autoGainControl !== void 0 ? { autoGainControl: audio.autoGainControl } : {}
      });
    } catch (e) {
      console.warn("[panaudia] startMicrophone failed; staying connected without mic:", e);
    }
    try {
      await this.client.startPlayback();
    } catch (e) {
      console.warn("[panaudia] startPlayback failed; staying connected without playback:", e);
    }
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
  getStereoDiagnostics() {
    return this.client?.getStereoDiagnostics() ?? {
      tapA: null,
      tapB: null,
      decodedFormat: null,
      graph: null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      subprotocol: null
    };
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
  buildCaptureWorkletCode as $,
  AnnouncementError as A,
  BluetoothMicDefaultError as B,
  CAPTURE_PROCESSOR_NAME as C,
  MoqMessageType as D,
  EntitySubscriber as E,
  MoqRole as F,
  MoqTransportAdapter as G,
  PLAYOUT_TUNING as H,
  InvalidStateError as I,
  JitterBufferCore as J,
  PanaudiaMoqClient as K,
  PanaudiaTrackType as L,
  MoqClientError as M,
  ProtocolError as N,
  StateTrackPublisher as O,
  PLAYOUT_PROCESSOR_NAME as P,
  StereoMeterCore as Q,
  SubscriptionError as R,
  StateSubscriber as S,
  TimeoutError as T,
  TrackPublisher as U,
  aframeToPanaudia as V,
  WebTransportNotSupportedError as W,
  ambisonicToWebglPosition as X,
  ambisonicToWebglRotation as Y,
  babylonToPanaudia as Z,
  buildAnnounce as _,
  AttributesSubscriber as a,
  buildClientSetup as a0,
  buildObjectDatagram as a1,
  buildPlayoutWorkletCode as a2,
  buildSubscribe as a3,
  buildUnannounce as a4,
  buildUnsubscribe as a5,
  captureCapacityFrames as a6,
  computeJitterCapacity as a7,
  createCaptureWorkletUrl as a8,
  createPlayoutWorkletUrl as a9,
  parseSubscribeOk as aA,
  pixiToPanaudia as aB,
  playcanvasToPanaudia as aC,
  threejsToPanaudia as aD,
  unityToPanaudia as aE,
  unrealToPanaudia as aF,
  webglToAmbisonicPosition as aG,
  webglToAmbisonicRotation as aH,
  wrapError as aI,
  decodeBytes as aa,
  decodeString as ab,
  encodeBytes as ac,
  encodeString as ad,
  encodeVarint as ae,
  generateTrackNamespace as af,
  getAudioCapabilities as ag,
  getAudioPlaybackCapabilities as ah,
  getBestOpusMimeType as ai,
  getMoqErrorMessage as aj,
  getWebTransportSupport as ak,
  isAudioPlaybackSupported as al,
  isOpusSupported as am,
  isWebTransportSupported as an,
  panaudiaToAframe as ao,
  panaudiaToBabylon as ap,
  panaudiaToPixi as aq,
  panaudiaToPlaycanvas as ar,
  panaudiaToThreejs as as,
  panaudiaToUnity as at,
  panaudiaToUnreal as au,
  parseAnnounceError as av,
  parseAnnounceOk as aw,
  parseMessageType as ax,
  parseServerSetup as ay,
  parseSubscribeError as az,
  AudioDecoderNotSupportedError as b,
  AudioEncodingError as c,
  decodeVarint as d,
  encodeObjectDatagramInto as e,
  AudioNotSupportedError as f,
  AudioPermissionError as g,
  AudioPlayer as h,
  AudioPlayerState as i,
  AudioPublisher as j,
  AudioPublisherState as k,
  AudioTrackPublisher as l,
  maxObjectDatagramSize as m,
  AuthenticationError as n,
  CacheTopicSubscriber as o,
  parseObjectDatagram as p,
  CaptureRing as q,
  ConnectionError as r,
  ControlTrackPublisher as s,
  JwtParseError as t,
  MOQ_TRANSPORT_VERSION as u,
  MessageBuilder as v,
  MoqConnection as w,
  MoqErrorCode as x,
  MoqFilterType as y,
  MoqForwardingPreference as z
};
