#!/usr/bin/env python3
"""Test UI Composer Full Generation Mode"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test_full_generation():
    """Test full generation mode directly"""
    print("Testing UI Composer Full Generation Mode...")
    
    service = UIComposerService()
    
    # Simple test specification
    spec = {
        "metadata": {
            "name": "Test Dashboard",
            "description": "Testing full generation mode",
            "clinicalContext": {
                "scope": "patient",
                "dataRequirements": ["Observation"]
            },
            "generationMode": "full"
        },
        "layout": {
            "type": "dashboard"
        },
        "components": [{
            "id": "test-stat",
            "type": "stat",
            "props": {
                "title": "Vital Signs",
                "metrics": ["Heart Rate", "Blood Pressure"]
            },
            "dataBinding": {
                "resourceType": "Observation"
            }
        }],
        "dataSources": [{
            "id": "ds-0",
            "resourceType": "Observation",
            "query": {}
        }]
    }
    
    try:
        # Test with CLI method
        print("\nGenerating with CLI method...")
        result = await service.generate_components(spec, method="cli")
        
        if result:
            print(f"\nGeneration successful!")
            print(f"Components generated: {len(result)}")
            for comp_id, code in result.items():
                print(f"\nComponent '{comp_id}':")
                print(code[:200] + "..." if len(code) > 200 else code)
        else:
            print("No components generated")
            
    except Exception as e:
        print(f"\nError during generation: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_full_generation())