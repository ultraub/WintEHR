"""
Legacy Patients API
Provides compatibility layer for frontend expecting /api/patients endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from database import get_db_session

router = APIRouter()


@router.get("/patients")
async def get_patients():
    """Get all patients - forwards to FHIR API."""
    async with httpx.AsyncClient() as client:
        response = await client.get("http://localhost:8000/fhir/R4/Patient")
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch patients")
        
        bundle = response.json()
        
        # Transform FHIR bundle to legacy format
        patients = []
        for entry in bundle.get("entry", []):
            resource = entry.get("resource", {})
            patient = {
                "id": resource.get("id"),
                "name": _format_name(resource.get("name", [])),
                "given_name": _get_given_name(resource.get("name", [])),
                "family_name": _get_family_name(resource.get("name", [])),
                "gender": resource.get("gender"),
                "birth_date": resource.get("birthDate"),
                "phone": _get_phone(resource.get("telecom", [])),
                "email": _get_email(resource.get("telecom", [])),
                "address": _format_address(resource.get("address", [])),
                "mrn": _get_mrn(resource.get("identifier", []))
            }
            patients.append(patient)
        
        return patients


@router.get("/patients/{patient_id}")
async def get_patient(patient_id: str):
    """Get a specific patient - forwards to FHIR API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"http://localhost:8000/fhir/R4/Patient/{patient_id}")
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Patient not found")
        elif response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch patient")
        
        resource = response.json()
        
        # Get recent encounters for this patient
        encounters_response = await client.get(
            f"http://localhost:8000/fhir/R4/Encounter?patient=Patient/{patient_id}&_sort=-date"
        )
        encounters = []
        if encounters_response.status_code == 200:
            bundle = encounters_response.json()
            for entry in bundle.get("entry", []):
                enc = entry.get("resource", {})
                encounters.append({
                    "id": enc.get("id"),
                    "type": _get_encounter_type(enc),
                    "date": _get_encounter_date(enc),
                    "status": enc.get("status")
                })
        
        # Transform to legacy format
        patient = {
            "id": resource.get("id"),
            "name": _format_name(resource.get("name", [])),
            "given_name": _get_given_name(resource.get("name", [])),
            "family_name": _get_family_name(resource.get("name", [])),
            "gender": resource.get("gender"),
            "birth_date": resource.get("birthDate"),
            "phone": _get_phone(resource.get("telecom", [])),
            "email": _get_email(resource.get("telecom", [])),
            "address": _format_address(resource.get("address", [])),
            "mrn": _get_mrn(resource.get("identifier", [])),
            "encounters": encounters[:5]  # Last 5 encounters
        }
        
        return patient


# Helper functions
def _format_name(names: List[dict]) -> str:
    """Format FHIR name to display string."""
    if not names:
        return "Unknown"
    
    name = names[0]  # Use first name
    given = " ".join(name.get("given", []))
    family = name.get("family", "")
    
    return f"{given} {family}".strip() or "Unknown"


def _get_given_name(names: List[dict]) -> str:
    """Extract given name."""
    if not names:
        return ""
    return " ".join(names[0].get("given", []))


def _get_family_name(names: List[dict]) -> str:
    """Extract family name."""
    if not names:
        return ""
    return names[0].get("family", "")


def _get_phone(telecoms: List[dict]) -> Optional[str]:
    """Extract phone number."""
    for telecom in telecoms:
        if telecom.get("system") == "phone":
            return telecom.get("value")
    return None


def _get_email(telecoms: List[dict]) -> Optional[str]:
    """Extract email."""
    for telecom in telecoms:
        if telecom.get("system") == "email":
            return telecom.get("value")
    return None


def _format_address(addresses: List[dict]) -> Optional[str]:
    """Format address."""
    if not addresses:
        return None
    
    addr = addresses[0]  # Use first address
    parts = []
    
    if addr.get("line"):
        parts.extend(addr["line"])
    
    if addr.get("city"):
        parts.append(addr["city"])
        
    if addr.get("state"):
        parts.append(addr["state"])
        
    if addr.get("postalCode"):
        parts.append(addr["postalCode"])
    
    return ", ".join(parts) if parts else None


def _get_mrn(identifiers: List[dict]) -> Optional[str]:
    """Extract MRN."""
    for identifier in identifiers:
        if identifier.get("type", {}).get("coding", [{}])[0].get("code") == "MR":
            return identifier.get("value")
        # Also check for common MRN systems
        if "mrn" in identifier.get("system", "").lower():
            return identifier.get("value")
    
    # If no MRN, return first identifier
    if identifiers:
        return identifiers[0].get("value")
    
    return None


def _get_encounter_type(encounter: dict) -> str:
    """Extract encounter type."""
    types = encounter.get("type", [])
    if types and types[0].get("text"):
        return types[0]["text"]
    elif types and types[0].get("coding"):
        return types[0]["coding"][0].get("display", "Unknown")
    return "Unknown"


def _get_encounter_date(encounter: dict) -> Optional[str]:
    """Extract encounter date."""
    period = encounter.get("period", {})
    return period.get("start") or encounter.get("date")