# @panaudia/client

Unified TypeScript client for Panaudia spatial audio. Supports MOQ (Media over QUIC) and WebRTC transports behind a common API.

## Installation

```bash
npm install @panaudia/client
```

## Quick Start

### Production (with gateway)

```typescript
import { PanaudiaClient, resolveServer } from '@panaudia/client';

// Resolve server URL via gateway
const serverUrl = await resolveServer(ticket);

// Create and connect (audio starts automatically)
const client = new PanaudiaClient({ serverUrl, ticket });
await client.connect();

// Set spatial pose (Panaudia coordinates: position 0-1, rotation in degrees)
client.setPose({ position: { x: 0.5, y: 0.5, z: 0.5 },
    rotation: { yaw: 90, pitch: 0, roll: 0 } });

// Listen for other entities
client.on('entityState', (state) => {
  console.log(`${state.uuid} at (${state.position.x}, ${state.position.y}, ${state.position.z})`);
});

// Disconnect
await client.disconnect();
```

### With coordinate conversion (Three.js example)

```typescript
import { PanaudiaClient } from '@panaudia/client';
import { threejsToPanaudia, panaudiaToThreejs } from '@panaudia/client';

const client = new PanaudiaClient({ serverUrl, ticket });
await client.connect();

// Convert Three.js pose to Panaudia and send
const pose = threejsToPanaudia(
  { x: 0, y: 1.6, z: -5 },
  { x: 0, y: Math.PI / 2, z: 0 },
);
client.setPose(pose);

// Convert incoming entity state back to Three.js
client.on('entityState', (state) => {
  const threejs = panaudiaToThreejs(state.position, state.rotation);
  mesh.position.set(threejs.position.x, threejs.position.y, threejs.position.z);
});
```

### With world bounds normalization

```typescript
// Positions are automatically normalized from [-100, 100] to [0, 1] for the server,
// and denormalized back to [-100, 100] in entityState events.
const client = new PanaudiaClient({
  serverUrl,
  ticket,
  worldBounds: { min: -100, max: 100 },
});
```

### Microphone Selection

Bluetooth microphones force stereo audio to collapse to mono (the HFP/SCO profile replaces A2DP). The client detects this and refuses to connect with a Bluetooth default mic — instead throwing a `BluetoothMicDefaultError` that includes the full device list so you can show a mic picker.

```typescript
import { PanaudiaClient, BluetoothMicDefaultError } from '@panaudia/client';

const client = new PanaudiaClient({ serverUrl, ticket });

try {
  await client.connect();
} catch (err) {
  if (err instanceof BluetoothMicDefaultError) {
    // Default mic is Bluetooth — show a picker with the available devices
    console.log('Please select a microphone:', err.availableDevices);
    // err.availableDevices → [{ deviceId, label, type: 'bluetooth'|'usb'|'builtin'|'unknown' }, ...]

    // After the user picks one, reconnect with their choice:
    const client2 = new PanaudiaClient({ serverUrl, ticket, microphoneId: chosenDeviceId });
    await client2.connect();
  }
}

// If the user explicitly chooses a Bluetooth mic, it connects but emits a warning
client.on('warning', (w) => {
  if (w.code === 'BLUETOOTH_MIC') {
    showWarningBanner(w.message);
  }
});
```

You can also proactively show a mic picker before connecting:

```typescript
// List all mics with type classification
const mics = await PanaudiaClient.listMicrophones();

// Or get the recommended non-Bluetooth mic for pre-selection
const recommended = await PanaudiaClient.getRecommendedMicrophone();
```

### Local Development (no gateway)

```typescript
const client = new PanaudiaClient({
  serverUrl: 'quic://dev.panaudia.com:4433/moq',
  ticket: devJwt,
});
await client.connect();
```

## Coordinate Conversion

The library includes conversion functions for 7 web 3D frameworks. Each pair converts between that framework's native coordinate system and Panaudia's internal coordinates.

| Framework | To Panaudia | From Panaudia | Position Convention | Rotation Convention |
|-----------|-------------|---------------|--------------------|--------------------|
| Three.js | `threejsToPanaudia()` | `panaudiaToThreejs()` | RH, Y-up, -Z fwd | XYZ Euler, radians |
| Babylon.js | `babylonToPanaudia()` | `panaudiaToBabylon()` | LH, Y-up, +Z fwd | YXZ Euler, radians |
| A-Frame | `aframeToPanaudia()` | `panaudiaToAframe()` | RH, Y-up, -Z fwd | YXZ Euler, degrees |
| PlayCanvas | `playcanvasToPanaudia()` | `panaudiaToPlaycanvas()` | RH, Y-up, -Z fwd | XYZ Euler, degrees |
| Unity | `unityToPanaudia()` | `panaudiaToUnity()` | LH, Y-up, +Z fwd | ZXY Euler, degrees |
| Unreal | `unrealToPanaudia()` | `panaudiaToUnreal()` | LH, Z-up, +X fwd | FRotator (P/Y/R), degrees |
| PixiJS | `pixiToPanaudia()` | `panaudiaToPixi()` | 2D, Y-down | Scalar rotation, radians |

All rotations use quaternion intermediary math to correctly handle handedness and axis permutation differences between frameworks.

## Transport Selection

The client supports two transports:

| Transport | Protocol | Browser Support       |
|-----------|----------|-----------------------|
| **MOQ** (default) | WebTransport + QUIC | Chrome, Edge, Firefox |
| **WebRTC** (fallback) | WebSocket signaling + RTCPeerConnection | All browsers          |

```typescript
// Auto-detect (default): MOQ if WebTransport supported, else WebRTC
const client = new PanaudiaClient({ serverUrl, ticket });

// Force MOQ
const client = new PanaudiaClient({ serverUrl, ticket, transport: 'moq' });

// Force WebRTC
const client = new PanaudiaClient({ serverUrl, ticket, transport: 'webrtc' });
```

## API Reference

See [docs/api-reference.md](docs/api-reference.md) for the full API reference, types, sub-path exports, direct MOQ access, and migration guide.

## Browser Support

| Browser | Transport | Notes |
|---------|-----------|-------|
| Chrome 114+ | MOQ (WebTransport) | Default |
| Edge 114+ | MOQ (WebTransport) | Default |
| Firefox 114+ | MOQ (WebTransport) | Default |
| Safari 18+ | WebRTC | Auto-fallback (no WebTransport yet) |

## Development

```bash
npm install
npm run build        # TypeScript + Vite build
npm test             # Unit tests (vitest)
npm run typecheck    # Type checking only
npm run test:integration  # Playwright integration tests
```
