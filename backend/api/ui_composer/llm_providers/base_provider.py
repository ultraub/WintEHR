"""
Base LLM Provider Interface
Defines the contract that all LLM providers must implement
"""

import json
import re
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from enum import Enum

class LLMProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    AZURE_OPENAI = "azure_openai"
    GEMINI = "gemini"
    DEVELOPMENT = "development"

class BaseLLMProvider(ABC):
    """Base class for all LLM providers"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.provider_name = self.__class__.__name__

    @abstractmethod
    async def check_availability(self) -> Dict[str, Any]:
        """Check if the provider is available and configured"""
        pass

    @abstractmethod
    async def complete(self,
                      prompt: str,
                      system_prompt: Optional[str] = None,
                      max_tokens: int = 4096,
                      temperature: float = 0.0,
                      **kwargs) -> str:
        """Generate a completion from the LLM"""
        pass

    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the model being used"""
        pass

    def _extract_json_from_response(self, response: str) -> dict:
        """Parse JSON from LLM response, stripping markdown and using regex fallback."""
        cleaned = response.strip()
        # Strip markdown code fences if present
        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            if len(parts) > 1:
                cleaned = parts[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError("Could not parse JSON from response")

    def _clean_code_response(self, code: str) -> str:
        """Strip markdown code fences from LLM-generated code."""
        cleaned = code.strip()
        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            if len(parts) > 1:
                cleaned = parts[1]
                # Remove language identifier on first line
                if cleaned.startswith(("jsx", "javascript", "js", "tsx", "typescript")):
                    cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
        return cleaned.strip()

    def _build_data_summary(self, fhir_data: Dict[str, Any]) -> dict:
        """Build resource count summary for UI generation prompts."""
        return {
            "resourceCounts": {k: len(v) if isinstance(v, list) else 0
                             for k, v in fhir_data.items()},
            "hasData": any(v for v in fhir_data.values())
        }

    async def analyze_clinical_request(self,
                                     request: str,
                                     context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a clinical request and return structured data"""
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
        return self._extract_json_from_response(response)

    async def generate_fhir_queries(self,
                                   clinical_request: str,
                                   available_resources: List[str]) -> Dict[str, Any]:
        """Generate FHIR queries from clinical request"""
        prompt = self._build_fhir_query_prompt(clinical_request, available_resources)
        system_prompt = self._build_clinical_system_prompt()

        response = await self.complete(prompt, system_prompt, temperature=0)

        try:
            return self._extract_json_from_response(response)
        except (json.JSONDecodeError, ValueError):
            return {"error": "Failed to parse FHIR queries", "raw": response}

    async def generate_ui_component(self,
                                   specification: Dict[str, Any],
                                   fhir_data: Dict[str, Any]) -> str:
        """Generate UI component code from specification and data"""
        data_summary = self._build_data_summary(fhir_data)
        prompt = self._build_ui_generation_prompt(specification, data_summary)
        system_prompt = self._build_clinical_system_prompt()

        code = await self.complete(prompt, system_prompt, temperature=0)
        return self._clean_code_response(code)

    def _build_clinical_system_prompt(self) -> str:
        """Common system prompt for clinical tasks"""
        return """You are an expert clinical informaticist and UI developer with deep knowledge of:
1. FHIR R4 data structures and query patterns
2. Clinical workflows and data relationships
3. React and Material-UI component development
4. Healthcare usability and safety standards

Your task is to interpret clinical requests and generate appropriate FHIR queries and UI components."""

    def _build_fhir_query_prompt(self, request: str, available_resources: List[str]) -> str:
        """Build prompt for FHIR query generation"""
        return f"""Given this clinical request: {request}

Available FHIR resources: {', '.join(available_resources)}

Generate a JSON object with:
1. Identified clinical intent
2. Required FHIR resources
3. Specific queries with parameters
4. Expected data relationships

Return only valid JSON."""

    def _build_ui_generation_prompt(self, spec: Dict[str, Any], data_summary: Dict[str, Any]) -> str:
        """Build prompt for UI component generation"""
        return f"""Generate a React component for this clinical UI specification:

Specification: {spec}
Available Data: {data_summary}

Requirements:
- Use Material-UI components
- Include loading and error states
- Make it accessible and responsive
- Follow healthcare UI best practices
- No console.log statements

Return only the component code."""
