"""
Clinical Results API Router - FHIR-based Implementation
Handles lab results, critical value detection, and result acknowledgment using HAPI FHIR
"""

from fastapi import APIRouter, HTTPException, status as http_status, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from services.hapi_fhir_client import HAPIFHIRClient
from pydantic import BaseModel
from api.clinical.notifications_helper import CRITICAL_VALUES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/clinical/results", tags=["clinical-results"])


class ResultAcknowledgment(BaseModel):
    """Request model for result acknowledgment"""
    observation_id: str
    acknowledged_by: str
    notes: Optional[str] = None


class CriticalValueAlert(BaseModel):
    """Model for critical value alerts"""
    observation_id: str
    patient_id: str
    test_name: str
    loinc_code: str
    value: float
    unit: str
    critical_type: str  # 'high' or 'low'
    threshold: float
    message: str
    detected_at: datetime


class ResultSummary(BaseModel):
    """Summary of a lab result"""
    observation_id: str
    patient_id: str
    test_name: str
    loinc_code: Optional[str]
    value: Optional[float]
    value_string: Optional[str]
    unit: Optional[str]
    reference_range: Optional[str]
    interpretation: Optional[str]
    status: str
    effective_date: Optional[datetime]
    is_critical: bool
    is_acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]


@router.get("/patient/{patient_id}", response_model=List[ResultSummary])
async def get_patient_results(
    patient_id: str,
    category: Optional[str] = Query(None, description="Filter by category (laboratory, vital-signs, etc.)"),
    code: Optional[str] = Query(None, description="Filter by LOINC code"),
    status: Optional[str] = Query(None, description="Filter by status"),
    _count: int = Query(100, description="Maximum results to return"),
    include_critical_check: bool = Query(True, description="Include critical value analysis")
):
    """
    Get patient lab results with critical value detection.
    
    FHIR Implementation:
    - Queries Observation resources from HAPI FHIR
    - Checks each result against critical value thresholds
    - Returns acknowledgment status resolved from Provenance resources

    Educational notes:
    - FHIR Observation is the standard resource for lab results
    - Critical values are determined by comparing against defined thresholds
    - Acknowledgment is tracked as Provenance targeting the Observation
    """
    try:
        hapi_client = HAPIFHIRClient()
        
        # Build search parameters
        search_params = {
            "patient": f"Patient/{patient_id}" if not patient_id.startswith("Patient/") else patient_id,
            "_sort": "-date",
            "_count": _count
        }
        
        if category:
            search_params["category"] = category
        if code:
            search_params["code"] = code
        if status:
            search_params["status"] = status
        
        # Query HAPI FHIR for observations
        bundle = await hapi_client.search("Observation", search_params)

        observations = [entry.get("resource", {}) for entry in bundle.get("entry", [])]
        acks = await _fetch_acknowledgments(
            hapi_client, [o.get("id") for o in observations if o.get("id")]
        )

        return [
            _build_result_summary(o, include_critical_check, ack=acks.get(o.get("id")))
            for o in observations
        ]
        
    except Exception as e:
        logger.error(f"Failed to get patient results: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get patient results: {str(e)}"
        )


@router.get("/critical-values", response_model=List[CriticalValueAlert])
async def get_critical_values(
    patient_id: Optional[str] = Query(None, description="Filter by patient"),
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledgment status"),
    hours: int = Query(24, description="Look back period in hours")
):
    """
    Get critical value alerts across patients or for a specific patient.
    
    FHIR Implementation:
    - Searches recent Observations
    - Filters for values exceeding critical thresholds
    - Returns structured alerts for clinical review
    
    Educational notes:
    - Critical values require immediate clinical attention
    - This endpoint enables real-time monitoring dashboards
    """
    try:
        hapi_client = HAPIFHIRClient()
        
        # Calculate date filter
        from datetime import timedelta
        cutoff_date = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        # Build search parameters
        search_params = {
            "date": f"ge{cutoff_date.strftime('%Y-%m-%dT%H:%M:%S')}",
            "status": "final",
            "_sort": "-date",
            "_count": 500
        }
        
        if patient_id:
            search_params["patient"] = f"Patient/{patient_id}" if not patient_id.startswith("Patient/") else patient_id
        
        # Query HAPI FHIR for observations
        bundle = await hapi_client.search("Observation", search_params)
        
        # Collect the criticals first, then resolve acknowledgment status for
        # just those in one batched Provenance lookup.
        flagged = []
        for entry in bundle.get("entry", []):
            observation = entry.get("resource", {})
            alert = _check_critical_value(observation)
            if alert:
                flagged.append((observation, alert))

        critical_alerts = [alert for _, alert in flagged]
        if acknowledged is not None and flagged:
            acks = await _fetch_acknowledgments(
                hapi_client, [o.get("id") for o, _ in flagged if o.get("id")]
            )
            critical_alerts = [
                alert for o, alert in flagged
                if (o.get("id") in acks) == acknowledged
            ]

        return critical_alerts
        
    except Exception as e:
        logger.error(f"Failed to get critical values: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get critical values: {str(e)}"
        )


@router.post("/acknowledge", response_model=Dict[str, Any])
async def acknowledge_result(acknowledgment: ResultAcknowledgment):
    """
    Acknowledge a lab result (especially critical values).

    FHIR Implementation:
    - Creates a Provenance resource targeting the Observation — the same
      store the frontend writes (resultsManagementService.acknowledgeResult),
      so an acknowledgment via either path is visible to both.
    - The Observation itself is never mutated.

    Educational notes:
    - Result acknowledgment is a key clinical workflow
    - Provenance is FHIR's standard resource for "who did what, when" —
      a defensible audit trail without inventing custom workflow extensions
    """
    try:
        hapi_client = HAPIFHIRClient()

        # Verify the observation exists before acknowledging it
        observation = await hapi_client.read("Observation", acknowledgment.observation_id)
        if not observation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Observation not found"
            )

        current_time = datetime.now(timezone.utc)

        # Shape mirrors the frontend's Provenance write exactly
        provenance = {
            "resourceType": "Provenance",
            "target": [{"reference": f"Observation/{acknowledgment.observation_id}"}],
            "recorded": current_time.isoformat(),
            "agent": [{
                "who": {"reference": f"Practitioner/{acknowledgment.acknowledged_by}"}
            }],
            "activity": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-DocumentCompletion",
                    "code": "LA",
                    "display": "Legally authenticated"
                }]
            },
            "signature": [{
                "type": [{
                    "system": "urn:iso-astm:E1762-95:2013",
                    "code": "1.2.840.10065.1.12.1.5",
                    "display": "Verification Signature"
                }],
                "when": current_time.isoformat(),
                "who": {"reference": f"Practitioner/{acknowledgment.acknowledged_by}"}
            }]
        }
        if acknowledgment.notes:
            provenance["reason"] = [{"text": acknowledgment.notes}]

        await hapi_client.create("Provenance", provenance)

        logger.info(f"Acknowledged Observation/{acknowledgment.observation_id} by Practitioner/{acknowledgment.acknowledged_by} (Provenance)")

        return {
            "message": "Result acknowledged successfully",
            "observation_id": acknowledgment.observation_id,
            "acknowledged_by": acknowledgment.acknowledged_by,
            "acknowledged_at": current_time.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge result: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge result: {str(e)}"
        )


@router.get("/{observation_id}", response_model=ResultSummary)
async def get_result_detail(observation_id: str):
    """
    Get detailed information about a specific lab result.
    
    FHIR Implementation:
    - Reads single Observation resource
    - Includes critical value analysis
    - Returns acknowledgment status
    """
    try:
        hapi_client = HAPIFHIRClient()
        
        observation = await hapi_client.read("Observation", observation_id)
        if not observation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Observation not found"
            )

        acks = await _fetch_acknowledgments(hapi_client, [observation_id])
        return _build_result_summary(
            observation, include_critical_check=True, ack=acks.get(observation_id)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get result detail: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get result detail: {str(e)}"
        )


@router.get("/trends/{patient_id}/{loinc_code}")
async def get_result_trends(
    patient_id: str,
    loinc_code: str,
    _count: int = Query(20, description="Number of results to include in trend")
):
    """
    Get trending data for a specific lab test.
    
    FHIR Implementation:
    - Queries historical Observations by LOINC code
    - Returns time-series data for charting
    - Includes reference ranges for context
    
    Educational notes:
    - Trending is essential for clinical decision making
    - LOINC codes provide standardized test identification
    """
    try:
        hapi_client = HAPIFHIRClient()
        
        # Search for observations with this LOINC code
        search_params = {
            "patient": f"Patient/{patient_id}" if not patient_id.startswith("Patient/") else patient_id,
            "code": f"http://loinc.org|{loinc_code}",
            "_sort": "-date",
            "_count": _count
        }
        
        bundle = await hapi_client.search("Observation", search_params)
        
        trend_data = []
        reference_range = None
        test_name = None
        unit = None
        
        for entry in bundle.get("entry", []):
            observation = entry.get("resource", {})
            
            # Extract test name from first result
            if not test_name:
                test_name = observation.get("code", {}).get("text") or \
                           observation.get("code", {}).get("coding", [{}])[0].get("display", "Unknown Test")
            
            # Extract reference range from first result that has it
            if not reference_range and observation.get("referenceRange"):
                ref_range = observation["referenceRange"][0]
                low = ref_range.get("low", {}).get("value")
                high = ref_range.get("high", {}).get("value")
                if low is not None and high is not None:
                    reference_range = {"low": low, "high": high}
            
            # Extract value
            value_quantity = observation.get("valueQuantity", {})
            value = value_quantity.get("value")
            
            if not unit:
                unit = value_quantity.get("unit", "")
            
            # Extract date
            effective_date = observation.get("effectiveDateTime")
            
            if value is not None and effective_date:
                trend_data.append({
                    "date": effective_date,
                    "value": value,
                    "observation_id": observation.get("id")
                })
        
        # Reverse to get chronological order
        trend_data.reverse()
        
        # Check if this test has critical values defined
        critical_thresholds = None
        if loinc_code in CRITICAL_VALUES:
            config = CRITICAL_VALUES[loinc_code]
            critical_thresholds = {
                "low": config.get("low"),
                "high": config.get("high")
            }
        
        return {
            "patient_id": patient_id,
            "loinc_code": loinc_code,
            "test_name": test_name,
            "unit": unit,
            "reference_range": reference_range,
            "critical_thresholds": critical_thresholds,
            "data_points": trend_data,
            "count": len(trend_data)
        }
        
    except Exception as e:
        logger.error(f"Failed to get result trends: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get result trends: {str(e)}"
        )


# =============================================================================
# Helper Functions
# =============================================================================

async def _fetch_acknowledgments(
    hapi_client: HAPIFHIRClient, observation_ids: List[str]
) -> Dict[str, Dict[str, Any]]:
    """Resolve acknowledgment status for a set of Observations from Provenance.

    Acknowledgments are Provenance resources targeting the Observation (the
    same store the frontend writes). Searches are chunked so a large result
    list doesn't overflow the query string; the most recently recorded
    Provenance wins when duplicates exist.
    Returns {observation_id: {"by": practitioner_id, "at": datetime|None}}.
    """
    acks: Dict[str, Dict[str, Any]] = {}
    CHUNK = 40
    ids = [oid for oid in observation_ids if oid]
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i:i + CHUNK]
        try:
            bundle = await hapi_client.search("Provenance", {
                "target": ",".join(f"Observation/{oid}" for oid in chunk),
                "_count": len(chunk) * 5,
            })
        except Exception as e:
            logger.warning(f"Provenance acknowledgment lookup failed: {e}")
            continue
        for entry in bundle.get("entry", []):
            prov = entry.get("resource", {})
            recorded = prov.get("recorded", "")
            who = ""
            if prov.get("agent"):
                who = prov["agent"][0].get("who", {}).get("reference", "")
            practitioner = who.replace("Practitioner/", "") if who.startswith("Practitioner/") else who
            for target in prov.get("target", []):
                ref = target.get("reference", "")
                if not ref.startswith("Observation/"):
                    continue
                oid = ref.replace("Observation/", "")
                existing = acks.get(oid)
                if existing and existing.get("recorded", "") >= recorded:
                    continue
                ack_at = None
                try:
                    ack_at = datetime.fromisoformat(recorded.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
                acks[oid] = {"by": practitioner, "at": ack_at, "recorded": recorded}
    return acks


def _build_result_summary(
    observation: Dict[str, Any],
    include_critical_check: bool = True,
    ack: Optional[Dict[str, Any]] = None,
) -> ResultSummary:
    """Build a result summary from a FHIR Observation resource.

    `ack` is the pre-resolved Provenance acknowledgment for this observation
    (see _fetch_acknowledgments) — acknowledgment no longer lives on the
    Observation itself.
    """
    
    # Extract patient ID
    subject_ref = observation.get("subject", {}).get("reference", "")
    patient_id = subject_ref.replace("Patient/", "") if subject_ref.startswith("Patient/") else ""
    
    # Extract test name and LOINC code
    code_info = observation.get("code", {})
    test_name = code_info.get("text") or code_info.get("coding", [{}])[0].get("display", "Unknown Test")
    
    loinc_code = None
    for coding in code_info.get("coding", []):
        if coding.get("system") == "http://loinc.org":
            loinc_code = coding.get("code")
            break
    
    # Extract value
    value = None
    value_string = None
    unit = None
    
    if observation.get("valueQuantity"):
        value_quantity = observation["valueQuantity"]
        value = value_quantity.get("value")
        unit = value_quantity.get("unit", "")
        value_string = f"{value} {unit}" if value is not None else None
    elif observation.get("valueString"):
        value_string = observation["valueString"]
    elif observation.get("valueCodeableConcept"):
        value_string = observation["valueCodeableConcept"].get("text") or \
                      observation["valueCodeableConcept"].get("coding", [{}])[0].get("display")
    
    # Extract reference range
    reference_range = None
    if observation.get("referenceRange"):
        ref_range = observation["referenceRange"][0]
        low = ref_range.get("low", {}).get("value")
        high = ref_range.get("high", {}).get("value")
        low_unit = ref_range.get("low", {}).get("unit", "")
        if low is not None and high is not None:
            reference_range = f"{low} - {high} {low_unit}".strip()
        elif ref_range.get("text"):
            reference_range = ref_range["text"]
    
    # Extract interpretation
    interpretation = None
    if observation.get("interpretation"):
        interp = observation["interpretation"][0]
        interpretation = interp.get("text") or interp.get("coding", [{}])[0].get("display")
    
    # Extract effective date
    effective_date = None
    if observation.get("effectiveDateTime"):
        try:
            effective_date = datetime.fromisoformat(observation["effectiveDateTime"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass

    # Check for critical value
    is_critical = False
    if include_critical_check and value is not None and loinc_code:
        alert = _check_critical_value(observation)
        is_critical = alert is not None
    
    # Acknowledgment status comes from Provenance (pre-resolved by caller)
    is_acknowledged = ack is not None
    acknowledged_by = ack.get("by") if ack else None
    acknowledged_at = ack.get("at") if ack else None


    return ResultSummary(
        observation_id=observation.get("id", ""),
        patient_id=patient_id,
        test_name=test_name,
        loinc_code=loinc_code,
        value=value,
        value_string=value_string,
        unit=unit,
        reference_range=reference_range,
        interpretation=interpretation,
        status=observation.get("status", "unknown"),
        effective_date=effective_date,
        is_critical=is_critical,
        is_acknowledged=is_acknowledged,
        acknowledged_by=acknowledged_by,
        acknowledged_at=acknowledged_at
    )


def _check_critical_value(observation: Dict[str, Any]) -> Optional[CriticalValueAlert]:
    """Check if an observation contains a critical value."""
    
    # Extract LOINC code
    loinc_code = None
    for coding in observation.get("code", {}).get("coding", []):
        if coding.get("system") == "http://loinc.org":
            loinc_code = coding.get("code")
            break
    
    if not loinc_code or loinc_code not in CRITICAL_VALUES:
        return None
    
    # Get value
    value_quantity = observation.get("valueQuantity", {})
    value = value_quantity.get("value")
    unit = value_quantity.get("unit", "")
    
    if value is None:
        return None
    
    # Check against critical thresholds
    config = CRITICAL_VALUES[loinc_code]
    critical_type = None
    threshold = None
    message = None
    
    if "low" in config and value < config["low"]:
        critical_type = "low"
        threshold = config["low"]
        message = config["low_message"].format(value=value, unit=unit or config["unit"])
    elif "high" in config and value > config["high"]:
        critical_type = "high"
        threshold = config["high"]
        message = config["high_message"].format(value=value, unit=unit or config["unit"])
    
    if not critical_type:
        return None
    
    # Extract patient ID
    subject_ref = observation.get("subject", {}).get("reference", "")
    patient_id = subject_ref.replace("Patient/", "") if subject_ref.startswith("Patient/") else ""
    
    # Extract effective date
    effective_date = observation.get("effectiveDateTime")
    detected_at = datetime.now(timezone.utc)
    if effective_date:
        try:
            detected_at = datetime.fromisoformat(effective_date.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    
    return CriticalValueAlert(
        observation_id=observation.get("id", ""),
        patient_id=patient_id,
        test_name=config["name"],
        loinc_code=loinc_code,
        value=value,
        unit=unit or config["unit"],
        critical_type=critical_type,
        threshold=threshold,
        message=message,
        detected_at=detected_at
    )


