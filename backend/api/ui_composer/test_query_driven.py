#!/usr/bin/env python3
"""
Test script for query-driven UI generation
Tests the hypertension/stroke risk query scenario
"""

import asyncio
import json
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add parent directory to path
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.agents.ui_generation_orchestrator import UIGenerationOrchestrator

async def test_hypertension_stroke_query():
    """Test the hypertension/stroke risk query"""
    
    # Test request - the one mentioned by the user
    request = "show me all patients with high blood pressure and their risk of stroke"
    
    # Context for the query
    context = {
        "userRole": "clinician",
        "useQueryDriven": True,  # Use the new system
        "scope": "population"  # Looking across patients
    }
    
    logger.info("=" * 80)
    logger.info("Testing Query-Driven UI Generation")
    logger.info("=" * 80)
    logger.info(f"Request: {request}")
    logger.info(f"Context: {json.dumps(context, indent=2)}")
    logger.info("=" * 80)
    
    # Create orchestrator
    orchestrator = UIGenerationOrchestrator()
    
    # Run the generation
    result = await orchestrator.generate_ui_from_request(request, context)
    
    if result["success"]:
        logger.info("\n✅ Generation Successful!")
        
        # Display execution stats
        stats = result["execution_stats"]
        logger.info(f"\n📊 Execution Statistics:")
        logger.info(f"  - Total time: {stats['total_time']:.2f}s")
        logger.info(f"  - Total resources: {stats['total_resources']}")
        logger.info(f"  - Complexity: {stats['complexity']}")
        
        # Display query plan
        query_plan = result["query_plan"]
        logger.info(f"\n🔍 Query Plan:")
        logger.info(f"  - Scope: {query_plan.get('scope', 'unknown')}")
        logger.info(f"  - Reasoning: {query_plan.get('reasoning', 'N/A')}")
        
        if query_plan.get("queryGraph"):
            stages = query_plan["queryGraph"].get("stages", {})
            logger.info(f"  - Query stages: {len(stages)}")
            for stage_id, stage in stages.items():
                logger.info(f"    - {stage_id}: {stage.get('resourceType')} - {stage.get('purpose')}")
        
        # Display data analysis
        data_analysis = result["data_analysis"]
        logger.info(f"\n📈 Data Analysis:")
        logger.info(f"  - Primary entity: {data_analysis.get('primary_entity')}")
        logger.info(f"  - Resource types: {list(data_analysis.get('resource_types', {}).keys())}")
        logger.info(f"  - Relationships: {data_analysis.get('relationships')}")
        logger.info(f"  - Has temporal data: {data_analysis.get('temporal_data')}")
        logger.info(f"  - Metrics: {data_analysis.get('metrics')}")
        
        # Display UI structure
        ui_structure = result["ui_structure"]
        logger.info(f"\n🎨 UI Structure:")
        logger.info(f"  - Primary pattern: {ui_structure.get('primary_pattern')}")
        logger.info(f"  - Components: {ui_structure.get('components')}")
        logger.info(f"  - Layout: {ui_structure.get('layout')}")
        logger.info(f"  - Interactions: {ui_structure.get('interactions')}")
        logger.info(f"  - Reasoning: {ui_structure.get('reasoning')}")
        
        # Save component code
        component_code = result["component_code"]
        output_file = Path("generated_hypertension_component.js")
        output_file.write_text(component_code)
        logger.info(f"\n💾 Component saved to: {output_file}")
        
        # Show first few lines of generated component
        lines = component_code.split('\n')[:20]
        logger.info(f"\n📝 Generated Component Preview:")
        for line in lines:
            logger.info(f"  {line}")
        logger.info("  ...")
        
    else:
        logger.error(f"\n❌ Generation Failed: {result.get('error')}")
        logger.error(f"Component code: {result.get('component_code')}")

async def test_specific_patient_query():
    """Test a patient-specific query"""
    
    request = "show me the blood pressure trends and stroke risk factors for patient 87a339d0-6c1e-3d5f-5b48-c7d1a67cf872"
    
    context = {
        "userRole": "clinician",
        "useQueryDriven": True,
        "patientId": "87a339d0-6c1e-3d5f-5b48-c7d1a67cf872",
        "scope": "patient"
    }
    
    logger.info("\n" + "=" * 80)
    logger.info("Testing Patient-Specific Query")
    logger.info("=" * 80)
    logger.info(f"Request: {request}")
    
    orchestrator = UIGenerationOrchestrator()
    result = await orchestrator.generate_ui_from_request(request, context)
    
    if result["success"]:
        logger.info("✅ Patient-specific generation successful!")
        output_file = Path("generated_patient_bp_component.js")
        output_file.write_text(result["component_code"])
        logger.info(f"💾 Component saved to: {output_file}")
    else:
        logger.error(f"❌ Generation Failed: {result.get('error')}")

async def main():
    """Run all tests"""
    
    # Test 1: Population-level hypertension query
    await test_hypertension_stroke_query()
    
    # Test 2: Patient-specific query
    # await test_specific_patient_query()

if __name__ == "__main__":
    asyncio.run(main())