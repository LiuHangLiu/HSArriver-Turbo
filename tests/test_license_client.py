import base64
import json
from pathlib import Path
import tempfile
import unittest

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from src.license.client import LicenseClient, normalize_card_code, proof_message
from src.license.identity import fingerprint


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


class _Response:
    def __init__(self, value):
        self.value = value

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.value).encode("utf-8")


class LicenseClientTests(unittest.TestCase):
    def test_identity_and_card_normalization_match_hongguo_protocol(self):
        self.assertEqual(
            fingerprint("win32", "00112233-4455-6677-8899-aabbccddeeff"),
            "6f1381f3aff3770c60425383375e23f7013d742fa0b9aae8b43082f0326194af",
        )
        self.assertEqual(normalize_card_code(" hg-abcd-1234 "), "HG-ABCD-1234")
        self.assertIn(b"hongguo-license-v1\nactivate\n", proof_message(
            "activate", {"challengeId": "c", "nonce": "n"},
            {"fingerprint": "f"}, "hg-card"))

    def test_activate_uses_card_and_never_automatic_trial(self):
        server_key = Ed25519PrivateKey.generate()
        device_key = Ed25519PrivateKey.generate()
        now = 1000
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "device-key.json").write_text(json.dumps({
                "fingerprint": "a" * 64,
                "platform": "win32",
                "appVersion": "test",
                "publicKey": b64(device_key.public_key().public_bytes(
                    Encoding.Raw, PublicFormat.Raw)),
                "privateKey": b64(device_key.private_bytes_raw()),
            }), encoding="utf-8")
            claims = {
                "iss": "hongguo-service", "aud": "hongguo", "sub": "device",
                "fingerprint": "a" * 64,
                "deviceKey": b64(device_key.public_key().public_bytes(
                    Encoding.Raw, PublicFormat.Raw)),
                "plan": "trial", "permanent": False,
                "entitlementExpiresAt": 5000, "revision": 1,
                "iat": 900, "exp": 5000,
            }
            header = {"alg": "EdDSA", "typ": "JWT", "kid": "test"}
            encoded = f"{b64(json.dumps(header, separators=(',', ':')).encode())}." \
                f"{b64(json.dumps(claims, separators=(',', ':')).encode())}"
            token = encoded + "." + b64(server_key.sign(encoded.encode("ascii")))
            routes = []

            def opener(req, timeout=0):
                del timeout
                route = req.full_url.rsplit("/", 1)[-1]
                routes.append(route)
                if route == "challenge":
                    return _Response({"code": 0, "data": {
                        "challengeId": "challenge", "nonce": "nonce", "expiresAt": 1100,
                    }})
                if route == "activate":
                    return _Response({"code": 0, "data": {
                        "token": token, "serverTime": now, "refreshAfter": 2000,
                    }})
                raise AssertionError(route)

            client = LicenseClient(
                data_dir=root, app_version="test", now=lambda: now,
                trusted_keys={"test": b64(server_key.public_key().public_bytes(
                    Encoding.Raw, PublicFormat.Raw))}, opener=opener)
            state = client.activate("hg-card")
            self.assertTrue(state.token)
            self.assertEqual(state.plan, "trial")
            self.assertEqual(routes, ["challenge", "activate"])
            self.assertEqual(json.loads((root / "lease.json").read_text())["plan"], "trial")


if __name__ == "__main__":
    unittest.main()
