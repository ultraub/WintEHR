#!/usr/bin/env python3
"""
Test dashboard generation with multiple components
Verifies that full dashboards are generated correctly
"""

import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.ui_composer.ui_composer_service import ui_composer_service

async def test_dashboard_generation():
    """Test that dashboard generation includes all components"""
    
    logger.info("=" * 80)
    logger.info("🧪 TESTING DASHBOARD GENERATION WITH MULTIPLE COMPONENTS")
    logger.info("=" * 80)
    
    # Create a specification similar to what the analyze phase would create
    specification = {
        "version": "1.0",
        "metadata": {
            "name": "Hypertension & Stroke Risk Dashboard",
            "description": "Display patients with hypertension and stroke risk",
            "generationMode": "full",
            "clinicalContext": {
                "scope": "population",
                "dataRequirements": ["Patient", "Observation", "Condition", "MedicationRequest"]
            },
            "agentPipeline": {
                "enabled": True,
                "dataContext": {
                    "totalRecords": 0,
                    "resourceSummary": {},
                    "sampleData": {},
                    "clinicalContext": {
                        "primaryClinicalFocus": "Hypertension and stroke risk",
                        "clinicalDomain": ["cardiology", "neurology"],
                        "temporalContext": "current"
                    }
                },
                "formattedContext": "No data found but structure is ready"
            }
        },
        "layout": {
            "type": "dashboard",
            "structure": {
                "structure": "Three-row layout: Top row with summary stats, middle row with patient grid (60%) and risk chart (40%), bottom row with trends",
                "responsive": "Stack vertically on mobile"
            }
        },
        "components": [
            {
                "id": "comp-0",
                "type": "stat",
                "props": {
                    "title": "Hypertension Overview",
                    "metrics": ["Total Patients", "High Risk", "Controlled BP"]
                },
                "dataBinding": {
                    "resourceType": "Patient",
                    "filters": ["has-hypertension"],
                    "aggregation": "count"
                }
            },
            {
                "id": "comp-1",
                "type": "chart",
                "props": {
                    "title": "Stroke Risk Distribution",
                    "chartType": "bar"
                },
                "dataBinding": {
                    "resourceType": "Patient",
                    "aggregation": "risk-distribution"
                }
            },
            {
                "id": "comp-2",
                "type": "grid",
                "props": {
                    "title": "Patient List",
                    "columns": ["Name", "BP", "Risk Level"]
                },
                "dataBinding": {
                    "resourceType": "Patient"
                }
            }
        ]
    }
    
    logger.info(f"Testing with {len(specification['components'])} components")
    
    try:
        # Test generation
        components = await ui_composer_service.generate_components(
            specification,
            method="cli"
        )
        
        logger.info(f"\n✅ Generation completed")
        logger.info(f"Generated components: {list(components.keys())}")
        
        # Check the result
        main_component = components.get("main", "")
        
        # Analyze what was generated
        logger.info("\n📊 Analysis:")
        is_code = any(keyword in main_component for keyword in ['import React', 'export default', 'const '])
        logger.info(f"Is React code: {'✓' if is_code else '✗'}")
        
        if is_code:
            # Count key elements
            import_count = main_component.count('import ')
            component_count = main_component.count('const ')
            chart_count = main_component.count('Chart')
            grid_count = main_component.count('Grid')
            
            logger.info(f"Import statements: {import_count}")
            logger.info(f"Component definitions: {component_count}")
            logger.info(f"Chart references: {chart_count}")
            logger.info(f"Grid references: {grid_count}")
            
            # Check for all 3 components
            has_stat = 'Hypertension Overview' in main_component or 'Total Patients' in main_component
            has_chart = 'Stroke Risk' in main_component or 'BarChart' in main_component
            has_grid = 'Patient List' in main_component or 'DataGrid' in main_component
            
            logger.info(f"\nComponent presence:")
            logger.info(f"Stats component: {'✓' if has_stat else '✗'}")
            logger.info(f"Chart component: {'✓' if has_chart else '✗'}")
            logger.info(f"Grid component: {'✓' if has_grid else '✗'}")
            
            # Save the generated component
            output_file = Path("test_dashboard_output.js")
            output_file.write_text(main_component)
            logger.info(f"\n💾 Saved to: {output_file}")
            
            # Show first 30 lines
            logger.info("\n📝 Preview (first 30 lines):")
            lines = main_component.splitlines()[:30]
            for i, line in enumerate(lines, 1):
                logger.info(f"{i:3}: {line}")
        else:
            logger.error("❌ Generated content is not React code!")
            logger.error(f"Content preview: {main_component[:500]}...")
            
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(test_dashboard_generation())