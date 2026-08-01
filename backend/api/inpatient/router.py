"""Inpatient HTTP surface — thin stubs over InpatientService.

Registers via MODULE_ROUTERS in api/routers/__init__.py; disable per
deployment with WINTEHR_DISABLED_MODULES=inpatient.
"""

from fastapi import APIRouter, Depends, Query

from .models import CensusResponse
from .service import InpatientService, get_inpatient_service

router = APIRouter(prefix="/api/inpatient", tags=["Inpatient"])


@router.get("/census", response_model=CensusResponse)
async def get_census(
    recent_limit: int = Query(25, ge=1, le=100, description="Max recent completed stays"),
    service: InpatientService = Depends(get_inpatient_service),
):
    """Census board: currently admitted patients + recent inpatient stays."""
    return await service.get_census(recent_limit=recent_limit)
