import { TrackPublisher, TrackPublisherConfig } from './track-publisher.js';
import { ControlMessage } from '../types.js';
/**
 * Control Track Publisher
 *
 * Publishes JSON control messages (mute/unmute) as MOQ objects.
 */
export declare class ControlTrackPublisher extends TrackPublisher {
    constructor(config: TrackPublisherConfig);
    /**
     * Publish a control message
     */
    publishControlMessage(msg: ControlMessage): Promise<void>;
}
//# sourceMappingURL=control-publisher.d.ts.map