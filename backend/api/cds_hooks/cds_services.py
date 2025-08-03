"""
CDS Services Implementation for WintEHR
"""
import uuid
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class BaseCDSService:
    """Base class for CDS services"""
    
    def __init__(self):
        """Initialize base CDS service"""
        pass
        
    def create_card(self, summary: str, detail: str, indicator: str = "info", 
                   suggestions: List[Dict] = None, links: List[Dict] = None, 
                   source: Dict = None):
        """Create a standardized CDS card"""
        card = {
            "uuid": str(uuid.uuid4()),
            "summary": summary,
            "detail": detail,
            "indicator": indicator,
            "source": source or {"label": "WintEHR CDS"}
        }
        
        if suggestions:
            card["suggestions"] = suggestions
        if links:
            card["links"] = links
            
        return card

    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the CDS service - to be implemented by subclasses"""
        raise NotImplementedError("Subclasses must implement execute method")

class DiabetesManagementService(BaseCDSService):
    """Diabetes management CDS service"""
    
    def __init__(self):
        """Initialize diabetes management service"""
        super().__init__()
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        cards = []
        
        try:
            # Check if patient has diabetes
            conditions = prefetch.get("conditions", [])
            if not conditions:
                return {"cards": []}
            
            # Check latest A1C
            a1c = prefetch.get("a1c")
            if a1c and isinstance(a1c, dict):
                # FHIR Observation structure: check valueQuantity
                value_quantity = a1c.get('valueQuantity', {})
                a1c_value = value_quantity.get('value') if value_quantity else None
                
                if a1c_value and a1c_value >= 9.0:
                    cards.append(self.create_card(
                        summary="High A1C Alert",
                        detail=f"Patient's A1C is {a1c_value}% (goal < 7%). Consider intensifying therapy.",
                        indicator="critical",
                        suggestions=[
                            {
                                "label": "Add basal insulin",
                                "uuid": str(uuid.uuid4()),
                                "actions": [{
                                    "type": "create",
                                    "description": "Prescribe insulin glargine",
                                    "resource": {
                                        "resourceType": "MedicationRequest",
                                        "medicationCodeableConcept": {
                                            "text": "Insulin glargine 10 units subcutaneous at bedtime"
                                        }
                                    }
                                }]
                            }
                        ],
                        links=[
                            {
                                "label": "ADA Standards of Care",
                                "url": "https://diabetesjournals.org/care/issue/47/Supplement_1",
                                "type": "absolute"
                            }
                        ]
                    ))
                elif a1c_value and a1c_value >= 7.0:
                    cards.append(self.create_card(
                        summary="A1C Above Goal",
                        detail=f"Patient's A1C is {a1c_value}% (goal < 7%). Consider treatment adjustment.",
                        indicator="warning"
                    ))
            
            # Check if on metformin (first-line therapy)
            medications = prefetch.get("medications", [])
            on_metformin = False
            for med in medications:
                if isinstance(med, dict):
                    # Check FHIR MedicationRequest structure
                    med_concept = med.get('medicationCodeableConcept', {})
                    if med_concept:
                        # Check text or coding display
                        med_text = med_concept.get('text', '')
                        if med_text and 'metformin' in med_text.lower():
                            on_metformin = True
                            break
                        # Also check codings
                        for coding in med_concept.get('coding', []):
                            display = coding.get('display', '')
                            if display and 'metformin' in display.lower():
                                on_metformin = True
                                break
            
            if not on_metformin:
                cards.append(self.create_card(
                    summary="Consider Metformin",
                    detail="Patient with diabetes not on metformin. Consider starting metformin as first-line therapy.",
                    indicator="info",
                    suggestions=[
                        {
                            "label": "Start metformin",
                            "uuid": str(uuid.uuid4()),
                            "actions": [{
                                "type": "create",
                                "description": "Prescribe metformin",
                                "resource": {
                                    "resourceType": "MedicationRequest",
                                    "medicationCodeableConcept": {
                                        "text": "Metformin 500mg PO BID"
                                    }
                                }
                            }]
                        }
                    ]
                ))
            
            # Check for annual screening reminders
            cards.append(self.create_card(
                summary="Annual Diabetes Screenings Due",
                detail="Remember annual screenings: eye exam, foot exam, urine microalbumin",
                indicator="info",
                links=[
                    {
                        "label": "Diabetes Care Checklist",
                        "url": "https://www.cdc.gov/diabetes/managing/care-schedule.html",
                        "type": "absolute"
                    }
                ]
            ))
            
            return {"cards": cards}
            
        except Exception as e:
            # Log error but don't crash - return empty cards array
            logger.error(f"Error in DiabetesManagementService: {str(e)}", exc_info=True)
            
            # Return error card to inform user
            error_card = self.create_card(
                summary="CDS Service Error",
                detail=f"An error occurred while evaluating diabetes management recommendations. Please contact support if this persists.",
                indicator="warning"
            )
            return {"cards": [error_card]}

class HypertensionManagementService(BaseCDSService):
    """Hypertension management CDS service"""
    
    def __init__(self):
        """Initialize hypertension management service"""
        super().__init__()
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        cards = []
        
        try:
            # Check blood pressure readings
            bp_observations = prefetch.get("bp", [])
            if not bp_observations:
                return {"cards": []}
            
            # Get latest systolic and diastolic readings
            systolic_readings = []
            diastolic_readings = []
            
            for obs in bp_observations:
                if isinstance(obs, dict):
                    # Check if this is a blood pressure observation
                    code_concept = obs.get('code', {})
                    if code_concept:
                        # Look for blood pressure components
                        components = obs.get('component', [])
                        for component in components:
                            comp_code = component.get('code', {})
                            comp_value = component.get('valueQuantity', {})
                            if comp_code and comp_value:
                                # Get the LOINC code
                                for coding in comp_code.get('coding', []):
                                    code = coding.get('code')
                                    value = comp_value.get('value')
                                if value is not None:
                                    if code == "8480-6":  # Systolic
                                        systolic_readings.append(float(value))
                                    elif code == "8462-4":  # Diastolic
                                        diastolic_readings.append(float(value))
            
            if systolic_readings and diastolic_readings:
                avg_systolic = sum(systolic_readings[:3]) / min(3, len(systolic_readings))
                avg_diastolic = sum(diastolic_readings[:3]) / min(3, len(diastolic_readings))
                
                if avg_systolic >= 180 or avg_diastolic >= 120:
                    cards.append(self.create_card(
                        summary="Hypertensive Crisis",
                        detail=f"Average BP: {avg_systolic:.0f}/{avg_diastolic:.0f}. Immediate evaluation needed.",
                        indicator="critical",
                        links=[
                            {
                                "label": "Hypertensive Crisis Management",
                                "url": "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/hypertensive-crisis-when-you-should-call-911-for-high-blood-pressure",
                                "type": "absolute"
                            }
                        ]
                    ))
                elif avg_systolic >= 130 or avg_diastolic >= 80:
                    cards.append(self.create_card(
                        summary="Elevated Blood Pressure",
                        detail=f"Average BP: {avg_systolic:.0f}/{avg_diastolic:.0f}. Consider treatment adjustment.",
                        indicator="warning"
                    ))
            
            return {"cards": cards}
            
        except Exception as e:
            logger.error(f"Error in HypertensionManagementService: {str(e)}", exc_info=True)
            return {"cards": []}

class DrugInteractionService(BaseCDSService):
    """Drug interaction checking service"""
    
    def __init__(self):
        """Initialize drug interaction service"""
        super().__init__()
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        cards = []
        
        try:
            medications = prefetch.get("medications", [])
            if len(medications) < 2:
                return {"cards": []}
            
            # Simple example: Check for warfarin interactions
            med_names = []
            for med in medications:
                if isinstance(med, dict):
                    med_concept = med.get('medicationCodeableConcept', {})
                    if med_concept:
                        med_text = med_concept.get('text', '')
                        if med_text:
                            med_names.append(med_text.lower())
            
            # Check for warfarin and common interactions
            if any('warfarin' in name for name in med_names):
                if any(drug in name for name in med_names for drug in ['aspirin', 'nsaid', 'ibuprofen']):
                    cards.append(self.create_card(
                        summary="Drug Interaction Alert",
                        detail="Warfarin and NSAIDs increase bleeding risk. Monitor INR closely.",
                        indicator="warning"
                    ))
            
            return {"cards": cards}
            
        except Exception as e:
            logger.error(f"Error in DrugInteractionService: {str(e)}", exc_info=True)
            return {"cards": []}

class PreventiveCareService(BaseCDSService):
    """Preventive care reminders"""
    
    def __init__(self):
        """Initialize preventive care service"""
        super().__init__()
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        cards = []
        
        try:
            patient = context.get("patient", {})
            
            # Simple age-based reminders
            birth_date = patient.get("birthDate")
            if birth_date:
                # Calculate age
                from datetime import datetime
                birth = datetime.fromisoformat(birth_date.replace('Z', '+00:00'))
                age = (datetime.now() - birth).days // 365
                
                if age >= 50:
                    cards.append(self.create_card(
                        summary="Preventive Care Reminders",
                        detail="Consider: Colonoscopy screening, Annual flu vaccine, Pneumonia vaccine",
                        indicator="info"
                    ))
            
            return {"cards": cards}
            
        except Exception as e:
            logger.error(f"Error in PreventiveCareService: {str(e)}", exc_info=True)
            return {"cards": []}

# CDS Services Registry - Services are instantiated in integration.py
CDS_SERVICES = {}