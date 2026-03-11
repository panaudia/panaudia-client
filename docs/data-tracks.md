# Data Tracks

Panaudia exchanges three types of data between participants alongside audio:

| Track | Direction | Format | Handled by SDK |
|-------|-----------|--------|----------------|
| **State** | Server → Client | Binary (48 bytes) | Yes — emitted as typed events |
| **Attributes** | Server → Client | JSON | Yes — emitted as typed events |
| **Control** | Client → Server | JSON | Yes — via `mute()`/`unmute()` API |

## State

Each participant's state is broadcast to other participants as a 48-byte binary message containing position, rotation, volume, and a gone flag. The client SDKs parse this automatically:

- **TypeScript**: `entityState` event with `EntityState` object (uuid, position, rotation, volume, gone)
- **Unreal**: `OnDataTrackReceived` delegate with raw bytes on `state_output`, or handled automatically by PanaudiaPresence

You do not need to construct or parse state messages yourself. Use `setPose()` (TypeScript) or `UpdatePosition()` (Unreal) to send your position, and listen for events to receive others'.

## Attributes

When a participant joins a Space, the server broadcasts their attributes to all other participants as a JSON message. This is the one data format you may need to work with directly.

### JSON structure

```json
{
  "uuid": "8c5d04e0-5e84-4d52-94bd-48d64d74510a",
  "name": "Alice",
  "ticket": { ... },
  "connection": { ... },
  "subspaces": ["a1b2c3d4-0000-0000-0000-000000000001"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | The participant's unique identifier |
| `name` | string | Display name, from the JWT `preferred_username` claim |
| `ticket` | object or null | Application-specific attributes from the JWT's `panaudia.attrs` field |
| `connection` | object or null | Application-specific attributes from URL query parameters at connect time |
| `subspaces` | string[] | Subspace UUIDs the participant belongs to |

### Application-specific attributes

The `ticket` and `connection` objects are opaque to Panaudia — your application defines their contents and other clients receive them as-is. Use them for any per-participant metadata your application needs, such as avatar appearance, role, team, or display preferences.

**Via the ticket** — set `panaudia.attrs` in the JWT payload when creating the ticket:

```json
{
  "iss": "my-app",
  "aud": "space_...",
  "jti": "...",
  "preferred_username": "Alice",
  "panaudia": {
    "attrs": {
      "colour": "ff3366",
      "role": "presenter"
    }
  }
}
```

These arrive in the `ticket` field of the attributes message.

**Via connection parameters** — pass query parameters when connecting. In the TypeScript SDK:

```typescript
const client = new PanaudiaClient({
  serverUrl,
  ticket,
  queryParams: {
    colour: '00aaff',
    avatar: 'robot',
  },
});
```

These arrive in the `connection` field of the attributes message.

If the same key appears in both `ticket` and `connection`, both values are delivered — it is up to your application to decide which takes priority. The PanaudiaPresence plugin for Unreal, for example, prefers `connection` over `ticket` for the `colour` field.

### Receiving attributes

**TypeScript:**

```typescript
client.on('attributes', (attrs) => {
  console.log(`${attrs.name} joined`);
  if (attrs.ticket?.colour) {
    setPlayerColour(attrs.uuid, attrs.ticket.colour);
  }
});
```

**Unreal:** Handle the `OnDataTrackReceived` delegate for `attributes_output` and parse the JSON, or use the PanaudiaPresence plugin which does this automatically.

## Control

Control messages let you mute or unmute remote participants. The SDKs handle the JSON format internally:

**TypeScript:**
```typescript
client.mute(entityId);
client.unmute(entityId);
```

**Unreal:**
```cpp
PanaudiaComp->MuteNode(NodeId);
PanaudiaComp->UnmuteNode(NodeId);
```

The underlying JSON format is `{"type": "mute", "message": {"node": "<uuid>"}}` but you should not need to construct this yourself.
