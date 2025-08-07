"""
Google Gemini Provider Implementation
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
import google.generativeai as genai

from .base_provider import BaseLLMProvider, LLMProvider

logger = logging.getLogger(__name__)

class GeminiProvider(BaseLLMProvider):
    """Google Gemini API provider"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        api_key = config.get('api_key') or os.environ.get('GEMINI_API_KEY')
        
        if not api_key:
            raise ValueError("Gemini API key not provided")
            
        genai.configure(api_key=api_key)
        self.model_name = config.get('model', 'gemini-1.5-pro')
        self.model = genai.GenerativeModel(self.model_name)
        
    async def check_availability(self) -> Dict[str, Any]:
        """Check if Gemini is available"""
        try:
            # Try a simple generation
            response = await self.model.generate_content_async("Say 'OK'")
            return {
                "available": True,
                "provider": LLMProvider.GEMINI,
                "model": self.model_name
            }
        except Exception as e:
            return {
                "available": False,
                "provider": LLMProvider.GEMINI,
                "error": str(e)
            }
            
    async def complete(self, 
                      prompt: str, 
                      system_prompt: Optional[str] = None,
                      max_tokens: int = 4096,
                      temperature: float = 0.0,
                      **kwargs) -> str:
        """Generate completion using Gemini"""
        # Gemini doesn't have separate system prompts, so combine them
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
            
        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        
        response = await self.model.generate_content_async(
            full_prompt,
            generation_config=generation_config
        )
        
        return response.text
        
    async def analyze_clinical_request(self, 
                                     request: str, 
                                     context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze clinical request using Gemini"""
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

Return only valid JSON, no markdown formatting."""

        response = await self.complete(prompt, temperature=0)
        
        try:
            # Gemini sometimes adds markdown, strip it
            response = response.strip()
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            return json.loads(response.strip())
        except json.JSONDecodeError:
            # Try to extract JSON
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError("Could not parse JSON from response")
            
    async def generate_fhir_queries(self, 
                                   clinical_request: str,
                                   available_resources: List[str]) -> Dict[str, Any]:
        """Generate FHIR queries using Gemini"""
        prompt = self._build_fhir_query_prompt(clinical_request, available_resources)
        system_prompt = self._build_clinical_system_prompt()
        
        full_prompt = f"{system_prompt}\n\n{prompt}"
        response = await self.complete(full_prompt, temperature=0)
        
        try:
            # Clean response
            response = response.strip()
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            return json.loads(response.strip())
        except:
            return {"error": "Failed to parse FHIR queries", "raw": response}
            
    async def generate_ui_component(self, 
                                   specification: Dict[str, Any],
                                   fhir_data: Dict[str, Any]) -> str:
        """Generate UI component using Gemini"""
        data_summary = {
            "resourceCounts": {k: len(v) if isinstance(v, list) else 0 
                             for k, v in fhir_data.items()},
            "hasData": any(v for v in fhir_data.values())
        }
        
        prompt = self._build_ui_generation_prompt(specification, data_summary)
        system_prompt = self._build_clinical_system_prompt()
        
        full_prompt = f"{system_prompt}\n\n{prompt}\n\nReturn only React component code, no markdown."
        code = await self.complete(full_prompt, temperature=0)
        
        # Clean up code
        code = code.strip()
        if code.startswith("```"):
            parts = code.split("```")
            if len(parts) > 1:
                code = parts[1]
                if code.startswith("jsx") or code.startswith("javascript"):
                    code = code.split("\n", 1)[1] if "\n" in code else code
                    
        return code.strip()
        
    def get_model_info(self) -> Dict[str, Any]:
        """Get Gemini model info"""
        return {
            "provider": "Google Gemini",
            "model": self.model_name,
            "supports_json_mode": False,  # Gemini doesn't have native JSON mode
            "max_tokens": 32768
        }