"""
ValueSet Composer — student-authored ValueSet CRUD backed by HAPI FHIR.

Students compose small ValueSets by selecting codes from `wintehr-*` catalogs
(via the existing CatalogIntegrationService autocomplete) plus optional manual
entry of novel codes. Each saved ValueSet:

1. Is converted to a FHIR `ValueSet` resource with codes grouped by system
   under `compose.include[]`
2. Is PUT to HAPI at `/ValueSet/{vs_id}` so it's resolvable by canonical URL
   from CQL via:
       valueset "MyVS": '<hapi_canonical_url>'
3. Is mirrored into `cds_visual_builder.value_sets` for fast list/search and
   to track who created what

The composer reuses `services/terminology_service.py` for `$expand` of the
saved ValueSet (handy for previewing the final code list to the student
before committing).

Endpoints
---------
- POST   /api/cds-studio/value-sets             — create
- GET    /api/cds-studio/value-sets             — list (filterable)
- GET    /api/cds-studio/value-sets/{vs_id}     — get one
- PUT    /api/cds-studio/value-sets/{vs_id}     — replace codes
- DELETE /api/cds-studio/value-sets/{vs_id}     — soft delete
- GET    /api/cds-studio/value-sets/{vs_id}/expand — proxy to HAPI $expand
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth.models import User
from api.auth.service import get_current_user_or_demo
from database import get_db_session
from services.terminology_service import TerminologyService, get_terminology_service

from .hapi_admin import flush_cr_caches
from .visual_service_config import VisualValueSet

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cds-studio/value-sets", tags=["CDS Studio — ValueSets"])

HAPI_FHIR_BASE_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")
WINTEHR_FHIR_BASE = os.getenv("WINTEHR_FHIR_BASE", "http://wintehr.example.org")

# vs_id rules: lowercase letters/digits/hyphens, 3-64 chars, must start with letter.
# Mirrors FHIR id constraints with a stricter character set so we don't accidentally
# clash with system terminology ids loaded by load_terminology.py.
_VS_ID_RE = re.compile(r"^[a-z][a-z0-9-]{2,63}$")
# FHIR Name should be a valid CQL identifier — letters/digits/underscores, starts with letter.
_FHIR_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")


# ---------------------------------------------------------------------------
# Pydantic API models
# ---------------------------------------------------------------------------


class CodeEntry(BaseModel):
    """A single code in a student-composed ValueSet."""
    system: str = Field(..., description="Code system URI (e.g. http://snomed.info/sct)")
    code: str = Field(..., description="Code within the system")
    display: Optional[str] = Field(None, description="Human-readable label")


class ValueSetCreateRequest(BaseModel):
    vs_id: Optional[str] = Field(
        None,
        description="Optional explicit ID; auto-derived from `name` if omitted",
    )
    name: str = Field(
        ..., max_length=500,
        description="FHIR Name (computer-friendly, valid CQL identifier)",
    )
    title: Optional[str] = Field(None, max_length=500, description="Human-readable title")
    description: Optional[str] = Field(None, description="What this ValueSet captures")
    codes: List[CodeEntry] = Field(
        ..., min_length=1, description="At least one code is required",
    )

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        if not _FHIR_NAME_RE.match(v):
            raise ValueError(
                "name must be a valid identifier (letters/digits/underscores, starts with letter)"
            )
        return v


class ValueSetUpdateRequest(BaseModel):
    """All fields optional — only provided ones are updated."""
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    codes: Optional[List[CodeEntry]] = Field(None, min_length=1)


class ValueSetResponse(BaseModel):
    id: int
    vs_id: str
    name: str
    title: Optional[str]
    description: Optional[str]
    hapi_canonical_url: str
    codes: List[CodeEntry]
    created_by: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers — vs_id derivation, FHIR ValueSet building, HAPI sync
# ---------------------------------------------------------------------------


def derive_vs_id(name: str, fallback: str = "value-set") -> str:
    """Turn a human name into a FHIR id — lowercase, hyphens for separators.

    `MyDiabetesVS` → `mydiabetesvs`; `Diabetes Conditions!` → `diabetes-conditions`.
    """
    out = re.sub(r"[^A-Za-z0-9]+", "-", name or "").strip("-").lower()
    out = re.sub(r"-+", "-", out)
    if not out:
        return fallback
    if not out[0].isalpha():
        out = f"vs-{out}"
    return out[:64]


def codes_to_compose_include(codes: List[CodeEntry]) -> List[Dict[str, Any]]:
    """Group codes by system into FHIR `compose.include[]` entries."""
    by_system: Dict[str, List[Dict[str, str]]] = {}
    for entry in codes:
        bucket = by_system.setdefault(entry.system, [])
        concept: Dict[str, str] = {"code": entry.code}
        if entry.display:
            concept["display"] = entry.display
        bucket.append(concept)

    return [
        {"system": system, "concept": concepts}
        for system, concepts in sorted(by_system.items())
    ]


def build_value_set_resource(
    *,
    vs_id: str,
    name: str,
    title: Optional[str],
    description: Optional[str],
    codes: List[CodeEntry],
) -> Dict[str, Any]:
    """Build the FHIR ValueSet JSON ready to PUT to HAPI."""
    canonical_url = f"{WINTEHR_FHIR_BASE}/ValueSet/{vs_id}"
    resource: Dict[str, Any] = {
        "resourceType": "ValueSet",
        "id": vs_id,
        "url": canonical_url,
        "version": "1",
        "name": name,
        "status": "active",
        "experimental": True,
        "compose": {
            "include": codes_to_compose_include(codes),
        },
    }
    if title:
        resource["title"] = title
    if description:
        resource["description"] = description
    return resource


async def put_value_set_to_hapi(
    resource: Dict[str, Any],
    hapi_base_url: Optional[str] = None,
    timeout_seconds: float = 30.0,
) -> str:
    """PUT the ValueSet to HAPI; return the canonical URL on success."""
    base = hapi_base_url or HAPI_FHIR_BASE_URL
    vs_id = resource["id"]
    url = f"{base}/ValueSet/{vs_id}"

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.put(
            url,
            json=resource,
            headers={"Content-Type": "application/fhir+json"},
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Failed to PUT ValueSet/%s: %s — %s",
                vs_id, exc.response.status_code, exc.response.text[:300],
            )
            raise

    # Bust HAPI's CR caches so the new compose is visible to the next $apply.
    await flush_cr_caches()

    return resource["url"]


async def delete_value_set_from_hapi(
    vs_id: str,
    hapi_base_url: Optional[str] = None,
    timeout_seconds: float = 30.0,
) -> None:
    """DELETE the ValueSet from HAPI. 404 is treated as success (already gone)."""
    base = hapi_base_url or HAPI_FHIR_BASE_URL
    url = f"{base}/ValueSet/{vs_id}"

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.delete(url)
        if response.status_code in (200, 204, 404):
            await flush_cr_caches()
            return
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "DELETE ValueSet/%s returned %s — %s",
                vs_id, exc.response.status_code, exc.response.text[:200],
            )
            raise
    await flush_cr_caches()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=ValueSetResponse, status_code=201)
async def create_value_set(
    body: ValueSetCreateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
):
    """Compose a new ValueSet, sync to HAPI, persist metadata."""
    vs_id = (body.vs_id or derive_vs_id(body.name)).strip()
    if not _VS_ID_RE.match(vs_id):
        raise HTTPException(
            status_code=400,
            detail=(
                "vs_id must be lowercase, 3-64 chars, only letters/digits/hyphens, "
                "starting with a letter."
            ),
        )

    # Reject collisions with system-terminology IDs to avoid surprising students.
    if vs_id.startswith("wintehr-"):
        raise HTTPException(
            status_code=400,
            detail="vs_id cannot start with 'wintehr-' (reserved for system terminology)",
        )

    # Conflict check — caller must DELETE before re-creating.
    existing = await db.execute(
        select(VisualValueSet).where(VisualValueSet.vs_id == vs_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"ValueSet '{vs_id}' already exists")

    resource = build_value_set_resource(
        vs_id=vs_id,
        name=body.name,
        title=body.title,
        description=body.description,
        codes=body.codes,
    )

    try:
        canonical_url = await put_value_set_to_hapi(resource)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"HAPI rejected ValueSet: {exc.response.status_code}",
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"HAPI unreachable: {exc}")

    record = VisualValueSet(
        vs_id=vs_id,
        name=body.name,
        title=body.title,
        description=body.description,
        hapi_canonical_url=canonical_url,
        codes=[c.model_dump() for c in body.codes],
        created_by=getattr(current_user, "id", None),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    logger.info("Created ValueSet vs_id=%s codes=%d by=%s", vs_id, len(body.codes), record.created_by)
    return record


@router.get("", response_model=List[ValueSetResponse])
async def list_value_sets(
    search: Optional[str] = Query(None, description="Search in name, title, vs_id"),
    created_by: Optional[str] = Query(None, description="Filter by author"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
):
    query = select(VisualValueSet).where(VisualValueSet.deleted_at.is_(None))
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                VisualValueSet.name.ilike(like),
                VisualValueSet.title.ilike(like),
                VisualValueSet.vs_id.ilike(like),
            )
        )
    if created_by:
        query = query.where(VisualValueSet.created_by == created_by)
    query = query.order_by(VisualValueSet.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{vs_id}", response_model=ValueSetResponse)
async def get_value_set(
    vs_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
):
    record = await _get_active(db, vs_id)
    return record


@router.put("/{vs_id}", response_model=ValueSetResponse)
async def update_value_set(
    vs_id: str,
    body: ValueSetUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
):
    """Update title/description/codes. Re-PUTs the ValueSet to HAPI if codes changed."""
    record = await _get_active(db, vs_id)

    if body.title is not None:
        record.title = body.title
    if body.description is not None:
        record.description = body.description
    codes_changed = body.codes is not None
    if codes_changed:
        record.codes = [c.model_dump() for c in body.codes]

    if codes_changed or body.title is not None or body.description is not None:
        # Re-build and re-PUT so HAPI is in sync. HAPI's update mode handles
        # the actual concept set; we always send the full resource.
        codes_for_resource = [CodeEntry(**c) for c in record.codes or []]
        resource = build_value_set_resource(
            vs_id=record.vs_id,
            name=record.name,
            title=record.title,
            description=record.description,
            codes=codes_for_resource,
        )
        try:
            await put_value_set_to_hapi(resource)
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"HAPI rejected updated ValueSet: {exc.response.status_code}",
            )

    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{vs_id}", status_code=204)
async def delete_value_set(
    vs_id: str,
    purge: bool = Query(
        False,
        description="If true, also DELETE the ValueSet from HAPI (default: keep it for any rules still referencing it)",
    ),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
):
    """Soft-delete the ValueSet metadata; optionally remove from HAPI too.

    Default is metadata-only soft delete: the FHIR ValueSet stays in HAPI in
    case any deployed CQL service still references it. Pass `purge=true` to
    also DELETE it from HAPI (use this for cleanup of accidental drafts).
    """
    record = await _get_active(db, vs_id)

    record.deleted_at = datetime.utcnow()
    await db.commit()

    if purge:
        try:
            await delete_value_set_from_hapi(record.vs_id)
        except Exception as exc:  # noqa: BLE001 — best-effort
            logger.warning("Failed to purge ValueSet/%s from HAPI: %s", record.vs_id, exc)


@router.get("/{vs_id}/expand", response_model=List[CodeEntry])
async def expand_value_set(
    vs_id: str,
    filter_text: Optional[str] = Query(None, description="Free-text filter (passed to HAPI)"),
    count: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_or_demo),
    terminology: TerminologyService = Depends(get_terminology_service),
):
    """Convenience: expand the ValueSet via HAPI's $expand for preview UI."""
    # Verify the record exists locally; return 404 if not.
    await _get_active(db, vs_id)
    concepts = await terminology.expand_valueset(vs_id, filter_text=filter_text, count=count)
    return [CodeEntry(**c) for c in concepts]


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


async def _get_active(db: AsyncSession, vs_id: str) -> VisualValueSet:
    """Load a non-deleted ValueSet by vs_id, or 404."""
    result = await db.execute(
        select(VisualValueSet).where(
            VisualValueSet.vs_id == vs_id,
            VisualValueSet.deleted_at.is_(None),
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail=f"ValueSet '{vs_id}' not found")
    return record
