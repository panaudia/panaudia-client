"""
Cross-language verification test.

Generates a key pair with Python, then creates tickets with Go and TypeScript,
and verifies that Python can validate the signatures from both.
"""

import json
import os
import subprocess
import sys
import tempfile

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding, NoEncryption, PrivateFormat, PublicFormat
)
import jwt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SPACE_ID = "space_df8c7a85-0702-45e9-a626-a1c147eafce9"


def generate_keys(tmpdir: str) -> tuple[bytes, bytes]:
    """Generate Ed25519 key pair and write PEM files to tmpdir."""
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

    with open(os.path.join(tmpdir, "private.pem"), "wb") as f:
        f.write(private_pem)
    with open(os.path.join(tmpdir, "public.pem"), "wb") as f:
        f.write(public_pem)

    return private_pem, public_pem


def verify_ticket(ticket: str, public_pem: bytes, label: str):
    """Decode and verify a ticket with Python, checking all claims."""
    decoded = jwt.decode(
        ticket,
        public_pem,
        algorithms=["EdDSA"],
        audience=SPACE_ID,
    )

    assert decoded["iss"] == "my-app", f"{label}: iss = {decoded['iss']}"
    assert decoded["preferred_username"] == "Paul", f"{label}: preferred_username = {decoded['preferred_username']}"
    assert isinstance(decoded["iat"], int), f"{label}: iat not int"
    assert decoded["jti"], f"{label}: jti empty"

    p = decoded.get("panaudia", {})
    assert p.get("gain") == 1.5, f"{label}: gain = {p.get('gain')}"
    assert p.get("priority") is True, f"{label}: priority = {p.get('priority')}"
    assert p.get("attrs", {}).get("colour") == "00aaff", f"{label}: attrs.colour = {p.get('attrs', {}).get('colour')}"

    print(f"  {label}: signature valid, all claims correct (jti={decoded['jti'][:8]}...)")


def create_ticket_with_typescript(tmpdir: str) -> str:
    """Run the TypeScript create_ticket script and capture the JWT."""
    ts_dir = os.path.join(SCRIPT_DIR, "typescript")
    # Copy keys into typescript dir
    for f in ("private.pem", "public.pem"):
        src = os.path.join(tmpdir, f)
        dst = os.path.join(ts_dir, f)
        with open(src, "rb") as s, open(dst, "wb") as d:
            d.write(s.read())

    try:
        result = subprocess.run(
            ["npx", "tsx", "create_ticket.mts"],
            cwd=ts_dir,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            print(f"  TypeScript stderr: {result.stderr}", file=sys.stderr)
            raise RuntimeError(f"TypeScript failed: {result.stderr}")
        return result.stdout.strip()
    finally:
        for f in ("private.pem", "public.pem"):
            try:
                os.remove(os.path.join(ts_dir, f))
            except FileNotFoundError:
                pass


def create_ticket_with_go(tmpdir: str) -> str:
    """Run the Go create_ticket program and capture the JWT."""
    go_dir = os.path.join(SCRIPT_DIR, "go", "create_ticket")
    # Copy keys into go dir
    for f in ("private.pem", "public.pem"):
        src = os.path.join(tmpdir, f)
        dst = os.path.join(go_dir, f)
        with open(src, "rb") as s, open(dst, "wb") as d:
            d.write(s.read())

    try:
        result = subprocess.run(
            ["go", "run", "."],
            cwd=go_dir,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            print(f"  Go stderr: {result.stderr}", file=sys.stderr)
            raise RuntimeError(f"Go failed: {result.stderr}")
        return result.stdout.strip()
    finally:
        for f in ("private.pem", "public.pem"):
            try:
                os.remove(os.path.join(go_dir, f))
            except FileNotFoundError:
                pass


def main():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Step 1: Generate keys with Python
        print("Generating keys with Python...")
        private_pem, public_pem = generate_keys(tmpdir)
        print("  Keys generated OK")

        # Step 2: Create ticket with TypeScript, verify with Python
        print("\nCreating ticket with TypeScript...")
        ts_ticket = create_ticket_with_typescript(tmpdir)
        print(f"  Ticket created ({len(ts_ticket)} chars)")
        verify_ticket(ts_ticket, public_pem, "TypeScript → Python")

        # Step 3: Create ticket with Go, verify with Python
        print("\nCreating ticket with Go...")
        go_ticket = create_ticket_with_go(tmpdir)
        print(f"  Ticket created ({len(go_ticket)} chars)")
        verify_ticket(go_ticket, public_pem, "Go → Python")

        print("\n=== CROSS-LANGUAGE: ALL TESTS PASSED ===")


if __name__ == "__main__":
    main()
