"""
Analytics API Router

One endpoint: a snapshot of the patient population (who the patients are,
which conditions they have, how many medications they take). The logic is in
`service.py`; see it for how each figure is defined.

The earlier per-topic endpoints were replaced by this one: they read a single
500-row page of a larger result, reported each condition as a share of
condition records rather than of patients, and one returned hardcoded
percentages.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from services.hapi_fhir_client import FHIRClientError

from .service import PopulationAnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_population_analytics_service() -> PopulationAnalyticsService:
    return PopulationAnalyticsService()


@router.get("/population")
async def get_population_snapshot(
    service: PopulationAnalyticsService = Depends(get_population_analytics_service),
):
    """Demographics, condition prevalence and medication burden for living patients."""
    try:
        return await service.get_population_snapshot()
    except FHIRClientError as error:
        logger.error("Population snapshot failed: %s", error)
        raise HTTPException(status_code=502, detail="The FHIR server could not be reached")
