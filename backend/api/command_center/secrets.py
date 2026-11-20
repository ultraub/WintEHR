"""Encryption at rest for secret settings (UMLS key, client secrets).

The key comes from `WINTEHR_SETTINGS_KEY`: any string, hashed to a Fernet
key, so operators can paste a long random passphrase rather than a
base64-exact value. No key means secrets cannot be stored — the settings
API refuses with 409 and tells the admin what to set — rather than falling
back to plaintext.

Not a PHI control (this platform holds none); it keeps API credentials
out of plain SQL dumps and backups.
"""

from __future__ import annotations

import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

ENV_VAR = "WINTEHR_SETTINGS_KEY"


class SecretBox:
    def __init__(self, passphrase: Optional[str]):
        self._fernet: Optional[Fernet] = None
        if passphrase and passphrase.strip():
            digest = hashlib.sha256(passphrase.strip().encode()).digest()
            self._fernet = Fernet(base64.urlsafe_b64encode(digest))

    @property
    def available(self) -> bool:
        return self._fernet is not None

    def encrypt(self, plaintext: str) -> str:
        if self._fernet is None:
            raise RuntimeError(f"{ENV_VAR} is not set; cannot store secrets")
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        if self._fernet is None:
            raise RuntimeError(f"{ENV_VAR} is not set; cannot read secrets")
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken as exc:
            raise RuntimeError(
                f"Stored secret cannot be decrypted with the current {ENV_VAR} "
                "(key changed since it was saved); reset the setting and enter it again"
            ) from exc


def secret_box_from_env() -> SecretBox:
    return SecretBox(os.getenv(ENV_VAR))
