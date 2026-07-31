"""
FlowsheetService tests — the module-platform pilot (docs/MODULES.md).

The load-bearing behavior is READ TOLERANCE: real data stores the same
vital under different shapes (Synthea writes blood pressure as an 85354-9
panel with components; SpO2 appears as 2708-6 or 59408-5). A flowsheet
that only read canonical codes would render existing patients as empty —
the dishonest-empty-grid failure mode.

Same injection pattern as pharmacy/orders: fake HAPI client, no patch().
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from api.clinical.flowsheets.models import FlowsheetEntryCreate, RecordEntriesRequest
from api.clinical.flowsheets.service import FlowsheetService

WINDOW_START = datetime(2026, 7, 30, 0, 0, tzinfo=timezone.utc)
WINDOW_END = datetime(2026, 7, 31, 0, 0, tzinfo=timezone.utc)


class FakeHAPI:
    def __init__(self, bundle=None):
        self._bundle = bundle or {"entry": []}
        self.searches = []
        self.created = []

    async def search(self, resource_type, params):
        self.searches.append((resource_type, params))
        return self._bundle

    async def create(self, resource_type, resource):
        self.created.append((resource_type, resource))
        return {**resource, "id": f"obs-{len(self.created)}"}


def _obs(obs_id, code, value, unit="x", time="2026-07-30T08:00:00Z"):
    return {"resource": {
        "resourceType": "Observation",
        "id": obs_id,
        "status": "final",
        "code": {"coding": [{"system": "http://loinc.org", "code": code}]},
        "effectiveDateTime": time,
        "valueQuantity": {"value": value, "unit": unit},
    }}


def _bp_panel(obs_id, systolic, diastolic, time="2026-07-30T08:00:00Z"):
    """The shape Synthea actually writes: one 85354-9 panel, two components."""
    return {"resource": {
        "resourceType": "Observation",
        "id": obs_id,
        "status": "final",
        "code": {"coding": [{"code": "85354-9"}]},
        "effectiveDateTime": time,
        "component": [
            {"code": {"coding": [{"code": "8480-6"}]},
             "valueQuantity": {"value": systolic, "unit": "mm[Hg]"}},
            {"code": {"coding": [{"code": "8462-4"}]},
             "valueQuantity": {"value": diastolic, "unit": "mm[Hg]"}},
        ],
    }}


async def _rows(hapi):
    svc = FlowsheetService(hapi_client=hapi)
    data = await svc.get_flowsheet(
        patient_id="p1", template_id="vitals",
        window_start=WINDOW_START, window_end=WINDOW_END,
    )
    return {row.key: row for row in data.rows}


# -- Read tolerance ----------------------------------------------------------

@pytest.mark.asyncio
async def test_synthea_bp_panel_populates_both_pressure_rows():
    rows = await _rows(FakeHAPI({"entry": [_bp_panel("bp1", 128, 82)]}))
    assert [c.value for c in rows["bp-systolic"].entries] == [128]
    assert [c.value for c in rows["bp-diastolic"].entries] == [82]
    # Provenance names the panel, honestly
    assert rows["bp-systolic"].entries[0].source_code == "85354-9/8480-6"


@pytest.mark.asyncio
async def test_direct_and_alternate_codes_land_on_their_rows():
    rows = await _rows(FakeHAPI({"entry": [
        _obs("o1", "8867-4", 72),      # heart rate, canonical
        _obs("o2", "59408-5", 97),     # SpO2 by pulse ox — the ALTERNATE code
    ]}))
    assert [c.value for c in rows["hr"].entries] == [72]
    assert [c.value for c in rows["spo2"].entries] == [97]
    assert rows["spo2"].entries[0].source_code == "59408-5"


@pytest.mark.asyncio
async def test_observations_without_a_value_are_skipped_not_fabricated():
    no_value = _obs("o1", "8867-4", 0)
    del no_value["resource"]["valueQuantity"]
    rows = await _rows(FakeHAPI({"entry": [no_value]}))
    assert rows["hr"].entries == []


@pytest.mark.asyncio
async def test_entries_sort_by_time_within_a_row():
    rows = await _rows(FakeHAPI({"entry": [
        _obs("o2", "8867-4", 80, time="2026-07-30T12:00:00Z"),
        _obs("o1", "8867-4", 70, time="2026-07-30T06:00:00Z"),
    ]}))
    assert [c.value for c in rows["hr"].entries] == [70, 80]


@pytest.mark.asyncio
async def test_outgoing_search_is_windowed_vital_signs():
    hapi = FakeHAPI()
    await _rows(hapi)
    resource_type, params = hapi.searches[0]
    assert resource_type == "Observation"
    assert params["category"] == "vital-signs"
    assert params["patient"] == "Patient/p1"
    assert params["date"] == [
        f"ge{WINDOW_START.isoformat()}", f"le{WINDOW_END.isoformat()}",
    ]


@pytest.mark.asyncio
async def test_unknown_template_404s():
    svc = FlowsheetService(hapi_client=FakeHAPI())
    with pytest.raises(HTTPException) as exc_info:
        await svc.get_flowsheet(
            patient_id="p1", template_id="nope",
            window_start=WINDOW_START, window_end=WINDOW_END,
        )
    assert exc_info.value.status_code == 404


# -- Writes ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_record_entry_writes_a_canonical_vital_signs_observation():
    hapi = FakeHAPI()
    svc = FlowsheetService(hapi_client=hapi)

    result = await svc.record_entries(request=RecordEntriesRequest(
        patient_id="p1",
        template_id="vitals",
        entries=[FlowsheetEntryCreate(row_key="hr", value=88)],
        performer_reference="Practitioner/nurse-1",
    ))

    assert result.created == [{"row_key": "hr", "observation_id": "obs-1"}]
    _, obs = hapi.created[0]
    assert obs["code"]["coding"][0]["code"] == "8867-4"
    assert obs["category"][0]["coding"][0]["code"] == "vital-signs"
    assert obs["valueQuantity"]["value"] == 88
    assert obs["subject"] == {"reference": "Patient/p1"}
    assert obs["performer"] == [{"reference": "Practitioner/nurse-1"}]
    assert obs["status"] == "final"


@pytest.mark.asyncio
async def test_unknown_row_key_400s_before_any_write():
    hapi = FakeHAPI()
    svc = FlowsheetService(hapi_client=hapi)
    with pytest.raises(HTTPException) as exc_info:
        await svc.record_entries(request=RecordEntriesRequest(
            patient_id="p1", template_id="vitals",
            entries=[
                FlowsheetEntryCreate(row_key="hr", value=88),
                FlowsheetEntryCreate(row_key="bogus", value=1),
            ],
        ))
    assert exc_info.value.status_code == 400
    assert "bogus" in exc_info.value.detail
    assert hapi.created == []  # atomic refusal — nothing partial


@pytest.mark.asyncio
async def test_multiple_entries_create_one_observation_each():
    hapi = FakeHAPI()
    svc = FlowsheetService(hapi_client=hapi)
    result = await svc.record_entries(request=RecordEntriesRequest(
        patient_id="p1", template_id="vitals",
        entries=[
            FlowsheetEntryCreate(row_key="bp-systolic", value=130),
            FlowsheetEntryCreate(row_key="bp-diastolic", value=85),
        ],
    ))
    assert len(result.created) == 2
    codes = [obs["code"]["coding"][0]["code"] for _, obs in hapi.created]
    assert codes == ["8480-6", "8462-4"]
