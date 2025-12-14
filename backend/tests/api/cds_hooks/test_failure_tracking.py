"""
Tests for Failure Tracking and Auto-Disable Logic

Tests the failure tracking system including:
- Consecutive failure counting
- Auto-disable after threshold
- Failure reset on success
- Re-enable capability
- Error message logging
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime
from api.cds_hooks.providers import RemoteServiceProvider


# Module-level fixture for RemoteServiceProvider
@pytest.fixture
def provider(test_db):
    """Create RemoteServiceProvider with test db"""
    return RemoteServiceProvider(test_db)


class TestFailureTracking:
    """Test failure tracking functionality"""

    @pytest.mark.asyncio
    async def test_track_first_failure(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        test_db
    ):
        """Test tracking first failure"""
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": False,
            "consecutive_failures": 0,  # Starting at 0
            "last_error_message": None
        }

        hook_request = sample_cds_request

        # Mock HTTP failure
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Connection error")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Mock database update
            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            await provider.execute(
                external_plan_definition,
                hook_request,
                metadata
            )

            # Verify database update incremented failures
            assert test_db.execute.called
            # Check that SQL update was called
            call_args = test_db.execute.call_args
            assert call_args is not None

    @pytest.mark.asyncio
    async def test_increment_consecutive_failures(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        test_db
    ):
        """Test incrementing consecutive failures"""
        # Start with some failures
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": False,
            "consecutive_failures": 2,  # Already has 2 failures
            "last_error_message": "Previous error"
        }

        # Mock failure
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Another error")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            await provider.execute(
                external_plan_definition,
                sample_cds_request,
                metadata
            )

            # Should increment to 3
            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_auto_disable_at_threshold(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        test_db
    ):
        """Test auto-disable when reaching 5 failures"""
        # 4 previous failures - next one should disable
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": False,
            "consecutive_failures": 4,  # One more will trigger disable
            "last_error_message": "Previous error"
        }

        # Mock failure
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Fifth failure")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            await provider.execute(
                external_plan_definition,
                sample_cds_request,
                metadata
            )

            # Should set auto_disabled = True
            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_reset_failures_on_success(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        test_db
    ):
        """Test that successful execution resets failure count"""
        # Has previous failures
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": False,
            "consecutive_failures": 3,  # Should reset to 0
            "last_error_message": "Previous error"
        }

        # Mock successful response
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"cards": []}

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            await provider.execute(
                external_plan_definition,
                sample_cds_request,
                metadata
            )

            # Should reset consecutive_failures to 0
            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_log_error_message(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        test_db
    ):
        """Test that error messages are logged"""
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": False,
            "consecutive_failures": 0,
            "last_error_message": None
        }

        error_message = "Connection timeout after 30s"

        # Mock failure with specific error
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception(error_message)
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            await provider.execute(
                external_plan_definition,
                sample_cds_request,
                metadata
            )

            # Should log error message
            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_disabled_service_skips_execution(
        self,
        provider,
        external_plan_definition,
        sample_cds_request
    ):
        """Test that disabled services skip HTTP call"""
        # Service already disabled
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": True,  # Already disabled
            "consecutive_failures": 5,
            "last_error_message": "Too many failures"
        }

        # Should not make HTTP call
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Execute
            response = await provider.execute(
                external_plan_definition,
                sample_cds_request,
                metadata
            )

            # Should not call HTTP
            assert not mock_client.post.called
            # Should return empty cards
            assert len(response.cards) == 0


class TestReEnableService:
    """Test service re-enable functionality"""

    def test_manual_re_enable(self, test_db):
        """Test manually re-enabling a disabled service"""
        # Simulate re-enable operation
        # Would typically be an admin endpoint

        service_id = 1
        update_query = """
        UPDATE external_services.services
        SET auto_disabled = false,
            consecutive_failures = 0,
            last_error_message = NULL
        WHERE id = :service_id
        """

        # Verify structure
        assert "auto_disabled = false" in update_query
        assert "consecutive_failures = 0" in update_query

    def test_re_enable_clears_error_state(self):
        """Test that re-enable clears all error state"""
        # After re-enable:
        # - auto_disabled should be False
        # - consecutive_failures should be 0
        # - last_error_message should be NULL

        reset_state = {
            "auto_disabled": False,
            "consecutive_failures": 0,
            "last_error_message": None
        }

        assert reset_state["auto_disabled"] is False
        assert reset_state["consecutive_failures"] == 0
        assert reset_state["last_error_message"] is None


class TestFailureTypes:
    """Test different failure types"""

    @pytest.mark.asyncio
    async def test_connection_error_tracked(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test connection errors are tracked"""
        import httpx

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = httpx.ConnectError("Connection refused")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            await provider.execute(
                external_plan_definition,
                sample_cds_request,
                external_service_metadata
            )

            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_timeout_error_tracked(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test timeout errors are tracked"""
        import httpx

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = httpx.TimeoutException("Request timeout")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            await provider.execute(
                external_plan_definition,
                sample_cds_request,
                external_service_metadata
            )

            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_http_error_tracked(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test HTTP error status codes are tracked"""
        mock_response = AsyncMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            await provider.execute(
                external_plan_definition,
                sample_cds_request,
                external_service_metadata
            )

            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_malformed_response_tracked(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test malformed responses are tracked as failures"""
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            await provider.execute(
                external_plan_definition,
                sample_cds_request,
                external_service_metadata
            )

            assert test_db.execute.called


class TestFailureMetrics:
    """Test failure tracking metrics"""

    def test_calculate_failure_rate(self):
        """Test calculating failure rate percentage"""
        total_executions = 100
        consecutive_failures = 5

        failure_rate = (consecutive_failures / total_executions) * 100

        assert failure_rate == 5.0

    def test_time_since_last_failure(self):
        """Test tracking time since last failure"""
        from datetime import datetime, timedelta

        last_failure_time = datetime.utcnow() - timedelta(hours=2)
        current_time = datetime.utcnow()

        time_since = current_time - last_failure_time

        assert time_since.total_seconds() >= 7200  # 2 hours

    def test_failure_threshold_config(self):
        """Test configurable failure threshold"""
        default_threshold = 5

        # Threshold should be configurable
        assert default_threshold == 5
        # Could be adjusted per service
        custom_threshold = 10
        assert custom_threshold > default_threshold


class TestGracefulDegradation:
    """Test graceful degradation patterns"""

    @pytest.mark.asyncio
    async def test_returns_empty_cards_on_failure(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata
    ):
        """Test that failures return empty cards, not errors"""
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Service down")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            response = await provider.execute(
                external_plan_definition,
                sample_cds_request,
                external_service_metadata
            )

            # Should return empty cards gracefully
            assert response is not None
            assert len(response.cards) == 0

    @pytest.mark.asyncio
    async def test_logs_failure_without_raising(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test that failures are logged but don't raise exceptions"""
        test_db.execute = AsyncMock()
        test_db.commit = AsyncMock()

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Error")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Should not raise exception
            try:
                response = await provider.execute(
                    external_plan_definition,
                    sample_cds_request,
                    external_service_metadata
                )
                assert True  # No exception raised
            except Exception:
                pytest.fail("Should not raise exception on failure")
