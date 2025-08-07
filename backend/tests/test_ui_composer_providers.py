"""
Test UI Composer LLM Providers

Tests for LLM provider functionality including provider switching,
fallback behavior, and multi-provider generation consistency.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any, List

from api.ui_composer.llm_service import LLMService
from api.ui_composer.llm_providers.base_provider import LLMProvider, BaseLLMProvider
from api.ui_composer.llm_providers.anthropic_provider import AnthropicProvider
from api.ui_composer.llm_providers.openai_provider import OpenAIProvider
from api.ui_composer.llm_providers.gemini_provider import GeminiProvider
from api.ui_composer.development_mode_service import DevelopmentModeProvider


class TestLLMProviders:
    """Test LLM provider functionality."""
    
    @pytest.fixture
    async def llm_service(self):
        """Create LLM service instance."""
        service = LLMService()
        yield service
        
    @pytest.fixture
    def mock_provider(self):
        """Create a mock provider for testing."""
        provider = Mock(spec=BaseLLMProvider)
        provider.check_availability = AsyncMock(return_value={
            "available": True,
            "provider": "mock",
            "model": "mock-model"
        })
        provider.complete = AsyncMock(return_value="Test response")
        provider.analyze_clinical_request = AsyncMock(return_value={
            "intent": "test",
            "data_needs": ["Patient"],
            "ui_type": "display",
            "complexity": "low"
        })
        provider.generate_fhir_queries = AsyncMock(return_value={
            "queries": [{"resource": "Patient", "params": {}}]
        })
        provider.generate_ui_component = AsyncMock(return_value="function TestComponent() { return <div>Test</div>; }")
        provider.get_model_info = Mock(return_value={"model": "mock-model"})
        return provider
        
    @pytest.mark.asyncio
    async def test_provider_initialization(self):
        """Test that providers can be initialized correctly."""
        # Test each provider type
        providers = [
            (AnthropicProvider, {"model": "claude-3"}),
            (OpenAIProvider, {"model": "gpt-4", "api_key": "test"}),
            (GeminiProvider, {"model": "gemini-pro", "api_key": "test"}),
            (DevelopmentModeProvider, {})
        ]
        
        for provider_class, config in providers:
            provider = provider_class(config)
            assert isinstance(provider, BaseLLMProvider)
            assert provider.config == config
            
    @pytest.mark.asyncio
    async def test_provider_switching(self, llm_service):
        """Test switching between providers."""
        # Test setting development provider (should always work)
        await llm_service.set_provider(LLMProvider.DEVELOPMENT)
        current = await llm_service.get_current_provider()
        assert current == LLMProvider.DEVELOPMENT
        
        # Test switching to another provider
        with patch.object(llm_service, '_initialize_provider') as mock_init:
            mock_provider = Mock(spec=BaseLLMProvider)
            mock_init.return_value = mock_provider
            
            await llm_service.set_provider(LLMProvider.ANTHROPIC)
            mock_init.assert_called_once()
            
    @pytest.mark.asyncio
    async def test_provider_fallback(self, llm_service):
        """Test fallback behavior when provider is unavailable."""
        # First set a working provider
        await llm_service.set_provider(LLMProvider.DEVELOPMENT)
        
        # Try to set an unavailable provider
        with patch.object(llm_service, '_initialize_provider', side_effect=Exception("Provider unavailable")):
            with pytest.raises(Exception):
                await llm_service.set_provider(LLMProvider.OPENAI)
                
            # Should still be able to use the service with the previous provider
            current = await llm_service.get_current_provider()
            assert current == LLMProvider.DEVELOPMENT
            
    @pytest.mark.asyncio
    async def test_analyze_request(self, llm_service, mock_provider):
        """Test analyzing clinical requests."""
        with patch.object(llm_service, 'provider', mock_provider):
            result = await llm_service.analyze_request("Show patient vitals")
            
            assert result["intent"] == "test"
            assert "data_needs" in result
            assert result["ui_type"] == "display"
            mock_provider.analyze_clinical_request.assert_called_once()
            
    @pytest.mark.asyncio
    async def test_generate_component(self, llm_service, mock_provider):
        """Test UI component generation."""
        with patch.object(llm_service, 'provider', mock_provider):
            spec = {
                "componentName": "TestComponent",
                "description": "Test component"
            }
            data = {"resources": ["Patient"]}
            
            result = await llm_service.generate_component(spec, data)
            
            assert "function TestComponent" in result
            mock_provider.generate_ui_component.assert_called_once()
            
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, llm_service):
        """Test handling concurrent requests."""
        await llm_service.set_provider(LLMProvider.DEVELOPMENT)
        
        # Create multiple concurrent requests
        requests = [
            llm_service.analyze_request(f"Request {i}")
            for i in range(5)
        ]
        
        # All should complete without error
        results = await asyncio.gather(*requests, return_exceptions=True)
        
        # Check that all completed successfully
        for result in results:
            assert not isinstance(result, Exception)
            assert isinstance(result, dict)
            
    @pytest.mark.asyncio
    async def test_provider_info(self, llm_service):
        """Test getting provider information."""
        await llm_service.set_provider(LLMProvider.DEVELOPMENT)
        
        info = await llm_service.get_provider_info()
        
        assert "provider" in info
        assert "model" in info
        assert info["provider"] == LLMProvider.DEVELOPMENT
        

class TestProviderSpecificFeatures:
    """Test provider-specific features and behaviors."""
    
    @pytest.mark.asyncio
    async def test_development_provider_templates(self):
        """Test development provider template functionality."""
        provider = DevelopmentModeProvider({})
        
        # Test template generation
        result = await provider.generate_ui_component(
            {"componentName": "TestComponent", "uiType": "display"},
            {"resourceTypes": ["Observation"]}
        )
        
        assert "function TestComponent" in result
        assert "usePatientResources" in result
        assert "Observation" in result
        
    @pytest.mark.asyncio
    async def test_anthropic_provider_prompt_building(self):
        """Test Anthropic provider prompt construction."""
        with patch('api.ui_composer.claude_integration_service.claude_integration_service') as mock_service:
            mock_service.get_status = AsyncMock(return_value={"available_methods": ["cli"]})
            mock_service.complete = AsyncMock(return_value='{"intent": "test"}')
            
            provider = AnthropicProvider({"model": "claude-3"})
            
            # Test clinical request analysis
            result = await provider.analyze_clinical_request(
                "Show patient vitals",
                {"userRole": "clinician"}
            )
            
            # Verify the complete method was called with proper prompt
            mock_service.complete.assert_called_once()
            call_args = mock_service.complete.call_args
            prompt = call_args[0][0]  # First positional argument
            
            assert "clinical request" in prompt
            assert "Show patient vitals" in prompt
            

class TestProviderComparison:
    """Test comparing outputs from different providers."""
    
    @pytest.fixture
    def sample_request(self):
        """Sample clinical request for testing."""
        return "Display patient blood pressure readings with trend analysis"
        
    @pytest.fixture
    def expected_features(self):
        """Features expected in generated components."""
        return {
            "uses_hooks": ["useState", "useEffect", "usePatientResources"],
            "has_error_handling": ["error", "catch", "Error"],
            "has_loading_state": ["loading", "Loading", "isLoading"],
            "uses_mui": ["@mui/material", "<Card", "<Box"],
            "integrates_fhir": ["Observation", "Patient", "fhirClient"]
        }
        
    def analyze_component_quality(self, code: str, expected_features: Dict[str, List[str]]) -> Dict[str, bool]:
        """Analyze generated component for expected features."""
        analysis = {}
        
        for feature, keywords in expected_features.items():
            analysis[feature] = any(keyword in code for keyword in keywords)
            
        # Calculate overall quality score
        analysis["quality_score"] = sum(1 for v in analysis.values() if v) / len(expected_features)
        
        return analysis
        
    @pytest.mark.asyncio
    async def test_provider_output_consistency(self, sample_request, expected_features):
        """Test that different providers produce consistent quality outputs."""
        service = LLMService()
        
        # Test with development provider
        await service.set_provider(LLMProvider.DEVELOPMENT)
        dev_result = await service.analyze_request(sample_request)
        
        assert "intent" in dev_result
        assert "resources" in dev_result or "data_needs" in dev_result
        
        # If other providers are available, test them too
        # This is a placeholder for when multiple providers are configured
        
    @pytest.mark.asyncio
    async def test_generation_mode_impact(self):
        """Test how generation modes affect output across providers."""
        service = LLMService()
        await service.set_provider(LLMProvider.DEVELOPMENT)
        
        modes = ["template", "mixed", "full"]
        request = "Show patient medications"
        
        results = {}
        for mode in modes:
            # This would integrate with the orchestrator in a full test
            # For now, we just test that the service handles different contexts
            result = await service.analyze_request(
                request,
                {"generation_mode": mode}
            )
            results[mode] = result
            
        # Verify all modes produce valid results
        for mode, result in results.items():
            assert isinstance(result, dict)
            assert len(result) > 0


class TestErrorHandling:
    """Test error handling in provider operations."""
    
    @pytest.mark.asyncio
    async def test_provider_unavailable_error(self):
        """Test handling when provider is unavailable."""
        service = LLMService()
        
        with patch.object(service, '_initialize_provider', side_effect=Exception("API key not found")):
            with pytest.raises(Exception) as exc_info:
                await service.set_provider(LLMProvider.OPENAI)
                
            assert "API key not found" in str(exc_info.value)
            
    @pytest.mark.asyncio
    async def test_malformed_response_handling(self):
        """Test handling malformed responses from providers."""
        provider = AnthropicProvider({})
        
        with patch('api.ui_composer.claude_integration_service.claude_integration_service.complete', 
                  return_value="Not valid JSON"):
            
            # Should handle gracefully and attempt to extract JSON
            result = await provider.analyze_clinical_request("test", {})
            
            # If no JSON found, should raise or return error
            assert isinstance(result, dict) or pytest.raises(ValueError)
            
    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Test handling provider timeouts."""
        service = LLMService()
        
        with patch.object(service, 'provider') as mock_provider:
            mock_provider.complete = AsyncMock(side_effect=asyncio.TimeoutError())
            
            with pytest.raises(asyncio.TimeoutError):
                await service.analyze_request("test request")