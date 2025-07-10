#!/usr/bin/env python3
"""Test UI Composer with shortened prompts"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test():
    service = UIComposerService()
    
    # Test 1: Simple analysis
    print("1. Testing simple analysis...")
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
            print("\n2. Testing component generation...")
            specification = {
                "metadata": {"generationMode": "mixed"},
                "components": [{
                    "type": "stat",
                    "props": {"title": "Vital Signs"},
                    "dataBinding": {"resourceType": "Observation"}
                }]
            }
            
            components = await service.generate_components(specification, method="cli")
            
            for comp_id, comp_code in components.items():
                if comp_code.startswith("// Error"):
                    print(f"   ✗ Error: {comp_code[:100]}")
                else:
                    print(f"   ✓ Generated {len(comp_code)} chars")
                    print(f"   Has imports: {'import' in comp_code}")
                    print(f"   First 3 lines:")
                    for line in comp_code.split('\n')[:3]:
                        print(f"     {line}")
                        
        else:
            print(f"   ✗ Analysis failed: {result.get('error')}")
            
    except Exception as e:
        print(f"   ✗ Exception: {e}")
        import traceback
        traceback.print_exc()

async def test_hypertension():
    """Test the original hypertension request"""
    print("\n3. Testing hypertension request...")
    
    service = UIComposerService()
    request = "show me patients with high blood pressure and their corresponding risk of stroke"
    context = {"generationMode": "full"}
    
    try:
        result = await service.analyze_request(request, context, method="cli")
        
        if result["success"]:
            print("   ✓ Analysis successful!")
            analysis = result.get("analysis", {})
            
            # Just test generating first component
            if analysis.get("components"):
                print("\n4. Generating first component...")
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
                        
    except Exception as e:
        print(f"   ✗ Exception: {e}")

if __name__ == "__main__":
    print("Testing UI Composer with concise prompts...\n")
    asyncio.run(test())
    asyncio.run(test_hypertension())