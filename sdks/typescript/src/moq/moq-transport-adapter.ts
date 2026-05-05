/**
 * MOQ Transport Adapter — wraps PanaudiaMoqClient to implement the Transport interface.
 */

import type { Transport, TransportConfig, AudioCaptureConfig, AudioPlaybackConfig } from '../transport.js';
import { ConnectionState } from '../types.js';
import type { EntityInfo3, ControlMessage, EntityState, WarningEvent, ClientEventType } from '../types.js';
import { PanaudiaMoqClient } from './client.js';
import type { PanaudiaConfig } from './types.js';

export class MoqTransportAdapter implements Transport {
  private client: PanaudiaMoqClient | null = null;
  private microphoneId?: string;

  async connect(config: TransportConfig): Promise<void> {
    this.microphoneId = config.microphoneId;

    // Append connection params to the server URL so they reach the
    // WebTransport upgrade request on the server (same as WebRTC query string).
    let serverUrl = config.serverUrl;
    const url = new URL(serverUrl);

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
    if (config.presence !== false) {
      url.searchParams.set('presence', 'true');
    }
    if (config.queryParams) {
      for (const [key, value] of Object.entries(config.queryParams)) {
        url.searchParams.set(key, value);
      }
    }
    serverUrl = url.toString();

    const moqConfig: PanaudiaConfig = {
      serverUrl,
      ticket: config.ticket,
      entityId: config.entityId,
      initialPosition: config.initialPosition,
      initialRotation: config.initialRotation,
      debug: config.debug,
    };
    this.client = new PanaudiaMoqClient(moqConfig);

    // Forward events registered before connect
    for (const [event, handler] of this.pendingHandlers) {
      this.client.on(event as ClientEventType, handler);
    }
    this.pendingHandlers = [];

    await this.client.connect();

    // MOQ requires explicit audio start (unlike WebRTC where audio is
    // negotiated as part of the SDP exchange during connect).
    await this.client.startMicrophone(
      this.microphoneId ? { deviceId: this.microphoneId } : undefined,
    );
    await this.client.startPlayback();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.stopMicrophone();
      this.client.stopPlayback();
      await this.client.disconnect();
      this.client = null;
    }
  }

  getState(): ConnectionState {
    if (!this.client) return ConnectionState.DISCONNECTED;
    return this.client.getState();
  }

  getEntityId(): string {
    if (!this.client) throw new Error('Not connected');
    return this.client.getEntityId();
  }

  async startAudioCapture(config?: AudioCaptureConfig): Promise<void> {
    await this.requireClient().startMicrophone(config ? {
      sampleRate: config.sampleRate,
      channelCount: config.channelCount,
      echoCancellation: config.echoCancellation,
      noiseSuppression: config.noiseSuppression,
      autoGainControl: config.autoGainControl,
    } : undefined);
  }

  async stopAudioCapture(): Promise<void> {
    this.requireClient().stopMicrophone();
  }

  async startAudioPlayback(config?: AudioPlaybackConfig): Promise<void> {
    await this.requireClient().startPlayback(config ? {
      sampleRate: config.sampleRate,
      channelCount: config.channelCount,
    } : undefined);
  }

  async stopAudioPlayback(): Promise<void> {
    this.requireClient().stopPlayback();
  }

  setVolume(volume: number): void {
    this.requireClient().setVolume(volume);
  }

  getVolume(): number {
    return this.client?.getVolume() ?? 1;
  }

  muteMic(): void {
    // PanaudiaMoqClient doesn't have a direct muteMic — stop microphone
    this.requireClient().stopMicrophone();
  }

  unmuteMic(): void {
    // Re-start microphone to unmute
    this.requireClient().startMicrophone();
  }

  async publishState(state: EntityInfo3): Promise<void> {
    const client = this.requireClient();
    client.setPosition(state.position);
    client.setRotation(state.rotation);
    await client.publishState();
  }

  async publishControl(msg: ControlMessage): Promise<void> {
    const client = this.requireClient();
    if (msg.type === 'mute') {
      await client.mute(msg.message.node);
    } else if (msg.type === 'unmute') {
      await client.unmute(msg.message.node);
    } else if (msg.type === 'command') {
      await client.command(msg.message.command, msg.message.args);
    }
  }

  // Event registration — buffer handlers if client not yet created
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingHandlers: Array<[ClientEventType, (event: any) => void]> = [];

  onEntityState(handler: (state: EntityState) => void): void {
    this.registerHandler('entityState', handler);
  }

  onAttributeValues(handler: (values: Array<{ key: string; value: string }>) => void): void {
    this.registerHandler('attributes', handler);
  }

  onAttributeRemoved(handler: (keys: string[]) => void): void {
    this.registerHandler('attributesRemoved', handler);
  }

  onEntityValues(handler: (values: Array<{ key: string; value: string }>) => void): void {
    this.registerHandler('entity', handler);
  }

  onEntityRemoved(handler: (keys: string[]) => void): void {
    this.registerHandler('entityRemoved', handler);
  }

  onSpaceValues(handler: (values: Array<{ key: string; value: string }>) => void): void {
    this.registerHandler('space', handler);
  }

  onSpaceRemoved(handler: (keys: string[]) => void): void {
    this.registerHandler('spaceRemoved', handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCacheDebug(handler: (info: any) => void): void {
    this.registerHandler('cacheDebug', handler);
  }

  onConnectionStateChange(handler: (state: ConnectionState) => void): void {
    this.registerHandler('statechange', (event: { currentState: ConnectionState }) => {
      handler(event.currentState);
    });
  }

  onError(handler: (error: Error) => void): void {
    this.registerHandler('error', (event: { code: string; message: string }) => {
      handler(new Error(event.message));
    });
  }

  onWarning(handler: (warning: WarningEvent) => void): void {
    this.registerHandler('warning', handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private registerHandler(event: ClientEventType, handler: (event: any) => void): void {
    if (this.client) {
      this.client.on(event, handler);
    } else {
      this.pendingHandlers.push([event, handler]);
    }
  }

  private requireClient(): PanaudiaMoqClient {
    if (!this.client) throw new Error('Not connected');
    return this.client;
  }
}
