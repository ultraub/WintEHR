"""
Flowsheet service — the pilot module for the pluggable-module platform
(docs/MODULES.md).

Reads: one Observation search per fetch (category=vital-signs inside the
window), then in-process mapping onto the template's rows. Reading is
tolerant — a row matches its primary LOINC, any documented alternate, or a
component inside a panel Observation (Synthea writes blood pressure as an
85354-9 panel with 8480-6/8462-4 components, not as standalone
observations).

Writes: one Observation per charted value, canonical LOINC, valueQuantity.
Deliberately individual observations (not panels) — our own reader accepts
both shapes, and individual codes are the simpler teaching example.

No custom tables: templates are code, values are FHIR.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException

from services.hapi_fhir_client import HAPIFHIRClient

from .models import (
    FlowsheetCell,
    FlowsheetData,
    FlowsheetRowData,
    FlowsheetRowSpec,
    FlowsheetTemplate,
    RecordEntriesRequest,
    RecordEntriesResponse,
)

logger = logging.getLogger(__name__)

LOINC = "http://loinc.org"
UCUM = "http://unitsofmeasure.org"
OBS_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category"

# Starter template set. Adding a template (or a row) is an edit here —
# templates are versioned with the code that interprets them, on purpose.
# Codes chosen to match what Synthea actually emits so existing patients
# show data out of the box.
FLOWSHEET_TEMPLATES: dict[str, FlowsheetTemplate] = {
    "vitals": FlowsheetTemplate(
        id="vitals",
        name="Vital Signs",
        description="Standard nursing vital-signs flowsheet",
        rows=[
            FlowsheetRowSpec(
                key="hr", label="Heart rate", unit="/min",
                code="8867-4", read_codes=["8867-4"],
            ),
            FlowsheetRowSpec(
                key="bp-systolic", label="BP systolic", unit="mm[Hg]",
                code="8480-6", read_codes=["8480-6"],
                panel=["85354-9", "8480-6"],
            ),
            FlowsheetRowSpec(
                key="bp-diastolic", label="BP diastolic", unit="mm[Hg]",
                code="8462-4", read_codes=["8462-4"],
                panel=["85354-9", "8462-4"],
            ),
            FlowsheetRowSpec(
                key="rr", label="Respiratory rate", unit="/min",
                code="9279-1", read_codes=["9279-1"],
            ),
            FlowsheetRowSpec(
                key="temp", label="Temperature", unit="Cel",
                code="8310-5", read_codes=["8310-5"],
            ),
            FlowsheetRowSpec(
                key="spo2", label="SpO2", unit="%",
                code="2708-6", read_codes=["2708-6", "59408-5"],
            ),
            FlowsheetRowSpec(
                key="pain", label="Pain score", unit="{score}",
                code="72514-3", read_codes=["72514-3"],
            ),
            FlowsheetRowSpec(
                key="weight", label="Weight", unit="kg",
                code="29463-7", read_codes=["29463-7"],
            ),
        ],
    ),
}


def _parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


class FlowsheetService:
    """Flowsheet reads/writes over HAPI FHIR (one injected client)."""

    def __init__(self, hapi_client: Optional[HAPIFHIRClient] = None):
        self.hapi = hapi_client or HAPIFHIRClient()

    # -- Templates ---------------------------------------------------------

    def list_templates(self) -> list[FlowsheetTemplate]:
        return list(FLOWSHEET_TEMPLATES.values())

    def get_template(self, template_id: str) -> FlowsheetTemplate:
        template = FLOWSHEET_TEMPLATES.get(template_id)
        if template is None:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown flowsheet template '{template_id}'. "
                       f"Available: {sorted(FLOWSHEET_TEMPLATES)}",
            )
        return template

    # -- Read --------------------------------------------------------------

    async def get_flowsheet(
        self,
        *,
        patient_id: str,
        template_id: str,
        window_start: datetime,
        window_end: datetime,
    ) -> FlowsheetData:
        template = self.get_template(template_id)

        bundle = await self.hapi.search("Observation", {
            "patient": f"Patient/{patient_id}",
            "category": "vital-signs",
            "date": [f"ge{window_start.isoformat()}", f"le{window_end.isoformat()}"],
            "_count": 500,
            "_sort": "date",
        })

        # code -> rows that read it (a code can feed at most one row here,
        # but keep the general shape — a future template may fan out).
        direct: dict[str, list[FlowsheetRowSpec]] = {}
        panels: dict[str, list[tuple[str, FlowsheetRowSpec]]] = {}
        for row in template.rows:
            for code in row.read_codes:
                direct.setdefault(code, []).append(row)
            if row.panel:
                panel_code, component_code = row.panel
                panels.setdefault(panel_code, []).append((component_code, row))

        cells: dict[str, list[FlowsheetCell]] = {row.key: [] for row in template.rows}

        for entry in (bundle or {}).get("entry") or []:
            obs = entry.get("resource") or {}
            obs_id = obs.get("id")
            time = _parse_time(obs.get("effectiveDateTime"))
            if not obs_id or time is None:
                continue
            code = ((obs.get("code") or {}).get("coding") or [{}])[0].get("code")

            # Panel observation: extract the components our rows want.
            for component_code, row in panels.get(code, []):
                for comp in obs.get("component") or []:
                    comp_code = ((comp.get("code") or {}).get("coding") or [{}])[0].get("code")
                    vq = comp.get("valueQuantity") or {}
                    if comp_code == component_code and vq.get("value") is not None:
                        cells[row.key].append(FlowsheetCell(
                            time=time,
                            value=vq["value"],
                            unit=vq.get("unit"),
                            observation_id=obs_id,
                            source_code=f"{code}/{comp_code}",
                        ))

            # Direct observation (incl. alternates).
            vq = obs.get("valueQuantity") or {}
            if code in direct and vq.get("value") is not None:
                for row in direct[code]:
                    cells[row.key].append(FlowsheetCell(
                        time=time,
                        value=vq["value"],
                        unit=vq.get("unit"),
                        observation_id=obs_id,
                        source_code=code,
                    ))

        return FlowsheetData(
            patient_id=patient_id,
            template_id=template_id,
            window_start=window_start,
            window_end=window_end,
            rows=[
                FlowsheetRowData(
                    key=row.key,
                    label=row.label,
                    unit=row.unit,
                    entries=sorted(cells[row.key], key=lambda c: c.time),
                )
                for row in template.rows
            ],
        )

    # -- Write ---------------------------------------------------------------

    async def record_entries(self, *, request: RecordEntriesRequest) -> RecordEntriesResponse:
        template = self.get_template(request.template_id)
        rows_by_key = {row.key: row for row in template.rows}

        unknown = [e.row_key for e in request.entries if e.row_key not in rows_by_key]
        if unknown:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown row key(s) {unknown} for template '{template.id}'. "
                       f"Valid keys: {sorted(rows_by_key)}",
            )

        performer = request.performer_reference or "Practitioner/demo-nurse"
        created: list[dict[str, Any]] = []

        for entry in request.entries:
            row = rows_by_key[entry.row_key]
            effective = entry.effective_datetime or datetime.now(timezone.utc)
            if effective.tzinfo is None:
                effective = effective.replace(tzinfo=timezone.utc)

            observation = {
                "resourceType": "Observation",
                "status": "final",
                "category": [{
                    "coding": [{
                        "system": OBS_CATEGORY,
                        "code": "vital-signs",
                        "display": "Vital Signs",
                    }],
                }],
                "code": {
                    "coding": [{"system": LOINC, "code": row.code, "display": row.label}],
                    "text": row.label,
                },
                "subject": {"reference": f"Patient/{request.patient_id}"},
                "effectiveDateTime": effective.isoformat(),
                "performer": [{"reference": performer}],
                "valueQuantity": {
                    "value": entry.value,
                    **({"unit": row.unit, "system": UCUM, "code": row.unit} if row.unit else {}),
                },
            }

            result = await self.hapi.create("Observation", observation)
            created.append({
                "row_key": entry.row_key,
                "observation_id": (result or {}).get("id"),
            })
            logger.info(
                "Flowsheet entry: Observation/%s %s=%s for Patient/%s",
                (result or {}).get("id"), row.code, entry.value, request.patient_id,
            )

        return RecordEntriesResponse(created=created)


def get_flowsheet_service() -> FlowsheetService:
    """FastAPI dependency — one service per request."""
    return FlowsheetService()
