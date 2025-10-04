"""
Medication Lists Management API Router
Implements FHIR List-based medication organization and reconciliation
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

from database import get_db_session
from services.fhir_client_config import search_resources, get_resource, update_resource, create_resource

router = APIRouter(prefix="/api/clinical/medication-lists", tags=["medication-lists"])


# LOINC codes for standard medication list types
MEDICATION_LIST_CODES = {
    "current": {
        "system": "http://loinc.org",
        "code": "52471-0",
        "display": "Medication list"
    },
    "home": {
        "system": "http://loinc.org", 
        "code": "56445-0",
        "display": "Medication summary"
    },
    "discharge": {
        "system": "http://loinc.org",
        "code": "75311-1", 
        "display": "Discharge medications"
    },
    "reconciliation": {
        "system": "http://loinc.org",
        "code": "80738-8",
        "display": "Medication reconciliation"
    }
}


class MedicationListEntry(BaseModel):
    """Request model for adding medication to a list"""
    medication_request_id: str = Field(..., description="Reference to MedicationRequest resource")
    flag: Optional[str] = Field(None, description="Status flag (active, discontinued, etc)")
    note: Optional[str] = Field(None, description="Additional notes about this entry")


class MedicationListCreate(BaseModel):
    """Request model for creating a medication list"""
    patient_id: str = Field(..., description="Patient ID")
    list_type: str = Field(..., description="Type of list: current, home, discharge, reconciliation")
    encounter_id: Optional[str] = Field(None, description="Associated encounter")
    title: Optional[str] = Field(None, description="Custom title for the list")
    note: Optional[str] = Field(None, description="Additional notes")


class ReconciliationRequest(BaseModel):
    """Request model for medication reconciliation"""
    patient_id: str
    source_lists: List[str] = Field(..., description="List IDs to reconcile")
    encounter_id: Optional[str] = None
    practitioner_id: Optional[str] = None
    
    
@router.get("/{patient_id}")
async def get_patient_medication_lists(
    patient_id: str,
    list_type: Optional[str] = Query(None, description="Filter by list type"),
    status: Optional[str] = Query("current", description="List status"),
    db: AsyncSession = Depends(get_db_session)
):
    """Get all medication lists for a patient"""
    try:
        # Search for List resources for this patient via HAPI FHIR
        search_params = {
            "patient": f"Patient/{patient_id}",
            "status": status
        }

        # Add code filter if list_type specified
        if list_type:
            type_code = MEDICATION_LIST_CODES.get(list_type, {}).get("code")
            if type_code:
                search_params["code"] = type_code

        lists = search_resources("List", search_params)

        # Filter to only medication lists based on LOINC codes
        medication_lists = []
        for list_resource in lists:
            code = list_resource.get("code", {})
            if code.get("coding"):
                coding = code["coding"][0]
                # Check if it's one of our medication list types
                is_medication_list = any(
                    coding.get("code") == med_code["code"]
                    for med_code in MEDICATION_LIST_CODES.values()
                )

                if is_medication_list:
                    medication_lists.append(list_resource)

        return medication_lists
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve medication lists: {str(e)}"
        )


@router.post("")
async def create_medication_list(
    request: MedicationListCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new medication list"""
    try:
        # Get the appropriate LOINC code for the list type
        list_code = MEDICATION_LIST_CODES.get(request.list_type)
        if not list_code:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid list type: {request.list_type}"
            )

        # Build the FHIR List resource
        list_resource = {
            "resourceType": "List",
            "status": "current",
            "mode": "working" if request.list_type != "discharge" else "snapshot",
            "title": request.title or f"{request.list_type.title()} Medications",
            "code": {
                "coding": [list_code]
            },
            "subject": {
                "reference": f"Patient/{request.patient_id}"
            },
            "date": datetime.now(timezone.utc).isoformat(),
            "source": {
                "reference": "Practitioner/example"  # TODO: Get from auth context
            },
            "entry": []  # Start with empty entries
        }

        # Add encounter reference if provided
        if request.encounter_id:
            list_resource["encounter"] = {
                "reference": f"Encounter/{request.encounter_id}"
            }

        # Add note if provided
        if request.note:
            list_resource["note"] = [{
                "text": request.note
            }]

        # Create the resource via HAPI FHIR
        created_list = create_resource(list_resource)

        return {"id": created_list["id"], "resource": created_list}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create medication list: {str(e)}"
        )


@router.post("/{list_id}/entries")
async def add_medication_to_list(
    list_id: str,
    entry: MedicationListEntry,
    db: AsyncSession = Depends(get_db_session)
):
    """Add a medication to a list"""
    try:
        # Get the current list
        list_resource = get_resource("List", list_id)
        if not list_resource:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"List {list_id} not found"
            )

        # Verify it's a medication list
        code = list_resource.get("code", {})
        if not code.get("coding"):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Not a medication list"
            )

        # Create the new entry
        new_entry = {
            "item": {
                "reference": f"MedicationRequest/{entry.medication_request_id}"
            },
            "date": datetime.now(timezone.utc).isoformat()
        }

        # Add flag if provided
        if entry.flag:
            new_entry["flag"] = {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/list-item-flag",
                    "code": entry.flag
                }]
            }

        # Add note if provided
        if entry.note:
            new_entry["note"] = entry.note

        # Add to entries
        if "entry" not in list_resource:
            list_resource["entry"] = []
        list_resource["entry"].append(new_entry)

        # Update the list via HAPI FHIR
        updated_list = update_resource("List", list_id, list_resource)

        return {
            "message": "Medication added to list",
            "list_id": list_id,
            "entry_count": len(list_resource["entry"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add medication to list: {str(e)}"
        )


@router.delete("/{list_id}/entries/{medication_request_id}")
async def remove_medication_from_list(
    list_id: str,
    medication_request_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Remove a medication from a list (marks as deleted, doesn't actually remove)"""
    try:
        # Get the current list
        list_resource = get_resource("List", list_id)
        if not list_resource:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"List {list_id} not found"
            )

        # Find the entry
        entry_found = False
        for entry in list_resource.get("entry", []):
            item_ref = entry.get("item", {}).get("reference", "")
            if item_ref == f"MedicationRequest/{medication_request_id}":
                # Mark as deleted instead of removing
                entry["deleted"] = True
                entry["date"] = datetime.now(timezone.utc).isoformat()
                entry_found = True
                break

        if not entry_found:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Medication {medication_request_id} not found in list"
            )

        # Update the list via HAPI FHIR
        updated_list = update_resource("List", list_id, list_resource)

        return {
            "message": "Medication marked as deleted from list",
            "list_id": list_id,
            "medication_request_id": medication_request_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove medication from list: {str(e)}"
        )


@router.post("/reconcile")
async def reconcile_medication_lists(
    request: ReconciliationRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Perform medication reconciliation across multiple lists"""
    try:
        # Get all source lists
        source_lists = []
        all_medications = {}  # Track all unique medications

        for list_id in request.source_lists:
            list_resource = get_resource("List", list_id)
            if list_resource:
                source_lists.append(list_resource)

                # Extract medications from this list
                for entry in list_resource.get("entry", []):
                    if not entry.get("deleted", False):
                        item_ref = entry.get("item", {}).get("reference", "")
                        if item_ref:
                            # Track the medication and which lists it appears in
                            if item_ref not in all_medications:
                                all_medications[item_ref] = {
                                    "lists": [],
                                    "flags": [],
                                    "dates": []
                                }
                            all_medications[item_ref]["lists"].append(list_id)
                            if entry.get("flag"):
                                all_medications[item_ref]["flags"].append(entry["flag"])
                            if entry.get("date"):
                                all_medications[item_ref]["dates"].append(entry["date"])

        # Create reconciliation list
        reconciliation_list = {
            "resourceType": "List",
            "status": "current",
            "mode": "changes",  # Shows what changed
            "title": "Medication Reconciliation",
            "code": {
                "coding": [MEDICATION_LIST_CODES["reconciliation"]]
            },
            "subject": {
                "reference": f"Patient/{request.patient_id}"
            },
            "date": datetime.now(timezone.utc).isoformat(),
            "source": {
                "reference": "Practitioner/example"  # TODO: Get from auth context
            },
            "note": [{
                "text": f"Reconciliation of {len(source_lists)} lists"
            }],
            "entry": []
        }

        # Add encounter if provided
        if request.encounter_id:
            reconciliation_list["encounter"] = {
                "reference": f"Encounter/{request.encounter_id}"
            }

        # Build reconciliation entries
        for med_ref, med_info in all_medications.items():
            entry = {
                "item": {
                    "reference": med_ref
                },
                "date": datetime.now(timezone.utc).isoformat()
            }

            # Determine reconciliation status
            if len(med_info["lists"]) > 1:
                # Medication appears in multiple lists
                entry["flag"] = {
                    "coding": [{
                        "system": "http://example.org/reconciliation-status",
                        "code": "review-needed",
                        "display": "Review needed - appears in multiple lists"
                    }]
                }
            else:
                # Medication in single list
                entry["flag"] = {
                    "coding": [{
                        "system": "http://example.org/reconciliation-status",
                        "code": "confirmed",
                        "display": "Confirmed"
                    }]
                }

            reconciliation_list["entry"].append(entry)

        # Create the reconciliation list via HAPI FHIR
        created_list = create_resource(reconciliation_list)

        return {
            "reconciliation_list_id": created_list["id"],
            "medications_reviewed": len(all_medications),
            "source_lists_count": len(source_lists),
            "conflicts_found": sum(1 for m in all_medications.values() if len(m["lists"]) > 1)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform reconciliation: {str(e)}"
        )


@router.post("/initialize/{patient_id}")
async def initialize_patient_medication_lists(
    patient_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Initialize standard medication lists for a new patient"""
    try:
        # Check if lists already exist
        existing_lists = await get_patient_medication_lists(
            patient_id=patient_id,
            status="current",  # Provide default status
            db=db
        )

        if existing_lists:
            return {
                "message": "Patient already has medication lists",
                "existing_lists": len(existing_lists)
            }

        # Create standard lists
        created_lists = []
        for list_type in ["current", "home"]:
            list_request = MedicationListCreate(
                patient_id=patient_id,
                list_type=list_type
            )
            result = await create_medication_list(list_request, db)
            created_lists.append(result["id"])

        return {
            "message": "Medication lists initialized",
            "created_lists": created_lists
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize medication lists: {str(e)}"
        )