"""
Anthropic Claude Provider Implementation
Uses the existing claude_integration_service
"""

import json
import logging
from typing import Dict, Any, Optional, List

from .base_provider import BaseLLMProvider, LLMProvider
from ..claude_integration_service import claude_integration_service

logger = logging.getLogger(__name__)

class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider using existing integration"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.service = claude_integration_service
        self.model = config.get('model', 'claude-3-5-sonnet-20241022')
        
    async def check_availability(self) -> Dict[str, Any]:
        """Check if Claude is available"""
        status = await self.service.get_status()
        return {
            "available": len(status.get("available_methods", [])) > 0,
            "provider": LLMProvider.ANTHROPIC,
            "model": self.model,
            "methods": status.get("available_methods", [])
        }
        
    async def complete(self, 
                      prompt: str, 
                      system_prompt: Optional[str] = None,
                      max_tokens: int = 4096,
                      temperature: float = 0.0,
                      **kwargs) -> str:
        """Generate completion using Claude"""
        # Claude combines system and user prompts
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
            
        return await self.service.complete(
            prompt=full_prompt,
            options={
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
        )
        
    async def analyze_clinical_request(self, 
                                     request: str, 
                                     context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze clinical request using Claude"""
        system_prompt = self._build_clinical_system_prompt()
        
        prompt = f"""{system_prompt}

Analyze this clinical request and create a structured response:

Request: {request}
Context: {json.dumps(context)}

Provide a JSON response with:
- intent: The clinical intent
- data_needs: Required FHIR resources
- ui_type: Appropriate UI representation
- complexity: low/medium/high

Return only valid JSON."""

        response = await self.complete(prompt, temperature=0)
        
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
        """Generate FHIR queries using Claude"""
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
        """Generate UI component using Claude"""
        data_summary = {
            "resourceCounts": {k: len(v) if isinstance(v, list) else 0 
                             for k, v in fhir_data.items()},
            "hasData": any(v for v in fhir_data.values())
        }
        
        prompt = self._build_ui_generation_prompt(specification, data_summary)
        system_prompt = self._build_clinical_system_prompt()
        
        code = await self.complete(prompt, system_prompt, temperature=0)
        
        # Clean up code (Claude usually returns clean code)
        code = code.replace("```jsx", "").replace("```javascript", "").replace("```", "")
        return code.strip()
        
    def get_model_info(self) -> Dict[str, Any]:
        """Get Claude model info"""
        return {
            "provider": "Anthropic Claude",
            "model": self.model,
            "supports_json_mode": False,
            "max_tokens": 200000  # Claude 3.5 Sonnet
        }