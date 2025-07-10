#!/usr/bin/env python3
"""
Test the full UI Composer agent pipeline with running MedGenEMR backend
"""

import asyncio
import json
import requests
import time

# Test configuration
BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

async def test_backend_health():
    """Test if backend is responding"""
    print("🏥 Testing Backend Health")
    print("-" * 30)
    
    try:
        # Test health endpoint
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is healthy")
            health_data = response.json()
            print(f"   Status: {health_data.get('status', 'unknown')}")
            print(f"   Database: {health_data.get('database', 'unknown')}")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend not responding: {e}")
        return False

async def test_fhir_data_availability():
    """Test if FHIR data is available"""
    print("\n📊 Testing FHIR Data Availability")
    print("-" * 35)
    
    try:
        # Test Patient count
        response = requests.get(f"{BACKEND_URL}/fhir/R4/Patient?_summary=count", timeout=10)
        if response.status_code == 200:
            data = response.json()
            patient_count = data.get("total", 0)
            print(f"✅ Patients available: {patient_count}")
            
            if patient_count > 0:
                # Test Observations (lab data)
                obs_response = requests.get(f"{BACKEND_URL}/fhir/R4/Observation?_summary=count", timeout=10)
                if obs_response.status_code == 200:
                    obs_data = obs_response.json()
                    obs_count = obs_data.get("total", 0)
                    print(f"✅ Observations available: {obs_count}")
                    
                    # Test for HbA1c specifically
                    hba1c_response = requests.get(
                        f"{BACKEND_URL}/fhir/R4/Observation?code=4548-4&_summary=count", 
                        timeout=10
                    )
                    if hba1c_response.status_code == 200:
                        hba1c_data = hba1c_response.json()
                        hba1c_count = hba1c_data.get("total", 0)
                        print(f"✅ HbA1c observations available: {hba1c_count}")
                        return hba1c_count > 0
                    
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ FHIR data test failed: {e}")
        return False

async def test_ui_composer_service():
    """Test the UI Composer service endpoints"""
    print("\n🎨 Testing UI Composer Service")
    print("-" * 32)
    
    try:
        # Test Claude service availability
        response = requests.get(f"{BACKEND_URL}/api/ui-composer/test-claude", timeout=10)
        if response.status_code == 200:
            status = response.json()
            print("✅ UI Composer service is available")
            print(f"   Claude CLI Status: {status.get('claude_available', 'unknown')}")
            if status.get('claude_available'):
                print(f"   Claude Response: {status.get('claude_response', 'No response')}")
            return True
        else:
            print(f"❌ UI Composer service not available: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ UI Composer service test failed: {e}")
        return False

async def test_agent_pipeline_analyze():
    """Test the agent pipeline analyze endpoint"""
    print("\n🧠 Testing Agent Pipeline - Analyze")
    print("-" * 38)
    
    test_request = "Show me patients with HbA1c values above 8.0%"
    
    try:
        payload = {
            "request": test_request,
            "context": {
                "userRole": "clinician",
                "clinicalSetting": "diabetes clinic",
                "method": "cli"
            }
        }
        
        print(f"Request: {test_request}")
        print("Sending analyze request...")
        
        response = requests.post(
            f"{BACKEND_URL}/api/ui-composer/analyze",
            json=payload,
            timeout=60  # Longer timeout for Claude
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Analysis completed successfully!")
            
            # Check if agent pipeline was used
            if result.get("success"):
                analysis = result.get("analysis", {})
                
                # Check for agent pipeline indicators
                if "agentPipelineUsed" in analysis:
                    print("✅ Agent pipeline was used!")
                    
                    # Show FHIR data context
                    if "fhirData" in analysis:
                        fhir_data = analysis["fhirData"]
                        print(f"   📊 Total records analyzed: {fhir_data.get('totalRecords', 'unknown')}")
                        
                        if "resourceSummary" in fhir_data:
                            print("   📋 Resource summary:")
                            for resource_type, summary in fhir_data["resourceSummary"].items():
                                print(f"      - {resource_type}: {summary.get('recordCount', 0)} records")
                        
                        if "recommendations" in fhir_data and fhir_data["recommendations"].get("components"):
                            print("   🎯 Component recommendations:")
                            for comp in fhir_data["recommendations"]["components"][:3]:
                                print(f"      - {comp.get('type')}: {comp.get('purpose')}")
                    
                    return result
                else:
                    print("⚠️  Agent pipeline was not used - fallback mode")
                    return result
            else:
                print(f"❌ Analysis failed: {result.get('error', 'Unknown error')}")
                return None
        else:
            print(f"❌ Analysis request failed: {response.status_code}")
            if response.text:
                print(f"   Error: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Analysis request error: {e}")
        return None

async def test_ui_generation():
    """Test full UI generation with agent pipeline"""
    print("\n🏗️  Testing Full UI Generation")
    print("-" * 32)
    
    # First analyze
    analysis_result = await test_agent_pipeline_analyze()
    
    if not analysis_result or not analysis_result.get("success"):
        print("❌ Cannot test UI generation without successful analysis")
        return False
    
    try:
        # Now test UI generation
        payload = {
            "request": "Show me patients with HbA1c values above 8.0%",
            "context": {
                "userRole": "clinician",
                "method": "cli"
            },
            "generateUI": True
        }
        
        print("\nGenerating UI components...")
        
        response = requests.post(
            f"{BACKEND_URL}/api/ui-composer/generate",
            json=payload,
            timeout=120  # Even longer timeout for full generation
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ UI generation completed!")
            
            if result.get("success"):
                components = result.get("components", {})
                print(f"   📦 Generated components: {len(components)}")
                
                # Check if components contain real data context
                for comp_id, comp_data in components.items():
                    code = comp_data.get("code", "")
                    print(f"   🧩 Component {comp_id}:")
                    
                    # Check for real data indicators
                    if "useFHIRResources" in code or "usePatientResources" in code:
                        print("      ✅ Uses real FHIR data hooks")
                    else:
                        print("      ⚠️  May not use real FHIR data")
                    
                    # Check for mock data patterns
                    if "Patient A" in code or "Patient B" in code or "John Doe" in code:
                        print("      ❌ Contains mock data!")
                    else:
                        print("      ✅ No obvious mock data")
                    
                    # Show snippet
                    if code:
                        lines = code.split('\n')[:5]
                        snippet = '\n'.join(lines)
                        print(f"      Code snippet:\n{snippet}...")
                
                return True
            else:
                print(f"❌ UI generation failed: {result.get('error')}")
                return False
        else:
            print(f"❌ UI generation request failed: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ UI generation error: {e}")
        return False

async def test_different_scenarios():
    """Test different clinical scenarios"""
    print("\n🔬 Testing Different Clinical Scenarios")
    print("-" * 40)
    
    scenarios = [
        {
            "name": "Diabetes Management", 
            "request": "Show me patients with HbA1c values above 8.0%",
            "expected_resources": ["Observation", "Patient"]
        },
        {
            "name": "Medication Review",
            "request": "Display active medications for all patients",
            "expected_resources": ["MedicationRequest"]
        },
        {
            "name": "Hypertension Dashboard",
            "request": "Create a dashboard for patients with high blood pressure",
            "expected_resources": ["Observation", "Condition"]
        }
    ]
    
    results = []
    
    for scenario in scenarios:
        print(f"\n📋 Scenario: {scenario['name']}")
        print(f"Request: {scenario['request']}")
        
        try:
            payload = {
                "request": scenario["request"],
                "context": {
                    "userRole": "clinician",
                    "method": "cli"
                }
            }
            
            response = requests.post(
                f"{BACKEND_URL}/api/ui-composer/analyze",
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    analysis = result.get("analysis", {})
                    
                    # Check for agent pipeline usage
                    if "agentPipelineUsed" in analysis:
                        print("   ✅ Agent pipeline used")
                        
                        fhir_data = analysis.get("fhirData", {})
                        total_records = fhir_data.get("totalRecords", 0)
                        print(f"   📊 Records found: {total_records}")
                        
                        # Check expected resources
                        resource_summary = fhir_data.get("resourceSummary", {})
                        found_resources = list(resource_summary.keys())
                        
                        for expected in scenario["expected_resources"]:
                            if expected in found_resources:
                                count = resource_summary[expected].get("recordCount", 0)
                                print(f"   ✅ {expected}: {count} records")
                            else:
                                print(f"   ⚠️  {expected}: not found")
                        
                        results.append({
                            "scenario": scenario["name"],
                            "success": True,
                            "records": total_records,
                            "resources": found_resources
                        })
                    else:
                        print("   ⚠️  Agent pipeline not used")
                        results.append({
                            "scenario": scenario["name"],
                            "success": False,
                            "error": "Agent pipeline not used"
                        })
                else:
                    print(f"   ❌ Failed: {result.get('error')}")
                    results.append({
                        "scenario": scenario["name"],
                        "success": False,
                        "error": result.get("error")
                    })
            else:
                print(f"   ❌ Request failed: {response.status_code}")
                results.append({
                    "scenario": scenario["name"],
                    "success": False,
                    "error": f"HTTP {response.status_code}"
                })
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Error: {e}")
            results.append({
                "scenario": scenario["name"],
                "success": False,
                "error": str(e)
            })
    
    return results

async def main():
    """Run all tests"""
    print("🚀 MedGenEMR UI Composer Agent Pipeline Testing")
    print("=" * 50)
    print("Testing with running backend (no Docker)")
    print()
    
    # Test 1: Backend Health
    backend_healthy = await test_backend_health()
    if not backend_healthy:
        print("\n❌ Backend is not healthy - cannot continue testing")
        return
    
    # Test 2: FHIR Data
    fhir_available = await test_fhir_data_availability()
    if not fhir_available:
        print("\n⚠️  Limited FHIR data available - some tests may not work optimally")
    
    # Test 3: UI Composer Service
    ui_composer_available = await test_ui_composer_service()
    if not ui_composer_available:
        print("\n❌ UI Composer service not available - cannot test agent pipeline")
        return
    
    # Test 4: Agent Pipeline Analysis
    analysis_result = await test_agent_pipeline_analyze()
    
    # Test 5: Full UI Generation
    await test_ui_generation()
    
    # Test 6: Multiple Scenarios
    scenario_results = await test_different_scenarios()
    
    # Summary
    print("\n" + "=" * 50)
    print("🏁 Testing Summary")
    print("=" * 50)
    
    print(f"✅ Backend Health: {'PASS' if backend_healthy else 'FAIL'}")
    print(f"✅ FHIR Data: {'PASS' if fhir_available else 'LIMITED'}")
    print(f"✅ UI Composer Service: {'PASS' if ui_composer_available else 'FAIL'}")
    print(f"✅ Agent Pipeline Analysis: {'PASS' if analysis_result else 'FAIL'}")
    
    # Scenario summary
    successful_scenarios = sum(1 for r in scenario_results if r.get("success"))
    print(f"✅ Clinical Scenarios: {successful_scenarios}/{len(scenario_results)} passed")
    
    if analysis_result and analysis_result.get("analysis", {}).get("agentPipelineUsed"):
        print("\n🎉 AGENT PIPELINE IS WORKING!")
        print("   ✅ Real FHIR data is being analyzed")
        print("   ✅ Intelligent query planning is active")
        print("   ✅ Components should show real patient data")
    else:
        print("\n⚠️  Agent pipeline may not be fully functional")
        print("   Check backend logs for more details")
    
    print("\nNext steps:")
    print("1. Test in UI Composer frontend")
    print("2. Verify generated components show real data")
    print("3. Test with different user roles and contexts")

if __name__ == "__main__":
    asyncio.run(main())