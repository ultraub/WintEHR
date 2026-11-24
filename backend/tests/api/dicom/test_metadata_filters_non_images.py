"""Study metadata with images_only=true skips SR, SEG and other non-image instances."""

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.dicom import router as dicom_router
from api.dicom.sop_classes import is_image_instance

STUDY = "1.2.826.0.1.3680043.8.498.1"


def inst(sop_class, modality, sop_uid, series="1.2.826.0.1.3680043.8.498.2"):
    item = {
        "00080018": {"vr": "UI", "Value": [sop_uid]},
        "00080060": {"vr": "CS", "Value": [modality]},
        "0020000E": {"vr": "UI", "Value": [series]},
        "00200013": {"vr": "IS", "Value": [1]},
    }
    if sop_class:
        item["00080016"] = {"vr": "UI", "Value": [sop_class]}
    return item


INSTANCES = [
    inst("1.2.840.10008.5.1.4.1.1.2", "CT", "1.2.3.1"),
    inst("1.2.840.10008.5.1.4.1.1.2", "CT", "1.2.3.2"),
    inst("1.2.840.10008.5.1.4.1.1.88.34", "SR", "1.2.3.3", series="1.2.3.90"),
    inst("1.2.840.10008.5.1.4.1.1.66.4", "SEG", "1.2.3.4", series="1.2.3.91"),
    # The class decides when there is one; the modality only when there is not.
    inst("1.2.840.10008.5.1.4.1.1.66.4", "OT", "1.2.3.5", series="1.2.3.91"),
    inst(None, "SR", "1.2.3.6", series="1.2.3.90"),
    inst("1.2.840.10008.5.1.4.1.1.7", "DOC", "1.2.3.7", series="1.2.3.92"),
]
ALL_UIDS = ["1.2.3.1", "1.2.3.2", "1.2.3.3", "1.2.3.4", "1.2.3.5", "1.2.3.6", "1.2.3.7"]


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


def test_default_keeps_every_instance(client):
    body = client.get(f"/api/dicom/studies/{STUDY}/metadata").json()
    assert [i["sopInstanceUID"] for i in body["instances"]] == ALL_UIDS
    assert body["skippedNonImage"] == 0


def test_images_only_keeps_image_instances(client):
    body = client.get(f"/api/dicom/studies/{STUDY}/metadata", params={"images_only": "true"}).json()
    assert [i["sopInstanceUID"] for i in body["instances"]] == ["1.2.3.1", "1.2.3.2", "1.2.3.7"]
    assert body["skippedNonImage"] == 4


def test_images_only_counts_within_the_series_filter(client):
    params = {"images_only": "true", "series_uid": "1.2.3.91"}
    body = client.get(f"/api/dicom/studies/{STUDY}/metadata", params=params).json()
    assert body["instances"] == []
    assert body["skippedNonImage"] == 2


@pytest.mark.parametrize("sop_class,modality,expected", [
    ("1.2.840.10008.5.1.4.1.1.2", "CT", True),
    ("1.2.840.10008.5.1.4.1.1.4", "MR", True),
    ("1.2.840.10008.5.1.4.1.1.88.22", "SR", False),
    ("1.2.840.10008.5.1.4.1.1.66.4", "SEG", False),
    ("1.2.840.10008.5.1.4.1.1.11.1", "PR", False),
    ("1.2.840.10008.5.1.4.1.1.104.1", "DOC", False),
    ("", "SEG", False),
    ("1.2.840.10008.5.1.4.1.1.88.34", "", False),
    ("1.2.840.10008.5.1.4.1.1.66.4", "OT", False),
    ("1.2.840.10008.5.1.4.1.1.2", "", True),
    ("1.2.840.10008.5.1.4.1.1.481.1", "RTIMAGE", True),
    ("1.2.840.10008.5.1.4.1.1.481.1", "", True),
    ("1.2.840.10008.5.1.4.1.1.481.10", "", False),
    ("1.2.840.10008.5.1.4.1.1.481.3", "RTSTRUCT", False),
    ("1.2.840.10008.5.1.4.1.1.66", "", False),
    ("1.2.840.10008.5.1.4.1.1.7", "DOC", True),
    ("", "CT", True),
    ("", " seg ", False),
    ("", "ECG", False),
    ("", "RTDOSE", False),
    ("", "RTRECORD", False),
    ("", "HD", False),
    ("", "EPS", False),
    ("", "AU", False),
])
def test_is_image_instance(sop_class, modality, expected):
    assert is_image_instance(sop_class, modality) is expected
