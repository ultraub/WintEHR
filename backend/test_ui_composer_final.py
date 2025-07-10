#!/usr/bin/env python3
"""Final test of UI Composer without output-format flag"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.claude_cli_service import ClaudeCLIService

async def test():
    service = ClaudeCLIService()
    
    print("1. Testing connection...")
    status = await service.test_connection()
    print(f"   Available: {status.get('available')}")
    print(f"   Authenticated: {status.get('authenticated')}")
    
    print("\n2. Testing simple complete...")
    try:
        response = await service.complete("Return only: TEST_SUCCESS", timeout=15)
        print(f"   Response: {response.strip()}")
        print(f"   Success: {'TEST_SUCCESS' in response}")
    except Exception as e:
        print(f"   Error: {e}")
        return
    
    print("\n3. Testing JSON analysis...")
    try:
        prompt = '''Analyze this request and respond with ONLY a JSON object (no markdown):
{"intent": "Show patient vital signs", "components": [{"type": "chart", "purpose": "Display vital signs over time"}]}'''
        
        response = await service.complete(prompt, timeout=30)
        print(f"   Raw response length: {len(response)}")
        
        # Clean markdown if present
        cleaned = service._clean_markdown_response(response)
        print(f"   Cleaned response length: {len(cleaned)}")
        
        try:
            parsed = json.loads(cleaned)
            print(f"   ✓ Valid JSON with keys: {list(parsed.keys())}")
        except json.JSONDecodeError as e:
            print(f"   ✗ JSON parse error: {e}")
            print(f"   First 200 chars: {cleaned[:200]}")
            
    except asyncio.TimeoutError:
        print("   ✗ Timeout!")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Testing UI Composer without output-format flag...\n")
    asyncio.run(test())