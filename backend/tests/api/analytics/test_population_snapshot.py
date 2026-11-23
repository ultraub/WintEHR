"""Population snapshot: every figure counts living patients, once each."""

from datetime import date

import pytest

from api.analytics.service import (
    PopulationAnalyticsService,
    age_band,
    age_on,
    build_population_snapshot,
    burden_bucket,
    split_condition_name,
)

TODAY = date(2026, 6, 15)


def patient(pid, gender, birth, deceased=None, race=None):
    resource = {"resourceType": "Patient", "id": pid, "gender": gender, "birthDate": birth}
    if deceased:
        resource["deceasedDateTime"] = deceased
    if race:
        resource["extension"] = [{
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
            "extension": [
                {"url": "ombCategory", "valueCoding": {"code": "x", "display": race}},
                {"url": "text", "valueString": race},
            ],
        }]
    return resource


def condition(pid, code, display):
    return {
        "resourceType": "Condition",
        "subject": {"reference": f"Patient/{pid}"},
        "code": {"coding": [{"code": code, "display": display}]},
    }


def med(pid, code, display):
    return {
        "resourceType": "MedicationRequest",
        "subject": {"reference": f"Patient/{pid}"},
        "medicationCodeableConcept": {"coding": [{"code": code, "display": display}]},
    }


def snapshot(patients, conditions=(), meds=()):
    return build_population_snapshot(patients, conditions, meds, today=TODAY)


def test_age_counts_birthday_not_yet_reached():
    assert age_on(date(2000, 6, 16), TODAY) == 25
    assert age_on(date(2000, 6, 15), TODAY) == 26


def test_age_bands_and_burden_buckets_have_no_gaps():
    assert [age_band(a) for a in (0, 9, 10, 79, 80, 104)] == ["0-9", "0-9", "10-19", "70-79", "80+", "80+"]
    assert [burden_bucket(n) for n in (0, 1, 2, 3, 4, 5, 9, 10, 30)] == [
        "0", "1-2", "1-2", "3-4", "3-4", "5-9", "5-9", "10+", "10+"]


def test_condition_name_drops_semantic_tag_and_classifies():
    assert split_condition_name("Essential hypertension (disorder)") == ("Essential hypertension", "diagnosis")
    assert split_condition_name("Full-time employment (finding)") == ("Full-time employment", "context")
    assert split_condition_name("Prediabetes") == ("Prediabetes", "diagnosis")


def test_deceased_patients_are_excluded_everywhere():
    result = snapshot(
        [patient("a", "female", "1980-01-01"), patient("b", "male", "1900-01-01", deceased="1990-01-01")],
        [condition("a", "1", "Asthma (disorder)"), condition("b", "1", "Asthma (disorder)")],
        [med("b", "m1", "Drug A")],
    )
    assert result["patients"]["total"] == 1
    assert result["patients"]["deceased_excluded"] == 1
    assert result["conditions"]["items"][0]["patients"] == 1
    assert result["medications"]["active_orders"] == 0


def test_prevalence_is_share_of_patients_and_counts_each_patient_once():
    people = [patient(str(i), "female" if i % 2 else "male", "1970-01-01") for i in range(4)]
    result = snapshot(people, [
        condition("0", "1", "Asthma (disorder)"),
        condition("0", "1", "Asthma (disorder)"),  # duplicate record, same patient
        condition("1", "1", "Asthma (disorder)"),
    ])
    asthma = result["conditions"]["items"][0]
    assert (asthma["name"], asthma["patients"], asthma["share"]) == ("Asthma", 2, 50.0)


def test_race_is_read_from_the_nested_us_core_extension():
    result = snapshot([patient("a", "female", "1980-01-01", race="Asian"), patient("b", "male", "1980-01-01")])
    assert {row["label"]: row["patients"] for row in result["patients"]["race"]} == {"Asian": 1, "Not recorded": 1}


def test_pyramid_places_each_living_patient_in_one_band():
    result = snapshot([
        patient("a", "female", "2020-01-01"),
        patient("b", "male", "1940-01-01"),
        patient("c", "male", "1941-01-01"),
    ])
    rows = {row["band"]: row for row in result["patients"]["pyramid"]}
    assert rows["0-9"]["female"] == 1
    assert rows["80+"]["male"] == 2
    assert sum(r["female"] + r["male"] + r["other"] for r in rows.values()) == 3
    assert result["patients"]["median_age"] == 85


def test_medication_burden_counts_distinct_drugs_and_includes_patients_on_none():
    people = [patient("a", "female", "1950-01-01"), patient("b", "male", "1990-01-01")]
    meds = [med("a", f"m{i}", f"Drug {i}") for i in range(5)] + [med("a", "m0", "Drug 0")]
    result = snapshot(people, [], meds)
    burden = {row["bucket"]: row["patients"] for row in result["medications"]["burden"]}
    assert burden == {"0": 1, "1-2": 0, "3-4": 0, "5-9": 1, "10+": 0}
    assert result["medications"]["polypharmacy"] == {"patients": 1, "share": 50.0}
    seventies = next(r for r in result["medications"]["polypharmacy_by_band"] if r["band"] == "70-79")
    assert (seventies["patients"], seventies["of"], seventies["share"]) == (1, 1, 100.0)


def test_cohort_lists_co_occurring_diagnoses_but_not_social_context():
    people = [patient("a", "female", "1950-01-01"), patient("b", "female", "1955-01-01")]
    result = snapshot(people, [
        condition("a", "1", "Diabetes (disorder)"), condition("b", "1", "Diabetes (disorder)"),
        condition("a", "2", "Hypertension (disorder)"),
        condition("a", "3", "Stress (finding)"),
    ], [med("a", "m1", "Metformin")])
    diabetes = next(item for item in result["conditions"]["items"] if item["name"] == "Diabetes")
    assert diabetes["seen_with"] == [{"label": "Hypertension", "patients": 1, "share": 50.0}]
    assert diabetes["medications"] == [{"label": "Metformin", "patients": 1, "share": 50.0}]
    assert diabetes["median_age"] == 74


def test_empty_population_does_not_divide_by_zero():
    result = snapshot([])
    assert result["patients"]["total"] == 0
    assert result["patients"]["median_age"] is None
    assert result["medications"]["polypharmacy"]["share"] == 0.0


class PagingClient:
    """First page from search(); the rest are followed by URL."""
    base_url = "http://fhir.test/fhir"
    timeout = 5

    async def search(self, resource_type, params):
        self.params = params
        return {
            "entry": [{"resource": {"resourceType": resource_type, "id": "1"}}],
            "link": [{"relation": "next", "url": "http://other-host:8080/fhir?_getpages=abc&_getpagesoffset=1"}],
        }


@pytest.mark.asyncio
async def test_search_all_follows_next_links_on_the_configured_host(monkeypatch):
    requested = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"entry": [{"resource": {"resourceType": "Patient", "id": "2"}}]}

    class FakeHttp:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            requested.append(url)
            return FakeResponse()

    monkeypatch.setattr("api.analytics.service.httpx.AsyncClient", FakeHttp)
    service = PopulationAnalyticsService(client=PagingClient())
    resources = await service._search_all("Patient", {"_elements": "gender"})
    assert [r["id"] for r in resources] == ["1", "2"]
    assert requested == ["http://fhir.test/fhir?_getpages=abc&_getpagesoffset=1"]
