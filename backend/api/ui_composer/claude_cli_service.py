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
            "/Users/robertbarrett/.nvm/versions/node/v22.17.0/bin/claude",  # Add the actual location
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
            # Check multiple possible auth locations
            # 1. Check IDE lock files for active sessions
            ide_dir = Path.home() / ".claude" / "ide"
            if ide_dir.exists():
                for lock_file in ide_dir.glob("*.lock"):
                    try:
                        lock_data = json.loads(lock_file.read_text())
                        if "authToken" in lock_data:
                            # Found an auth token, Claude is likely authenticated
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
    
    async def complete(self, prompt: str, timeout: int = 300) -> str:  # Increased to 5 minutes
        """Execute Claude CLI with prompt and return response"""
        if not self.claude_path:
            raise RuntimeError("Claude CLI not available")
        
        # Check authentication first
        session_status = self._check_session()
        if not session_status.get("authenticated"):
            raise RuntimeError(f"Claude CLI not authenticated. {session_status.get('error', 'Please run: claude auth login')}")
        
        # Don't use --output-format as it seems to cause timeouts
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
        # Get generation mode
        generation_mode = context.get('generationMode', 'mixed')
        
        # Include generation mode instructions
        generation_instructions = ""
        if generation_mode == 'full':
            generation_instructions = """
Generation Mode: FULL GENERATION
- Create completely new, creative components from scratch
- Do not reuse existing WintEHR components
- Prioritize unique designs and innovative layouts
- Generate all custom code without relying on templates
"""
        elif generation_mode == 'mixed':
            generation_instructions = """
Generation Mode: SMART MIX
- Combine existing WintEHR components with new generated parts
- Reuse standard components like ChartReviewTab patterns where applicable
- Generate custom code only for unique requirements
- Balance consistency with innovation
"""
        elif generation_mode == 'template':
            generation_instructions = """
Generation Mode: TEMPLATE-BASED
- Use existing WintEHR templates and patterns
- Minimal custom generation, focus on configuration
- Prioritize speed and consistency over creativity
- Reuse proven UI patterns from the codebase
"""
        
        # Include FHIR context if available
        fhir_context_section = ""
        if context.get("fhirContext"):
            fhir_context_section = f"""
Available FHIR Data:
{context.get("fhirContext")}

Based on the actual FHIR data available, generate UI components that will query and display this real data.
"""
        
        # Create a more concise prompt to avoid timeouts
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
        
        response = await self.complete(full_prompt, timeout=480)  # 8 minutes for analysis
        # The response should already be cleaned by complete(), but ensure it's valid JSON
        return response
    
    async def generate_component(self, specification: Dict[str, Any]) -> str:
        """Generate a component from specification"""
        try:
            # Debug: Test if we can create a simple f-string
            test_var = "test"
            test_fstring = f"Test: {test_var}"
            logger.debug(f"F-string test passed: {test_fstring}")
            
            # Debug: Check if 'code' is somehow in the specification
            spec_str = str(specification)
            if 'code' in spec_str and 'code:' not in spec_str and '"code"' not in spec_str:
                logger.warning(f"Found bare 'code' in specification: {spec_str[:200]}...")
            components = specification.get('components', [])
            if not components:
                return "// No components to generate"
            
            # Store components for later use
            all_components = components
            component = components[0]  # Process first component
            # Check multiple places for generation mode
            generation_mode = (specification.get('generationMode') or 
                              specification.get('metadata', {}).get('generationMode') or 
                              'mixed')
            
            logger.info(f"Generating component with mode: {generation_mode}")
            
            # Extract agent pipeline data if available
            agent_data = specification.get('metadata', {}).get('agentPipeline', {})
            has_agent_data = agent_data.get('enabled', False)
            
            # Check if we have query results from the new query-driven system
            query_results = agent_data.get('queryResults')
            query_plan = agent_data.get('queryPlan')
            
            if query_results and query_plan:
                logger.info("Using query-driven generation with actual query results")
                from .agents.query_driven_generator import QueryDrivenGenerator
                
                # Convert query results to proper format if needed
                from .agents.query_orchestrator import QueryResult
                formatted_results = {}
                for result_id, result_data in query_results.items():
                    qr = QueryResult(result_id, result_data.get('resourceType', 'Unknown'))
                    qr.resources = result_data.get('resources', [])
                    qr.aggregated_data = result_data.get('aggregated_data', {})
                    formatted_results[result_id] = qr
                
                # Extract data structure and UI suggestions from agent data
                data_structure = agent_data.get('dataAnalysis', {})
                ui_suggestions = agent_data.get('uiStructure', {})
                
                # Create generator with generation mode
                generator = QueryDrivenGenerator(generation_mode=generation_mode)
                
                # Generate component using query-driven approach with mode
                component_code = generator.generate_component(
                    formatted_results,
                    data_structure,
                    ui_suggestions,
                    component.get('name', 'GeneratedComponent')
                )
                return component_code
            
            # Initialize variables that will be used in prompts
            generation_specific_instructions = ""
            data_context_section = ""
            data_context = {}
            prompt = ""  # Initialize prompt at method level
            
            logger.info(f"Agent pipeline data available: {has_agent_data}")
            if has_agent_data:
                data_context = agent_data.get('dataAnalysis', {})
                logger.info(f"Agent pipeline has {data_context.get('totalRecords', 0)} total records")
                logger.info(f"Resource types: {list(data_context.get('resourceSummary', {}).keys())}")
            
            # Customize generation based on mode
            if generation_mode == 'full':
                generation_specific_instructions = """
FULL GENERATION MODE:
- Create completely custom components from scratch
- Use unique styling and layout approaches
- Don't follow standard WintEHR patterns unless necessary
- Focus on innovation and creativity
- Generate all necessary sub-components inline
"""
            elif generation_mode == 'mixed':
                generation_specific_instructions = """
SMART MIX MODE:
- Reuse WintEHR component patterns where appropriate
- Import existing components like: ChartReviewTab, ResultsTab patterns
- Generate custom code only for unique features
- Follow established WintEHR conventions
- Balance reusability with customization
"""
            elif generation_mode == 'template':
                generation_specific_instructions = """
TEMPLATE-BASED MODE:
- Use minimal custom code
- Rely heavily on existing WintEHR templates
- Focus on configuration over generation
- Reuse standard layout patterns
- Prioritize speed and consistency
"""
        
            # Build dynamic context from agent pipeline data
            if has_agent_data and agent_data.get('dataAnalysis'):
                data_analysis = agent_data['dataAnalysis']
                data_context_section = f"""
REAL DATA CONTEXT FROM AGENT PIPELINE:
Total Records Available: {data_analysis.get('totalRecords', 0)}
Data Quality: {data_analysis.get('dataQuality', {}).get('volume', 'unknown')}

Available Resources:
{self._format_resource_summary(data_analysis.get('resourceSummary', {}))}

Actual Data Examples:
{self._format_sample_data(data_analysis.get('sampleData', {}))}

Clinical Context:
{self._format_clinical_context(data_analysis.get('clinicalContext', {}))}

IMPORTANT: Generate components based on the ACTUAL data structure and content shown above.
"""
            
            # Log what we're actually sending
            logger.info(f"Generating component - Type: {component.get('type')}, Mode: {generation_mode}")
            logger.info(f"Component spec: {json.dumps(component, indent=2)}")
            logger.info(f"Total components in specification: {len(all_components)}")
            
            # Check if this is a dashboard with multiple components
            is_dashboard = specification.get('layout', {}).get('type') == 'dashboard' and len(all_components) > 1
            
            if is_dashboard and generation_mode == 'full':
                # For full generation mode dashboards, we need to generate the entire dashboard
                # Extract medical context from specification
                medical_context = specification.get('metadata', {}).get('description', '')
                clinical_focus = specification.get('metadata', {}).get('clinicalContext', {})
                
                # Build detailed component specifications
                detailed_components = []
                for c in all_components:
                    detailed_components.append({
                        'id': c.get('id'),
                        'type': c.get('type'),
                        'title': c.get('props', {}).get('title'),
                        'purpose': c.get('purpose', ''),
                        'dataBinding': c.get('dataBinding', {}),
                        'props': c.get('props', {}),
                        'filters': c.get('dataBinding', {}).get('filters', []),
                        'aggregation': c.get('dataBinding', {}).get('aggregation', '')
                    })
                
                prompt = f"""Generate a complete React dashboard component for the following medical scenario:

MEDICAL CONTEXT: {medical_context}
Clinical Focus: {json.dumps(clinical_focus, indent=2)}

Dashboard Layout: {specification.get('layout', {}).get('structure', {}).get('structure', 'Grid layout')}
Total Components: {len(all_components)}
Generation Mode: {generation_mode}

COMPONENTS TO GENERATE - YOU MUST INCLUDE ALL {len(all_components)} COMPONENTS:
{json.dumps(detailed_components, indent=2)}

{generation_specific_instructions}
{data_context_section}

MEDICAL DOMAIN REQUIREMENTS:
- This is for {medical_context}
- DO NOT use diabetes/A1C data unless explicitly requested
- For hypertension: use blood pressure observations (LOINC codes 85354-9, 8480-6, 8462-4)
- For stroke risk: calculate based on age, BP values, and conditions
- Use the EXACT filters and aggregations specified in each component's dataBinding

CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY:
1. Create a single dashboard component that contains ALL {len(all_components)} sub-components listed above
2. Follow the exact layout structure specified: {specification.get('layout', {}).get('structure', {}).get('structure', '')}
3. Each sub-component should match its specification exactly
4. DO NOT use mock patient names like "Patient A", "Patient B" - use real data from FHIR
5. DO NOT use template data - generate based on the specification
1. Use Material-UI components (@mui/material, @mui/icons-material)
2. Follow WintEHR patterns and conventions
3. Include proper error handling and loading states
4. **MANDATORY**: Use ACTUAL WintEHR FHIR hooks - NOT MOCK DATA:
   - import {{ usePatientResources }} from '../../../hooks/useFHIRResources';
   - import {{ useFHIRClient }} from '../../../contexts/FHIRClientContext';
   - import {{ fhirService }} from '../../../services/fhirService';
5. **ABSOLUTELY NO MOCK DATA** - Query REAL FHIR database only
6. Handle null/missing FHIR data gracefully with proper empty states
7. Use progressive loading (show available data immediately)
8. **REQUIRED**: Accept patientId as a prop and use it for data fetching
9. Generate FHIR queries based on the ACTUAL data context provided above, NOT hardcoded examples.
   - Use the resource types from the data context
   - Use the actual LOINC/SNOMED codes found in the sample data
   - Query for the specific clinical data relevant to this request

10. Format FHIR data properly:
   - Use resource.valueQuantity?.value for numeric values
   - Use resource.code?.coding?.[0]?.display for code displays
   - Use resource.effectiveDateTime for dates
   - Always use optional chaining (?.) for safety

11. **SPECIFIC TO THIS REQUEST**: The component must display ACTUAL patient data from the FHIR database. Do NOT generate example data like "Patient A", "Patient B" or hardcoded values. Use the real data returned from usePatientResources.

12. **FOR POPULATION-LEVEL QUERIES**: If querying across multiple patients, use appropriate FHIR search parameters and display actual patient names and real values from the database.

13. **AGENT PIPELINE DATA**: When agent pipeline data is provided above, you MUST:
    - Use the exact resource types, LOINC codes, and data structures from the sample data
    - Query for the specific clinical data mentioned in the agent context
    - NEVER use hardcoded LOINC codes like 4548-4 (A1C) unless they appear in the actual data context
    - Generate queries that match the clinical focus and domain from the agent analysis

FHIR QUERY REQUIREMENTS:
- For population dashboards: Use fhirService.searchResources() to query ALL patients/resources
- DO NOT filter by a single patientId for population views
- Example for hypertension patients:
  const conditionsResponse = await fhirService.searchResources('Condition', {{
    'code': '38341003,59621000,1201005', // Hypertension SNOMED codes
    _count: 1000
  }});
- Example for blood pressure:
  const observationsResponse = await fhirService.searchResources('Observation', {{
    'code': '85354-9,8480-6,8462-4', // Blood pressure LOINC codes
    _count: 1000,
    _sort: '-date'
  }});

COMPONENT DATA REQUIREMENTS:
- Each component must fetch and display REAL data based on its dataBinding specification
- Use the exact filters from the component specification
- Calculate aggregations (counts, averages, distributions) from the actual data
- Display real patient names from patient.name[0].given[0] + patient.name[0].family

IMPORTANT: Generate and return ONLY the React component code. Do NOT return descriptions, explanations, or documentation. Return ONLY executable JSX/React code that can be saved as a .js file and imported into the application.

Generate a complete, functional React component that queries and displays REAL FHIR data from the WintEHR database. Return ONLY the component code with NO mock data whatsoever."""
            else:
                # For single components or non-dashboard layouts
                gen_inst_defined = generation_specific_instructions is not None
                data_ctx_defined = data_context_section is not None
                logger.info(f"Building prompt for single component. Variables defined: generation_specific_instructions={gen_inst_defined}, data_context_section={data_ctx_defined}")
                
                try:
                    # Build prompt step by step
                    component_type = component.get('type')
                    component_props = json.dumps(component.get('props', {}), indent=2)
                    component_binding = json.dumps(component.get('dataBinding', {}), indent=2)
                    
                    # Log values before building prompt to help debug
                    logger.debug(f"component_type: {component_type}")
                    logger.debug(f"generation_specific_instructions type: {type(generation_specific_instructions)}, len: {len(generation_specific_instructions)}")
                    logger.debug(f"data_context_section type: {type(data_context_section)}, len: {len(data_context_section)}")
                    
                    # Create a concise prompt for component generation
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
                except NameError as e:
                    logger.error(f"NameError while building prompt: {e}")
                    import traceback
                    import sys
                    tb = traceback.format_exc()
                    logger.error(f"Full traceback:\n{tb}")
                    
                    # Get the actual line where error occurred
                    _, _, exc_tb = sys.exc_info()
                    logger.error(f"Error at file: {exc_tb.tb_frame.f_code.co_filename}")
                    logger.error(f"Error at line: {exc_tb.tb_lineno}")
                    
                    # Log all local variables
                    logger.error("Local variables:")
                    for k, v in locals().items():
                        if k not in ['e', 'tb', 'exc_tb', 'traceback', 'sys']:
                            logger.error(f"  {k} = {repr(v)[:200]}...")
                    
                    raise
        
            logger.info(f"Component generation prompt length: {len(prompt)} characters")
            try:
                response = await self.complete(prompt, timeout=600)  # 10 minutes for generation
                # The response should already be cleaned by complete()
                logger.info(f"Component generation response length: {len(response)}")
            except Exception as e:
                logger.error(f"Error during Claude complete call: {e}")
                logger.error(f"Error type: {type(e).__name__}")
                import traceback
                logger.error(f"Traceback:\n{traceback.format_exc()}")
                raise
            
            # Validate that we got code, not a description
            if response and not any(keyword in response for keyword in ['import React', 'export default', 'const ', 'function ']):
                logger.error("Response appears to be a description, not code!")
                logger.error(f"Response preview: {response[:200]}...")
                # Try to extract code if it's embedded in a description
                if "```" in response:
                    logger.info("Attempting to extract code from markdown blocks...")
                    response = self._clean_markdown_response(response)
                else:
                    # Force a retry with clearer instructions
                    logger.warning("Retrying with clearer code-only instructions...")
                    retry_prompt = f"You returned a description instead of code. {prompt}\n\nREMEMBER: Return ONLY React component code, starting with imports and ending with export default. NO descriptions or explanations."
                    response = await self.complete(retry_prompt, timeout=300)
            
            return response
        
        except Exception as e:
            logger.error(f"Error in generate_component: {e}", exc_info=True)
            # Return the error as a comment so we can see what went wrong
            # Use locals() to safely check if variables are defined
            local_vars = locals()
            
            error_msg = f"""// Error generating component: {str(e)}
// Component type: {local_vars.get('component', {}).get('type', 'unknown') if 'component' in local_vars else 'unknown'}
// Generation mode: {local_vars.get('generation_mode', 'unknown')}
// Has agent data: {local_vars.get('has_agent_data', 'unknown')}
"""
            if 'has_agent_data' in local_vars and local_vars.get('has_agent_data') and 'data_context' in local_vars:
                data_ctx = local_vars.get('data_context', {})
                error_msg += f"// Total records: {data_ctx.get('totalRecords', 0)}\n"
                error_msg += f"// Resource types: {list(data_ctx.get('resourceSummary', {}).keys())}\n"
            return error_msg
    
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
        
        response = await self.complete(prompt, timeout=360)  # 6 minutes for refinement
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
            logger.info(f"Running Claude CLI: {self.claude_path} --print [prompt length: {len(args[1]) if len(args) > 1 else 0}]")
        else:
            logger.info(f"Running Claude CLI: {' '.join(cmd)}")
        
        # Set up environment with OAuth token if available
        env = {**os.environ, "CLAUDE_NON_INTERACTIVE": "true"}
        
        # Check for Claude OAuth token - first from stored auth token, then from env
        claude_token = getattr(self, '_auth_token', None) or os.environ.get('CLAUDE_AUTH_TOKEN')
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
            
            result = {
                "returncode": process.returncode,
                "stdout": stdout.decode('utf-8', errors='replace'),
                "stderr": stderr.decode('utf-8', errors='replace')
            }
            
            if process.returncode != 0:
                logger.error(f"Claude CLI returned code {process.returncode}")
                logger.error(f"stderr: {result['stderr'][:500]}")
                logger.error(f"stdout: {result['stdout'][:500]}")
            
            return result
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            logger.error(f"Claude CLI command timed out after {timeout} seconds")
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
        if not response:
            return response
            
        # First, check if response starts with descriptive text
        if response.lower().startswith(("here's", "here is", "this is", "the following", "below is")):
            # Find where the actual code starts
            code_start_markers = ["import React", "const ", "function ", "export ", "```"]
            for marker in code_start_markers:
                idx = response.find(marker)
                if idx != -1:
                    response = response[idx:]
                    break
        
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
        
        # If no matches but has ```, try simpler extraction
        if response.count("```") >= 2:
            parts = response.split("```")
            if len(parts) >= 3:
                # Get the content between first pair of ```
                code_part = parts[1]
                # Remove language identifier if present
                lines = code_part.split('\n')
                if lines and lines[0].strip() in ['jsx', 'javascript', 'typescript', 'tsx', 'js', 'ts', 'json']:
                    return '\n'.join(lines[1:]).strip()
                return code_part.strip()
        
        return response
    
    def _format_resource_summary(self, resource_summary: Dict[str, Any]) -> str:
        """Format resource summary for prompt inclusion"""
        lines = []
        for resource_type, summary in resource_summary.items():
            lines.append(f"- {resource_type}: {summary.get('recordCount', 0)} records ({summary.get('purpose', 'Unknown purpose')})")
        return '\n'.join(lines) if lines else "No resources available"
    
    def _format_sample_data(self, sample_data: Dict[str, Any]) -> str:
        """Format sample data for prompt inclusion"""
        lines = []
        for resource_type, samples in sample_data.items():
            if samples.get('examples'):
                lines.append(f"\n{resource_type} Examples:")
                for i, example in enumerate(samples['examples'][:2]):  # Limit to 2 examples
                    lines.append(f"  Example {i+1}: {json.dumps(example, indent=2)}")
        return '\n'.join(lines) if lines else "No sample data available"
    
    def _format_clinical_context(self, clinical_context: Dict[str, Any]) -> str:
        """Format clinical context for prompt inclusion"""
        lines = []
        if clinical_context.get('primaryClinicalFocus'):
            lines.append(f"Focus: {clinical_context['primaryClinicalFocus']}")
        if clinical_context.get('clinicalDomain'):
            lines.append(f"Domains: {', '.join(clinical_context['clinicalDomain'])}")
        if clinical_context.get('temporalContext'):
            lines.append(f"Temporal: {clinical_context['temporalContext']}")
        return '\n'.join(lines) if lines else "No clinical context available"

# Singleton instance
claude_cli_service = ClaudeCLIService()