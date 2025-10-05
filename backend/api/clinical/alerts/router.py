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
from services.fhir_client_config import get_resource, search_resources, create_resource, update_resource

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

        # Search Communication resources from HAPI FHIR
        communication_resources = search_resources('Communication', search_params)

        alerts = []
        if communication_resources:
            for comm in communication_resources:
                # Determine if acknowledged
                comm_status = comm.status if hasattr(comm, 'status') else "in-progress"
                is_acknowledged = comm_status == "completed"

                # Extract patient reference
                patient_ref = ""
                if hasattr(comm, 'subject') and comm.subject:
                    patient_ref = comm.subject.reference if hasattr(comm.subject, 'reference') else ""
                patient_id_clean = patient_ref.replace("Patient/", "").replace("urn:uuid:", "")

                # Extract provider reference
                provider_ref = ""
                if hasattr(comm, 'recipient') and comm.recipient:
                    first_recipient = comm.recipient[0] if comm.recipient else None
                    if first_recipient and hasattr(first_recipient, 'reference'):
                        provider_ref = first_recipient.reference
                provider_id_clean = provider_ref.replace("Practitioner/", "").replace("urn:uuid:", "")

                # Extract message
                message = ""
                if hasattr(comm, 'payload') and comm.payload:
                    first_payload = comm.payload[0] if comm.payload else None
                    if first_payload and hasattr(first_payload, 'contentString'):
                        message = first_payload.contentString

                # Extract severity (priority)
                severity_val = comm.priority if hasattr(comm, 'priority') else "info"

                # Extract alert type
                alert_type = "general"
                if hasattr(comm, 'reasonCode') and comm.reasonCode:
                    first_reason = comm.reasonCode[0] if comm.reasonCode else None
                    if first_reason and hasattr(first_reason, 'coding') and first_reason.coding:
                        first_coding = first_reason.coding[0] if first_reason.coding else None
                        if first_coding and hasattr(first_coding, 'code'):
                            alert_type = first_coding.code

                # Extract timestamps
                created_at = comm.sent.isostring if hasattr(comm, 'sent') and comm.sent else datetime.now(timezone.utc)
                acknowledged_at = comm.received.isostring if hasattr(comm, 'received') and comm.received and is_acknowledged else None

                # Extract acknowledged by
                acknowledged_by = None
                if is_acknowledged and hasattr(comm, 'sender') and comm.sender:
                    sender_ref = comm.sender.reference if hasattr(comm.sender, 'reference') else ""
                    acknowledged_by = sender_ref.replace("Practitioner/", "").replace("urn:uuid:", "")

                # Extract source
                source = "system"
                if hasattr(comm, 'medium') and comm.medium:
                    first_medium = comm.medium[0] if comm.medium else None
                    if first_medium and hasattr(first_medium, 'coding') and first_medium.coding:
                        first_coding = first_medium.coding[0] if first_medium.coding else None
                        if first_coding and hasattr(first_coding, 'code'):
                            source = first_coding.code

                # Extract reference
                reference_id = None
                if hasattr(comm, 'about') and comm.about:
                    first_about = comm.about[0] if comm.about else None
                    if first_about and hasattr(first_about, 'reference'):
                        reference_id = first_about.reference

                alert = AlertResponse(
                    id=comm.id if hasattr(comm, 'id') else "",
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
        # Get the alert (Communication resource) from HAPI FHIR
        comm = get_resource('Communication', alert_id)

        if not comm:
            raise HTTPException(status_code=404, detail="Alert not found")

        # Convert to dict for updates
        comm_dict = comm.as_json() if hasattr(comm, 'as_json') else comm

        # Update status to completed (acknowledged)
        comm_dict["status"] = "completed"
        comm_dict["received"] = datetime.now(timezone.utc).isoformat()
        comm_dict["sender"] = {
            "reference": f"Practitioner/{current_user.get('id', 'unknown')}"
        }

        # Update in HAPI FHIR
        update_resource('Communication', alert_id, comm_dict)

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
                    "system": "http://wintehr.com/fhir/communication-category",
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
                    "system": "http://wintehr.com/fhir/alert-type",
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
            # Create Communication resource in HAPI FHIR
            created_comm = create_resource('Communication', comm)
            alert_id = created_comm.id if hasattr(created_comm, 'id') else str(uuid.uuid4())
            created_alerts.append(alert_id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create test alert: {str(e)}")

    return {
        "message": f"Created {len(created_alerts)} test alerts",
        "alert_ids": created_alerts
    }