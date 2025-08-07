"""
OpenAI Provider Implementation
Supports both OpenAI API and Azure OpenAI
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from openai import AsyncOpenAI, AsyncAzureOpenAI

from .base_provider import BaseLLMProvider, LLMProvider

logger = logging.getLogger(__name__)

class OpenAIProvider(BaseLLMProvider):
    """OpenAI API provider"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        api_key = config.get('api_key') or os.environ.get('OPENAI_API_KEY')
        
        if not api_key:
            raise ValueError("OpenAI API key not provided")
            
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = config.get('model', 'gpt-4-turbo-preview')
        
    async def check_availability(self) -> Dict[str, Any]:
        """Check if OpenAI is available"""
        try:
            # Try a simple completion
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Say 'OK'"}],
                max_tokens=10
            )
            return {
                "available": True,
                "provider": LLMProvider.OPENAI,
                "model": self.model
            }
        except Exception as e:
            return {
                "available": False,
                "provider": LLMProvider.OPENAI,
                "error": str(e)
            }
            
    async def complete(self, 
                      prompt: str, 
                      system_prompt: Optional[str] = None,
                      max_tokens: int = 4096,
                      temperature: float = 0.0,
                      **kwargs) -> str:
        """Generate completion using OpenAI"""
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )
        
        return response.choices[0].message.content
        
    async def analyze_clinical_request(self, 
                                     request: str, 
                                     context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze clinical request using OpenAI"""
        system_prompt = self._build_clinical_system_prompt()
        
        prompt = f"""Analyze this clinical request and create a structured response:

Request: {request}
Context: {json.dumps(context)}

Provide a JSON response with:
- intent: The clinical intent
- data_needs: Required FHIR resources
- ui_type: Appropriate UI representation
- complexity: low/medium/high

Return only valid JSON."""

        response = await self.complete(prompt, system_prompt, temperature=0)
        
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError("Could not parse JSON from response")
            
    async def generate_fhir_queries(self, 
                                   clinical_request: str,
                                   available_resources: List[str]) -> Dict[str, Any]:
        """Generate FHIR queries using OpenAI"""
        prompt = self._build_fhir_query_prompt(clinical_request, available_resources)
        system_prompt = self._build_clinical_system_prompt()
        
        response = await self.complete(prompt, system_prompt, temperature=0)
        
        try:
            return json.loads(response)
        except:
            return {"error": "Failed to parse FHIR queries", "raw": response}
            
    async def generate_ui_component(self, 
                                   specification: Dict[str, Any],
                                   fhir_data: Dict[str, Any]) -> str:
        """Generate UI component using OpenAI"""
        data_summary = {
            "resourceCounts": {k: len(v) if isinstance(v, list) else 0 
                             for k, v in fhir_data.items()},
            "hasData": any(v for v in fhir_data.values())
        }
        
        prompt = self._build_ui_generation_prompt(specification, data_summary)
        system_prompt = self._build_clinical_system_prompt()
        
        code = await self.complete(prompt, system_prompt, temperature=0)
        
        # Clean up code
        code = code.replace("```jsx", "").replace("```javascript", "").replace("```", "")
        return code.strip()
        
    def get_model_info(self) -> Dict[str, Any]:
        """Get OpenAI model info"""
        return {
            "provider": "OpenAI",
            "model": self.model,
            "supports_json_mode": True,
            "max_tokens": 128000 if "gpt-4" in self.model else 16384
        }


class AzureOpenAIProvider(OpenAIProvider):
    """Azure OpenAI provider"""
    
    def __init__(self, config: Dict[str, Any]):
        # Don't call parent __init__ yet
        self.config = config
        self.provider_name = self.__class__.__name__
        
        # Azure specific configuration
        api_key = config.get('api_key') or os.environ.get('AZURE_OPENAI_API_KEY')
        endpoint = config.get('endpoint') or os.environ.get('AZURE_OPENAI_ENDPOINT')
        deployment = config.get('deployment_name') or os.environ.get('AZURE_OPENAI_DEPLOYMENT')
        api_version = config.get('api_version', '2024-02-01')
        
        if not all([api_key, endpoint, deployment]):
            raise ValueError("Azure OpenAI requires api_key, endpoint, and deployment_name")
            
        self.client = AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            azure_deployment=deployment,
            api_version=api_version
        )
        
        self.model = deployment  # In Azure, deployment name is used instead of model
        
    async def check_availability(self) -> Dict[str, Any]:
        """Check if Azure OpenAI is available"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Say 'OK'"}],
                max_tokens=10
            )
            return {
                "available": True,
                "provider": LLMProvider.AZURE_OPENAI,
                "deployment": self.model
            }
        except Exception as e:
            return {
                "available": False,
                "provider": LLMProvider.AZURE_OPENAI,
                "error": str(e)
            }
            
    def get_model_info(self) -> Dict[str, Any]:
        """Get Azure OpenAI model info"""
        return {
            "provider": "Azure OpenAI",
            "deployment": self.model,
            "supports_json_mode": True,
            "api_version": self.client._api_version
        }