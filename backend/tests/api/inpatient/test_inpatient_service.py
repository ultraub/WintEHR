"""InpatientService tests — census building from FHIR Encounters."""

from __future__ import annotations

import pytest

from api.inpatient.service import InpatientService


class FakeHAPI:
    """Answers Encounter searches by status param."""

    def __init__(self, by_status):
        self.by_status = by_status
        self.searches = []

    async def search(self, resource_type, params):
        self.searches.append((resource_type, dict(params)))
        return self.by_status.get(params.get("status"), {"entry": []})


def _encounter(enc_id, patient_id, *, status="in-progress", start=None, end=None,
               location=None, enc_type=None):
    resource = {
        "resourceType": "Encounter",
        "id": enc_id,
        "status": status,
        "class": {"code": "IMP"},
        "subject": {"reference": f"Patient/{patient_id}"},
        "period": {**({"start": start} if start else {}), **({"end": end} if end else {})},
    }
    if location:
        resource["location"] = [{"location": {"display": location}}]
    if enc_type:
        resource["type"] = [{"text": enc_type}]
    return {"resource": resource}


def _patient(pid, given, family):
    return {"resource": {
        "resourceType": "Patient", "id": pid,
        "name": [{"given": [given], "family": family}],
    }}


@pytest.mark.asyncio
async def test_census_joins_included_patients_and_computes_los():
    hapi = FakeHAPI({
        "in-progress": {"entry": [
            _encounter("e1", "p1", start="2026-07-30T08:00:00Z",
                       location="Ward 3 Bed 12", enc_type="Hospital admission"),
            _patient("p1", "Ada", "Lovelace"),
        ]},
        "finished": {"entry": [
            _encounter("e2", "p2", status="finished",
                       start="2026-07-01T00:00:00Z", end="2026-07-04T00:00:00Z"),
            _patient("p2", "Grace", "Hopper"),
        ]},
    })
    census = await InpatientService(hapi_client=hapi).get_census()

    assert len(census.current) == 1
    row = census.current[0]
    assert row.patient_name == "Ada Lovelace"
    assert row.location_display == "Ward 3 Bed 12"
    assert row.encounter_type == "Hospital admission"
    assert row.length_of_stay_days > 0  # open stay: LOS measured to now

    assert len(census.recent) == 1
    assert census.recent[0].patient_name == "Grace Hopper"
    assert census.recent[0].length_of_stay_days == 3.0  # closed stay: exact


@pytest.mark.asyncio
async def test_outgoing_searches_are_inpatient_class_with_includes():
    hapi = FakeHAPI({})
    await InpatientService(hapi_client=hapi).get_census(recent_limit=10)

    by_status = {p["status"]: p for _, p in hapi.searches}
    assert by_status["in-progress"]["class"] == "IMP"
    assert by_status["in-progress"]["_include"] == "Encounter:subject"
    assert by_status["finished"]["_count"] == 10
    assert by_status["finished"]["_sort"] == "-date"


@pytest.mark.asyncio
async def test_missing_fields_stay_none_never_fabricated():
    hapi = FakeHAPI({
        "in-progress": {"entry": [_encounter("e1", "p-unknown")]},
    })
    census = await InpatientService(hapi_client=hapi).get_census()
    row = census.current[0]
    assert row.patient_name is None       # no included Patient — no name invented
    assert row.location_display is None   # no location — no bed invented
    assert row.length_of_stay_days is None  # no period.start — no LOS invented


@pytest.mark.asyncio
async def test_rows_sort_most_recent_admission_first():
    hapi = FakeHAPI({
        "finished": {"entry": [
            _encounter("old", "p1", status="finished", start="2026-01-01T00:00:00Z"),
            _encounter("new", "p1", status="finished", start="2026-07-01T00:00:00Z"),
        ]},
    })
    census = await InpatientService(hapi_client=hapi).get_census()
    assert [r.encounter_id for r in census.recent] == ["new", "old"]
