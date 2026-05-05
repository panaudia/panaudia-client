# moq-test-page

Single-page browser demo that exercises `@panaudia/client` over both MOQ (WebTransport) and WebRTC transports.

## First-time setup — dev certificates

The dev server and the test page both need TLS.

**Why TLS is required even on localhost:** WebTransport (the browser API MOQ rides on) mandates HTTPS — QUIC has TLS baked into the transport itself, there is no plain-HTTP mode. WebRTC is more forgiving (its media plane is DTLS-encrypted regardless of how signalling is served), but we keep a single TLS-everywhere path so the transport selector is a free toggle: whichever you pick, it just works.

We use [**mkcert**](https://github.com/FiloSottile/mkcert) because it installs a local CA into your OS (and Firefox) trust store, so browsers trust the dev cert without warnings — no OpenSSL incantations, no clicking through "your connection is not private" every session.

### Install mkcert

```bash
brew install mkcert nss                     # macOS (nss gives Firefox trust too)
sudo apt-get install -y libnss3-tools       # Debian/Ubuntu — then grab the mkcert binary
                                            # from https://github.com/FiloSottile/mkcert/releases
choco install mkcert                        # Windows
```

### Generate dev certs

```bash
./bin/setup-dev-certs.sh
```

Writes `certs/server.crt` + `certs/server.key`, trusted for `localhost`, `127.0.0.1`, `::1`, and `dev.panaudia.com`. Run once per machine; the script is safe to re-run.

If your dev certs live elsewhere (for example, shared with the spatial-mixer Go server) you can skip the script and point Vite at them instead:

```bash
PANAUDIA_DEV_KEYS_DIR=/path/to/keys npm run dev
```

## Run

```bash
npm install
npm run dev
```

Opens at `https://localhost:5173/`. If you want to develop against `/moq-test` locally (useful when you're testing something that's cookie- or origin-scoped to the production domain), add `127.0.0.1 dev.panaudia.com` to `/etc/hosts` and browse to `https://dev.panaudia.com:5173/` instead.

## Connecting

In the UI:

- **Server Host**: `host:port` of a running spatial-mixer (or cloud-mixer) server, e.g. `localhost:4443`.
- **Transport**: `auto` picks MOQ if WebTransport is supported in your browser, otherwise WebRTC. `moq` / `webrtc` force the choice.
- **Ticket**: JWT token — _or_ tick **"Connect without ticket"** if the server is running with `PANAUDIA_UNTICKETED=1`. In tokenless mode the client generates a UUID and passes it in the connection URL.

## Notes

- The SDK is a local dependency: `"@panaudia/client": "file:../../sdks/typescript"`. After editing the SDK, rebuild it (`npm run build` in `sdks/typescript`) and clear Vite's cache before restarting:

  ```bash
  rm -rf node_modules/.vite && npm run dev
  ```
