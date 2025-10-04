"""
CDS Hooks service implementations using fhirclient for HAPI FHIR

This module provides CDS Hooks services that fetch data from HAPI FHIR
using the fhirclient library instead of using prefetched data.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import uuid
import logging
from services.fhir_client_config import (
    get_patient,
    search_conditions,
    search_medications,
    search_observations,
    search_allergies
)

logger = logging.getLogger(__name__)


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
            "source": source or {"label": "WintEHR CDS"}
        }

        if suggestions:
            card["suggestions"] = suggestions
        if links:
            card["links"] = links

        return card

    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute the CDS service - to be implemented by subclasses"""
        raise NotImplementedError


class DiabetesManagementService(BaseCDSService):
    """Diabetes management CDS service using HAPI FHIR"""

    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any] = None) -> Dict[str, Any]:
        cards = []

        try:
            # Get patient ID from context
            patient_id = context.get('patientId')
            if not patient_id:
                logger.warning("No patientId in context")
                return {"cards": []}

            # Remove 'Patient/' prefix if present
            if patient_id.startswith('Patient/'):
                patient_id = patient_id.replace('Patient/', '')

            # Fetch patient data from HAPI FHIR
            patient = get_patient(patient_id)
            if not patient:
                logger.warning(f"Patient {patient_id} not found")
                return {"cards": []}

            # Check if patient has diabetes
            conditions = search_conditions(patient_id, status='active')
            has_diabetes = any(
                'diabetes' in condition.code.text.lower() if condition.code and condition.code.text else False
                for condition in conditions
            )

            if not has_diabetes:
                return {"cards": []}

            # Check latest A1C (HbA1c observation)
            a1c_observations = search_observations(
                patient_id,
                code='4548-4'  # LOINC code for HbA1c
            )

            if a1c_observations:
                # Get most recent A1C
                latest_a1c = max(
                    a1c_observations,
                    key=lambda obs: obs.effectiveDateTime.as_json() if obs.effectiveDateTime else ''
                )

                if latest_a1c.valueQuantity and latest_a1c.valueQuantity.value:
                    a1c_value = latest_a1c.valueQuantity.value

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
                                            "subject": {"reference": f"Patient/{patient_id}"},
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
            medications = search_medications(patient_id, status='active')
            on_metformin = any(
                'metformin' in (
                    med.medicationCodeableConcept.text.lower()
                    if med.medicationCodeableConcept and med.medicationCodeableConcept.text
                    else ''
                )
                for med in medications
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
                                    "subject": {"reference": f"Patient/{patient_id}"},
                                    "medicationCodeableConcept": {
                                        "text": "Metformin 500mg PO BID"
                                    }
                                }
                            }]
                        }
                    ]
                ))

            # Annual screening reminder
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

        except Exception as e:
            logger.error(f"Error in DiabetesManagementService: {e}", exc_info=True)
            cards.append(self.create_card(
                summary="CDS Service Error",
                detail=f"Unable to check diabetes management guidelines: {str(e)}",
                indicator="warning"
            ))

        return {"cards": cards}


class AllergyCheckService(BaseCDSService):
    """Allergy checking service using HAPI FHIR"""

    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any] = None) -> Dict[str, Any]:
        cards = []

        try:
            patient_id = context.get('patientId', '').replace('Patient/', '')
            medications = context.get('medications', [])

            if not patient_id or not medications:
                return {"cards": []}

            # Fetch allergies from HAPI FHIR
            allergies = search_allergies(patient_id)

            for medication in medications:
                med_text = (
                    medication.get('medicationCodeableConcept', {}).get('text', '').lower()
                    if isinstance(medication, dict)
                    else ''
                )

                for allergy in allergies:
                    if not allergy.code or not allergy.code.text:
                        continue

                    allergy_text = allergy.code.text.lower()

                    # Check for matches
                    if any(term in med_text for term in allergy_text.split()):
                        cards.append(self.create_card(
                            summary="Allergy Alert",
                            detail=f"Patient has documented allergy to {allergy.code.text}",
                            indicator="critical",
                            source={"label": "Allergy Checking Service"}
                        ))

        except Exception as e:
            logger.error(f"Error in AllergyCheckService: {e}", exc_info=True)
            cards.append(self.create_card(
                summary="CDS Service Error",
                detail=f"Unable to check allergies: {str(e)}",
                indicator="warning"
            ))

        return {"cards": cards}


class DrugInteractionService(BaseCDSService):
    """Drug-drug interaction checking service"""

    # Common drug interactions (simplified example)
    INTERACTIONS = {
        ('warfarin', 'aspirin'): {
            'severity': 'critical',
            'message': 'Increased bleeding risk with warfarin + aspirin combination'
        },
        ('metformin', 'contrast'): {
            'severity': 'warning',
            'message': 'Hold metformin before and after contrast administration'
        },
        ('ace inhibitor', 'potassium'): {
            'severity': 'warning',
            'message': 'Monitor potassium levels with ACE inhibitor + potassium supplement'
        }
    }

    def execute(self, context: Dict[str, Any], prefetch: Dict[str, Any] = None) -> Dict[str, Any]:
        cards = []

        try:
            patient_id = context.get('patientId', '').replace('Patient/', '')
            new_medications = context.get('medications', [])

            if not patient_id:
                return {"cards": []}

            # Fetch current medications from HAPI FHIR
            current_meds = search_medications(patient_id, status='active')

            # Extract medication names
            current_med_names = [
                med.medicationCodeableConcept.text.lower()
                for med in current_meds
                if med.medicationCodeableConcept and med.medicationCodeableConcept.text
            ]

            new_med_names = [
                med.get('medicationCodeableConcept', {}).get('text', '').lower()
                for med in new_medications
                if isinstance(med, dict)
            ]

            # Check for interactions
            for new_med in new_med_names:
                for current_med in current_med_names:
                    for (drug1, drug2), interaction in self.INTERACTIONS.items():
                        if (drug1 in new_med and drug2 in current_med) or \
                           (drug2 in new_med and drug1 in current_med):
                            cards.append(self.create_card(
                                summary="Drug Interaction Alert",
                                detail=interaction['message'],
                                indicator=interaction['severity']
                            ))

        except Exception as e:
            logger.error(f"Error in DrugInteractionService: {e}", exc_info=True)
            cards.append(self.create_card(
                summary="CDS Service Error",
                detail=f"Unable to check drug interactions: {str(e)}",
                indicator="warning"
            ))

        return {"cards": cards}


# Service registry for easy access
CDS_SERVICES = {
    'diabetes-management': DiabetesManagementService(),
    'allergy-check': AllergyCheckService(),
    'drug-interaction': DrugInteractionService(),
}


def get_cds_service(service_id: str) -> Optional[BaseCDSService]:
    """Get a CDS service by ID"""
    return CDS_SERVICES.get(service_id)
