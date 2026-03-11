import { Transport, TransportConfig, AudioCaptureConfig, AudioPlaybackConfig } from '../transport.js';
import { ConnectionState, EntityInfo3, ControlMessage, EntityState, EntityAttributes } from '../types.js';
export declare class MoqTransportAdapter implements Transport {
    private client;
    private microphoneId?;
    connect(config: TransportConfig): Promise<void>;
    disconnect(): Promise<void>;
    getState(): ConnectionState;
    getEntityId(): string;
    startAudioCapture(config?: AudioCaptureConfig): Promise<void>;
    stopAudioCapture(): Promise<void>;
    startAudioPlayback(config?: AudioPlaybackConfig): Promise<void>;
    stopAudioPlayback(): Promise<void>;
    setVolume(volume: number): void;
    getVolume(): number;
    muteMic(): void;
    unmuteMic(): void;
    publishState(state: EntityInfo3): Promise<void>;
    publishControl(msg: ControlMessage): Promise<void>;
    private pendingHandlers;
    onEntityState(handler: (state: EntityState) => void): void;
    onAttributes(handler: (attrs: EntityAttributes) => void): void;
    onConnectionStateChange(handler: (state: ConnectionState) => void): void;
    onError(handler: (error: Error) => void): void;
    private registerHandler;
    private requireClient;
}
//# sourceMappingURL=moq-transport-adapter.d.ts.map