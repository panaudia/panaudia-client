/**
 * Control Track Publisher - Publishes control messages (mute/unmute) via MOQ
 *
 * Sends JSON-encoded control messages to the server's control input track.
 */

import { TrackPublisher, TrackPublisherConfig } from './track-publisher.js';

import type { ControlMessage } from '../types.js';

/**
 * Control Track Publisher
 *
 * Publishes JSON control messages (mute/unmute) as MOQ objects.
 */
export class ControlTrackPublisher extends TrackPublisher {
  constructor(config: TrackPublisherConfig) {
    super(config);
    this.setGroupDuration(5000); // Long groups for infrequent control messages
  }

  /**
   * Publish a control message
   */
  async publishControlMessage(msg: ControlMessage): Promise<void> {
    const json = JSON.stringify(msg);
    const data = new TextEncoder().encode(json);
    await this.publish(data);
  }
}
