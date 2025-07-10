#!/usr/bin/env python3
"""Test Claude CLI service directly with simple prompt"""

import asyncio
import sys
sys.path.append('.')

from api.ui_composer.claude_cli_service import ClaudeCLIService

async def test():
    service = ClaudeCLIService()
    
    # Test connection
    print("1. Testing connection...")
    try:
        status = await service.test_connection()
        print(f"   Status: {status.get('available', False)}")
        print(f"   Auth: {status.get('authenticated', False)}")
    except Exception as e:
        print(f"   Error: {e}")
        return
    
    # Test analyze_request
    print("\n2. Testing analyze_request...")
    try:
        prompt = "Show patient data"
        context = {"generationMode": "mixed"}
        
        print(f"   Prompt: {prompt}")
        result = await asyncio.wait_for(
            service.analyze_request(prompt, context),
            timeout=30
        )
        
        print(f"   Result length: {len(result)}")
        print(f"   First 200 chars: {result[:200]}")
        
        # Try to parse as JSON
        import json
        try:
            parsed = json.loads(result)
            print(f"   ✓ Valid JSON with keys: {list(parsed.keys())}")
        except:
            print(f"   ✗ Not valid JSON")
            
    except asyncio.TimeoutError:
        print("   ✗ Timeout after 30 seconds")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Testing Claude CLI service directly...\n")
    asyncio.run(test())