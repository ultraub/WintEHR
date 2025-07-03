"""
Legacy Encounters API
Provides compatibility layer for frontend expecting /api/encounters endpoints
"""

from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter()


@router.get("/encounters/{encounter_id}")
async def get_encounter(encounter_id: str):
    """Get a specific encounter - forwards to FHIR API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"http://localhost:8000/fhir/R4/Encounter/{encounter_id}")
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Encounter not found")
        elif response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch encounter")
        
        resource = response.json()
        
        # Transform to legacy format
        encounter = {
            "id": resource.get("id"),
            "patient_id": _extract_patient_id(resource.get("subject", {})),
            "encounter_type": _get_encounter_type(resource),
            "encounter_date": _get_encounter_date(resource),
            "encounter_class": resource.get("class", {}).get("code"),
            "status": resource.get("status"),
            "start_date": resource.get("period", {}).get("start"),
            "end_date": resource.get("period", {}).get("end"),
            "location": _get_location(resource),
            "provider": _get_provider(resource)
        }
        
        return encounter


def _extract_patient_id(subject: dict) -> str:
    """Extract patient ID from reference."""
    ref = subject.get("reference", "")
    if "/" in ref:
        return ref.split("/")[-1]
    return ref


def _get_encounter_type(encounter: dict) -> str:
    """Extract encounter type."""
    types = encounter.get("type", [])
    if types and types[0].get("text"):
        return types[0]["text"]
    elif types and types[0].get("coding"):
        return types[0]["coding"][0].get("display", "Unknown")
    return "Unknown"


def _get_encounter_date(encounter: dict) -> str:
    """Extract encounter date."""
    period = encounter.get("period", {})
    return period.get("start") or encounter.get("date", "")


def _get_location(encounter: dict) -> dict:
    """Extract location info."""
    locations = encounter.get("location", [])
    if locations and locations[0].get("location"):
        return {
            "display": locations[0]["location"].get("display", "Unknown")
        }
    return {"display": "Unknown"}


def _get_provider(encounter: dict) -> dict:
    """Extract provider info."""
    participants = encounter.get("participant", [])
    for participant in participants:
        types = participant.get("type", [])
        for ptype in types:
            if ptype.get("coding", [{}])[0].get("code") in ["ATND", "PPRF"]:
                individual = participant.get("individual", {})
                return {
                    "display": individual.get("display", "Unknown Provider")
                }
    return {"display": "Unknown Provider"}