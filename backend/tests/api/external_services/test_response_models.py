"""Regressions found by the Command Center Apps tab (slice 8a):

- asyncpg returns UUID columns as uuid.UUID; ExternalServiceResponse declared
  `id: str`, so every register/get/list response was a 500.
- HealthCheckResult.response_time_ms was a bare Optional[int], which Pydantic
  v2 treats as REQUIRED, so every timeout / no-URL health result was a 500.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from api.external_services.models import ExternalServiceResponse, HealthCheckResult, HealthStatus


def _row(**overrides):
    base = dict(
        id=uuid.uuid4(), name="CDS", service_type="cds_hooks", base_url="https://cds.example.org",
        auth_type="none", tags=[], version=None, description=None, fhir_resource_type=None,
        fhir_resource_id=None, status="active", health_status="unknown", last_health_check=None,
        owner_user_id="demo-admin", created_at=datetime.utcnow(), updated_at=datetime.utcnow(), last_used_at=None,
    )
    base.update(overrides)
    return base


def test_uuid_ids_from_the_database_are_accepted():
    row = _row()
    view = ExternalServiceResponse(**row)
    assert view.id == str(row["id"])
    assert ExternalServiceResponse(**_row(id="already-a-string")).id == "already-a-string"
    assert ExternalServiceResponse(**_row(fhir_resource_id=uuid.UUID(int=7))).fhir_resource_id == str(uuid.UUID(int=7))


def test_health_check_result_without_a_response_time_is_valid():
    result = HealthCheckResult(service_id="svc", status=HealthStatus.UNHEALTHY, timestamp=datetime.utcnow(), error_message="timeout")
    assert result.response_time_ms is None
