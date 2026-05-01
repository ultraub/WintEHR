"""
Tiny client for the HAPI overlay's `/admin/cr/*` surface.

The overlay (deploy/hapi-overlay) adds a Spring controller that exposes
`POST /admin/cr/flush-caches` to clear cqf-fhir-cr's in-memory caches
(compiled CQL ELM, ValueSet expansions, model cache). The
CodeCacheResourceChangeListener that's *supposed* to fire on PUT doesn't
register in our deployment for reasons we couldn't pin down outside the
JVM, so we drive the same `.clear()` call from the backend instead.

Used after every write to a CR-relevant resource (Library, PlanDefinition,
ValueSet) so a student edit is visible to the next $apply without a HAPI
restart.

Bearer token comes from `HAPI_ADMIN_TOKEN`. If the token is unset, this
helper short-circuits — the overlay endpoint is fail-closed (503) in that
case anyway, and the worst outcome is a stale cache until the next write,
which is the pre-overlay status quo.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

HAPI_FHIR_BASE_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")


def hapi_admin_base() -> str:
    """Strip the trailing `/fhir` from `HAPI_FHIR_URL`.

    The CR cache admin endpoints are mounted on the Spring servlet root
    (`/admin/cr/*`), not under the FHIR servlet path.
    """
    base = HAPI_FHIR_BASE_URL.rstrip("/")
    if base.endswith("/fhir"):
        base = base[: -len("/fhir")]
    return base


async def flush_cr_caches(timeout_seconds: float = 5.0) -> None:
    """Best-effort flush of HAPI's CR in-memory caches.

    Failure is non-fatal — log a warning and move on. Callers should not
    treat a flush failure as a write failure; the write itself already
    succeeded by the time this is called.
    """
    admin_token = os.getenv("HAPI_ADMIN_TOKEN")
    if not admin_token:
        return
    url = f"{hapi_admin_base()}/admin/cr/flush-caches"
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            if response.status_code >= 400:
                logger.warning(
                    "CR cache flush returned %s — %s",
                    response.status_code, response.text[:200],
                )
            else:
                logger.info("CR cache flush succeeded: %s", response.text[:200])
    except httpx.RequestError as exc:
        logger.warning("CR cache flush unreachable (non-fatal): %s", exc)
