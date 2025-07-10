#!/usr/bin/env python3
"""Test UI Composer without database session"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test():
    service = UIComposerService()
    
    # Disable agent pipeline to avoid any DB interactions
    service.enable_agent_pipeline = False
    
    print("Testing UI Composer WITHOUT database session...\n")
    
    # Test 1: Analysis without DB
    print("1. Analysis (no DB):")
    request = "show patient vital signs"
    context = {"generationMode": "mixed"}
    
    try:
        # Note: passing db_session=None explicitly
        result = await service.analyze_request(request, context, method="cli", db_session=None)
        
        if result["success"]:
            print("   ✓ Success!")
            analysis = result.get("analysis", {})
            print(f"   Intent: {analysis.get('intent')}")
            print(f"   Components: {len(analysis.get('components', []))}")
            
            # Test 2: Generation without DB
            print("\n2. Component generation (no DB):")
            specification = {
                "metadata": {"generationMode": "mixed"},
                "components": analysis.get("components", [])[:1]
            }
            
            # Note: passing db_session=None explicitly
            components = await service.generate_components(specification, method="cli", db_session=None)
            
            for comp_id, comp_code in components.items():
                if comp_code.startswith("// Error"):
                    print(f"   ✗ Error: {comp_code[:200]}")
                else:
                    print(f"   ✓ Success! {len(comp_code)} chars")
                    
        else:
            print(f"   ✗ Failed: {result.get('error')}")
            
    except Exception as e:
        print(f"   ✗ Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

async def test_direct_cli():
    """Test Claude CLI service directly"""
    print("\n3. Testing Claude CLI service directly:")
    
    from api.ui_composer.claude_cli_service import ClaudeCLIService
    service = ClaudeCLIService()
    
    try:
        # Simple test
        response = await asyncio.wait_for(
            service.complete("Return only: SUCCESS", timeout=10),
            timeout=15
        )
        print(f"   ✓ Direct CLI works: {response.strip()}")
    except asyncio.TimeoutError:
        print("   ✗ Direct CLI timeout!")
    except Exception as e:
        print(f"   ✗ Direct CLI error: {e}")

if __name__ == "__main__":
    print("Testing without database dependencies...\n")
    asyncio.run(test())
    asyncio.run(test_direct_cli())