#!/usr/bin/env python3
"""Test the original hypertension request"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test_hypertension():
    """Test the original failing request"""
    
    service = UIComposerService()
    
    # The original request that was failing
    request = "show me patients with high blood pressure and their corresponding risk of stroke"
    context = {"generationMode": "full"}
    
    print("Testing original hypertension request...")
    print(f"Request: {request}")
    print(f"Mode: {context['generationMode']}\n")
    
    try:
        # Analyze request
        print("Analyzing request...")
        result = await service.analyze_request(request, context, method="cli")
        
        if result["success"]:
            print("✓ Analysis successful!")
            analysis = result.get("analysis", {})
            
            # Pretty print the analysis
            print("\nAnalysis Result:")
            print(json.dumps(analysis, indent=2))
            
            # Generate components
            print("\n\nGenerating components...")
            specification = {
                "metadata": {
                    "name": "Hypertension Risk Dashboard",
                    "generationMode": "full",
                    "description": request
                },
                "layout": analysis.get("layout", {"type": "dashboard"}),
                "components": analysis.get("components", [])
            }
            
            components = await service.generate_components(specification, method="cli")
            
            print(f"\nGenerated {len(components)} component(s)")
            
            for comp_id, comp_code in components.items():
                if comp_code.startswith("// Error"):
                    print(f"\n✗ Component {comp_id} has error:")
                    print(comp_code)
                else:
                    print(f"\n✓ Component {comp_id} generated successfully!")
                    print(f"  Length: {len(comp_code)} characters")
                    
                    # Check for key elements
                    checks = {
                        "React import": "import React" in comp_code,
                        "FHIR hooks": "useFHIRResources" in comp_code or "usePatientResources" in comp_code,
                        "Material-UI": "@mui/material" in comp_code,
                        "Export": "export default" in comp_code,
                        "Hypertension code": "38341003" in comp_code or "hypertension" in comp_code.lower(),
                        "Blood pressure": "blood pressure" in comp_code.lower() or "85354-9" in comp_code
                    }
                    
                    print("\n  Component checks:")
                    for check, passed in checks.items():
                        print(f"    {check}: {'✓' if passed else '✗'}")
                    
                    # Show first few lines
                    print("\n  First 10 lines:")
                    lines = comp_code.split('\n')[:10]
                    for line in lines:
                        print(f"    {line}")
                        
        else:
            print(f"✗ Analysis failed: {result.get('error')}")
            
    except Exception as e:
        print(f"\n✗ Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Testing hypertension dashboard request with fixed authentication...\n")
    asyncio.run(test_hypertension())