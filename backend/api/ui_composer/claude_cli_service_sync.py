"""
Claude CLI Service - Synchronous version
Workaround for async subprocess timeout issues
"""

import subprocess
import json
import os
from typing import Optional, Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class ClaudeCLIServiceSync:
    def __init__(self):
        # Try to find Claude CLI in multiple locations
        self.claude_paths = [
            "/Users/robertbarrett/.nvm/versions/node/v22.17.0/bin/claude",
            "/Users/robertbarrett/.claude/local/claude",
            os.path.expanduser("~/.claude/local/claude"),
            os.path.expanduser("~/.nvm/versions/node/v22.17.0/bin/claude"),
            "claude"  # Try system PATH
        ]
        self.claude_path = self._find_claude_cli()
        self.session_file = Path.home() / ".claude" / "session.json"
        self._auth_token = None  # Will be populated by _check_session()
        
    def _find_claude_cli(self) -> Optional[str]:
        """Find the Claude CLI executable"""
        for path in self.claude_paths:
            try:
                # Test if path exists and is executable
                if os.path.exists(path) and os.access(path, os.X_OK):
                    return path
                # Try running it
                result = subprocess.run(
                    [path, "--version"], 
                    capture_output=True, 
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    return path
            except Exception:
                continue
        
        # Last resort: try 'which claude'
        try:
            result = subprocess.run(
                ["which", "claude"], 
                capture_output=True, 
                text=True
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except Exception:
            pass
            
        return None
    
    def _check_session(self) -> Dict[str, Any]:
        """Check if Claude has an active session"""
        try:
            # Check IDE lock files for active sessions
            ide_dir = Path.home() / ".claude" / "ide"
            if ide_dir.exists():
                for lock_file in ide_dir.glob("*.lock"):
                    try:
                        lock_data = json.loads(lock_file.read_text())
                        if "authToken" in lock_data:
                            # Store the auth token for later use
                            self._auth_token = lock_data["authToken"]
                            
                            # Try a simple command to verify
                            result = subprocess.run(
                                [self.claude_path, "--version"],
                                capture_output=True,
                                text=True,
                                timeout=5,
                                env={**os.environ, 
                                     "CLAUDE_NON_INTERACTIVE": "true",
                                     "CLAUDE_AUTH_TOKEN": self._auth_token}
                            )
                            
                            if result.returncode == 0:
                                return {
                                    "authenticated": True,
                                    "session_exists": True,
                                    "auth_type": "ide_lock",
                                    "auth_token": self._auth_token
                                }
                    except (json.JSONDecodeError, Exception) as e:
                        logger.debug(f"Could not read lock file {lock_file}: {e}")
                        continue
            
            return {
                "authenticated": False,
                "session_exists": False,
                "error": "No active Claude session found"
            }
            
        except Exception as e:
            logger.error(f"Error checking session: {e}")
            return {
                "authenticated": False,
                "error": str(e)
            }
    
    async def is_available(self) -> bool:
        """Check if service is available"""
        status = await self.test_connection()
        return status.get("available", False)
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test if Claude CLI is available and authenticated (sync version wrapped in async)"""
        if not self.claude_path:
            return {
                "available": False,
                "error": "Claude CLI not found in PATH"
            }
        
        try:
            # Get version
            result = subprocess.run(
                [self.claude_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                return {
                    "available": False,
                    "error": f"Claude CLI error: {result.stderr or 'Unknown error'}"
                }
            
            version = result.stdout.strip()
            
            # Check session
            session_status = self._check_session()
            
            if session_status.get("authenticated"):
                return {
                    "available": True,
                    "authenticated": True,
                    "response": "Claude CLI is ready and authenticated",
                    "path": self.claude_path,
                    "version": version
                }
            else:
                return {
                    "available": True,
                    "authenticated": False,
                    "response": "Claude CLI found but not authenticated",
                    "path": self.claude_path,
                    "version": version,
                    "auth_error": session_status.get("error"),
                    "note": "To authenticate, run: claude auth login"
                }
        except Exception as e:
            return {
                "available": False,
                "error": str(e),
                "path": self.claude_path
            }
    
    def complete(self, prompt: str, timeout: int = 300) -> str:
        """Execute Claude CLI with prompt and return response (sync version)"""
        if not self.claude_path:
            raise RuntimeError("Claude CLI not available")
        
        # Check authentication first
        session_status = self._check_session()
        if not session_status.get("authenticated"):
            raise RuntimeError(f"Claude CLI not authenticated. {session_status.get('error', 'Please run: claude auth login')}")
        
        # Set up environment
        env = os.environ.copy()
        env['CLAUDE_NON_INTERACTIVE'] = 'true'
        
        # Use stored auth token
        if self._auth_token:
            env['CLAUDE_AUTH_TOKEN'] = self._auth_token
        
        # Remove Claude Code specific vars that might cause conflicts
        env.pop('CLAUDE_CODE_SSE_PORT', None)
        env.pop('CLAUDE_CODE_ENTRYPOINT', None)
        env.pop('CLAUDECODE', None)
        
        # Set simple terminal
        env['TERM'] = 'dumb'
        
        # Run command
        cmd = [self.claude_path, '--print', prompt]
        
        logger.info(f"Running Claude CLI (sync): {self.claude_path} --print [prompt length: {len(prompt)}]")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env
            )
            
            if result.returncode != 0:
                stderr = result.stderr or ''
                stdout = result.stdout or ''
                logger.error(f"Claude CLI failed with code {result.returncode}")
                logger.error(f"stderr: {stderr}")
                logger.error(f"stdout: {stdout}")
                error_msg = stderr or stdout or 'Unknown error'
                
                # Check for authentication errors
                if "unauthorized" in error_msg.lower() or "auth" in error_msg.lower():
                    raise RuntimeError("Claude CLI authentication failed. Please run: claude auth login")
                
                raise RuntimeError(f"Claude CLI error: {error_msg}")
            
            response = result.stdout
            
            # Log the raw response for debugging
            logger.info(f"Claude CLI raw response length: {len(response)}")
            if len(response) < 1000:
                logger.info(f"Claude CLI raw response: {response}")
            else:
                logger.info(f"Claude CLI raw response (first 500 chars): {response[:500]}...")
            
            # Clean markdown if present
            return self._clean_markdown_response(response)
            
        except subprocess.TimeoutExpired:
            logger.error(f"Claude CLI command timed out after {timeout} seconds")
            raise TimeoutError(f"Claude CLI command timed out after {timeout} seconds")
    
    def _clean_markdown_response(self, response: str) -> str:
        """Clean markdown code blocks from response"""
        if not response:
            return response
            
        # If no markdown blocks, return as is
        if "```" not in response:
            return response
        
        # Extract code from markdown blocks
        import re
        # Updated regex to also handle json blocks
        code_block_regex = r'```(?:jsx?|javascript|typescript|tsx?|json)?\n?([\s\S]*?)```'
        matches = re.findall(code_block_regex, response)
        
        if matches:
            # If multiple code blocks, join them
            if len(matches) > 1:
                return '\n\n'.join(matches)
            else:
                return matches[0].strip()
        
        return response
    
    async def analyze_request(self, prompt: str, context: Dict[str, Any]) -> str:
        """Analyze a UI request using CLI (sync version wrapped in async)"""
        # Create a concise prompt
        full_prompt = f"""Analyze this clinical UI request and return ONLY valid JSON (no markdown):

Request: "{prompt}"
Mode: {context.get('generationMode', 'mixed')}

Return this exact JSON structure:
{{
  "intent": "what user wants",
  "scope": "population|patient|encounter",
  "layoutType": "dashboard|report|focused-view",
  "requiredData": ["FHIR resource types"],
  "components": [
    {{
      "type": "chart|grid|stat|summary|timeline",
      "purpose": "component purpose",
      "dataBinding": {{
        "resourceType": "Observation|Condition|etc",
        "filters": ["optional filters"],
        "aggregation": "count|average|latest"
      }},
      "displayProperties": {{
        "title": "display title",
        "chartType": "line|bar|pie",
        "gridType": "patient-list|result-list"
      }}
    }}
  ],
  "layout": {{
    "structure": "grid|stack|tabs",
    "responsive": "yes|no"
  }}
}}"""
        
        response = self.complete(full_prompt, timeout=60)  # Shorter timeout for sync
        return response
    
    async def generate_component(self, specification: Dict[str, Any]) -> str:
        """Generate a component from specification (sync version wrapped in async)"""
        try:
            components = specification.get('components', [])
            if not components:
                return "// No components to generate"
            
            component = components[0]  # Process first component
            generation_mode = (specification.get('generationMode') or 
                              specification.get('metadata', {}).get('generationMode') or 
                              'mixed')
            
            logger.info(f"Generating component with mode: {generation_mode}")
            
            # Extract component details
            component_type = component.get('type')
            component_props = json.dumps(component.get('props', {}), indent=2)
            component_binding = json.dumps(component.get('dataBinding', {}), indent=2)
            
            # Create a concise prompt
            prompt = f"""Generate a React component. Return ONLY code, no explanations.

Type: {component_type}
Props: {component_props}
Binding: {component_binding}
Mode: {generation_mode}

Requirements:
- Material-UI (@mui/material)
- Import: import {{ usePatientResources }} from '../../../hooks/useFHIRResources'
- Import: import {{ fhirService }} from '../../../services/fhirService'
- NO mock data - use real FHIR queries
- Handle loading/error states
- Accept patientId prop
- Use resource.valueQuantity?.value for values
- Use resource.code?.coding?.[0]?.display for codes

Return complete React component code only."""
            
            logger.info(f"Component generation prompt length: {len(prompt)} characters")
            response = self.complete(prompt, timeout=120)  # 2 minutes for generation
            
            logger.info(f"Component generation response length: {len(response)}")
            
            # Validate that we got code
            if response and not any(keyword in response for keyword in ['import React', 'export default', 'const ', 'function ']):
                logger.error("Response appears to be a description, not code!")
                logger.error(f"Response preview: {response[:200]}...")
            
            return response
        
        except Exception as e:
            logger.error(f"Error in generate_component: {e}", exc_info=True)
            return f"// Error generating component: {str(e)}"

# Singleton instance
claude_cli_service_sync = ClaudeCLIServiceSync()