"""
Claude SDK Service
Uses the official Claude Code SDK for API-based communication
"""

import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional, AsyncIterator
from pathlib import Path

logger = logging.getLogger(__name__)

# Check if Claude Code SDK is available
try:
    # We'll use subprocess to call the SDK since it's Node.js based
    import subprocess
    CLAUDE_SDK_AVAILABLE = True
except ImportError:
    CLAUDE_SDK_AVAILABLE = False

class ClaudeSDKService:
    """Service for communicating with Claude via the official SDK"""
    
    def __init__(self):
        self.api_key = os.environ.get('ANTHROPIC_API_KEY')
        self.sdk_available = self._check_sdk_availability()
        
    def _check_sdk_availability(self) -> bool:
        """Check if Claude Code SDK is installed"""
        if not CLAUDE_SDK_AVAILABLE:
            return False
            
        try:
            # Check if @anthropic-ai/claude-code is installed
            result = subprocess.run(
                ['npm', 'list', '@anthropic-ai/claude-code', '-g'],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                logger.info("Claude Code SDK is installed")
                return True
            else:
                logger.warning("Claude Code SDK not found")
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
                "error": "Claude Code SDK not installed",
                "install_command": "npm install -g @anthropic-ai/claude-code"
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
const { query } = require("@anthropic-ai/claude-code");

async function test() {
    try {
        const messages = [];
        for await (const message of query({
            prompt: "Say 'SDK is working'",
            options: { maxTurns: 1 }
        })) {
            messages.push(message);
        }
        process.stdout.write(JSON.stringify({ success: true, message: "SDK is working" }));
    } catch (error) {
        process.stdout.write(JSON.stringify({ success: false, error: error.message }));
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
        script_file = Path(f"/tmp/claude-sdk-{os.getpid()}.js")
        try:
            script_file.write_text(script)
            
            # Run the script
            process = await asyncio.create_subprocess_exec(
                'node', str(script_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, 'ANTHROPIC_API_KEY': self.api_key}
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
            raise RuntimeError("Claude SDK not available")
        
        options = options or {}
        options.setdefault('maxTurns', 1)
        
        script = f'''
const {{ query }} = require("@anthropic-ai/claude-code");

async function complete() {{
    try {{
        let response = "";
        for await (const message of query({{
            prompt: {json.dumps(prompt)},
            options: {json.dumps(options)}
        }})) {{
            if (message.type === 'assistant' && message.content) {{
                response += message.content;
            }}
        }}
        process.stdout.write(JSON.stringify({{ success: true, response }}));
    }} catch (error) {{
        process.stdout.write(JSON.stringify({{ success: false, error: error.message }}));
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
claude_sdk_service = ClaudeSDKService()