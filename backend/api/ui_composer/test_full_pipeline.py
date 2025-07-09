#!/usr/bin/env python3
"""
Full pipeline test for hypertension and stroke risk factors
Tests that the output is directly related to the initial prompt
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path
import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.agents.ui_generation_orchestrator import UIGenerationOrchestrator

async def test_hypertension_stroke_risk():
    """Test the full pipeline with hypertension and stroke risk query"""
    
    # The exact prompt to test
    prompt = "show me all patients with high blood pressure, and their corresponding risk factors for stroke"
    
    # Context for the query
    context = {
        "userRole": "clinician",
        "useQueryDriven": True,
        "scope": "population",
        "dateRange": "all"  # Don't restrict by date to ensure we find data
    }
    
    logger.info("=" * 80)
    logger.info("🚀 FULL PIPELINE TEST: Hypertension & Stroke Risk Factors")
    logger.info("=" * 80)
    logger.info(f"📝 Initial Prompt: {prompt}")
    logger.info("=" * 80)
    
    # Create orchestrator
    orchestrator = UIGenerationOrchestrator()
    
    # Track timing
    start_time = datetime.now()
    
    # Run the full pipeline
    result = await orchestrator.generate_ui_from_request(prompt, context)
    
    end_time = datetime.now()
    total_time = (end_time - start_time).total_seconds()
    
    if result["success"]:
        logger.info("\n✅ PIPELINE COMPLETED SUCCESSFULLY!")
        logger.info(f"⏱️  Total execution time: {total_time:.2f} seconds")
        
        # 1. Analyze Query Plan
        logger.info("\n" + "=" * 60)
        logger.info("📋 1. QUERY PLAN ANALYSIS")
        logger.info("=" * 60)
        
        query_plan = result["query_plan"]
        logger.info(f"Reasoning: {query_plan.get('reasoning', 'N/A')}")
        logger.info(f"Scope: {query_plan.get('scope', 'N/A')}")
        
        if query_plan.get("queryGraph"):
            stages = query_plan["queryGraph"].get("stages", {})
            logger.info(f"\nQuery Stages ({len(stages)} total):")
            
            for stage_id, stage in stages.items():
                logger.info(f"\n  {stage_id}:")
                logger.info(f"    - Resource: {stage.get('resourceType')}")
                logger.info(f"    - Purpose: {stage.get('purpose')}")
                
                # Check if this stage is related to hypertension or stroke risk
                filters = stage.get('filters', {})
                if 'code' in filters:
                    logger.info(f"    - Codes: {filters['code']}")
                    
                    # Check for hypertension codes
                    if any(code in filters['code'] for code in ['38341003', '59621000', '8480-6', '8462-4']):
                        logger.info("    ✓ HYPERTENSION-RELATED")
                    
                    # Check for stroke risk factor codes
                    stroke_risk_codes = ['44054006', '73211009', '49436004', '53741008']  # diabetes, smoking, atrial fib, etc.
                    if any(code in filters['code'] for code in stroke_risk_codes):
                        logger.info("    ✓ STROKE RISK FACTOR")
                
                if '_include' in stage:
                    logger.info(f"    - Includes: {stage['_include']}")
                if 'dependsOn' in stage:
                    logger.info(f"    - Depends on: {stage['dependsOn']}")
        
        # 2. Analyze Execution Results
        logger.info("\n" + "=" * 60)
        logger.info("📊 2. QUERY EXECUTION RESULTS")
        logger.info("=" * 60)
        
        stats = result["execution_stats"]
        logger.info(f"Total resources retrieved: {stats['total_resources']}")
        logger.info(f"Query execution time: {stats.get('query_execution_stats', {}).get('total_time', 0):.2f}s")
        logger.info(f"Data complexity: {stats['complexity']}")
        
        # 3. Analyze Data Found
        logger.info("\n" + "=" * 60)
        logger.info("🔍 3. DATA ANALYSIS")
        logger.info("=" * 60)
        
        data_analysis = result["data_analysis"]
        logger.info(f"Primary entity: {data_analysis.get('primary_entity')}")
        logger.info(f"Resource types found: {list(data_analysis.get('resource_types', {}).keys())}")
        
        for resource_type, count in data_analysis.get('resource_types', {}).items():
            logger.info(f"  - {resource_type}: {count} resources")
        
        logger.info(f"Relationships discovered: {data_analysis.get('relationships')}")
        logger.info(f"Has temporal data: {data_analysis.get('temporal_data')}")
        logger.info(f"Has aggregations: {bool(data_analysis.get('aggregations'))}")
        
        # 4. Analyze UI Structure
        logger.info("\n" + "=" * 60)
        logger.info("🎨 4. UI STRUCTURE DECISION")
        logger.info("=" * 60)
        
        ui_structure = result["ui_structure"]
        logger.info(f"Primary pattern: {ui_structure.get('primary_pattern')}")
        logger.info(f"Components: {', '.join(ui_structure.get('components', []))}")
        logger.info(f"Layout type: {ui_structure.get('layout', {}).get('type')}")
        logger.info(f"Interactions: {', '.join(ui_structure.get('interactions', []))}")
        
        logger.info("\nUI Reasoning:")
        for reason in ui_structure.get('reasoning', []):
            logger.info(f"  - {reason}")
        
        # 5. Analyze Generated Component
        logger.info("\n" + "=" * 60)
        logger.info("💻 5. GENERATED COMPONENT ANALYSIS")
        logger.info("=" * 60)
        
        component_code = result["component_code"]
        
        # Check for hypertension-related content
        hypertension_keywords = ['blood pressure', 'hypertension', 'systolic', 'diastolic', '8480-6', '8462-4']
        stroke_keywords = ['stroke', 'risk', 'diabetes', 'smoking', 'atrial fibrillation']
        
        found_hypertension = any(keyword.lower() in component_code.lower() for keyword in hypertension_keywords)
        found_stroke = any(keyword.lower() in component_code.lower() for keyword in stroke_keywords)
        
        logger.info(f"Contains hypertension-related content: {'✓ YES' if found_hypertension else '✗ NO'}")
        logger.info(f"Contains stroke risk content: {'✓ YES' if found_stroke else '✗ NO'}")
        
        # Count key elements
        import_count = component_code.count('import')
        state_count = component_code.count('useState')
        effect_count = component_code.count('useEffect')
        
        logger.info(f"\nComponent structure:")
        logger.info(f"  - Import statements: {import_count}")
        logger.info(f"  - State variables: {state_count}")
        logger.info(f"  - Effects: {effect_count}")
        logger.info(f"  - Total lines: {len(component_code.splitlines())}")
        
        # Save the component
        output_file = Path("generated_hypertension_stroke_component.js")
        output_file.write_text(component_code)
        logger.info(f"\n💾 Component saved to: {output_file}")
        
        # 6. Validate Relevance
        logger.info("\n" + "=" * 60)
        logger.info("✅ 6. RELEVANCE VALIDATION")
        logger.info("=" * 60)
        
        relevance_score = 0
        max_score = 5
        
        # Check query plan relevance
        if any('hypertens' in str(query_plan).lower() or 'blood pressure' in str(query_plan).lower() for _ in [1]):
            relevance_score += 1
            logger.info("✓ Query plan mentions hypertension/blood pressure")
        else:
            logger.info("✗ Query plan doesn't mention hypertension/blood pressure")
        
        if any('stroke' in str(query_plan).lower() or 'risk' in str(query_plan).lower() for _ in [1]):
            relevance_score += 1
            logger.info("✓ Query plan mentions stroke/risk")
        else:
            logger.info("✗ Query plan doesn't mention stroke/risk")
        
        # Check if appropriate resource types were queried
        if 'Condition' in str(query_plan) or 'Observation' in str(query_plan):
            relevance_score += 1
            logger.info("✓ Queries appropriate resource types (Condition/Observation)")
        
        # Check data results
        if stats['total_resources'] > 0:
            relevance_score += 1
            logger.info(f"✓ Found {stats['total_resources']} resources")
        else:
            logger.info("✗ No resources found")
        
        # Check component content
        if found_hypertension or found_stroke:
            relevance_score += 1
            logger.info("✓ Component contains relevant medical content")
        else:
            logger.info("✗ Component doesn't contain relevant medical content")
        
        logger.info(f"\n🎯 RELEVANCE SCORE: {relevance_score}/{max_score}")
        
        if relevance_score >= 3:
            logger.info("✅ OUTPUT IS RELEVANT TO THE PROMPT!")
        else:
            logger.info("⚠️  OUTPUT MAY NOT BE FULLY RELEVANT TO THE PROMPT")
        
        # 7. Show component preview
        logger.info("\n" + "=" * 60)
        logger.info("📝 7. COMPONENT PREVIEW (First 30 lines)")
        logger.info("=" * 60)
        
        lines = component_code.splitlines()[:30]
        for i, line in enumerate(lines, 1):
            logger.info(f"{i:3d}: {line}")
        
    else:
        logger.error(f"\n❌ PIPELINE FAILED: {result.get('error')}")
        logger.error(f"Component code: {result.get('component_code')}")

if __name__ == "__main__":
    asyncio.run(test_hypertension_stroke_risk())