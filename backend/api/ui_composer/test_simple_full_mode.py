#!/usr/bin/env python3
"""
Simple test for Full Generation Mode
"""

import asyncio
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.agents.ui_generation_orchestrator import UIGenerationOrchestrator

async def test_simple_full_mode():
    """Test Full Generation Mode with a simple query"""
    
    logger.info("=" * 60)
    logger.info("🎨 TESTING FULL GENERATION MODE - SIMPLE")
    logger.info("=" * 60)
    
    request = "Show patient blood pressure readings with trend analysis"
    
    orchestrator = UIGenerationOrchestrator()
    
    context = {
        "userRole": "clinician",
        "scope": "patient"
    }
    
    logger.info(f"Request: {request}")
    logger.info("Mode: FULL")
    
    result = await orchestrator.generate_ui_from_request(
        request,
        context,
        component_name="BloodPressureTrends",
        generation_mode="full"
    )
    
    if result['success']:
        logger.info("\n✅ SUCCESS!")
        
        # Analyze component
        component_code = result['component_code']
        
        logger.info("\n🔍 Component Features:")
        logger.info(f"  - Uses usePatientResources: {'✓' if 'usePatientResources' in component_code else '✗'}")
        logger.info(f"  - Uses WebSocket: {'✓' if 'useWebSocket' in component_code else '✗'}")
        logger.info(f"  - Has animations: {'✓' if 'framer-motion' in component_code else '✗'}")
        logger.info(f"  - Component size: {len(component_code.splitlines())} lines")
        
        # Save component
        output_file = Path("test_full_mode_blood_pressure.js")
        output_file.write_text(component_code)
        logger.info(f"\n💾 Saved to: {output_file}")
        
        # Show imports section
        logger.info("\n📦 Imports Section:")
        lines = component_code.splitlines()
        for i, line in enumerate(lines):
            if line.strip() and not line.startswith('import'):
                break
            if line.strip():
                logger.info(f"  {line}")
        
        # Find FHIR hooks usage
        logger.info("\n🔗 FHIR Hooks Usage:")
        for i, line in enumerate(lines):
            if 'usePatientResources' in line and 'import' not in line:
                logger.info(f"  Line {i+1}: {line.strip()}")
                
    else:
        logger.error(f"❌ FAILED: {result.get('error')}")

if __name__ == "__main__":
    asyncio.run(test_simple_full_mode())