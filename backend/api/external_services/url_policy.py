"""URL policy for externally-registered service endpoints.

Registered base URLs (CDS Hooks services, webhooks, CQL libraries) are later
fetched **server-side** by the backend — an unvalidated registration is a
server-side request forgery vector (register http://169.254.169.254/ or an
internal service and let the CDS engine call it).

Policy: the EXTERNAL_SERVICES_URL_ALLOWLIST env var holds a comma-separated
list of allowed host suffixes (e.g. "cds.example.com,.trusted.org").

- When set (non-empty): a registered URL's host must match one of the
  suffixes exactly or as a dot-suffix, or registration is rejected.
- When unset: any URL is accepted — the educational default, since demo
  boxes register ad-hoc services (e.g. a locally-hosted CDS service) — but
  a warning is logged so operators of exposed hosts know to set it.
"""

import logging
import os
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_warned_once = False


def _allowlist():
    raw = os.getenv("EXTERNAL_SERVICES_URL_ALLOWLIST", "")
    return [h.strip().lower() for h in raw.split(",") if h.strip()]


def validate_external_url(url) -> None:
    """Raise ValueError if `url` violates the configured allow-list."""
    global _warned_once
    if url is None:
        return

    allowlist = _allowlist()
    if not allowlist:
        if not _warned_once:
            logger.warning(
                "EXTERNAL_SERVICES_URL_ALLOWLIST is not set — external service "
                "registration accepts any URL. Set it on internet-exposed hosts."
            )
            _warned_once = True
        return

    host = (urlparse(str(url)).hostname or "").lower()
    for allowed in allowlist:
        suffix = allowed.lstrip(".")
        if host == suffix or host.endswith("." + suffix):
            return

    raise ValueError(
        f"URL host '{host}' is not in EXTERNAL_SERVICES_URL_ALLOWLIST"
    )
