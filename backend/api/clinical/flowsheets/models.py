"""
Flowsheet request/response models.

A flowsheet is a template (ordered rows, each bound to LOINC codes) applied
to a patient + time window. Row VALUES are FHIR Observations in HAPI — this
module stores no clinical data of its own; templates are code, not data.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FlowsheetRowSpec(BaseModel):
    """One row of a flowsheet template (e.g. 'Heart rate')."""

    key: str
    label: str
    unit: Optional[str] = None
    # The LOINC code new entries are written with.
    code: str
    # All codes accepted when READING (alternates + the primary). Synthea and
    # MIMIC write the same concept under different codes (e.g. SpO2 as
    # 2708-6 or 59408-5) — reading must be tolerant, writing canonical.
    read_codes: List[str]
    # When the value arrives inside a panel Observation (e.g. blood pressure
    # 85354-9), this names (panel_code, component_code) to extract.
    panel: Optional[List[str]] = None


class FlowsheetTemplate(BaseModel):
    id: str
    name: str
    description: str
    rows: List[FlowsheetRowSpec]


class FlowsheetCell(BaseModel):
    """One charted value inside a row."""

    time: datetime
    value: float
    unit: Optional[str] = None
    observation_id: str
    # The code the source Observation actually carried (may be an alternate
    # or a panel component) — kept so the UI can show provenance honestly.
    source_code: str


class FlowsheetRowData(BaseModel):
    key: str
    label: str
    unit: Optional[str] = None
    entries: List[FlowsheetCell]


class FlowsheetData(BaseModel):
    patient_id: str
    template_id: str
    window_start: datetime
    window_end: datetime
    rows: List[FlowsheetRowData]


class FlowsheetEntryCreate(BaseModel):
    """One value to chart. row_key selects the template row (and its LOINC)."""

    row_key: str
    value: float
    effective_datetime: Optional[datetime] = Field(
        None, description="When the value was taken. Defaults to now."
    )


class RecordEntriesRequest(BaseModel):
    patient_id: str
    template_id: str
    entries: List[FlowsheetEntryCreate] = Field(..., min_length=1)
    performer_reference: Optional[str] = Field(
        None, description="Practitioner/{id} reference; defaults to the demo user"
    )


class RecordEntriesResponse(BaseModel):
    created: List[Dict[str, Any]]  # [{row_key, observation_id}]
