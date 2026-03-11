# panaudia-client

This repo contains documentation and resources for use with [panaudia.com](https://panaudia.com)

## Usage

A Panaudia Space is a multi-user audio space that enables users to connect and collaborate in real-time.

There are three steps to using Panaudia

1. Set up a Panaudia Space
2. Integrate client software
3. Give users Tickets to join the Space


## Set up a Panaudia Space

There are three options for hosting Panaudia Spaces:

- Use our existing dev server for experimentation
- Host your own Panaudia Space server
- Use Panaudia Cloud to create hosted Spaces programmatically

See **[hosting spaces](docs/space-hosting.md)** for details

## Integrate client software

We currently offer web, Unreal Engine, and macOS native clients. More are on the way, including Unity and PortAudio.

### TypeScript SDK
- [README & Quick Start](sdks/typescript/README.md) — Installation, coordinate conversion for web frameworks, transport selection, browser support
- [API Reference](sdks/typescript/docs/api-reference.md) — Full method, event, and type reference for `PanaudiaClient`

### Unreal Engine Plugin
- [Usage Guide](sdks/unreal/panaudia/guide.md) — Installation, connection flow, position mapping, audio control, reconnection, troubleshooting
- [API Reference](sdks/unreal/panaudia/docs.md) — `UPanaudiaAudioComponent` methods, properties, delegates, and data types
- [PanaudiaPresence Plugin](sdks/unreal/panaudia-presence/README.md) — Companion plugin for visualising remote participants
- [Third Party Libraries](sdks/unreal/panaudia/Source/ThirdParty/README.md) — Build instructions for libpanaudia-core, libopus, libmsquic

### OS Native clients
- [Panaudia Link](https://panaudia.com/docs/link) — macOS native client application for connecting to Panaudia Spaces


## Give users Tickets to join the Space

Panaudia uses JWTs as tickets to control access to Spaces. You create and sign tickets yourself using Ed25519 keys, 
then pass them to the client software on connection.

See [Tickets](docs/tickets.md) for details on how to generate and sign tickets.


## Guides

- **[Quickstart](docs/quickstart.md)** — End-to-end walkthrough: two browser tabs with spatial audio in five minutes
- **[Space Hosting](docs/space-hosting.md)** — Three ways to set up a Panaudia Space
- **[Panaudia Space](docs/panaudia-space.md)** — Self-hosting Panaudia Space server, quick start with Docker, and configuration options
- **[Spaces API Guide](docs/spaces-api-guide.md)** — REST API for creating Spaces programmatically in Panaudia Cloud
- **[Tickets](docs/tickets.md)** — Creating Ed25519 key pairs, building JWT payloads, signing, and code examples
- **[Data Tracks](docs/data-tracks.md)** — State, attributes, and control messages between participants
- **[Coordinates](docs/coordinates.md)** — Panaudia's ambisonic coordinate system, axis conventions, and rotation order
- **[Troubleshooting](docs/troubleshooting.md)** — Common issues with tickets, connections, audio, and self-hosted servers

## Agent Skills

There are some skills to help agents work with Panaudia's API and client software:

- **[integrate-panaudia](.claude/skills/integrate-panaudia.md)** — End-to-end integration guide: hosting, client SDKs, and tickets
- **[create-tickets](.claude/skills/create-tickets/SKILL.md)** — Create tickets for joining Panaudia Spaces
- **[integrate-typescript](.claude/skills/integrate-typescript.md)** — Integrate Panaudia's TypeScript client
- **[integrate-unreal](.claude/skills/integrate-unreal.md)** — Integrate Panaudia's Unreal Engine client
- **[spaces-api](.claude/skills/spaces-api.md)** — Use the Spaces API to create Spaces programmatically


## Schemas

API and data format schemas are in [`schemata/`](schemata/):

- [`panaudia-ticket-1.0.0.schema.json`](schemata/panaudia-ticket-1.0.0.schema.json) — JWT ticket payload format
- [`panaudia-spaces-1.0.2.openapi.json`](schemata/panaudia-spaces-1.0.2.openapi.json) — Spaces management API

