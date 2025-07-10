#!/usr/bin/env python3
"""Test UI Composer with sync workaround"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test():
    service = UIComposerService()
    
    print("Testing UI Composer with sync workaround...\n")
    
    # Test 1: Simple request
    print("1. Testing simple analysis:")
    request = "show patient vital signs"
    context = {"generationMode": "mixed"}
    
    try:
        result = await service.analyze_request(request, context, method="cli")
        
        if result["success"]:
            print("   ✓ Analysis successful!")
            analysis = result.get("analysis", {})
            print(f"   Intent: {analysis.get('intent')}")
            print(f"   Components: {len(analysis.get('components', []))}")
            
            # Test 2: Generate component
            print("\n2. Testing component generation:")
            specification = {
                "metadata": {"generationMode": "mixed"},
                "components": analysis.get("components", [])[:1]
            }
            
            components = await service.generate_components(specification, method="cli")
            
            for comp_id, comp_code in components.items():
                if comp_code.startswith("// Error"):
                    print(f"   ✗ Error: {comp_code[:200]}")
                else:
                    print(f"   ✓ Generated {len(comp_code)} chars")
                    print(f"   Has React: {'import React' in comp_code}")
                    
        else:
            print(f"   ✗ Failed: {result.get('error')}")
            
    except Exception as e:
        print(f"   ✗ Exception: {e}")
        import traceback
        traceback.print_exc()

async def test_hypertension():
    """Test the original hypertension request"""
    print("\n3. Testing hypertension request:")
    
    service = UIComposerService()
    
    request = "show me patients with high blood pressure and their corresponding risk of stroke"
    context = {"generationMode": "full"}
    
    try:
        result = await service.analyze_request(request, context, method="cli")
        
        if result["success"]:
            print("   ✓ Analysis successful!")
            analysis = result.get("analysis", {})
            print(f"   Intent: {analysis.get('intent')}")
            print(f"   Scope: {analysis.get('scope')}")
            print(f"   Components: {len(analysis.get('components', []))}")
            
            # Generate first component
            if analysis.get("components"):
                print("\n4. Generating first component:")
                specification = {
                    "metadata": {"generationMode": "full"},
                    "components": [analysis["components"][0]]
                }
                
                components = await service.generate_components(specification, method="cli")
                
                for comp_id, comp_code in components.items():
                    if comp_code.startswith("// Error"):
                        print(f"   ✗ Error: {comp_code}")
                    else:
                        print(f"   ✓ Success! Generated {len(comp_code)} chars")
                        # Check for hypertension-related code
                        has_hypertension = any(term in comp_code.lower() for term in ['hypertension', 'blood pressure', '38341003'])
                        print(f"   Has hypertension code: {has_hypertension}")
                        
        else:
            print(f"   ✗ Failed: {result.get('error')}")
            
    except Exception as e:
        print(f"   ✗ Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Testing UI Composer with sync subprocess workaround...\n")
    asyncio.run(test())
    asyncio.run(test_hypertension())