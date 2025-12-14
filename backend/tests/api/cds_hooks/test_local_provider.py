"""
Tests for LocalServiceProvider

Tests the built-in service execution provider including:
- Dynamic class import and instantiation
- Service execution with prefetch
- Error handling and fallback logic
- Integration with PlanDefinition metadata
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from api.cds_hooks.providers import LocalServiceProvider
from api.cds_hooks.models import CDSHookRequest, HookType


class TestLocalServiceProvider:
    """Test suite for LocalServiceProvider"""

    @pytest.fixture
    def provider(self):
        """Create LocalServiceProvider instance"""
        return LocalServiceProvider()

    @pytest.mark.asyncio
    async def test_execute_with_valid_service(
        self,
        provider,
        sample_plan_definition,
        sample_cds_request,
        mock_local_service
    ):
        """Test successful execution with valid service class"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Mock dynamic import
        with patch('importlib.import_module') as mock_import:
            mock_module = MagicMock()
            mock_module.DiabetesScreeningService = lambda: mock_local_service
            mock_import.return_value = mock_module

            # Execute
            response = await provider.execute(
                sample_plan_definition,
                hook_request,
                None
            )

            # Verify
            assert response is not None
            assert len(response.cards) == 1
            assert response.cards[0].summary == "Test card"
            assert mock_local_service.execute.called

    @pytest.mark.asyncio
    async def test_execute_with_should_execute_false(
        self,
        provider,
        sample_plan_definition,
        sample_cds_request,
        mock_local_service
    ):
        """Test execution when should_execute returns False"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)
        mock_local_service.should_execute.return_value = False

        # Mock dynamic import
        with patch('importlib.import_module') as mock_import:
            mock_module = MagicMock()
            mock_module.DiabetesScreeningService = lambda: mock_local_service
            mock_import.return_value = mock_module

            # Execute
            response = await provider.execute(
                sample_plan_definition,
                hook_request,
                None
            )

            # Verify - should return empty cards
            assert response is not None
            assert len(response.cards) == 0
            assert not mock_local_service.execute.called

    @pytest.mark.asyncio
    async def test_execute_with_missing_python_class(
        self,
        provider,
        sample_plan_definition,
        sample_cds_request
    ):
        """Test execution when python-class extension is missing"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)
        plan_def = sample_plan_definition.copy()
        # Remove python-class extension
        plan_def["extension"] = [
            ext for ext in plan_def["extension"]
            if ext["url"] != "http://wintehr.local/fhir/StructureDefinition/python-class"
        ]

        # Execute
        response = await provider.execute(plan_def, hook_request, None)

        # Verify - should return empty cards
        assert response is not None
        assert len(response.cards) == 0

    @pytest.mark.asyncio
    async def test_execute_with_import_error(
        self,
        provider,
        sample_plan_definition,
        sample_cds_request
    ):
        """Test execution when dynamic import fails"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Mock import to raise ImportError
        with patch('importlib.import_module', side_effect=ImportError("Module not found")):
            # Execute
            response = await provider.execute(
                sample_plan_definition,
                hook_request,
                None
            )

            # Verify - should handle error gracefully
            assert response is not None
            assert len(response.cards) == 0

    @pytest.mark.asyncio
    async def test_execute_with_service_exception(
        self,
        provider,
        sample_plan_definition,
        sample_cds_request,
        mock_local_service
    ):
        """Test execution when service raises exception"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)
        mock_local_service.execute.side_effect = Exception("Service error")

        # Mock dynamic import
        with patch('importlib.import_module') as mock_import:
            mock_module = MagicMock()
            mock_module.DiabetesScreeningService = lambda: mock_local_service
            mock_import.return_value = mock_module

            # Execute
            response = await provider.execute(
                sample_plan_definition,
                hook_request,
                None
            )

            # Verify - should handle error gracefully
            assert response is not None
            assert len(response.cards) == 0

    @pytest.mark.asyncio
    async def test_execute_with_prefetch_building(
        self,
        provider,
        sample_plan_definition,
        sample_cds_request,
        mock_local_service
    ):
        """Test that prefetch is built from PlanDefinition"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Mock dynamic import
        with patch('importlib.import_module') as mock_import:
            mock_module = MagicMock()
            mock_module.DiabetesScreeningService = lambda: mock_local_service
            mock_import.return_value = mock_module

            # Execute
            await provider.execute(
                sample_plan_definition,
                hook_request,
                None
            )

            # Verify service was called with prefetch
            assert mock_local_service.execute.called
            call_args = mock_local_service.execute.call_args
            # Check that prefetch was passed
            assert "prefetch" in call_args[1] or len(call_args[0]) >= 2

    @pytest.mark.asyncio
    async def test_execute_with_context_dict(
        self,
        provider,
        sample_plan_definition,
        sample_cds_request,
        mock_local_service
    ):
        """Test execution with context as dict"""
        # Setup
        request_data = sample_cds_request.copy()
        request_data["context"] = {"patientId": "Patient/999", "custom": "value"}
        hook_request = CDSHookRequest(**request_data)

        # Mock dynamic import
        with patch('importlib.import_module') as mock_import:
            mock_module = MagicMock()
            mock_module.DiabetesScreeningService = lambda: mock_local_service
            mock_import.return_value = mock_module

            # Execute
            response = await provider.execute(
                sample_plan_definition,
                hook_request,
                None
            )

            # Verify successful execution
            assert response is not None
            assert len(response.cards) == 1

    @pytest.mark.asyncio
    async def test_dynamic_class_instantiation(
        self,
        provider,
        sample_plan_definition,
        sample_cds_request
    ):
        """Test dynamic class instantiation from module path"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Create a real test class
        class TestCDSService:
            async def should_execute(self, context, prefetch):
                return True

            async def execute(self, context, prefetch):
                return {
                    "cards": [{
                        "summary": "Dynamic class test",
                        "indicator": "info"
                    }]
                }

        # Mock import
        with patch('importlib.import_module') as mock_import:
            mock_module = MagicMock()
            mock_module.DiabetesScreeningService = TestCDSService
            mock_import.return_value = mock_module

            # Execute
            response = await provider.execute(
                sample_plan_definition,
                hook_request,
                None
            )

            # Verify
            assert response is not None
            assert len(response.cards) == 1
            assert response.cards[0].summary == "Dynamic class test"
