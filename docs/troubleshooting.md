# Troubleshooting

## Ticket Rejected

The server validates your JWT on the first SUBSCRIBE message. If it fails, the connection closes with an "authentication failed" error.

**Common causes:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| "authentication required" | No ticket provided, or ticket not attached to connection | Ensure the ticket is passed to the client constructor |
| "authentication failed: token is expired" | JWT `exp` claim is in the past | Generate a fresh ticket, or omit `exp` for tickets that don't expire |
| "authentication failed: token not valid yet" | JWT `nbf` claim is in the future | Check your server's clock, or omit `nbf` |
| "authentication failed" (generic) | Wrong signing key, malformed JWT, or wrong algorithm | Verify you're using Ed25519 (EdDSA) and that the Space was created with the matching public key |
| "invalid gain value" / "invalid attenuation value" | `panaudia.gain` or `panaudia.attenuation` outside 0.0–3.0 | Keep values within range |

**Debugging tips:**
- Decode your ticket at [jwt.io](https://jwt.io) to inspect the header and payload
- Check that the header has all three fields: `typ: "JWT"`, `alg: "EdDSA"`, `crv: "Ed25519"`
- Check that `aud` matches the Space ID
- Check that `jti` is a valid UUID string
- Ensure `iat` is in seconds (not milliseconds)

## Connection Failed

**TypeScript SDK errors:**

| Error | Code | Cause |
|-------|------|-------|
| `WebTransportNotSupportedError` | `WEBTRANSPORT_NOT_SUPPORTED` | Browser doesn't support WebTransport |
| `ConnectionError` | `CONNECTION_FAILED` | Server unreachable, wrong URL, or TLS error |
| `TimeoutError` | `TIMEOUT` | Server didn't respond in time |

**Common causes:**

- **Wrong server URL** — for Cloud, use `resolveServer(ticket)` rather than hardcoding. For self-hosted, ensure the URL includes the correct port.
- **TLS certificate issues** — self-hosted servers need valid TLS certificates for WebTransport. Browsers will silently refuse connections to servers with self-signed certs. For development, use the Unreal plugin's `bSkipCertValidation` or set up a trusted certificate.
- **Firewall / network** — WebTransport uses UDP (QUIC). Ensure your network allows UDP traffic on the server's port. WebRTC fallback uses TCP WebSocket if UDP is blocked.
- **Server not running** — check the server is up and listening on the expected port.
- **Space is full** — the server returns "This Panaudia space is full" when capacity is reached.

## No Audio

**No sound from other participants:**

- **Browser autoplay policy** — most browsers require a user gesture (click/tap) before audio can play. Ensure `connect()` is called in response to a user action, or add a "Join" button.
- **Output volume** — check `getVolume()` isn't 0. Call `setVolume(1.0)` to reset.
- **Same position** — if two participants are at the exact same position, spatialization may produce silence. Move them apart slightly.
- **Subspaces** — participants in different subspaces cannot hear each other. Check that tickets share at least one subspace, or omit subspaces entirely for open spaces.

**Others can't hear you:**

- **Microphone permission denied** — the browser will throw `AudioPermissionError`. Ensure the user grants mic access. Check `navigator.permissions.query({name: 'microphone'})`.
- **Muted** — check `isMuted()`. Call `unmuteMic()` if needed.
- **No microphone found** — `AudioPermissionError` with "No microphone found". Use `PanaudiaClient.listMicrophones()` to check available devices.
- **Microphone in use** — another application may have exclusive access to the mic. Close other audio apps or try a different mic with the `microphoneId` option.

**Unreal Engine:**

- Check `bCaptureMicrophone` is `true` on the component.
- Check the log for `LogPanaudia` messages about mic device selection.
- The plugin auto-selects the built-in mic — if using an external mic, it may not be picked up.

## WebTransport Not Supported

The TypeScript SDK uses MOQ (WebTransport) by default and falls back to WebRTC automatically.

| Browser | WebTransport | Fallback |
|---------|-------------|----------|
| Chrome 114+ | Yes | — |
| Edge 114+ | Yes | — |
| Firefox 114+ | Yes | — |
| Safari 18+ | No | WebRTC (automatic) |

If you need to force a specific transport:

```typescript
// Force WebRTC (e.g. for Safari testing in Chrome)
const client = new PanaudiaClient({ serverUrl, ticket, transport: 'webrtc' });
```

For the WebRTC fallback, `resolveServer` needs the protocol hint:

```typescript
const serverUrl = await resolveServer(ticket, { protocol: 'webrtc' });
```

## Self-Hosted Server Issues

**Server won't start:**

- **Missing licence** — set `PANAUDIA_LICENCE_PATH` or `PANAUDIA_LICENCE_STRING`. The default path is `panaudia-licence.txt` next to the binary.
- **Missing dependencies** — install `libopus0`, `liblapack3`, and related packages. See [Panaudia Space](panaudia-space.md) for the full list.
- **Port in use** — default ports are 8080 (HTTP/WebSocket) and 8443 (WebRTC). Change with `PANAUDIA_HTTP_PORT` and `PANAUDIA_RTC_PORT`.
- **Restricted ports** — to bind to ports below 1024, use `setcap CAP_NET_BIND_SERVICE=+eip` on the binary.

**Clients can't connect to self-hosted server:**

- Check the server is reachable from the client's network.
- For WebTransport/MOQ, ensure UDP is allowed through the firewall.
- For TLS, ensure `PANAUDIA_TLS_CTR_PATH` and `PANAUDIA_TLS_KEY_PATH` point to valid certificate files.

## Server Error Codes

These error codes may appear in server logs or be sent to WebRTC clients:

| Code | Meaning |
|------|---------|
| 0 | Connection error |
| 1 | Space is full |
| 6 | Space outputs full |
| 11 | Duplicate ID — two users are using the same ticket simultaneously |

For MOQ clients, authentication failures are returned as SUBSCRIBE rejections with the reason in the error message.

## Getting Help

If you're stuck, contact support with:

- The error message or code you're seeing
- Which SDK and version you're using
- Whether you're using Cloud or self-hosted
- Browser and version (for TypeScript SDK)
