"""
UI Composer Service
Main service for UI composition functionality with multiple method support
"""

import logging
from typing import Dict, Any, Optional, Literal
from sqlalchemy.ext.asyncio import AsyncSession
from .claude_cli_service import claude_cli_service
from .claude_cli_service_sync import claude_cli_service_sync
from .claude_hooks_service import claude_hooks_service
from .anthropic_sdk_service_v2 import anthropic_sdk_service_v2
from .development_mode_service import development_mode_service
from .fhir_query_service import FHIRQueryService
from .agents.fhir_query_planner_agent import FHIRQueryPlannerAgent
from .agents.fhir_executor_agent import FHIRExecutorAgent
from .agents.data_context_agent import DataContextAgent

logger = logging.getLogger(__name__)

MethodType = Literal["hooks", "sdk", "cli", "development"]

class UIComposerService:
    """Service for UI composition with multiple method support"""
    
    def __init__(self):
        self.services = {
            "hooks": claude_hooks_service,
            "sdk": anthropic_sdk_service_v2,
            "cli": claude_cli_service_sync,  # Use sync version as workaround
            "development": development_mode_service
        }
        self.default_method = "cli"
        self.enable_agent_pipeline = True  # Feature flag for new agent workflow
        self.lightweight_mode = False  # Flag to reduce token usage
    
    async def get_method_status(self, method: Optional[MethodType] = None) -> Dict[str, Any]:
        """Get status for a specific method or all methods"""
        # Convert enum to string value if needed
        if method and hasattr(method, 'value'):
            method = method.value
        if method:
            service = self.services.get(method)
            if not service:
                return {"available": False, "error": f"Unknown method: {method}"}
            
            try:
                if hasattr(service, 'test_connection'):
                    return await service.test_connection()
                elif hasattr(service, 'is_available'):
                    available = await service.is_available()
                    return {"available": available}
                else:
                    return {"available": True}
            except Exception as e:
                return {"available": False, "error": str(e)}
        
        # Get status for all methods
        status = {}
        for method_name, service in self.services.items():
            status[method_name] = await self.get_method_status(method_name)
        return status
    
    async def analyze_request(self, request: str, context: Dict[str, Any], 
                            method: Optional[MethodType] = None,
                            db_session: Optional[AsyncSession] = None) -> Dict[str, Any]:
        """Analyze UI request using specified method"""
        # Convert enum to string value if needed
        if hasattr(method, 'value'):
            method = method.value
        method = method or self.default_method
        logger.info(f"Analyzing request with method: {method}")
        
        # Extract model from context if provided
        model = context.get('model', None)
        
        # Add FHIR context if database session is available
        if db_session:
            try:
                if self.enable_agent_pipeline and not context.get('lightweight', self.lightweight_mode):
                    # Use new agent pipeline for FHIR data integration
                    agent_result = await self._run_agent_pipeline(request, context, db_session)
                    if agent_result["success"]:
                        context["fhirData"] = agent_result["dataContext"]
                        context["fhirContext"] = agent_result["formattedContext"]
                        context["agentPipelineUsed"] = True
                        logger.info(f"Agent pipeline completed successfully with {agent_result['dataContext'].get('totalRecords', 0)} records")
                    else:
                        logger.warning(f"Agent pipeline failed, falling back to basic FHIR context: {agent_result.get('error')}")
                        context["agentPipelineError"] = agent_result.get("error")
                        # Fall back to basic FHIR context
                        await self._add_basic_fhir_context(request, context, db_session)
                else:
                    # Use original FHIR context approach
                    await self._add_basic_fhir_context(request, context, db_session)
                    
            except Exception as e:
                logger.error(f"Error adding FHIR context: {e}")
                context["fhirError"] = str(e)
        
        service = self.services.get(method)
        
        if not service:
            return {
                "success": False,
                "error": f"Unknown method: {method}"
            }
        
        try:
            # Check if service is available
            if hasattr(service, 'is_available') and not await service.is_available():
                return {
                    "success": False,
                    "error": f"{method} service is not available",
                    "method": method
                }
            
            # Call the appropriate analyze method
            if method == "development":
                analysis = await service.analyze_request(request, context)
                return {
                    "success": True,
                    "analysis": analysis,
                    "reasoning": analysis.get("intent", "Analysis completed"),
                    "method": method
                }
            else:
                # For hooks, sdk, and cli services
                response = await service.analyze_request(request, context)
                
                # Parse response to extract JSON
                analysis_data = self._parse_json_response(response)
                
                # Include agent pipeline data if it was used
                result = {
                    "success": True,
                    "analysis": analysis_data,
                    "reasoning": analysis_data.get("intent", "Analysis completed"),
                    "method": method,
                    "raw_response": response
                }
                
                # Add agent pipeline data to result if available
                if context.get("agentPipelineUsed") and context.get("fhirData"):
                    result["agentPipelineData"] = {
                        "enabled": True,
                        "dataContext": context["fhirData"],
                        "formattedContext": context.get("fhirContext", "")
                    }
                
                return result
                
        except Exception as e:
            logger.error(f"Error using {method} service: {e}")
            return {
                "success": False,
                "error": str(e),
                "method": method
            }
    
    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """Parse JSON from Claude response"""
        import json
        
        # Try to extract JSON from response
        try:
            # First try direct parse
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                try:
                    return json.loads(response[json_start:json_end])
                except json.JSONDecodeError:
                    pass
        
        # Return empty dict if parsing fails
        logger.error(f"Could not parse JSON from response. Raw response: {response[:1000]}...")
        return {}
    
    async def generate_components(self, specification: Dict[str, Any],
                                method: Optional[MethodType] = None,
                                db_session: Optional[AsyncSession] = None) -> Dict[str, str]:
        """Generate components from specification"""
        # Convert enum to string value if needed
        if hasattr(method, 'value'):
            method = method.value
        method = method or self.default_method
        logger.info(f"Generating components with method: {method}")
        logger.info(f"Available services: {list(self.services.keys())}")
        service = self.services.get(method)
        
        if not service:
            raise ValueError(f"Unknown method: {method}. Available: {list(self.services.keys())}")
        
        # Check if agent pipeline data is already in specification
        has_agent_data = specification.get('metadata', {}).get('agentPipeline', {}).get('enabled', False)
        
        # If no agent data and db_session is available, run agent pipeline
        if not has_agent_data and db_session and self.enable_agent_pipeline:
            try:
                # Extract the original request from specification metadata
                original_request = specification.get('metadata', {}).get('description', '')
                context = specification.get('metadata', {}).get('clinicalContext', {})
                
                # Run agent pipeline
                agent_result = await self._run_agent_pipeline(original_request, context, db_session)
                if agent_result["success"]:
                    # Add agent pipeline data to specification
                    if 'metadata' not in specification:
                        specification['metadata'] = {}
                    specification['metadata']['agentPipeline'] = {
                        'enabled': True,
                        'dataAnalysis': agent_result['dataContext'],
                        'formattedContext': agent_result['formattedContext'],
                        'queryPlan': agent_result['queryPlan']
                    }
                    logger.info(f"Agent pipeline added to specification with {agent_result['dataContext'].get('totalRecords', 0)} records")
                else:
                    logger.warning(f"Agent pipeline failed during generation: {agent_result.get('error')}")
            except Exception as e:
                logger.error(f"Error running agent pipeline during generation: {e}")
        
        components = {}
        
        try:
            if method == "development":
                # Development mode generates components individually
                for component in specification.get("components", []):
                    component_id = component.get("id", f"comp-{len(components)}")
                    component_code = await service.generate_component(component)
                    components[component_id] = component_code
            else:
                # Other services expect full specification
                component_code = await service.generate_component(specification)
                # For now, treat as single component
                components["main"] = component_code
                
        except Exception as e:
            logger.error(f"Error generating components with {method}: {e}", exc_info=True)
            # Return error as component for debugging with more detail
            error_message = str(e)
            if "SDK runner failed" in error_message:
                components["main"] = f"// SDK Execution Error: {error_message}\n// Check backend logs for details"
            else:
                components["main"] = f"// Generation Error: {error_message}"
            # Don't raise - return the error as a component so we can see it
            # raise
        
        return components
    
    async def refine_ui(self, feedback: str, specification: Dict[str, Any],
                       feedback_type: str = "general",
                       selected_component: Optional[str] = None,
                       method: Optional[MethodType] = None) -> Dict[str, Any]:
        """Refine UI based on feedback"""
        # Convert enum to string value if needed
        if hasattr(method, 'value'):
            method = method.value
        method = method or self.default_method
        service = self.services.get(method)
        
        if not service:
            return {
                "success": False,
                "error": f"Unknown method: {method}"
            }
        
        try:
            if method == "development":
                result = await service.refine_ui(feedback, specification, feedback_type)
                return {
                    "success": True,
                    "changes": result.get("changes", []),
                    "reasoning": result.get("reasoning", ""),
                    "method": method
                }
            else:
                # For hooks, sdk, and cli services
                response = await service.refine_ui(feedback, specification, feedback_type)
                
                # Parse response to extract JSON
                refinement_data = self._parse_json_response(response)
                
                return {
                    "success": True,
                    "changes": refinement_data.get("changes", []),
                    "reasoning": refinement_data.get("reasoning", ""),
                    "method": method,
                    "raw_response": response
                }
                
        except Exception as e:
            logger.error(f"Error refining UI with {method}: {e}")
            return {
                "success": False,
                "error": str(e),
                "method": method
            }
    
    def _parse_request_context(self, request: str) -> Dict[str, Any]:
        """Parse the natural language request to extract search context"""
        import re
        
        context = {}
        request_lower = request.lower()
        
        # Check for sepsis queries
        if "sepsis" in request_lower:
            context["condition"] = "sepsis"
            context["clinicalFocus"] = "sepsis_risk"
            # Don't set specific lab codes - let the agent pipeline determine them
            
        # Check for A1C queries
        elif "a1c" in request_lower or "hemoglobin a1c" in request_lower or "hba1c" in request_lower:
            context["labValue"] = {"code": "4548-4"}  # LOINC code for A1C
            
            # Extract value comparisons (>8.0%, above 8.0, etc.)
            value_patterns = [
                r'[><=]+\s*(\d+\.?\d*)%?',  # >8.0% or >8.0
                r'above\s+(\d+\.?\d*)%?',   # above 8.0%
                r'over\s+(\d+\.?\d*)%?',    # over 8.0%
                r'greater\s+than\s+(\d+\.?\d*)%?'  # greater than 8.0%
            ]
            
            for pattern in value_patterns:
                value_match = re.search(pattern, request_lower)
                if value_match:
                    operator = ">" if any(word in request_lower for word in ["above", "over", "greater"]) else ">"
                    if ">=" in request or "≥" in request:
                        operator = ">="
                    elif ">" in request:
                        operator = ">"
                    context["labValue"]["value"] = f"{operator}{value_match.group(1)}"
                    break
        
        # Check for diabetes
        elif "diabetes" in request_lower:
            context["condition"] = "diabetes"
        
        # Check for hypertension
        elif "hypertension" in request_lower or "blood pressure" in request_lower:
            context["condition"] = "hypertension"
        
        # Check for infection
        elif "infection" in request_lower:
            context["condition"] = "infection"
        
        # Check for specific patient mentions
        patient_match = re.search(r'patient\s+(\S+)', request_lower)
        if patient_match:
            context["patientId"] = patient_match.group(1)
        
        # Check for risk queries
        if "risk" in request_lower or "at risk" in request_lower:
            context["queryType"] = "risk_assessment"
        
        # Check for population queries
        if "population" in request_lower or "across" in request_lower or "all patient" in request_lower:
            context["scope"] = "population"
        
        return context
    
    async def _run_agent_pipeline(self, request: str, context: Dict[str, Any], db_session: AsyncSession) -> Dict[str, Any]:
        """Run the new agent pipeline for intelligent FHIR query planning and execution"""
        try:
            # Check if we should use the new query-driven orchestrator
            use_query_driven = context.get("useQueryDriven", True)
            
            if use_query_driven:
                # Use the new query-driven orchestrator
                logger.info("Using query-driven UI generation orchestrator")
                from .agents.ui_generation_orchestrator import UIGenerationOrchestrator
                
                orchestrator = UIGenerationOrchestrator()
                result = await orchestrator.generate_ui_from_request(request, context)
                
                if result["success"]:
                    # Convert orchestrator result to agent pipeline format
                    return {
                        "success": True,
                        "dataContext": result["data_analysis"],
                        "formattedContext": self._format_orchestrator_context(result),
                        "queryPlan": result["query_plan"],
                        "queryResults": result.get("query_results", {}),
                        "uiStructure": result["ui_structure"],
                        "componentCode": result["component_code"],
                        "executionStats": result["execution_stats"],
                        "reasoning": f"Query-driven generation completed in {result['execution_stats']['total_time']:.2f}s"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("error", "Query-driven generation failed")
                    }
            
            # Fall back to original agent pipeline
            # Step 1: Query Planning Agent - Analyze request and plan FHIR queries
            query_planner = FHIRQueryPlannerAgent()
            planning_result = await query_planner.plan_queries(request, context)
            
            if not planning_result["success"]:
                return {
                    "success": False,
                    "error": f"Query planning failed: {planning_result.get('error', 'Unknown error')}"
                }
            
            query_plan = planning_result["queryPlan"]
            logger.info(f"Query plan created with {len(query_plan.get('queries', []))} queries")
            
            # Step 2: FHIR Executor Agent - Execute the planned queries
            executor = FHIRExecutorAgent(db_session)
            execution_result = await executor.execute_query_plan(query_plan)
            
            if not execution_result["success"]:
                return {
                    "success": False,
                    "error": f"Query execution failed: {execution_result.get('error', 'Unknown error')}"
                }
            
            execution_results = execution_result["executionResults"]
            logger.info(f"Query execution completed: {execution_results['executionSummary']['successful']} successful, {execution_results['executionSummary']['totalRecords']} records")
            
            # Step 3: Data Context Agent - Format data for component generation
            context_agent = DataContextAgent()
            context_result = await context_agent.format_data_context(execution_results, query_plan)
            
            if not context_result["success"]:
                return {
                    "success": False,
                    "error": f"Data context formatting failed: {context_result.get('error', 'Unknown error')}"
                }
            
            data_context = context_result["dataContext"]
            
            # Format for agent context (similar to existing format)
            formatted_context = self._format_agent_context(data_context, query_plan, execution_results)
            
            return {
                "success": True,
                "dataContext": data_context,
                "formattedContext": formatted_context,
                "queryPlan": query_plan,
                "executionResults": execution_results,
                "reasoning": f"Agent pipeline completed: {planning_result['reasoning']}, {execution_result['reasoning']}, {context_result['reasoning']}"
            }
            
        except Exception as e:
            logger.error(f"Agent pipeline error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _add_basic_fhir_context(self, request: str, context: Dict[str, Any], db_session: AsyncSession):
        """Add basic FHIR context using the original approach"""
        fhir_service = FHIRQueryService(db_session)
        
        # Parse the request to understand what data might be needed
        search_context = self._parse_request_context(request)
        
        # Get FHIR data analysis
        fhir_analysis = await fhir_service.analyze_available_data(search_context)
        
        # Add FHIR context to the request context
        context["fhirData"] = fhir_analysis
        context["fhirContext"] = fhir_service.format_for_agent_context(fhir_analysis)
        
        logger.info(f"Added basic FHIR context with {len(fhir_analysis.get('dataAvailability', {}))} data points")
    
    def _format_agent_context(self, data_context: Dict[str, Any], query_plan: Dict[str, Any], execution_results: Dict[str, Any]) -> str:
        """Format rich data context for inclusion in agent prompts"""
        context_parts = []
        
        # Add summary
        context_parts.append(f"FHIR Data Pipeline Results:")
        context_parts.append(f"- Scope: {data_context.get('scope', 'unknown')}")
        context_parts.append(f"- Total Records: {data_context.get('totalRecords', 0)}")
        context_parts.append(f"- Data Quality: {data_context.get('dataQuality', {}).get('volume', 'unknown')}")
        
        # Add resource summary
        if data_context.get("resourceSummary"):
            context_parts.append("\nAvailable FHIR Resources:")
            for resource_type, summary in data_context["resourceSummary"].items():
                context_parts.append(f"- {resource_type}: {summary['recordCount']} records ({summary['purpose']})")
        
        # Add sample data highlights
        if data_context.get("sampleData"):
            context_parts.append("\nSample Data Available:")
            for resource_type, sample in data_context["sampleData"].items():
                if sample.get("examples"):
                    context_parts.append(f"- {resource_type}: {len(sample['examples'])} examples")
                    # Add simplified example (just key fields)
                    if sample["examples"]:
                        example = sample["examples"][0]
                        # Extract only key fields to reduce token count
                        simplified_example = {
                            "id": example.get("id"),
                            "resourceType": example.get("resourceType"),
                            "code": example.get("code"),
                            "value": example.get("value"),
                            "date": example.get("date")
                        }
                        context_parts.append(f"  Example: {simplified_example}")
        
        # Add clinical context
        clinical_context = data_context.get("clinicalContext", {})
        if clinical_context:
            context_parts.append(f"\nClinical Context:")
            context_parts.append(f"- Focus: {clinical_context.get('primaryClinicalFocus', 'General')}")
            context_parts.append(f"- Domains: {', '.join(clinical_context.get('clinicalDomain', []))}")
            context_parts.append(f"- Temporal: {clinical_context.get('temporalContext', 'unknown')}")
        
        # Add component recommendations
        recommendations = data_context.get("recommendations", {})
        if recommendations.get("components"):
            context_parts.append("\nRecommended UI Components:")
            for comp in recommendations["components"][:3]:  # Top 3 recommendations only
                context_parts.append(f"- {comp['type']}: {comp['purpose']}")
        
        # Add UI hints
        ui_hints = data_context.get("uiHints", {})
        if ui_hints:
            context_parts.append(f"\nUI Generation Hints:")
            context_parts.append(f"- Layout: {ui_hints.get('layout', 'auto')}")
            context_parts.append(f"- Emphasis: {', '.join(ui_hints.get('emphasis', []))}")
            if ui_hints.get("warnings"):
                context_parts.append(f"- Warnings: {'; '.join(ui_hints['warnings'])}")
        
        return "\n".join(context_parts)
    
    def _format_orchestrator_context(self, result: Dict[str, Any]) -> str:
        """Format query-driven orchestrator results for context"""
        context_parts = []
        
        # Add execution summary
        stats = result.get("execution_stats", {})
        context_parts.append(f"Query-Driven UI Generation Results:")
        context_parts.append(f"- Total execution time: {stats.get('total_time', 0):.2f}s")
        context_parts.append(f"- Total resources: {stats.get('total_resources', 0)}")
        context_parts.append(f"- Complexity: {stats.get('complexity', 'unknown')}")
        
        # Add data analysis summary
        data_analysis = result.get("data_analysis", {})
        if data_analysis:
            context_parts.append(f"\nData Analysis:")
            context_parts.append(f"- Primary entity: {data_analysis.get('primary_entity', 'unknown')}")
            context_parts.append(f"- Resource types: {', '.join(data_analysis.get('resource_types', {}).keys())}")
            context_parts.append(f"- Relationships found: {data_analysis.get('relationships', 0)}")
            context_parts.append(f"- Has temporal data: {data_analysis.get('temporal_data', False)}")
            context_parts.append(f"- Has aggregations: {bool(data_analysis.get('aggregations', []))}")
        
        # Add UI structure recommendations
        ui_structure = result.get("ui_structure", {})
        if ui_structure:
            context_parts.append(f"\nUI Structure:")
            context_parts.append(f"- Primary pattern: {ui_structure.get('primary_pattern', 'unknown')}")
            context_parts.append(f"- Components: {', '.join(ui_structure.get('components', []))}")
            context_parts.append(f"- Layout: {ui_structure.get('layout', {}).get('type', 'unknown')}")
            context_parts.append(f"- Interactions: {', '.join(ui_structure.get('interactions', []))}")
        
        # Add reasoning
        if ui_structure.get("reasoning"):
            context_parts.append(f"\nUI Reasoning:")
            for reason in ui_structure["reasoning"]:
                context_parts.append(f"- {reason}")
        
        return "\n".join(context_parts)

# Singleton instance
ui_composer_service = UIComposerService()