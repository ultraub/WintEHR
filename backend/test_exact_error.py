#!/usr/bin/env python3
"""Test the exact error scenario when Claude CLI is not found"""

import asyncio
import sys
sys.path.append('.')

from api.ui_composer.claude_cli_service import ClaudeCLIService

async def test_missing_cli():
    """Test what happens when CLI is missing"""
    
    service = ClaudeCLIService()
    
    # Force the CLI path to be None to simulate not found
    original_path = service.claude_path
    service.claude_path = None
    
    print(f"Original CLI path: {original_path}")
    print("Forcing CLI path to None to simulate not found\n")
    
    # Create a simple specification
    specification = {
        "metadata": {
            "generationMode": "full"
        },
        "components": [{
            "type": "stat",
            "props": {"title": "Test"},
            "dataBinding": {"resourceType": "Observation"}
        }]
    }
    
    try:
        # This should fail with "Claude CLI not available"
        result = await service.generate_component(specification)
        print(f"Result: {result}")
    except Exception as e:
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception message: {e}")
        import traceback
        traceback.print_exc()

async def test_with_correct_path():
    """Test with the correct CLI path"""
    
    service = ClaudeCLIService()
    
    # Set the correct path
    service.claude_path = "/Users/robertbarrett/.nvm/versions/node/v22.17.0/bin/claude"
    
    print(f"\nTesting with correct CLI path: {service.claude_path}")
    
    # Test if it's available
    try:
        status = await service.test_connection()
        print(f"Connection status: {status}")
    except Exception as e:
        print(f"Connection test error: {e}")

if __name__ == "__main__":
    print("Testing error scenarios...\n")
    asyncio.run(test_missing_cli())
    asyncio.run(test_with_correct_path())