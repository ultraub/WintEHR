#!/usr/bin/env python3
"""
Simple test for query-driven UI generation with known data
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

async def test_simple_patient_vitals():
    """Test with a simple patient vitals query"""
    
    # First, let's get a patient ID that has data
    import httpx
    async with httpx.AsyncClient() as client:
        # Get a patient with observations
        response = await client.get("http://localhost:8000/fhir/R4/Observation?_count=1")
        data = response.json()
        
        if data.get("entry"):
            # Extract patient ID from first observation
            obs = data["entry"][0]["resource"]
            patient_ref = obs.get("subject", {}).get("reference", "")
            if "/" in patient_ref:
                patient_id = patient_ref.split("/")[1]
                logger.info(f"Using patient ID: {patient_id}")
            else:
                logger.error("No patient reference found")
                return
        else:
            logger.error("No observations found")
            return
    
    # Simple request for vital signs
    request = f"Show me vital signs and recent lab results for patient {patient_id}"
    
    context = {
        "userRole": "clinician",
        "useQueryDriven": True,
        "patientId": patient_id,
        "scope": "patient"
    }
    
    logger.info(f"Request: {request}")
    
    orchestrator = UIGenerationOrchestrator()
    result = await orchestrator.generate_ui_from_request(request, context)
    
    if result["success"]:
        logger.info("✅ Generation successful!")
        logger.info(f"Total resources: {result['execution_stats']['total_resources']}")
        logger.info(f"UI Pattern: {result['ui_structure']['primary_pattern']}")
        
        # Save component
        output_file = Path("generated_patient_vitals_component.js")
        output_file.write_text(result["component_code"])
        logger.info(f"Component saved to: {output_file}")
        
        # Show summary of what was found
        data_analysis = result["data_analysis"]
        logger.info(f"\nData found:")
        for resource_type, count in data_analysis.get("resource_types", {}).items():
            logger.info(f"  - {resource_type}: {count} resources")
    else:
        logger.error(f"Generation failed: {result.get('error')}")

if __name__ == "__main__":
    asyncio.run(test_simple_patient_vitals())