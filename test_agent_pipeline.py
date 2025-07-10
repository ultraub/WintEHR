#!/usr/bin/env python3
"""
Test script for the new UI Composer agent pipeline
Tests the full workflow: Query Planning -> Execution -> Data Context -> UI Generation
"""

import asyncio
import json
import os
import sys
from datetime import datetime

# Add the project root to the path
sys.path.append('/Users/robertbarrett/dev/MedGenEMR')

from backend.api.ui_composer.agents.fhir_query_planner_agent import FHIRQueryPlannerAgent
from backend.api.ui_composer.agents.fhir_executor_agent import FHIRExecutorAgent  
from backend.api.ui_composer.agents.data_context_agent import DataContextAgent
from backend.api.ui_composer.ui_composer_service import ui_composer_service

async def test_agent_pipeline():
    """Test the complete agent pipeline with HbA1c query"""
    
    print("🧪 Testing UI Composer Agent Pipeline")
    print("=" * 50)
    
    # Test query
    test_request = "Show me patients with HbA1c values above 8.0%"
    
    print(f"Test Request: {test_request}")
    print("-" * 50)
    
    # Step 1: Test Query Planning Agent
    print("\n🎯 Step 1: Testing FHIRQueryPlannerAgent")
    try:
        query_planner = FHIRQueryPlannerAgent()
        
        context = {
            "userRole": "clinician",
            "clinicalSetting": "diabetes clinic"
        }
        
        planning_result = await query_planner.plan_queries(test_request, context)
        
        if planning_result["success"]:
            print("✅ Query planning successful!")
            query_plan = planning_result["queryPlan"]
            print(f"   - Queries planned: {len(query_plan.get('queries', []))}")
            print(f"   - Scope: {query_plan.get('scope', 'unknown')}")
            print(f"   - Reasoning: {planning_result.get('reasoning', 'No reasoning provided')}")
            
            # Show first query details
            if query_plan.get('queries'):
                first_query = query_plan['queries'][0]
                print(f"   - First query: {first_query.get('resourceType')} - {first_query.get('purpose')}")
                print(f"   - Search params: {json.dumps(first_query.get('searchParameters', {}), indent=6)}")
        else:
            print(f"❌ Query planning failed: {planning_result.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ Query planning error: {e}")
        return False
    
    # Step 2: Test with Database Session (if available)
    print("\n💾 Step 2: Testing with Database Integration")
    try:
        # Try to get a database session
        from backend.core.database import get_db_session
        
        async with get_db_session() as db_session:
            print("✅ Database connection established")
            
            # Test FHIR Executor Agent
            print("\n⚡ Step 2a: Testing FHIRExecutorAgent")
            executor = FHIRExecutorAgent(db_session)
            
            execution_result = await executor.execute_query_plan(query_plan)
            
            if execution_result["success"]:
                print("✅ Query execution successful!")
                exec_results = execution_result["executionResults"]
                exec_summary = exec_results.get("executionSummary", {})
                print(f"   - Successful queries: {exec_summary.get('successful', 0)}")
                print(f"   - Failed queries: {exec_summary.get('failed', 0)}")
                print(f"   - Total records: {exec_summary.get('totalRecords', 0)}")
                print(f"   - Execution time: {exec_summary.get('executionTime', 0):.2f}s")
                
                # Show data statistics
                if exec_results.get("dataStatistics"):
                    stats = exec_results["dataStatistics"]
                    print(f"   - Resource types: {', '.join(stats.get('resourceTypes', {}).keys())}")
                    if stats.get("dateRange", {}).get("latest"):
                        print(f"   - Latest data: {stats['dateRange']['latest']}")
            else:
                print(f"❌ Query execution failed: {execution_result.get('error')}")
                return False
            
            # Test Data Context Agent
            print("\n📊 Step 2b: Testing DataContextAgent")
            context_agent = DataContextAgent()
            
            context_result = await context_agent.format_data_context(exec_results, query_plan)
            
            if context_result["success"]:
                print("✅ Data context formatting successful!")
                data_context = context_result["dataContext"]
                print(f"   - Total records: {data_context.get('totalRecords', 0)}")
                print(f"   - Resource summary: {len(data_context.get('resourceSummary', {}))}")
                print(f"   - Data quality: {data_context.get('dataQuality', {}).get('volume', 'unknown')}")
                print(f"   - Components recommended: {len(data_context.get('recommendations', {}).get('components', []))}")
                
                # Show sample data
                if data_context.get("sampleData"):
                    for resource_type, sample in data_context["sampleData"].items():
                        print(f"   - {resource_type}: {sample.get('count', 0)} records")
                        if sample.get("examples"):
                            print(f"     Example: {sample['examples'][0]}")
                            
            else:
                print(f"❌ Data context formatting failed: {context_result.get('error')}")
                return False
            
            # Step 3: Test Full UI Composer Service Pipeline
            print("\n🎨 Step 3: Testing Full UIComposerService Pipeline")
            
            # Enable agent pipeline
            ui_composer_service.enable_agent_pipeline = True
            
            analysis_result = await ui_composer_service.analyze_request(
                test_request, 
                {
                    "method": "cli",
                    "userRole": "clinician",
                    "clinicalSetting": "diabetes clinic"
                },
                db_session
            )
            
            if analysis_result["success"]:
                print("✅ Full pipeline analysis successful!")
                if analysis_result.get("reasoning"):
                    print(f"   - Reasoning: {analysis_result['reasoning']}")
                    
                # Check if agent pipeline was used
                if "agentPipelineUsed" in analysis_result.get("analysis", {}):
                    print("✅ Agent pipeline was successfully integrated!")
                else:
                    print("⚠️  Agent pipeline integration may not be working")
                    
                # Show analysis structure
                analysis = analysis_result.get("analysis", {})
                if analysis:
                    print(f"   - Analysis keys: {list(analysis.keys())}")
                    if "fhirData" in analysis:
                        fhir_data = analysis["fhirData"]
                        print(f"   - FHIR data available: {fhir_data.get('totalRecords', 0)} records")
                        
            else:
                print(f"❌ Full pipeline analysis failed: {analysis_result.get('error')}")
                return False
            
    except ImportError as e:
        print(f"⚠️  Database integration not available: {e}")
        print("   - Cannot test executor and context agents")
        print("   - Cannot test full pipeline")
    except Exception as e:
        print(f"❌ Database integration error: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("🎉 Agent Pipeline Test Completed Successfully!")
    print("\nNext steps:")
    print("1. Test with actual UI generation")
    print("2. Test with different clinical scenarios")
    print("3. Verify real data appears in generated components")
    print("4. Test error handling and fallback scenarios")
    
    return True

async def test_individual_agents():
    """Test individual agents without database dependency"""
    
    print("\n🔧 Testing Individual Agents (No Database)")
    print("-" * 50)
    
    # Test Query Planner in isolation
    test_requests = [
        "Show me patients with diabetes",
        "Display lab results trending over time",
        "Create a medication list for active prescriptions",
        "Show vital signs dashboard"
    ]
    
    query_planner = FHIRQueryPlannerAgent()
    
    for i, request in enumerate(test_requests):
        print(f"\n🧪 Test {i+1}: {request}")
        
        try:
            context = {"userRole": "clinician"}
            result = await query_planner.plan_queries(request, context)
            
            if result["success"]:
                plan = result["queryPlan"]
                print(f"   ✅ Queries: {len(plan.get('queries', []))}")
                print(f"   ✅ Scope: {plan.get('scope')}")
                
                # Show query types
                query_types = [q.get('resourceType') for q in plan.get('queries', [])]
                print(f"   ✅ Resources: {', '.join(query_types)}")
            else:
                print(f"   ❌ Failed: {result.get('error')}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    # Test individual agents first
    asyncio.run(test_individual_agents())
    
    # Then test full pipeline
    asyncio.run(test_agent_pipeline())