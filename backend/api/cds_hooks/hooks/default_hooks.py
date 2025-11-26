"""
CDS Hooks Default Hook Configurations
Default/sample hook configurations for CDS Hooks implementation
"""

import uuid
from typing import Dict

from ..models import (
    HookConfiguration,
    HookCondition,
    HookAction,
    HookType,
)
from .builtin import medication_prescribe_hooks


def create_default_hooks() -> Dict[str, HookConfiguration]:
    """
    Create default hook configurations.

    In production, these would be stored in database.
    This provides sensible defaults for educational purposes.
    """
    hooks = {
        "patient-greeter": HookConfiguration(
            id="patient-greeter",
            hook=HookType.PATIENT_VIEW,
            title="Patient Greeter",
            description="Greets the patient and provides basic information",
            enabled=True,
            conditions=[],  # No conditions - always shows
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Welcome to Patient Chart",
                        "detail": "Review patient's clinical summary and recent activities.",
                        "indicator": "info",
                        "source": {"label": "EMR System"},
                        "links": [
                            {
                                "label": "View Clinical Guidelines",
                                "url": "https://www.cdc.gov/clinical-guidelines",
                                "type": "absolute"
                            }
                        ]
                    }
                )
            ],
            displayBehavior={
                "defaultMode": "popup",
                "indicatorOverrides": {
                    "critical": "modal",
                    "warning": "popup",
                    "info": "inline"
                },
                "acknowledgment": {
                    "required": False,
                    "reasonRequired": False
                },
                "snooze": {
                    "enabled": True,
                    "defaultDuration": 60
                }
            }
        ),
        "senior-care-reminder": HookConfiguration(
            id="senior-care-reminder",
            hook=HookType.PATIENT_VIEW,
            title="Senior Care Reminder",
            description="Reminds about preventive care for patients 65+",
            enabled=True,
            conditions=[
                HookCondition(
                    type="patient-age",
                    parameters={"operator": ">=", "value": "65"}
                )
            ],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Senior Care Reminder",
                        "detail": "Patient is 65+ years old. Consider annual wellness visit and preventive screenings.",
                        "indicator": "info",
                        "source": {"label": "Preventive Care System"},
                        "suggestions": [
                            {
                                "label": "Schedule Annual Wellness Visit",
                                "uuid": str(uuid.uuid4()),
                                "actions": [
                                    {
                                        "type": "create",
                                        "description": "Create wellness visit appointment",
                                        "resource": {
                                            "resourceType": "Appointment",
                                            "status": "proposed",
                                            "appointmentType": {
                                                "coding": [{
                                                    "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                                                    "code": "WELLNESS",
                                                    "display": "Wellness Exam"
                                                }]
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                )
            ]
        ),
        "diabetes-management": HookConfiguration(
            id="diabetes-management",
            hook=HookType.PATIENT_VIEW,
            title="Diabetes Management Alert",
            description="Alerts for patients with diabetes",
            enabled=True,
            conditions=[
                HookCondition(
                    type="diagnosis-code",
                    parameters={
                        "codes": ["44054006", "73211009", "714628002", "127013003", "90781000119102"],
                        "system": "http://snomed.info/sct"
                    }
                )
            ],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Diabetes Care Reminder",
                        "detail": "Patient has diabetes. Check A1C levels and foot exam status.",
                        "indicator": "warning",
                        "source": {"label": "Chronic Disease Management"},
                        "suggestions": [
                            {
                                "label": "Order A1C Test",
                                "uuid": str(uuid.uuid4()),
                                "actions": [
                                    {
                                        "type": "create",
                                        "description": "Order hemoglobin A1C test",
                                        "resource": {
                                            "resourceType": "ServiceRequest",
                                            "status": "draft",
                                            "intent": "order",
                                            "code": {
                                                "coding": [{
                                                    "system": "http://loinc.org",
                                                    "code": "4548-4",
                                                    "display": "Hemoglobin A1c/Hemoglobin.total in Blood"
                                                }]
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                )
            ]
        ),
        "medication-allergy-check": HookConfiguration(
            id="medication-allergy-check",
            hook=HookType.MEDICATION_PRESCRIBE,
            title="Medication Allergy Check",
            description="Checks for potential allergies when prescribing medications",
            enabled=True,
            conditions=[],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Allergy Check",
                        "detail": "Please verify patient allergies before prescribing",
                        "indicator": "info",
                        "source": {"label": "Medication Safety System"}
                    }
                )
            ]
        ),
        "drug-interaction-check": HookConfiguration(
            id="drug-interaction-check",
            hook=HookType.MEDICATION_PRESCRIBE,
            title="Drug Interaction Check",
            description="Checks for drug-drug interactions",
            enabled=True,
            conditions=[
                HookCondition(
                    type="medication-active",
                    parameters={"codes": ["any"]}  # Check for any active medications
                )
            ],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Drug Interaction Alert",
                        "detail": "Check for potential drug interactions with current medications",
                        "indicator": "warning",
                        "source": {"label": "Drug Interaction System"}
                    }
                )
            ]
        ),
        "hypertension-management": HookConfiguration(
            id="hypertension-management",
            hook=HookType.PATIENT_VIEW,
            title="Hypertension Management",
            description="Hypertension care reminders",
            enabled=True,
            conditions=[
                HookCondition(
                    type="diagnosis-code",
                    parameters={
                        "codes": ["38341003", "827069000", "78975002", "194774006"],
                        "system": "http://snomed.info/sct"
                    }
                )
            ],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Hypertension Care Reminder",
                        "detail": "Patient has hypertension. Consider BP monitoring and medication review.",
                        "indicator": "info",
                        "source": {"label": "Cardiovascular Care System"},
                        "suggestions": [
                            {
                                "label": "Order BP Monitoring",
                                "uuid": str(uuid.uuid4()),
                                "actions": [
                                    {
                                        "type": "create",
                                        "description": "Create BP monitoring plan",
                                        "resource": {
                                            "resourceType": "CarePlan",
                                            "status": "draft",
                                            "intent": "plan",
                                            "category": [{"coding": [{"code": "734163000", "display": "Care plan"}]}]
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                )
            ]
        ),
        "lab-value-critical": HookConfiguration(
            id="lab-value-critical",
            hook=HookType.PATIENT_VIEW,
            title="Critical Lab Values",
            description="Alerts for critical lab values",
            enabled=True,
            conditions=[
                HookCondition(
                    type="lab-value",
                    parameters={
                        "code": "33747-0",  # Glucose
                        "operator": "gt",
                        "value": "400",
                        "timeframe": "7"
                    }
                )
            ],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Critical Lab Alert",
                        "detail": "Patient has critical lab values requiring immediate attention",
                        "indicator": "critical",
                        "source": {"label": "Laboratory System"}
                    }
                )
            ]
        ),
        "annual-wellness-reminder": HookConfiguration(
            id="annual-wellness-reminder",
            hook=HookType.ENCOUNTER_START,
            title="Annual Wellness Visit Reminder",
            description="Reminds about annual wellness visits",
            enabled=True,
            conditions=[
                HookCondition(
                    type="patient-age",
                    parameters={"operator": ">=", "value": "18"}
                )
            ],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Annual Wellness Due",
                        "detail": "Consider scheduling annual wellness visit and preventive screenings",
                        "indicator": "info",
                        "source": {"label": "Preventive Care System"}
                    }
                )
            ]
        ),
        "discharge-planning": HookConfiguration(
            id="discharge-planning",
            hook=HookType.ENCOUNTER_DISCHARGE,
            title="Discharge Planning",
            description="Discharge planning reminders",
            enabled=True,
            conditions=[],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Discharge Planning",
                        "detail": "Ensure discharge planning is complete: medications reconciled, follow-up scheduled",
                        "indicator": "warning",
                        "source": {"label": "Discharge Planning System"},
                        "suggestions": [
                            {
                                "label": "Medication Reconciliation",
                                "uuid": str(uuid.uuid4()),
                                "actions": [
                                    {
                                        "type": "create",
                                        "description": "Complete medication reconciliation",
                                        "resource": {
                                            "resourceType": "Task",
                                            "status": "requested",
                                            "intent": "order",
                                            "description": "Complete medication reconciliation for discharge"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                )
            ]
        ),
        "order-appropriateness": HookConfiguration(
            id="order-appropriateness",
            hook=HookType.ORDER_SIGN,
            title="Order Appropriateness",
            description="Checks order appropriateness",
            enabled=True,
            conditions=[],
            actions=[
                HookAction(
                    type="show-card",
                    parameters={
                        "summary": "Order Review",
                        "detail": "Please review order appropriateness and clinical indication",
                        "indicator": "info",
                        "source": {"label": "Clinical Decision Support"}
                    }
                )
            ]
        )
    }

    # Add medication prescribe hooks from the builtin module
    medication_hooks = medication_prescribe_hooks.get_medication_prescribe_hooks()
    for hook in medication_hooks:
        hooks[hook.id] = hook

    return hooks


# Default hooks singleton - lazily loaded
_default_hooks = None


def get_default_hooks() -> Dict[str, HookConfiguration]:
    """Get the default hooks dictionary (cached)."""
    global _default_hooks
    if _default_hooks is None:
        _default_hooks = create_default_hooks()
    return _default_hooks


# For backward compatibility - alias to get_default_hooks()
SAMPLE_HOOKS = None


def get_sample_hooks() -> Dict[str, HookConfiguration]:
    """Get sample hooks - alias for get_default_hooks()."""
    return get_default_hooks()
