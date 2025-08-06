"""
CDS Service Implementations - Example implementations showing how to move
conditions from configuration to service logic per CDS Hooks specification
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dateutil import parser
import re

from .service_registry import ServiceImplementation, Card, Source
from .models import Suggestion, Action, Link


class AgeBasedScreeningService(ServiceImplementation):
    """Example: Age-based screening reminders"""
    
    def __init__(self, service_id: str, min_age: int = 50, screening_name: str = "Colonoscopy"):
        super().__init__(service_id)
        self.min_age = min_age
        self.screening_name = screening_name
    
    async def should_execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> bool:
        """Check if patient meets age criteria"""
        patient = prefetch.get("patient")
        if not patient:
            return False
        
        # Calculate patient age
        birth_date = patient.get("birthDate")
        if not birth_date:
            return False
        
        try:
            birth = parser.parse(birth_date)
            age = (datetime.now() - birth).days // 365
            return age >= self.min_age
        except:
            return False
    
    async def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> List[Card]:
        """Generate screening reminder card"""
        patient = prefetch.get("patient", {})
        
        # Check if screening is already done
        procedures = prefetch.get("procedures", {}).get("entry", [])
        recent_screening = any(
            self.screening_name.lower() in proc.get("resource", {}).get("code", {}).get("text", "").lower()
            for proc in procedures
        )
        
        if recent_screening:
            return []
        
        return [self.create_card(
            summary=f"{self.screening_name} screening recommended",
            indicator="warning",
            detail=f"Patient is {self.min_age}+ years old and due for {self.screening_name} screening.",
            source_label="Preventive Care Guidelines",
            suggestions=[{
                "label": f"Order {self.screening_name}",
                "uuid": f"order-{self.screening_name.lower()}",
                "actions": [{
                    "type": "create",
                    "description": f"Order {self.screening_name} screening",
                    "resource": {
                        "resourceType": "ServiceRequest",
                        "code": {
                            "text": self.screening_name
                        }
                    }
                }]
            }]
        )]


class GenderSpecificScreeningService(ServiceImplementation):
    """Example: Gender-specific screening (e.g., mammography)"""
    
    def __init__(self, service_id: str, gender: str = "female", min_age: int = 40):
        super().__init__(service_id)
        self.gender = gender
        self.min_age = min_age
    
    async def should_execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> bool:
        """Check if patient meets gender and age criteria"""
        patient = prefetch.get("patient")
        if not patient:
            return False
        
        # Check gender
        if patient.get("gender", "").lower() != self.gender:
            return False
        
        # Check age
        birth_date = patient.get("birthDate")
        if not birth_date:
            return False
        
        try:
            birth = parser.parse(birth_date)
            age = (datetime.now() - birth).days // 365
            return age >= self.min_age
        except:
            return False
    
    async def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> List[Card]:
        """Generate mammography reminder"""
        return [self.create_card(
            summary="Mammography screening due",
            indicator="info",
            detail=f"Patient is a {self.gender} over {self.min_age} and due for mammography screening.",
            source_label="Breast Cancer Screening Guidelines"
        )]


class MedicationInteractionService(ServiceImplementation):
    """Example: Check for medication interactions"""
    
    async def should_execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> bool:
        """Always check when prescribing medications"""
        # This service runs whenever medications are being prescribed
        return context.get("hook") == "medication-prescribe"
    
    async def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> List[Card]:
        """Check for drug interactions"""
        cards = []
        
        # Get current medications
        current_meds = prefetch.get("medications", {}).get("entry", [])
        new_meds = context.get("medications", [])
        
        # Example: Check for specific interactions
        current_drug_names = [
            med.get("resource", {}).get("medicationCodeableConcept", {}).get("text", "").lower()
            for med in current_meds
        ]
        
        for new_med in new_meds:
            med_name = new_med.get("medicationCodeableConcept", {}).get("text", "").lower()
            
            # Example interaction check
            if "warfarin" in current_drug_names and "aspirin" in med_name:
                cards.append(self.create_card(
                    summary="Drug interaction warning",
                    indicator="critical",
                    detail="Aspirin and Warfarin interaction increases bleeding risk",
                    source_label="Drug Interaction Database",
                    suggestions=[{
                        "label": "Use alternative antiplatelet",
                        "uuid": "alternative-med"
                    }]
                ))
        
        return cards


class LabValueAlertService(ServiceImplementation):
    """Example: Alert on critical lab values"""
    
    def __init__(self, service_id: str, lab_code: str, critical_high: float, critical_low: float):
        super().__init__(service_id)
        self.lab_code = lab_code
        self.critical_high = critical_high
        self.critical_low = critical_low
    
    async def should_execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> bool:
        """Check if we have recent lab results"""
        observations = prefetch.get("recentLabs", {}).get("entry", [])
        return len(observations) > 0
    
    async def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> List[Card]:
        """Check for critical lab values"""
        cards = []
        observations = prefetch.get("recentLabs", {}).get("entry", [])
        
        for obs in observations:
            resource = obs.get("resource", {})
            
            # Check if this is the lab we're monitoring
            coding = resource.get("code", {}).get("coding", [])
            if not any(c.get("code") == self.lab_code for c in coding):
                continue
            
            # Check the value
            value = resource.get("valueQuantity", {}).get("value")
            if value is None:
                continue
            
            if value > self.critical_high:
                cards.append(self.create_card(
                    summary=f"Critical high {resource.get('code', {}).get('text', 'lab value')}",
                    indicator="critical",
                    detail=f"Value {value} exceeds critical threshold of {self.critical_high}",
                    source_label="Lab Critical Values"
                ))
            elif value < self.critical_low:
                cards.append(self.create_card(
                    summary=f"Critical low {resource.get('code', {}).get('text', 'lab value')}",
                    indicator="critical",
                    detail=f"Value {value} below critical threshold of {self.critical_low}",
                    source_label="Lab Critical Values"
                ))
        
        return cards


class DiagnosisBasedAlertService(ServiceImplementation):
    """Example: Alerts based on patient conditions/diagnoses"""
    
    def __init__(self, service_id: str, condition_codes: List[str], alert_message: str):
        super().__init__(service_id)
        self.condition_codes = condition_codes
        self.alert_message = alert_message
    
    async def should_execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> bool:
        """Check if patient has relevant conditions"""
        conditions = prefetch.get("conditions", {}).get("entry", [])
        
        for condition in conditions:
            resource = condition.get("resource", {})
            coding = resource.get("code", {}).get("coding", [])
            
            # Check if any of our target codes match
            for code_obj in coding:
                if code_obj.get("code") in self.condition_codes:
                    return True
        
        return False
    
    async def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> List[Card]:
        """Generate condition-specific alerts"""
        return [self.create_card(
            summary=self.alert_message,
            indicator="warning",
            source_label="Clinical Guidelines"
        )]


class ComplexConditionService(ServiceImplementation):
    """Example: Complex multi-condition logic"""
    
    async def should_execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> bool:
        """Complex condition checking"""
        patient = prefetch.get("patient", {})
        conditions = prefetch.get("conditions", {}).get("entry", [])
        medications = prefetch.get("medications", {}).get("entry", [])
        
        # Example: Patient with diabetes on multiple medications
        has_diabetes = any(
            "diabetes" in cond.get("resource", {}).get("code", {}).get("text", "").lower()
            for cond in conditions
        )
        
        med_count = len(medications)
        
        # Execute if diabetic patient on 5+ medications
        return has_diabetes and med_count >= 5
    
    async def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> List[Card]:
        """Generate polypharmacy alert for diabetic patients"""
        med_count = len(prefetch.get("medications", {}).get("entry", []))
        
        return [self.create_card(
            summary="Polypharmacy risk in diabetic patient",
            indicator="warning",
            detail=f"Patient has diabetes and is on {med_count} medications. Consider medication review.",
            source_label="Diabetes Care Guidelines",
            suggestions=[{
                "label": "Schedule medication review",
                "uuid": "med-review"
            }]
        )]


# Example registration code (would be in your app initialization)
def register_example_services(registry):
    """Register example services with the registry"""
    from .service_registry import ServiceDefinition
    
    # Age-based colonoscopy screening
    registry.register_service(
        ServiceDefinition(
            id="colonoscopy-screening",
            hook="patient-view",
            title="Colonoscopy Screening Reminder",
            description="Reminds providers when patients are due for colonoscopy",
            prefetch={
                "patient": "Patient/{{context.patientId}}",
                "procedures": "Procedure?patient={{context.patientId}}&code=http://snomed.info/sct|73761001"
            }
        ),
        AgeBasedScreeningService("colonoscopy-screening", min_age=50, screening_name="Colonoscopy")
    )
    
    # Gender-specific mammography screening
    registry.register_service(
        ServiceDefinition(
            id="mammography-screening",
            hook="patient-view",
            title="Mammography Screening Reminder",
            description="Reminds providers when female patients are due for mammography",
            prefetch={
                "patient": "Patient/{{context.patientId}}"
            }
        ),
        GenderSpecificScreeningService("mammography-screening", gender="female", min_age=40)
    )
    
    # Medication interaction checking
    registry.register_service(
        ServiceDefinition(
            id="drug-interactions",
            hook="medication-prescribe",
            title="Drug Interaction Checker",
            description="Checks for potential drug interactions",
            prefetch={
                "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
            }
        ),
        MedicationInteractionService("drug-interactions")
    )
    
    # Lab value monitoring
    registry.register_service(
        ServiceDefinition(
            id="potassium-monitor",
            hook="patient-view",
            title="Potassium Level Monitor",
            description="Alerts on critical potassium levels",
            prefetch={
                "recentLabs": "Observation?patient={{context.patientId}}&code=http://loinc.org|2823-3&date=ge{{today-7days}}"
            }
        ),
        LabValueAlertService("potassium-monitor", lab_code="2823-3", critical_high=6.0, critical_low=2.5)
    )