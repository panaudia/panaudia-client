import { C as ConnectionState, T as TopicMerger, a as entityInfo3ToBytes, E as ENTITY_INFO3_SIZE, e as entityInfo3FromBytes } from "../topic-merger.js";
function extractEntityIdFromJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const payload = JSON.parse(atob(b64));
  if (!payload.jti) throw new Error("JWT missing jti (entity ID)");
  return payload.jti;
}
class WebRtcTransport {
  ws = null;
  pc = null;
  dcState = null;
  dcControl = null;
  micStream = null;
  micTracks = [];
  audioElement = null;
  incomingStream = null;
  state = ConnectionState.DISCONNECTED;
  entityId = "";
  microphoneId;
  // Event handlers
  entityStateHandlers = [];
  attributesHandlers = [];
  attributesRemovedHandlers = [];
  entityHandlers = [];
  entityRemovedHandlers = [];
  spaceHandlers = [];
  spaceRemovedHandlers = [];
  connectionStateHandlers = [];
  errorHandlers = [];
  warningHandlers = [];
  // Per-topic merge gates. Without these, an out-of-order arrival on
  // the data channel (stale backfill envelope landing after a newer
  // live envelope for the same key) would let the older value clobber
  // the newer one, since TopicTree.applyValues is opId-blind. The MOQ
  // path runs the same gate inside CacheTopicSubscriber.
  attributesMerger = new TopicMerger();
  entityMerger = new TopicMerger();
  spaceMerger = new TopicMerger();
  cacheDebugHandlers = [];
  constructor() {
    const dispatch = (info) => {
      for (const h of this.cacheDebugHandlers) {
        try {
          h(info);
        } catch {
        }
      }
    };
    this.attributesMerger.setDebugHandler(dispatch);
    this.entityMerger.setDebugHandler(dispatch);
    this.spaceMerger.setDebugHandler(dispatch);
  }
  async connect(config) {
    if (config.entityId) {
      this.entityId = config.entityId;
    } else if (config.ticket) {
      this.entityId = extractEntityIdFromJwt(config.ticket);
    } else {
      throw new Error("either ticket or entityId is required");
    }
    this.microphoneId = config.microphoneId;
    this.setState(ConnectionState.CONNECTING);
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.l.google.com:5349" },
        { urls: "stun:stun1.l.google.com:3478" }
      ]
    });
    this.setupPeerConnection();
    const audio = config.audio;
    const constraints = {
      autoGainControl: audio?.autoGainControl ?? false,
      echoCancellation: audio?.echoCancellation ?? false,
      noiseSuppression: audio?.noiseSuppression ?? false,
      sampleRate: 48e3,
      ...this.microphoneId ? { deviceId: { exact: this.microphoneId } } : {}
    };
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    this.micTracks = this.micStream.getAudioTracks();
    for (const track of this.micTracks) {
      this.pc.addTrack(track, this.micStream);
    }
    const wsUrl = this.buildWsUrl(config);
    await this.connectWebSocket(wsUrl);
  }
  async disconnect() {
    for (const track of this.micTracks) {
      track.stop();
    }
    this.micTracks = [];
    this.micStream = null;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }
    this.dcState?.close();
    this.dcControl?.close();
    this.dcState = null;
    this.dcControl = null;
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
  }
  getState() {
    return this.state;
  }
  getEntityId() {
    if (!this.entityId) throw new Error("Not connected");
    return this.entityId;
  }
  async startAudioCapture(config) {
    if (!this.pc) throw new Error("Not connected");
    const constraints = {
      autoGainControl: config?.autoGainControl ?? false,
      echoCancellation: config?.echoCancellation ?? false,
      noiseSuppression: config?.noiseSuppression ?? false,
      sampleRate: 48e3,
      ...this.microphoneId ? { deviceId: { exact: this.microphoneId } } : {}
    };
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    this.micTracks = this.micStream.getAudioTracks();
    for (const track of this.micTracks) {
      this.pc.addTrack(track, this.micStream);
    }
  }
  async stopAudioCapture() {
    for (const track of this.micTracks) {
      track.stop();
    }
    this.micTracks = [];
    this.micStream = null;
  }
  async startAudioPlayback(_config) {
    if (!this.incomingStream) return;
    if (!this.audioElement) {
      this.audioElement = document.createElement("audio");
      this.audioElement.autoplay = true;
    }
    this.audioElement.srcObject = this.incomingStream;
    await this.audioElement.play();
  }
  async stopAudioPlayback() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
    }
  }
  setVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.audioElement) {
      this.audioElement.volume = clamped;
    }
  }
  getVolume() {
    return this.audioElement?.volume ?? 1;
  }
  muteMic() {
    for (const track of this.micTracks) {
      track.enabled = false;
    }
  }
  unmuteMic() {
    for (const track of this.micTracks) {
      track.enabled = true;
    }
  }
  async publishState(state) {
    if (!this.dcState || this.dcState.readyState !== "open") return;
    const bytes = entityInfo3ToBytes(state);
    this.dcState.send(new Uint8Array(bytes));
  }
  async publishControl(msg) {
    if (!this.dcControl || this.dcControl.readyState !== "open") return;
    this.dcControl.send(JSON.stringify(msg));
  }
  onEntityState(handler) {
    this.entityStateHandlers.push(handler);
  }
  onAttributeValues(handler) {
    this.attributesHandlers.push(handler);
  }
  onAttributeRemoved(handler) {
    this.attributesRemovedHandlers.push(handler);
  }
  onEntityValues(handler) {
    this.entityHandlers.push(handler);
  }
  onEntityRemoved(handler) {
    this.entityRemovedHandlers.push(handler);
  }
  onSpaceValues(handler) {
    this.spaceHandlers.push(handler);
  }
  onSpaceRemoved(handler) {
    this.spaceRemovedHandlers.push(handler);
  }
  onConnectionStateChange(handler) {
    this.connectionStateHandlers.push(handler);
  }
  onError(handler) {
    this.errorHandlers.push(handler);
  }
  onWarning(handler) {
    this.warningHandlers.push(handler);
  }
  onCacheDebug(handler) {
    this.cacheDebugHandlers.push(handler);
  }
  // ── Internal ──────────────────────────────────────────────────────────
  setState(state) {
    this.state = state;
    for (const handler of this.connectionStateHandlers) {
      try {
        handler(state);
      } catch {
      }
    }
  }
  emitError(error) {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch {
      }
    }
  }
  buildWsUrl(config) {
    const url = new URL(config.serverUrl);
    if (config.ticket) {
      url.searchParams.set("ticket", config.ticket);
    }
    if (config.initialPosition) {
      url.searchParams.set("x", String(config.initialPosition.x));
      url.searchParams.set("y", String(config.initialPosition.y));
      url.searchParams.set("z", String(config.initialPosition.z));
    }
    if (config.initialRotation) {
      url.searchParams.set("yaw", String(config.initialRotation.yaw));
      url.searchParams.set("pitch", String(config.initialRotation.pitch));
      url.searchParams.set("roll", String(config.initialRotation.roll));
    }
    if (config.presence !== false) {
      url.searchParams.set("presence", "true");
    }
    if (config.queryParams) {
      for (const [key, value] of Object.entries(config.queryParams)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }
  setupPeerConnection() {
    if (!this.pc) return;
    this.pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.candidate !== "") {
        this.wsSend({ event: "candidate", data: JSON.stringify(e.candidate) });
      }
    };
    this.pc.ontrack = (event) => {
      this.incomingStream = event.streams[0] ?? null;
      this.setState(ConnectionState.CONNECTED);
      if (this.incomingStream) {
        if (!this.audioElement) {
          this.audioElement = document.createElement("audio");
          this.audioElement.autoplay = true;
        }
        this.audioElement.srcObject = this.incomingStream;
        this.audioElement.play().catch(() => {
        });
      }
    };
    this.pc.ondatachannel = (ev) => {
      const channel = ev.channel;
      if (channel.label === "state") {
        this.dcState = channel;
        channel.binaryType = "arraybuffer";
        channel.onopen = () => {
          this.setState(ConnectionState.AUTHENTICATED);
        };
        channel.onmessage = (msg) => {
          this.handleStateMessage(msg.data);
        };
      } else if (channel.label === "control") {
        this.dcControl = channel;
      } else if (channel.label === "attributes") {
        channel.binaryType = "arraybuffer";
        channel.onmessage = (msg) => {
          this.handleAttributesMessage(msg.data);
        };
      } else if (channel.label === "entity") {
        channel.binaryType = "arraybuffer";
        channel.onmessage = (msg) => {
          this.handleEntityMessage(msg.data);
        };
      } else if (channel.label === "space") {
        channel.binaryType = "arraybuffer";
        channel.onmessage = (msg) => {
          this.handleSpaceMessage(msg.data);
        };
      }
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "failed") {
        this.emitError(new Error("WebRTC connection failed"));
        this.setState(ConnectionState.ERROR);
      }
    };
  }
  connectWebSocket(url) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
      };
      this.ws.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        switch (msg.event) {
          case "offer":
            this.handleOffer(JSON.parse(msg.data)).then(resolve).catch(reject);
            break;
          case "candidate":
            this.pc?.addIceCandidate(JSON.parse(msg.data)).catch(() => {
            });
            break;
          case "error": {
            const errorMsg = JSON.parse(msg.data);
            this.emitError(new Error(errorMsg.message ?? "Server error"));
            this.setState(ConnectionState.ERROR);
            reject(new Error(errorMsg.message ?? "Server error"));
            break;
          }
        }
      };
      this.ws.onclose = () => {
        this.setState(ConnectionState.DISCONNECTED);
      };
      this.ws.onerror = () => {
        const err = new Error("WebSocket connection failed");
        this.emitError(err);
        reject(err);
      };
    });
  }
  async handleOffer(offer) {
    if (!this.pc) throw new Error("No peer connection");
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    if (answer.sdp) {
      answer.sdp = answer.sdp.replace(
        "a=fmtp:111 ",
        "a=fmtp:111 stereo=1; sprop-stereo=1; "
      );
    }
    await this.pc.setLocalDescription(answer);
    this.wsSend({ event: "answer", data: JSON.stringify(answer) });
  }
  wsSend(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
  handleStateMessage(data) {
    if (data instanceof ArrayBuffer) {
      this.parseStateBuffer(data);
    } else if (data instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          this.parseStateBuffer(reader.result);
        }
      };
      reader.readAsArrayBuffer(data);
    }
  }
  parseStateBuffer(buffer) {
    if (buffer.byteLength !== ENTITY_INFO3_SIZE) return;
    const bytes = new Uint8Array(buffer);
    const info = entityInfo3FromBytes(bytes);
    const state = {
      uuid: info.uuid,
      position: info.position,
      rotation: info.rotation,
      volume: info.volume,
      gone: info.gone
    };
    for (const handler of this.entityStateHandlers) {
      try {
        handler(state);
      } catch {
      }
    }
  }
  handleAttributesMessage(data) {
    if (typeof data === "string") {
      return;
    }
    const result = this.attributesMerger.applyEnvelope(new Uint8Array(data));
    if (!result) return;
    if (result.accepted.length > 0) {
      for (const h of this.attributesHandlers) {
        try {
          h(result.accepted);
        } catch {
        }
      }
    }
    if (result.tombstoned.length > 0) {
      for (const h of this.attributesRemovedHandlers) {
        try {
          h(result.tombstoned);
        } catch {
        }
      }
    }
  }
  handleEntityMessage(data) {
    if (typeof data === "string") {
      return;
    }
    const result = this.entityMerger.applyEnvelope(new Uint8Array(data));
    if (!result) return;
    if (result.accepted.length > 0) {
      for (const h of this.entityHandlers) {
        try {
          h(result.accepted);
        } catch {
        }
      }
    }
    if (result.tombstoned.length > 0) {
      for (const h of this.entityRemovedHandlers) {
        try {
          h(result.tombstoned);
        } catch {
        }
      }
    }
  }
  handleSpaceMessage(data) {
    if (typeof data === "string") {
      return;
    }
    const result = this.spaceMerger.applyEnvelope(new Uint8Array(data));
    if (!result) return;
    if (result.accepted.length > 0) {
      for (const h of this.spaceHandlers) {
        try {
          h(result.accepted);
        } catch {
        }
      }
    }
    if (result.tombstoned.length > 0) {
      for (const h of this.spaceRemovedHandlers) {
        try {
          h(result.tombstoned);
        } catch {
        }
      }
    }
  }
}
export {
  WebRtcTransport
};
//# sourceMappingURL=index.js.map
