"""
Anthropic SDK Service
Uses the official Anthropic SDK for API-based communication
"""

import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class AnthropicSDKService:
    """Service for communicating with Claude via the official Anthropic SDK"""
    
    def __init__(self):
        self.api_key = os.environ.get('ANTHROPIC_API_KEY')
        self.sdk_available = self._check_sdk_availability()
        
    def _check_sdk_availability(self) -> bool:
        """Check if Anthropic SDK is installed in Node environment"""
        try:
            # Check if @anthropic-ai/sdk is installed
            result = os.popen('npm list @anthropic-ai/sdk 2>/dev/null').read()
            if '@anthropic-ai/sdk' in result:
                logger.info("Anthropic SDK is installed")
                return True
            else:
                logger.warning("Anthropic SDK not found")
                return False
        except Exception as e:
            logger.error(f"Error checking SDK availability: {e}")
            return False
    
    async def is_available(self) -> bool:
        """Check if SDK is available and configured"""
        return self.sdk_available and bool(self.api_key)
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test SDK connection"""
        if not self.sdk_available:
            return {
                "available": False,
                "error": "Anthropic SDK not installed",
                "install_command": "npm install @anthropic-ai/sdk"
            }
        
        if not self.api_key:
            return {
                "available": False,
                "error": "ANTHROPIC_API_KEY environment variable not set",
                "instructions": "Set ANTHROPIC_API_KEY in your environment or .env file"
            }
        
        # Try a simple test query
        try:
            test_script = '''
const Anthropic = require('@anthropic-ai/sdk');

async function test() {
    try {
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        const message = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 50,
            temperature: 0,
            messages: [{
                role: "user",
                content: "Say 'SDK is working'"
            }]
        });
        
        process.stdout.write(JSON.stringify({ 
            success: true, 
            message: message.content[0].text 
        }));
    } catch (error) {
        process.stdout.write(JSON.stringify({ 
            success: false, 
            error: error.message 
        }));
    }
}

test();
'''
            
            result = await self._run_node_script(test_script)
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
    
    async def _run_node_script(self, script: str, timeout: int = 30) -> Dict[str, Any]:
        """Run a Node.js script and return the result"""
        # Create temporary script file
        script_file = Path(f"/tmp/anthropic-sdk-{os.getpid()}.js")
        try:
            # Don't use dotenv in temp script - env vars are passed directly
            script_file.write_text(script)
            
            # Run the script with NODE_PATH for global modules
            env = {**os.environ, 'ANTHROPIC_API_KEY': self.api_key}
            env['NODE_PATH'] = '/usr/local/lib/node_modules'
            
            process = await asyncio.create_subprocess_exec(
                'node', str(script_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            
            if process.returncode != 0:
                raise RuntimeError(f"Script failed: {stderr.decode()}")
            
            # Parse JSON output
            output = stdout.decode().strip()
            if output:
                # Find last JSON object in output (in case there are logs)
                lines = output.split('\n')
                for line in reversed(lines):
                    if line.strip().startswith('{'):
                        return json.loads(line)
            
            return {"success": False, "error": "No output from script"}
            
        finally:
            # Clean up script file
            script_file.unlink(missing_ok=True)
    
    async def complete(self, prompt: str, options: Optional[Dict[str, Any]] = None) -> str:
        """Send a completion request to Claude"""
        if not await self.is_available():
            raise RuntimeError("Anthropic SDK not available")
        
        options = options or {}
        
        script = f'''
const Anthropic = require('@anthropic-ai/sdk');

async function complete() {{
    try {{
        const anthropic = new Anthropic({{
            apiKey: process.env.ANTHROPIC_API_KEY,
        }});
        
        const message = await anthropic.messages.create({{
            model: {json.dumps(options.get('model', 'claude-3-haiku-20240307'))},
            max_tokens: {options.get('max_tokens', 1024)},
            temperature: {options.get('temperature', 0)},
            messages: [{{
                role: "user",
                content: {json.dumps(prompt)}
            }}]
        }});
        
        process.stdout.write(JSON.stringify({{ 
            success: true, 
            response: message.content[0].text 
        }}));
    }} catch (error) {{
        process.stdout.write(JSON.stringify({{ 
            success: false, 
            error: error.message 
        }}));
    }}
}}

complete();
'''
        
        result = await self._run_node_script(script)
        
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
2. Follow WintEHR patterns and conventions
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
anthropic_sdk_service = AnthropicSDKService()