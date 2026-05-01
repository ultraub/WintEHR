"""
CQL dev-library uploader — content-hash naming to bypass HAPI's compiled-ELM cache.

Why this exists
---------------
cqf-fhir-cr-hapi caches compiled CQL→ELM in JVM memory keyed by the CQL `library`
declaration name (and the corresponding FHIR Library.name). Once a library is
compiled, subsequent updates to the same identifier — even with a `Library.version`
bump, even after `$expunge` or DELETE+PUT — do not invalidate the cache. Only
HAPI restart or a *fresh library identifier* forces a re-compile.

For draft authoring (where students iterate on CQL many times), this helper:
  1. Hashes the CQL text
  2. Rewrites the CQL `library X version 'V'` directive to `library {base}{digest} version '0.0.1'`
  3. PUTs a FHIR Library whose `id` and `name` match the rewritten CQL
  4. Returns the canonical URL for use in `PlanDefinition.library[]`

Each unique CQL produces a fresh identifier → cache miss → fresh compile.
Re-uploading the same CQL is idempotent (same hash → same id → PUT replaces in place).

For *deployed* services we use a stable canonical URL (`Library/{service_id}`
with explicit version bump) — the cache there is correct behavior under CRMI.

Cleanup
-------
A periodic task (`backend/scripts/active/expunge_dev_libraries.py`) `$expunge`s
old `DevLibrary-*` resources to keep the resource graph clean.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import re
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

HAPI_FHIR_BASE_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")
WINTEHR_FHIR_BASE = os.getenv(
    "WINTEHR_FHIR_BASE", "http://wintehr.example.org"
)
DEV_LIBRARY_PREFIX = "DevLibrary"

# Match `library NAME version 'V'` — first occurrence only. NAME is a CQL
# identifier (letters/digits/underscores, starts with letter). Version is a
# single-quoted string. Whitespace is flexible.
_LIBRARY_DIRECTIVE_RE = re.compile(
    r"^\s*library\s+([A-Za-z][A-Za-z0-9_]*)\s+version\s+'([^']+)'",
    re.MULTILINE,
)


def hash_cql(cql_text: str) -> str:
    """Return the 12-character hex digest used to suffix dev library names."""
    return hashlib.sha256(cql_text.encode("utf-8")).hexdigest()[:12]


def derive_dev_library_name(cql_text: str, base_name: str = DEV_LIBRARY_PREFIX) -> str:
    """Compute the CQL identifier and FHIR Library.id used for a draft upload.

    Output is a valid CQL identifier (alphanumeric, starts with letter) AND a
    valid FHIR id (alphanumeric + hyphens, ≤64 chars). Hex digests are
    alphanumeric so we can use them in both worlds without escaping.
    """
    digest = hash_cql(cql_text)
    return f"{base_name}{digest}"


def rewrite_cql_library_directive(cql_text: str, new_name: str, new_version: str = "0.0.1") -> str:
    """Replace the first `library X version 'V'` line with the supplied name/version.

    Raises ValueError if the CQL does not start with a recognizable library directive.
    Other content (using/include/context/define) is preserved verbatim.
    """
    if not _LIBRARY_DIRECTIVE_RE.search(cql_text):
        raise ValueError(
            "CQL is missing a `library NAME version 'V'` directive on the first line. "
            "Add one — e.g. `library MyRule version '0.1.0'` — at the top of your CQL."
        )
    return _LIBRARY_DIRECTIVE_RE.sub(
        f"library {new_name} version '{new_version}'",
        cql_text,
        count=1,
    )


def build_dev_library_resource(cql_text: str, base_name: str = DEV_LIBRARY_PREFIX) -> dict:
    """Build the FHIR Library resource that will be PUT to HAPI.

    Side effect: rewrites the user's CQL `library` directive to use the hashed name.
    Use the returned resource directly with `httpx.put`; or call upload_dev_library()
    which does both build + PUT.
    """
    unique_name = derive_dev_library_name(cql_text, base_name)
    rewritten_cql = rewrite_cql_library_directive(cql_text, unique_name)
    canonical_url = f"{WINTEHR_FHIR_BASE}/Library/{unique_name}"

    return {
        "resourceType": "Library",
        "id": unique_name,
        "url": canonical_url,
        "version": "0.0.1",
        "name": unique_name,
        "title": f"Draft CQL Library ({base_name})",
        "status": "active",
        "experimental": True,
        "type": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/library-type",
                "code": "logic-library",
            }],
        },
        "content": [{
            "contentType": "text/cql",
            "data": base64.b64encode(rewritten_cql.encode("utf-8")).decode("ascii"),
        }],
    }


async def upload_dev_library(
    cql_text: str,
    base_name: str = DEV_LIBRARY_PREFIX,
    hapi_base_url: Optional[str] = None,
    timeout_seconds: float = 30.0,
) -> Tuple[str, str]:
    """PUT a content-hashed Library to HAPI; return (library_id, canonical_url).

    The returned canonical_url is what you put in `PlanDefinition.library[]`.
    Equivalent CQL inputs always yield the same library_id (idempotent).
    """
    library = build_dev_library_resource(cql_text, base_name)
    library_id = library["id"]
    canonical_url = library["url"]
    base = hapi_base_url or HAPI_FHIR_BASE_URL
    url = f"{base}/Library/{library_id}"

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.put(
            url,
            json=library,
            headers={"Content-Type": "application/fhir+json"},
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Failed to PUT dev library %s: %s — %s",
                library_id, exc.response.status_code, exc.response.text[:300],
            )
            raise

    logger.debug("Uploaded dev library %s (%s)", library_id, canonical_url)
    return library_id, canonical_url
