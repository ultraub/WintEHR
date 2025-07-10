#!/usr/bin/env python3
"""Final test of UI Composer with all fixes"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test_simple_request():
    """Test with a simple request first"""
    
    service = UIComposerService()
    
    # Start with a simple request
    request = "show patient vital signs"
    context = {"generationMode": "mixed"}
    
    print("Testing simple request first...")
    print(f"Request: {request}")
    print(f"Mode: {context['generationMode']}\n")
    
    try:
        # Analyze
        print("1. Analyzing request...")
        result = await service.analyze_request(request, context, method="cli")
        
        if result["success"]:
            print("✓ Analysis successful!")
            analysis = result.get("analysis", {})
            print(f"  Components: {len(analysis.get('components', []))}")
            
            # Generate
            print("\n2. Generating components...")
            specification = {
                "metadata": {
                    "name": "Vital Signs Display",
                    "generationMode": context["generationMode"]
                },
                "components": analysis.get("components", [])[:1]  # Just first component
            }
            
            components = await service.generate_components(specification, method="cli")
            
            for comp_id, comp_code in components.items():
                if comp_code.startswith("// Error"):
                    print(f"✗ Error: {comp_code[:200]}")
                else:
                    print(f"✓ Generated {len(comp_code)} chars")
                    print(f"  Has React: {'import React' in comp_code}")
                    print(f"  First line: {comp_code.split(chr(10))[0]}")
                    
            return True
        else:
            print(f"✗ Analysis failed: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"✗ Exception: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_hypertension_request():
    """Test the original hypertension request"""
    
    print("\n\nTesting hypertension request...")
    
    service = UIComposerService()
    
    request = "show me patients with high blood pressure and their corresponding risk of stroke"
    context = {"generationMode": "full"}
    
    print(f"Request: {request}")
    print(f"Mode: {context['generationMode']}\n")
    
    try:
        # Analyze
        print("1. Analyzing request...")
        result = await service.analyze_request(request, context, method="cli")
        
        if result["success"]:
            print("✓ Analysis successful!")
            analysis = result.get("analysis", {})
            print(f"  Intent: {analysis.get('intent', 'N/A')}")
            print(f"  Components: {len(analysis.get('components', []))}")
            
            # Generate only if analysis worked
            print("\n2. Generating components...")
            specification = {
                "metadata": {
                    "name": "Hypertension Risk Dashboard",
                    "generationMode": "full",
                    "description": request
                },
                "layout": analysis.get("layout", {"type": "dashboard"}),
                "components": analysis.get("components", [])[:2]  # Limit to 2 components for testing
            }
            
            components = await service.generate_components(specification, method="cli")
            
            success_count = 0
            for comp_id, comp_code in components.items():
                if comp_code.startswith("// Error"):
                    print(f"\n✗ Component {comp_id} error:")
                    print(comp_code[:500])
                else:
                    success_count += 1
                    print(f"\n✓ Component {comp_id} success!")
                    print(f"  Length: {len(comp_code)} chars")
                    print(f"  Has hypertension code: {'38341003' in comp_code}")
                    
            print(f"\n✓ Generated {success_count}/{len(components)} components successfully")
            
        else:
            print(f"✗ Analysis failed: {result.get('error')}")
            
    except Exception as e:
        print(f"✗ Exception: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Run all tests"""
    
    # Test simple request first
    simple_success = await test_simple_request()
    
    if simple_success:
        # If simple worked, try complex
        await test_hypertension_request()
    else:
        print("\n✗ Skipping complex test since simple test failed")

if __name__ == "__main__":
    print("Final UI Composer test with all fixes applied...\n")
    asyncio.run(main())