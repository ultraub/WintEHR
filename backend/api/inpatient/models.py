"""Inpatient census models."""

from typing import List, Optional

from pydantic import BaseModel


class CensusRow(BaseModel):
    """One admitted (or recently admitted) patient on the census board."""

    encounter_id: str
    encounter_status: str  # 'in-progress' for current census; else recent stay
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    location_display: Optional[str] = None  # ward/bed if the Encounter carries it
    encounter_class: Optional[str] = None
    encounter_type: Optional[str] = None
    admitted_at: Optional[str] = None  # Encounter.period.start (ISO)
    discharged_at: Optional[str] = None  # period.end when the stay is over
    length_of_stay_days: Optional[float] = None


class CensusResponse(BaseModel):
    # Patients admitted right now (Encounter status=in-progress, class IMP).
    current: List[CensusRow]
    # Most recent completed inpatient stays — Synthea histories rarely leave
    # encounters open, so an honest census needs this second list to teach
    # from; the UI labels the two distinctly.
    recent: List[CensusRow]
