#!/usr/bin/env python3
"""Reproduce the exact error scenario"""

import asyncio
import sys
import os
sys.path.append('.')

from api.ui_composer.claude_cli_service import ClaudeCLIService

async def test_generate_component():
    """Test the generate_component method with exact conditions"""
    
    service = ClaudeCLIService()
    
    # Create specification that triggers Full Generation mode
    specification = {
        "metadata": {
            "name": "Hypertension Risk Dashboard",
            "generationMode": "full",
            "description": "show me patients with high blood pressure and their corresponding risk of stroke",
            "agentPipeline": {
                "enabled": True,
                "dataAnalysis": {
                    "totalRecords": 100,
                    "dataQuality": {"volume": "high"},
                    "resourceSummary": {
                        "Condition": {
                            "recordCount": 50,
                            "purpose": "Patient conditions including hypertension"
                        },
                        "Observation": {
                            "recordCount": 200,
                            "purpose": "Blood pressure readings"
                        }
                    },
                    "sampleData": {
                        "Condition": {
                            "examples": [{
                                "resourceType": "Condition",
                                "code": {
                                    "coding": [{
                                        "system": "http://snomed.info/sct",
                                        "code": "38341003",
                                        "display": "Hypertension"
                                    }]
                                }
                            }]
                        },
                        "Observation": {
                            "examples": [{
                                "resourceType": "Observation",
                                "code": {
                                    "coding": [{
                                        "system": "http://loinc.org",
                                        "code": "85354-9",
                                        "display": "Blood pressure"
                                    }]
                                },
                                "valueQuantity": {
                                    "value": 140,
                                    "unit": "mmHg"
                                }
                            }]
                        }
                    },
                    "clinicalContext": {
                        "primaryClinicalFocus": "Hypertension and Stroke Risk",
                        "clinicalDomain": ["cardiovascular"],
                        "temporalContext": "current"
                    }
                }
            }
        },
        "layout": {"type": "dashboard"},
        "components": [{
            "id": "hypertension-stats",
            "type": "stat",
            "purpose": "Show patients with hypertension",
            "props": {"title": "Patients with High Blood Pressure"},
            "dataBinding": {
                "resourceType": "Condition",
                "filters": ["code=38341003"]
            }
        }]
    }
    
    print("Testing generate_component with Full Generation mode...")
    print(f"Specification: {specification['metadata']['name']}")
    print(f"Generation mode: {specification['metadata']['generationMode']}")
    print(f"Has agent data: {specification['metadata'].get('agentPipeline', {}).get('enabled', False)}")
    
    try:
        # Mock the Claude CLI availability check
        if not service.claude_path:
            print("Claude CLI not found, using mock")
            service.claude_path = "echo"  # Use echo as a mock
        
        # Try to generate component
        result = await service.generate_component(specification)
        
        # Check if we got an error comment
        if result.startswith("// Error"):
            print(f"\nGot error response:\n{result}")
        else:
            print(f"\nGot successful response (first 200 chars):\n{result[:200]}...")
            
    except Exception as e:
        print(f"\nException raised: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_generate_component())