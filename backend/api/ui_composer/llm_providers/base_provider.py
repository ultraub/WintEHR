"""
Base LLM Provider Interface
Defines the contract that all LLM providers must implement
"""

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
    async def analyze_clinical_request(self, 
                                     request: str, 
                                     context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a clinical request and return structured data"""
        pass
        
    @abstractmethod
    async def generate_fhir_queries(self, 
                                   clinical_request: str,
                                   available_resources: List[str]) -> Dict[str, Any]:
        """Generate FHIR queries from clinical request"""
        pass
        
    @abstractmethod
    async def generate_ui_component(self, 
                                   specification: Dict[str, Any],
                                   fhir_data: Dict[str, Any]) -> str:
        """Generate UI component code from specification and data"""
        pass
        
    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the model being used"""
        pass
        
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