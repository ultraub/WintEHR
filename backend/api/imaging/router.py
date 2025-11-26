"""
Imaging Studies API endpoints.
Provides access to medical imaging studies from HAPI FHIR.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import httpx
import logging
import os

from database import get_db_session

router = APIRouter(prefix="/api/imaging/studies", tags=["imaging-studies"])
logger = logging.getLogger(__name__)

# Use environment variable for HAPI FHIR URL (standardized for HAPI FHIR v8.6.0 upgrade)
HAPI_FHIR_BASE = os.getenv('HAPI_FHIR_URL', 'http://hapi-fhir:8080/fhir')

class ImagingStudy(BaseModel):
    id: str
    patient_id: str
    study_date: str
    modality: str
    study_description: str
    body_part: Optional[str] = None
    accession_number: Optional[str] = None
    series_count: int = 0
    instance_count: int = 0
    status: str = "available"
    report_status: Optional[str] = None
    report_text: Optional[str] = None
    endpoint_url: Optional[str] = None  # DICOM endpoint URL
    dicom_available: bool = False

@router.get("/{patient_id}", response_model=dict)
async def get_patient_imaging_studies(
    patient_id: str,
    modality: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session)
):
    """Get imaging studies for a patient from HAPI FHIR."""
    try:
        # Search for ImagingStudy resources with endpoint includes
        search_params = {
            'patient': f'Patient/{patient_id}',
            '_sort': '-started',
            '_count': str(limit),
            '_include': 'ImagingStudy:endpoint'
        }

        if modality:
            search_params['modality'] = modality

        # Query HAPI FHIR
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{HAPI_FHIR_BASE}/ImagingStudy",
                params=search_params,
                timeout=10.0
            )

            if response.status_code != 200:
                logger.error(f"HAPI FHIR error: {response.status_code}")
                return {"data": []}

            bundle = response.json()

        # Parse bundle entries
        studies = []
        endpoints_by_id = {}

        # First pass: collect endpoints
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry.get("resource", {})
                if resource.get("resourceType") == "Endpoint":
                    endpoint_id = resource.get("id")
                    endpoints_by_id[endpoint_id] = resource.get("address")

        # Second pass: process ImagingStudy resources
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry.get("resource", {})
                if resource.get("resourceType") != "ImagingStudy":
                    continue

                # Extract study data
                study_id = resource.get("id")
                started = resource.get("started", datetime.now(timezone.utc).isoformat())

                # Extract modality
                modality_list = resource.get("modality", [])
                modality_code = modality_list[0].get("code", "Unknown") if modality_list else "Unknown"

                # Extract description from procedure code
                description = resource.get("description", "Imaging Study")
                procedure_code = resource.get("procedureCode", [])
                if procedure_code:
                    first_proc = procedure_code[0]
                    if "text" in first_proc:
                        description = first_proc["text"]

                # Extract endpoint URL
                endpoint_url = None
                dicom_available = False
                endpoint_refs = resource.get("endpoint", [])
                if endpoint_refs:
                    first_endpoint_ref = endpoint_refs[0].get("reference", "")
                    endpoint_id = first_endpoint_ref.split("/")[-1]
                    if endpoint_id in endpoints_by_id:
                        endpoint_url = endpoints_by_id[endpoint_id]
                        dicom_available = True

                # Build study object
                study = ImagingStudy(
                    id=study_id,
                    patient_id=patient_id,
                    study_date=started,
                    modality=modality_code,
                    study_description=description,
                    series_count=resource.get("numberOfSeries", 0),
                    instance_count=resource.get("numberOfInstances", 0),
                    status=resource.get("status", "available"),
                    endpoint_url=endpoint_url,
                    dicom_available=dicom_available
                )

                studies.append(study)

        return {"data": studies}

    except Exception as e:
        logger.error(f"Error fetching imaging studies: {e}", exc_info=True)
        return {"data": []}
