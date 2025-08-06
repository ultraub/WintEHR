"""
Pharmacy Workflow API Router
Handles medication dispensing, status tracking, and pharmacy queue management
"""

from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from uuid import UUID
import uuid
import json

from database import get_db_session
from fhir.core.storage import FHIRStorageEngine
from pydantic import BaseModel

router = APIRouter(prefix="/api/clinical/pharmacy", tags=["pharmacy"])


class MedicationDispenseRequest(BaseModel):
    """Request model for medication dispensing"""
    medication_request_id: str
    quantity: float
    lot_number: str
    expiration_date: str
    pharmacist_notes: Optional[str] = None
    pharmacist_id: Optional[str] = None


class PharmacyStatusUpdate(BaseModel):
    """Request model for pharmacy status updates"""
    status: str  # pending, verified, dispensed, ready, completed
    notes: Optional[str] = None
    updated_by: Optional[str] = None


class PharmacyQueueItem(BaseModel):
    """Pharmacy queue item model"""
    medication_request_id: str
    patient_id: str
    patient_name: Optional[str] = None
    medication_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    status: str
    priority: int
    prescribed_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    prescriber: Optional[str] = None
    pharmacy_notes: Optional[str] = None


@router.get("/queue", response_model=List[PharmacyQueueItem])
async def get_pharmacy_queue(
    status: Optional[str] = None,
    patient_id: Optional[str] = None,
    priority: Optional[int] = None,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get pharmacy queue with optional filtering
    """
    try:
        storage = FHIRStorageEngine(db)
        
        # Build search parameters
        search_params = {}
        if patient_id:
            search_params['patient'] = patient_id
        if status:
            search_params['status'] = status
            
        # Get medication requests
        resources, total = await storage.search_resources('MedicationRequest', search_params)
        
        queue_items = []
        for resource in resources:
            # Extract pharmacy queue information
            queue_item = _build_pharmacy_queue_item(resource)
            
            # Apply additional filters
            if priority and queue_item.priority != priority:
                continue
                
            queue_items.append(queue_item)
        
        # Sort by priority and date
        queue_items.sort(key=lambda x: (
            x.priority, 
            x.prescribed_date or datetime.min.replace(tzinfo=timezone.utc)
        ))
        
        return queue_items
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve pharmacy queue: {str(e)}"
        )


@router.post("/dispense")
async def dispense_medication(
    dispense_request: MedicationDispenseRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Dispense medication and create MedicationDispense resource
    """
    try:
        storage = FHIRStorageEngine(db)
        
        # Get the medication request
        med_request = await storage.read_resource('MedicationRequest', dispense_request.medication_request_id)
        if not med_request:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Medication request not found"
            )
        
        # Create complete MedicationDispense FHIR resource
        dispense_id = str(uuid.uuid4())
        current_time = datetime.now(timezone.utc)
        
        dispense_resource = {
            "resourceType": "MedicationDispense",
            "id": dispense_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": current_time.isoformat(),
                "profile": ["http://hl7.org/fhir/StructureDefinition/MedicationDispense"]
            },
            "identifier": [
                {
                    "system": "http://example.org/pharmacy/dispense-id",
                    "value": f"DISP-{dispense_id[:8].upper()}"
                }
            ],
            "status": "completed",
            "medicationCodeableConcept": med_request.get('medicationCodeableConcept'),
            "subject": med_request.get('subject'),
            "context": med_request.get('encounter'),
            "performer": [
                {
                    "actor": {
                        "reference": f"Practitioner/{dispense_request.pharmacist_id or 'default-pharmacist'}",
                        "display": "Pharmacist"
                    }
                }
            ],
            "authorizingPrescription": [
                {
                    "reference": f"MedicationRequest/{dispense_request.medication_request_id}"
                }
            ],
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": "FF",
                        "display": "First Fill"
                    }
                ]
            },
            "quantity": {
                "value": dispense_request.quantity,
                "unit": med_request.get('dispenseRequest', {}).get('quantity', {}).get('unit', 'units'),
                "system": "http://unitsofmeasure.org"
            },
            "daysSupply": {
                "value": 30,
                "unit": "days",
                "system": "http://unitsofmeasure.org",
                "code": "d"
            },
            "whenPrepared": current_time.isoformat(),
            "whenHandedOver": current_time.isoformat(),
            "dosageInstruction": med_request.get('dosageInstruction', []),
            "note": []
        }
        
        # Add lot number and expiration as extensions
        if dispense_request.lot_number:
            dispense_resource.setdefault('extension', []).append({
                "url": "http://hl7.org/fhir/StructureDefinition/medication-lotNumber",
                "valueString": dispense_request.lot_number
            })
            
        if dispense_request.expiration_date:
            dispense_resource.setdefault('extension', []).append({
                "url": "http://hl7.org/fhir/StructureDefinition/medication-expirationDate",
                "valueDate": dispense_request.expiration_date
            })
        
        # Add pharmacist notes
        if dispense_request.pharmacist_notes:
            dispense_resource['note'].append({
                "text": dispense_request.pharmacist_notes,
                "time": datetime.now().isoformat()
            })
        
        # Create the dispense resource
        fhir_id, version_id, last_updated = await storage.create_resource(
            'MedicationDispense',
            dispense_resource
        )
        
        # Get the created resource to return
        created_dispense = await storage.read_resource('MedicationDispense', fhir_id)
        
        # Update medication request status to completed
        updated_request = med_request.copy()
        updated_request['status'] = 'completed'
        
        # Add dispense event to request
        updated_request.setdefault('dispenseRequest', {})['dispenseEvent'] = [{
            "reference": f"MedicationDispense/{created_dispense['id']}",
            "display": "Medication dispensed"
        }]
        
        await storage.update_resource(
            'MedicationRequest', 
            dispense_request.medication_request_id, 
            updated_request
        )
        
        return {
            "message": "Medication dispensed successfully",
            "dispense_id": created_dispense['id'],
            "medication_request_id": dispense_request.medication_request_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to dispense medication: {str(e)}"
        )


@router.put("/status/{medication_request_id}")
async def update_pharmacy_status(
    medication_request_id: str,
    status_update: PharmacyStatusUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Update pharmacy workflow status for a medication request
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Updating pharmacy status for MedicationRequest ID: {medication_request_id}")
    logger.info(f"New status: {status_update.status}")
    
    try:
        storage = FHIRStorageEngine(db)
        
        # Get the medication request
        med_request = await storage.read_resource('MedicationRequest', medication_request_id)
        if not med_request:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Medication request not found"
            )
        
        # Update pharmacy status (stored as extension)
        updated_request = med_request.copy()
        
        # Find or create pharmacy status extension
        extensions = updated_request.setdefault('extension', [])
        pharmacy_ext = None
        
        for ext in extensions:
            if ext.get('url') == 'http://wintehr.com/fhir/StructureDefinition/pharmacy-status':
                pharmacy_ext = ext
                break
        
        if not pharmacy_ext:
            pharmacy_ext = {
                "url": "http://wintehr.com/fhir/StructureDefinition/pharmacy-status",
                "extension": []
            }
            extensions.append(pharmacy_ext)
        
        # Update status and timestamp
        pharmacy_ext['extension'] = [
            {
                "url": "status",
                "valueString": status_update.status
            },
            {
                "url": "lastUpdated",
                "valueDateTime": datetime.now().isoformat()
            }
        ]
        
        if status_update.updated_by:
            pharmacy_ext['extension'].append({
                "url": "updatedBy",
                "valueString": status_update.updated_by
            })
        
        # Add notes if provided
        if status_update.notes:
            updated_request.setdefault('note', []).append({
                "text": f"Pharmacy: {status_update.notes}",
                "time": datetime.now().isoformat()
            })
        
        # Update the resource
        await storage.update_resource('MedicationRequest', medication_request_id, updated_request)
        
        return {
            "message": f"Pharmacy status updated to {status_update.status}",
            "medication_request_id": medication_request_id,
            "status": status_update.status
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update pharmacy status: {str(e)}"
        )


@router.get("/metrics")
async def get_pharmacy_metrics(
    date_range: int = 7,  # days
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get pharmacy workflow metrics and statistics
    """
    try:
        storage = FHIRStorageEngine(db)
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=date_range)
        
        # Get medication requests in date range
        search_params = {
            'date': f"ge{start_date.strftime('%Y-%m-%d')}"
        }
        
        resources, total = await storage.search_resources('MedicationRequest', search_params)
        requests = resources
        
        # Calculate metrics
        total_requests = len(requests)
        
        status_counts = {}
        pharmacy_status_counts = {}
        
        for request in requests:
            # Skip if not a dict (shouldn't happen but defensive)
            if not isinstance(request, dict):
                continue
                
            # Medication request status
            req_status = request.get('status', 'unknown')
            status_counts[req_status] = status_counts.get(req_status, 0) + 1
            
            # Pharmacy status (from extension)
            pharmacy_status = _get_pharmacy_status(request)
            pharmacy_status_counts[pharmacy_status] = pharmacy_status_counts.get(pharmacy_status, 0) + 1
        
        # Get dispensed medications
        dispense_resources, dispense_total = await storage.search_resources('MedicationDispense', {
            'whenhandedover': f"ge{start_date.strftime('%Y-%m-%d')}"
        })
        dispensed_count = len(dispense_resources)
        
        return {
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "days": date_range
            },
            "metrics": {
                "total_requests": total_requests,
                "dispensed_medications": dispensed_count,
                "completion_rate": (dispensed_count / total_requests * 100) if total_requests > 0 else 0,
                "status_breakdown": status_counts,
                "pharmacy_status_breakdown": pharmacy_status_counts
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve pharmacy metrics: {str(e)}"
        )


@router.get("/inventory/check/{medication_code}")
async def check_medication_inventory(
    medication_code: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Check medication inventory levels (mock implementation)
    """
    # This would integrate with actual pharmacy inventory system
    # For demo purposes, return mock data
    
    mock_inventory = {
        "medication_code": medication_code,
        "medication_name": "Sample Medication",
        "current_stock": 150,
        "minimum_stock": 50,
        "unit": "tablets",
        "lot_numbers": [
            {
                "lot": "LOT123456",
                "quantity": 75,
                "expiration": "2025-12-31"
            },
            {
                "lot": "LOT789012",
                "quantity": 75,
                "expiration": "2026-06-30"
            }
        ],
        "status": "in_stock",
        "last_updated": datetime.now().isoformat()
    }
    
    return mock_inventory


def _build_pharmacy_queue_item(medication_request: Dict[str, Any]) -> PharmacyQueueItem:
    """Build a pharmacy queue item from a MedicationRequest resource"""
    
    # Extract basic information
    patient_ref = medication_request.get('subject', {}).get('reference', '')
    patient_id = patient_ref.replace('Patient/', '') if patient_ref.startswith('Patient/') else ''
    
    medication_name = (
        medication_request.get('medicationCodeableConcept', {}).get('text') or
        medication_request.get('medicationCodeableConcept', {}).get('coding', [{}])[0].get('display') or
        'Unknown Medication'
    )
    
    quantity_info = medication_request.get('dispenseRequest', {}).get('quantity', {})
    quantity = quantity_info.get('value')
    unit = quantity_info.get('unit', 'units')
    
    prescribed_date = None
    if medication_request.get('authoredOn'):
        try:
            prescribed_date = datetime.fromisoformat(medication_request['authoredOn'].replace('Z', '+00:00'))
        except:
            pass
    
    # Get pharmacy status
    pharmacy_status = _get_pharmacy_status(medication_request)
    
    # Determine priority (1 = highest, 5 = lowest)
    priority = _calculate_priority(medication_request, pharmacy_status)
    
    # Calculate due date (for pending items)
    due_date = None
    if prescribed_date and pharmacy_status in ['pending', 'verified']:
        due_date = prescribed_date + timedelta(hours=24)  # 24 hour turnaround
    
    return PharmacyQueueItem(
        medication_request_id=medication_request['id'],
        patient_id=patient_id,
        medication_name=medication_name,
        quantity=quantity,
        unit=unit,
        status=pharmacy_status,
        priority=priority,
        prescribed_date=prescribed_date,
        due_date=due_date,
        prescriber=medication_request.get('requester', {}).get('display'),
        pharmacy_notes=_extract_pharmacy_notes(medication_request)
    )


def _get_pharmacy_status(medication_request: Dict[str, Any]) -> str:
    """Extract pharmacy status from medication request extension"""
    extensions = medication_request.get('extension', [])
    
    for ext in extensions:
        if ext.get('url') == 'http://wintehr.com/fhir/StructureDefinition/pharmacy-status':
            for sub_ext in ext.get('extension', []):
                if sub_ext.get('url') == 'status':
                    return sub_ext.get('valueString', 'pending')
    
    # Default status based on medication request status and timing
    req_status = medication_request.get('status', 'active')
    if req_status in ['completed', 'stopped', 'cancelled']:
        return 'completed'
    
    # For active requests, determine based on timing
    authored_on = medication_request.get('authoredOn')
    if authored_on:
        try:
            prescribed_date = datetime.fromisoformat(authored_on.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) - prescribed_date < timedelta(hours=1):
                return 'pending'
            else:
                return 'verified'
        except:
            pass
    
    return 'pending'


def _calculate_priority(medication_request: Dict[str, Any], pharmacy_status: str) -> int:
    """Calculate priority for pharmacy queue item"""
    
    # Start with base priority
    priority = 3  # Normal priority
    
    # Urgent/stat orders get highest priority
    if medication_request.get('priority') == 'urgent':
        priority = 1
    elif medication_request.get('priority') == 'stat':
        priority = 1
    
    # Pending items get higher priority
    if pharmacy_status == 'pending':
        priority = min(priority, 2)
    
    # Time-based priority adjustment
    authored_on = medication_request.get('authoredOn')
    if authored_on:
        try:
            prescribed_date = datetime.fromisoformat(authored_on.replace('Z', '+00:00'))
            hours_old = (datetime.now(timezone.utc) - prescribed_date).total_seconds() / 3600
            
            if hours_old > 24:  # Over 24 hours old
                priority = min(priority, 1)  # Highest priority
            elif hours_old > 12:  # Over 12 hours old
                priority = min(priority, 2)  # High priority
        except:
            pass
    
    return priority


def _extract_pharmacy_notes(medication_request: Dict[str, Any]) -> Optional[str]:
    """Extract pharmacy-specific notes from medication request"""
    notes = medication_request.get('note', [])
    
    for note in notes:
        note_text = note.get('text', '')
        if note_text.startswith('Pharmacy:'):
            return note_text.replace('Pharmacy:', '').strip()
    
    return None