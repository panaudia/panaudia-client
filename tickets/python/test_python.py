"""Verify Python ticket creation and signing."""

import time
import uuid
import json
import base64
import sys

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding, NoEncryption, PrivateFormat, PublicFormat
)
import jwt

# --- Step 1: Generate keys ---

private_key = Ed25519PrivateKey.generate()

private_pem = private_key.private_bytes(
    encoding=Encoding.PEM,
    format=PrivateFormat.PKCS8,
    encryption_algorithm=NoEncryption()
)

public_pem = private_key.public_key().public_bytes(
    encoding=Encoding.PEM,
    format=PublicFormat.SubjectPublicKeyInfo
)

print("Keys generated OK")

# --- Step 2: Create and sign ticket ---

headers = {
    "typ": "JWT",
    "alg": "EdDSA",
    "crv": "Ed25519",
}

now = int(time.time())
jti = str(uuid.uuid4())

payload = {
    "iat": now,
    "iss": "test-verify",
    "aud": "space_df8c7a85-0702-45e9-a626-a1c147eafce9",
    "jti": jti,
    "preferred_username": "TestUser",
    "panaudia": {
        "gain": 1.5,
        "attenuation": 2.0,
        "priority": True,
        "subspaces": ["a1b2c3d4-0000-0000-0000-000000000001"],
        "attrs": {"colour": "00aaff"},
    },
}

ticket = jwt.encode(payload, private_pem, algorithm="EdDSA", headers=headers)
print(f"Ticket created OK ({len(ticket)} chars)")

# --- Step 3: Verify ---

# Decode without verification to inspect structure
parts = ticket.split(".")
assert len(parts) == 3, f"Expected 3 parts, got {len(parts)}"

# Decode header
header_json = json.loads(base64.urlsafe_b64decode(parts[0] + "=="))
assert header_json["typ"] == "JWT", f"typ: {header_json.get('typ')}"
assert header_json["alg"] == "EdDSA", f"alg: {header_json.get('alg')}"
assert header_json["crv"] == "Ed25519", f"crv: {header_json.get('crv')}"
print(f"Header OK: {header_json}")

# Decode payload
payload_json = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
assert payload_json["iss"] == "test-verify"
assert payload_json["aud"] == "space_df8c7a85-0702-45e9-a626-a1c147eafce9"
assert payload_json["jti"] == jti
assert payload_json["preferred_username"] == "TestUser"
assert payload_json["iat"] == now
assert payload_json["panaudia"]["gain"] == 1.5
assert payload_json["panaudia"]["attenuation"] == 2.0
assert payload_json["panaudia"]["priority"] is True
assert payload_json["panaudia"]["subspaces"] == ["a1b2c3d4-0000-0000-0000-000000000001"]
assert payload_json["panaudia"]["attrs"]["colour"] == "00aaff"
print(f"Payload OK: all claims verified")

# Verify signature with public key
decoded = jwt.decode(ticket, public_pem, algorithms=["EdDSA"], audience="space_df8c7a85-0702-45e9-a626-a1c147eafce9")
print("Signature verified OK with public key")

print("\n=== PYTHON: ALL TESTS PASSED ===")
