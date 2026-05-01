"""
CQL Artifact Builder — turns a stored CQL service config into HAPI FHIR resources.

Inputs (from the Studio save flow):
- service_id, name, description, hook_type, card_config, prefetch_config
- cql_source: the student's CQL text

Outputs (posted to HAPI, returned to caller):
- Library resource holding the CQL (uploaded via cql_dev_helper for draft mode →
  content-hashed identifier defeats HAPI's compiled-ELM cache)
- PlanDefinition resource that wraps the Library:
  * trigger = named-event matching the hook_type
  * action.condition = applicability check referencing the CQL `Applicability` define
  * action.dynamicValue entries bind CQL string defines to action.title / action.description
    so cards are personalized at $apply time
  * action.priority drives the CDS Card indicator (info | warning | critical)
- Returns the canonical URLs of both resources for storage on service_configs.

Conventions students must follow in their CQL
---------------------------------------------
- Required: `define Applicability: <boolean expression>` — controls whether the
  card materializes for a given patient.
- Optional: `define CardSummary: <string>` — populates the card summary at runtime.
- Optional: `define CardDetail: <string>` — populates the card detail at runtime.

If `CardSummary` / `CardDetail` aren't present, action.title / action.description
fall back to the static values the student supplied in card_config.
"""

from __future__ import annotations

import base64
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx

from api.cds_hooks.cql_dev_helper import (
    rewrite_cql_library_directive,
    upload_dev_library,
)

logger = logging.getLogger(__name__)

HAPI_FHIR_BASE_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")
WINTEHR_FHIR_BASE = os.getenv("WINTEHR_FHIR_BASE", "http://wintehr.example.org")

# Names students reference from CQL — kept as constants so the convention is
# discoverable from one place and easy to reuse in docs/templates.
APPLICABILITY_DEFINE = "Applicability"
CARD_SUMMARY_DEFINE = "CardSummary"
CARD_DETAIL_DEFINE = "CardDetail"

# Indicator → FHIR action.priority mapping (inverse of cql_bridge.PRIORITY_TO_INDICATOR).
INDICATOR_TO_PRIORITY: Dict[str, str] = {
    "info": "routine",
    "warning": "urgent",
    "critical": "stat",
}

# WintEHR-internal extension URLs the dispatcher reads on every $apply lookup.
HOOK_TYPE_EXT = "http://wintehr.local/fhir/StructureDefinition/hook-type"
HOOK_SERVICE_ID_EXT = "http://wintehr.local/fhir/StructureDefinition/hook-service-id"
SERVICE_ORIGIN_EXT = "http://wintehr.local/fhir/StructureDefinition/service-origin"
VISUAL_SERVICE_ID_EXT = "http://wintehr.local/fhir/StructureDefinition/visual-service-id"

# `define X:` — captures any CQL define. Used to detect optional CardSummary / CardDetail.
_DEFINE_NAME_RE = re.compile(r"^\s*define\s+([A-Za-z][A-Za-z0-9_]*)\s*:", re.MULTILINE)


@dataclass
class MaterializedArtifacts:
    library_canonical_url: str
    plan_definition_canonical_url: str
    plan_definition_id: str
    detected_defines: List[str]


def detect_cql_defines(cql_source: str) -> List[str]:
    """Return the list of `define` identifiers declared in the CQL text."""
    return _DEFINE_NAME_RE.findall(cql_source or "")


def has_define(cql_source: str, name: str) -> bool:
    """Return True if `define <name>:` appears in the CQL source."""
    return name in detect_cql_defines(cql_source)


def build_plan_definition(
    *,
    service_id: str,
    name: str,
    description: Optional[str],
    hook_type: str,
    library_canonical_url: str,
    card_config: Dict[str, Any],
    prefetch_config: Optional[Dict[str, str]],
    detected_defines: List[str],
    visual_service_db_id: Optional[int],
) -> Dict[str, Any]:
    """Build the PlanDefinition JSON for a CQL-backed service.

    The result is suitable for `PUT PlanDefinition/{service_id}`.
    """
    indicator = (card_config or {}).get("indicator", "info")
    priority = INDICATOR_TO_PRIORITY.get(indicator, "routine")

    static_summary = (card_config or {}).get("summary") or "CDS recommendation"
    static_detail = (card_config or {}).get("detail")

    # Only include dynamicValue entries for defines the student actually wrote.
    # cqf-fhir warns when an unresolved expression reference is hit, but the
    # static fallback still applies — better to keep the response clean.
    dynamic_value: List[Dict[str, Any]] = []
    if CARD_SUMMARY_DEFINE in detected_defines:
        dynamic_value.append({
            "path": "title",
            "expression": {
                "language": "text/cql-identifier",
                "expression": CARD_SUMMARY_DEFINE,
            },
        })
    if CARD_DETAIL_DEFINE in detected_defines:
        dynamic_value.append({
            "path": "description",
            "expression": {
                "language": "text/cql-identifier",
                "expression": CARD_DETAIL_DEFINE,
            },
        })

    action: Dict[str, Any] = {
        # Static fallbacks. dynamicValue (if any) overrides at $apply time.
        "title": static_summary,
        "trigger": [{"type": "named-event", "name": hook_type}],
        "condition": [{
            "kind": "applicability",
            "expression": {
                "language": "text/cql-identifier",
                "expression": APPLICABILITY_DEFINE,
            },
        }],
        "priority": priority,
    }
    if static_detail:
        action["description"] = static_detail
    if dynamic_value:
        action["dynamicValue"] = dynamic_value

    plan_definition: Dict[str, Any] = {
        "resourceType": "PlanDefinition",
        "id": service_id,
        "url": f"{WINTEHR_FHIR_BASE}/PlanDefinition/{service_id}",
        "version": "0.0.1",
        "name": _to_pascal(service_id),
        "title": name,
        "status": "active",
        "experimental": True,
        "library": [library_canonical_url],
        "action": [action],
        "extension": [
            {"url": HOOK_TYPE_EXT, "valueString": hook_type},
            {"url": HOOK_SERVICE_ID_EXT, "valueString": service_id},
            {"url": SERVICE_ORIGIN_EXT, "valueString": "visual-builder"},
        ],
    }
    if description:
        plan_definition["description"] = description
    if visual_service_db_id is not None:
        plan_definition["extension"].append({
            "url": VISUAL_SERVICE_ID_EXT,
            "valueString": str(visual_service_db_id),
        })

    # Surface prefetch templates so the discovery endpoint (and the future
    # bridge that pre-resolves them) can find them. CDS Hooks-style prefetch
    # lives on the PlanDefinition as a parent extension whose children are
    # one grouping per template (each grouping has a `key` extension and a
    # `query` extension). FHIR forbids mixing valueX + nested extension on
    # the same Extension element.
    if prefetch_config:
        prefetch_extension = {
            "url": "http://wintehr.local/fhir/StructureDefinition/prefetch-templates",
            "extension": [
                {
                    "url": "template",
                    "extension": [
                        {"url": "key", "valueString": key},
                        {"url": "query", "valueString": query},
                    ],
                }
                for key, query in prefetch_config.items()
            ],
        }
        plan_definition["extension"].append(prefetch_extension)

    return plan_definition


def _versioned_library_name(base_name: str, version: str) -> str:
    """Compose a deploy-time Library name that incorporates the version.

    Produces an identifier valid as both a CQL identifier (letters/digits,
    starts with letter) AND a FHIR id (letters/digits/hyphens/dots — HAPI
    rejects underscores with HAPI-0521). The intersection is just
    alphanumeric, so we strip every separator from the version string and
    prepend ``V``: ``DiabetesCare`` + ``V`` + ``100`` → ``DiabetesCareV100``.

    Why bake version into the name: HAPI's cqf-fhir-cr compile cache is
    keyed by Library name, NOT by name+version. Bumping ``Library.version``
    alone does NOT invalidate the cached ELM (confirmed empirically in
    Phase 5's cache spike). The pragmatic workaround is to make each deploy
    a fresh Library identifier — old versions stay compiled, new ones get
    fresh compilation, and a cleanup script can $expunge stale ones.

    Caveat: collapsing dots can theoretically collide (e.g. ``1.10.0`` and
    ``1.1.0`` both become ``1100`` → ``110``). In practice we generate
    versions as ``1.0.{integer}`` from the auto-incremented service config
    column, so each deploy bump produces a fresh suffix.
    """
    safe_version = re.sub(r"[^A-Za-z0-9]+", "", version or "0")
    if not safe_version:
        safe_version = "0"
    return f"{base_name}V{safe_version}"


async def upload_stable_library(
    cql_source: str,
    base_name: str,
    library_version: str = "1.0.0",
    hapi_base_url: Optional[str] = None,
    timeout_seconds: float = 30.0,
) -> Tuple[str, str]:
    """Upload a Library at a deploy-time predictable URL.

    The actual Library name is ``{base_name}_v_{safe_version}`` — see
    ``_versioned_library_name`` for the reasoning. Pass ``base_name`` as the
    PascalCase service identifier (e.g. ``DiabetesCare``); the version is
    appended automatically.

    Unlike the dev helper (content-hashed for fast iteration), this writes a
    predictable, version-tagged URL that students can document in their
    rule's PlanDefinition and that the deploy flow can reference reliably.
    Updating an active rule means deploying a new version, which produces a
    new Library URL — old ones remain in HAPI for any clients still pinning
    them, and the periodic cleanup script removes truly stale ones.

    Returns ``(library_name, canonical_url)``.
    """
    library_name = _versioned_library_name(base_name, library_version)
    rewritten_cql = rewrite_cql_library_directive(
        cql_source, library_name, new_version=library_version,
    )
    canonical_url = f"{WINTEHR_FHIR_BASE}/Library/{library_name}"
    library = {
        "resourceType": "Library",
        "id": library_name,
        "url": canonical_url,
        "version": library_version,
        "name": library_name,
        "title": f"CDS Library: {base_name} v{library_version}",
        "status": "active",
        "experimental": False,
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

    base = hapi_base_url or HAPI_FHIR_BASE_URL
    url = f"{base}/Library/{library_name}"
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
                "Failed to PUT stable Library/%s: %s — %s",
                library_name, exc.response.status_code, exc.response.text[:300],
            )
            raise

    return library_name, canonical_url


async def materialize_cql_service(
    *,
    service_id: str,
    name: str,
    description: Optional[str],
    hook_type: str,
    cql_source: str,
    card_config: Dict[str, Any],
    prefetch_config: Optional[Dict[str, str]] = None,
    visual_service_db_id: Optional[int] = None,
    hapi_base_url: Optional[str] = None,
    stable: bool = False,
    library_version: Optional[str] = None,
) -> MaterializedArtifacts:
    """Upload Library + PUT PlanDefinition for a CQL-based service.

    Two modes:
    - ``stable=False`` (default, draft-mode): uses the dev helper to hash CQL
      content into the Library id. Bypasses HAPI's compiled-ELM cache so
      iterative authoring works. The PlanDefinition is at the stable
      service_id but its `library` reference points at the hashed URL.
    - ``stable=True`` (deploy-mode): writes to `Library/{PascalCase(service_id)}`
      with an explicit ``library_version`` (defaults to "1.0.0"). The
      PlanDefinition's library reference moves to this canonical URL.

    Idempotent: re-running with the same inputs PUTs the same PlanDefinition
    id (always the service_id).
    """
    if not cql_source or not cql_source.strip():
        raise ValueError("cql_source is required for CQL services")

    detected = detect_cql_defines(cql_source)
    if APPLICABILITY_DEFINE not in detected:
        raise ValueError(
            f"CQL is missing a `define {APPLICABILITY_DEFINE}:` — every CQL "
            f"service needs an Applicability gate that returns Boolean."
        )

    # 1. Upload the Library — draft uses the content-hashed dev helper,
    #    deploy uses the stable canonical URL with a bumped version.
    if stable:
        base_name = _to_pascal(service_id)
        library_id, library_canonical_url = await upload_stable_library(
            cql_source,
            base_name,
            library_version=library_version or "1.0.0",
            hapi_base_url=hapi_base_url,
        )
    else:
        library_id, library_canonical_url = await upload_dev_library(
            cql_source,
            base_name=f"Draft{_to_pascal(service_id)}",
            hapi_base_url=hapi_base_url,
        )
    logger.info(
        "Materialized CQL Library (stable=%s) for service=%s id=%s url=%s",
        stable, service_id, library_id, library_canonical_url,
    )

    # 2. Build the PlanDefinition wrapper.
    plan_definition = build_plan_definition(
        service_id=service_id,
        name=name,
        description=description,
        hook_type=hook_type,
        library_canonical_url=library_canonical_url,
        card_config=card_config or {},
        prefetch_config=prefetch_config,
        detected_defines=detected,
        visual_service_db_id=visual_service_db_id,
    )

    # 3. PUT to HAPI.
    base = hapi_base_url or HAPI_FHIR_BASE_URL
    url = f"{base}/PlanDefinition/{service_id}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.put(
            url,
            json=plan_definition,
            headers={"Content-Type": "application/fhir+json"},
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Failed to PUT PlanDefinition/%s: %s — %s",
                service_id, exc.response.status_code, exc.response.text[:300],
            )
            raise

    plan_definition_canonical_url = plan_definition["url"]
    logger.info(
        "Materialized PlanDefinition for service=%s url=%s",
        service_id, plan_definition_canonical_url,
    )

    return MaterializedArtifacts(
        library_canonical_url=library_canonical_url,
        plan_definition_canonical_url=plan_definition_canonical_url,
        plan_definition_id=service_id,
        detected_defines=detected,
    )


def _to_pascal(s: str) -> str:
    """Turn `colonoscopy-screening` → `ColonoscopyScreening`. Used for FHIR `name`."""
    parts = re.split(r"[^A-Za-z0-9]+", s or "")
    return "".join(p[:1].upper() + p[1:] for p in parts if p) or "Service"
