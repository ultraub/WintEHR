"""deploy/secrets_policy.py — the pre-deploy secret gate.

Pins the contract deploy.sh relies on: example/default secrets are errors in
prod and warnings in dev, JWT_SECRET_KEY and JWT_SECRET are interchangeable
(canonical name wins), and the prod posture warnings never become errors.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from deploy.secrets_policy import check_secrets, is_production, jwt_secret  # noqa: E402

GOOD = {
    "POSTGRES_PASSWORD": "x" * 24,
    "JWT_SECRET_KEY": "y" * 48,
    "HAPI_ADMIN_TOKEN": "z" * 32,
    "JWT_ENABLED": "true",
    "CORS_ORIGINS": "https://ehr.example.com",
    "EXTERNAL_SERVICES_URL_ALLOWLIST": "cds.example.com",
    "SMART_ALLOW_UNPROTECTED": "false",
}


def test_is_production_accepts_both_spellings():
    assert is_production("prod") and is_production("production") and is_production(" PROD ")
    assert not is_production("dev") and not is_production(None)


def test_fully_configured_prod_is_clean():
    assert check_secrets("prod", GOOD) == ([], [])


def test_jwt_secret_resolution_matches_backend():
    assert jwt_secret({"JWT_SECRET_KEY": "a", "JWT_SECRET": "b"}) == "a"
    assert jwt_secret({"JWT_SECRET": "b"}) == "b"
    assert jwt_secret({}) == ""


def test_legacy_jwt_name_alone_is_accepted():
    env = {**GOOD}
    env["JWT_SECRET"] = env.pop("JWT_SECRET_KEY")
    assert check_secrets("prod", env) == ([], [])


def test_both_jwt_names_with_different_values_warns():
    env = {**GOOD, "JWT_SECRET": "other" * 10}
    errors, warnings = check_secrets("prod", env)
    assert errors == []
    assert any("both set" in w for w in warnings)


@pytest.mark.parametrize("name,value", [
    ("POSTGRES_PASSWORD", "emr_password"),
    ("JWT_SECRET_KEY", "dev-jwt-secret-change-for-production"),
    ("JWT_SECRET_KEY", "change-this-in-production"),
])
def test_example_values_block_prod_but_only_warn_in_dev(name, value):
    env = {**GOOD, name: value}
    prod_errors, _ = check_secrets("prod", env)
    assert any(name in e and "example value" in e for e in prod_errors)
    dev_errors, dev_warnings = check_secrets("dev", env)
    assert dev_errors == []
    assert any(name in w and "example value" in w for w in dev_warnings)


def test_missing_postgres_password_is_an_error_everywhere():
    env = {k: v for k, v in GOOD.items() if k != "POSTGRES_PASSWORD"}
    for profile in ("dev", "prod"):
        errors, _ = check_secrets(profile, env)
        assert "POSTGRES_PASSWORD is not set" in errors


def test_missing_jwt_is_error_in_prod_warning_in_dev():
    env = {k: v for k, v in GOOD.items() if k != "JWT_SECRET_KEY"}
    assert any("JWT_SECRET_KEY is not set" in e for e in check_secrets("prod", env)[0])
    dev_errors, dev_warnings = check_secrets("dev", env)
    assert dev_errors == [] and any("JWT_SECRET_KEY is not set" in w for w in dev_warnings)


def test_weak_lengths_only_warn():
    env = {**GOOD, "POSTGRES_PASSWORD": "short", "JWT_SECRET_KEY": "alsoshort"}
    errors, warnings = check_secrets("prod", env)
    assert errors == []
    assert sum("weak" in w for w in warnings) == 2


def test_prod_posture_switches_warn_never_error():
    env = {k: v for k, v in GOOD.items()
           if k not in ("CORS_ORIGINS", "EXTERNAL_SERVICES_URL_ALLOWLIST", "HAPI_ADMIN_TOKEN")}
    env["JWT_ENABLED"] = "false"
    errors, warnings = check_secrets("prod", env)
    assert errors == []
    joined = "\n".join(warnings)
    for needle in ("JWT_ENABLED", "CORS_ORIGINS", "EXTERNAL_SERVICES_URL_ALLOWLIST", "HAPI_ADMIN_TOKEN"):
        assert needle in joined
    # SMART read warning only applies once JWT is actually on
    assert "SMART_ALLOW_UNPROTECTED" not in joined


def test_smart_reads_warning_when_jwt_on():
    env = {**GOOD, "SMART_ALLOW_UNPROTECTED": "true"}
    errors, warnings = check_secrets("prod", env)
    assert errors == [] and any("SMART_ALLOW_UNPROTECTED" in w for w in warnings)


def test_dev_posture_switches_are_silent():
    env = {"POSTGRES_PASSWORD": "x" * 24, "JWT_SECRET_KEY": "y" * 48, "HAPI_ADMIN_TOKEN": "t" * 32}
    assert check_secrets("dev", env) == ([], [])
