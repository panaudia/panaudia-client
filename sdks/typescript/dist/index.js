var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { C as ConnectionState, c as createEntityInfo3 } from "./encoding.js";
import { E, b, e, a, i, u } from "./encoding.js";
import { isWebTransportSupported, MoqTransportAdapter, BluetoothMicDefaultError } from "./moq/index.js";
import { aframeToPanaudia, ambisonicToWebglPosition, ambisonicToWebglRotation, babylonToPanaudia, getWebTransportSupport, panaudiaToAframe, panaudiaToBabylon, panaudiaToPixi, panaudiaToPlaycanvas, panaudiaToThreejs, panaudiaToUnity, panaudiaToUnreal, pixiToPanaudia, playcanvasToPanaudia, threejsToPanaudia, unityToPanaudia, unrealToPanaudia, webglToAmbisonicPosition, webglToAmbisonicRotation } from "./moq/index.js";
import { WebRtcTransport } from "./webrtc/index.js";
const BLUETOOTH_KEYWORDS = [
  "bluetooth",
  "bt ",
  "bt-",
  // HFP/SCO profile indicators (sometimes exposed in device labels)
  "hands-free",
  "handsfree",
  "hfp",
  "sco",
  "a2dp"
];
const BLUETOOTH_BRANDS = [
  "airpods",
  "beats ",
  "beats+",
  "beatsx",
  "powerbeats",
  "jabra",
  "galaxy buds",
  "buds pro",
  "buds live",
  "buds2",
  "buds fe",
  "sony wh-",
  "sony wf-",
  "bose qc",
  "bose quietcomfort",
  "bose noise cancelling",
  "bose soundsport",
  "bose sport",
  "jbl tune",
  "jbl live",
  "jbl reflect",
  "jbl endurance",
  "sennheiser momentum",
  "sennheiser cx",
  "marshall major",
  "marshall minor",
  "marshall motif",
  "pixel buds",
  "nothing ear",
  "huawei freebuds",
  "oppo enco",
  "oneplus buds",
  "anker soundcore",
  "soundcore liberty",
  "skullcandy",
  "tozo",
  "jlab"
];
const USB_KEYWORDS = [
  "usb",
  // Well-known USB mic brands
  "blue yeti",
  "blue snowball",
  "rode nt-usb",
  "rode podcaster",
  "at2020",
  "at2005",
  "samson",
  "focusrite",
  "scarlett",
  "behringer",
  "presonus",
  "elgato wave",
  "hyperx quadcast",
  "razer seiren",
  "fifine",
  "maono",
  "audio-technica",
  "shure mv"
];
const BUILTIN_KEYWORDS = [
  "built-in",
  "builtin",
  "internal",
  "macbook",
  "imac",
  "integrated",
  "laptop",
  "webcam",
  "facetime"
];
function classifyByLabel(label) {
  const lower = label.toLowerCase();
  for (const keyword of BLUETOOTH_KEYWORDS) {
    if (lower.includes(keyword)) return "bluetooth";
  }
  for (const brand of BLUETOOTH_BRANDS) {
    if (lower.includes(brand)) return "bluetooth";
  }
  for (const keyword of USB_KEYWORDS) {
    if (lower.includes(keyword)) return "usb";
  }
  for (const keyword of BUILTIN_KEYWORDS) {
    if (lower.includes(keyword)) return "builtin";
  }
  return "unknown";
}
async function probeSampleRate(deviceId) {
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false
    });
    const track = stream.getAudioTracks()[0];
    if (!track) return null;
    const settings = track.getSettings();
    return settings.sampleRate ?? null;
  } catch {
    return null;
  } finally {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  }
}
const TYPE_PRIORITY = {
  usb: 0,
  builtin: 1,
  unknown: 2,
  bluetooth: 3
};
function compareMicrophones(a2, b2) {
  return TYPE_PRIORITY[a2.type] - TYPE_PRIORITY[b2.type];
}
async function selectBestMicrophone(debug = false) {
  const log = debug ? (...args) => console.log("[MicSelection]", ...args) : () => {
  };
  let permissionStream = null;
  try {
    permissionStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });
  } finally {
    if (permissionStream) {
      for (const track of permissionStream.getTracks()) {
        track.stop();
      }
    }
  }
  const allDevices = await navigator.mediaDevices.enumerateDevices();
  const mics = allDevices.filter((d) => d.kind === "audioinput").map((d) => ({
    deviceId: d.deviceId,
    label: d.label || "(unlabelled)",
    type: classifyByLabel(d.label || "")
  }));
  log("Enumerated microphones:", mics.map((m) => `${m.label} [${m.type}]`));
  if (mics.length === 0) {
    log("No microphones found, using system default");
    return {
      deviceId: void 0,
      label: "(none)",
      type: "unknown",
      allDevices: [],
      switchedFromBluetooth: false
    };
  }
  const unknowns = mics.filter((m) => m.type === "unknown");
  for (const mic of unknowns) {
    if (mic.deviceId === "default") continue;
    log(`Probing sample rate for: ${mic.label}`);
    const sampleRate = await probeSampleRate(mic.deviceId);
    mic.sampleRate = sampleRate ?? void 0;
    if (sampleRate !== null && sampleRate <= 16e3) {
      log(`  → ${sampleRate} Hz — reclassifying as bluetooth`);
      mic.type = "bluetooth";
    } else if (sampleRate !== null) {
      log(`  → ${sampleRate} Hz — not bluetooth`);
    } else {
      log(`  → probe failed, keeping as unknown`);
    }
  }
  const defaultMic = mics[0];
  const defaultIsBluetooth = defaultMic.type === "bluetooth";
  const ranked = [...mics].sort(compareMicrophones);
  const best = ranked[0];
  log("Ranked microphones:", ranked.map((m) => `${m.label} [${m.type}]`));
  log(`Selected: ${best.label} [${best.type}]`);
  if (defaultIsBluetooth && best.type !== "bluetooth") {
    log(`Switched away from Bluetooth default: ${defaultMic.label}`);
  }
  return {
    deviceId: best.deviceId === "default" ? void 0 : best.deviceId,
    label: best.label,
    type: best.type,
    allDevices: mics,
    switchedFromBluetooth: defaultIsBluetooth && best.type !== "bluetooth"
  };
}
const DEFAULT_GATEWAY_URL = "https://panaudia.com/gateway";
async function resolveServer(ticket, options) {
  const gatewayUrl = (options == null ? void 0 : options.gatewayUrl) ?? DEFAULT_GATEWAY_URL;
  let protocol = (options == null ? void 0 : options.protocol) ?? "auto";
  if (protocol === "auto") {
    protocol = isWebTransportSupported() ? "moq" : "webrtc";
  }
  const url = `${gatewayUrl}?ticket=${encodeURIComponent(ticket)}&protocol=${encodeURIComponent(protocol)}`;
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(
      `Gateway request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (response.status === 401) {
    throw new Error("Gateway authentication failed: invalid or expired ticket");
  }
  if (!response.ok) {
    throw new Error(`Gateway request failed with status ${response.status}`);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Gateway returned invalid JSON");
  }
  if (body.status !== "ok" || !body.url) {
    throw new Error(
      `Gateway resolution failed: ${body.message ?? "unknown error"}`
    );
  }
  return body.url;
}
class PanaudiaClient {
  constructor(config) {
    __publicField(this, "transport");
    __publicField(this, "transportType");
    __publicField(this, "config");
    __publicField(this, "position");
    __publicField(this, "rotation");
    __publicField(this, "statePublishTimer", null);
    __publicField(this, "statePublishPending", false);
    __publicField(this, "stateThrottleMs", 50);
    // 20Hz
    __publicField(this, "muted", false);
    // Event emitter
    __publicField(this, "handlers", /* @__PURE__ */ new Map());
    this.config = config;
    this.position = config.initialPosition ?? { x: 0.5, y: 0.5, z: 0.5 };
    this.rotation = config.initialRotation ?? { yaw: 0, pitch: 0, roll: 0 };
    const choice = config.transport ?? "auto";
    if (choice === "webrtc") {
      this.transport = new WebRtcTransport();
      this.transportType = "webrtc";
    } else if (choice === "moq" || choice === "auto" && isWebTransportSupported()) {
      this.transport = new MoqTransportAdapter();
      this.transportType = "moq";
    } else {
      this.transport = new WebRtcTransport();
      this.transportType = "webrtc";
    }
    this.transport.onEntityState((state) => {
      if (this.config.worldBounds) {
        const { min, max } = this.config.worldBounds;
        const range = max - min;
        const denormalized = {
          ...state,
          position: {
            x: state.position.x * range + min,
            y: state.position.y * range + min,
            z: state.position.z * range + min
          }
        };
        this.emit("entityState", denormalized);
      } else {
        this.emit("entityState", state);
      }
    });
    this.transport.onAttributes((attrs) => this.emit("attributes", attrs));
    this.transport.onConnectionStateChange((state) => {
      if (state === ConnectionState.CONNECTED) this.emit("connected", void 0);
      if (state === ConnectionState.AUTHENTICATED) this.emit("authenticated", void 0);
      if (state === ConnectionState.DISCONNECTED) this.emit("disconnected", void 0);
    });
    this.transport.onError((error) => {
      const event = {
        code: "TRANSPORT_ERROR",
        message: error.message,
        details: error
      };
      this.emit("error", event);
    });
    this.transport.onWarning((warning) => {
      this.emit("warning", warning);
    });
  }
  /**
   * List available microphone devices with type classification.
   * Requests mic permission if not already granted (one prompt, briefly opens default mic).
   */
  static async listMicrophones() {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } finally {
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput").map((d) => ({
      deviceId: d.deviceId,
      label: d.label,
      type: classifyByLabel(d.label)
    }));
  }
  // ── Connection lifecycle ─────────────────────────────────────────────
  async connect() {
    var _a;
    const microphoneId = this.config.microphoneId;
    if ((_a = navigator.mediaDevices) == null ? void 0 : _a.getUserMedia) {
      try {
        const permStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        for (const track of permStream.getTracks()) track.stop();
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label, type: classifyByLabel(d.label) }));
        if (microphoneId) {
          const match = mics.find((m) => m.deviceId === microphoneId);
          if (match && match.type === "bluetooth") {
            this.emit("warning", {
              code: "BLUETOOTH_MIC",
              message: `Bluetooth microphone in use: ${match.label}. Stereo audio may be reduced to mono.`,
              details: { deviceId: microphoneId, label: match.label }
            });
          }
        } else {
          const defaultMic = mics[0];
          if (defaultMic && defaultMic.type === "bluetooth") {
            throw new BluetoothMicDefaultError(defaultMic.label, mics);
          }
        }
      } catch (e2) {
        if (e2 instanceof BluetoothMicDefaultError) throw e2;
      }
    }
    await this.transport.connect({
      serverUrl: this.config.serverUrl,
      ticket: this.config.ticket,
      entityId: this.config.entityId,
      initialPosition: this.position,
      initialRotation: this.rotation,
      presence: this.config.presence,
      queryParams: this.config.queryParams,
      microphoneId: this.config.microphoneId,
      debug: this.config.debug
    });
  }
  async disconnect() {
    this.cancelPendingStatePublish();
    await this.transport.disconnect();
  }
  getState() {
    return this.transport.getState();
  }
  getEntityId() {
    return this.transport.getEntityId();
  }
  getTransportType() {
    return this.transportType;
  }
  // ── Audio ────────────────────────────────────────────────────────────
  muteMic() {
    this.transport.muteMic();
    this.muted = true;
  }
  unmuteMic() {
    this.transport.unmuteMic();
    this.muted = false;
  }
  isMuted() {
    return this.muted;
  }
  /**
   * Set playback volume.
   * @param volume - Volume level from 0.0 (silent) to 1.0 (full volume).
   */
  setVolume(volume) {
    this.transport.setVolume(volume);
  }
  /**
   * Get current playback volume.
   */
  getVolume() {
    return this.transport.getVolume();
  }
  // ── Spatial ──────────────────────────────────────────────────────────
  /**
   * Set pose in Panaudia coordinates (position 0-1 range, rotation in degrees).
   * If worldBounds is configured, positions are normalized from world space to 0-1 range.
   * Accepts a PanaudiaPose — the same type returned by the coordinate converter functions.
   *
   * @example
   * client.setPose(threejsToPanaudia(position, rotation));
   */
  setPose(pose) {
    const { x, y, z } = pose.position;
    const { yaw, pitch, roll } = pose.rotation;
    if (this.config.worldBounds) {
      const { min, max } = this.config.worldBounds;
      const range = max - min;
      this.position = {
        x: (x - min) / range,
        y: (y - min) / range,
        z: (z - min) / range
      };
    } else {
      this.position = { x, y, z };
    }
    this.rotation = { yaw, pitch, roll };
    this.scheduleStatePublish();
  }
  // ── Remote entity control ───────────────────────────────────────────
  async mute(entityId) {
    await this.transport.publishControl({ type: "mute", message: { node: entityId } });
  }
  async unmute(entityId) {
    await this.transport.publishControl({ type: "unmute", message: { node: entityId } });
  }
  // ── Events ───────────────────────────────────────────────────────────
  on(event, handler) {
    let set = this.handlers.get(event);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }
  off(event, handler) {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
    }
  }
  // ── Internal ─────────────────────────────────────────────────────────
  emit(event, data) {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in ${event} handler:`, err);
        }
      }
    }
  }
  scheduleStatePublish() {
    this.statePublishPending = true;
    if (this.statePublishTimer !== null) return;
    this.statePublishTimer = setTimeout(() => {
      this.statePublishTimer = null;
      if (this.statePublishPending) {
        this.statePublishPending = false;
        const connState = this.transport.getState();
        if (connState !== ConnectionState.CONNECTED && connState !== ConnectionState.AUTHENTICATED) {
          return;
        }
        const state = createEntityInfo3(
          this.getEntityId(),
          this.position,
          this.rotation,
          0
          // volume is read-only (server-computed loudness)
        );
        this.transport.publishState(state).catch((err) => {
          console.error("Failed to publish state:", err);
        });
      }
    }, this.stateThrottleMs);
  }
  cancelPendingStatePublish() {
    if (this.statePublishTimer !== null) {
      clearTimeout(this.statePublishTimer);
      this.statePublishTimer = null;
    }
    this.statePublishPending = false;
  }
}
/**
 * Get the recommended non-Bluetooth microphone.
 * Use this to pre-select a device in a mic picker UI.
 * The user should confirm the selection before connecting.
 */
__publicField(PanaudiaClient, "getRecommendedMicrophone", selectBestMicrophone);
export {
  BluetoothMicDefaultError,
  ConnectionState,
  E as ENTITY_INFO3_SIZE,
  PanaudiaClient,
  aframeToPanaudia,
  ambisonicToWebglPosition,
  ambisonicToWebglRotation,
  babylonToPanaudia,
  b as bytesToUuid,
  classifyByLabel,
  createEntityInfo3,
  e as entityInfo3FromBytes,
  a as entityInfo3ToBytes,
  getWebTransportSupport,
  i as isValidUuid,
  isWebTransportSupported,
  panaudiaToAframe,
  panaudiaToBabylon,
  panaudiaToPixi,
  panaudiaToPlaycanvas,
  panaudiaToThreejs,
  panaudiaToUnity,
  panaudiaToUnreal,
  pixiToPanaudia,
  playcanvasToPanaudia,
  resolveServer,
  selectBestMicrophone,
  threejsToPanaudia,
  unityToPanaudia,
  unrealToPanaudia,
  u as uuidToBytes,
  webglToAmbisonicPosition,
  webglToAmbisonicRotation
};
//# sourceMappingURL=index.js.map
