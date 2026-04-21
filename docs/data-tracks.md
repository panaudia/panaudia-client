# Data Tracks

Panaudia exchanges three types of data between participants alongside audio:

| Track | Direction | Format | Handled by SDK |
|-------|-----------|--------|----------------|
| **State** | Server → Client | Binary (48 bytes) | Yes — emitted as typed events |
| **Attributes** | Server → Client | JSON (per-key operations) | Yes — emitted as per-key events |
| **Control** | Client → Server | JSON | Yes — via `mute()`/`unmute()` API |

## State

Each participant's state is broadcast to other participants as a 48-byte binary message containing position, rotation, volume, and a gone flag. The client SDKs parse this automatically:

- **TypeScript**: `entityState` event with `EntityState` object (uuid, position, rotation, volume, gone)
- **Unreal**: `OnDataTrackReceived` delegate with raw bytes on `state_output`, or handled automatically by PanaudiaPresence

You do not need to construct or parse state messages yourself. Use `setPose()` (TypeScript) or `UpdatePosition()` (Unreal) to send your position, and listen for events to receive others'.

## Attributes

When a participant joins a Space, the server broadcasts their attributes to all other participants as per-key JSON operations. Each attribute is an individual key-value pair with a dot-separated path.

### Per-key operations

Attributes are delivered as individual operations rather than a single monolithic object. Each operation sets or removes a single key:

```json
{"key": "8c5d04e0.name", "value": "Alice"}
{"key": "8c5d04e0.ticket.colour", "value": "ff3366"}
{"key": "8c5d04e0.connection.avatar", "value": "robot"}
```

Multiple operations may arrive as a batch (JSON array) sharing a single sequence ID:

```json
[
  {"key": "8c5d04e0.name", "value": "Alice"},
  {"key": "8c5d04e0.ticket.colour", "value": "ff3366"}
]
```

When a participant disconnects, the server sends tombstone operations to remove their keys:

```json
{"key": "8c5d04e0.name", "tombstone": true}
```

### Key structure

Keys use dot-separated paths. The first segment is the participant's UUID. Common keys:

| Key pattern | Description |
|-------------|-------------|
| `{uuid}.name` | Display name (from JWT `preferred_username`) |
| `{uuid}.ticket` | Application-specific attributes from JWT `panaudia.attrs` |
| `{uuid}.ticket.{field}` | Individual ticket attribute fields |
| `{uuid}.connection` | Application-specific attributes from connection query parameters |
| `{uuid}.connection.{field}` | Individual connection attribute fields |
| `{uuid}.subspaces.{id}` | Subspace membership (value is `true`) |

### Application-specific attributes

The `ticket` and `connection` attributes are opaque to Panaudia — your application defines their contents and other clients receive them as-is. Use them for any per-participant metadata your application needs, such as avatar appearance, role, team, or display preferences.

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

These arrive as individual per-key operations, e.g. `{uuid}.ticket.colour` with value `"ff3366"`.

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

These arrive as individual per-key operations, e.g. `{uuid}.connection.colour` with value `"00aaff"`.

### Receiving attributes

**TypeScript:**

The client maintains a structured per-participant view automatically. Dotted keys are reconstructed into nested objects, grouped by the uuid (which is always the first segment of the path). For most apps this is the only API you need:

```typescript
client.on('attributeTreeChange', (uuid, attrs) => {
  // attrs is e.g. { name: 'Alice', ticket: { colour: '#f00', role: 'performer' } }
  updateAvatar(uuid, attrs);
});

client.on('attributeTreeRemove', (uuid) => {
  removeAvatar(uuid);
});

// Snapshot at any time:
const all = client.getAttributeTree();        // ReadonlyMap<string, AttributeNode>
const alice = client.getAttributes('alice');  // AttributeNode | undefined
```

`attributeTreeChange` fires once per affected participant per envelope. When a participant's first batch of attributes arrives, the whole object is built before being placed in the tree, so the handler always sees a fully populated participant — no partial state. Existing participants are mutated in place. `attributeTreeRemove` fires when a participant's last attribute is tombstoned (typically a disconnect, where all of their keys are tombstoned in one batch).

#### Raw value events

If you need to bypass the structured tree (e.g. to drive your own data model), the underlying flat events are also available:

```typescript
client.on('attributes', (values) => {
  for (const { key, value } of values) {
    // key is e.g. "8c5d04e0.name", value is JSON-serialised e.g. '"Alice"'
    const parsed = JSON.parse(value);
    console.log(`${key} = ${parsed}`);
  }
});

client.on('attributesRemoved', (keys) => {
  for (const key of keys) console.log('removed', key);
});
```

Both fire once per incoming envelope: a single update arrives as a one-element array, a participant's initial state or bulk disconnect as a multi-element array — so you can treat each batch atomically. The `attributesRemoved` event is MOQ-only; the WebRTC transport does not emit tombstones yet.

**Unreal:** Handle the `OnDataTrackReceived` delegate for `attributes_output` and parse the cache envelope + JSON, or use the PanaudiaPresence plugin which does this automatically.

### Caching and backfill

Attributes are cached by the server. When a new participant joins, they receive all current attributes via backfill — no special handling is needed. On reconnection, the SDK sends its last-seen sequence ID so only missed updates are delivered.

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
