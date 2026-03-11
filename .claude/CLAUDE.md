# panaudia-client — Project Instructions

This repo contains documentation, client SDKs, schemas, and deployment resources for Panaudia. It is the public-facing repo for developers integrating with Panaudia.

## Repo Layout

```
docs/                  — Guides and reference documentation
sdks/typescript/       — @panaudia/client TypeScript SDK (npm package)
sdks/unreal/           — Unreal Engine plugin + PanaudiaPresence companion plugin
sdks/javascript/       — Legacy WebRTC-only JS SDK (deprecated)
schemata/              — OpenAPI specs and JSON schemas (authoritative)
tickets/               — Verified ticket creation examples (Python, TypeScript, Go)
docker/                — Dockerfiles for amd64 and arm64
.claude/skills/        — Agent skills for helping developers integrate
```

## Sources of Truth

- **Spaces API** — `schemata/panaudia-spaces-1.0.2.openapi.json` is authoritative. `docs/spaces-api-guide.md` and `.claude/skills/spaces-api.md` must agree with it.
- **Ticket format** — `schemata/panaudia-ticket-1.0.0.schema.json` is authoritative. `docs/tickets.md` and the `create-tickets` skill must agree with it.
- **TypeScript SDK API** — the source code in `sdks/typescript/src/` is authoritative. `sdks/typescript/docs/api-reference.md` must match it.
- **Unreal plugin API** — the C++ headers in `sdks/unreal/panaudia/Source/panaudia/Public/` are authoritative. `sdks/unreal/panaudia/docs.md` must match them.
- **Ticket code examples** — `tickets/python/`, `tickets/typescript/`, `tickets/go/` are the verified, tested examples. The `create-tickets` skill symlinks to these via `examples/`.

When updating documentation, check it against the authoritative source. When updating schemas or source code, update the corresponding docs.

## Writing Conventions

- **British English spelling** — colour, normalised, organised, licence (noun), etc.
- **Tone** — direct and practical, not marketing. Write for developers who want to get things done.
- **Terminology** — use these terms consistently:
  - "Space" (capitalised) — a Panaudia audio space
  - "Ticket" (capitalised when referring to the concept) — a JWT for accessing a Space
  - "participant" or "user" — someone connected to a Space
  - "entity" — the SDK term for a participant in code (EntityState, EntityAttributes)
- **Code examples** — keep them minimal and runnable. Don't add error handling unless it's the point of the example.
- **Links** — use relative paths for internal links. For GitHub links to this repo, use `https://github.com/panaudia/panaudia-client/...`.

## What Belongs Here vs Elsewhere

This repo documents **how to use Panaudia as a developer**. It should NOT contain:

- Server implementation details (those belong in `spatial-mixer` or `cloud-mixer`)
- Internal architecture documentation
- Deployment or ops procedures for running the Panaudia platform

## Skills

Skills in `.claude/skills/` are for agents helping **other developers** integrate with Panaudia. They should:

- Reference docs and source files rather than duplicating content
- Include working code examples
- Be practical and task-oriented
- Not expose internal implementation details

## Updating Docs Checklist

When adding or changing documentation:

1. Update the relevant doc file in `docs/`
2. Check cross-references in other docs that link to it
3. Update `README.md` guides section if adding a new doc
4. Update the relevant skill if the change affects integration guidance
5. If changing API surface, verify against the schema or source code
