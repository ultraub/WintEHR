"""Tests for the external-service URL allow-list (SSRF guard)."""

import pytest

from api.external_services.url_policy import validate_external_url


@pytest.fixture(autouse=True)
def _clear_allowlist(monkeypatch):
    monkeypatch.delenv("EXTERNAL_SERVICES_URL_ALLOWLIST", raising=False)


def test_unset_allowlist_accepts_anything():
    validate_external_url("http://169.254.169.254/latest/meta-data")
    validate_external_url("https://anything.example")
    validate_external_url(None)


def test_allowlist_accepts_exact_and_subdomain(monkeypatch):
    monkeypatch.setenv("EXTERNAL_SERVICES_URL_ALLOWLIST", "cds.example.com,.trusted.org")
    validate_external_url("https://cds.example.com/cds-services")
    validate_external_url("https://svc.trusted.org/hooks")
    validate_external_url("https://trusted.org/hooks")


def test_allowlist_rejects_other_hosts(monkeypatch):
    monkeypatch.setenv("EXTERNAL_SERVICES_URL_ALLOWLIST", "cds.example.com")
    with pytest.raises(ValueError):
        validate_external_url("http://169.254.169.254/")
    with pytest.raises(ValueError):
        validate_external_url("https://evilcds.example.com.attacker.net/")
    # suffix must match on a dot boundary, not substring
    with pytest.raises(ValueError):
        validate_external_url("https://notcds.example.com.evil.io/")


def test_allowlist_none_url_passes(monkeypatch):
    monkeypatch.setenv("EXTERNAL_SERVICES_URL_ALLOWLIST", "cds.example.com")
    validate_external_url(None)
