"""Stable Windows device identity used by the shared Hongguo license API."""

from __future__ import annotations

import hashlib
import re
import subprocess


_UUID_RE = re.compile(
    r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")


def fingerprint(platform: str, hardware_uuid: str) -> str:
    value = str(hardware_uuid or "").strip().lower()
    if platform != "win32" or not _UUID_RE.fullmatch(value):
        raise ValueError("无法读取可靠的设备标识")
    if set(value.replace("-", "")) <= {"0"} or set(value.replace("-", "")) <= {"f"}:
        raise ValueError("设备标识无效")
    return hashlib.sha256(
        f"hongguo-device-v1:{platform}:{value}".encode("utf-8")
    ).hexdigest()


def read_hardware_uuid() -> str:
    result = subprocess.run(
        [
            "powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
            "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID",
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=10,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    return result.stdout.strip()


def device_identity(app_version: str) -> dict[str, str]:
    return {
        "fingerprint": fingerprint("win32", read_hardware_uuid()),
        "platform": "win32",
        "appVersion": str(app_version),
    }
