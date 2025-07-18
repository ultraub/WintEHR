"""CDS Hooks service implementations"""

from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import uuid

class BaseCDSService:
    """Base class for CDS services"""
    
    def create_card(
        self,
        summary: str,
        detail: str,
        indicator: str = "info",
        source: Dict[str, str] = None,
        suggestions: List[Dict[str, Any]] = None,
        links: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Create a CDS Hooks card"""
        card = {
            "uuid": str(uuid.uuid4()),
            "summary": summary,
            "detail": detail,
            "indicator": indicator,  # info, warning, critical
            "source": source or {"label": "Teaching EMR CDS"}
        }
        
        if suggestions:
            card["suggestions"] = suggestions
        if links:
            card["links"] = links
            
        return card
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the CDS service - to be implemented by subclasses"""
        raise NotImplementedError

class DiabetesManagementService(BaseCDSService):
    """Diabetes management CDS service"""
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        cards = []
        
        # Check if patient has diabetes
        conditions = prefetch.get("conditions", [])
        if not conditions:
            return {"cards": []}
        
        # Check latest A1C
        a1c = prefetch.get("a1c")
        if a1c and hasattr(a1c, 'value'):
            a1c_value = a1c.value
            
            if a1c_value >= 9.0:
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
            elif a1c_value >= 7.0:
                cards.append(self.create_card(
                    summary="A1C Above Goal",
                    detail=f"Patient's A1C is {a1c_value}% (goal < 7%). Consider treatment adjustment.",
                    indicator="warning"
                ))
        
        # Check if on metformin (first-line therapy)
        medications = prefetch.get("medications", [])
        on_metformin = any(
            med for med in medications 
            if hasattr(med, 'medication_name') and 'metformin' in med.medication_name.lower()
        )
        
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

class HypertensionManagementService(BaseCDSService):
    """Hypertension management CDS service"""
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        cards = []
        
        # Check blood pressure readings
        bp_observations = prefetch.get("bp", [])
        if not bp_observations:
            return {"cards": []}
        
        # Get latest systolic and diastolic readings
        systolic_readings = []
        diastolic_readings = []
        
        for obs in bp_observations:
            if hasattr(obs, 'code') and hasattr(obs, 'value'):
                if obs.code == "8480-6":  # Systolic
                    systolic_readings.append(obs.value)
                elif obs.code == "8462-4":  # Diastolic
                    diastolic_readings.append(obs.value)
        
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
            elif avg_systolic >= 140 or avg_diastolic >= 90:
                cards.append(self.create_card(
                    summary="Blood Pressure Above Goal",
                    detail=f"Average BP: {avg_systolic:.0f}/{avg_diastolic:.0f} (goal < 130/80). Consider medication adjustment.",
                    indicator="warning",
                    suggestions=[
                        {
                            "label": "Increase antihypertensive therapy",
                            "uuid": str(uuid.uuid4())
                        }
                    ]
                ))
        
        # Check medication adherence
        medications = prefetch.get("medications", [])
        on_ace_arb = any(
            med for med in medications 
            if hasattr(med, 'medication_name') and 
            any(drug in med.medication_name.lower() for drug in ['lisinopril', 'losartan', 'enalapril'])
        )
        
        if not on_ace_arb:
            cards.append(self.create_card(
                summary="Consider ACE Inhibitor or ARB",
                detail="Patient with hypertension not on ACE inhibitor or ARB. Consider as first-line therapy.",
                indicator="info"
            ))
        
        return {"cards": cards}

class DrugInteractionService(BaseCDSService):
    """Drug interaction checking service"""
    
    # Simplified interaction database
    INTERACTIONS = {
        ('warfarin', 'aspirin'): {
            'severity': 'warning',
            'summary': 'Increased bleeding risk',
            'detail': 'Concurrent use of warfarin and aspirin increases bleeding risk. Monitor INR closely.'
        },
        ('lisinopril', 'potassium'): {
            'severity': 'warning',
            'summary': 'Risk of hyperkalemia',
            'detail': 'ACE inhibitors with potassium supplements can cause hyperkalemia. Monitor potassium levels.'
        },
        ('metformin', 'contrast'): {
            'severity': 'critical',
            'summary': 'Risk of lactic acidosis',
            'detail': 'Hold metformin before and after contrast procedures to prevent lactic acidosis.'
        }
    }
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        cards = []
        
        # Get current medications
        medications = prefetch.get("medications", [])
        if not medications:
            return {"cards": []}
        
        # Get medication being prescribed (from context)
        new_medication = context.get("medications", {}).get("new", [])
        if not new_medication:
            return {"cards": []}
        
        # Extract medication names
        current_meds = []
        for med in medications:
            if hasattr(med, 'medication_name'):
                current_meds.append(med.medication_name.lower())
        
        # Check for interactions
        for new_med in new_medication:
            new_med_name = new_med.get("display", "").lower()
            
            for current_med in current_meds:
                # Check each interaction pair
                for (drug1, drug2), interaction in self.INTERACTIONS.items():
                    if (drug1 in new_med_name and drug2 in current_med) or \
                       (drug2 in new_med_name and drug1 in current_med):
                        cards.append(self.create_card(
                            summary=f"Drug Interaction: {interaction['summary']}",
                            detail=interaction['detail'],
                            indicator=interaction['severity']
                        ))
        
        return {"cards": cards}

class PreventiveCareService(BaseCDSService):
    """Preventive care reminder service"""
    
    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any]) -> Dict[str, Any]:
        cards = []
        
        # Get patient demographics
        patient = prefetch.get("patient", {})
        if not patient:
            return {"cards": []}
        
        # Calculate age
        birth_date = patient.get("birthDate")
        if birth_date:
            birth_date = date.fromisoformat(birth_date)
            age = (date.today() - birth_date).days // 365
            
            # Age-based screening recommendations
            if age >= 50:
                cards.append(self.create_card(
                    summary="Colorectal Cancer Screening Due",
                    detail="Patient is over 50. Recommend colonoscopy or FIT testing.",
                    indicator="info",
                    links=[
                        {
                            "label": "USPSTF Screening Guidelines",
                            "url": "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening",
                            "type": "absolute"
                        }
                    ]
                ))
            
            if age >= 40 and patient.get("gender") == "female":
                cards.append(self.create_card(
                    summary="Mammography Screening",
                    detail="Annual mammography recommended for women over 40.",
                    indicator="info"
                ))
            
            if age >= 65:
                cards.append(self.create_card(
                    summary="Pneumococcal Vaccine Recommended",
                    detail="CDC recommends pneumococcal vaccination for adults 65 and older.",
                    indicator="info"
                ))
        
        # Annual flu vaccine reminder (always applicable)
        cards.append(self.create_card(
            summary="Annual Flu Vaccine",
            detail="Annual influenza vaccination recommended for all patients.",
            indicator="info"
        ))
        
        return {"cards": cards}