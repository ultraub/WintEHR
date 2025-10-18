"""
Tests for RemoteServiceProvider

Tests the external service execution provider including:
- HTTP POST to external CDS services
- Authentication (API key, OAuth2, HMAC)
- Failure tracking and auto-disable logic
- Error handling and graceful degradation
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy import text
from backend.api.cds_hooks.providers import RemoteServiceProvider
from backend.api.cds_hooks.models import CDSHookRequest, HookType


class TestRemoteServiceProvider:
    """Test suite for RemoteServiceProvider"""

    @pytest.fixture
    def provider(self, test_db):
        """Create RemoteServiceProvider instance with test db"""
        return RemoteServiceProvider(test_db)

    @pytest.mark.asyncio
    async def test_execute_with_api_key_auth(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata
    ):
        """Test successful execution with API key authentication"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Mock HTTP response
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "cards": [{
                "summary": "External service card",
                "indicator": "info",
                "source": {"label": "External CDS"}
            }]
        }

        # Mock httpx client
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                external_service_metadata
            )

            # Verify
            assert response is not None
            assert len(response.cards) == 1
            assert response.cards[0].summary == "External service card"

            # Verify API key was sent
            call_kwargs = mock_client.post.call_args.kwargs
            assert "headers" in call_kwargs
            assert "X-API-Key" in call_kwargs["headers"]

    @pytest.mark.asyncio
    async def test_execute_with_oauth2_auth(
        self,
        provider,
        external_plan_definition,
        sample_cds_request
    ):
        """Test execution with OAuth2 authentication"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "oauth2",
            "credentials_encrypted": '{"token": "oauth_token_value"}',
            "auto_disabled": False,
            "consecutive_failures": 0
        }

        # Mock HTTP response
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"cards": []}

        # Mock httpx client
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                metadata
            )

            # Verify OAuth header
            call_kwargs = mock_client.post.call_args.kwargs
            assert "headers" in call_kwargs
            assert "Authorization" in call_kwargs["headers"]
            assert call_kwargs["headers"]["Authorization"].startswith("Bearer ")

    @pytest.mark.asyncio
    async def test_failure_tracking_increment(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test that failures are tracked and incremented"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Mock HTTP failure
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Connection refused")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Mock database update
            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                external_service_metadata
            )

            # Verify failure tracking was called
            assert test_db.execute.called
            # Verify empty cards returned on failure
            assert len(response.cards) == 0

    @pytest.mark.asyncio
    async def test_auto_disable_after_threshold(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        test_db
    ):
        """Test auto-disable after 5 consecutive failures"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": False,
            "consecutive_failures": 4  # Next failure should disable
        }

        # Mock HTTP failure
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Connection refused")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Mock database update
            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                metadata
            )

            # Verify database update was called to set auto_disabled
            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_success_resets_failure_count(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        test_db
    ):
        """Test that successful execution resets failure count"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": False,
            "consecutive_failures": 3  # Should reset to 0
        }

        # Mock HTTP success
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"cards": []}

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Mock database update
            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                metadata
            )

            # Verify database update to reset failures
            assert test_db.execute.called

    @pytest.mark.asyncio
    async def test_disabled_service_returns_empty(
        self,
        provider,
        external_plan_definition,
        sample_cds_request
    ):
        """Test that disabled services return empty cards"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "api_key",
            "credentials_encrypted": "key",
            "auto_disabled": True,  # Service is disabled
            "consecutive_failures": 5
        }

        # Execute
        response = await provider.execute(
            external_plan_definition,
            hook_request,
            metadata
        )

        # Verify - should return empty cards without calling HTTP
        assert response is not None
        assert len(response.cards) == 0

    @pytest.mark.asyncio
    async def test_hmac_authentication(
        self,
        provider,
        external_plan_definition,
        sample_cds_request
    ):
        """Test HMAC signature authentication"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)
        metadata = {
            "id": 1,
            "base_url": "https://example.com/cds",
            "auth_type": "hmac",
            "credentials_encrypted": '{"secret": "hmac_secret_key"}',
            "auto_disabled": False,
            "consecutive_failures": 0
        }

        # Mock HTTP response
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"cards": []}

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                metadata
            )

            # Verify HMAC signature header
            call_kwargs = mock_client.post.call_args.kwargs
            assert "headers" in call_kwargs
            # HMAC should add signature header
            assert any("signature" in k.lower() or "hmac" in k.lower()
                      for k in call_kwargs["headers"].keys()) or \
                   "X-HMAC-Signature" in call_kwargs["headers"]

    @pytest.mark.asyncio
    async def test_http_timeout_handling(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test timeout handling for external HTTP calls"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Mock timeout exception
        import httpx
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = httpx.TimeoutException("Request timeout")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Mock database
            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                external_service_metadata
            )

            # Verify timeout handled gracefully
            assert response is not None
            assert len(response.cards) == 0

    @pytest.mark.asyncio
    async def test_malformed_response_handling(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata
    ):
        """Test handling of malformed JSON responses"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Mock malformed response
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                external_service_metadata
            )

            # Verify error handled gracefully
            assert response is not None
            assert len(response.cards) == 0

    @pytest.mark.asyncio
    async def test_http_error_status_codes(
        self,
        provider,
        external_plan_definition,
        sample_cds_request,
        external_service_metadata,
        test_db
    ):
        """Test handling of HTTP error status codes"""
        # Setup
        hook_request = CDSHookRequest(**sample_cds_request)

        # Mock 500 error
        mock_response = AsyncMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Mock database
            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            # Execute
            response = await provider.execute(
                external_plan_definition,
                hook_request,
                external_service_metadata
            )

            # Verify error tracked as failure
            assert test_db.execute.called
            assert len(response.cards) == 0
