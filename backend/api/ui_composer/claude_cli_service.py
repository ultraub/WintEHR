"""
Claude CLI Service
Wrapper for executing Claude CLI commands from the backend
"""

import subprocess
import json
import asyncio
import os
from typing import Optional, Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class ClaudeCLIService:
    def __init__(self):
        # Try to find Claude CLI in multiple locations
        self.claude_paths = [
            "/Users/robertbarrett/.claude/local/claude",
            os.path.expanduser("~/.claude/local/claude"),
            "claude"  # Try system PATH
        ]
        self.claude_path = self._find_claude_cli()
        self.session_file = Path.home() / ".claude" / "session.json"
        
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
            # Check multiple possible auth locations
            # 1. Check IDE lock files for active sessions
            ide_dir = Path.home() / ".claude" / "ide"
            if ide_dir.exists():
                for lock_file in ide_dir.glob("*.lock"):
                    try:
                        lock_data = json.loads(lock_file.read_text())
                        if "authToken" in lock_data:
                            # Found an auth token, Claude is likely authenticated
                            # Try a simple command to verify
                            result = subprocess.run(
                                [self.claude_path, "--version"],
                                capture_output=True,
                                text=True,
                                timeout=5,
                                env={**os.environ, "CLAUDE_NON_INTERACTIVE": "true"}
                            )
                            
                            if result.returncode == 0:
                                return {
                                    "authenticated": True,
                                    "session_exists": True,
                                    "auth_type": "ide_lock"
                                }
                    except (json.JSONDecodeError, Exception) as e:
                        logger.debug(f"Could not read lock file {lock_file}: {e}")
                        continue
            
            # 2. Check classic session file
            if self.session_file.exists():
                try:
                    session_data = json.loads(self.session_file.read_text())
                    if "token" in session_data or "access_token" in session_data:
                        return {
                            "authenticated": True,
                            "session_exists": True,
                            "auth_type": "session_file"
                        }
                except json.JSONDecodeError:
                    pass
            
            # 3. Check current session indicator
            current_session = Path.home() / ".claude" / "sessions" / "sessions" / ".current-session"
            if current_session.exists() and current_session.stat().st_size > 0:
                return {
                    "authenticated": True,
                    "session_exists": True,
                    "auth_type": "current_session"
                }
            
            # No authentication found
            return {
                "authenticated": False,
                "error": "Claude is not authenticated. Please ensure Claude Code is running or run: claude auth login"
            }
                
        except Exception as e:
            logger.error(f"Error checking session: {e}")
            return {
                "authenticated": False,
                "error": f"Error checking session: {str(e)}"
            }
    
    async def is_available(self) -> bool:
        """Check if Claude CLI is available and authenticated"""
        if self.claude_path is None:
            return False
        
        # Also check if authenticated
        session_status = self._check_session()
        return session_status.get("authenticated", False)
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test Claude CLI connection"""
        if not self.claude_path:
            return {
                "available": False,
                "error": "Claude CLI not found",
                "searched_paths": self.claude_paths
            }
        
        try:
            # First test with version command which doesn't require auth
            version = await self._get_version()
            
            # Check session status
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
    
    async def complete(self, prompt: str, timeout: int = 60) -> str:
        """Execute Claude CLI with prompt and return response"""
        if not self.claude_path:
            raise RuntimeError("Claude CLI not available")
        
        # Check authentication first
        session_status = self._check_session()
        if not session_status.get("authenticated"):
            raise RuntimeError(f"Claude CLI not authenticated. {session_status.get('error', 'Please run: claude auth login')}")
        
        result = await self._run_command(
            ["--print", prompt],
            timeout=timeout
        )
        
        if result["returncode"] != 0:
            stderr = result.get('stderr', '')
            stdout = result.get('stdout', '')
            logger.error(f"Claude CLI failed with code {result['returncode']}")
            logger.error(f"stderr: {stderr}")
            logger.error(f"stdout: {stdout}")
            error_msg = stderr or stdout or 'Unknown error'
            
            # Check for authentication errors
            if "unauthorized" in error_msg.lower() or "auth" in error_msg.lower():
                raise RuntimeError("Claude CLI authentication failed. Please run: claude auth login")
            
            raise RuntimeError(f"Claude CLI error: {error_msg}")
        
        response = result.get("stdout", "")
        
        # Log the raw response for debugging
        logger.info(f"Claude CLI raw response length: {len(response)}")
        if len(response) < 1000:
            logger.info(f"Claude CLI raw response: {response}")
        else:
            logger.info(f"Claude CLI raw response (first 500 chars): {response[:500]}...")
        
        # Clean markdown if present
        return self._clean_markdown_response(response)
    
    async def analyze_request(self, prompt: str, context: Dict[str, Any]) -> str:
        """Analyze a UI request using CLI"""
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
        
        response = await self.complete(full_prompt, timeout=60)
        # The response should already be cleaned by complete(), but ensure it's valid JSON
        return response
    
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
        
        response = await self.complete(prompt, timeout=60)
        # The response should already be cleaned by complete()
        return response
    
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
        
        response = await self.complete(prompt, timeout=60)
        # The response should already be cleaned by complete()
        return response
    
    async def complete_json(self, prompt: str, timeout: int = 30) -> Dict[str, Any]:
        """Execute Claude CLI and parse JSON response"""
        if not self.claude_path:
            raise RuntimeError("Claude CLI not available")
        
        # Check authentication first
        session_status = self._check_session()
        if not session_status.get("authenticated"):
            raise RuntimeError(f"Claude CLI not authenticated. {session_status.get('error', 'Please run: claude auth login')}")
        
        # Get the response
        response = await self.complete(prompt, timeout)
        
        try:
            # Try to parse as JSON
            # First, try direct parsing
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                pass
            
            # Try to extract JSON from the response
            import re
            
            # Look for JSON object
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
            
            # Look for JSON array
            array_match = re.search(r'\[[\s\S]*\]', response)
            if array_match:
                return json.loads(array_match.group())
            
            # If still no match, raise error
            raise ValueError("No valid JSON found in response")
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Claude CLI: {response[:500]}...")
            raise ValueError(f"Invalid JSON response: {e}")
    
    async def _run_command(self, args: list, timeout: int = 30) -> Dict[str, Any]:
        """Run Claude CLI command asynchronously"""
        cmd = [self.claude_path] + args
        
        # Log the command being executed (without full prompt for security)
        if len(args) > 0 and args[0] == "--print":
            logger.info(f"Running Claude CLI: {self.claude_path} --print [prompt...]")
        else:
            logger.info(f"Running Claude CLI: {' '.join(cmd)}")
        
        # Set up environment with OAuth token if available
        env = {**os.environ, "CLAUDE_NON_INTERACTIVE": "true"}
        
        # Check for Claude OAuth token
        claude_token = os.environ.get('CLAUDE_AUTH_TOKEN')
        if claude_token:
            env['CLAUDE_AUTH_TOKEN'] = claude_token
            # Also try setting it as Authorization header format
            env['ANTHROPIC_AUTH_TOKEN'] = claude_token
        
        # Run subprocess asynchronously
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            
            return {
                "returncode": process.returncode,
                "stdout": stdout.decode('utf-8', errors='replace'),
                "stderr": stderr.decode('utf-8', errors='replace')
            }
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise TimeoutError(f"Claude CLI command timed out after {timeout} seconds")
    
    async def _get_version(self) -> Optional[str]:
        """Get Claude CLI version"""
        try:
            result = await self._run_command(["--version"], timeout=5)
            if result["returncode"] == 0:
                return result.get("stdout", "").strip()
        except Exception:
            pass
        return None
    
    def _clean_markdown_response(self, response: str) -> str:
        """Clean markdown code blocks from response"""
        if not response or "```" not in response:
            return response
        
        # Extract code from markdown blocks
        import re
        code_block_regex = r'```(?:jsx?|javascript|typescript|tsx?)?\n?([\s\S]*?)```'
        matches = re.findall(code_block_regex, response)
        
        if matches:
            # If multiple code blocks, join them
            if len(matches) > 1:
                return '\n\n'.join(matches)
            else:
                return matches[0].strip()
        
        # If no matches but has ```, try simpler extraction
        if response.count("```") >= 2:
            parts = response.split("```")
            if len(parts) >= 3:
                # Get the content between first pair of ```
                code_part = parts[1]
                # Remove language identifier if present
                lines = code_part.split('\n')
                if lines and lines[0].strip() in ['jsx', 'javascript', 'typescript', 'tsx', 'js', 'ts']:
                    return '\n'.join(lines[1:]).strip()
                return code_part.strip()
        
        return response

# Singleton instance
claude_cli_service = ClaudeCLIService()