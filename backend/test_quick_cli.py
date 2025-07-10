#!/usr/bin/env python3
"""Quick test of Claude CLI"""

import asyncio
import sys
sys.path.append('.')

from api.ui_composer.claude_cli_service import ClaudeCLIService

async def test_quick():
    """Quick test with simple prompt"""
    
    service = ClaudeCLIService()
    
    print(f"Claude CLI path: {service.claude_path}")
    
    # Test connection
    print("\nTesting connection...")
    status = await service.test_connection()
    print(f"Status: {status}")
    
    if not status.get("available"):
        print("Claude CLI not available!")
        return
    
    # Test simple prompt
    print("\nTesting simple prompt...")
    try:
        response = await service.complete("Say 'Hello World'", timeout=30)
        print(f"✓ Response received: {response[:100]}...")
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_quick())