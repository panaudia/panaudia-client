/**
 * moq-worker.ts — the MOQ worker entry (worker-transport-design.md §11 / §4).
 *
 * Owns, OFF THE MAIN THREAD: the WebTransport, MoqConnection, MoqSession (control
 * stream), the datagram read loop, and Opus decode. The main thread orchestrates
 * via the RPC/event protocol (moq-worker-protocol.ts) and never touches the
 * transport or the read loop — so main-thread jank can't stall audio.
 *
 * Datagram handling: the worker reads `datagrams.readable` DIRECTLY (not via
 * MoqConnection's dispatcher — that router lives on the main thread for the
 * subscribers). The audio track is decoded and written straight into the
 * SharedArrayBuffer ring (the worklet reads it); every other track is forwarded
 * to the main thread, where the DatagramRouter + subscribers handle it.
 *
 * Loaded via `?worker&inline` (packaging proven in Phase 0): a self-contained
 * bundled module worker — it `import`s the full stack, no `.toString()` fragility.
 */

import { MoqConnection } from './connection.js';
import { MoqSession } from './session.js';
import { JitterBufferCore } from './jitter-buffer-core.js';
import { parseObjectDatagram } from './moq-transport.js';
import type {
  WorkerRequest,
  WorkerEvent,
  WorkerOutbound,
  WorkerDecoderConfig,
  SubscribeResult,
} from './moq-worker-protocol.js';

// tsconfig lib is DOM (not WebWorker); type the worker globals locally.
interface WorkerCtx {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(m: unknown, transfer?: Transferable[]): void;
}
const ctx = self as unknown as WorkerCtx;

let connection: MoqConnection | null = null;
let session: MoqSession | null = null;
let jbuf: JitterBufferCore | null = null; // SAB writer view for the audio track
let decoder: AudioDecoder | null = null;
let audioTrackAlias: number | undefined;
let reading = false;

function emit(evt: WorkerEvent): void {
  ctx.postMessage(evt satisfies WorkerOutbound);
}

function configureDecoder(cfg: WorkerDecoderConfig): void {
  if (decoder) {
    try {
      decoder.close();
    } catch {
      /* already closed */
    }
  }
  decoder = new AudioDecoder({
    output: (audioData: AudioData) => {
      try {
        const frames = audioData.numberOfFrames;
        const channels = audioData.numberOfChannels;
        const pcm = new Float32Array(frames * channels);
        audioData.copyTo(pcm, { planeIndex: 0, format: 'f32' });
        jbuf?.write(pcm); // straight into the SAB ring — no postMessage
      } catch (e) {
        emit({ kind: 'evt', type: 'notice', event: 'decode-error', detail: String(e) });
      } finally {
        audioData.close();
      }
    },
    error: (e: DOMException) => emit({ kind: 'evt', type: 'notice', event: 'decode-error', detail: String(e) }),
  });
  decoder.configure({
    codec: cfg.codec,
    sampleRate: cfg.sampleRate,
    numberOfChannels: cfg.numberOfChannels,
    optimizeForLatency: true,
  } as AudioDecoderConfig & { optimizeForLatency: boolean });
}

/** Read the datagram readable directly: audio → decode → SAB; everything else → main. */
function startReadLoop(): void {
  if (reading || !connection) return;
  const datagrams = connection.getDatagrams();
  const reader = datagrams.readable.getReader();
  reading = true;
  (async () => {
    try {
      while (reading) {
        const { value, done } = await reader.read();
        if (done) {
          emit({ kind: 'evt', type: 'notice', event: 'reader-done' });
          break;
        }
        if (!value) continue;
        let parsed;
        try {
          parsed = parseObjectDatagram(value);
        } catch {
          continue; // malformed — skip
        }
        if (audioTrackAlias !== undefined && parsed.trackAlias === audioTrackAlias && jbuf && decoder) {
          try {
            decoder.decode(
              new EncodedAudioChunk({
                type: 'key', // Opus frames are always key frames
                timestamp: Number(parsed.groupId) * 1000,
                data: parsed.payload,
              })
            );
          } catch (e) {
            emit({ kind: 'evt', type: 'notice', event: 'decode-error', detail: String(e) });
          }
        } else {
          // Copy the payload (a subarray of the read chunk) so it transfers cleanly.
          const copy = parsed.payload.slice();
          ctx.postMessage(
            {
              kind: 'evt',
              type: 'datagram',
              trackAlias: parsed.trackAlias,
              payload: copy,
              groupId: parsed.groupId,
              objectId: parsed.objectId,
            } satisfies WorkerOutbound,
            // transfer the copy's buffer
            [copy.buffer]
          );
        }
      }
    } catch (e) {
      if (reading) emit({ kind: 'evt', type: 'notice', event: 'reader-error', detail: String(e) });
    } finally {
      reading = false;
    }
  })();
}

async function handle(method: WorkerRequest['method'], args: WorkerRequest['args']): Promise<unknown> {
  switch (method) {
    case 'connect': {
      const a = args as Extract<WorkerRequest, { method: 'connect' }>['args'];
      connection = new MoqConnection(a.serverUrl);
      connection.setHandlers({
        onStateChange: (state, error) =>
          emit({ kind: 'evt', type: 'connectionState', state: String(state), detail: error?.message }),
      });
      await connection.connect(a.options);
      session = new MoqSession(connection);
      session.onIncomingSubscribe((namespace, trackAlias) =>
        emit({ kind: 'evt', type: 'incomingSubscribe', namespace, trackAlias })
      );
      return;
    }
    case 'initSession': {
      const a = args as Extract<WorkerRequest, { method: 'initSession' }>['args'];
      if (!session) throw new Error('initSession before connect');
      await session.initialize(a.role, undefined, a.maxSubscribeId);
      startReadLoop(); // datagrams can arrive right after the session is up
      return;
    }
    case 'subscribe': {
      const a = args as Extract<WorkerRequest, { method: 'subscribe' }>['args'];
      if (!session) throw new Error('subscribe before connect');
      const subscribeId = await session.subscribe(a.namespace, a.trackName, a.authorization, a.resumeOpId);
      return { subscribeId, trackAlias: session.getTrackAlias(subscribeId) } satisfies SubscribeResult;
    }
    case 'announce': {
      const a = args as Extract<WorkerRequest, { method: 'announce' }>['args'];
      if (!session) throw new Error('announce before connect');
      await session.announce(a.namespace, a.authorization);
      return;
    }
    case 'setAudioTrack': {
      const a = args as Extract<WorkerRequest, { method: 'setAudioTrack' }>['args'];
      jbuf = new JitterBufferCore({
        ...a.jbufConfig,
        sharedStorage: a.sharedStorage,
        sharedWritePos: a.sharedWritePos,
      });
      configureDecoder(a.decoderConfig);
      audioTrackAlias = a.trackAlias;
      return;
    }
    case 'sendDatagram': {
      const a = args as Extract<WorkerRequest, { method: 'sendDatagram' }>['args'];
      if (!connection) throw new Error('sendDatagram before connect');
      await connection.sendDatagram(a.bytes);
      return;
    }
    case 'startMessageLoop': {
      if (!session) throw new Error('startMessageLoop before connect');
      session.startMessageLoop();
      return;
    }
    case 'disconnect': {
      reading = false;
      if (decoder) {
        try {
          decoder.close();
        } catch {
          /* ignore */
        }
        decoder = null;
      }
      if (session) {
        await session.close();
        session = null;
      }
      if (connection) {
        connection.close();
        connection = null;
      }
      jbuf = null;
      audioTrackAlias = undefined;
      return;
    }
    default: {
      throw new Error(`unknown method: ${String(method)}`);
    }
  }
}

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as WorkerRequest;
  if (!msg || msg.kind !== 'req') return;
  handle(msg.method, msg.args).then(
    (result) => ctx.postMessage({ kind: 'res', id: msg.id, ok: true, result } satisfies WorkerOutbound),
    (err) => ctx.postMessage({ kind: 'res', id: msg.id, ok: false, error: String(err) } satisfies WorkerOutbound)
  );
};
