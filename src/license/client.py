"""Client for the existing Hongguo challenge/activate/refresh/status API.

The HSArriver client intentionally exposes card activation only.  It never
calls Hongguo's automatic ``/trial`` route; a one-day trial is represented by
an administrator-issued ``plan=trial`` card entered by the user.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import time
from typing import Any, Callable, Mapping
from urllib import error as url_error
from urllib import request


BASE_URL = "https://api.hgapp.shop"
TRUSTED_KEYS = {
    "prod-2026-01": "oGTHWFKptcDwJZYVdIsB6yH3EqdddTnv1BeLrmJ5mWA",
}
LEASE_SECONDS = 259200
_ERROR_MESSAGES = {
    40101: "卡密无效，请检查后重试。",
    40102: "此卡密已绑定其他设备。",
    40103: "授权已到期，请使用新卡密续费。",
    40104: "授权已停用，请联系管理员。",
    40105: "设备签名验证失败。",
    40106: "验证已超时，请重试。",
    40107: "设备密钥与原授权不一致。",
    40108: "此设备已是永久授权，无需续费。",
    40110: "此设备已领取过体验卡，请使用新的卡密。",
    42901: "操作频繁，请稍后重试。",
}


class LicenseError(RuntimeError):
    def __init__(self, message: str, code: int | str | None = None):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class LicenseState:
    token: str = ""
    plan: str = ""
    permanent: bool = False
    entitlement_expires_at: int | None = None
    lease_expires_at: int = 0
    server_time: int = 0
    revision: int = 0

    @property
    def usable(self) -> bool:
        now = int(time.time())
        return bool(self.token and self.lease_expires_at > now and (
            self.permanent or (self.entitlement_expires_at or 0) > now))


def normalize_card_code(value: str) -> str:
    if not isinstance(value, str):
        raise LicenseError("请输入有效卡密。")
    card = value.strip()
    if not card or len(card) > 128 or any(ord(c) <= 32 or ord(c) >= 127 for c in card):
        raise LicenseError("卡密格式无效，请检查空格与字符。")
    return card.upper()


def proof_message(action: str, challenge: Mapping[str, Any], device: Mapping[str, Any],
                  card_code: str = "") -> bytes:
    if action not in {"activate", "refresh"}:
        raise LicenseError("不支持的授权动作。")
    digest = (hashlib.sha256(normalize_card_code(card_code).encode("utf-8")).hexdigest()
              if action == "activate" else "")
    return ("hongguo-license-v1\n{}\n{}\n{}\n{}\n{}".format(
        action, challenge["challengeId"], challenge["nonce"],
        device["fingerprint"], digest)).encode("utf-8")


def _b64url_decode(value: str) -> bytes:
    if not isinstance(value, str) or not value:
        raise LicenseError("授权信息无效。")
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (TypeError, ValueError) as exc:
        raise LicenseError("授权信息无效。") from exc
    if base64.urlsafe_b64encode(raw).decode().rstrip("=") != value:
        raise LicenseError("授权信息无效。")
    return raw


def _protect_private_key(raw: bytes) -> str:
    """Protect a device private key with Windows DPAPI for portable builds."""
    try:
        import win32crypt
        protected = win32crypt.CryptProtectData(
            raw, "HSArriverTurbo device key", None, None, None, 0)[1]
    except Exception as exc:
        raise LicenseError("系统安全存储不可用，无法保存设备授权密钥。") from exc
    return "dpapi:" + base64.urlsafe_b64encode(protected).decode().rstrip("=")


def _unprotect_private_key(value: str) -> bytes:
    if str(value).startswith("dpapi:"):
        try:
            import win32crypt
            protected = _b64url_decode(str(value)[6:])
            return bytes(win32crypt.CryptUnprotectData(protected, None, None, None, 0)[1])
        except Exception as exc:
            raise LicenseError("设备授权密钥无法解密，请保留原密钥文件。") from exc
    # Compatibility for the first development builds only.  New keys are
    # always written with the dpapi: prefix above.
    return _b64url_decode(str(value))


def verify_lease(token: str, *, trusted_keys: Mapping[str, str],
                 device: Mapping[str, Any], now: int | None = None) -> dict[str, Any]:
    now = int(time.time()) if now is None else int(now)
    try:
        header_b64, claims_b64, signature_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
        claims = json.loads(_b64url_decode(claims_b64).decode("utf-8"))
        if header.get("alg") != "EdDSA" or header.get("typ") != "JWT":
            raise LicenseError("授权信息无效。")
        key_b64 = trusted_keys.get(header.get("kid"))
        if not key_b64:
            raise LicenseError("授权签名版本不受信任。")
        signature = _b64url_decode(signature_b64)
        if len(signature) != 64:
            raise LicenseError("授权签名无效。")
        from cryptography.hazmat.primitives.asymmetric.ed25519 import (
            Ed25519PublicKey,
        )
        public_key = Ed25519PublicKey.from_public_bytes(_b64url_decode(key_b64))
        public_key.verify(signature, f"{header_b64}.{claims_b64}".encode("ascii"))
        if (claims.get("iss") != "hongguo-service"
                or claims.get("aud") != "hongguo"
                or claims.get("fingerprint") != device.get("fingerprint")
                or claims.get("deviceKey") != device.get("publicKey")):
            raise LicenseError("授权设备不匹配。")
        if not isinstance(claims.get("iat"), int) or not isinstance(claims.get("exp"), int):
            raise LicenseError("授权时间无效。")
        if claims["iat"] > now or claims["exp"] <= now:
            raise LicenseError("离线租约已结束，请联网验证。")
        if claims.get("permanent"):
            expected = claims["iat"] + LEASE_SECONDS
        else:
            expires = claims.get("entitlementExpiresAt")
            expected = min(claims["iat"] + LEASE_SECONDS, expires) \
                if isinstance(expires, int) else 0
            if not isinstance(expires, int) or expires <= now:
                raise LicenseError("授权已到期，请使用新卡密续费。")
        if claims["exp"] != expected:
            raise LicenseError("授权租约无效。")
        return claims
    except LicenseError:
        raise
    except Exception as exc:
        raise LicenseError("授权签名无效。") from exc


class LicenseClient:
    def __init__(self, *, data_dir: str | Path, app_version: str,
                 base_url: str = BASE_URL,
                 trusted_keys: Mapping[str, str] | None = None,
                 now: Callable[[], int] | None = None,
                 opener: Callable[..., Any] | None = None):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.base_url = str(base_url).rstrip("/")
        self.trusted_keys = dict(trusted_keys or TRUSTED_KEYS)
        self.now = now or (lambda: int(time.time()))
        self.opener = opener or request.urlopen
        self.device_path = self.data_dir / "device-key.json"
        self.lease_path = self.data_dir / "lease.json"
        self.device = self._load_or_create_device(app_version)

    def _public_device(self) -> dict[str, str]:
        return {
            key: self.device[key]
            for key in ("fingerprint", "publicKey", "platform", "appVersion")
            if key in self.device
        }

    def _load_or_create_device(self, app_version: str) -> dict[str, str]:
        try:
            stored = json.loads(self.device_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            stored = None
        if stored is not None:
            if not isinstance(stored, dict) or stored.get("appVersion") != str(app_version):
                stored["appVersion"] = str(app_version)
            return stored
        from .identity import device_identity
        identity = device_identity(app_version)
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
            from cryptography.hazmat.primitives.serialization import (
                Encoding, NoEncryption, PrivateFormat, PublicFormat,
            )
            private_key = Ed25519PrivateKey.generate()
            raw_private = private_key.private_bytes(
                Encoding.Raw, PrivateFormat.Raw, NoEncryption())
            raw_public = private_key.public_key().public_bytes(
                Encoding.Raw, PublicFormat.Raw)
        except ImportError as exc:
            raise LicenseError(
                "缺少 cryptography，无法生成设备授权密钥；请先安装运行依赖。"
            ) from exc
        value = {
            **identity,
            "publicKey": base64.urlsafe_b64encode(raw_public).decode().rstrip("="),
            "privateKey": _protect_private_key(raw_private),
        }
        self._write_json(self.device_path, value)
        return value

    @staticmethod
    def _write_json(path: Path, value: Mapping[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        os.replace(temp, path)

    def _private_key(self):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        return Ed25519PrivateKey.from_private_bytes(
            _unprotect_private_key(self.device["privateKey"]))

    def _request(self, route: str, body: Mapping[str, Any], token: str = "") -> dict[str, Any]:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = request.Request(
            f"{self.base_url}/api/v1/license/{route}",
            data=payload, headers=headers, method="POST")
        try:
            with self.opener(req, timeout=10) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (OSError, url_error.URLError, TimeoutError) as exc:
            raise LicenseError("暂时无法连接授权服务，请检查网络后重试。", "transport") from exc
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise LicenseError("授权服务响应无效，请稍后重新验证。", "protocol") from exc
        code = data.get("code") if isinstance(data, dict) else None
        if code != 0:
            raise LicenseError(_ERROR_MESSAGES.get(code, "授权验证失败，请稍后重试。"), code)
        result = data.get("data")
        if not isinstance(result, dict):
            raise LicenseError("授权服务响应无效，请稍后重新验证。", "protocol")
        return result

    def _exchange(self, action: str, card_code: str = "") -> LicenseState:
        card = normalize_card_code(card_code) if action == "activate" else ""
        device = self._public_device()
        challenge = self._request("challenge", {"action": action, "device": device})
        if (not isinstance(challenge.get("challengeId"), str)
                or not isinstance(challenge.get("nonce"), str)
                or int(challenge.get("expiresAt", 0)) <= self.now()):
            raise LicenseError("授权挑战已失效，请重试。")
        signature = self._private_key().sign(
            proof_message(action, challenge, device, card))
        body = {
            "challengeId": challenge["challengeId"],
            "signature": base64.urlsafe_b64encode(signature).decode().rstrip("="),
            "device": device,
        }
        if card:
            body["cardCode"] = card
        result = self._request(action, body)
        token = result.get("token")
        claims = verify_lease(token, trusted_keys=self.trusted_keys,
                             device=device, now=self.now())
        state = LicenseState(
            token=token,
            plan=claims.get("plan", ""),
            permanent=bool(claims.get("permanent")),
            entitlement_expires_at=claims.get("entitlementExpiresAt"),
            lease_expires_at=int(claims["exp"]),
            server_time=int(result.get("serverTime", 0)),
            revision=int(claims.get("revision", 0)),
        )
        self._write_json(self.lease_path, state.__dict__)
        return state

    def activate(self, card_code: str) -> LicenseState:
        return self._exchange("activate", card_code)

    def refresh(self) -> LicenseState:
        return self._exchange("refresh")

    def status(self) -> LicenseState:
        try:
            data = json.loads(self.lease_path.read_text(encoding="utf-8"))
            state = LicenseState(**data)
        except (FileNotFoundError, TypeError, ValueError, json.JSONDecodeError):
            return LicenseState()
        if not state.token:
            return state
        try:
            self._request("status", {}, state.token)
        except LicenseError:
            return LicenseState()
        return state
