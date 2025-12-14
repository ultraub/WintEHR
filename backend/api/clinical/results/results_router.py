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
from api.cds_hooks.constants import ExtensionURLs
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
    - Returns acknowledgment status from extensions
    
    Educational notes:
    - FHIR Observation is the standard resource for lab results
    - Critical values are determined by comparing against defined thresholds
    - Acknowledgment is tracked via FHIR extensions
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
        
        results = []
        for entry in bundle.get("entry", []):
            observation = entry.get("resource", {})
            result_summary = _build_result_summary(observation, include_critical_check)
            results.append(result_summary)
        
        return results
        
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
        
        critical_alerts = []
        for entry in bundle.get("entry", []):
            observation = entry.get("resource", {})
            
            # Check if this observation has a critical value
            alert = _check_critical_value(observation)
            if alert:
                # Check acknowledgment status if filter is specified
                if acknowledged is not None:
                    is_acked = _is_acknowledged(observation)
                    if is_acked != acknowledged:
                        continue
                
                critical_alerts.append(alert)
        
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
    - Updates Observation with acknowledgment extension
    - Records who acknowledged and when
    - Creates audit trail via FHIR provenance pattern
    
    Educational notes:
    - Result acknowledgment is a key clinical workflow
    - FHIR extensions allow tracking custom workflow states
    - This creates a defensible audit trail
    """
    try:
        hapi_client = HAPIFHIRClient()
        
        # Get the observation
        observation = await hapi_client.read("Observation", acknowledgment.observation_id)
        if not observation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Observation not found"
            )
        
        current_time = datetime.now(timezone.utc)
        
        # Initialize extensions if needed
        if "extension" not in observation:
            observation["extension"] = []
        
        # Remove any existing acknowledgment extension
        observation["extension"] = [
            ext for ext in observation["extension"]
            if ext.get("url") != f"{ExtensionURLs.BASE_URL}/result-acknowledgment"
        ]
        
        # Add acknowledgment extension
        acknowledgment_ext = {
            "url": f"{ExtensionURLs.BASE_URL}/result-acknowledgment",
            "extension": [
                {
                    "url": "acknowledged",
                    "valueBoolean": True
                },
                {
                    "url": "acknowledgedBy",
                    "valueReference": {
                        "reference": f"Practitioner/{acknowledgment.acknowledged_by}"
                    }
                },
                {
                    "url": "acknowledgedAt",
                    "valueDateTime": current_time.isoformat()
                }
            ]
        }
        
        if acknowledgment.notes:
            acknowledgment_ext["extension"].append({
                "url": "notes",
                "valueString": acknowledgment.notes
            })
        
        observation["extension"].append(acknowledgment_ext)
        
        # Update the observation
        await hapi_client.update("Observation", acknowledgment.observation_id, observation)
        
        logger.info(f"Acknowledged Observation/{acknowledgment.observation_id} by Practitioner/{acknowledgment.acknowledged_by}")
        
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
        
        return _build_result_summary(observation, include_critical_check=True)
        
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

def _build_result_summary(observation: Dict[str, Any], include_critical_check: bool = True) -> ResultSummary:
    """Build a result summary from a FHIR Observation resource."""
    
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
        except:
            pass
    
    # Check for critical value
    is_critical = False
    if include_critical_check and value is not None and loinc_code:
        alert = _check_critical_value(observation)
        is_critical = alert is not None
    
    # Check acknowledgment status
    is_acknowledged = _is_acknowledged(observation)
    acknowledged_by = None
    acknowledged_at = None
    
    for ext in observation.get("extension", []):
        if ext.get("url") == f"{ExtensionURLs.BASE_URL}/result-acknowledgment":
            for sub_ext in ext.get("extension", []):
                if sub_ext.get("url") == "acknowledgedBy":
                    ref = sub_ext.get("valueReference", {}).get("reference", "")
                    acknowledged_by = ref.replace("Practitioner/", "") if ref.startswith("Practitioner/") else ref
                elif sub_ext.get("url") == "acknowledgedAt":
                    try:
                        acknowledged_at = datetime.fromisoformat(sub_ext.get("valueDateTime", "").replace("Z", "+00:00"))
                    except:
                        pass
    
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
        except:
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


def _is_acknowledged(observation: Dict[str, Any]) -> bool:
    """Check if an observation has been acknowledged."""
    for ext in observation.get("extension", []):
        if ext.get("url") == f"{ExtensionURLs.BASE_URL}/result-acknowledgment":
            for sub_ext in ext.get("extension", []):
                if sub_ext.get("url") == "acknowledged":
                    return sub_ext.get("valueBoolean", False)
    return False
