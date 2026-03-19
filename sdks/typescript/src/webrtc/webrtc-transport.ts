/**
 * WebRTC Transport — wraps WebSocket signaling + RTCPeerConnection
 * to implement the Transport interface.
 */

import type { Transport, TransportConfig, AudioCaptureConfig, AudioPlaybackConfig } from '../transport.js';
import { ConnectionState } from '../types.js';
import type { EntityInfo3, ControlMessage, EntityState, EntityAttributes, WarningEvent } from '../types.js';
import { entityInfo3ToBytes, entityInfo3FromBytes, ENTITY_INFO3_SIZE } from '../shared/encoding.js';

type EventHandler<T> = (event: T) => void;

/** Extract node ID (jti) from JWT payload without validation */
function extractEntityIdFromJwt(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(atob(b64));
  if (!payload.jti) throw new Error('JWT missing jti (entity ID)');
  return payload.jti;
}

export class WebRtcTransport implements Transport {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dcState: RTCDataChannel | null = null;
  private dcControl: RTCDataChannel | null = null;
  private micStream: MediaStream | null = null;
  private micTracks: MediaStreamTrack[] = [];
  private audioElement: HTMLAudioElement | null = null;
  private incomingStream: MediaStream | null = null;

  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private entityId: string = '';
  private microphoneId?: string;

  // Event handlers
  private entityStateHandlers: EventHandler<EntityState>[] = [];
  private attributesHandlers: EventHandler<EntityAttributes>[] = [];
  private connectionStateHandlers: EventHandler<ConnectionState>[] = [];
  private errorHandlers: EventHandler<Error>[] = [];
  private warningHandlers: EventHandler<WarningEvent>[] = [];

  async connect(config: TransportConfig): Promise<void> {
    this.entityId = config.entityId ?? extractEntityIdFromJwt(config.ticket);
    this.microphoneId = config.microphoneId;

    this.setState(ConnectionState.CONNECTING);

    // Create RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.l.google.com:5349' },
        { urls: 'stun:stun1.l.google.com:3478' },
      ],
    });

    this.setupPeerConnection();

    // Capture mic BEFORE signaling — tracks must be in the SDP offer/answer
    // Bluetooth mic check is handled by PanaudiaClient.connect() before
    // transport setup, so both MOQ and WebRTC behave identically.
    const constraints: MediaTrackConstraints = {
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
      sampleRate: 48000,
      ...(this.microphoneId ? { deviceId: { exact: this.microphoneId } } : {}),
    };

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    this.micTracks = this.micStream.getAudioTracks();

    for (const track of this.micTracks) {
      this.pc.addTrack(track, this.micStream);
    }

    // Build WebSocket URL with ticket and initial position
    const wsUrl = this.buildWsUrl(config);

    // Connect WebSocket
    await this.connectWebSocket(wsUrl);
  }

  async disconnect(): Promise<void> {
    // Stop mic tracks
    for (const track of this.micTracks) {
      track.stop();
    }
    this.micTracks = [];
    this.micStream = null;

    // Stop audio playback
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    // Close data channels
    this.dcState?.close();
    this.dcControl?.close();
    this.dcState = null;
    this.dcControl = null;

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
  }

  getState(): ConnectionState {
    return this.state;
  }

  getEntityId(): string {
    if (!this.entityId) throw new Error('Not connected');
    return this.entityId;
  }

  async startAudioCapture(config?: AudioCaptureConfig): Promise<void> {
    if (!this.pc) throw new Error('Not connected');

    const constraints: MediaTrackConstraints = {
      autoGainControl: config?.autoGainControl ?? false,
      echoCancellation: config?.echoCancellation ?? false,
      noiseSuppression: config?.noiseSuppression ?? false,
      sampleRate: config?.sampleRate ?? 48000,
      ...(this.microphoneId ? { deviceId: { exact: this.microphoneId } } : {}),
    };

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    this.micTracks = this.micStream.getAudioTracks();

    for (const track of this.micTracks) {
      this.pc.addTrack(track, this.micStream);
    }
  }

  async stopAudioCapture(): Promise<void> {
    for (const track of this.micTracks) {
      track.stop();
    }
    this.micTracks = [];
    this.micStream = null;
  }

  async startAudioPlayback(_config?: AudioPlaybackConfig): Promise<void> {
    if (!this.incomingStream) return;

    if (!this.audioElement) {
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;
      // Hidden audio element — no need to add to DOM for playback
    }

    this.audioElement.srcObject = this.incomingStream;
    await this.audioElement.play();
  }

  async stopAudioPlayback(): Promise<void> {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
    }
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.audioElement) {
      this.audioElement.volume = clamped;
    }
  }

  getVolume(): number {
    return this.audioElement?.volume ?? 1;
  }

  muteMic(): void {
    for (const track of this.micTracks) {
      track.enabled = false;
    }
  }

  unmuteMic(): void {
    for (const track of this.micTracks) {
      track.enabled = true;
    }
  }

  async publishState(state: EntityInfo3): Promise<void> {
    if (!this.dcState || this.dcState.readyState !== 'open') return;
    const bytes = entityInfo3ToBytes(state);
    this.dcState.send(new Uint8Array(bytes) as unknown as ArrayBuffer);
  }

  async publishControl(msg: ControlMessage): Promise<void> {
    if (!this.dcControl || this.dcControl.readyState !== 'open') return;
    this.dcControl.send(JSON.stringify(msg));
  }

  onEntityState(handler: EventHandler<EntityState>): void {
    this.entityStateHandlers.push(handler);
  }

  onAttributes(handler: EventHandler<EntityAttributes>): void {
    this.attributesHandlers.push(handler);
  }

  onConnectionStateChange(handler: EventHandler<ConnectionState>): void {
    this.connectionStateHandlers.push(handler);
  }

  onError(handler: EventHandler<Error>): void {
    this.errorHandlers.push(handler);
  }

  onWarning(handler: EventHandler<WarningEvent>): void {
    this.warningHandlers.push(handler);
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const handler of this.connectionStateHandlers) {
      try { handler(state); } catch { /* ignore */ }
    }
  }

  private emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try { handler(error); } catch { /* ignore */ }
    }
  }

  private buildWsUrl(config: TransportConfig): string {
    // serverUrl is expected to be wss://host:port/join (from resolveServer)
    const url = new URL(config.serverUrl);
    url.searchParams.set('ticket', config.ticket);

    if (config.initialPosition) {
      url.searchParams.set('x', String(config.initialPosition.x));
      url.searchParams.set('y', String(config.initialPosition.y));
      url.searchParams.set('z', String(config.initialPosition.z));
    }
    if (config.initialRotation) {
      url.searchParams.set('yaw', String(config.initialRotation.yaw));
      url.searchParams.set('pitch', String(config.initialRotation.pitch));
      url.searchParams.set('roll', String(config.initialRotation.roll));
    }

    // presence=true enables state/attributes data channels
    if (config.presence !== false) {
      url.searchParams.set('presence', 'true');
    }

    // Additional query parameters (custom connection attributes)
    if (config.queryParams) {
      for (const [key, value] of Object.entries(config.queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  private setupPeerConnection(): void {
    if (!this.pc) return;

    // ICE candidates → send to server via WebSocket
    this.pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.candidate !== '') {
        this.wsSend({ event: 'candidate', data: JSON.stringify(e.candidate) });
      }
    };

    // Incoming audio track — start playback immediately (matches old SDK)
    this.pc.ontrack = (event) => {
      this.incomingStream = event.streams[0] ?? null;
      this.setState(ConnectionState.CONNECTED);

      if (this.incomingStream) {
        if (!this.audioElement) {
          this.audioElement = document.createElement('audio');
          this.audioElement.autoplay = true;
        }
        this.audioElement.srcObject = this.incomingStream;
        this.audioElement.play().catch(() => {});
      }
    };

    // Data channels created by the server
    this.pc.ondatachannel = (ev) => {
      const channel = ev.channel;

      if (channel.label === 'state') {
        this.dcState = channel;
        channel.binaryType = 'arraybuffer';
        channel.onopen = () => {
          this.setState(ConnectionState.AUTHENTICATED);
        };
        channel.onmessage = (msg) => {
          this.handleStateMessage(msg.data);
        };
      } else if (channel.label === 'control') {
        this.dcControl = channel;
      } else if (channel.label === 'attributes') {
        channel.onmessage = (msg) => {
          this.handleAttributesMessage(msg.data);
        };
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'failed') {
        this.emitError(new Error('WebRTC connection failed'));
        this.setState(ConnectionState.ERROR);
      }
    };
  }

  private connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // WebSocket open — wait for SDP offer from server
      };

      this.ws.onmessage = (evt) => {
        let msg: { event: string; data: string };
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }

        switch (msg.event) {
          case 'offer':
            this.handleOffer(JSON.parse(msg.data)).then(resolve).catch(reject);
            break;
          case 'candidate':
            this.pc?.addIceCandidate(JSON.parse(msg.data)).catch(() => {});
            break;
          case 'error': {
            const errorMsg = JSON.parse(msg.data);
            this.emitError(new Error(errorMsg.message ?? 'Server error'));
            this.setState(ConnectionState.ERROR);
            reject(new Error(errorMsg.message ?? 'Server error'));
            break;
          }
        }
      };

      this.ws.onclose = () => {
        this.setState(ConnectionState.DISCONNECTED);
      };

      this.ws.onerror = () => {
        const err = new Error('WebSocket connection failed');
        this.emitError(err);
        reject(err);
      };
    });
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('No peer connection');

    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();

    // Stereo SDP hack — same as the original SDK
    if (answer.sdp) {
      answer.sdp = answer.sdp.replace(
        'a=fmtp:111 ',
        'a=fmtp:111 stereo=1; sprop-stereo=1; ',
      );
    }

    await this.pc.setLocalDescription(answer);
    this.wsSend({ event: 'answer', data: JSON.stringify(answer) });
  }

  private wsSend(msg: { event: string; data: string }): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleStateMessage(data: ArrayBuffer | Blob): void {
    if (data instanceof ArrayBuffer) {
      this.parseStateBuffer(data);
    } else if (data instanceof Blob) {
      // Legacy path — convert Blob to ArrayBuffer
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          this.parseStateBuffer(reader.result);
        }
      };
      reader.readAsArrayBuffer(data);
    }
  }

  private parseStateBuffer(buffer: ArrayBuffer): void {
    if (buffer.byteLength !== ENTITY_INFO3_SIZE) return;

    const bytes = new Uint8Array(buffer);
    const info = entityInfo3FromBytes(bytes);

    const state: EntityState = {
      uuid: info.uuid,
      position: info.position,
      rotation: info.rotation,
      volume: info.volume,
      gone: info.gone,
    };

    for (const handler of this.entityStateHandlers) {
      try { handler(state); } catch { /* ignore */ }
    }
  }

  private handleAttributesMessage(data: string): void {
    try {
      const info = JSON.parse(data);
      const attrs: EntityAttributes = {
        uuid: info.uuid,
        name: info.name,
        ticket: info.ticket,
        connection: info.connection,
      };
      for (const handler of this.attributesHandlers) {
        try { handler(attrs); } catch { /* ignore */ }
      }
    } catch {
      // Malformed attributes JSON — ignore
    }
  }
}
