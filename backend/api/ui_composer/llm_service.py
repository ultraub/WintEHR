"""
Unified LLM Service
Manages multiple LLM providers for UI Composer experimentation
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from .llm_providers.base_provider import BaseLLMProvider, LLMProvider
from .llm_providers.anthropic_provider import AnthropicProvider
from .llm_providers.openai_provider import OpenAIProvider, AzureOpenAIProvider
from .llm_providers.gemini_provider import GeminiProvider

logger = logging.getLogger(__name__)

class UnifiedLLMService:
    """Service for managing multiple LLM providers"""
    
    def __init__(self):
        self.providers: Dict[LLMProvider, BaseLLMProvider] = {}
        self.default_provider = LLMProvider.ANTHROPIC
        self._initialize_providers()
        
    def _initialize_providers(self):
        """Initialize available providers based on configuration"""
        
        # Try to initialize each provider
        provider_configs = {
            LLMProvider.ANTHROPIC: (AnthropicProvider, {}),
            LLMProvider.OPENAI: (OpenAIProvider, {}),
            LLMProvider.AZURE_OPENAI: (AzureOpenAIProvider, {
                # Azure requires additional config
                "deployment_name": "gpt-4"
            }),
            LLMProvider.GEMINI: (GeminiProvider, {})
        }
        
        for provider_type, (provider_class, default_config) in provider_configs.items():
            try:
                provider = provider_class(default_config)
                self.providers[provider_type] = provider
                logger.info(f"Initialized {provider_type} provider")
            except Exception as e:
                logger.warning(f"Failed to initialize {provider_type}: {e}")
                
    async def get_available_providers(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all providers"""
        status = {}
        
        for provider_type, provider in self.providers.items():
            try:
                availability = await provider.check_availability()
                status[provider_type] = availability
            except Exception as e:
                status[provider_type] = {
                    "available": False,
                    "error": str(e)
                }
                
        return status
        
    async def analyze_request_comparison(self, 
                                       request: str, 
                                       context: Dict[str, Any],
                                       providers: Optional[List[LLMProvider]] = None) -> Dict[str, Any]:
        """
        Analyze a clinical request using multiple providers for comparison
        
        This is the key experimental feature - comparing how different LLMs
        interpret the same clinical request
        """
        if providers is None:
            providers = list(self.providers.keys())
            
        results = {}
        timings = {}
        
        for provider_type in providers:
            if provider_type not in self.providers:
                results[provider_type] = {"error": "Provider not available"}
                continue
                
            provider = self.providers[provider_type]
            start_time = datetime.now()
            
            try:
                analysis = await provider.analyze_clinical_request(request, context)
                elapsed = (datetime.now() - start_time).total_seconds()
                
                results[provider_type] = {
                    "success": True,
                    "analysis": analysis,
                    "model_info": provider.get_model_info(),
                    "elapsed_seconds": elapsed
                }
                
            except Exception as e:
                elapsed = (datetime.now() - start_time).total_seconds()
                results[provider_type] = {
                    "success": False,
                    "error": str(e),
                    "elapsed_seconds": elapsed
                }
                
        return {
            "request": request,
            "context": context,
            "provider_results": results,
            "comparison_metrics": self._calculate_comparison_metrics(results)
        }
        
    async def generate_fhir_queries_comparison(self,
                                             clinical_request: str,
                                             available_resources: List[str],
                                             providers: Optional[List[LLMProvider]] = None) -> Dict[str, Any]:
        """Compare FHIR query generation across providers"""
        if providers is None:
            providers = list(self.providers.keys())
            
        results = {}
        
        for provider_type in providers:
            if provider_type not in self.providers:
                continue
                
            provider = self.providers[provider_type]
            
            try:
                queries = await provider.generate_fhir_queries(clinical_request, available_resources)
                results[provider_type] = {
                    "success": True,
                    "queries": queries
                }
            except Exception as e:
                results[provider_type] = {
                    "success": False,
                    "error": str(e)
                }
                
        return {
            "request": clinical_request,
            "available_resources": available_resources,
            "provider_results": results,
            "query_comparison": self._compare_queries(results)
        }
        
    async def generate_ui_component(self,
                                  specification: Dict[str, Any],
                                  fhir_data: Dict[str, Any],
                                  provider: LLMProvider = None) -> str:
        """Generate UI component using specified provider"""
        if provider is None:
            provider = self.default_provider
            
        if provider not in self.providers:
            # Fallback to any available provider
            for p_type, p_instance in self.providers.items():
                provider = p_type
                break
            else:
                raise ValueError("No LLM providers available")
                
        return await self.providers[provider].generate_ui_component(specification, fhir_data)
        
    async def complete_with_provider(self,
                                   prompt: str,
                                   provider: LLMProvider = None,
                                   **kwargs) -> str:
        """Direct completion using specified provider"""
        if provider is None:
            provider = self.default_provider
            
        if provider not in self.providers:
            raise ValueError(f"Provider {provider} not available")
            
        return await self.providers[provider].complete(prompt, **kwargs)
        
    def _calculate_comparison_metrics(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate metrics comparing provider responses"""
        successful_providers = [p for p, r in results.items() if r.get("success")]
        
        if len(successful_providers) < 2:
            return {"comparison_possible": False}
            
        # Extract intents from successful responses
        intents = []
        data_needs = []
        ui_types = []
        
        for provider in successful_providers:
            analysis = results[provider]["analysis"]
            intents.append(analysis.get("intent", ""))
            data_needs.append(set(analysis.get("data_needs", [])))
            ui_types.append(analysis.get("ui_type", ""))
            
        # Calculate agreement metrics
        intent_agreement = len(set(intents)) == 1
        data_needs_overlap = len(set.intersection(*data_needs)) / len(set.union(*data_needs)) if data_needs else 0
        ui_type_agreement = len(set(ui_types)) == 1
        
        # Average response time
        avg_response_time = sum(r["elapsed_seconds"] for r in results.values() if "elapsed_seconds" in r) / len(successful_providers)
        
        return {
            "comparison_possible": True,
            "providers_compared": len(successful_providers),
            "intent_agreement": intent_agreement,
            "data_needs_overlap": data_needs_overlap,
            "ui_type_agreement": ui_type_agreement,
            "average_response_time": avg_response_time,
            "fastest_provider": min(successful_providers, key=lambda p: results[p]["elapsed_seconds"])
        }
        
    def _compare_queries(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Compare FHIR queries generated by different providers"""
        successful_providers = [p for p, r in results.items() if r.get("success")]
        
        if len(successful_providers) < 2:
            return {"comparison_possible": False}
            
        # Extract resource types queried
        resource_types_by_provider = {}
        query_counts = {}
        
        for provider in successful_providers:
            queries = results[provider].get("queries", {})
            if isinstance(queries, dict):
                resources = set()
                count = 0
                
                # Handle different query structures
                if "queries" in queries:
                    for query in queries["queries"]:
                        if "resourceType" in query:
                            resources.add(query["resourceType"])
                            count += 1
                elif "resources" in queries:
                    resources.update(queries["resources"])
                    count = len(queries["resources"])
                    
                resource_types_by_provider[provider] = resources
                query_counts[provider] = count
                
        # Calculate overlap
        all_resources = list(resource_types_by_provider.values())
        if all_resources:
            common_resources = set.intersection(*all_resources) if all_resources else set()
            all_queried = set.union(*all_resources) if all_resources else set()
            overlap_ratio = len(common_resources) / len(all_queried) if all_queried else 0
        else:
            overlap_ratio = 0
            
        return {
            "comparison_possible": True,
            "providers_compared": len(successful_providers),
            "resource_overlap_ratio": overlap_ratio,
            "query_counts": query_counts,
            "resource_types_by_provider": {p: list(r) for p, r in resource_types_by_provider.items()}
        }


# Singleton instance
unified_llm_service = UnifiedLLMService()