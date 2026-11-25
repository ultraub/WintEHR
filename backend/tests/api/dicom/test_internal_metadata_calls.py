"""Routes that call get_study_metadata as a function get the real defaults.

An unpassed Query() default is an object, and a truthy one, so a bare
get_study_metadata(study_uid) used to filter by a "series" that matched
nothing (every study 404'd) and would filter out non-image instances.
"""

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.dicom import router as dicom_router

STUDY = "1.2.826.0.1.3680043.8.498.1"
CT_SERIES = "1.2.826.0.1.3680043.8.498.2"
SR_SERIES = "1.2.826.0.1.3680043.8.498.3"


def inst(sop_class, modality, sop_uid, series):
    return {
        "00080016": {"vr": "UI", "Value": [sop_class]},
        "00080018": {"vr": "UI", "Value": [sop_uid]},
        "00080060": {"vr": "CS", "Value": [modality]},
        "0020000D": {"vr": "UI", "Value": [STUDY]},
        "0020000E": {"vr": "UI", "Value": [series]},
        "00200013": {"vr": "IS", "Value": [1]},
    }


INSTANCES = [
    inst("1.2.840.10008.5.1.4.1.1.2", "CT", "1.2.3.1", CT_SERIES),
    inst("1.2.840.10008.5.1.4.1.1.2", "CT", "1.2.3.2", CT_SERIES),
    inst("1.2.840.10008.5.1.4.1.1.88.11", "SR", "1.2.3.3", SR_SERIES),
]


@pytest.fixture
def client(monkeypatch):
    def handler(request):
        return httpx.Response(200, json=INSTANCES)

    real = httpx.AsyncClient
    monkeypatch.setattr(dicom_router, "get_dicom_http_client", lambda: real(transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(dicom_router, "_is_dicom_server_configured", lambda: True)
    monkeypatch.setattr(dicom_router, "_get_wado_url", lambda: "http://arc:8080/rs/")
    app = FastAPI()
    app.include_router(dicom_router.router)
    return TestClient(app)


def test_fhir_imaging_study_lists_every_series(client):
    response = client.get(f"/api/dicom/studies/{STUDY}/fhir-imaging-study", params={"patient_id": "p1"})
    assert response.status_code == 200
    series = {s["uid"]: len(s["instance"]) for s in response.json()["series"]}
    assert series == {CT_SERIES: 2, SR_SERIES: 1}


def test_viewer_config_keeps_every_instance(client):
    response = client.get(f"/api/dicom/studies/{STUDY}/viewer-config")
    assert response.status_code == 200
    assert [i["sopInstanceUID"] for i in response.json()["instances"]] == ["1.2.3.1", "1.2.3.2", "1.2.3.3"]


def test_viewer_config_series_filter_still_works(client):
    response = client.get(f"/api/dicom/studies/{STUDY}/viewer-config", params={"series_uid": SR_SERIES})
    assert [i["sopInstanceUID"] for i in response.json()["instances"]] == ["1.2.3.3"]


def test_validate_fhir_sees_the_instances(client):
    response = client.get(f"/api/dicom/studies/{STUDY}/validate-fhir")
    assert response.status_code == 200
    assert response.json()["summary"]["totalInstances"] == 3
