#!/usr/bin/env python3
"""Test minimal component generation"""

import asyncio
import sys
sys.path.append('.')

from api.ui_composer.claude_cli_service import ClaudeCLIService

async def test_minimal():
    """Test with minimal component request"""
    
    service = ClaudeCLIService()
    
    # Check connection first
    print("Checking Claude CLI connection...")
    status = await service.test_connection()
    print(f"Status: {status}")
    
    if not status.get("available"):
        print("Claude CLI not available!")
        return
    
    # Test with a very simple prompt
    print("\nTesting minimal component generation...")
    
    specification = {
        "metadata": {"generationMode": "mixed"},
        "components": [{
            "type": "text",
            "props": {"title": "Hello"},
            "dataBinding": {}
        }]
    }
    
    try:
        # Override timeout to be shorter
        original_complete = service.complete
        
        async def complete_with_short_timeout(prompt, timeout=30):
            print(f"Calling Claude with timeout={timeout}s")
            print(f"Prompt length: {len(prompt)} characters")
            return await original_complete(prompt, timeout=timeout)
        
        service.complete = complete_with_short_timeout
        
        # Generate component
        result = await service.generate_component(specification)
        
        if result.startswith("// Error"):
            print(f"\n✗ Error result:\n{result}")
        else:
            print(f"\n✓ Success! Generated {len(result)} characters")
            print(f"First 500 chars:\n{result[:500]}")
            
    except Exception as e:
        print(f"\n✗ Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_minimal())