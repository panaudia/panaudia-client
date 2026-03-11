Help the user create and sign Panaudia tickets (JWTs) in their language of choice. Use the verified example code in this skill's `examples/` directory as the primary reference — adapt from these patterns rather than generating from scratch.

## What this skill does

Guide the user through generating Ed25519 key pairs and creating signed JWT tickets for Panaudia. Produce working code in their language.

## Key file to consult

Read `docs/tickets.md` for the full ticket specification (claims, types, constraints). The information below is a working summary — defer to that file if the user asks detailed questions about specific claims.

## Essential details the code MUST get right

- **Algorithm**: Ed25519 (EdDSA). Not RS256, not ES256, not HS256.
- **Header**: Must include all three fields: `"typ": "JWT"`, `"alg": "EdDSA"`, `"crv": "Ed25519"`
- **Key format**: PEM (PKCS8 for private, SubjectPublicKeyInfo for public)
- **Required payload claims**: `iss`, `iat`, `aud`, `jti`, `preferred_username`
- **`jti`**: Must be a UUID string (e.g. `"8c5d04e0-5e84-4d52-94bd-48d64d74510a"`)
- **`aud`**: The Space ID string
- **`iat`**: Unix timestamp in seconds (integer, not milliseconds)
- **Optional claims**: `nbf`, `exp` (Unix seconds), `panaudia` object with `gain`, `attenuation`, `priority`, `subspaces`, `attrs`
- **Panaudia claims** go inside a `"panaudia": {}` object, NOT at the top level

## Verified code examples

There are verified, tested examples for three languages. Read the source files directly for the most up-to-date code:

### Python

Libraries: `PyJWT` and `cryptography` (`pip install PyJWT cryptography`)

- **Generate keys**: [examples/python/generate_keys.py](examples/python/generate_keys.py)
- **Create ticket**: [examples/python/create_ticket.py](examples/python/create_ticket.py)
- **Test**: [examples/python/test_python.py](examples/python/test_python.py)

### TypeScript / Node.js

Libraries: `jose` (v5+), Node.js 16+ (`npm install jose`)

- **Generate keys**: [examples/typescript/generate_keys.mts](examples/typescript/generate_keys.mts)
- **Create ticket**: [examples/typescript/create_ticket.mts](examples/typescript/create_ticket.mts)
- **Test**: [examples/typescript/test_typescript.mts](examples/typescript/test_typescript.mts)

### Go

Libraries: `golang-jwt/jwt/v5`, `google/uuid`

- **Generate keys**: [examples/go/generate_keys/main.go](examples/go/generate_keys/main.go)
- **Create ticket**: [examples/go/create_ticket/main.go](examples/go/create_ticket/main.go)
- **Test**: [examples/go/main.go](examples/go/main.go)

**Note on Go:** `golang-jwt` sets `alg: "EdDSA"` automatically from `SigningMethodEdDSA`, but does NOT set `typ` or `crv` — those must be added manually to `token.Header`.

## Adapting to other languages

When the user asks for a language without a verified example above, read the Python examples and adapt from them. Follow these rules:

1. **Find a well-maintained JWT library** for their language that supports EdDSA/Ed25519. Prefer the most popular/standard library.
2. **Match the exact header** — some libraries auto-set `alg` but omit `crv`. Ensure all three fields are present.
3. **Match the payload structure exactly** — same claim names, same types, `panaudia` as a nested object.
4. **Use the platform's standard UUID generator** for `jti`.
5. **Use PEM format** for keys unless the library specifically requires another format.
6. **Show key generation** using OpenSSL (works everywhere) or the language's crypto library if it has Ed25519 support.
7. **Tell the user this is an untested adaptation** and they should verify the output at [jwt.io](https://jwt.io) or by decoding the token.

## Common user questions

- **"Where do I get the Space ID?"** — It's created when you set up a Space on the Panaudia platform. It looks like `space_df8c7a85-0702-45e9-a626-a1c147eafce9`.
- **"Where does the public key go?"** — You provide it when creating a Space so the server can verify your tickets.
- **"Can I reuse tickets?"** — Yes, a ticket can be used multiple times to enter and leave. But two users cannot use the same ticket simultaneously.
- **"Do tickets expire?"** — Only if you set the `exp` claim. Without it, the ticket is valid as long as the Space is active.
- **"What are subspaces?"** — Optional audio isolation groups. Participants only hear others who share at least one subspace. Each subspace ID is a UUID string.

$ARGUMENTS
