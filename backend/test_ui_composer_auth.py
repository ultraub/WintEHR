#!/usr/bin/env python3
"""Test UI Composer with auth token fix"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test_ui_composer():
    """Test the UI Composer with auth fix"""
    
    service = UIComposerService()
    
    # Simple request first
    request = "show me patient vital signs"
    context = {"generationMode": "mixed"}
    
    print("Testing UI Composer with simple request...")
    print(f"Request: {request}")
    print(f"Mode: {context['generationMode']}\n")
    
    try:
        # Step 1: Analyze
        print("Step 1: Analyzing request...")
        result = await service.analyze_request(request, context, method="cli")
        
        if result["success"]:
            print("✓ Analysis successful!")
            analysis = result.get("analysis", {})
            print(f"  Intent: {analysis.get('intent', 'N/A')}")
            print(f"  Components: {len(analysis.get('components', []))}")
            
            # Step 2: Generate a simple component
            print("\nStep 2: Generating component...")
            specification = {
                "metadata": {
                    "name": "Vital Signs Display",
                    "generationMode": "mixed"
                },
                "components": [{
                    "type": "stat",
                    "props": {"title": "Latest Vital Signs"},
                    "dataBinding": {"resourceType": "Observation"}
                }]
            }
            
            components = await service.generate_components(specification, method="cli")
            
            for comp_id, comp_code in components.items():
                if comp_code.startswith("// Error"):
                    print(f"✗ Component {comp_id} error:\n{comp_code}")
                else:
                    print(f"✓ Component {comp_id} generated!")
                    print(f"  Length: {len(comp_code)} chars")
                    print(f"  Has React: {'import React' in comp_code}")
                    print(f"  First 200 chars:\n{comp_code[:200]}...")
        else:
            print(f"✗ Analysis failed: {result.get('error')}")
            
    except Exception as e:
        print(f"✗ Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Testing UI Composer with authentication fix...\n")
    asyncio.run(test_ui_composer())