# API Reference

## `resolveServer(ticket, options?)`

Resolves a server URL from the Panaudia gateway.

```typescript
const url = await resolveServer(ticket);
const url = await resolveServer(ticket, { protocol: 'webrtc' });
const url = await resolveServer(ticket, { gatewayUrl: 'https://dev.panaudia.com/gateway' });
```

**Options:**
- `protocol` — `'auto'` | `'moq'` | `'webrtc'` (default: `'auto'`)
- `gatewayUrl` — Gateway URL (default: `'https://panaudia.com/gateway'`)

## `PanaudiaClient`

### Constructor

```typescript
new PanaudiaClient({
  serverUrl: string,           // From resolveServer() or hardcoded
  ticket: string,              // JWT authentication token
  transport?: 'auto' | 'moq' | 'webrtc',  // Default: 'auto'
  initialPosition?: Position,  // Default: { x: 0.5, y: 0.5, z: 0.5 }
  initialRotation?: Rotation,  // Default: { yaw: 0, pitch: 0, roll: 0 }
  presence?: boolean,          // Enable entity state/attribute events. Default: true
  entityId?: string,           // Extracted from JWT if not provided
  queryParams?: Record<string, string>,  // Additional connection URL query params
  microphoneId?: string,       // Microphone device ID (see listMicrophones())
  debug?: boolean,             // Enable debug logging. Default: false
  worldBounds?: { min: number; max: number },  // Position normalization bounds
})
```

### Static Methods

| Method | Description |
|--------|-------------|
| `PanaudiaClient.listMicrophones()` | List available microphone devices with type classification. Requests mic permission if not already granted. Returns `MicrophoneInfo[]`. |
| `PanaudiaClient.getRecommendedMicrophone()` | Select the best non-Bluetooth microphone. Uses label heuristics and sample-rate probing. Returns `MicrophoneSelectionResult`. Use to pre-select a device in a mic picker UI. |

### Connection

| Method | Description |
|--------|-------------|
| `connect()` | Connect to the server (audio starts automatically) |
| `disconnect()` | Disconnect cleanly |
| `getState()` | Current `ConnectionState` |
| `getEntityId()` | This client's UUID |
| `getTransportType()` | `'moq'` or `'webrtc'` |

### Audio

Audio capture and playback start automatically on `connect()`.

**Bluetooth mic handling:** If no `microphoneId` is set and the system default mic is Bluetooth, `connect()` throws a `BluetoothMicDefaultError` (code `BLUETOOTH_MIC_DEFAULT`) instead of connecting with degraded audio. The error includes `availableDevices` — an array of all mics with their `type` classification — so the app can immediately show a mic picker. If a Bluetooth mic is explicitly chosen via `microphoneId`, the client connects normally but emits a `BLUETOOTH_MIC` warning event.

| Method | Description |
|--------|-------------|
| `muteMic()` | Mute (keep connection, stop sending) |
| `unmuteMic()` | Unmute |
| `isMuted()` | Returns `true` if mic is muted |
| `setVolume(volume)` | Set playback volume (0.0 = silent, 1.0 = full) |
| `getVolume()` | Get current playback volume |

### Spatial

| Method | Description |
|--------|-------------|
| `setPose(pose: PanaudiaPose)` | Set pose in Panaudia coordinates (position 0-1 range, rotation in degrees). If `worldBounds` is configured, positions are normalized from world space to 0-1. Accepts the same `PanaudiaPose` type returned by coordinate converter functions. |

Pose can be set before `connect()` — the initial position will be included in the connection URL. After connecting, pose updates are throttled to 20Hz.

Use the coordinate conversion functions to convert from your 3D framework's coordinate system before calling `setPose()`:

```typescript
import { threejsToPanaudia } from '@panaudia/client';

const pose = threejsToPanaudia(mesh.position, mesh.rotation);
client.setPose(pose);
```

### Remote Control

| Method | Description |
|--------|-------------|
| `mute(entityId)` | Mute a remote entity |
| `unmute(entityId)` | Unmute a remote entity |

### Events

```typescript
client.on('connected', () => { ... });
client.on('disconnected', () => { ... });
client.on('authenticated', () => { ... });
client.on('error', (event: ErrorEvent) => { ... });
client.on('warning', (event: WarningEvent) => { ... });       // Non-fatal issues (e.g. Bluetooth mic)
client.on('entityState', (state: EntityState) => { ... });     // Panaudia coordinates
client.on('attributes', (attrs: EntityAttributes) => { ... });
```

#### Warning Codes

| Code | Meaning |
|------|---------|
| `BLUETOOTH_MIC` | A Bluetooth microphone is in use. Stereo audio may be reduced to mono. The `details` field contains `{ deviceId, label }`. |

The `entityState` event provides state in Panaudia coordinates. If `worldBounds` is configured, positions are denormalized from 0-1 back to world space. Use framework converter functions to convert to your coordinate system:

```typescript
import { panaudiaToThreejs } from '@panaudia/client';

client.on('entityState', (state) => {
  if (state.gone) {
    removeEntity(state.uuid);
    return;
  }
  const threejs = panaudiaToThreejs(state.position, state.rotation);
  updateEntity(state.uuid, threejs);
});
```

## Coordinate Conversion Functions

All functions are exported from both `@panaudia/client` and `@panaudia/client/moq`.

### Three.js

```typescript
threejsToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose   // RH, Y-up, -Z fwd, XYZ Euler radians
panaudiaToThreejs(position: Position, rotation: Rotation): Vec3Pose
```

### Babylon.js

```typescript
babylonToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose   // LH, Y-up, +Z fwd, YXZ Euler radians
panaudiaToBabylon(position: Position, rotation: Rotation): Vec3Pose
```

### A-Frame

```typescript
aframeToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose     // RH, Y-up, -Z fwd, YXZ Euler degrees
panaudiaToAframe(position: Position, rotation: Rotation): Vec3Pose
```

### PlayCanvas

```typescript
playcanvasToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose // RH, Y-up, -Z fwd, XYZ Euler degrees
panaudiaToPlaycanvas(position: Position, rotation: Rotation): Vec3Pose
```

### Unity (WebGL export)

```typescript
unityToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose      // LH, Y-up, +Z fwd, ZXY Euler degrees
panaudiaToUnity(position: Position, rotation: Rotation): Vec3Pose
```

### Unreal Engine

```typescript
unrealToPanaudia(position: Vec3, rotation: FRotator): PanaudiaPose   // LH, Z-up, +X fwd, FRotator degrees
panaudiaToUnreal(position: Position, rotation: Rotation): UnrealPose
```

### PixiJS (2D)

```typescript
pixiToPanaudia(position: Vec2, rotation: number): PanaudiaPose       // 2D, Y-down, scalar rotation radians
panaudiaToPixi(position: Position, rotation: Rotation): PixiPose
```

### Pose Types

```typescript
// Panaudia internal pose (position 0-1, rotation in degrees)
interface PanaudiaPose {
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number; roll: number };
}

// Used by Three.js, Babylon.js, A-Frame, PlayCanvas, Unity
interface Vec3Pose {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

// Used by Unreal Engine
interface UnrealPose {
  position: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number; roll: number };  // FRotator order
}

// Used by PixiJS
interface PixiPose {
  position: { x: number; y: number };
  rotation: number;  // Scalar radians
}
```

## Types

```typescript
// Entity state received from the server
interface EntityState {
  uuid: string;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number; roll: number };
  volume: number;    // Server-computed loudness (read-only)
  gone: boolean;     // true when entity has left
}

// Entity attributes received from the server
interface EntityAttributes {
  uuid: string;
  name?: string;
  ticket?: string;
  connection?: string;
  subspaces?: string[];
}

interface MicrophoneInfo {
  deviceId: string;
  label: string;
  type: MicrophoneType;  // 'bluetooth' | 'usb' | 'builtin' | 'unknown'
}

// Returned by PanaudiaClient.getRecommendedMicrophone()
interface MicrophoneSelectionResult {
  deviceId: string | undefined;       // undefined = use system default
  label: string;
  type: MicrophoneType;
  allDevices: ClassifiedMicrophone[];  // All evaluated devices
  switchedFromBluetooth: boolean;      // True if default was BT and we picked another
}

type MicrophoneType = 'bluetooth' | 'usb' | 'builtin' | 'unknown';

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error',
}

interface ErrorEvent { code: string | number; message: string; details?: unknown; }
interface WarningEvent { code: string; message: string; details?: unknown; }

// Thrown when default mic is Bluetooth and no explicit microphoneId was set.
// Includes the full device list so the app can show a mic picker.
class BluetoothMicDefaultError extends MoqClientError {
  availableDevices: Array<{ deviceId: string; label: string; type: MicrophoneType }>;
  // code: 'BLUETOOTH_MIC_DEFAULT'
}
```

## Direct MOQ Access

For testing or advanced usage, import MOQ internals directly:

```typescript
import { PanaudiaMoqClient, MoqConnection } from '@panaudia/client/moq';

const client = new PanaudiaMoqClient({
  serverUrl: 'https://server.example.com:4433',
  ticket: jwt,
});
await client.connect();
```

This provides access to MOQ protocol utilities, wire format encoders/decoders, audio publisher/subscriber, and error types.

## Sub-path Exports

| Import Path | Contents |
|-------------|----------|
| `@panaudia/client` | `PanaudiaClient`, `resolveServer`, coordinate converters, microphone selection (`selectBestMicrophone`, `classifyByLabel`), shared types |
| `@panaudia/client/moq` | `PanaudiaMoqClient`, MOQ protocol internals, coordinate converters |
| `@panaudia/client/webrtc` | `WebRtcTransport` |

## Migration from `panaudia-sdk`

| Old (`panaudia-sdk`) | New (`@panaudia/client`) |
|------|------|
| `connect(ticket, ...)` | `resolveServer(ticket)` + `new PanaudiaClient({...}).connect()` |
| `connectDirect(...)` | `new PanaudiaClient({ serverUrl: '...' }).connect()` |
| `startMicrophone()` / `startPlayback()` | Automatic on `connect()` |
| `move(pos, rot)` | Convert with framework function + `client.setPose(...)` |
| `moveAmbisonic(coords)` | `client.setPose({ position, rotation })` |
| `setStateCallback(cb)` | `client.on('entityState', cb)` |
| `setAttributesCallback(cb)` | `client.on('attributes', cb)` |
| `setConnectionStatusCallback(cb)` | `client.on('connected', cb)` / `client.on('disconnected', cb)` / `client.on('authenticated', cb)` |
| `muteMic()` / `unmuteMic()` | Same |
| `mute(id)` / `unmute(id)` | Same |
| `ParticipantPose` / `participantState` event | `EntityState` / `entityState` event |
| `NodeAttributes` | `EntityAttributes` |
| `NodeInfo3` | `EntityInfo3` |
| `getNodeId()` | `getEntityId()` |
| `nodeId` config field | `entityId` config field |
