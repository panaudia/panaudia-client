import { M as MoqClientError, m as maxObjectDatagramSize, e as encodeObjectDatagramInto, J as JitterBufferCore, d as decodeVarint, p as parseObjectDatagram } from "../moq-transport-adapter.js";
import { A, a, b, c, f, g, h, i, j, k, l, n, B, C, o, q, r, s, E, I, t, u, v, w, x, y, z, D, F, G, P, H, K, L, N, S, O, Q, R, T, U, W, V, X, Y, Z, _, $, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, aa, ab, ac, ad, ae, af, ag, ah, ai, aj, ak, al, am, an, ao, ap, aq, ar, as, at, au, av, aw, ax, ay, az, aA, aB, aC, aD, aE, aF, aG, aH, aI, aJ } from "../moq-transport-adapter.js";
import { C as C2, a as a10, E as E2, b as b2, c as c2, d, e, f as f2, g as g2, i as i2, h as h2, u as u2 } from "../topic-merger.js";
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
class CaptureEncoder {
  ring;
  trackAlias;
  sampleRate;
  nc;
  priority;
  encoder;
  send;
  // Reused scratch — the zero-alloc hot path (design §6/§8).
  pcmScratch;
  // drained interleaved PCM
  bytesScratch;
  // Opus bytes (encoder output copyTo)
  dgPool;
  // framed OBJECT_DATAGRAMs, round-robin (see config)
  dgPoolIdx;
  // Sequencing (lifted from AudioTrackPublisher): input timestamp is a running sample
  // count; objectId is a monotonic counter; groupId is the chunk timestamp in ms.
  samplesSent;
  objectSeq;
  // Observability.
  encodedBatches;
  sentDatagrams;
  droppedOversize;
  constructor(cfg) {
    this.ring = cfg.ring;
    this.trackAlias = cfg.trackAlias;
    this.sampleRate = cfg.sampleRate;
    this.nc = cfg.numChannels;
    this.priority = cfg.publisherPriority ?? 0;
    this.send = cfg.send;
    const maxPayload = cfg.maxPayloadBytes ?? 4e3;
    this.pcmScratch = new Float32Array(cfg.ring.capacity * this.nc);
    this.bytesScratch = new Uint8Array(maxPayload);
    const poolSize = cfg.datagramPoolSize ?? 8;
    this.dgPool = [];
    for (let i3 = 0; i3 < poolSize; i3++) {
      this.dgPool.push(new Uint8Array(maxObjectDatagramSize(maxPayload)));
    }
    this.dgPoolIdx = 0;
    this.samplesSent = 0;
    this.objectSeq = 0n;
    this.encodedBatches = 0;
    this.sentDatagrams = 0;
    this.droppedOversize = 0;
    this.encoder = cfg.makeEncoder((chunk) => this.handleChunk(chunk));
  }
  /**
   * Drain all PCM currently in the ring and feed it to the encoder as one AudioData.
   * Called on each wake (design §6.1). Returns the interleaved sample count encoded (0
   * if the ring was empty). Opus does the 240-frame packetization internally.
   */
  pump() {
    const n2 = this.ring.drain(this.pcmScratch);
    if (n2 <= 0) {
      return 0;
    }
    const frames = n2 / this.nc;
    const timestampUs = Math.round(this.samplesSent / this.sampleRate * 1e6);
    this.encoder.encode(this.pcmScratch.subarray(0, n2), frames, timestampUs);
    this.samplesSent += frames;
    this.encodedBatches++;
    return n2;
  }
  /** Encoder output: frame the Opus packet into reused scratch and send it. No alloc. */
  handleChunk(chunk) {
    const size = chunk.byteLength;
    if (size === 0) {
      return;
    }
    if (size > this.bytesScratch.length) {
      this.droppedOversize++;
      return;
    }
    chunk.copyTo(this.bytesScratch);
    const groupId = BigInt(Math.floor(chunk.timestamp / 1e3));
    const objectId = this.objectSeq++;
    const dg = this.dgPool[this.dgPoolIdx];
    this.dgPoolIdx = (this.dgPoolIdx + 1) % this.dgPool.length;
    const len = encodeObjectDatagramInto(
      dg,
      this.trackAlias,
      groupId,
      objectId,
      this.priority,
      this.bytesScratch.subarray(0, size)
    );
    this.send(dg.subarray(0, len));
    this.sentDatagrams++;
  }
  /** Flush any buffered Opus packet (fires `handleChunk`) and close the encoder. */
  async stop() {
    try {
      await this.encoder.flush();
    } catch {
    }
    this.encoder.close();
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
  f as AudioNotSupportedError,
  g as AudioPermissionError,
  h as AudioPlayer,
  i as AudioPlayerState,
  j as AudioPublisher,
  k as AudioPublisherState,
  AudioSubscriber,
  AudioSubscriberState,
  l as AudioTrackPublisher,
  n as AuthenticationError,
  B as BluetoothMicDefaultError,
  C as CAPTURE_PROCESSOR_NAME,
  C2 as CacheMap,
  o as CacheTopicSubscriber,
  CaptureEncoder,
  q as CaptureRing,
  r as ConnectionError,
  a10 as ConnectionState,
  s as ControlTrackPublisher,
  E2 as ENTITY_INFO3_SIZE,
  E as EntitySubscriber,
  I as InvalidStateError,
  JitterBufferCore,
  t as JwtParseError,
  u as MOQ_TRANSPORT_VERSION,
  v as MessageBuilder,
  MoqClientError,
  w as MoqConnection,
  x as MoqErrorCode,
  y as MoqFilterType,
  z as MoqForwardingPreference,
  D as MoqMessageType,
  F as MoqRole,
  G as MoqTransportAdapter,
  P as PLAYOUT_PROCESSOR_NAME,
  H as PLAYOUT_TUNING,
  K as PanaudiaMoqClient,
  L as PanaudiaTrackType,
  N as ProtocolError,
  S as StateSubscriber,
  O as StateTrackPublisher,
  Q as StereoMeterCore,
  R as SubscriptionError,
  T as TimeoutError,
  U as TrackPublisher,
  W as WebTransportNotSupportedError,
  V as aframeToPanaudia,
  X as ambisonicToWebglPosition,
  Y as ambisonicToWebglRotation,
  audioReceiveWorkerSupported,
  Z as babylonToPanaudia,
  _ as buildAnnounce,
  $ as buildCaptureWorkletCode,
  a0 as buildClientSetup,
  a1 as buildObjectDatagram,
  a2 as buildPlayoutWorkletCode,
  buildReceiveWorkerCode,
  a3 as buildSubscribe,
  a4 as buildUnannounce,
  a5 as buildUnsubscribe,
  b2 as bytesToUuid,
  a6 as captureCapacityFrames,
  a7 as computeJitterCapacity,
  a8 as createCaptureWorkletUrl,
  c2 as createEntityInfo3,
  a9 as createPlayoutWorkletUrl,
  createReceiveWorkerUrl,
  aa as decodeBytes,
  d as decodeCacheOp,
  ab as decodeString,
  decodeVarint,
  ac as encodeBytes,
  e as encodeCacheOp,
  ad as encodeString,
  ae as encodeVarint,
  f2 as entityInfo3FromBytes,
  g2 as entityInfo3ToBytes,
  af as generateTrackNamespace,
  ag as getAudioCapabilities,
  getAudioDecoderCapabilities,
  ah as getAudioPlaybackCapabilities,
  ai as getBestOpusMimeType,
  aj as getMoqErrorMessage,
  ak as getWebTransportSupport,
  isAudioDecoderSupported,
  al as isAudioPlaybackSupported,
  i2 as isCacheEnvelope,
  am as isOpusSupported,
  h2 as isValidUuid,
  an as isWebTransportSupported,
  ao as panaudiaToAframe,
  ap as panaudiaToBabylon,
  aq as panaudiaToPixi,
  ar as panaudiaToPlaycanvas,
  as as panaudiaToThreejs,
  at as panaudiaToUnity,
  au as panaudiaToUnreal,
  av as parseAnnounceError,
  aw as parseAnnounceOk,
  ax as parseMessageType,
  parseObjectDatagram,
  ay as parseServerSetup,
  az as parseSubscribeError,
  aA as parseSubscribeOk,
  aB as pixiToPanaudia,
  aC as playcanvasToPanaudia,
  aD as probeOutputDeviceSampleRate,
  routeDatagram,
  aE as threejsToPanaudia,
  aF as unityToPanaudia,
  aG as unrealToPanaudia,
  u2 as uuidToBytes,
  aH as webglToAmbisonicPosition,
  aI as webglToAmbisonicRotation,
  aJ as wrapError
};
