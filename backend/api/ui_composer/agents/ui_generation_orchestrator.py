"""
UI Generation Orchestrator
Main orchestrator that coordinates the entire query-driven UI generation pipeline
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

from .fhir_query_planner_agent import FHIRQueryPlannerAgent
from .fhir_query_builder import FHIRQueryBuilder
from .query_orchestrator import QueryOrchestrator
from .data_relationship_mapper import DataRelationshipMapper
from .query_driven_generator import QueryDrivenGenerator

logger = logging.getLogger(__name__)

class UIGenerationOrchestrator:
    """Orchestrates the complete UI generation pipeline from query to component"""
    
    def __init__(self, base_url: str = "http://localhost:8000/fhir/R4"):
        self.base_url = base_url
        self.query_planner = FHIRQueryPlannerAgent()
        self.query_builder = FHIRQueryBuilder()
        self.query_orchestrator = QueryOrchestrator(base_url)
        self.relationship_mapper = DataRelationshipMapper()
        self.component_generator = QueryDrivenGenerator()
    
    async def generate_ui_from_request(self, 
                                      request: str, 
                                      context: Optional[Dict[str, Any]] = None,
                                      component_name: str = "GeneratedComponent",
                                      generation_mode: str = "mixed") -> Dict[str, Any]:
        """
        Complete pipeline from natural language request to generated UI component
        
        Args:
            request: Natural language description of needed UI
            context: Additional context (patient ID, user role, etc.)
            component_name: Name for the generated component
            
        Returns:
            Dict containing:
                - component_code: Generated React component code
                - query_plan: The query plan used
                - data_analysis: Analysis of the data structure
                - ui_structure: Suggested UI structure
                - execution_stats: Performance statistics
        """
        try:
            start_time = datetime.now()
            logger.info(f"Starting UI generation for request: {request}")
            
            # Step 1: Plan FHIR queries from natural language
            logger.info("Step 1: Planning FHIR queries")
            query_plan_result = await self.query_planner.plan_queries(request, context)
            
            if not query_plan_result.get('success'):
                raise Exception(f"Query planning failed: {query_plan_result.get('error', 'Unknown error')}")
            
            raw_query_plan = query_plan_result['queryPlan']
            logger.info(f"Query plan created with {len(raw_query_plan.get('queries', []))} queries")
            
            # Step 2: Build optimized query execution plan
            logger.info("Step 2: Building optimized query plan")
            
            # Convert to new format if needed
            if 'queryGraph' not in raw_query_plan:
                # Convert old format to new graph format
                query_spec = self._convert_to_graph_format(raw_query_plan)
            else:
                query_spec = raw_query_plan['queryGraph']
            
            execution_plan = self.query_builder.build_query_plan(query_spec)
            logger.info(f"Execution plan created with {len(execution_plan.nodes)} nodes")
            
            # Step 3: Execute queries and get results
            logger.info("Step 3: Executing FHIR queries")
            query_results = await self.query_orchestrator.execute_plan(execution_plan)
            
            total_resources = sum(len(r.resources) for r in query_results.values())
            logger.info(f"Queries executed, retrieved {total_resources} total resources")
            
            # Step 4: Analyze data relationships
            logger.info("Step 4: Analyzing data relationships")
            data_structure = self.relationship_mapper.analyze_query_results(query_results, raw_query_plan)
            ui_suggestions = self.relationship_mapper.suggest_ui_structure()
            
            logger.info(f"Data analysis complete: {data_structure.metrics['complexity']} complexity")
            
            # Step 5: Generate UI component with generation mode
            logger.info(f"Step 5: Generating UI component in {generation_mode} mode")
            # Create generator with specified mode
            generator = QueryDrivenGenerator(generation_mode=generation_mode)
            component_code = generator.generate_component(
                query_results,
                data_structure,
                ui_suggestions,
                component_name
            )
            
            # Collect execution statistics
            execution_time = (datetime.now() - start_time).total_seconds()
            execution_stats = {
                "total_time": execution_time,
                "query_planning_time": query_plan_result.get('planning_time', 0),
                "query_execution_stats": self.query_orchestrator.get_execution_stats(),
                "total_resources": total_resources,
                "complexity": data_structure.metrics['complexity']
            }
            
            logger.info(f"UI generation complete in {execution_time:.2f} seconds")
            
            return {
                "success": True,
                "component_code": component_code,
                "query_plan": raw_query_plan,
                "data_analysis": {
                    "resource_types": data_structure.resource_types,
                    "relationships": len(data_structure.relationships),
                    "aggregations": list(data_structure.aggregations.keys()),
                    "temporal_data": bool(data_structure.temporal_data),
                    "primary_entity": data_structure.primary_entity,
                    "metrics": data_structure.metrics
                },
                "ui_structure": ui_suggestions,
                "execution_stats": execution_stats,
                "metadata": {
                    "request": request,
                    "component_name": component_name,
                    "generation_mode": generation_mode,
                    "generation_time": datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error in UI generation pipeline: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "component_code": f"// Error generating component: {str(e)}"
            }
    
    def _convert_to_graph_format(self, old_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Convert old query format to new graph format"""
        stages = {}
        
        for i, query in enumerate(old_plan.get('queries', [])):
            stage_id = f"stage{i+1}"
            stages[stage_id] = {
                "id": stage_id,
                "resourceType": query.get('resourceType'),
                "purpose": query.get('purpose', ''),
                "filters": query.get('searchParameters', {}),
                "_include": query.get('includes', []),
                "_revinclude": query.get('revincludes', []),
                "fields": query.get('fields', [])
            }
            
            # Handle aggregations
            if query.get('aggregations'):
                stages[stage_id]['aggregate'] = query['aggregations'][0] if query['aggregations'] else {}
        
        return {
            "stages": stages,
            "execution_order": list(stages.keys()),
            "relationships": {}
        }
    
    async def generate_ui_with_specification(self, specification: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate UI from a pre-built specification (for integration with existing flow)
        """
        try:
            # Extract request from specification
            request = specification.get('request', '')
            context = specification.get('context', {})
            component_name = specification.get('components', [{}])[0].get('name', 'GeneratedComponent')
            generation_mode = specification.get('metadata', {}).get('generationMode', 'mixed')
            
            # Run the full pipeline with generation mode
            result = await self.generate_ui_from_request(request, context, component_name, generation_mode)
            
            # Merge with existing specification
            if result['success']:
                specification['metadata'] = specification.get('metadata', {})
                specification['metadata']['agentPipeline'] = {
                    'enabled': True,
                    'queryPlan': result['query_plan'],
                    'queryResults': {
                        node_id: {
                            'resourceType': qr.resource_type,
                            'resources': qr.resources,
                            'aggregated_data': qr.aggregated_data
                        }
                        for node_id, qr in result.get('query_results', {}).items()
                    },
                    'dataAnalysis': result['data_analysis'],
                    'uiStructure': result['ui_structure'],
                    'executionStats': result['execution_stats']
                }
                
                # Update component with generated code
                if specification.get('components'):
                    specification['components'][0]['generatedCode'] = result['component_code']
            
            return specification
            
        except Exception as e:
            logger.error(f"Error in specification-based generation: {e}", exc_info=True)
            return specification

# Convenience function for CLI usage
async def generate_ui_cli(request: str, patient_id: Optional[str] = None):
    """Convenience function for CLI usage"""
    orchestrator = UIGenerationOrchestrator()
    
    context = {}
    if patient_id:
        context['patientId'] = patient_id
    
    result = await orchestrator.generate_ui_from_request(request, context)
    
    if result['success']:
        print("\n=== Generated Component ===")
        print(result['component_code'])
        print("\n=== Execution Stats ===")
        print(f"Total time: {result['execution_stats']['total_time']:.2f}s")
        print(f"Total resources: {result['execution_stats']['total_resources']}")
        print(f"Complexity: {result['execution_stats']['complexity']}")
    else:
        print(f"Error: {result['error']}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python ui_generation_orchestrator.py 'request' [patient_id]")
        sys.exit(1)
    
    request = sys.argv[1]
    patient_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    asyncio.run(generate_ui_cli(request, patient_id))