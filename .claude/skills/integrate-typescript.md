Help the user integrate the Panaudia TypeScript client (`@panaudia/client`) into their web application. Use the information below and read the relevant source files to give accurate, up-to-date guidance.

## What this skill does

Walk the user through adding spatial audio to their web app using `@panaudia/client`. Adapt the guidance to their specific framework (React, Vue, vanilla JS, Three.js, Babylon.js, A-Frame, PlayCanvas, Unity WebGL, Unreal, PixiJS, etc.) and use case.

## Key files to consult

Before answering, read these files for the current API surface:

- `sdks/typescript/docs/api-reference.md` — full API reference, types, events, coordinate converters, migration guide
- `sdks/typescript/src/panaudia-client.ts` — PanaudiaClient unified class
- `sdks/typescript/src/types.ts` — shared TypeScript types
- `sdks/typescript/src/shared/coordinates.ts` — coordinate conversion functions for 7 frameworks
- `sdks/typescript/src/gateway.ts` — resolveServer() implementation
- `sdks/typescript/README.md` — quick start and overview

## Integration steps to cover

1. **Install**: `npm install @panaudia/client`

2. **Authentication**: The user needs a JWT ticket. Ask what auth flow they're using. The JWT must contain a `jti` field (entity UUID) and optionally `preferred_username`. Don't help them generate JWTs — that's server-side. Just explain what the client expects.

3. **Server resolution**: For production, use `resolveServer(ticket)` to get a server URL from the gateway. For local dev, pass `serverUrl` directly (e.g. `quic://localhost:4433/moq`).

4. **Create and connect**:
   ```typescript
   import { PanaudiaClient, resolveServer } from '@panaudia/client';

   const serverUrl = await resolveServer(ticket);
   const client = new PanaudiaClient({ serverUrl, ticket });
   await client.connect();
   ```
   Audio capture and playback start automatically on connect — no separate calls needed.

5. **Spatial positioning**: Help them map their coordinate system to Panaudia's. The client accepts Panaudia coordinates (position 0-1 range, rotation in degrees YXZ order):
   - `setPose(pose: PanaudiaPose)` — accepts the struct returned by coordinate converters, or construct directly: `{ position: { x, y, z }, rotation: { yaw, pitch, roll } }`
   - Use coordinate conversion functions to convert from their framework first

   **Coordinate converters** take two args `(position, rotation)` and return a pose struct. Provided for 7 frameworks:
   - `threejsToPanaudia(pos, rot)` / `panaudiaToThreejs(pos, rot)` — Three.js (RH, Y-up, XYZ Euler radians)
   - `babylonToPanaudia(pos, rot)` / `panaudiaToBabylon(pos, rot)` — Babylon.js (LH, Y-up, YXZ Euler radians)
   - `aframeToPanaudia(pos, rot)` / `panaudiaToAframe(pos, rot)` — A-Frame (RH, Y-up, YXZ Euler degrees)
   - `playcanvasToPanaudia(pos, rot)` / `panaudiaToPlaycanvas(pos, rot)` — PlayCanvas (RH, Y-up, XYZ Euler degrees)
   - `unityToPanaudia(pos, rot)` / `panaudiaToUnity(pos, rot)` — Unity (LH, Y-up, ZXY Euler degrees)
   - `unrealToPanaudia(pos, rot)` / `panaudiaToUnreal(pos, rot)` — Unreal (LH, Z-up, FRotator degrees)
   - `pixiToPanaudia(pos, rot)` / `panaudiaToPixi(pos, rot)` — PixiJS (2D, Y-down, scalar radians)

   **World bounds normalization**: If the user's world uses coordinates outside 0-1 (e.g. -100 to 100), they can set `worldBounds: { min: -100, max: 100 }` in the constructor. `setPose()` will auto-normalize to 0-1, and `entityState` events will auto-denormalize back.

   Pose can be set before connect(). After connecting, updates are throttled to 20Hz.

6. **Events**: Guide them on which events to listen for:
   - `connected`, `disconnected`, `authenticated` — connection lifecycle
   - `error` — connection/protocol errors
   - `entityState` — other entities' state in Panaudia coordinates (use converter functions to map back to framework coords)
   - `attributeTreeChange` — **preferred for most apps.** `(uuid, attrs)` — fires once per affected participant per envelope with their fully reconstructed attribute object (e.g. `{ name: 'Alice', ticket: { colour: '#f00' } }`). Dotted keys are grouped under the uuid (always the first segment). New participants are built fully before being inserted into the tree, so the handler always sees a complete object. Snapshot via `client.getAttributeTree()` / `client.getAttributes(uuid)`.
   - `attributeTreeRemove` — `(uuid)` — fires when a participant's last attribute is tombstoned (typically a disconnect). MOQ transport only.
   - `attributes` — raw flat batch of per-key values `Array<{ key, value }>`, one callback per envelope. Use this only if you need to bypass the structured tree. `value` is JSON-serialised — call `JSON.parse(value)` to read it.
   - `attributesRemoved` — raw flat batch of tombstoned keys `string[]`, one callback per envelope. Use this only if you need to bypass the structured tree. MOQ transport only.

7. **Audio controls**: `muteMic()`, `unmuteMic()`, `isMuted()`, `setVolume(v)`, `getVolume()`

8. **Remote control**: `mute(entityId)`, `unmute(entityId)` to mute/unmute other entities

9. **Cleanup**: Always call `disconnect()` when done (component unmount, page unload, etc.)

## Transport selection

- **MOQ** (default): Uses WebTransport + QUIC. Chrome/Edge/Firefox 114+. Lower latency, better for spatial audio.
- **WebRTC** (fallback): Uses WebSocket signaling + RTCPeerConnection. All browsers. Auto-selected when WebTransport unavailable.
- Force with `transport: 'moq'` or `transport: 'webrtc'` in constructor.

## Framework-specific guidance

- **Three.js**: Use `threejsToPanaudia(camera.position, camera.rotation)` — pass position and rotation as separate args. Use `panaudiaToThreejs(state.position, state.rotation)` in `entityState` handler to update other entities.
- **Babylon.js**: Use `babylonToPanaudia()` / `panaudiaToBabylon()`. Note Babylon is left-handed — converters handle this via quaternion math.
- **A-Frame**: Use `aframeToPanaudia()` / `panaudiaToAframe()`. A-Frame uses degrees like Panaudia but different axis conventions.
- **PlayCanvas**: Use `playcanvasToPanaudia()` / `panaudiaToPlaycanvas()`.
- **Unity WebGL**: Use `unityToPanaudia()` / `panaudiaToUnity()`. Unity is left-handed — converters handle this.
- **Unreal**: Use `unrealToPanaudia()` / `panaudiaToUnreal()`. Uses FRotator (pitch/yaw/roll) convention.
- **PixiJS**: Use `pixiToPanaudia()` / `panaudiaToPixi()`. 2D only — z and pitch/roll are zero.
- **React**: Create the client in a useEffect/useRef, disconnect on cleanup. Don't recreate on every render.
- **Vanilla JS**: Straightforward, just manage the client lifecycle manually.

## Common issues to watch for

- **HTTPS required**: WebTransport and getUserMedia both require secure contexts. Use HTTPS even in development.
- **Microphone permission**: The browser will prompt for mic access on `connect()`. If denied, the client still connects but can't send audio.
- **Self-signed certs**: For local dev with self-signed TLS certs, the browser must trust the cert before WebTransport will work. Visit the server URL directly to accept the cert.
- **CORS**: If using `resolveServer()`, the gateway must return CORS headers. This is a server-side concern.
- **Debug logging**: Pass `debug: true` in the constructor to see `[MOQ]` protocol messages in the console.

## What NOT to help with

- Generating JWT tokens (server-side concern)
- Server deployment or configuration
- The Go spatial-mixer server internals
- The Unreal Engine plugin (separate skill)

$ARGUMENTS
