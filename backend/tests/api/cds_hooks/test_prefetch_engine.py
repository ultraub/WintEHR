"""
Tests for the CDS Hooks Prefetch Engine

Tests the FHIR prefetch query execution system including:
- Template variable resolution
- Query parsing
- Parallel FHIR query execution
- Error handling for failed prefetch
- PrefetchTemplates hook-specific configurations
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any, List, Optional

from api.cds_hooks.prefetch.engine import (
    PrefetchEngine,
    PrefetchResolver,
    PrefetchTemplates,
    NoOpFHIRClient,
    get_prefetch_engine,
    execute_prefetch,
)


# ---- PrefetchTemplates Tests ----

class TestPrefetchTemplates:

    def test_get_for_patient_view(self):
        templates = PrefetchTemplates.get_for_hook("patient-view")
        assert "patient" in templates
        assert "conditions" in templates
        assert "medications" in templates
        assert "allergies" in templates
        assert "recentLabs" in templates

    def test_get_for_medication_prescribe(self):
        templates = PrefetchTemplates.get_for_hook("medication-prescribe")
        assert "patient" in templates
        assert "medications" in templates
        assert "allergies" in templates

    def test_get_for_order_select(self):
        templates = PrefetchTemplates.get_for_hook("order-select")
        assert "patient" in templates
        assert "recentOrders" in templates

    def test_get_for_encounter_start(self):
        templates = PrefetchTemplates.get_for_hook("encounter-start")
        assert "patient" in templates
        assert "encounter" in templates

    def test_get_for_encounter_discharge(self):
        templates = PrefetchTemplates.get_for_hook("encounter-discharge")
        assert "patient" in templates
        assert "encounter" in templates
        assert "medications" in templates

    def test_get_for_unknown_hook(self):
        templates = PrefetchTemplates.get_for_hook("unknown-hook")
        assert templates == {}

    def test_patient_template_format(self):
        assert "{{context.patientId}}" in PrefetchTemplates.PATIENT


# ---- PrefetchResolver Tests ----

class TestPrefetchResolver:

    def test_resolve_simple_template(self):
        template = "Patient/{{context.patientId}}"
        context = {"context": {"patientId": "123"}}
        result = PrefetchResolver.resolve_template(template, context)
        assert result == "Patient/123"

    def test_resolve_search_template(self):
        template = "MedicationRequest?patient={{context.patientId}}&status=active"
        context = {"context": {"patientId": "456"}}
        result = PrefetchResolver.resolve_template(template, context)
        assert result == "MedicationRequest?patient=456&status=active"

    def test_resolve_nested_path(self):
        template = "Patient/{{context.user.id}}"
        context = {"context": {"user": {"id": "789"}}}
        result = PrefetchResolver.resolve_template(template, context)
        assert result == "Patient/789"

    def test_resolve_missing_value(self):
        template = "Patient/{{context.missingField}}"
        context = {"context": {}}
        result = PrefetchResolver.resolve_template(template, context)
        # Missing values should leave the template unchanged
        assert "{{context.missingField}}" in result

    def test_resolve_multiple_tokens(self):
        template = "Encounter?patient={{context.patientId}}&practitioner={{context.userId}}"
        context = {"context": {"patientId": "123", "userId": "456"}}
        result = PrefetchResolver.resolve_template(template, context)
        assert result == "Encounter?patient=123&practitioner=456"

    def test_resolve_encounter_template(self):
        template = "Encounter/{{context.encounterId}}"
        context = {"context": {"encounterId": "enc-789"}}
        result = PrefetchResolver.resolve_template(template, context)
        assert result == "Encounter/enc-789"

    def test_parse_query_direct_resource(self):
        resource_path, params = PrefetchResolver.parse_query("Patient/123")
        assert resource_path == "Patient/123"
        assert params == {}

    def test_parse_query_search(self):
        resource_path, params = PrefetchResolver.parse_query(
            "Observation?patient=123&code=4548-4&_count=5"
        )
        assert resource_path == "Observation"
        assert params["patient"] == "123"
        assert params["code"] == "4548-4"
        assert params["_count"] == "5"

    def test_parse_query_no_params(self):
        resource_path, params = PrefetchResolver.parse_query("Patient")
        assert resource_path == "Patient"
        assert params == {}


# ---- PrefetchEngine Tests ----

class TestPrefetchEngine:

    @pytest.fixture
    def mock_fhir_client(self):
        client = AsyncMock()
        client.get_resource.return_value = {
            "resourceType": "Patient",
            "id": "123",
            "name": [{"family": "Test", "given": ["Patient"]}]
        }
        client.search_resources.return_value = [
            {
                "resourceType": "Observation",
                "id": "obs-1",
                "code": {"text": "Potassium"},
                "valueQuantity": {"value": 4.5}
            }
        ]
        return client

    @pytest.fixture
    def engine(self, mock_fhir_client):
        return PrefetchEngine(fhir_client=mock_fhir_client)

    @pytest.mark.asyncio
    async def test_execute_empty_config(self, engine):
        result = await engine.execute_prefetch({}, {"patientId": "123"})
        assert result == {}

    @pytest.mark.asyncio
    async def test_execute_patient_prefetch(self, engine, mock_fhir_client):
        config = {"patient": "Patient/{{context.patientId}}"}
        context = {"context": {"patientId": "123"}}

        result = await engine.execute_prefetch(config, context)

        assert "patient" in result
        mock_fhir_client.get_resource.assert_called_once_with("Patient", "123")

    @pytest.mark.asyncio
    async def test_execute_search_prefetch(self, engine, mock_fhir_client):
        config = {
            "recentLabs": "Observation?patient={{context.patientId}}&category=laboratory"
        }
        context = {"context": {"patientId": "123"}}

        result = await engine.execute_prefetch(config, context)

        assert "recentLabs" in result
        mock_fhir_client.search_resources.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_multiple_prefetch(self, engine, mock_fhir_client):
        config = {
            "patient": "Patient/{{context.patientId}}",
            "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
        }
        context = {"context": {"patientId": "123"}}

        result = await engine.execute_prefetch(config, context)

        assert "patient" in result
        assert "medications" in result

    @pytest.mark.asyncio
    async def test_execute_prefetch_error_handling(self, mock_fhir_client):
        mock_fhir_client.get_resource.side_effect = Exception("FHIR server unavailable")
        engine = PrefetchEngine(fhir_client=mock_fhir_client)

        config = {"patient": "Patient/{{context.patientId}}"}
        context = {"context": {"patientId": "123"}}

        result = await engine.execute_prefetch(config, context)

        # Error should be caught and result should contain None
        assert "patient" in result
        assert result["patient"] is None

    @pytest.mark.asyncio
    async def test_search_returns_bundle(self, engine, mock_fhir_client):
        config = {"labs": "Observation?patient={{context.patientId}}"}
        context = {"context": {"patientId": "123"}}

        result = await engine.execute_prefetch(config, context)

        assert "labs" in result
        assert result["labs"]["resourceType"] == "Bundle"
        assert result["labs"]["type"] == "searchset"

    def test_get_recommended_prefetch(self, engine):
        templates = engine.get_recommended_prefetch("patient-view")
        assert "patient" in templates
        assert "conditions" in templates


# ---- NoOpFHIRClient Tests ----

class TestNoOpFHIRClient:

    @pytest.mark.asyncio
    async def test_get_resource_returns_none(self):
        client = NoOpFHIRClient()
        result = await client.get_resource("Patient", "123")
        assert result is None

    @pytest.mark.asyncio
    async def test_search_resources_returns_empty(self):
        client = NoOpFHIRClient()
        result = await client.search_resources("Observation", {"patient": "123"})
        assert result == []


# ---- Global Functions Tests ----

class TestGlobalFunctions:

    def test_get_prefetch_engine_creates_default(self):
        engine = get_prefetch_engine()
        assert isinstance(engine, PrefetchEngine)

    def test_get_prefetch_engine_with_client(self):
        mock_client = AsyncMock()
        engine = get_prefetch_engine(fhir_client=mock_client)
        assert isinstance(engine, PrefetchEngine)

    @pytest.mark.asyncio
    async def test_execute_prefetch_convenience(self):
        mock_client = AsyncMock()
        mock_client.get_resource.return_value = {
            "resourceType": "Patient",
            "id": "123"
        }

        config = {"patient": "Patient/{{context.patientId}}"}
        context = {"context": {"patientId": "123"}}

        result = await execute_prefetch(config, context, fhir_client=mock_client)
        assert "patient" in result
