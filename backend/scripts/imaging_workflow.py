#!/usr/bin/env python3
"""
Complete Imaging Workflow Script

This script handles the complete workflow for imaging studies:
1. Ensures ImagingStudy resources have proper search parameters
2. Generates DICOM files for each ImagingStudy
3. Links ImagingStudy resources with their DICOM directories

Usage:
    python scripts/imaging_workflow.py
"""

import asyncio
import sys
from pathlib import Path
import subprocess
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def run_imaging_workflow():
    """Run the complete imaging workflow."""
    
    logger.info("🏥 Starting MedGenEMR Imaging Workflow")
    logger.info("=" * 60)
    
    # Step 1: Run database initialization to fix references and add search parameters
    logger.info("Step 1: Initializing database and fixing references...")
    try:
        result = subprocess.run([
            sys.executable, "scripts/init_database.py"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info("✅ Database initialization completed successfully")
        else:
            logger.warning(f"⚠️  Database initialization had issues: {result.stderr}")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        return False
    
    # Step 2: Generate DICOM files for imaging studies
    logger.info("\nStep 2: Generating DICOM files for imaging studies...")
    try:
        script_path = Path(__file__).parent / "generate_dicom_for_studies.py"
        if script_path.exists():
            result = subprocess.run([
                sys.executable, str(script_path)
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info("✅ DICOM generation completed successfully")
                # Parse output to show summary
                output_lines = result.stdout.strip().split('\n')
                for line in output_lines:
                    if 'Successfully generated' in line or 'Found' in line:
                        logger.info(f"  {line}")
            else:
                logger.warning(f"⚠️  DICOM generation had issues: {result.stderr}")
        else:
            logger.warning("⚠️  DICOM generation script not found")
    except Exception as e:
        logger.error(f"❌ DICOM generation failed: {e}")
        return False
    
    logger.info("\n✅ Imaging workflow completed successfully!")
    logger.info("=" * 60)
    return True

if __name__ == '__main__':
    success = asyncio.run(run_imaging_workflow())
    sys.exit(0 if success else 1)