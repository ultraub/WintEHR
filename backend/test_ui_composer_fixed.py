#!/usr/bin/env python3
"""Test UI Composer with fixed Claude CLI path"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test_ui_composer():
    """Test the full UI Composer flow"""
    
    service = UIComposerService()
    
    # Original request that was failing
    request = "show me patients with high blood pressure and their corresponding risk of stroke"
    
    context = {
        "generationMode": "full"
    }
    
    print("Testing UI Composer with request:", request)
    print("Generation mode:", context["generationMode"])
    print()
    
    # Step 1: Analyze request
    print("Step 1: Analyzing request...")
    try:
        analysis_result = await service.analyze_request(request, context, method="cli")
        
        if analysis_result["success"]:
            print("✓ Analysis successful!")
            analysis = analysis_result.get("analysis", {})
            print(f"  Intent: {analysis.get('intent', 'N/A')}")
            print(f"  Scope: {analysis.get('scope', 'N/A')}")
            print(f"  Layout type: {analysis.get('layoutType', 'N/A')}")
            print(f"  Required data: {analysis.get('requiredData', [])}")
            print(f"  Number of components: {len(analysis.get('components', []))}")
        else:
            print("✗ Analysis failed:", analysis_result.get("error"))
            return
    except Exception as e:
        print(f"✗ Analysis exception: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Step 2: Generate components
    print("\nStep 2: Generating components...")
    
    # Create specification from analysis
    specification = {
        "metadata": {
            "name": "Hypertension Risk Dashboard",
            "generationMode": "full",
            "description": request
        },
        "layout": analysis.get("layout", {"type": "dashboard"}),
        "components": analysis.get("components", [])
    }
    
    try:
        components = await service.generate_components(specification, method="cli")
        
        print(f"✓ Generated {len(components)} components")
        
        for comp_id, comp_code in components.items():
            if comp_code.startswith("// Error"):
                print(f"✗ Component {comp_id} has error:")
                print(comp_code[:500])
            else:
                print(f"✓ Component {comp_id} generated successfully")
                print(f"  Code length: {len(comp_code)} characters")
                print(f"  Has React import: {'import React' in comp_code}")
                print(f"  Has export: {'export default' in comp_code}")
                
    except Exception as e:
        print(f"✗ Generation exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Testing UI Composer with fixed Claude CLI path...\n")
    asyncio.run(test_ui_composer())