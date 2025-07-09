#!/usr/bin/env python3
"""
Test Full Generation Mode with complex medical queries
Demonstrates query-driven UI generation with creative components
"""

import asyncio
import logging
from pathlib import Path
import json
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.agents.ui_generation_orchestrator import UIGenerationOrchestrator

async def test_full_generation_mode():
    """Test complete pipeline with full generation mode"""
    
    logger.info("=" * 80)
    logger.info("🎨 TESTING FULL GENERATION MODE")
    logger.info("=" * 80)
    
    # Complex medical queries to test
    test_cases = [
        {
            "name": "Hypertension Management Dashboard",
            "request": "Create a comprehensive dashboard for managing hypertensive patients showing blood pressure trends, medication adherence, lifestyle factors, and stroke risk assessment",
            "mode": "full"
        },
        {
            "name": "Diabetes Care Tracker",
            "request": "Build an interactive diabetes management interface with A1C trends, glucose monitoring, medication tracking, and complication risk indicators",
            "mode": "full"
        },
        {
            "name": "Population Health Overview",
            "request": "Generate a population health dashboard showing chronic disease prevalence, risk stratification, and care gaps for all patients",
            "mode": "mixed"
        },
        {
            "name": "Patient Vital Signs Monitor",
            "request": "Show real-time vital signs monitoring with alerts for abnormal values and trend analysis",
            "mode": "template"
        }
    ]
    
    # Create orchestrator
    orchestrator = UIGenerationOrchestrator()
    
    for test_case in test_cases:
        logger.info(f"\n{'='*60}")
        logger.info(f"📋 Test Case: {test_case['name']}")
        logger.info(f"Mode: {test_case['mode'].upper()}")
        logger.info(f"Request: {test_case['request']}")
        logger.info("="*60)
        
        start_time = datetime.now()
        
        # Run the pipeline with specific generation mode
        context = {
            "userRole": "clinician",
            "scope": "population" if "population" in test_case['request'].lower() else "patient"
        }
        
        result = await orchestrator.generate_ui_from_request(
            test_case['request'],
            context,
            component_name=test_case['name'].replace(" ", ""),
            generation_mode=test_case['mode']
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        if result['success']:
            logger.info(f"\n✅ SUCCESS - Generated in {execution_time:.2f} seconds")
            
            # Analyze generated component
            component_code = result['component_code']
            
            # Check for key features based on mode
            logger.info("\n🔍 Component Analysis:")
            
            # Count imports
            import_lines = [line for line in component_code.splitlines() if line.strip().startswith('import')]
            logger.info(f"  - Import statements: {len(import_lines)}")
            
            # Check for MedGenEMR integration
            has_patient_resources = 'usePatientResources' in component_code
            has_fhir_client = 'useFHIRClient' in component_code
            has_websocket = 'useWebSocket' in component_code
            
            logger.info(f"  - Uses usePatientResources: {'✓' if has_patient_resources else '✗'}")
            logger.info(f"  - Uses useFHIRClient: {'✓' if has_fhir_client else '✗'}")
            logger.info(f"  - Uses WebSocket: {'✓' if has_websocket else '✗'}")
            
            # Check for advanced features in full mode
            if test_case['mode'] == 'full':
                has_animations = 'framer-motion' in component_code or 'react-spring' in component_code
                has_advanced_charts = 'RadarChart' in component_code or 'ScatterChart' in component_code
                has_real_time = 'realTimeData' in component_code
                
                logger.info(f"  - Has animations: {'✓' if has_animations else '✗'}")
                logger.info(f"  - Has advanced charts: {'✓' if has_advanced_charts else '✗'}")
                logger.info(f"  - Has real-time updates: {'✓' if has_real_time else '✗'}")
            
            # Check query execution
            logger.info(f"\n📊 Query Execution:")
            logger.info(f"  - Total resources: {result['execution_stats']['total_resources']}")
            logger.info(f"  - Resource types: {', '.join(result['data_analysis']['resource_types'].keys())}")
            logger.info(f"  - Has temporal data: {'✓' if result['data_analysis']['temporal_data'] else '✗'}")
            logger.info(f"  - Complexity: {result['data_analysis']['metrics']['complexity']}")
            
            # Save component
            output_file = Path(f"generated_{test_case['mode']}_{test_case['name'].replace(' ', '_').lower()}.js")
            output_file.write_text(component_code)
            logger.info(f"\n💾 Component saved to: {output_file}")
            
            # Show preview
            logger.info(f"\n📝 Component Preview (first 20 lines):")
            lines = component_code.splitlines()[:20]
            for i, line in enumerate(lines, 1):
                logger.info(f"  {i:2}: {line}")
        else:
            logger.error(f"\n❌ FAILED: {result.get('error')}")
    
    logger.info("\n" + "="*80)
    logger.info("🏁 ALL TESTS COMPLETE")
    logger.info("="*80)

async def test_specific_mode():
    """Test a specific generation mode with detailed output"""
    
    mode = "full"  # Change this to test different modes
    
    logger.info(f"\n🎯 Testing {mode.upper()} Generation Mode in Detail")
    
    request = "Create a comprehensive patient monitoring dashboard showing vital signs trends, lab results with abnormal value alerts, medication compliance tracking, and predictive risk scores for deterioration"
    
    orchestrator = UIGenerationOrchestrator()
    
    context = {
        "userRole": "clinician",
        "scope": "patient",
        "patientId": "test-patient-123"
    }
    
    result = await orchestrator.generate_ui_from_request(
        request,
        context,
        component_name="PatientMonitoringDashboard",
        generation_mode=mode
    )
    
    if result['success']:
        # Save full result for analysis
        output_dir = Path("test_output")
        output_dir.mkdir(exist_ok=True)
        
        # Save component
        component_file = output_dir / f"{mode}_mode_component.js"
        component_file.write_text(result['component_code'])
        
        # Save metadata
        metadata_file = output_dir / f"{mode}_mode_metadata.json"
        metadata = {
            "request": request,
            "generation_mode": mode,
            "execution_stats": result['execution_stats'],
            "data_analysis": result['data_analysis'],
            "ui_structure": result['ui_structure'],
            "query_plan": result['query_plan']
        }
        metadata_file.write_text(json.dumps(metadata, indent=2))
        
        logger.info(f"\n✅ Test outputs saved to {output_dir}/")
        logger.info(f"  - Component: {component_file.name}")
        logger.info(f"  - Metadata: {metadata_file.name}")
        
        # Detailed analysis
        logger.info("\n📊 Detailed Component Analysis:")
        component_lines = result['component_code'].splitlines()
        
        # Count different types of elements
        mui_components = sum(1 for line in component_lines if '@mui/material' in line or '<Card' in line or '<Box' in line)
        chart_components = sum(1 for line in component_lines if 'Chart>' in line or 'recharts' in line)
        fhir_hooks = sum(1 for line in component_lines if 'usePatientResources' in line or 'useFHIRClient' in line)
        
        logger.info(f"  - Total lines: {len(component_lines)}")
        logger.info(f"  - MUI component references: {mui_components}")
        logger.info(f"  - Chart component references: {chart_components}")
        logger.info(f"  - FHIR hook usage: {fhir_hooks}")
        
        # Check actual data fetching
        logger.info("\n🔍 Data Fetching Analysis:")
        for i, line in enumerate(component_lines):
            if 'usePatientResources' in line:
                logger.info(f"  Line {i+1}: {line.strip()}")

if __name__ == "__main__":
    # Run all tests
    asyncio.run(test_full_generation_mode())
    
    # Run detailed test for specific mode
    # asyncio.run(test_specific_mode())