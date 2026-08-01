"""Inpatient census logic (module 'inpatient' — docs/MODULES.md, Phase 2).

Builds the census board from FHIR Encounters: currently admitted patients
(status=in-progress, class IMP) plus the most recent completed inpatient
stays. Patient names resolve from the SAME search via _include — one HAPI
round-trip per list, no N+1 reads. All data is FHIR; no custom tables.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from services.hapi_fhir_client import HAPIFHIRClient

from .models import CensusResponse, CensusRow

logger = logging.getLogger(__name__)


def _parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _human_name(patient: dict[str, Any]) -> Optional[str]:
    names = patient.get("name") or []
    if not names:
        return None
    name = names[0]
    given = " ".join(name.get("given") or [])
    return f"{given} {name.get('family', '')}".strip() or None


class InpatientService:
    """Census reads over HAPI FHIR (one injected client)."""

    def __init__(self, hapi_client: Optional[HAPIFHIRClient] = None):
        self.hapi = hapi_client or HAPIFHIRClient()

    async def get_census(self, *, recent_limit: int = 25) -> CensusResponse:
        current_bundle = await self.hapi.search("Encounter", {
            "status": "in-progress",
            "class": "IMP",
            "_include": "Encounter:subject",
            "_count": 200,
        })
        recent_bundle = await self.hapi.search("Encounter", {
            "status": "finished",
            "class": "IMP",
            "_include": "Encounter:subject",
            "_sort": "-date",
            "_count": recent_limit,
        })
        return CensusResponse(
            current=self._rows(current_bundle),
            recent=self._rows(recent_bundle),
        )

    def _rows(self, bundle: dict[str, Any]) -> list[CensusRow]:
        encounters: list[dict[str, Any]] = []
        patients: dict[str, dict[str, Any]] = {}
        for entry in (bundle or {}).get("entry") or []:
            resource = entry.get("resource") or {}
            if resource.get("resourceType") == "Encounter":
                encounters.append(resource)
            elif resource.get("resourceType") == "Patient" and resource.get("id"):
                patients[resource["id"]] = resource

        now = datetime.now(timezone.utc)
        rows = []
        for enc in encounters:
            subject_ref = (enc.get("subject") or {}).get("reference") or ""
            patient_id = subject_ref.split("/")[-1] if "/" in subject_ref else None
            patient = patients.get(patient_id, {})

            period = enc.get("period") or {}
            start = _parse_time(period.get("start"))
            end = _parse_time(period.get("end"))
            los = None
            if start:
                los = round(((end or now) - start).total_seconds() / 86400, 1)

            enc_type = (enc.get("type") or [{}])[0]
            location = (enc.get("location") or [{}])[0].get("location") or {}

            rows.append(CensusRow(
                encounter_id=enc.get("id", "?"),
                encounter_status=enc.get("status", "unknown"),
                patient_id=patient_id,
                patient_name=_human_name(patient),
                location_display=location.get("display"),
                encounter_class=(enc.get("class") or {}).get("code"),
                encounter_type=enc_type.get("text")
                or ((enc_type.get("coding") or [{}])[0].get("display")),
                admitted_at=period.get("start"),
                discharged_at=period.get("end"),
                length_of_stay_days=los,
            ))
        rows.sort(key=lambda r: r.admitted_at or "", reverse=True)
        return rows


def get_inpatient_service() -> InpatientService:
    """FastAPI dependency — one service per request."""
    return InpatientService()
