"""
Clinical Alerts API endpoints.
Manages clinical alerts and notifications for healthcare providers.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
import uuid

from database import get_db_session
from auth import get_current_user

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
    # Build query to get Communication resources used as alerts
    query = """
        SELECT resource 
        FROM fhir.resources 
        WHERE resource_type = 'Communication' 
        AND deleted = false
        AND resource->'category'->0->'coding'->0->>'code' = 'alert'
    """
    
    conditions = []
    if provider_id:
        conditions.append(f"(resource->'recipient'->0->>'reference' = 'Practitioner/{provider_id}' OR resource->'recipient'->0->>'reference' = 'urn:uuid:{provider_id}')")
    if patient_id:
        conditions.append(f"(resource->'subject'->>'reference' = 'Patient/{patient_id}' OR resource->'subject'->>'reference' = 'urn:uuid:{patient_id}')")
    if severity:
        conditions.append(f"resource->'priority' = '{severity}'")
    
    if conditions:
        query += " AND " + " AND ".join(conditions)
    
    query += f" ORDER BY last_updated DESC LIMIT {limit}"
    
    try:
        result = await db.execute(text(query))
        alerts = []
        
        for row in result:
            comm = row[0]
            
            # Extract alert details from Communication resource
            is_acknowledged = comm.get("status") == "completed"
            
            # Extract IDs from references (handle both Patient/ and urn:uuid: formats)
            patient_ref = comm.get("subject", {}).get("reference", "")
            patient_id_clean = patient_ref.replace("Patient/", "").replace("urn:uuid:", "")
            
            provider_ref = comm.get("recipient", [{}])[0].get("reference", "")
            provider_id_clean = provider_ref.replace("Practitioner/", "").replace("urn:uuid:", "")
            
            alert = AlertResponse(
                id=comm.get("id"),
                patient_id=patient_id_clean,
                provider_id=provider_id_clean,
                message=comm.get("payload", [{}])[0].get("contentString", ""),
                severity=comm.get("priority", "info"),
                alert_type=comm.get("reasonCode", [{}])[0].get("coding", [{}])[0].get("code", "general"),
                created_at=comm.get("sent", datetime.now(timezone.utc).isoformat()),
                acknowledged=is_acknowledged,
                acknowledged_at=comm.get("received") if is_acknowledged else None,
                acknowledged_by=comm.get("sender", {}).get("reference", "").replace("Practitioner/", "").replace("urn:uuid:", "") if is_acknowledged else None,
                source=comm.get("medium", [{}])[0].get("coding", [{}])[0].get("code", "system"),
                reference_id=comm.get("about", [{}])[0].get("reference") if comm.get("about") else None
            )
            
            # Apply acknowledged filter if specified
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
        # Get the alert (Communication resource)
        result = await db.execute(
            text("""
                SELECT resource, version_id
                FROM fhir.resources 
                WHERE resource_type = 'Communication' 
                AND fhir_id = :alert_id
                AND deleted = false
            """),
            {"alert_id": alert_id}
        )
        
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        comm = row[0]
        current_version = row[1]
        
        # Update status to completed (acknowledged)
        comm["status"] = "completed"
        comm["received"] = datetime.now(timezone.utc).isoformat()
        comm["sender"] = {
            "reference": f"Practitioner/{current_user.get('id', 'unknown')}"
        }
        
        # Update metadata
        comm["meta"] = {
            "versionId": str(current_version + 1),
            "lastUpdated": datetime.now(timezone.utc).isoformat()
        }
        
        # Update in database
        await db.execute(
            text("""
                UPDATE fhir.resources 
                SET resource = :resource,
                    version_id = :version_id,
                    last_updated = :last_updated
                WHERE resource_type = 'Communication' 
                AND fhir_id = :alert_id
            """),
            {
                "resource": comm,
                "version_id": current_version + 1,
                "last_updated": datetime.now(timezone.utc),
                "alert_id": alert_id
            }
        )
        await db.commit()
        
        return {"message": "Alert acknowledged successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
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
        alert_id = str(uuid.uuid4())
        
        # Create Communication resource for alert
        comm = {
            "resourceType": "Communication",
            "id": alert_id,
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
            await db.execute(
                text("""
                    INSERT INTO fhir.resources (resource_type, fhir_id, version_id, last_updated, resource)
                    VALUES (:resource_type, :fhir_id, :version_id, :last_updated, :resource)
                """),
                {
                    "resource_type": "Communication",
                    "fhir_id": alert_id,
                    "version_id": 1,
                    "last_updated": datetime.now(timezone.utc),
                    "resource": comm
                }
            )
            created_alerts.append(alert_id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create test alert: {str(e)}")
    
    await db.commit()
    
    return {
        "message": f"Created {len(created_alerts)} test alerts",
        "alert_ids": created_alerts
    }