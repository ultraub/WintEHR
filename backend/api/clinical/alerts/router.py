"""
Clinical Alerts API endpoints.
Manages clinical alerts and notifications for healthcare providers.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import uuid

from database import get_db_session
from api.auth import get_current_user
from services.hapi_fhir_client import HAPIFHIRClient
from api.cds_hooks.constants import ExtensionURLs

router = APIRouter(prefix="/api/clinical/alerts", tags=["clinical-alerts"])

# Pydantic models
class AlertResponse(BaseModel):
    id: str
    patient_id: str
    provider_id: str
    message: str
    severity: str  # info, warning, critical
    alert_type: str  # drug-interaction, allergy, lab-critical, etc.
    created_at: datetime
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    source: Optional[str] = None
    reference_id: Optional[str] = None

@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    provider_id: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    """Get clinical alerts with optional filters."""
    try:
        # Build search parameters for Communication resources
        search_params = {
            'category': 'alert',
            '_count': str(limit),
            '_sort': '-sent'
        }

        if provider_id:
            search_params['recipient'] = f'Practitioner/{provider_id}'
        if patient_id:
            search_params['patient'] = f'Patient/{patient_id}'

        # Search Communication resources from HAPI FHIR using async client
        hapi_client = HAPIFHIRClient()
        bundle = await hapi_client.search('Communication', search_params)
        communication_resources = [entry.get("resource", {}) for entry in bundle.get("entry", [])]

        alerts = []
        if communication_resources:
            for comm in communication_resources:
                # Determine if acknowledged
                comm_status = comm.get('status', 'in-progress')
                is_acknowledged = comm_status == "completed"

                # Extract patient reference
                patient_ref = ""
                subject = comm.get('subject')
                if subject:
                    patient_ref = subject.get('reference', '')
                patient_id_clean = patient_ref.replace("Patient/", "").replace("urn:uuid:", "")

                # Extract provider reference
                provider_ref = ""
                recipients = comm.get('recipient', [])
                if recipients:
                    first_recipient = recipients[0] if recipients else None
                    if first_recipient:
                        provider_ref = first_recipient.get('reference', '')
                provider_id_clean = provider_ref.replace("Practitioner/", "").replace("urn:uuid:", "")

                # Extract message
                message = ""
                payloads = comm.get('payload', [])
                if payloads:
                    first_payload = payloads[0] if payloads else None
                    if first_payload:
                        message = first_payload.get('contentString', '')

                # Extract severity (priority)
                severity_val = comm.get('priority', 'info')

                # Extract alert type
                alert_type = "general"
                reason_codes = comm.get('reasonCode', [])
                if reason_codes:
                    first_reason = reason_codes[0] if reason_codes else None
                    if first_reason:
                        codings = first_reason.get('coding', [])
                        if codings:
                            first_coding = codings[0] if codings else None
                            if first_coding:
                                alert_type = first_coding.get('code', 'general')

                # Extract timestamps
                sent_val = comm.get('sent')
                created_at = sent_val if sent_val else datetime.now(timezone.utc).isoformat()
                received_val = comm.get('received')
                acknowledged_at = received_val if received_val and is_acknowledged else None

                # Extract acknowledged by
                acknowledged_by = None
                if is_acknowledged:
                    sender = comm.get('sender')
                    if sender:
                        sender_ref = sender.get('reference', '')
                        acknowledged_by = sender_ref.replace("Practitioner/", "").replace("urn:uuid:", "")

                # Extract source
                source = "system"
                mediums = comm.get('medium', [])
                if mediums:
                    first_medium = mediums[0] if mediums else None
                    if first_medium:
                        codings = first_medium.get('coding', [])
                        if codings:
                            first_coding = codings[0] if codings else None
                            if first_coding:
                                source = first_coding.get('code', 'system')

                # Extract reference
                reference_id = None
                abouts = comm.get('about', [])
                if abouts:
                    first_about = abouts[0] if abouts else None
                    if first_about:
                        reference_id = first_about.get('reference')

                alert = AlertResponse(
                    id=comm.get('id', ''),
                    patient_id=patient_id_clean,
                    provider_id=provider_id_clean,
                    message=message,
                    severity=severity_val,
                    alert_type=alert_type,
                    created_at=created_at,
                    acknowledged=is_acknowledged,
                    acknowledged_at=acknowledged_at,
                    acknowledged_by=acknowledged_by,
                    source=source,
                    reference_id=reference_id
                )

                # Apply filter conditions
                if severity and alert.severity != severity:
                    continue
                if acknowledged is not None and alert.acknowledged != acknowledged:
                    continue

                alerts.append(alert)

        return alerts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch alerts: {str(e)}")

@router.post("/acknowledge/{alert_id}")
async def acknowledge_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    """Acknowledge a clinical alert."""
    try:
        # Get the alert (Communication resource) from HAPI FHIR using async client
        hapi_client = HAPIFHIRClient()
        comm = await hapi_client.read('Communication', alert_id)

        if not comm:
            raise HTTPException(status_code=404, detail="Alert not found")

        # Update status to completed (acknowledged)
        comm["status"] = "completed"
        comm["received"] = datetime.now(timezone.utc).isoformat()
        comm["sender"] = {
            "reference": f"Practitioner/{current_user.get('id', 'unknown')}"
        }

        # Update in HAPI FHIR using async client
        await hapi_client.update('Communication', alert_id, comm)

        return {"message": "Alert acknowledged successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to acknowledge alert: {str(e)}")

@router.post("/create-test-alerts")
async def create_test_alerts(
    patient_id: str = Query(..., description="Patient ID to create test alerts for"),
    provider_id: str = Query(..., description="Provider ID to send alerts to"),
    db: AsyncSession = Depends(get_db_session)
):
    """Create test clinical alerts for development/testing."""
    test_alerts = [
        {
            "message": "Critical lab result: Potassium 6.2 mEq/L (High)",
            "severity": "critical",
            "alert_type": "lab-critical",
            "reference": "Observation/test-lab-1"
        },
        {
            "message": "Drug interaction alert: Warfarin and Aspirin",
            "severity": "warning",
            "alert_type": "drug-interaction",
            "reference": "MedicationRequest/test-med-1"
        },
        {
            "message": "Allergy alert: Patient allergic to Penicillin",
            "severity": "warning",
            "alert_type": "allergy",
            "reference": "AllergyIntolerance/test-allergy-1"
        }
    ]

    created_alerts = []

    for alert_data in test_alerts:
        # Create Communication resource for alert
        comm = {
            "resourceType": "Communication",
            "status": "in-progress",  # Not yet acknowledged
            "category": [{
                "coding": [{
                    "system": ExtensionURLs.COMMUNICATION_CATEGORY_SYSTEM,
                    "code": "alert",
                    "display": "Clinical Alert"
                }]
            }],
            "priority": alert_data["severity"],
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "recipient": [{
                "reference": f"Practitioner/{provider_id}"
            }],
            "payload": [{
                "contentString": alert_data["message"]
            }],
            "sent": datetime.now(timezone.utc).isoformat(),
            "reasonCode": [{
                "coding": [{
                    "system": ExtensionURLs.ALERT_TYPE_SYSTEM,
                    "code": alert_data["alert_type"],
                    "display": alert_data["alert_type"].replace("-", " ").title()
                }]
            }],
            "medium": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode",
                    "code": "ELECTRONIC",
                    "display": "electronic"
                }]
            }]
        }

        if alert_data.get("reference"):
            comm["about"] = [{
                "reference": alert_data["reference"]
            }]

        try:
            # Create Communication resource in HAPI FHIR using async client
            hapi_client = HAPIFHIRClient()
            created_comm = await hapi_client.create('Communication', comm)
            alert_id = created_comm.get('id', str(uuid.uuid4()))
            created_alerts.append(alert_id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create test alert: {str(e)}")

    return {
        "message": f"Created {len(created_alerts)} test alerts",
        "alert_ids": created_alerts
    }