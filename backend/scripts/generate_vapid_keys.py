"""Print a VAPID key pair for browser push alerts.  python scripts/generate_vapid_keys.py
Copy the two lines into backend/.env."""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


key = ec.generate_private_key(ec.SECP256R1())
private = key.private_numbers().private_value.to_bytes(32, "big")
public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
print(f"VAPID_PRIVATE_KEY={b64url(private)}")
print(f"VAPID_PUBLIC_KEY={b64url(public)}")
