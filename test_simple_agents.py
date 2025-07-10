#!/usr/bin/env python3
"""
Simple test for individual agents without database dependencies
"""

import asyncio
import json
import subprocess
import sys

async def test_query_planner():
    """Test the FHIR Query Planner Agent directly"""
    print("🧪 Testing FHIRQueryPlannerAgent")
    print("=" * 40)
    
    test_request = "Show me patients with HbA1c values above 8.0%"
    context = json.dumps({
        "userRole": "clinician", 
        "clinicalSetting": "diabetes clinic"
    })
    
    try:
        # Test the agent as a CLI script
        result = subprocess.run([
            "python", 
            "backend/api/ui_composer/agents/fhir_query_planner_agent.py",
            test_request,
            context
        ], capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            print("✅ Agent executed successfully!")
            
            # Parse the output
            try:
                output = json.loads(result.stdout)
                if output.get("success"):
                    query_plan = output["queryPlan"]
                    print(f"✅ Query Plan Created:")
                    print(f"   - Scope: {query_plan.get('scope')}")
                    print(f"   - Queries: {len(query_plan.get('queries', []))}")
                    print(f"   - Reasoning: {query_plan.get('reasoning', 'No reasoning')}")
                    
                    # Show first query
                    if query_plan.get('queries'):
                        first_query = query_plan['queries'][0]
                        print(f"   - First Query:")
                        print(f"     * Resource: {first_query.get('resourceType')}")
                        print(f"     * Purpose: {first_query.get('purpose')}")
                        print(f"     * Parameters: {first_query.get('searchParameters', {})}")
                    
                    print(f"\n📄 Full Query Plan:")
                    print(json.dumps(query_plan, indent=2))
                    
                else:
                    print(f"❌ Agent failed: {output.get('error')}")
                    
            except json.JSONDecodeError:
                print(f"❌ Could not parse agent output: {result.stdout}")
                
        else:
            print(f"❌ Agent execution failed: {result.stderr}")
            
    except subprocess.TimeoutExpired:
        print("❌ Agent timed out")
    except Exception as e:
        print(f"❌ Error testing agent: {e}")

async def test_multiple_scenarios():
    """Test multiple clinical scenarios"""
    print("\n🔬 Testing Multiple Clinical Scenarios")
    print("=" * 40)
    
    scenarios = [
        ("Diabetes Management", "Show me patients with HbA1c values above 8.0%"),
        ("Hypertension Dashboard", "Create a dashboard for patients with high blood pressure"),
        ("Medication Review", "Display active medications for diabetes patients"),
        ("Lab Trends", "Show laboratory results trending over the past 6 months"),
        ("Patient Summary", "Create a comprehensive patient summary view")
    ]
    
    for name, request in scenarios:
        print(f"\n📋 Scenario: {name}")
        print(f"Request: {request}")
        
        try:
            result = subprocess.run([
                "python", 
                "backend/api/ui_composer/agents/fhir_query_planner_agent.py",
                request
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                try:
                    output = json.loads(result.stdout)
                    if output.get("success"):
                        plan = output["queryPlan"]
                        queries = plan.get("queries", [])
                        print(f"   ✅ {len(queries)} queries planned")
                        
                        # Show resource types
                        resource_types = [q.get("resourceType") for q in queries]
                        print(f"   📊 Resources: {', '.join(set(resource_types))}")
                        
                        # Show scope and UI components
                        print(f"   🎯 Scope: {plan.get('scope', 'unknown')}")
                        ui_components = plan.get("uiComponents", [])
                        if ui_components:
                            component_types = [c.get("type") for c in ui_components]
                            print(f"   🎨 Components: {', '.join(component_types)}")
                    else:
                        print(f"   ❌ Failed: {output.get('error')}")
                except json.JSONDecodeError:
                    print(f"   ❌ Invalid output format")
            else:
                print(f"   ❌ Execution failed: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            print(f"   ❌ Timeout")
        except Exception as e:
            print(f"   ❌ Error: {e}")

async def test_claude_cli_availability():
    """Test if Claude CLI is available and working"""
    print("\n🔧 Testing Claude CLI Availability")
    print("=" * 40)
    
    try:
        # Test if Claude CLI is available
        result = subprocess.run(["claude", "--version"], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print("✅ Claude CLI is available")
            print(f"   Version info: {result.stdout.strip()}")
            
            # Test a simple query
            print("\n🧪 Testing simple Claude query...")
            test_result = subprocess.run([
                "claude", "--print", "Respond with just the word 'SUCCESS' if you can read this."
            ], capture_output=True, text=True, timeout=15)
            
            if test_result.returncode == 0:
                response = test_result.stdout.strip()
                if "SUCCESS" in response:
                    print("✅ Claude CLI is responding correctly")
                else:
                    print(f"⚠️  Claude CLI response: {response}")
            else:
                print(f"❌ Claude CLI test failed: {test_result.stderr}")
                
        else:
            print("❌ Claude CLI not available or not working")
            print(f"   Error: {result.stderr}")
            
    except subprocess.TimeoutExpired:
        print("❌ Claude CLI test timed out")
    except FileNotFoundError:
        print("❌ Claude CLI not found - please install Claude CLI")
    except Exception as e:
        print(f"❌ Error testing Claude CLI: {e}")

if __name__ == "__main__":
    print("🚀 UI Composer Agent Pipeline Testing")
    print("🔧 Testing individual components without database dependencies")
    print()
    
    # Run all tests
    asyncio.run(test_claude_cli_availability())
    asyncio.run(test_query_planner())
    asyncio.run(test_multiple_scenarios())
    
    print("\n" + "=" * 50)
    print("🏁 Testing Complete!")
    print("\nNext Steps:")
    print("1. Verify Claude CLI is working if any tests failed")
    print("2. Test with actual MedGenEMR backend running")
    print("3. Test full UI generation pipeline")
    print("4. Verify generated components use real FHIR data")