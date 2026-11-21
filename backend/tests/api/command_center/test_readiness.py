"""Readiness checklist (slice 11): pure over components + env; the secret
example lists stay equal to deploy/secrets_policy.py; prod vs dev severity."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from api.command_center.models import ComponentStatus
from api.command_center.readiness import EXAMPLE_VALUES, readiness_checks

REPO = Path(__file__).resolve().parents[4]


def _c(name, status, **data):
    return ComponentStatus(name=name, status=status, detail=data.pop("detail", None), data=data)


GOOD_ENV = {
    "ENVIRONMENT": "prod", "POSTGRES_PASSWORD": "x" * 24, "JWT_SECRET_KEY": "y" * 48,
    "HAPI_ADMIN_TOKEN": "z" * 32, "WINTEHR_SETTINGS_KEY": "passphrase", "JWT_ENABLED": "false",
}
GOOD_COMPONENTS = [
    _c("fhir", "ok", patient_count=130), _c("terminology", "ok", detail="433705 concepts indexed"),
    _c("redis", "ok"), _c("host", "ok", disk_free_percent=36.0, disk_free_gb=45.0),
    _c("tls", "ok", detail="example.org: valid, 60 days left"), _c("vna", "ok"),
]


def by_id(items):
    return {i.id: i for i in items}


def test_example_value_lists_match_the_deploy_gate():
    sys.path.insert(0, str(REPO))
    try:
        from deploy.secrets_policy import EXAMPLE_VALUES as GATE
    finally:
        sys.path.remove(str(REPO))
    assert EXAMPLE_VALUES == GATE


def test_healthy_prod_box_is_all_ok_except_the_training_auth_note():
    items = by_id(readiness_checks(GOOD_COMPONENTS, GOOD_ENV, umls_key_set=True))
    statuses = {k: v.status for k, v in items.items()}
    assert statuses.pop("auth_mode") == "info"
    assert set(statuses.values()) == {"ok"}, statuses
    assert "130 synthetic patients" in items["patients"].detail
    assert "45.0 GB (36%) free" in items["disk"].detail


def test_default_secrets_fail_in_prod_and_warn_in_dev():
    env = dict(GOOD_ENV, POSTGRES_PASSWORD="emr_password", JWT_SECRET_KEY="change-this-in-production")
    prod = by_id(readiness_checks(GOOD_COMPONENTS, env))
    assert prod["postgres_password"].status == "fail" and prod["jwt_secret"].status == "fail"
    assert "openssl rand" in prod["jwt_secret"].fix
    dev = by_id(readiness_checks(GOOD_COMPONENTS, dict(env, ENVIRONMENT="development")))
    assert dev["postgres_password"].status == "warn" and dev["jwt_secret"].status == "warn"
    assert dev["environment"].status == "info" and dev["tls"].status == "skip"


def test_missing_content_and_infrastructure_are_called_out():
    comps = [_c("fhir", "ok", patient_count=0), _c("terminology", "degraded"), _c("redis", "absent"),
             _c("host", "absent"), _c("tls", "absent"), _c("vna", "absent")]
    items = by_id(readiness_checks(comps, dict(GOOD_ENV, WINTEHR_SETTINGS_KEY="", HAPI_ADMIN_TOKEN=""), umls_key_set=False))
    assert items["patients"].status == "fail" and "Synthea" in items["patients"].fix
    assert items["terminology"].status == "warn" and items["umls_key"].status == "warn"
    assert items["redis"].status == "warn" and "worker" in items["redis"].detail
    assert items["control_plane"].status == "warn" and "disk" not in items
    assert items["tls"].status == "warn" and "HTTP" in items["tls"].detail
    assert items["vna"].status == "info"
    assert items["settings_key"].status == "warn" and items["hapi_admin_token"].status == "warn"


def test_disk_thresholds_and_cert_problems():
    low = [_c("fhir", "ok", patient_count=1), _c("host", "ok", disk_free_percent=7.0, disk_free_gb=3.0),
           _c("tls", "down", detail="example.org: expired 3 days ago")]
    items = by_id(readiness_checks(low, GOOD_ENV))
    assert items["disk"].status == "fail" and items["tls"].status == "fail"
    mid = by_id(readiness_checks([_c("host", "ok", disk_free_percent=15.0, disk_free_gb=9.0)], GOOD_ENV))
    assert mid["disk"].status == "warn"
    assert by_id(readiness_checks([_c("fhir", "down")], GOOD_ENV))["patients"].status == "fail"
