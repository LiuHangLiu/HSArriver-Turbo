"""Hongguo-compatible device/card authorization for the portable launcher."""

from .client import LicenseClient, LicenseError, LicenseState
from .identity import device_identity, fingerprint

__all__ = [
    "LicenseClient", "LicenseError", "LicenseState", "device_identity",
    "fingerprint",
]
