Help the user integrate with Panaudia from start to finish. Guide them through choosing a hosting option, setting up a Space, integrating a client SDK, and creating Tickets. Adapt the guidance to their platform and use case.

## What this skill does

Walk the user through the complete Panaudia integration process: hosting, client integration, and authentication. Help them choose the right hosting option and client SDK for their needs.

## Key files to consult

- `docs/space-hosting.md` — the three hosting options and their workflows
- `docs/panaudia-space.md` — self-hosted server setup, Docker, configuration, licensing
- `docs/spaces-api-guide.md` — Panaudia Cloud REST API for creating Spaces
- `docs/tickets.md` — JWT ticket creation and signing
- `docs/coordinates.md` — coordinate system details

## The three steps

There are three steps to using Panaudia:

1. **Set up a Panaudia Space** — choose a hosting option
2. **Integrate client software** — add an SDK to your application
3. **Give users Tickets** — create signed JWTs so users can join

## Step 1: Hosting options

There are three ways to host a Panaudia Space. Help the user choose the right one:

### Option A: Panaudia Cloud Dev Server

Best for: experimentation and prototyping, no sign-up needed.

- Request access from Panaudia support
- You receive a Space ID and a key pair for creating Tickets
- Free, shared server — not for production use

### Option B: Panaudia Cloud

Best for: production use without managing infrastructure.

Workflow:
1. Sign up at panaudia.com
2. Create an Organisation and add a Billing account
3. Create a Project and generate an API Key
4. Generate an Ed25519 key pair for signing Tickets (see `docs/tickets.md`)
5. Create Spaces via the REST API (see `docs/spaces-api-guide.md` or the `spaces-api` skill) using the API Key and public key

Cloud Spaces can hold more participants (up to 500) and support second-order ambisonics.

### Option C: Self-Hosted Panaudia Space

Best for: full control, higher-order ambisonics, or specific network requirements. Requires a licence from Panaudia Cloud (free for many non-commercial uses).

Workflow:
1. Sign up at panaudia.com
2. Download the Panaudia Space server from your Organisation's page
3. Install and run — see `docs/panaudia-space.md` for Docker quick start and manual install
4. Tickets are optional for self-hosted Spaces. If authentication is needed:
   - Generate an Ed25519 key pair
   - Set `PANAUDIA_TICKET_KEY_PATH` to the public key path

Self-hosted Spaces have lower max capacity but support higher-order ambisonics (second to fifth order).

Key configuration environment variables:
- `PANAUDIA_LICENCE_PATH` or `PANAUDIA_LICENCE_STRING` — licence file
- `PANAUDIA_SPACE_SIZE` — space size in metres (default 40)
- `PANAUDIA_SPACE_ORDER` — ambisonic order (default 3, max 5)
- `PANAUDIA_HTTP_PORT` — WebSocket port (default 8080)
- `PANAUDIA_RTC_PORT` — WebRTC port (default 8443)
- `PANAUDIA_TICKET_KEY_PATH` — public key for ticket validation (optional)

See `docs/panaudia-space.md` for the full configuration reference.

## Step 2: Client integration

Help the user pick the right client SDK:

| Client | Platform | Best for | Skill |
|--------|----------|----------|-------|
| TypeScript SDK | Web browsers | Web apps, 3D web frameworks | `integrate-typescript` |
| Unreal Engine Plugin | UE5 (macOS, Windows, Linux) | Game/VR experiences | `integrate-unreal` |
| Panaudia Link | macOS native app | Desktop users, higher-order ambisonic output | See panaudia.com/docs/link |

For detailed integration help, defer to the `integrate-typescript` or `integrate-unreal` skills as appropriate.

## Step 3: Tickets

Every user needs a unique JWT ticket to join a Space. Tickets are signed with Ed25519 keys.

Key points:
- **Algorithm**: Ed25519 (EdDSA), never RS256/ES256/HS256
- **`aud` claim**: must be the Space ID
- **`jti` claim**: must be a UUID, unique per user
- Two users cannot use the same ticket simultaneously
- For self-hosted Spaces, tickets are optional

For code examples in Python, TypeScript, or Go, defer to the `create-tickets` skill or read `docs/tickets.md`.

## Decision helper

If the user is unsure, ask these questions:

1. **"Are you evaluating or building for production?"**
   - Evaluating → Dev Server (Option A)
   - Production → Cloud (Option B) or Self-Hosted (Option C)

2. **"Do you want to manage your own server?"**
   - No → Cloud (Option B)
   - Yes → Self-Hosted (Option C)

3. **"Do you need higher than second-order ambisonics (order 3–5)?"**
   - Yes → Self-Hosted (Option C)
   - No → Either works (both support second-order)

4. **"What platform are you building for?"**
   - Web → TypeScript SDK
   - Unreal Engine → UE Plugin
   - macOS desktop → Panaudia Link

$ARGUMENTS
