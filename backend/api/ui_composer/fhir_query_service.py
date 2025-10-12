"""
FHIR Query Service for UI Composer
Provides FHIR data access for UI Composer agents to make informed decisions
"""

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from services.fhir_client_config import search_resources, get_resource
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class FHIRQueryService:
    """Service for querying FHIR data to support UI generation"""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
    
    async def get_patient_summary(self, patient_id: str) -> Dict[str, Any]:
        """Get comprehensive patient summary including available resources"""
        try:
            # Get patient demographics
            patient = get_resource("Patient", patient_id)
            if not patient:
                return {"error": f"Patient {patient_id} not found"}
            
            # Get resource counts for this patient
            resource_types = [
                "Condition", "MedicationRequest", "Observation", 
                "Procedure", "AllergyIntolerance", "Immunization",
                "DiagnosticReport", "CarePlan", "Encounter"
            ]
            
            summary = {
                "patient": patient,
                "resourceCounts": {},
                "recentData": {}
            }
            
            for resource_type in resource_types:
                try:
                    # Get count
                    search_params = {"patient": patient_id, "_summary": "count"}
                    bundle = search_resources(resource_type, search_params)
                    count = bundle.get("total", 0) if isinstance(bundle, dict) else 0
                    summary["resourceCounts"][resource_type] = count

                    # Get recent samples if any exist
                    if count > 0:
                        search_params = {
                            "patient": patient_id,
                            "_count": "3",
                            "_sort": "-_lastUpdated"
                        }
                        sample_bundle = search_resources(resource_type, search_params)
                        if isinstance(sample_bundle, dict) and sample_bundle.get("entry"):
                            summary["recentData"][resource_type] = [
                                entry.get("resource", entry) for entry in sample_bundle["entry"]
                            ]
                except Exception as e:
                    logger.warning(f"Error querying {resource_type}: {e}")
                    summary["resourceCounts"][resource_type] = 0
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting patient summary: {e}")
            return {"error": str(e)}
    
    async def search_observations_by_code(self, code: str, value_quantity: Optional[str] = None, 
                                         patient_id: Optional[str] = None) -> Dict[str, Any]:
        """Search for observations by LOINC code with optional value filters"""
        try:
            search_params = {"code": code}
            
            if patient_id:
                search_params["patient"] = patient_id
            
            # Handle value queries like ">8" for A1C
            if value_quantity:
                # Parse the value query
                if value_quantity.startswith(">"):
                    search_params["value-quantity"] = f"gt{value_quantity[1:]}"
                elif value_quantity.startswith("<"):
                    search_params["value-quantity"] = f"lt{value_quantity[1:]}"
                elif value_quantity.startswith(">="):
                    search_params["value-quantity"] = f"ge{value_quantity[2:]}"
                elif value_quantity.startswith("<="):
                    search_params["value-quantity"] = f"le{value_quantity[2:]}"
                else:
                    search_params["value-quantity"] = value_quantity
            
            bundle = search_resources("Observation", search_params)

            # Handle case where bundle might be a string or have error
            if isinstance(bundle, str):
                logger.error(f"Unexpected string response from FHIR client: {bundle}")
                return {"error": "Invalid response format", "total": 0, "observations": []}
            
            # Extract useful information
            results = {
                "total": bundle.get("total", 0) if isinstance(bundle, dict) else 0,
                "observations": []
            }
            
            if isinstance(bundle, dict) and bundle.get("entry"):
                for entry in bundle["entry"]:
                    obs = entry.get("resource", entry)
                    results["observations"].append({
                        "id": obs.get("id"),
                        "patientId": obs.get("subject", {}).get("reference", "").split("/")[-1],
                        "value": obs.get("valueQuantity", {}).get("value"),
                        "unit": obs.get("valueQuantity", {}).get("unit"),
                        "date": obs.get("effectiveDateTime"),
                        "status": obs.get("status")
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching observations: {e}")
            return {"error": str(e), "total": 0, "observations": []}
    
    async def get_patients_with_condition(self, condition_code: Optional[str] = None,
                                         condition_text: Optional[str] = None) -> List[str]:
        """Get list of patient IDs with a specific condition"""
        try:
            search_params = {}
            if condition_code:
                search_params["code"] = condition_code
            if condition_text:
                search_params["_text"] = condition_text
            
            bundle = search_resources("Condition", search_params)

            # Handle case where bundle might be a string or have error
            if isinstance(bundle, str):
                logger.error(f"Unexpected string response from FHIR client: {bundle}")
                return []

            patient_ids = set()
            if isinstance(bundle, dict) and bundle.get("entry"):
                for entry in bundle["entry"]:
                    condition = entry.get("resource", entry)
                    patient_ref = condition.get("subject", {}).get("reference", "")
                    if patient_ref:
                        patient_id = patient_ref.split("/")[-1]
                        patient_ids.add(patient_id)
            
            return list(patient_ids)
            
        except Exception as e:
            logger.error(f"Error getting patients with condition: {e}")
            return []
    
    async def analyze_available_data(self, search_context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze what data is available based on the search context"""
        analysis = {
            "dataAvailability": {},
            "suggestedComponents": [],
            "sampleData": {}
        }
        
        # If searching for specific lab values (like A1C > 8)
        if "labValue" in search_context:
            lab_info = search_context["labValue"]
            results = await self.search_observations_by_code(
                lab_info.get("code"),
                lab_info.get("value")
            )
            
            analysis["dataAvailability"]["matchingObservations"] = results["total"]
            if results["total"] > 0:
                analysis["suggestedComponents"].extend([
                    {"type": "grid", "purpose": "List of patients with matching values"},
                    {"type": "chart", "purpose": "Distribution of values"},
                    {"type": "timeline", "purpose": "Trend over time"}
                ])
                analysis["sampleData"]["observations"] = results["observations"][:5]
        
        # If searching for conditions
        if "condition" in search_context:
            patient_ids = await self.get_patients_with_condition(
                condition_text=search_context["condition"]
            )
            analysis["dataAvailability"]["patientsWithCondition"] = len(patient_ids)
            if patient_ids:
                analysis["suggestedComponents"].extend([
                    {"type": "grid", "purpose": "Patient list with condition details"},
                    {"type": "summary", "purpose": "Condition statistics"}
                ])
        
        # If specific patient context
        if "patientId" in search_context:
            summary = await self.get_patient_summary(search_context["patientId"])
            analysis["dataAvailability"]["patientResources"] = summary.get("resourceCounts", {})
            analysis["sampleData"]["patientData"] = summary.get("recentData", {})
            
            # Suggest components based on available data
            if summary.get("resourceCounts", {}).get("Observation", 0) > 0:
                analysis["suggestedComponents"].append(
                    {"type": "chart", "purpose": "Vital signs trends"}
                )
            if summary.get("resourceCounts", {}).get("MedicationRequest", 0) > 0:
                analysis["suggestedComponents"].append(
                    {"type": "grid", "purpose": "Current medications"}
                )
        
        return analysis
    
    async def get_resource_schema(self, resource_type: str) -> Dict[str, Any]:
        """Get FHIR resource schema information"""
        # This would ideally load from FHIR definitions
        # For now, return common fields
        schemas = {
            "Observation": {
                "searchParams": ["patient", "code", "date", "value-quantity", "status"],
                "commonCodes": {
                    "4548-4": "Hemoglobin A1c",
                    "8480-6": "Systolic blood pressure",
                    "8462-4": "Diastolic blood pressure",
                    "8867-4": "Heart rate",
                    "9279-1": "Respiratory rate",
                    "8310-5": "Body temperature",
                    "29463-7": "Body weight",
                    "8302-2": "Body height"
                }
            },
            "Condition": {
                "searchParams": ["patient", "code", "clinical-status", "onset-date"],
                "commonCodes": {
                    "44054006": "Diabetes mellitus type 2",
                    "38341003": "Hypertension",
                    "84114007": "Heart failure",
                    "13645005": "COPD",
                    "49436004": "Atrial fibrillation"
                }
            },
            "MedicationRequest": {
                "searchParams": ["patient", "status", "intent", "medication", "authoredon"],
                "statuses": ["active", "on-hold", "cancelled", "completed", "stopped"]
            }
        }
        
        return schemas.get(resource_type, {})
    
    def format_for_agent_context(self, analysis: Dict[str, Any]) -> str:
        """Format analysis results for inclusion in agent prompts"""
        context_parts = []
        
        if analysis.get("dataAvailability"):
            context_parts.append("Available FHIR Data:")
            for key, value in analysis["dataAvailability"].items():
                context_parts.append(f"- {key}: {value}")
        
        if analysis.get("sampleData"):
            context_parts.append("\nSample Data Structures:")
            for resource_type, samples in analysis["sampleData"].items():
                if samples and len(samples) > 0:
                    context_parts.append(f"- {resource_type}: {len(samples)} samples available")
        
        if analysis.get("suggestedComponents"):
            context_parts.append("\nRecommended UI Components:")
            for comp in analysis["suggestedComponents"]:
                context_parts.append(f"- {comp['type']}: {comp['purpose']}")
        
        return "\n".join(context_parts)