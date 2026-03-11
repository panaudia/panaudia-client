"""Create and sign a Panaudia ticket with Python."""

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
