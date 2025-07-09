#!/usr/bin/env python3
"""
Simplified test for hypertension and stroke risk with direct queries
"""

import asyncio
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.agents.fhir_query_builder import QueryNode, QueryPlan
from api.ui_composer.agents.query_orchestrator import QueryOrchestrator
from api.ui_composer.agents.data_relationship_mapper import DataRelationshipMapper
from api.ui_composer.agents.query_driven_generator import QueryDrivenGenerator

async def test_with_working_queries():
    """Test with queries that will actually work on the server"""
    
    logger.info("=" * 80)
    logger.info("🔍 TESTING: Hypertension & Stroke Risk Query")
    logger.info("=" * 80)
    
    # First, let's do a simple query to find what data we have
    logger.info("\n1️⃣ First, let's see what conditions exist...")
    
    nodes = [
        QueryNode(
            id="all_conditions",
            resource_type="Condition",
            filters={
                "_count": "20",
                "_sort": "-_lastUpdated"
            }
        ),
        QueryNode(
            id="blood_pressure_obs",
            resource_type="Observation",
            filters={
                "code": "85354-9",  # Blood pressure panel
                "_count": "20",
                "_sort": "-date"
            }
        )
    ]
    
    plan = QueryPlan(
        nodes=nodes,
        execution_order=["all_conditions", "blood_pressure_obs"],
        relationships={}
    )
    
    orchestrator = QueryOrchestrator()
    results = await orchestrator.execute_plan(plan)
    
    # Show what we found
    logger.info("\n📊 Data Found:")
    for node_id, result in results.items():
        if result.resources:
            logger.info(f"\n{node_id}: {len(result.resources)} resources")
            if node_id == "all_conditions":
                # Show unique condition types
                conditions = {}
                for r in result.resources:
                    code = r.get("code", {}).get("coding", [{}])[0]
                    display = code.get("display", "Unknown")
                    conditions[display] = conditions.get(display, 0) + 1
                
                logger.info("Condition types found:")
                for condition, count in sorted(conditions.items())[:10]:
                    logger.info(f"  - {condition}: {count}")
                    
            elif node_id == "blood_pressure_obs":
                # Show sample BP values
                logger.info("Sample blood pressure readings:")
                for r in result.resources[:5]:
                    patient_ref = r.get("subject", {}).get("reference", "Unknown")
                    date = r.get("effectiveDateTime", "Unknown")
                    
                    # Extract BP values from components
                    systolic = diastolic = None
                    for component in r.get("component", []):
                        code = component.get("code", {}).get("coding", [{}])[0].get("code")
                        if code == "8480-6":  # Systolic
                            systolic = component.get("valueQuantity", {}).get("value")
                        elif code == "8462-4":  # Diastolic
                            diastolic = component.get("valueQuantity", {}).get("value")
                    
                    logger.info(f"  - Patient: {patient_ref}, Date: {date}, BP: {systolic}/{diastolic}")
    
    # Now create a more realistic query plan based on what we found
    logger.info("\n2️⃣ Creating targeted query for hypertension and risk factors...")
    
    # Look for essential hypertension and related conditions
    hypertension_nodes = [
        QueryNode(
            id="hypertension",
            resource_type="Condition",
            filters={
                "code": "59621000",  # Essential hypertension
                "_count": "100"
            }
        ),
        QueryNode(
            id="all_bp_readings",
            resource_type="Observation",
            filters={
                "code": "85354-9",  # Blood pressure panel
                "_count": "100",
                "_sort": "-date"
            }
        ),
        QueryNode(
            id="patients",
            resource_type="Patient",
            filters={
                "_count": "20"
            }
        )
    ]
    
    hypertension_plan = QueryPlan(
        nodes=hypertension_nodes,
        execution_order=["hypertension", "all_bp_readings", "patients"],
        relationships={}
    )
    
    logger.info("\n3️⃣ Executing hypertension-focused queries...")
    hypertension_results = await orchestrator.execute_plan(hypertension_plan)
    
    total_resources = sum(len(r.resources) for r in hypertension_results.values())
    logger.info(f"\n✅ Found {total_resources} total resources")
    
    if total_resources > 0:
        # Analyze and generate component
        logger.info("\n4️⃣ Analyzing data relationships...")
        mapper = DataRelationshipMapper()
        data_structure = mapper.analyze_query_results(hypertension_results, {"queries": []})
        ui_suggestions = mapper.suggest_ui_structure()
        
        logger.info(f"Data complexity: {data_structure.metrics['complexity']}")
        logger.info(f"UI pattern: {ui_suggestions['primary_pattern']}")
        
        # Generate component
        logger.info("\n5️⃣ Generating UI component...")
        generator = QueryDrivenGenerator()
        component_code = generator.generate_component(
            hypertension_results,
            data_structure,
            ui_suggestions,
            "HypertensionStrokeRiskDashboard"
        )
        
        # Save it
        output_file = Path("generated_hypertension_dashboard.js")
        output_file.write_text(component_code)
        logger.info(f"\n💾 Component saved to: {output_file}")
        
        # Analyze component for relevance
        logger.info("\n6️⃣ Component Analysis:")
        
        # Count relevant keywords
        bp_count = component_code.lower().count("blood pressure") + component_code.lower().count("85354-9")
        hypertension_count = component_code.lower().count("hypertension") + component_code.lower().count("59621000")
        
        logger.info(f"  - Blood pressure references: {bp_count}")
        logger.info(f"  - Hypertension references: {hypertension_count}")
        logger.info(f"  - Component size: {len(component_code.splitlines())} lines")
        
        # Show component preview
        logger.info("\n📝 Component Preview (lines 100-130):")
        lines = component_code.splitlines()
        for i in range(100, min(130, len(lines))):
            logger.info(f"  {i}: {lines[i]}")

if __name__ == "__main__":
    asyncio.run(test_with_working_queries())