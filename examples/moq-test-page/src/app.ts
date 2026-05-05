import './style.css';
import {
  PanaudiaClient,
  ConnectionState,
  isWebTransportSupported,
  getWebTransportSupport,
} from '@panaudia/client';
import type {
  ErrorEvent,
  WarningEvent,
  EntityState,
  MergeDebugInfo,
} from '@panaudia/client';
import type { TopicNode, SingleRecordNode } from '@panaudia/client';

// ── DOM Elements ──────────────────────────────────────────────────────

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const supportGrid = $<HTMLDivElement>('support-grid');
const serverHostInput = $<HTMLInputElement>('server-host');
const transportSelect = $<HTMLSelectElement>('transport-select');
const transportResolvedEl = $<HTMLSpanElement>('transport-resolved');
const colourInput = $<HTMLInputElement>('colour-input');
const colourHexEl = $<HTMLSpanElement>('colour-hex');
const resolvedUrlEl = $<HTMLSpanElement>('resolved-url');
const jwtTokenInput = $<HTMLTextAreaElement>('jwt-token');
const jwtPayloadEl = $<HTMLPreElement>('jwt-payload');
const noTicketCheckbox = $<HTMLInputElement>('no-ticket');
const ticketGroup = $<HTMLDivElement>('ticket-group');
const claimsGroup = $<HTMLDivElement>('claims-group');
const entityIdGroup = $<HTMLDivElement>('entity-id-group');
const entityIdDisplay = $<HTMLSpanElement>('entity-id');
const connectBtn = $<HTMLButtonElement>('connect-btn');
const disconnectBtn = $<HTMLButtonElement>('disconnect-btn');
const connectionStatus = $<HTMLDivElement>('connection-status');

const micBtn = $<HTMLButtonElement>('mic-btn');
const inputMeter = $<HTMLDivElement>('input-meter');
const micStatusEl = $<HTMLSpanElement>('mic-status');
const volumeSlider = $<HTMLInputElement>('volume');
const volumeVal = $<HTMLSpanElement>('volume-val');

const xyPad = $<HTMLDivElement>('xy-pad');
const xyDot = $<HTMLDivElement>('xy-dot');
const xyDotArrow = $<HTMLDivElement>('xy-dot-arrow');
const zSlider = $<HTMLDivElement>('z-slider');
const zThumb = $<HTMLDivElement>('z-thumb');
const posXVal = $<HTMLSpanElement>('pos-x-val');
const posYVal = $<HTMLSpanElement>('pos-y-val');
const posZVal = $<HTMLSpanElement>('pos-z-val');
const rotYawVal = $<HTMLSpanElement>('rot-yaw-val');

const participantsList = $<HTMLDivElement>('participants-list');
const participantsPlaceholder = $<HTMLParagraphElement>('participants-placeholder');
const participantCountEl = $<HTMLSpanElement>('participant-count');

const rolesList = $<HTMLDivElement>('roles-list');
const rolesPlaceholder = $<HTMLParagraphElement>('roles-placeholder');
const rolesCountEl = $<HTMLSpanElement>('roles-count');

const spacePanel = $<HTMLDivElement>('space-panel');
const spaceRecordEl = $<HTMLPreElement>('space-record');

const logEl = $<HTMLDivElement>('log');
const clearLogBtn = $<HTMLButtonElement>('clear-log-btn');

// ── State ─────────────────────────────────────────────────────────────

let client: PanaudiaClient | null = null;
let micMuted = false;

// Pose (authoritative source of truth for the pad/slider/knob controls)
const pose = { x: 0.5, y: 0.5, z: 0.5, yaw: 0 };

// Input metering
let inputAnalyser: AnalyserNode | null = null;
let inputStream: MediaStream | null = null;
let inputAudioCtx: AudioContext | null = null;
let inputAnimFrame = 0;

// Participants and attributes tracking
const participants = new Map<string, EntityState>();
const attributeTree = new Map<string, TopicNode>();
const peerDotEls = new Map<string, HTMLDivElement>();
let selfEntityId = '';

// Entity tracking — today the server filters the entity stream to self,
// so we generally only see ops keyed under our own uuid. The map is keyed
// per-uuid so that when the privileged-read path lands (see
// spatial-mixer/plan/commands/entity-read-path-plan.md "Open questions")
// we automatically pick up other participants' records too. The op log
// stays self-only for now — it tracks the raw wire for hand-debugging.
const ENTITY_OP_LOG_LIMIT = 60;
const entityOpLog: Array<{ time: string; key: string; kind: 'set' | 'tomb'; value?: string }> = [];
const entityRecords = new Map<string, TopicNode>();

// Append-only set of role names seen in any entity record. Roles are
// never removed even if the holder leaves — the panel acts as a running
// catalogue for sending role-targeted commands.
const knownRoles = new Set<string>();

// Cards in the Participants and Roles panels are collapsed to their
// header by default; clicking expands the picked card and collapses any
// previously expanded one in the same panel.
let selectedParticipantUuid: string | null = null;
let selectedRole: string | null = null;

// Per-cell argument values typed by the user, preserved across the
// full-card re-renders that fire on every attribute / entity update.
// Without this, anything you type into a number input gets clobbered
// on the next render (every ~4 s in steady state). Keyed by
// `${kind}|${scope}|${cmd}|${arg}` where kind is 'participant'|'role'.
const argValueOverrides = new Map<string, string>();
function argKey(kind: 'participant' | 'role', scope: string, cmd: string, arg: string): string {
  return `${kind}|${scope}|${cmd}|${arg}`;
}

// ── Logging ───────────────────────────────────────────────────────────

type LogLevel = 'info' | 'success' | 'warn' | 'error';

function log(msg: string, level: LogLevel = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${level}`;
  const now = new Date();
  const time = now.toLocaleTimeString('en-GB', { hour12: false });
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  entry.innerHTML = `<span class="time">${time}.${ms}</span> ${escapeHtml(msg)}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(s: unknown): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

clearLogBtn.addEventListener('click', () => {
  logEl.innerHTML = '';
});

// ── Browser Support Check ─────────────────────────────────────────────

function checkBrowserSupport() {
  const checks = [
    { name: 'WebTransport', supported: isWebTransportSupported() },
    { name: 'Web Audio', supported: typeof AudioContext !== 'undefined' },
    { name: 'getUserMedia', supported: !!(navigator.mediaDevices?.getUserMedia) },
    { name: 'WebCodecs (AudioEncoder)', supported: typeof AudioEncoder !== 'undefined' },
    { name: 'WebCodecs (AudioDecoder)', supported: typeof AudioDecoder !== 'undefined' },
    { name: 'RTCPeerConnection', supported: typeof RTCPeerConnection !== 'undefined' },
  ];

  const wtSupport = getWebTransportSupport();
  checks.push(
    { name: 'WT Datagrams', supported: wtSupport.datagrams },
    { name: 'WT Cert Hashes', supported: wtSupport.serverCertificateHashes },
  );

  for (const check of checks) {
    const item = document.createElement('div');
    item.className = 'support-item';
    const cls = check.supported ? 'support-yes' : 'support-no';
    const icon = check.supported ? '✓' : '✗';
    item.innerHTML = `<span class="icon ${cls}">${icon}</span> <span>${check.name}</span>`;
    supportGrid.appendChild(item);
  }

  // The summary indicator tracks the same condition as resolveTransport():
  // auto picks MOQ iff WebTransport is available.
  const moqOk = isWebTransportSupported();
  const indicator = $<HTMLSpanElement>('moq-support-indicator');
  indicator.textContent = moqOk ? '✓' : '✗';
  indicator.className = `support-indicator ${moqOk ? 'yes' : 'no'}`;
}

// ── JWT Helpers ────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;
    // JWTs use base64url encoding; normalise to base64 before atob()
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function extractEntityId(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const candidate = payload['jti'] ?? payload['sub'] ?? payload['node_id'] ?? payload['nodeId'];
  return typeof candidate === 'string' ? candidate : null;
}

function updateIdentityVisibility() {
  const noTicket = noTicketCheckbox.checked;
  const hasToken = jwtTokenInput.value.trim().length > 0;
  ticketGroup.classList.toggle('hidden', noTicket);
  // Claims only meaningful when there's a pasted token to decode.
  claimsGroup.classList.toggle('hidden', noTicket || !hasToken);
  // Entity ID is shown when a token is pasted (extracted from JWT) or
  // when running tokenless (the server will mint one).
  entityIdGroup.classList.toggle('hidden', !noTicket && !hasToken);
}

jwtTokenInput.addEventListener('input', () => {
  const token = jwtTokenInput.value.trim();
  updateIdentityVisibility();
  if (!token) {
    entityIdDisplay.textContent = '—';
    jwtPayloadEl.textContent = '—';
    jwtPayloadEl.classList.remove('error');
    return;
  }
  const payload = decodeJwtPayload(token);
  if (payload) {
    jwtPayloadEl.textContent = JSON.stringify(payload, null, 2);
    jwtPayloadEl.classList.remove('error');
    entityIdDisplay.textContent = extractEntityId(payload) || '(no id claim)';
  } else {
    jwtPayloadEl.textContent = '(invalid JWT)';
    jwtPayloadEl.classList.add('error');
    entityIdDisplay.textContent = '(could not extract)';
  }
});

// ── Connection ────────────────────────────────────────────────────────

function updateConnectionStatus(state: ConnectionState) {
  connectionStatus.className = 'status';
  switch (state) {
    case ConnectionState.DISCONNECTED:
      connectionStatus.textContent = 'Disconnected';
      break;
    case ConnectionState.CONNECTING:
      connectionStatus.textContent = 'Connecting...';
      connectionStatus.classList.add('connecting');
      break;
    case ConnectionState.CONNECTED:
      connectionStatus.textContent = 'Connected (authenticating...)';
      connectionStatus.classList.add('connected');
      break;
    case ConnectionState.AUTHENTICATED:
      connectionStatus.textContent = 'Authenticated';
      connectionStatus.classList.add('authenticated');
      break;
    case ConnectionState.ERROR:
      connectionStatus.textContent = 'Error';
      connectionStatus.classList.add('error');
      break;
  }
}

function setConnectedUI(connected: boolean) {
  connectBtn.hidden = connected;
  disconnectBtn.hidden = !connected;
  serverHostInput.disabled = connected;
  transportSelect.disabled = connected;
  jwtTokenInput.disabled = connected;
  noTicketCheckbox.disabled = connected;
  micBtn.disabled = !connected;
  document.body.classList.toggle('connected', connected);
}

function applyTicketMode() {
  updateIdentityVisibility();
  if (noTicketCheckbox.checked) {
    entityIdDisplay.textContent = '(will be generated on connect)';
  } else {
    // Trigger the token input handler to refresh the entity id readout
    jwtTokenInput.dispatchEvent(new Event('input'));
  }
}

noTicketCheckbox.addEventListener('change', applyTicketMode);

type TransportChoice = 'auto' | 'moq' | 'webrtc';
type ResolvedTransport = 'moq' | 'webrtc';

function resolveTransport(choice: TransportChoice): ResolvedTransport {
  if (choice === 'moq') return 'moq';
  if (choice === 'webrtc') return 'webrtc';
  return isWebTransportSupported() ? 'moq' : 'webrtc';
}

function getColourHex(): string {
  // <input type="color"> always yields #rrggbb; strip the leading #
  return colourInput.value.replace(/^#/, '').toLowerCase();
}

function buildServerUrl(host: string, transport: ResolvedTransport, colour: string): string {
  const trimmed = host.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) return '';
  const base = transport === 'moq'
    ? `https://${trimmed}/moq`
    : `wss://${trimmed}/join`;
  const url = new URL(base);
  if (colour) url.searchParams.set('colour', colour);
  return url.toString();
}

function updateResolution() {
  const choice = transportSelect.value as TransportChoice;
  const resolved = resolveTransport(choice);
  transportResolvedEl.textContent = choice === resolved ? resolved : `${choice} → ${resolved}`;
  const colour = getColourHex();
  colourHexEl.textContent = colour;
  const hash = `#${colour}`;
  xyDot.style.background = hash;
  xyDot.style.boxShadow = `0 0 6px ${hash}b3`;
  xyDotArrow.style.setProperty('--arrow-colour', hash);
  const url = buildServerUrl(serverHostInput.value, resolved, colour);
  resolvedUrlEl.textContent = url || '—';
}

serverHostInput.addEventListener('input', updateResolution);
transportSelect.addEventListener('change', updateResolution);
colourInput.addEventListener('input', updateResolution);

connectBtn.addEventListener('click', async () => {
  const host = serverHostInput.value.trim();
  const ticket = jwtTokenInput.value.trim();
  const noTicket = noTicketCheckbox.checked;
  const choice = transportSelect.value as TransportChoice;
  const resolved = resolveTransport(choice);
  const colour = getColourHex();
  const serverUrl = buildServerUrl(host, resolved, colour);

  if (!host) {
    log('Server Host is required (e.g. dev.panaudia.com:4443)', 'error');
    return;
  }
  if (!noTicket && !ticket) {
    log('JWT token is required (or tick "Connect without ticket")', 'error');
    return;
  }

  log(`Connecting to ${serverUrl} (transport: ${resolved}${noTicket ? ', tokenless' : ''})...`);
  setConnectedUI(true);

  try {
    client = new PanaudiaClient({
      serverUrl,
      ticket: noTicket ? undefined : ticket,
      transport: choice,
      initialPosition: { x: pose.x, y: pose.y, z: pose.z },
      initialRotation: { yaw: pose.yaw, pitch: 0, roll: 0 },
    });

    client.on('connected', () => {
      log('Transport session established', 'success');
      updateConnectionStatus(ConnectionState.CONNECTED);
    });

    client.on('authenticated', () => {
      log('Authenticated successfully', 'success');
      const id = client!.getEntityId();
      entityIdDisplay.textContent = id;
      selfEntityId = id;
      updateConnectionStatus(ConnectionState.AUTHENTICATED);
      micMuted = client!.isMuted();
      updateMicUI();
      applyVolume();
      startInputMeter();
      // Pull the current entity record in case ops landed before our
      // event handlers were wired (rare with the synchronous mock setup
      // but possible if the SDK adds buffering later).
      const initial = client!.getEntity(id);
      if (initial) {
        applyEntityRecord(id, initial);
      }
    });

    client.on('entityState', handleEntityState);
    client.on('attributeTreeChange', handleAttributeTreeChange);
    client.on('attributeTreeRemove', handleAttributeTreeRemove);
    client.on('entity', handleEntityRawValues);
    client.on('entityRemoved', handleEntityRawRemoved);
    client.on('entityTreeChange', handleEntityTreeChange);
    client.on('entityTreeRemove', handleEntityTreeRemove);
    client.on('spaceTreeChange', handleSpaceTreeChange);

    client.on('error', (e: ErrorEvent) => {
      log(`Error [${e.code}]: ${e.message}`, 'error');
    });

    client.on('warning', (w: WarningEvent) => {
      log(`Warning [${w.code}]: ${w.message}`, 'warn');
    });

    client.on('cacheDebug', (info: MergeDebugInfo) => {
      // Per-envelope diagnostic from the per-key opId gate. Distinguishes
      // "envelope arrived but every op was stale" (rejected>0, accepted=0)
      // from "no envelope arrived" (no log line at all). Keys are
      // shortened to first-uuid-segment.field for readability.
      const shorten = (k: string) => {
        const dot = k.indexOf('.');
        if (dot <= 0) return k.slice(0, 8);
        return k.slice(0, 8) + k.slice(dot);
      };
      const fmt = (label: string, keys: string[]) =>
        keys.length === 0 ? '' : ` ${label}=${keys.length}(${keys.slice(0, 3).map(shorten).join(',')}${keys.length > 3 ? '…' : ''})`;
      const level = info.acceptedKeys.length === 0 && info.tombstonedKeys.length === 0 && info.rejectedKeys.length > 0 ? 'warn' : 'info';
      log(
        `cache ${info.topic} opId=${info.opId} ops=${info.opCount}` +
          fmt('accepted', info.acceptedKeys) +
          fmt('tombstoned', info.tombstonedKeys) +
          fmt('rejected', info.rejectedKeys),
        level,
      );
    });

    client.on('disconnected', () => {
      log('Disconnected', 'warn');
      handleDisconnect();
    });

    await client.connect();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Connection failed: ${msg}`, 'error');
    handleDisconnect();
  }
});

disconnectBtn.addEventListener('click', async () => {
  if (!client) return;
  log('Disconnecting...');
  try {
    await client.disconnect();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Disconnect error: ${msg}`, 'error');
  }
  handleDisconnect();
});

function handleDisconnect() {
  stopInputMeter();
  micMuted = false;
  client = null;
  updateMicUI();
  micStatusEl.textContent = 'Off';
  inputMeter.style.width = '0%';
  setConnectedUI(false);
  updateConnectionStatus(ConnectionState.DISCONNECTED);
  clearParticipantsAndAttributes();
}

// ── Audio ─────────────────────────────────────────────────────────────

function updateMicUI() {
  if (!client) {
    micBtn.textContent = 'Mute Mic';
    micStatusEl.textContent = 'Off';
    return;
  }
  micBtn.textContent = micMuted ? 'Unmute Mic' : 'Mute Mic';
  micStatusEl.textContent = micMuted ? 'Muted' : 'Active';
}

micBtn.addEventListener('click', () => {
  if (!client) return;
  if (micMuted) {
    client.unmuteMic();
    micMuted = false;
    log('Microphone unmuted', 'success');
  } else {
    client.muteMic();
    micMuted = true;
    log('Microphone muted', 'warn');
  }
  updateMicUI();
});

function applyVolume() {
  if (!client) return;
  client.setVolume(parseFloat(volumeSlider.value));
}

volumeSlider.addEventListener('input', () => {
  volumeVal.textContent = parseFloat(volumeSlider.value).toFixed(2);
  applyVolume();
});

// ── Input Metering ────────────────────────────────────────────────────

async function startInputMeter() {
  try {
    // Mic permission is already granted by the client's connect(); this
    // second getUserMedia reuses the permission and gives us a stream to
    // feed the visual meter.
    inputStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    inputAudioCtx = new AudioContext();
    const source = inputAudioCtx.createMediaStreamSource(inputStream);
    inputAnalyser = inputAudioCtx.createAnalyser();
    inputAnalyser.fftSize = 256;
    source.connect(inputAnalyser);
    animateInputMeter();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Input meter error: ${msg}`, 'warn');
  }
}

function animateInputMeter() {
  if (!inputAnalyser) return;
  const data = new Uint8Array(inputAnalyser.frequencyBinCount);
  inputAnalyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / data.length;
  const pct = Math.min(100, (avg / 128) * 100);
  inputMeter.style.width = `${pct}%`;
  inputAnimFrame = requestAnimationFrame(animateInputMeter);
}

function stopInputMeter() {
  cancelAnimationFrame(inputAnimFrame);
  inputAnimFrame = 0;
  if (inputStream) {
    inputStream.getTracks().forEach(t => t.stop());
    inputStream = null;
  }
  if (inputAudioCtx) {
    inputAudioCtx.close();
    inputAudioCtx = null;
  }
  inputAnalyser = null;
  inputMeter.style.width = '0%';
}

// ── Pose ──────────────────────────────────────────────────────────────

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function renderPose() {
  // XY pad: X is vertical (1 at top), Y is horizontal (1 at left)
  xyDot.style.top = `${(1 - pose.x) * 100}%`;
  xyDot.style.left = `${(1 - pose.y) * 100}%`;

  // Z slider: 1 at top
  zThumb.style.top = `${(1 - pose.z) * 100}%`;

  // Yaw: arrow handle rotates around the dot. Pivot is dot center
  // (transform-origin 0,0 on .xy-dot-arrow); translate(-9, -22) places
  // the box centred above the dot in the rotated frame so the tip ends
  // up 22px outward along the yaw direction.
  xyDotArrow.style.transform = `rotate(${pose.yaw}deg) translate(-9px, -22px)`;

  posXVal.textContent = pose.x.toFixed(2);
  posYVal.textContent = pose.y.toFixed(2);
  posZVal.textContent = pose.z.toFixed(2);
  rotYawVal.textContent = `${Math.round(pose.yaw)}°`;
}

function sendPose() {
  if (!client) return;
  client.setPose({
    position: { x: pose.x, y: pose.y, z: pose.z },
    rotation: { yaw: pose.yaw, pitch: 0, roll: 0 },
  });
}

function makeDragHandler(
  el: HTMLElement,
  update: (clientX: number, clientY: number, rect: DOMRect) => void,
) {
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    update(e.clientX, e.clientY, rect);

    const move = (ev: PointerEvent) => update(ev.clientX, ev.clientY, rect);
    const up = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}

makeDragHandler(xyPad, (cx, cy, rect) => {
  const px = clamp01((cx - rect.left) / rect.width);
  const py = clamp01((cy - rect.top) / rect.height);
  pose.x = 1 - py; // 1 at top
  pose.y = 1 - px; // 1 at left
  renderPose();
  sendPose();
});

makeDragHandler(zSlider, (_cx, cy, rect) => {
  const py = clamp01((cy - rect.top) / rect.height);
  pose.z = 1 - py; // 1 at top
  renderPose();
  sendPose();
});

// Yaw is dragged on the small arrow attached to the XY dot. The drag
// pivot is the dot's current screen position (which moves with pose
// x/y), so we recompute it on each pointer move from xyPad's rect.
// stopPropagation keeps the click from also starting an XY-pad drag.
xyDotArrow.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  xyDotArrow.setPointerCapture(e.pointerId);

  const updateYaw = (clientX: number, clientY: number) => {
    const padRect = xyPad.getBoundingClientRect();
    const dotX = padRect.left + (1 - pose.y) * padRect.width;
    const dotY = padRect.top + (1 - pose.x) * padRect.height;
    // 0° points up, positive clockwise — same convention as before.
    const rad = Math.atan2(clientX - dotX, -(clientY - dotY));
    let deg = (rad * 180) / Math.PI;
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    pose.yaw = deg;
    renderPose();
    sendPose();
  };

  updateYaw(e.clientX, e.clientY);

  const move = (ev: PointerEvent) => updateYaw(ev.clientX, ev.clientY);
  const up = (ev: PointerEvent) => {
    xyDotArrow.releasePointerCapture(ev.pointerId);
    xyDotArrow.removeEventListener('pointermove', move);
    xyDotArrow.removeEventListener('pointerup', up);
    xyDotArrow.removeEventListener('pointercancel', up);
  };
  xyDotArrow.addEventListener('pointermove', move);
  xyDotArrow.addEventListener('pointerup', up);
  xyDotArrow.addEventListener('pointercancel', up);
});

renderPose();

// ── Participants ──────────────────────────────────────────────────────

function handleEntityState(state: EntityState): void {
  // State datagrams are continuous (every pose tick). A full
  // renderParticipants() on each one would tear down and recreate the
  // command buttons dozens of times per second, breaking hover and
  // swallowing clicks. So only re-render on join/leave; for steady-state
  // pose updates, mutate the details line in place.
  if (state.gone) {
    participants.delete(state.uuid);
    if (selectedParticipantUuid === state.uuid) selectedParticipantUuid = null;
    log(`Participant left: ${getDisplayName(state.uuid)}`, 'warn');
    renderParticipants();
  } else {
    const existed = participants.has(state.uuid);
    participants.set(state.uuid, state);
    if (!existed) {
      if (state.uuid !== selfEntityId) {
        log(`Participant joined: ${getDisplayName(state.uuid)}`, 'success');
      }
      renderParticipants();
    } else {
      updateParticipantDetails(state);
    }
  }
  renderPeerDots();
}

function updateParticipantDetails(state: EntityState): void {
  const card = participantsList.querySelector<HTMLDivElement>(
    `.participant-card[data-uuid="${CSS.escape(state.uuid)}"]`,
  );
  if (!card) return;
  const details = card.querySelector('.participant-details');
  if (!details) return;
  const pos = state.position;
  const rot = state.rotation;
  details.innerHTML =
    `<span>pos <span class="val">${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}</span></span>` +
    `<span>yaw <span class="val">${rot.yaw.toFixed(0)}&deg;</span></span>` +
    `<span>vol <span class="val">${state.volume.toFixed(2)}</span></span>`;
}

function handleAttributeTreeChange(uuid: string, attrs: TopicNode): void {
  attributeTree.set(uuid, attrs);
  renderParticipants();
  renderPeerDots();
}

function handleAttributeTreeRemove(uuid: string): void {
  attributeTree.delete(uuid);
  renderParticipants();
  renderPeerDots();
}

// ── Entity (self) ──────────────────────────────────────────────────────

function handleEntityRawValues(values: Array<{ key: string; value: string }>): void {
  for (const v of values) appendEntityOp({ kind: 'set', key: v.key, value: v.value });
  renderParticipants();
}

function handleEntityRawRemoved(keys: string[]): void {
  for (const k of keys) appendEntityOp({ kind: 'tomb', key: k });
  renderParticipants();
}

function handleEntityTreeChange(uuid: string, record: TopicNode): void {
  applyEntityRecord(uuid, record);
}

function handleEntityTreeRemove(uuid: string): void {
  entityRecords.delete(uuid);
  renderParticipants();
}

// Show the Space panel only once data has arrived. The server
// gates space-topic delivery on the `space.read` read cap, so for
// holders without it the panel stays hidden — data-driven UX,
// matching how the per-participant Entity sub-section is hidden when
// no record is present.
function handleSpaceTreeChange(record: SingleRecordNode): void {
  spacePanel.hidden = false;
  if (Object.keys(record).length === 0) {
    spaceRecordEl.textContent = '(empty record)';
  } else {
    spaceRecordEl.textContent = JSON.stringify(record, null, 2);
  }
}

function applyEntityRecord(uuid: string, record: TopicNode): void {
  entityRecords.set(uuid, record);
  harvestRoles(record);
  renderRoles();
  renderParticipants();
}

function harvestRoles(record: TopicNode): void {
  const roles = record['roles'];
  if (!roles || typeof roles !== 'object') return;
  for (const role of Object.keys(roles)) knownRoles.add(role);
}

function appendEntityOp(op: { kind: 'set' | 'tomb'; key: string; value?: string }): void {
  const now = new Date();
  const time = `${now.toLocaleTimeString('en-GB', { hour12: false })}.${String(now.getMilliseconds()).padStart(3, '0')}`;
  entityOpLog.push({ time, ...op });
  if (entityOpLog.length > ENTITY_OP_LOG_LIMIT) {
    entityOpLog.splice(0, entityOpLog.length - ENTITY_OP_LOG_LIMIT);
  }
}

function renderEntityOpsHtml(): string {
  if (entityOpLog.length === 0) {
    return '<p class="placeholder">Waiting for entity ops…</p>';
  }
  // Newest at the bottom so the user sees the latest op land.
  return entityOpLog.map(op => {
    const tag = op.kind === 'tomb' ? '✗' : '+';
    const tagCls = op.kind === 'tomb' ? 'tag-tomb' : 'tag-set';
    const valueHtml = op.kind === 'tomb'
      ? '<span class="entity-op-value tomb">(tombstone)</span>'
      : `<span class="entity-op-value">${escapeHtml(op.value ?? '')}</span>`;
    return `<div class="entity-op entity-op-${op.kind}">` +
      `<span class="entity-op-time">${escapeHtml(op.time)}</span>` +
      `<span class="entity-op-tag ${tagCls}">${tag}</span>` +
      `<span class="entity-op-key">${escapeHtml(op.key)}</span>` +
      valueHtml +
      `</div>`;
  }).join('');
}

function getPeerColour(uuid: string): string {
  const attrs = attributeTree.get(uuid);
  const conn = attrs && typeof attrs['connection'] === 'object' && attrs['connection'] !== null
    ? (attrs['connection'] as Record<string, unknown>)
    : null;
  const raw = conn && typeof conn['colour'] === 'string' ? (conn['colour'] as string) : null;
  return raw ? `#${raw.replace(/^#/, '')}` : '#888';
}

function renderPeerDots(): void {
  const alive = new Set<string>();
  for (const [uuid, state] of participants) {
    if (uuid === selfEntityId) continue;
    if (state.gone) continue;
    alive.add(uuid);
    let dot = peerDotEls.get(uuid);
    if (!dot) {
      dot = document.createElement('div');
      dot.className = 'peer-dot';
      dot.dataset.uuid = uuid;
      xyPad.appendChild(dot);
      peerDotEls.set(uuid, dot);
    }
    dot.style.top = `${(1 - state.position.x) * 100}%`;
    dot.style.left = `${(1 - state.position.y) * 100}%`;
    const hex = getPeerColour(uuid);
    dot.style.background = hex;
    dot.style.boxShadow = `0 0 4px ${hex}b3`;
  }
  for (const [uuid, el] of peerDotEls) {
    if (!alive.has(uuid)) {
      el.remove();
      peerDotEls.delete(uuid);
    }
  }
}

function getDisplayName(uuid: string): string {
  const attrs = attributeTree.get(uuid);
  const name = attrs && typeof attrs['name'] === 'string' ? (attrs['name'] as string) : undefined;
  return name || uuid.slice(0, 8);
}

function renderParticipants(): void {
  participantsList.querySelectorAll('.participant-card').forEach(el => el.remove());

  if (participants.size === 0) {
    participantsPlaceholder.style.display = '';
    participantCountEl.textContent = '0';
    return;
  }

  participantsPlaceholder.style.display = 'none';
  participantCountEl.textContent = String(participants.size);

  for (const [uuid, state] of participants) {
    const isSelf = uuid === selfEntityId;
    const name = getDisplayName(uuid);
    const attrs = attributeTree.get(uuid);

    const card = document.createElement('div');
    card.className = `participant-card${isSelf ? ' is-self' : ''}`;
    card.dataset.uuid = uuid;

    const pos = state.position;
    const rot = state.rotation;

    const attrsBody = attrs && Object.keys(attrs).length > 0
      ? `<pre class="attr-json">${escapeHtml(JSON.stringify(attrs, null, 2))}</pre>`
      : `<p class="placeholder">(no attributes)</p>`;

    // The entity section is shown for self (we always have our own
    // record after auth) and for any peer whose entity record we
    // happen to hold — which only occurs when the connected user has
    // the `entity.all` read cap on their roles. Without it, the
    // server filters the entity stream to self and other participants'
    // section is omitted entirely.
    const peerRecord = !isSelf ? entityRecords.get(uuid) : undefined;
    const showEntity = isSelf || peerRecord !== undefined;
    let entitySection = '';
    if (showEntity) {
      let entityBody: string;
      if (isSelf) {
        const selfRecord = entityRecords.get(selfEntityId) ?? null;
        const recordText = selfRecord && Object.keys(selfRecord).length > 0
          ? JSON.stringify(selfRecord, null, 2)
          : '(empty record)';
        entityBody =
          `<pre class="entity-record">${escapeHtml(recordText)}</pre>` +
          `<div class="entity-ops-header">` +
            `<span class="entity-ops-label">Recent ops</span>` +
            `<button class="small-btn clear-entity-ops-btn">Clear</button>` +
          `</div>` +
          `<div class="entity-ops" data-self="1">${renderEntityOpsHtml()}</div>`;
      } else {
        const recordText = peerRecord && Object.keys(peerRecord).length > 0
          ? JSON.stringify(peerRecord, null, 2)
          : '(empty record)';
        entityBody = `<pre class="entity-record">${escapeHtml(recordText)}</pre>`;
      }
      entitySection = `
      <details class="participant-section" open>
        <summary>Entity</summary>
        ${entityBody}
      </details>`;
    }

    const colour = getPeerColour(uuid);

    card.innerHTML = `
      <div class="participant-header">
        <div class="participant-info">
          <div class="participant-name">${escapeHtml(name)}${isSelf ? '<span class="self-tag">(you)</span>' : ''}</div>
          <div class="participant-uuid">${escapeHtml(uuid)}</div>
        </div>
        <span class="participant-colour-dot" style="background:${escapeHtml(colour)};box-shadow:0 0 4px ${escapeHtml(colour)}b3"></span>
      </div>
      <div class="participant-details">
        <span>pos <span class="val">${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}</span></span>
        <span>yaw <span class="val">${rot.yaw.toFixed(0)}&deg;</span></span>
        <span>vol <span class="val">${state.volume.toFixed(2)}</span></span>
      </div>
      <details class="participant-section" open>
        <summary>Commands</summary>
        ${renderEntityCommandsHtml(uuid, showEntity)}
      </details>
      <details class="participant-section" open>
        <summary>Attributes</summary>
        ${attrsBody}
      </details>${entitySection}
    `;

    participantsList.appendChild(card);
  }

  participantsList.querySelectorAll<HTMLDivElement>('.participant-card').forEach(card => {
    const uuid = card.dataset.uuid!;
    if (uuid === selectedParticipantUuid) card.classList.add('is-selected');
    const header = card.querySelector<HTMLDivElement>('.participant-header');
    header?.addEventListener('click', () => {
      selectedParticipantUuid = selectedParticipantUuid === uuid ? null : uuid;
      participantsList.querySelectorAll<HTMLDivElement>('.participant-card').forEach(c => {
        c.classList.toggle('is-selected', c.dataset.uuid === selectedParticipantUuid);
      });
    });
  });

  participantsList.querySelectorAll<HTMLButtonElement>('.cmd-btn:not(.role-cmd-btn)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cmd = btn.dataset.cmd!;
      const uuid = btn.dataset.uuid!;
      const args: Record<string, unknown> = { entity_id: uuid };
      const cell = btn.closest('.cmd-cell');
      if (cell) {
        cell.querySelectorAll<HTMLInputElement>('input[data-arg]').forEach(input => {
          const argName = input.dataset.arg!;
          const v = parseFloat(input.value);
          args[argName] = Number.isFinite(v) ? v : 0;
        });
      }
      log(`→ ${cmd}(${JSON.stringify(args)})`);
      try {
        await client?.command(cmd, args);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`Command send failed: ${msg}`, 'error');
      }
    });
  });

  // Persist user-edited arg values across re-renders. Without this,
  // any value typed into a cmd-cell input gets reset to its default
  // each time renderParticipants() runs (every ~4 s on attribute
  // re-emit).
  participantsList.querySelectorAll<HTMLInputElement>('.cmd-cell input[data-arg]').forEach(input => {
    const cell = input.closest('.cmd-cell');
    const btn = cell?.querySelector<HTMLButtonElement>('.cmd-btn:not(.role-cmd-btn)');
    if (!btn) return;
    const cmd = btn.dataset.cmd!;
    const uuid = btn.dataset.uuid!;
    const arg = input.dataset.arg!;
    input.addEventListener('input', () => {
      argValueOverrides.set(argKey('participant', uuid, cmd, arg), input.value);
    });
  });

  const clearOpsBtn = participantsList.querySelector('.clear-entity-ops-btn');
  if (clearOpsBtn) {
    clearOpsBtn.addEventListener('click', () => {
      entityOpLog.length = 0;
      renderParticipants();
    });
  }

  // Pin the op log to its newest entry after each render.
  const opsEl = participantsList.querySelector<HTMLDivElement>('.entity-ops[data-self="1"]');
  if (opsEl) opsEl.scrollTop = opsEl.scrollHeight;
}

function clearParticipantsAndAttributes(): void {
  participants.clear();
  attributeTree.clear();
  selfEntityId = '';
  entityRecords.clear();
  knownRoles.clear();
  entityOpLog.length = 0;
  selectedParticipantUuid = null;
  selectedRole = null;
  for (const el of peerDotEls.values()) el.remove();
  peerDotEls.clear();
  renderParticipants();
  renderRoles();
  // Hide the Space panel — it'll re-show on the next spaceTreeChange
  // if the new connection has the space.read read cap.
  spacePanel.hidden = true;
  spaceRecordEl.textContent = '(no data)';
}

// ── Per-participant command widgets ───────────────────────────────────
//
// Each participant card exposes a button per `space.entity.*` and
// `personal.entity.*` command. `entity_id` is filled with the card's
// uuid; commands with extra typed args render a small inline number
// input pre-filled with the default. Clicking the button reads the
// inputs in the same `.cmd-cell` and dispatches via `client.command()`.
//
// The catalog mirrors `core/commands/defs.go`. Keep it in sync when new
// per-entity commands land.

interface EntityCommand {
  name: string;
  short: string;
  args: Array<{ name: string; default: number }>;
}

const PARTICIPANT_COMMAND_GROUPS: Array<{ group: string; commands: EntityCommand[] }> = [
  {
    group: 'space.entity',
    commands: [
      { name: 'space.entity.mute', short: 'mute', args: [] },
      { name: 'space.entity.unmute', short: 'unmute', args: [] },
      { name: 'space.entity.kick', short: 'kick', args: [{ name: 'mins', default: 0 }] },
      { name: 'space.entity.unkick', short: 'unkick', args: [] },
      { name: 'space.entity.set_gain', short: 'set_gain', args: [{ name: 'gain', default: 1.0 }] },
      { name: 'space.entity.set_attenuation', short: 'set_attenuation', args: [{ name: 'attenuation', default: 2.0 }] },
    ],
  },
  {
    group: 'personal.entity',
    commands: [
      { name: 'personal.entity.mute', short: 'mute', args: [] },
      { name: 'personal.entity.unmute', short: 'unmute', args: [] },
      { name: 'personal.entity.solo', short: 'solo', args: [] },
      { name: 'personal.entity.unsolo', short: 'unsolo', args: [] },
    ],
  },
];

// Role command catalog mirrors `core/commands/defs.go` for `space.role.*`
// and `personal.role.*`. The role name is filled from the card; commands
// with extra typed args render an inline number input pre-filled with
// the default.
const ROLE_COMMAND_GROUPS: Array<{ group: string; commands: EntityCommand[] }> = [
  {
    group: 'space.role',
    commands: [
      { name: 'space.role.mute', short: 'mute', args: [] },
      { name: 'space.role.unmute', short: 'unmute', args: [] },
      { name: 'space.role.kick', short: 'kick', args: [{ name: 'mins', default: 0 }] },
      { name: 'space.role.unkick', short: 'unkick', args: [] },
      { name: 'space.role.set_gain', short: 'set_gain', args: [{ name: 'gain', default: 1.0 }] },
      { name: 'space.role.unset_gain', short: 'unset_gain', args: [] },
      { name: 'space.role.set_attenuation', short: 'set_attenuation', args: [{ name: 'attenuation', default: 2.0 }] },
      { name: 'space.role.unset_attenuation', short: 'unset_attenuation', args: [] },
    ],
  },
  {
    group: 'personal.role',
    commands: [
      { name: 'personal.role.mute', short: 'mute', args: [] },
      { name: 'personal.role.unmute', short: 'unmute', args: [] },
    ],
  },
];

function renderRoleCommandsHtml(role: string): string {
  return ROLE_COMMAND_GROUPS.map(g => {
    const cells = g.commands.map(cmd => {
      const argInputs = cmd.args.map(a => {
        const override = argValueOverrides.get(argKey('role', role, cmd.name, a.name));
        const value = override ?? String(a.default);
        return `<label class="cmd-arg">${escapeHtml(a.name)}` +
          `<input type="number" step="any" data-arg="${escapeHtml(a.name)}" value="${escapeHtml(value)}" />` +
          `</label>`;
      }).join('');
      return `<div class="cmd-cell">` +
        `<button class="cmd-btn role-cmd-btn" data-cmd="${escapeHtml(cmd.name)}" data-role="${escapeHtml(role)}">${escapeHtml(cmd.short)}</button>` +
        argInputs +
        `</div>`;
    }).join('');
    return `<div class="cmd-group">` +
      `<div class="cmd-group-label">${escapeHtml(g.group)}</div>` +
      `<div class="cmd-row">${cells}</div>` +
      `</div>`;
  }).join('');
}

function renderRoles(): void {
  // Strip any prior role cards before re-rendering.
  rolesList.querySelectorAll('.role-card').forEach(el => el.remove());

  if (knownRoles.size === 0) {
    rolesPlaceholder.style.display = '';
    rolesCountEl.textContent = '0';
    return;
  }

  rolesPlaceholder.style.display = 'none';
  rolesCountEl.textContent = String(knownRoles.size);

  // Stable alphabetical order so the panel doesn't reshuffle each tick.
  const sorted = Array.from(knownRoles).sort();
  for (const role of sorted) {
    const card = document.createElement('div');
    card.className = 'role-card';
    card.dataset.role = role;
    card.innerHTML = `
      <div class="role-header">
        <div class="role-name">${escapeHtml(role)}</div>
      </div>
      <details class="participant-section" open>
        <summary>Commands</summary>
        ${renderRoleCommandsHtml(role)}
      </details>
    `;
    rolesList.appendChild(card);
  }

  rolesList.querySelectorAll<HTMLDivElement>('.role-card').forEach(card => {
    const role = card.dataset.role!;
    if (role === selectedRole) card.classList.add('is-selected');
    const header = card.querySelector<HTMLDivElement>('.role-header');
    header?.addEventListener('click', () => {
      selectedRole = selectedRole === role ? null : role;
      rolesList.querySelectorAll<HTMLDivElement>('.role-card').forEach(c => {
        c.classList.toggle('is-selected', c.dataset.role === selectedRole);
      });
    });
  });

  rolesList.querySelectorAll<HTMLButtonElement>('.role-cmd-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cmd = btn.dataset.cmd!;
      const role = btn.dataset.role!;
      const args: Record<string, unknown> = { role };
      const cell = btn.closest('.cmd-cell');
      if (cell) {
        cell.querySelectorAll<HTMLInputElement>('input[data-arg]').forEach(input => {
          const argName = input.dataset.arg!;
          const v = parseFloat(input.value);
          args[argName] = Number.isFinite(v) ? v : 0;
        });
      }
      log(`→ ${cmd}(${JSON.stringify(args)})`);
      try {
        await client?.command(cmd, args);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`Command send failed: ${msg}`, 'error');
      }
    });
  });

  // Persist user-edited arg values across re-renders (mirrors the
  // participant-card path).
  rolesList.querySelectorAll<HTMLInputElement>('.cmd-cell input[data-arg]').forEach(input => {
    const cell = input.closest('.cmd-cell');
    const btn = cell?.querySelector<HTMLButtonElement>('.role-cmd-btn');
    if (!btn) return;
    const cmd = btn.dataset.cmd!;
    const role = btn.dataset.role!;
    const arg = input.dataset.arg!;
    input.addEventListener('input', () => {
      argValueOverrides.set(argKey('role', role, cmd, arg), input.value);
    });
  });
}

// True iff `targetUuid` is currently in this connection's own
// personal-mutes set, read from the self entity record at
// `{me}.mutes.{targetUuid}`. The mutes/solos shape is documented in
// plan/commands/data-structures.md. Returns false when the self record
// hasn't arrived yet or the field is missing — defaulting to "not
// muted / not soloed" so the relevant action button (mute / solo) is
// the one shown.
function isMutedByMe(targetUuid: string): boolean {
  if (!selfEntityId) return false;
  const me = entityRecords.get(selfEntityId);
  if (!me) return false;
  const mutes = me['mutes'];
  if (typeof mutes !== 'object' || mutes === null || Array.isArray(mutes)) return false;
  return (mutes as Record<string, unknown>)[targetUuid] === true;
}

function isSoloedByMe(targetUuid: string): boolean {
  if (!selfEntityId) return false;
  const me = entityRecords.get(selfEntityId);
  if (!me) return false;
  const solos = me['solos'];
  if (typeof solos !== 'object' || solos === null || Array.isArray(solos)) return false;
  return (solos as Record<string, unknown>)[targetUuid] === true;
}

// `showSpaceEntity` toggles the `space.entity.*` group. The intent is
// to hide those when we have no entity-stream visibility into the
// target — not a security boundary (the server's command authoriser
// is the real gate), just a UI heuristic so the buttons aren't sitting
// next to an empty / collapsed Entity sub-section.
//
// Inside `personal.entity.*` we also collapse the mute/unmute and
// solo/unsolo pairs to the single relevant action based on the
// connected user's own mutes/solos sets — mute when not yet muted,
// unmute when muted, etc. State comes from the self entity record so
// the buttons swap automatically when the server echoes our op back.
function renderEntityCommandsHtml(uuid: string, showSpaceEntity: boolean): string {
  const muted = isMutedByMe(uuid);
  const soloed = isSoloedByMe(uuid);

  return PARTICIPANT_COMMAND_GROUPS
    .filter(g => showSpaceEntity || g.group !== 'space.entity')
    .map(g => {
      const commands = g.group === 'personal.entity'
        ? g.commands.filter(cmd => {
            switch (cmd.name) {
              case 'personal.entity.mute':   return !muted;
              case 'personal.entity.unmute': return muted;
              case 'personal.entity.solo':   return !soloed;
              case 'personal.entity.unsolo': return soloed;
              default:                       return true;
            }
          })
        : g.commands;
      const cells = commands.map(cmd => {
        const argInputs = cmd.args.map(a => {
          const override = argValueOverrides.get(argKey('participant', uuid, cmd.name, a.name));
          const value = override ?? String(a.default);
          return `<label class="cmd-arg">${escapeHtml(a.name)}` +
            `<input type="number" step="any" data-arg="${escapeHtml(a.name)}" value="${escapeHtml(value)}" />` +
            `</label>`;
        }).join('');
        return `<div class="cmd-cell">` +
          `<button class="cmd-btn" data-cmd="${escapeHtml(cmd.name)}" data-uuid="${escapeHtml(uuid)}">${escapeHtml(cmd.short)}</button>` +
          argInputs +
          `</div>`;
      }).join('');
      return `<div class="cmd-group">` +
        `<div class="cmd-group-label">${escapeHtml(g.group)}</div>` +
        `<div class="cmd-row">${cells}</div>` +
        `</div>`;
    }).join('');
}

// ── Init ──────────────────────────────────────────────────────────────

checkBrowserSupport();
updateResolution();
updateIdentityVisibility();
log('Ready. Enter server host and JWT token to connect.');
