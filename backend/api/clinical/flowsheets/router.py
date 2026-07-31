"""Flowsheets HTTP surface — thin stubs over FlowsheetService.

Pilot module for the pluggable-module platform (docs/MODULES.md): a nursing
flowsheet (vitals grid) whose values are FHIR Observations in HAPI. This
router registers via MODULE_ROUTERS in api/routers/__init__.py and can be
disabled per deployment with WINTEHR_DISABLED_MODULES=flowsheets.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status

from .models import FlowsheetData, FlowsheetTemplate, RecordEntriesRequest, RecordEntriesResponse
from .service import FlowsheetService, get_flowsheet_service

router = APIRouter(prefix="/api/clinical/flowsheets", tags=["Flowsheets"])


@router.get("/templates", response_model=list[FlowsheetTemplate])
async def list_templates(
    service: FlowsheetService = Depends(get_flowsheet_service),
):
    """List the available flowsheet templates (rows + LOINC bindings)."""
    return service.list_templates()


@router.get("/{template_id}/data", response_model=FlowsheetData)
async def get_flowsheet_data(
    template_id: str,
    patient_id: str = Query(..., description="Bare patient FHIR id (no 'Patient/' prefix)"),
    window_start: Optional[datetime] = Query(None, description="ISO start; defaults to 24h ago"),
    window_end: Optional[datetime] = Query(None, description="ISO end; defaults to now"),
    service: FlowsheetService = Depends(get_flowsheet_service),
):
    """The flowsheet grid payload: template rows populated with Observations."""
    now = datetime.now(timezone.utc)
    window_start = window_start or (now - timedelta(hours=24))
    window_end = window_end or now
    if window_start.tzinfo is None:
        window_start = window_start.replace(tzinfo=timezone.utc)
    if window_end.tzinfo is None:
        window_end = window_end.replace(tzinfo=timezone.utc)
    if window_end <= window_start:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="window_end must be strictly after window_start",
        )
    return await service.get_flowsheet(
        patient_id=patient_id,
        template_id=template_id,
        window_start=window_start,
        window_end=window_end,
    )


@router.post(
    "/entries",
    response_model=RecordEntriesResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def record_entries(
    body: RecordEntriesRequest,
    service: FlowsheetService = Depends(get_flowsheet_service),
):
    """Chart one or more values — each becomes a FHIR Observation."""
    return await service.record_entries(request=body)
