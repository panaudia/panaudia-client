# Quickstart

Get two browser tabs talking to each other with spatial audio in under five minutes using the Panaudia Cloud dev server.

## Prerequisites

- Node.js 16+
- A Panaudia dev server Space ID and key pair (request access from support)

## 1. Create a project

```bash
mkdir panaudia-quickstart && cd panaudia-quickstart
npm init -y
npm install @panaudia/client jose
npm install -D vite
```

## 2. Create tickets

Each user needs a unique ticket. Create a script that generates one:

Save as `make-ticket.mjs`:

```javascript
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';

const SPACE_ID = '<YOUR_SPACE_ID>';
const privatePem = fs.readFileSync('<YOUR_PRIVATE_KEY>.pem', 'utf-8');

const name = process.argv[2] || 'User';

const privateKey = await importPKCS8(privatePem, 'EdDSA');

const ticket = await new SignJWT({
  iss: 'quickstart',
  aud: SPACE_ID,
  jti: crypto.randomUUID(),
  preferred_username: name,
})
  .setProtectedHeader({ typ: 'JWT', alg: 'EdDSA', crv: 'Ed25519' })
  .setIssuedAt()
  .sign(privateKey);

console.log(ticket);
```

Generate two tickets:

```bash
node make-ticket.mjs Alice > ticket-alice.txt
node make-ticket.mjs Bob > ticket-bob.txt
```

## 3. Create the web page

Save as `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Panaudia Quickstart</title>
  <script type="module">
    import { PanaudiaClient, resolveServer } from '@panaudia/client';

    const ticket = document.location.hash.slice(1);
    if (!ticket) {
      document.body.textContent = 'Add a ticket as a URL hash: index.html#eyJ...';
      throw new Error('No ticket');
    }

    const serverUrl = await resolveServer(ticket);
    const client = new PanaudiaClient({ serverUrl, ticket });

    document.getElementById('status').textContent = 'Connecting...';
    await client.connect();
    document.getElementById('status').textContent = 'Connected as ' + client.getEntityId();

    // Place this user slightly left of centre
    client.setPose({ position: { x: 0.4, y: 0.5, z: 0.5 }, rotation: { yaw: 0, pitch: 0, roll: 0 } });

    // Log other participants
    client.on('entityState', (state) => {
      console.log(`${state.uuid} at (${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)})`);
    });

    // Mute/unmute button
    document.getElementById('mute').addEventListener('click', () => {
      if (client.isMuted()) {
        client.unmuteMic();
        document.getElementById('mute').textContent = 'Mute';
      } else {
        client.muteMic();
        document.getElementById('mute').textContent = 'Unmute';
      }
    });
  </script>
</head>
<body>
  <h1>Panaudia Quickstart</h1>
  <p id="status">Waiting for ticket...</p>
  <button id="mute">Mute</button>
</body>
</html>
```

## 4. Serve and test

Start a local server (the import from `@panaudia/client` needs a bundler or import map — the simplest option is Vite):

```bash
npx vite
```

Open two browser tabs:

```
http://localhost:5173/#<contents of ticket-alice.txt>
http://localhost:5173/#<contents of ticket-bob.txt>
```

Allow microphone access in both tabs. You should hear yourself through spatial audio — speak into one tab and hear it in the other.

Try changing the position in the second tab's console to hear the spatialization shift:

```javascript
// Move Bob to the right side
client.setPose({ position: { x: 0.6, y: 0.5, z: 0.5 }, rotation: { yaw: 0, pitch: 0, roll: 0 } });
```

## What's happening

1. **Tickets** authenticate each user with the Space using signed JWTs
2. **`resolveServer()`** looks up the correct server URL from the Panaudia gateway
3. **`PanaudiaClient`** connects via MOQ (WebTransport), captures your microphone, and plays back spatialized audio from other participants
4. **`setPose()`** tells the server where you are — it uses this to compute binaural spatialization

## Next steps

- **[Tickets](tickets.md)** — customise ticket claims (expiry, gain, subspaces, custom attributes)
- **[Coordinates](coordinates.md)** — understand the coordinate system and use framework converters (Three.js, Babylon.js, etc.)
- **[Space Hosting](space-hosting.md)** — set up your own Cloud or self-hosted Space for production
- **[TypeScript SDK API Reference](../sdks/typescript/docs/api-reference.md)** — full method, event, and type reference
