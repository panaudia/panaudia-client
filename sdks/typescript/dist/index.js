var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { C as ConnectionState, c as createEntityInfo3 } from "./topic-merger.js";
import { E, T, b, e, a, i, u } from "./topic-merger.js";
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
const byteToHex = [];
for (let i2 = 0; i2 < 256; ++i2) {
  byteToHex.push((i2 + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
let getRandomValues;
const rnds8 = new Uint8Array(16);
function rng() {
  if (!getRandomValues) {
    if (typeof crypto === "undefined" || !crypto.getRandomValues) {
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    }
    getRandomValues = crypto.getRandomValues.bind(crypto);
  }
  return getRandomValues(rnds8);
}
const randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
const native = { randomUUID };
function v4(options, buf, offset) {
  var _a;
  if (native.randomUUID && true && !options) {
    return native.randomUUID();
  }
  options = options || {};
  const rnds = options.random ?? ((_a = options.rng) == null ? void 0 : _a.call(options)) ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
class TopicTree {
  constructor() {
    __publicField(this, "records", /* @__PURE__ */ new Map());
  }
  /**
   * Apply a batch of values from one envelope.
   * Existing uuids are mutated in place; new uuids are built fully then
   * inserted atomically. Returns the set of uuids whose subtree changed.
   */
  applyValues(values) {
    const affected = /* @__PURE__ */ new Set();
    const fresh = /* @__PURE__ */ new Map();
    for (const { key, value } of values) {
      const parts = key.split(".");
      const uuid = parts[0];
      if (!uuid) continue;
      let target = fresh.get(uuid) ?? this.records.get(uuid);
      if (target === void 0) {
        target = {};
        fresh.set(uuid, target);
      }
      affected.add(uuid);
      if (parts.length === 1) {
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        continue;
      }
      let node = target;
      for (let i2 = 1; i2 < parts.length - 1; i2++) {
        const seg = parts[i2];
        const child = node[seg];
        if (typeof child !== "object" || child === null || Array.isArray(child)) {
          node[seg] = {};
        }
        node = node[seg];
      }
      node[parts[parts.length - 1]] = parsed;
    }
    for (const [uuid, attrs] of fresh) {
      this.records.set(uuid, attrs);
    }
    return affected;
  }
  /**
   * Apply a batch of tombstones from one envelope.
   * Walks the dotted path for each key and removes the leaf, cleaning up
   * empty intermediate objects. Returns the set of uuids that still have
   * data (`updated`) and uuids whose last leaf was removed (`removed`).
   */
  applyRemoved(keys) {
    const touched = /* @__PURE__ */ new Set();
    for (const key of keys) {
      const parts = key.split(".");
      const uuid = parts[0];
      if (!uuid) continue;
      const target = this.records.get(uuid);
      if (target === void 0) continue;
      touched.add(uuid);
      if (parts.length === 1) {
        this.records.delete(uuid);
        continue;
      }
      this.deletePath(target, parts, 1);
      if (Object.keys(target).length === 0) {
        this.records.delete(uuid);
      }
    }
    const updated = /* @__PURE__ */ new Set();
    const removed = /* @__PURE__ */ new Set();
    for (const uuid of touched) {
      if (this.records.has(uuid)) {
        updated.add(uuid);
      } else {
        removed.add(uuid);
      }
    }
    return { updated, removed };
  }
  /**
   * Get the record for a single uuid.
   */
  get(uuid) {
    return this.records.get(uuid);
  }
  /**
   * Get the full tree as a read-only map of `uuid -> record`.
   */
  getAll() {
    return this.records;
  }
  /**
   * Number of records in the tree.
   */
  get size() {
    return this.records.size;
  }
  /**
   * Drop all records.
   */
  clear() {
    this.records.clear();
  }
  deletePath(node, parts, index) {
    const seg = parts[index];
    if (index === parts.length - 1) {
      delete node[seg];
      return;
    }
    const child = node[seg];
    if (typeof child === "object" && child !== null && !Array.isArray(child)) {
      this.deletePath(child, parts, index + 1);
      if (Object.keys(child).length === 0) {
        delete node[seg];
      }
    }
  }
}
class SingleRecordTree {
  constructor() {
    __publicField(this, "record", {});
  }
  /**
   * Apply a batch of values from one envelope. Existing leaves are
   * overwritten; intermediate path segments are created on demand.
   * Returns true if any leaf changed (the unified client uses this
   * to decide whether to emit a tree-change event).
   */
  applyValues(values) {
    let changed = false;
    for (const { key, value } of values) {
      const parts = key.split(".");
      if (parts.length === 0 || parts[0] === "") continue;
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        continue;
      }
      let node = this.record;
      for (let i2 = 0; i2 < parts.length - 1; i2++) {
        const seg = parts[i2];
        const child = node[seg];
        if (typeof child !== "object" || child === null || Array.isArray(child)) {
          node[seg] = {};
        }
        node = node[seg];
      }
      const leaf = parts[parts.length - 1];
      node[leaf] = parsed;
      changed = true;
    }
    return changed;
  }
  /**
   * Apply a batch of tombstones from one envelope. Walks the dotted
   * path for each key and removes the leaf, cleaning up empty
   * intermediate objects. Returns true if anything was removed.
   */
  applyRemoved(keys) {
    let changed = false;
    for (const key of keys) {
      const parts = key.split(".");
      if (parts.length === 0 || parts[0] === "") continue;
      if (this.deletePath(this.record, parts, 0)) {
        changed = true;
      }
    }
    return changed;
  }
  /** Get the entire reconstructed record as a read-only object. */
  get() {
    return this.record;
  }
  /** Number of top-level fields in the record. */
  get size() {
    return Object.keys(this.record).length;
  }
  /** Drop all entries. */
  clear() {
    this.record = {};
  }
  deletePath(node, parts, index) {
    const seg = parts[index];
    if (index === parts.length - 1) {
      if (seg in node) {
        delete node[seg];
        return true;
      }
      return false;
    }
    const child = node[seg];
    if (typeof child !== "object" || child === null || Array.isArray(child)) {
      return false;
    }
    const removed = this.deletePath(child, parts, index + 1);
    if (removed && Object.keys(child).length === 0) {
      delete node[seg];
    }
    return removed;
  }
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
    // Structured per-participant view of attribute state, kept in sync with
    // the flat values/removed events from the transport.
    __publicField(this, "attributeTree", new TopicTree());
    // Structured per-entity view of server-internal entity state, kept in
    // sync with the flat entity values/removed events. The server filters
    // the stream so only this client's own entity record arrives.
    __publicField(this, "entityTree", new TopicTree());
    // Space-wide role-rule record (roles-muted, roles-kicked,
    // roles-gain, roles-attenuation). Single nested object — no
    // per-uuid grouping since the topic's keys are uuid-less. Stays
    // empty for connections without the `space.read` cap (no envelopes
    // arrive). See plan/commands/space-read-path-plan.md.
    __publicField(this, "spaceTree", new SingleRecordTree());
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
    this.transport.onAttributeValues((values) => {
      this.emit("attributes", values);
      const affected = this.attributeTree.applyValues(values);
      for (const uuid of affected) {
        const attrs = this.attributeTree.get(uuid);
        if (attrs) this.emit("attributeTreeChange", uuid, attrs);
      }
    });
    this.transport.onAttributeRemoved((keys) => {
      this.emit("attributesRemoved", keys);
      const { updated, removed } = this.attributeTree.applyRemoved(keys);
      for (const uuid of updated) {
        const attrs = this.attributeTree.get(uuid);
        if (attrs) this.emit("attributeTreeChange", uuid, attrs);
      }
      for (const uuid of removed) {
        this.emit("attributeTreeRemove", uuid);
      }
    });
    this.transport.onEntityValues((values) => {
      this.emit("entity", values);
      const affected = this.entityTree.applyValues(values);
      for (const uuid of affected) {
        const record = this.entityTree.get(uuid);
        if (record) this.emit("entityTreeChange", uuid, record);
      }
    });
    this.transport.onEntityRemoved((keys) => {
      this.emit("entityRemoved", keys);
      const { updated, removed } = this.entityTree.applyRemoved(keys);
      for (const uuid of updated) {
        const record = this.entityTree.get(uuid);
        if (record) this.emit("entityTreeChange", uuid, record);
      }
      for (const uuid of removed) {
        this.emit("entityTreeRemove", uuid);
      }
    });
    this.transport.onSpaceValues((values) => {
      this.emit("space", values);
      if (this.spaceTree.applyValues(values)) {
        this.emit("spaceTreeChange", this.spaceTree.get());
      }
    });
    this.transport.onSpaceRemoved((keys) => {
      this.emit("spaceRemoved", keys);
      if (this.spaceTree.applyRemoved(keys)) {
        this.emit("spaceTreeChange", this.spaceTree.get());
      }
    });
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
    this.transport.onCacheDebug((info) => {
      this.emit("cacheDebug", info);
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
    let entityId = this.config.entityId;
    const queryParams = { ...this.config.queryParams ?? {} };
    if (!this.config.ticket) {
      if (!entityId) entityId = v4();
      if (!queryParams["uuid"]) queryParams["uuid"] = entityId;
    }
    await this.transport.connect({
      serverUrl: this.config.serverUrl,
      ticket: this.config.ticket,
      entityId,
      initialPosition: this.position,
      initialRotation: this.rotation,
      presence: this.config.presence,
      queryParams,
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
  /**
   * Invoke a named command from the server's command catalog
   * (see `plan/commands/command_types.md`). Args are command-specific —
   * for example `space.entity.mute` takes `{entity_id}` and
   * `personal.role.mute` takes `{role}`.
   *
   * Strict-MVC: this fires-and-forgets. The server applies the command
   * (if the holder's roles allow it) and the resulting cache op flows
   * back through the entity / attribute streams. Failed authorisation,
   * unknown command names and bad arguments all silently drop on the
   * server — clients infer success from the absence or presence of an
   * echoed op. There is no per-call error path by design.
   */
  async command(name, args = {}) {
    await this.transport.publishControl({
      type: "command",
      message: { command: name, args }
    });
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
  /**
   * Get the structured per-participant attribute tree, keyed by uuid.
   * Maintained automatically from incoming attribute values and tombstones.
   */
  getAttributeTree() {
    return this.attributeTree.getAll();
  }
  /**
   * Get a single participant's attributes, or undefined if unknown.
   */
  getAttributes(uuid) {
    return this.attributeTree.get(uuid);
  }
  /**
   * Get the structured per-entity tree, keyed by uuid. Maintained
   * automatically from incoming entity values and tombstones. Under the
   * current server-side filter the only uuid this map will contain is
   * the client's own (`getEntityId()`).
   */
  getEntityTree() {
    return this.entityTree.getAll();
  }
  /**
   * Get a single entity's record, or undefined if unknown. Pass
   * `getEntityId()` to retrieve this client's own record.
   */
  getEntity(uuid) {
    return this.entityTree.get(uuid);
  }
  /**
   * Get the space-wide role-rule record (roles-muted, roles-kicked,
   * roles-gain, roles-attenuation). Empty for connections without
   * the `space.read` read cap.
   */
  getSpace() {
    return this.spaceTree.get();
  }
  // ── Internal ─────────────────────────────────────────────────────────
  emit(event, ...args) {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(...args);
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
  SingleRecordTree,
  T as TopicMerger,
  TopicTree,
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
