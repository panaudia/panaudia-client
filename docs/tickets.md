# Tickets

Panaudia uses [JSON Web Tokens](https://en.wikipedia.org/wiki/JSON_Web_Token) (JWTs) as tickets to control access to Spaces. You create and sign tickets yourself using Ed25519 keys, then pass them to the client SDK on connection.

Every user accessing a Space needs their own unique ticket. Two users cannot use the same ticket at the same time — the second one will be rejected. Tickets can however be reused to come and go from a Space.

## Overview

Creating a ticket involves three steps:

1. **Generate an Ed25519 key pair** (once, then reuse)
2. **Build the JWT payload** with the participant's details
3. **Sign it** with your private key

The server validates tickets using the corresponding public key, which you provide when creating a Space.

## Key Pair

Tickets are signed with [Ed25519](https://en.wikipedia.org/wiki/EdDSA#Ed25519) keys in PEM format. Generate a key pair with OpenSSL:

```bash
# Generate private key
openssl genpkey -algorithm ed25519 -out private.pem

# Extract public key
openssl pkey -in private.pem -pubout -out public.pem
```

Keep `private.pem` secret on your server. Provide `public.pem` to Panaudia when creating a Space so the server can verify your tickets.

## Payload

The JWT payload contains standard JWT claims and optional Panaudia-specific configuration.

### Required claims

| Claim | Type | Description |
|-------|------|-------------|
| `iss` | string | Issuer — an identifier for your application |
| `iat` | integer | Issued-at — Unix timestamp (seconds since epoch) |
| `aud` | string | Audience — the Space ID this ticket grants access to |
| `jti` | string | JWT ID — a UUID that uniquely identifies this participant |
| `preferred_username` | string | Display name — any UTF-8 string, does not need to be unique |

### Time constraints (optional)

| Claim | Type | Description |
|-------|------|-------------|
| `nbf` | integer | Not-before — ticket cannot be used before this Unix timestamp |
| `exp` | integer | Expires — ticket cannot be used after this Unix timestamp |

These are useful for time-limited access, such as ensuring everyone enters before a show starts, or allocating entry slots.

### Panaudia claims (optional)

Additional configuration goes in a `panaudia` object within the payload:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `gain` | number (0.0–3.0) | 1.0 | Linear gain adjustment — makes this participant louder or quieter to others |
| `attenuation` | number (0.0–3.0) | 2.0 | Distance attenuation exponent. 2.0 = inverse square (natural), 1.0 = linear, 0.0 = no falloff, 3.0 = inverse cube |
| `priority` | boolean | false | Priority speaker — ensures correct spatialisation even at distance. Useful for performers or moderators |
| `subspaces` | string[] | — | List of subspace UUIDs. If set, this participant only hears and is heard by others sharing at least one subspace |
| `attrs` | object | — | Custom key-value attributes broadcast to other participants (not used by Panaudia itself) |

### Example payload

A minimal ticket:

```json
{
  "iat": 1731194009,
  "iss": "my-app",
  "aud": "space_df8c7a85-0702-45e9-a626-a1c147eafce9",
  "jti": "8c5d04e0-5e84-4d52-94bd-48d64d74510a",
  "preferred_username": "Paul"
}
```

A ticket with all optional fields:

```json
{
  "iat": 1731194009,
  "iss": "my-app",
  "aud": "space_df8c7a85-0702-45e9-a626-a1c147eafce9",
  "jti": "8c5d04e0-5e84-4d52-94bd-48d64d74510a",
  "preferred_username": "Paul",
  "nbf": 1733391000,
  "exp": 1733394000,
  "panaudia": {
    "attenuation": 2.0,
    "gain": 1.5,
    "priority": true,
    "subspaces": ["a1b2c3d4-0000-0000-0000-000000000001"],
    "attrs": {
      "colour": "00aaff"
    }
  }
}
```

## Header

Every Panaudia ticket uses the same JWT header:

```json
{
  "typ": "JWT",
  "alg": "EdDSA",
  "crv": "Ed25519"
}
```

## Signing

The header and payload are each base64url-encoded, joined with a dot, and signed with your Ed25519 private key. The base64url-encoded signature is appended after a second dot, producing a string like:

```
eyJhbGciOiJFZERTQSIs...header...eyJpYXQiOjE3MzExOTYw...payload...Tc9OJHjm4hrMXV4z...signature
```

Most languages have JWT libraries that handle encoding and signing for you.

## Code Examples

### Python

Requires [PyJWT](https://pypi.org/project/PyJWT/) and [cryptography](https://pypi.org/project/cryptography/):

```bash
pip install PyJWT cryptography
```

**Generate keys:**

```python
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding, NoEncryption, PrivateFormat, PublicFormat
)

private_key = Ed25519PrivateKey.generate()

# Save private key (keep secret)
private_pem = private_key.private_bytes(
    encoding=Encoding.PEM,
    format=PrivateFormat.PKCS8,
    encryption_algorithm=NoEncryption()
)

# Save public key (give to Panaudia)
public_pem = private_key.public_key().public_bytes(
    encoding=Encoding.PEM,
    format=PublicFormat.SubjectPublicKeyInfo
)

with open("private.pem", "wb") as f:
    f.write(private_pem)
with open("public.pem", "wb") as f:
    f.write(public_pem)
```

**Create and sign a ticket:**

```python
import time
import uuid
import jwt

# Load your private key
with open("private.pem", "rb") as f:
    private_key = f.read()

headers = {
    "typ": "JWT",
    "alg": "EdDSA",
    "crv": "Ed25519",
}

payload = {
    "iat": int(time.time()),
    "iss": "my-app",
    "aud": "space_df8c7a85-0702-45e9-a626-a1c147eafce9",
    "jti": str(uuid.uuid4()),
    "preferred_username": "Paul",
}

# Optional: add Panaudia-specific claims
payload["panaudia"] = {
    "gain": 1.5,
    "priority": True,
    "attrs": {"colour": "00aaff"},
}

ticket = jwt.encode(payload, private_key, algorithm="EdDSA", headers=headers)
print(ticket)
```

### TypeScript / Node.js

Requires [jose](https://www.npmjs.com/package/jose) (v5+) and Node.js 16+:

```bash
npm install jose
```

**Generate keys:**

```typescript
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

fs.writeFileSync('private.pem', privateKey.export({ type: 'pkcs8', format: 'pem' }));
fs.writeFileSync('public.pem', publicKey.export({ type: 'spki', format: 'pem' }));
```

**Create and sign a ticket:**

```typescript
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

const privatePem = fs.readFileSync('private.pem', 'utf-8');
const privateKey = await importPKCS8(privatePem, 'EdDSA');

const ticket = await new SignJWT({
  iss: 'my-app',
  aud: 'space_df8c7a85-0702-45e9-a626-a1c147eafce9',
  jti: crypto.randomUUID(),
  preferred_username: 'Paul',
  panaudia: {
    gain: 1.5,
    priority: true,
    attrs: { colour: '00aaff' },
  },
})
  .setProtectedHeader({ typ: 'JWT', alg: 'EdDSA', crv: 'Ed25519' })
  .setIssuedAt()
  .sign(privateKey);

console.log(ticket);
```

### Go

Requires [golang-jwt/jwt/v5](https://github.com/golang-jwt/jwt):

```bash
go get github.com/golang-jwt/jwt/v5
```

**Generate keys:**

```go
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"os"
)

func main() {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		panic(err)
	}

	// Save private key
	privBytes, _ := x509.MarshalPKCS8PrivateKey(priv)
	privFile, _ := os.Create("private.pem")
	pem.Encode(privFile, &pem.Block{Type: "PRIVATE KEY", Bytes: privBytes})
	privFile.Close()

	// Save public key
	pubBytes, _ := x509.MarshalPKIXPublicKey(pub)
	pubFile, _ := os.Create("public.pem")
	pem.Encode(pubFile, &pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
	pubFile.Close()
}
```

**Create and sign a ticket:**

```go
package main

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	jwt "github.com/golang-jwt/jwt/v5"
)

type PanaudiaClaims struct {
	Gain        float64            `json:"gain,omitempty"`
	Attenuation float64            `json:"attenuation,omitempty"`
	Priority    bool               `json:"priority,omitempty"`
	Subspaces   []string           `json:"subspaces,omitempty"`
	Attrs       map[string]string  `json:"attrs,omitempty"`
}

type TicketClaims struct {
	jwt.RegisteredClaims
	PreferredUsername string          `json:"preferred_username"`
	Panaudia          *PanaudiaClaims `json:"panaudia,omitempty"`
}

func main() {
	// Load private key
	keyData, _ := os.ReadFile("private.pem")
	block, _ := pem.Decode(keyData)
	parsed, _ := x509.ParsePKCS8PrivateKey(block.Bytes)
	privateKey := parsed.(ed25519.PrivateKey)

	claims := TicketClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:   "my-app",
			Audience: jwt.ClaimStrings{"space_df8c7a85-0702-45e9-a626-a1c147eafce9"},
			ID:       uuid.New().String(),
			IssuedAt: jwt.NewNumericDate(time.Now()),
		},
		PreferredUsername: "Paul",
		Panaudia: &PanaudiaClaims{
			Gain:     1.5,
			Priority: true,
			Attrs:    map[string]string{"colour": "00aaff"},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
	token.Header["typ"] = "JWT"
	token.Header["crv"] = "Ed25519"

	ticket, err := token.SignedString(privateKey)
	if err != nil {
		panic(err)
	}
	fmt.Println(ticket)
}
```

**Note:** The Go example uses `github.com/google/uuid` for UUID generation (`go get github.com/google/uuid`).

## Schema

The full JSON Schema for the ticket payload is available at [`schemata/panaudia-ticket-1.0.0.schema.json`](../schemata/panaudia-ticket-1.0.0.schema.json).

## Notes

- Tickets are **anonymous access tokens** — they make no claim about the identity of the bearer. The `jti` is the ticket's own ID, and `preferred_username` is just a display label.
- The `jti` (UUID) is used by client SDKs as the participant's node ID. You can provide a specific UUID to tie the ticket to a user in your own system, or generate a random one.
- Custom `attrs` are broadcast to other participants via the attributes data track. Use them for application-specific metadata like avatar colour, role, or profile URL.
