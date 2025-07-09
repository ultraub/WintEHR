#!/usr/bin/env python3
"""
Test without date filters to ensure we get data
"""

import asyncio
import logging
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.agents.fhir_query_builder import FHIRQueryBuilder, QueryNode, QueryPlan
from api.ui_composer.agents.query_orchestrator import QueryOrchestrator
from api.ui_composer.agents.data_relationship_mapper import DataRelationshipMapper
from api.ui_composer.agents.query_driven_generator import QueryDrivenGenerator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_direct_query():
    """Test directly with query orchestrator to bypass date filters"""
    
    # Create a simple query plan
    nodes = [
        QueryNode(
            id="observations",
            resource_type="Observation",
            filters={
                "_count": "100",
                "_sort": "-date"
            },
            includes=["Observation:subject"]
        ),
        QueryNode(
            id="patients", 
            resource_type="Patient",
            filters={
                "_count": "10"
            }
        )
    ]
    
    plan = QueryPlan(
        nodes=nodes,
        execution_order=["observations", "patients"],
        relationships={}
    )
    
    # Execute the plan
    orchestrator = QueryOrchestrator()
    results = await orchestrator.execute_plan(plan)
    
    total = sum(len(r.resources) for r in results.values())
    logger.info(f"✅ Found {total} total resources")
    
    if total > 0:
        # Analyze relationships
        mapper = DataRelationshipMapper()
        data_structure = mapper.analyze_query_results(results, {"queries": []})
        ui_suggestions = mapper.suggest_ui_structure()
        
        logger.info(f"📊 Data structure: {data_structure.metrics}")
        logger.info(f"🎨 UI suggestions: {ui_suggestions['primary_pattern']}")
        
        # Generate component
        generator = QueryDrivenGenerator()
        component = generator.generate_component(
            results,
            data_structure,
            ui_suggestions,
            "ObservationsDashboard"
        )
        
        # Save it
        with open("generated_direct_query_component.js", "w") as f:
            f.write(component)
        
        logger.info("💾 Component saved!")
        
        # Show sample data
        for node_id, result in results.items():
            if result.resources:
                logger.info(f"\n📋 Sample {result.resource_type}:")
                sample = result.resources[0]
                if result.resource_type == "Observation":
                    code = sample.get("code", {}).get("coding", [{}])[0]
                    logger.info(f"  - Code: {code.get('code')} - {code.get('display')}")
                    logger.info(f"  - Value: {sample.get('valueQuantity')}")
                    logger.info(f"  - Date: {sample.get('effectiveDateTime')}")
                elif result.resource_type == "Patient":
                    name = sample.get("name", [{}])[0]
                    logger.info(f"  - Name: {name.get('given', [])} {name.get('family')}")
                    logger.info(f"  - Birth: {sample.get('birthDate')}")
                    logger.info(f"  - Gender: {sample.get('gender')}")

if __name__ == "__main__":
    asyncio.run(test_direct_query())