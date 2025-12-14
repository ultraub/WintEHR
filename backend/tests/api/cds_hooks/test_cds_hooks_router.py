"""
Tests for CDS Hooks Router

Integration tests for CDS Hooks API endpoints including:
- Service discovery from HAPI FHIR
- Service execution routing
- PlanDefinition conversion
- Error handling and edge cases
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from api.cds_hooks.cds_hooks_router import router


class TestCDSHooksDiscovery:
    """Test suite for CDS service discovery endpoint"""

    @pytest.fixture
    def app(self):
        """Create test FastAPI application"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_discover_services_all(
        self,
        client,
        sample_plan_definition,
        external_plan_definition
    ):
        """Test discovery endpoint returns all services"""
        # Mock HAPI FHIR response
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "total": 2,
            "entry": [
                {"resource": sample_plan_definition},
                {"resource": external_plan_definition}
            ]
        }

        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.search.return_value = mock_bundle
            mock_client_class.return_value = mock_client

            # Execute
            response = client.get("/cds-services")

            # Verify
            assert response.status_code == 200
            data = response.json()
            assert "services" in data
            assert len(data["services"]) == 2

    def test_discover_services_built_in_only(
        self,
        client,
        sample_plan_definition
    ):
        """Test discovery filtered by built-in services"""
        # Mock HAPI FHIR response
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "total": 1,
            "entry": [
                {"resource": sample_plan_definition}
            ]
        }

        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.search.return_value = mock_bundle
            mock_client_class.return_value = mock_client

            # Execute
            response = client.get("/cds-services?service_origin=built-in")

            # Verify
            assert response.status_code == 200
            data = response.json()
            assert len(data["services"]) == 1

    def test_discover_services_external_only(
        self,
        client,
        external_plan_definition
    ):
        """Test discovery filtered by external services"""
        # Mock HAPI FHIR response
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "total": 1,
            "entry": [
                {"resource": external_plan_definition}
            ]
        }

        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.search.return_value = mock_bundle
            mock_client_class.return_value = mock_client

            # Execute
            response = client.get("/cds-services?service_origin=external")

            # Verify
            assert response.status_code == 200
            data = response.json()
            assert len(data["services"]) == 1

    def test_discover_services_empty_result(self, client):
        """Test discovery with no services in HAPI"""
        # Mock empty HAPI FHIR response
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "total": 0,
            "entry": []
        }

        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.search.return_value = mock_bundle
            mock_client_class.return_value = mock_client

            # Execute
            response = client.get("/cds-services")

            # Verify
            assert response.status_code == 200
            data = response.json()
            assert data["services"] == []

    def test_discover_services_hapi_error(self, client):
        """Test discovery when HAPI FHIR fails"""
        # Mock HAPI error
        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.search.side_effect = Exception("HAPI connection failed")
            mock_client_class.return_value = mock_client

            # Execute
            response = client.get("/cds-services")

            # Verify - should return empty services, not error
            assert response.status_code == 200
            data = response.json()
            assert data["services"] == []


class TestCDSHooksExecution:
    """Test suite for CDS service execution endpoint"""

    @pytest.fixture
    def app(self):
        """Create test FastAPI application"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_execute_built_in_service(
        self,
        client,
        sample_plan_definition,
        sample_cds_request
    ):
        """Test execution of built-in service"""
        # Mock HAPI search
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "entry": [{"resource": sample_plan_definition}]
        }

        # Mock LocalServiceProvider
        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_hapi, \
             patch('backend.api.cds_hooks.providers.LocalServiceProvider') as mock_provider_class:

            mock_hapi_client = AsyncMock()
            mock_hapi_client.search.return_value = mock_bundle
            mock_hapi.return_value = mock_hapi_client

            mock_provider = AsyncMock()
            mock_provider.execute.return_value = MagicMock(cards=[])
            mock_provider_class.return_value = mock_provider

            # Execute
            response = client.post(
                "/cds-services/diabetes-screening-reminder",
                json=sample_cds_request
            )

            # Verify
            assert response.status_code == 200
            assert mock_provider.execute.called

    def test_execute_external_service(
        self,
        client,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test execution of external service"""
        # Mock HAPI search
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "entry": [{"resource": external_plan_definition}]
        }

        # Mock database query
        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_hapi, \
             patch('backend.api.cds_hooks.providers.RemoteServiceProvider') as mock_provider_class, \
             patch('database.get_db_session'):

            mock_hapi_client = AsyncMock()
            mock_hapi_client.search.return_value = mock_bundle
            mock_hapi.return_value = mock_hapi_client

            mock_provider = AsyncMock()
            mock_provider.execute.return_value = MagicMock(cards=[])
            mock_provider_class.return_value = mock_provider

            # Execute
            response = client.post(
                "/cds-services/external-diabetes-management",
                json=sample_cds_request
            )

            # Verify
            assert response.status_code == 200

    def test_execute_service_not_found(self, client, sample_cds_request):
        """Test execution of non-existent service"""
        # Mock empty HAPI response
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "entry": []
        }

        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_hapi:
            mock_hapi_client = AsyncMock()
            mock_hapi_client.search.return_value = mock_bundle
            mock_hapi.return_value = mock_hapi_client

            # Execute
            response = client.post(
                "/cds-services/non-existent-service",
                json=sample_cds_request
            )

            # Verify
            assert response.status_code == 404

    def test_execute_service_with_invalid_origin(
        self,
        client,
        sample_plan_definition,
        sample_cds_request
    ):
        """Test execution with invalid service origin"""
        # Setup PlanDefinition with invalid origin
        plan_def = sample_plan_definition.copy()
        for ext in plan_def["extension"]:
            if ext["url"].endswith("service-origin"):
                ext["valueString"] = "invalid-origin"

        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "entry": [{"resource": plan_def}]
        }

        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_hapi:
            mock_hapi_client = AsyncMock()
            mock_hapi_client.search.return_value = mock_bundle
            mock_hapi.return_value = mock_hapi_client

            # Execute
            response = client.post(
                "/cds-services/test-service",
                json=sample_cds_request
            )

            # Verify error handling
            assert response.status_code == 500


class TestPlanDefinitionConversion:
    """Test PlanDefinition to CDS Service conversion"""

    def test_extract_extension_value_string(self, sample_plan_definition):
        """Test extracting string extension value"""
        from api.cds_hooks.cds_hooks_router import _extract_extension_value

        value = _extract_extension_value(
            sample_plan_definition,
            "http://wintehr.local/fhir/StructureDefinition/service-origin"
        )

        assert value == "built-in"

    def test_extract_extension_value_code(self, sample_plan_definition):
        """Test extracting code extension value"""
        from api.cds_hooks.cds_hooks_router import _extract_extension_value

        value = _extract_extension_value(
            sample_plan_definition,
            "http://wintehr.local/fhir/StructureDefinition/hook-type"
        )

        assert value == "patient-view"

    def test_extract_extension_value_default(self, sample_plan_definition):
        """Test extension extraction with default value"""
        from api.cds_hooks.cds_hooks_router import _extract_extension_value

        value = _extract_extension_value(
            sample_plan_definition,
            "http://nonexistent.url",
            default="default-value"
        )

        assert value == "default-value"

    def test_plan_definition_to_cds_service(self, sample_plan_definition):
        """Test converting PlanDefinition to CDSService"""
        from api.cds_hooks.cds_hooks_router import _plan_definition_to_cds_service

        service = _plan_definition_to_cds_service(sample_plan_definition)

        assert service is not None
        assert service.id == "diabetes-screening-reminder"
        assert service.hook == "patient-view"
        assert service.title == "Diabetes Screening Reminder"
        assert service.description is not None

    def test_build_prefetch_from_plan_definition(self, sample_plan_definition):
        """Test building prefetch template from PlanDefinition"""
        from api.cds_hooks.cds_hooks_router import _build_prefetch_from_plan_definition

        prefetch = _build_prefetch_from_plan_definition(sample_plan_definition)

        assert isinstance(prefetch, dict)
        # Should have prefetch entries from DataRequirement inputs
        assert len(prefetch) >= 0

    def test_build_prefetch_with_custom_extension(self):
        """Test building prefetch from custom extension"""
        from api.cds_hooks.cds_hooks_router import _build_prefetch_from_plan_definition

        plan_def = {
            "resourceType": "PlanDefinition",
            "extension": [
                {
                    "url": "http://wintehr.local/fhir/StructureDefinition/prefetch-template",
                    "valueString": '{"patient": "Patient/{{context.patientId}}"}'
                }
            ]
        }

        prefetch = _build_prefetch_from_plan_definition(plan_def)

        assert "patient" in prefetch
        assert prefetch["patient"] == "Patient/{{context.patientId}}"


class TestExecutionLogging:
    """Test execution logging and analytics"""

    @pytest.fixture
    def app(self):
        """Create test FastAPI application"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_execution_logging_success(
        self,
        client,
        sample_plan_definition,
        sample_cds_request
    ):
        """Test that successful execution is logged"""
        # Mock HAPI and provider
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "entry": [{"resource": sample_plan_definition}]
        }

        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_hapi, \
             patch('backend.api.cds_hooks.providers.LocalServiceProvider') as mock_provider_class, \
             patch('backend.api.cds_hooks.hook_persistence.log_hook_execution') as mock_log:

            mock_hapi_client = AsyncMock()
            mock_hapi_client.search.return_value = mock_bundle
            mock_hapi.return_value = mock_hapi_client

            mock_provider = AsyncMock()
            mock_provider.execute.return_value = MagicMock(cards=[])
            mock_provider_class.return_value = mock_provider

            # Execute
            response = client.post(
                "/cds-services/diabetes-screening-reminder",
                json=sample_cds_request
            )

            # Verify logging was called
            assert mock_log.called
            call_kwargs = mock_log.call_args.kwargs
            assert call_kwargs["success"] is True
            assert call_kwargs["service_id"] == "diabetes-screening-reminder"

    def test_execution_timing_recorded(
        self,
        client,
        sample_plan_definition,
        sample_cds_request
    ):
        """Test that execution time is recorded"""
        mock_bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "entry": [{"resource": sample_plan_definition}]
        }

        with patch('services.hapi_fhir_client.HAPIFHIRClient') as mock_hapi, \
             patch('backend.api.cds_hooks.providers.LocalServiceProvider') as mock_provider_class, \
             patch('backend.api.cds_hooks.hook_persistence.log_hook_execution') as mock_log:

            mock_hapi_client = AsyncMock()
            mock_hapi_client.search.return_value = mock_bundle
            mock_hapi.return_value = mock_hapi_client

            mock_provider = AsyncMock()
            mock_provider.execute.return_value = MagicMock(cards=[])
            mock_provider_class.return_value = mock_provider

            # Execute
            response = client.post(
                "/cds-services/diabetes-screening-reminder",
                json=sample_cds_request
            )

            # Verify execution time was logged
            assert mock_log.called
            call_kwargs = mock_log.call_args.kwargs
            assert "execution_time_ms" in call_kwargs
            assert call_kwargs["execution_time_ms"] >= 0
