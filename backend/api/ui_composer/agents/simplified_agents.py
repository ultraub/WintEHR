"""
Simplified Agent System for UI Composer
Consolidates 9+ agents into 3 core agents with clear responsibilities
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from ..claude_integration_service import claude_integration_service

logger = logging.getLogger(__name__)

class FHIRDataAgent:
    """
    Consolidated agent for all FHIR data operations
    Combines: FHIRQueryPlannerAgent, FHIRExecutorAgent, DataContextAgent
    """
    
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        
    async def analyze_and_fetch(self, request: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze request and fetch relevant FHIR data
        Returns formatted data context for UI generation
        """
        try:
            # Step 1: Analyze request to identify needed resources
            resource_types = await self._identify_resources(request)
            
            # Step 2: Execute queries to fetch data
            data = await self._fetch_resources(resource_types, context)
            
            # Step 3: Format data for UI generation
            formatted_context = self._format_data_context(data, request)
            
            return {
                "success": True,
                "resourceTypes": resource_types,
                "data": data,
                "context": formatted_context,
                "summary": self._create_summary(data)
            }
            
        except Exception as e:
            logger.error(f"FHIR data agent error: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {},
                "context": ""
            }
            
    async def _identify_resources(self, request: str) -> List[str]:
        """Identify FHIR resources needed based on request"""
        # Common patterns
        patterns = {
            "blood pressure": ["Observation"],
            "hypertension": ["Condition", "Observation"],
            "diabetes": ["Condition", "Observation"],
            "medications": ["MedicationRequest", "MedicationStatement"],
            "allergies": ["AllergyIntolerance"],
            "labs": ["Observation", "DiagnosticReport"],
            "vitals": ["Observation"],
            "problems": ["Condition"],
            "encounters": ["Encounter"],
            "immunizations": ["Immunization"]
        }
        
        resources = set()
        request_lower = request.lower()
        
        for keyword, resource_list in patterns.items():
            if keyword in request_lower:
                resources.update(resource_list)
                
        # Default to common resources if none identified
        if not resources:
            resources = {"Observation", "Condition"}
            
        return list(resources)
        
    async def _fetch_resources(self, resource_types: List[str], context: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch FHIR resources from database"""
        from services.fhir_client_config import search_resources

        data = {}
        patient_id = context.get("patient_id")

        for resource_type in resource_types:
            try:
                # Build search params based on resource type
                params = {}
                if patient_id:
                    params["patient"] = patient_id

                # Add specific params based on resource type
                if resource_type == "Observation":
                    # Limit to recent observations
                    params["_sort"] = "-date"
                    params["_count"] = "100"

                bundle = search_resources(resource_type, params)

                # Handle bundle response format from HAPI FHIR
                if isinstance(bundle, dict) and bundle.get("entry"):
                    data[resource_type] = [
                        entry.get("resource", entry) for entry in bundle["entry"]
                    ]
                else:
                    data[resource_type] = []

            except Exception as e:
                logger.error(f"Error fetching {resource_type}: {e}")
                data[resource_type] = []

        return data
        
    def _format_data_context(self, data: Dict[str, Any], request: str) -> str:
        """Format data into context string for UI generation"""
        context_parts = [f"Request: {request}"]
        
        for resource_type, resources in data.items():
            if resources:
                context_parts.append(f"\n{resource_type}: {len(resources)} resources found")
                
                # Add sample data for context
                if len(resources) > 0 and isinstance(resources[0], dict):
                    sample = resources[0]
                    if resource_type == "Observation":
                        code = sample.get("code", {}).get("text", "Unknown")
                        value = sample.get("valueQuantity", {}).get("value", "N/A")
                        context_parts.append(f"  Example: {code} = {value}")
                    elif resource_type == "Condition":
                        code = sample.get("code", {}).get("text", "Unknown")
                        status = sample.get("clinicalStatus", {}).get("coding", [{}])[0].get("code", "unknown")
                        context_parts.append(f"  Example: {code} (status: {status})")
                        
        return "\n".join(context_parts)
        
    def _create_summary(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create summary statistics of fetched data"""
        summary = {
            "totalResources": sum(len(resources) for resources in data.values()),
            "resourceCounts": {k: len(v) for k, v in data.items()},
            "hasData": any(len(v) > 0 for v in data.values())
        }
        return summary


class UISpecificationAgent:
    """
    Consolidated agent for UI specification creation
    Combines: ui_generation_orchestrator partial functionality
    """
    
    async def create_specification(self, request: str, fhir_data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create UI specification from request and FHIR data
        """
        try:
            prompt = self._build_specification_prompt(request, fhir_data, context)
            
            response = await claude_integration_service.complete(
                prompt=prompt,
                options={
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 4096,
                    "temperature": 0
                }
            )
            
            # Parse specification from response
            spec = self._parse_specification(response)
            
            # Enhance with FHIR data insights
            spec = self._enhance_with_data(spec, fhir_data)
            
            return {
                "success": True,
                "specification": spec
            }
            
        except Exception as e:
            logger.error(f"UI specification agent error: {e}")
            return {
                "success": False,
                "error": str(e),
                "specification": self._get_fallback_spec(request)
            }
            
    def _build_specification_prompt(self, request: str, fhir_data: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build prompt for specification creation"""
        return f"""Create a UI specification for this clinical data visualization request.

Request: {request}

Available FHIR Data:
{json.dumps(fhir_data.get("summary", {}), indent=2)}

Data Context:
{fhir_data.get("context", "")}

Create a JSON specification with:
- component types (chart, table, card, grid)
- data bindings to available FHIR resources
- layout structure
- interaction capabilities

Return a valid JSON object with components array and layout information."""

    def _parse_specification(self, response: str) -> Dict[str, Any]:
        """Parse specification from Claude response"""
        try:
            # Try direct JSON parse
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass
                    
        # Return minimal spec if parsing fails
        return self._get_fallback_spec("Data visualization")
        
    def _enhance_with_data(self, spec: Dict[str, Any], fhir_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance specification with actual data insights"""
        if "metadata" not in spec:
            spec["metadata"] = {}
            
        spec["metadata"]["dataAvailable"] = fhir_data.get("summary", {})
        spec["metadata"]["fhirContext"] = fhir_data.get("context", "")
        
        return spec
        
    def _get_fallback_spec(self, request: str) -> Dict[str, Any]:
        """Get fallback specification if generation fails"""
        return {
            "components": [{
                "type": "card",
                "title": "Clinical Data",
                "dataSource": {
                    "resourceType": "Observation",
                    "query": {}
                }
            }],
            "layout": {
                "type": "grid",
                "columns": 1
            },
            "metadata": {
                "description": request,
                "fallback": True
            }
        }


class ComponentGeneratorAgent:
    """
    Consolidated agent for component code generation
    Combines: query_driven_generator, component template functionality
    """
    
    async def generate_component(self, specification: Dict[str, Any], context: Dict[str, Any]) -> str:
        """
        Generate React component code from specification
        """
        try:
            prompt = self._build_generation_prompt(specification, context)
            
            code = await claude_integration_service.complete(
                prompt=prompt,
                options={
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 8192,
                    "temperature": 0
                }
            )
            
            # Clean up the generated code
            code = self._clean_code(code)
            
            # Validate the generated code
            if self._validate_code(code):
                return code
            else:
                return self._get_fallback_component(specification)
                
        except Exception as e:
            logger.error(f"Component generator agent error: {e}")
            return self._get_fallback_component(specification)
            
    def _build_generation_prompt(self, spec: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build prompt for component generation"""
        return f"""Generate a React component for this clinical UI specification.

Specification:
{json.dumps(spec, indent=2)}

Requirements:
- Use @mui/material components
- Use useFHIRResources or usePatientResources hooks
- Include loading and error states
- Follow WintEHR patterns (no console.log)
- Make it responsive and accessible

Generate only the component code without markdown blocks."""

    def _clean_code(self, code: str) -> str:
        """Clean generated code"""
        # Remove markdown code blocks
        code = code.replace("```jsx", "").replace("```javascript", "").replace("```", "")
        
        # Remove any console.log statements
        import re
        code = re.sub(r'console\.(log|error|warn|debug)\([^)]*\);?\n?', '', code)
        
        return code.strip()
        
    def _validate_code(self, code: str) -> bool:
        """Basic validation of generated code"""
        required = [
            "import React",
            "export default",
            "return"
        ]
        return all(req in code for req in required)
        
    def _get_fallback_component(self, spec: Dict[str, Any]) -> str:
        """Get fallback component if generation fails"""
        title = spec.get("metadata", {}).get("title", "Clinical Data")
        return f"""import React from 'react';
import {{ Card, CardContent, Typography, Box, CircularProgress, Alert }} from '@mui/material';
import {{ usePatientResources }} from '../hooks/useFHIRResources';

const ClinicalComponent = ({{ patientId }}) => {{
  const {{ resources, loading, error }} = usePatientResources(
    patientId,
    'Observation'
  );
  
  if (loading) return (
    <Box display="flex" justifyContent="center" p={{3}}>
      <CircularProgress />
    </Box>
  );
  
  if (error) return (
    <Alert severity="error">Error loading clinical data</Alert>
  );
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        <Typography>
          {{resources?.length || 0}} records found
        </Typography>
      </CardContent>
    </Card>
  );
}};

export default ClinicalComponent;"""


# Simplified orchestrator that uses the 3 core agents
class SimplifiedUIComposerOrchestrator:
    """
    Main orchestrator that coordinates the 3 core agents
    """
    
    def __init__(self, db_session: AsyncSession):
        self.fhir_agent = FHIRDataAgent(db_session)
        self.spec_agent = UISpecificationAgent()
        self.generator_agent = ComponentGeneratorAgent()
        
    async def generate_ui(self, request: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Complete UI generation pipeline
        """
        try:
            # Step 1: Analyze and fetch FHIR data
            logger.info("Step 1: Fetching FHIR data")
            fhir_result = await self.fhir_agent.analyze_and_fetch(request, context)
            
            if not fhir_result["success"]:
                raise RuntimeError(f"FHIR data fetch failed: {fhir_result.get('error')}")
                
            # Step 2: Create UI specification
            logger.info("Step 2: Creating UI specification")
            spec_result = await self.spec_agent.create_specification(request, fhir_result, context)
            
            if not spec_result["success"]:
                raise RuntimeError(f"Specification creation failed: {spec_result.get('error')}")
                
            # Step 3: Generate component code
            logger.info("Step 3: Generating component code")
            component_code = await self.generator_agent.generate_component(
                spec_result["specification"], 
                context
            )
            
            return {
                "success": True,
                "specification": spec_result["specification"],
                "component": component_code,
                "fhirData": fhir_result["summary"],
                "metadata": {
                    "request": request,
                    "timestamp": str(datetime.now()),
                    "agentPipeline": "simplified"
                }
            }
            
        except Exception as e:
            logger.error(f"UI generation orchestration error: {e}")
            return {
                "success": False,
                "error": str(e),
                "component": self.generator_agent._get_fallback_component({"metadata": {"title": "Error"}})
            }