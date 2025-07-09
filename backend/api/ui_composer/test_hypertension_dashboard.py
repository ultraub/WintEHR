#!/usr/bin/env python3
"""
Test hypertension dashboard generation
Verifies that the correct medical domain is used and real FHIR data is queried
"""

import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.ui_composer_service import ui_composer_service

async def test_hypertension_dashboard():
    """Test full hypertension dashboard generation flow"""
    
    logger.info("=" * 80)
    logger.info("🧪 TESTING HYPERTENSION DASHBOARD WITH FULL GENERATION MODE")
    logger.info("=" * 80)
    
    # Step 1: Analyze the request
    request = "show me patients with high blood pressure, and their corresponding stroke risk"
    context = {
        "generationMode": "full",
        "scope": "population"
    }
    
    logger.info(f"Request: {request}")
    logger.info("Mode: FULL")
    
    # Analyze phase
    analyze_result = await ui_composer_service.analyze_request(
        request, 
        context,
        method="cli"
    )
    
    if not analyze_result.get("success"):
        logger.error(f"Analysis failed: {analyze_result.get('error')}")
        return
    
    specification = analyze_result.get("analysis")
    logger.info(f"\n✅ Analysis complete:")
    logger.info(f"  - Intent: {specification.get('intent')}")
    logger.info(f"  - Components: {len(specification.get('components', []))}")
    logger.info(f"  - Layout: {specification.get('layoutType')}")
    
    # Build full specification for generation
    full_spec = {
        "version": "1.0",
        "metadata": {
            "name": "Hypertension & Stroke Risk Dashboard",
            "description": specification.get("intent"),
            "generationMode": "full",
            "clinicalContext": {
                "scope": specification.get("scope"),
                "dataRequirements": specification.get("requiredData")
            }
        },
        "layout": {
            "type": specification.get("layoutType"),
            "structure": specification.get("layout")
        },
        "components": specification.get("components", [])
    }
    
    # Add agent pipeline data if available
    if analyze_result.get("agentPipelineData"):
        full_spec["metadata"]["agentPipeline"] = analyze_result["agentPipelineData"]
    
    logger.info(f"\n📋 Specification built with {len(full_spec['components'])} components")
    
    # Generate phase
    try:
        components = await ui_composer_service.generate_components(
            full_spec,
            method="cli"
        )
        
        logger.info(f"\n✅ Generation completed")
        
        # Analyze the generated component
        main_component = components.get("main", "")
        
        logger.info("\n📊 Component Analysis:")
        
        # Check for key indicators
        checks = {
            "Is React code": any(keyword in main_component for keyword in ['import React', 'export default', 'const ']),
            "Uses FHIR hooks": 'usePatientResources' in main_component or 'fhirService' in main_component,
            "Queries blood pressure": any(code in main_component for code in ['85354-9', '8480-6', '8462-4']),
            "Queries hypertension": any(code in main_component for code in ['38341003', '59621000', '1201005']),
            "No A1C references": 'A1C' not in main_component and '4548-4' not in main_component,
            "No mock patients": all(mock not in main_component for mock in ['Patient A', 'Patient B', 'Patient C']),
            "Uses real patient names": 'patient.name[0]' in main_component or 'name?.[0]' in main_component,
            "Population query": 'fhirService.searchResources' in main_component,
            "All components present": all(comp['props']['title'] in main_component for comp in full_spec['components'][:3])
        }
        
        for check, result in checks.items():
            logger.info(f"  - {check}: {'✅' if result else '❌'}")
        
        # Count specific elements
        logger.info("\n📈 Component Metrics:")
        logger.info(f"  - Total lines: {len(main_component.splitlines())}")
        logger.info(f"  - Import statements: {main_component.count('import ')}")
        logger.info(f"  - Chart components: {main_component.count('Chart')}")
        logger.info(f"  - Grid/Table references: {main_component.count('Table') + main_component.count('DataGrid')}")
        logger.info(f"  - FHIR service calls: {main_component.count('fhirService.')}")
        
        # Check for specific hypertension elements
        hypertension_elements = [
            ('Blood pressure mentioned', 'blood pressure' in main_component.lower()),
            ('Stroke risk mentioned', 'stroke' in main_component.lower()),
            ('Hypertension codes present', any(code in main_component for code in ['38341003', '59621000'])),
            ('BP observation codes present', any(code in main_component for code in ['8480-6', '8462-4'])),
            ('Risk calculation logic', 'calculateStrokeRisk' in main_component or 'riskScore' in main_component)
        ]
        
        logger.info("\n🏥 Medical Domain Verification:")
        for element, present in hypertension_elements:
            logger.info(f"  - {element}: {'✅' if present else '❌'}")
        
        # Save the generated component
        output_file = Path("test_hypertension_dashboard_output.js")
        output_file.write_text(main_component)
        logger.info(f"\n💾 Saved to: {output_file}")
        
        # Show preview of key sections
        logger.info("\n📝 Key Code Sections:")
        
        # Find and show FHIR queries
        lines = main_component.splitlines()
        for i, line in enumerate(lines):
            if 'fhirService.searchResources' in line:
                logger.info(f"\nFHIR Query at line {i+1}:")
                for j in range(max(0, i-2), min(len(lines), i+5)):
                    logger.info(f"  {lines[j]}")
                    
        # Check if all specified components are included
        logger.info("\n🧩 Component Inclusion Check:")
        for comp in full_spec['components']:
            title = comp['props'].get('title', '')
            if title:
                included = title in main_component
                logger.info(f"  - {title}: {'✅' if included else '❌'}")
                
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(test_hypertension_dashboard())