#!/usr/bin/env python3
"""Test with agent pipeline data"""

import json
import sys
sys.path.append('.')

from api.ui_composer.claude_cli_service import ClaudeCLIService

# Create a test specification with agent data
specification = {
    "metadata": {
        "name": "Test Component",
        "generationMode": "full",
        "agentPipeline": {
            "enabled": True,
            "dataAnalysis": {
                "totalRecords": 100,
                "dataQuality": {"volume": "high"},
                "resourceSummary": {
                    "Observation": {"recordCount": 50, "purpose": "Vital signs"},
                    "Condition": {"recordCount": 30, "purpose": "Diagnoses"}
                },
                "sampleData": {
                    "Observation": {
                        "examples": [
                            {"code": {"text": "Blood Pressure"}},
                            {"code": {"coding": [{"display": "Heart Rate"}]}}
                        ]
                    }
                },
                "clinicalContext": {
                    "primaryClinicalFocus": "Hypertension",
                    "clinicalDomain": ["cardiovascular"],
                    "temporalContext": "current"
                }
            }
        }
    },
    "layout": {"type": "single"},
    "components": [{
        "id": "test-stat",
        "type": "stat",
        "props": {"title": "Vital Signs"},
        "dataBinding": {"resourceType": "Observation"}
    }]
}

# Create service instance
service = ClaudeCLIService()

# Test the format methods
print("Testing format methods...")
try:
    agent_data = specification["metadata"]["agentPipeline"]
    data_analysis = agent_data["dataAnalysis"]
    
    # Test each format method
    resource_summary = service._format_resource_summary(data_analysis.get('resourceSummary', {}))
    print(f"✓ Resource summary formatted: {resource_summary[:100]}...")
    
    sample_data = service._format_sample_data(data_analysis.get('sampleData', {}))
    print(f"✓ Sample data formatted: {sample_data[:100]}...")
    
    clinical_context = service._format_clinical_context(data_analysis.get('clinicalContext', {}))
    print(f"✓ Clinical context formatted: {clinical_context[:100]}...")
    
except Exception as e:
    print(f"✗ Format methods failed: {e}")
    import traceback
    traceback.print_exc()

# Test building the data context section
print("\nTesting data context section...")
try:
    data_context_section = f"""
REAL DATA CONTEXT FROM AGENT PIPELINE:
Total Records Available: {data_analysis.get('totalRecords', 0)}
Data Quality: {data_analysis.get('dataQuality', {}).get('volume', 'unknown')}

Available Resources:
{resource_summary}

Actual Data Examples:
{sample_data}

Clinical Context:
{clinical_context}

IMPORTANT: Generate components based on the ACTUAL data structure and content shown above.
"""
    print(f"✓ Data context section built successfully! Length: {len(data_context_section)}")
    
except Exception as e:
    print(f"✗ Data context section failed: {e}")
    import traceback
    traceback.print_exc()

# Test the actual generate_component method
print("\nTesting generate_component method...")
import asyncio

async def test_generate():
    try:
        # This should trigger the error if it exists
        result = await service.generate_component(specification)
        print(f"Result: {result[:200]}...")
    except Exception as e:
        print(f"Error in generate_component: {e}")
        import traceback
        traceback.print_exc()

# Run the async test
asyncio.run(test_generate())