#!/usr/bin/env python3
"""
Test with a query that will definitely find data
"""

import asyncio
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.agents.ui_generation_orchestrator import UIGenerationOrchestrator

async def test_all_observations():
    """Test with a broad query for all observations"""
    
    # Broad request that should find data
    request = "Show me all recent observations and vital signs for any patients"
    
    context = {
        "userRole": "clinician",
        "useQueryDriven": True,
        "scope": "population",
        "dateRange": "all"  # Don't restrict by date
    }
    
    logger.info(f"Request: {request}")
    
    orchestrator = UIGenerationOrchestrator()
    result = await orchestrator.generate_ui_from_request(request, context)
    
    if result["success"]:
        logger.info("✅ Generation successful!")
        stats = result['execution_stats']
        logger.info(f"\n📊 Results:")
        logger.info(f"  - Total resources: {stats['total_resources']}")
        logger.info(f"  - Query time: {stats['total_time']:.2f}s")
        logger.info(f"  - Complexity: {stats['complexity']}")
        
        # Show what was found
        data_analysis = result["data_analysis"]
        logger.info(f"\n📈 Data Analysis:")
        for resource_type, count in data_analysis.get("resource_types", {}).items():
            logger.info(f"  - {resource_type}: {count} resources")
        
        # Show UI structure
        ui_structure = result["ui_structure"]
        logger.info(f"\n🎨 UI Structure:")
        logger.info(f"  - Pattern: {ui_structure['primary_pattern']}")
        logger.info(f"  - Components: {', '.join(ui_structure['components'])}")
        
        # Save component
        output_file = Path("generated_all_observations_component.js")
        output_file.write_text(result["component_code"])
        logger.info(f"\n💾 Component saved to: {output_file}")
        
        # Show a preview of the component
        lines = result["component_code"].split('\n')
        logger.info(f"\n📝 Component Preview (lines 80-120):")
        for i, line in enumerate(lines[80:120], 80):
            logger.info(f"  {i:3d}: {line}")
            
    else:
        logger.error(f"❌ Generation failed: {result.get('error')}")

if __name__ == "__main__":
    asyncio.run(test_all_observations())