"""
Anthropic SDK Service V2
Uses a dedicated runner script for more reliable execution
"""

import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class AnthropicSDKServiceV2:
    """Service for communicating with Claude via the official Anthropic SDK"""
    
    def __init__(self):
        self.api_key = os.environ.get('ANTHROPIC_API_KEY')
        self.runner_path = Path(__file__).parent / "sdk_runner.js"
        self.sdk_available = self._check_sdk_availability()
        
    def _check_sdk_availability(self) -> bool:
        """Check if Anthropic SDK is installed and runner exists"""
        if not self.runner_path.exists():
            logger.error(f"SDK runner not found at {self.runner_path}")
            return False
            
        # Check if SDK is installed in backend or root directory
        backend_node_modules = Path(__file__).parent.parent.parent / "node_modules" / "@anthropic-ai" / "sdk"
        root_node_modules = Path(__file__).parent.parent.parent.parent / "node_modules" / "@anthropic-ai" / "sdk"
        
        if backend_node_modules.exists():
            logger.info("Anthropic SDK found in backend node_modules")
            return True
        elif root_node_modules.exists():
            logger.info("Anthropic SDK found in root node_modules")
            return True
            
        logger.warning("Anthropic SDK not found in backend node_modules")
        return False
    
    async def is_available(self) -> bool:
        """Check if SDK is available and configured"""
        return self.sdk_available and bool(self.api_key)
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test SDK connection"""
        if not self.sdk_available:
            return {
                "available": False,
                "error": "Anthropic SDK not installed in backend",
                "install_command": "cd backend && npm install @anthropic-ai/sdk"
            }
        
        if not self.api_key:
            return {
                "available": False,
                "error": "ANTHROPIC_API_KEY environment variable not set",
                "instructions": "Set ANTHROPIC_API_KEY in your environment or .env file"
            }
        
        # Try a simple test query
        try:
            result = await self._run_sdk_command({
                "action": "test"
            })
            
            return {
                "available": result.get('success', False),
                "message": result.get('message', 'SDK test completed'),
                "error": result.get('error')
            }
            
        except Exception as e:
            return {
                "available": False,
                "error": str(e)
            }
    
    async def _run_sdk_command(self, request_data: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
        """Run SDK command via the runner script"""
        try:
            # Run the runner script from root directory where node_modules is
            root_dir = Path(__file__).parent.parent.parent.parent
            
            process = await asyncio.create_subprocess_exec(
                'node', str(self.runner_path),
                json.dumps(request_data),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, 'ANTHROPIC_API_KEY': self.api_key},
                cwd=str(root_dir)  # Set working directory to root where node_modules is
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            
            if process.returncode != 0:
                error_msg = stderr.decode().strip() or stdout.decode().strip()
                raise RuntimeError(f"SDK runner failed: {error_msg}")
            
            # Parse JSON output
            output = stdout.decode().strip()
            if output:
                # Find the last line that looks like JSON
                lines = output.split('\n')
                for line in reversed(lines):
                    if line.strip().startswith('{'):
                        return json.loads(line)
            
            return {"success": False, "error": "No output from SDK runner"}
            
        except asyncio.TimeoutError:
            raise TimeoutError(f"SDK command timed out after {timeout} seconds")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse SDK output: {output}")
            raise ValueError(f"Invalid JSON response from SDK: {e}")
    
    async def complete(self, prompt: str, options: Optional[Dict[str, Any]] = None) -> str:
        """Send a completion request to Claude"""
        if not await self.is_available():
            raise RuntimeError("Anthropic SDK not available")
        
        result = await self._run_sdk_command({
            "action": "complete",
            "prompt": prompt,
            "options": options or {}
        })
        
        if not result.get('success'):
            raise RuntimeError(result.get('error', 'Completion failed'))
        
        return result.get('response', '')
    
    async def analyze_request(self, prompt: str, context: Dict[str, Any]) -> str:
        """Analyze a UI request using SDK"""
        full_prompt = f"""You are a UI design expert for a clinical EMR system. Analyze the following natural language request and create a detailed UI specification.

Request: "{prompt}"

Context:
{json.dumps(context, indent=2)}

Please analyze this request and respond with a JSON object containing:
{{
  "intent": "brief description of what the user wants",
  "scope": "population|patient|encounter",
  "layoutType": "dashboard|report|focused-view",
  "requiredData": ["list of FHIR resource types needed"],
  "components": [
    {{
      "type": "chart|grid|summary|form|timeline|stat|container|text",
      "purpose": "what this component will show",
      "dataBinding": {{
        "resourceType": "FHIR resource type",
        "filters": ["any filters needed"],
        "aggregation": "how data should be aggregated"
      }},
      "displayProperties": {{
        "title": "component title",
        "chartType": "if chart: line|bar|pie|scatter|area",
        "gridType": "if grid: patient-list|result-list|medication-list|generic-table",
        "columns": ["if grid: column definitions"],
        "grouping": "how to group data"
      }}
    }}
  ],
  "layout": {{
    "structure": "how components should be arranged",
    "responsive": "mobile considerations"
  }}
}}

Focus on clinical accuracy, appropriate data visualization, and user workflow optimization."""
        
        return await self.complete(full_prompt)
    
    async def generate_component(self, specification: Dict[str, Any]) -> str:
        """Generate a component from specification"""
        components = specification.get('components', [])
        if not components:
            return "// No components to generate"
        
        component = components[0]  # Process first component
        
        prompt = f"""Generate a React component for a clinical UI based on the following specification:

Component Type: {component.get('type')}
Component Props: {json.dumps(component.get('props', {}), indent=2)}
Data Binding: {json.dumps(component.get('dataBinding', {}), indent=2)}

Requirements:
1. Use Material-UI components (@mui/material, @mui/icons-material)
2. Follow MedGenEMR patterns and conventions
3. Include proper error handling and loading states
4. Use hooks for data fetching (assume useFHIRResources hook is available)
5. Ensure clinical data safety and accuracy
6. Make the component responsive and accessible

Generate a complete, functional React component. Return ONLY the component code."""
        
        return await self.complete(prompt)
    
    async def refine_ui(self, feedback: str, specification: Dict[str, Any],
                       feedback_type: str = 'general') -> str:
        """Refine UI based on feedback"""
        prompt = f"""You are a UI refinement expert. Analyze the following user feedback and determine what changes need to be made to the UI specification.

User Feedback: "{feedback}"
Feedback Type: {feedback_type}

Current UI Specification:
{json.dumps(specification, indent=2)}

Please analyze the feedback and respond with a JSON object containing:
{{
  "changes": [
    {{
      "type": "update|add|remove|modify",
      "target": "component|layout|data|styling",
      "componentId": "id of component to change",
      "property": "property to change",
      "value": "new value",
      "reasoning": "why this change is needed"
    }}
  ],
  "reasoning": "overall reasoning for the changes"
}}

Focus on clinical safety, user experience, and technical feasibility."""
        
        return await self.complete(prompt)

# Singleton instance
anthropic_sdk_service_v2 = AnthropicSDKServiceV2()