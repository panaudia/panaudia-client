import { M as MoqClientError, J as JitterBufferCore, d as decodeVarint, p as parseObjectDatagram } from "../moq-transport-adapter.js";
import { A, a, b, c, e, f, g, h, i, j, k, l, B, C, m, n, E, I, o, q, r, s, t, u, v, w, x, y, P, z, D, F, G, S, H, K, T, L, W, N, O, Q, R, U, V, X, Y, Z, _, $, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, aa, ab, ac, ad, ae, af, ag, ah, ai, aj, ak, al, am, an, ao, ap, aq, ar, as, at, au, av, aw, ax, ay, az, aA } from "../moq-transport-adapter.js";
import { C as C2, a as a10, E as E2, b as b2, c as c2, d, e as e2, f as f2, g as g2, i as i2, h as h2, u as u2 } from "../topic-merger.js";
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
export {
  A as AnnouncementError,
  a as AttributesSubscriber,
  b as AudioDecoderNotSupportedError,
  c as AudioEncodingError,
  e as AudioNotSupportedError,
  f as AudioPermissionError,
  g as AudioPlayer,
  h as AudioPlayerState,
  i as AudioPublisher,
  j as AudioPublisherState,
  AudioSubscriber,
  AudioSubscriberState,
  k as AudioTrackPublisher,
  l as AuthenticationError,
  B as BluetoothMicDefaultError,
  C2 as CacheMap,
  C as CacheTopicSubscriber,
  m as ConnectionError,
  a10 as ConnectionState,
  n as ControlTrackPublisher,
  E2 as ENTITY_INFO3_SIZE,
  E as EntitySubscriber,
  I as InvalidStateError,
  JitterBufferCore,
  o as JwtParseError,
  q as MOQ_TRANSPORT_VERSION,
  r as MessageBuilder,
  MoqClientError,
  s as MoqConnection,
  t as MoqErrorCode,
  u as MoqFilterType,
  v as MoqForwardingPreference,
  w as MoqMessageType,
  x as MoqRole,
  y as MoqTransportAdapter,
  P as PLAYOUT_PROCESSOR_NAME,
  z as PLAYOUT_TUNING,
  D as PanaudiaMoqClient,
  F as PanaudiaTrackType,
  G as ProtocolError,
  S as StateSubscriber,
  H as StateTrackPublisher,
  K as SubscriptionError,
  T as TimeoutError,
  L as TrackPublisher,
  W as WebTransportNotSupportedError,
  N as aframeToPanaudia,
  O as ambisonicToWebglPosition,
  Q as ambisonicToWebglRotation,
  audioReceiveWorkerSupported,
  R as babylonToPanaudia,
  U as buildAnnounce,
  V as buildClientSetup,
  X as buildObjectDatagram,
  Y as buildPlayoutWorkletCode,
  buildReceiveWorkerCode,
  Z as buildSubscribe,
  _ as buildUnannounce,
  $ as buildUnsubscribe,
  b2 as bytesToUuid,
  a0 as computeJitterCapacity,
  c2 as createEntityInfo3,
  a1 as createPlayoutWorkletUrl,
  createReceiveWorkerUrl,
  a2 as decodeBytes,
  d as decodeCacheOp,
  a3 as decodeString,
  decodeVarint,
  a4 as encodeBytes,
  e2 as encodeCacheOp,
  a5 as encodeString,
  a6 as encodeVarint,
  f2 as entityInfo3FromBytes,
  g2 as entityInfo3ToBytes,
  a7 as generateTrackNamespace,
  a8 as getAudioCapabilities,
  getAudioDecoderCapabilities,
  a9 as getAudioPlaybackCapabilities,
  aa as getBestOpusMimeType,
  ab as getMoqErrorMessage,
  ac as getWebTransportSupport,
  isAudioDecoderSupported,
  ad as isAudioPlaybackSupported,
  i2 as isCacheEnvelope,
  ae as isOpusSupported,
  h2 as isValidUuid,
  af as isWebTransportSupported,
  ag as panaudiaToAframe,
  ah as panaudiaToBabylon,
  ai as panaudiaToPixi,
  aj as panaudiaToPlaycanvas,
  ak as panaudiaToThreejs,
  al as panaudiaToUnity,
  am as panaudiaToUnreal,
  an as parseAnnounceError,
  ao as parseAnnounceOk,
  ap as parseMessageType,
  parseObjectDatagram,
  aq as parseServerSetup,
  ar as parseSubscribeError,
  as as parseSubscribeOk,
  at as pixiToPanaudia,
  au as playcanvasToPanaudia,
  routeDatagram,
  av as threejsToPanaudia,
  aw as unityToPanaudia,
  ax as unrealToPanaudia,
  u2 as uuidToBytes,
  ay as webglToAmbisonicPosition,
  az as webglToAmbisonicRotation,
  aA as wrapError
};
//# sourceMappingURL=index.js.map
