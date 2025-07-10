#!/usr/bin/env python3
"""Test Full Generation Mode end-to-end"""

import asyncio
import json
import sys
sys.path.append('.')

from api.ui_composer.ui_composer_service import UIComposerService

async def test_full_generation():
    """Test the complete Full Generation Mode workflow"""
    service = UIComposerService()
    
    print("=" * 80)
    print("TESTING FULL GENERATION MODE - END TO END")
    print("=" * 80)
    
    # Test the original request that was failing
    request = "show me patients with high blood pressure and their corresponding risk of stroke"
    context = {"generationMode": "full"}
    
    print(f"Request: {request}")
    print(f"Generation Mode: {context['generationMode']}")
    print()
    
    try:
        # Step 1: Analyze Request
        print("STEP 1: ANALYZE REQUEST")
        print("-" * 40)
        
        result = await service.analyze_request(request, context, method="sdk")
        
        if not result.get("success"):
            print(f"✗ Analysis failed: {result.get('error')}")
            return
        
        analysis = result.get("analysis", {})
        print(f"✓ Analysis successful!")
        print(f"  Intent: {analysis.get('intent')}")
        print(f"  Scope: {analysis.get('scope')}")
        print(f"  Layout Type: {analysis.get('layoutType')}")
        print(f"  Required Data: {analysis.get('requiredData', [])}")
        print(f"  Components Count: {len(analysis.get('components', []))}")
        
        components_spec = analysis.get('components', [])
        if not components_spec:
            print("✗ No components returned from analysis")
            return
        
        print("\nComponent Specifications:")
        for i, comp in enumerate(components_spec):
            print(f"  {i+1}. Type: {comp.get('type')}")
            print(f"     Purpose: {comp.get('purpose')}")
            print(f"     Resource: {comp.get('dataBinding', {}).get('resourceType')}")
            print(f"     Title: {comp.get('displayProperties', {}).get('title')}")
            print()
        
        # Step 2: Generate Components (test each individually)
        print("STEP 2: GENERATE COMPONENTS")
        print("-" * 40)
        
        generated_components = {}
        
        for i, comp_spec in enumerate(components_spec):
            print(f"\nGenerating Component {i+1}: {comp_spec.get('type')} - {comp_spec.get('purpose')}")
            
            specification = {
                "metadata": {
                    "name": f"Hypertension Component {i+1}",
                    "generationMode": "full"
                },
                "components": [comp_spec]
            }
            
            try:
                components = await service.generate_components(specification, method="sdk")
                
                for comp_id, comp_code in components.items():
                    if comp_code.startswith("// Error"):
                        print(f"  ✗ Error: {comp_code[:150]}...")
                    else:
                        print(f"  ✓ Generated {len(comp_code)} characters")
                        generated_components[f"component_{i+1}"] = comp_code
                        
                        # Quality checks
                        checks = {
                            "React import": "import React" in comp_code,
                            "Material-UI": "@mui/material" in comp_code,
                            "FHIR hooks": any(hook in comp_code for hook in ["usePatientResources", "useFHIRClient"]),
                            "Loading state": "loading" in comp_code.lower(),
                            "Error handling": "error" in comp_code.lower(),
                            "Export default": "export default" in comp_code,
                            "Hypertension context": any(term in comp_code.lower() for term in ["hypertension", "blood pressure", "i10"]),
                        }
                        
                        print("    Quality Checks:")
                        for check, passed in checks.items():
                            print(f"      {check}: {'✓' if passed else '✗'}")
                        
                        # Save to file for inspection
                        filename = f"generated_full_mode_component_{i+1}.js"
                        with open(filename, "w") as f:
                            f.write(comp_code)
                        print(f"    Saved to: {filename}")
                        
            except Exception as e:
                print(f"  ✗ Generation failed: {e}")
        
        # Step 3: Test Dashboard Generation (all components together)
        print(f"\nSTEP 3: FULL DASHBOARD GENERATION")
        print("-" * 40)
        
        dashboard_spec = {
            "metadata": {
                "name": "Hypertension Risk Dashboard",
                "generationMode": "full",
                "description": request
            },
            "layout": analysis.get("layout", {"type": "dashboard"}),
            "components": components_spec
        }
        
        try:
            dashboard_components = await service.generate_components(dashboard_spec, method="sdk")
            
            for comp_id, comp_code in dashboard_components.items():
                if comp_code.startswith("// Error"):
                    print(f"✗ Dashboard error: {comp_code[:150]}...")
                else:
                    print(f"✓ Dashboard generated: {len(comp_code)} characters")
                    
                    # Advanced checks for dashboard
                    dashboard_checks = {
                        "Multiple components": comp_code.count("const ") > 1 or comp_code.count("function ") > 1,
                        "Grid/Layout": any(term in comp_code for term in ["Grid", "Box", "Container"]),
                        "Population queries": "searchResources" in comp_code,
                        "Real data handling": "?.value" in comp_code or "?.[0]" in comp_code,
                        "Clinical codes": any(code in comp_code for code in ["I10", "38341003", "85354-9"]),
                    }
                    
                    print("  Dashboard Quality Checks:")
                    for check, passed in dashboard_checks.items():
                        print(f"    {check}: {'✓' if passed else '✗'}")
                    
                    # Save dashboard
                    with open("generated_full_dashboard.js", "w") as f:
                        f.write(comp_code)
                    print("  Saved to: generated_full_dashboard.js")
                    
        except Exception as e:
            print(f"✗ Dashboard generation failed: {e}")
        
        # Step 4: Summary
        print(f"\nSTEP 4: SUMMARY")
        print("-" * 40)
        
        print(f"✓ Analysis: Generated {len(components_spec)} component specifications")
        print(f"✓ Individual Components: {len(generated_components)} generated successfully")
        print(f"✓ Full Generation Mode: {'Working' if generated_components else 'Failed'}")
        
        print("\nGenerated Files:")
        for i in range(len(components_spec)):
            print(f"  - generated_full_mode_component_{i+1}.js")
        print("  - generated_full_dashboard.js")
        
        # Step 5: Test a different complex request
        print(f"\nSTEP 5: TESTING ALTERNATIVE COMPLEX REQUEST")
        print("-" * 40)
        
        alt_request = "create a dashboard showing diabetic patients with their A1C trends and medication adherence"
        alt_context = {"generationMode": "full"}
        
        print(f"Alternative Request: {alt_request}")
        
        alt_result = await service.analyze_request(alt_request, alt_context, method="sdk")
        
        if alt_result.get("success"):
            alt_analysis = alt_result.get("analysis", {})
            print(f"✓ Alternative analysis successful!")
            print(f"  Components: {len(alt_analysis.get('components', []))}")
            print(f"  Intent: {alt_analysis.get('intent')}")
            
            # Generate first component of alternative
            if alt_analysis.get('components'):
                alt_spec = {
                    "metadata": {"generationMode": "full"},
                    "components": [alt_analysis['components'][0]]
                }
                
                alt_components = await service.generate_components(alt_spec, method="sdk")
                
                for comp_id, comp_code in alt_components.items():
                    if not comp_code.startswith("// Error"):
                        print(f"  ✓ Alternative component generated: {len(comp_code)} chars")
                        with open("generated_diabetes_component.js", "w") as f:
                            f.write(comp_code)
                        print(f"  Saved to: generated_diabetes_component.js")
                    else:
                        print(f"  ✗ Alternative component error: {comp_code[:100]}...")
        else:
            print(f"✗ Alternative analysis failed: {alt_result.get('error')}")
        
    except Exception as e:
        print(f"\n✗ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Starting comprehensive Full Generation Mode test...\n")
    asyncio.run(test_full_generation())
    print("\n\nTest completed! Check generated files for component code.")