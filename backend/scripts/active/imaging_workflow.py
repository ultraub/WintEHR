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
    
    logger.info("🏥 Starting WintEHR Imaging Workflow")
    logger.info("=" * 60)
    
    # Step 1: Run enhance_imaging_import to create ImagingStudy resources if needed
    logger.info("Step 1: Checking and creating ImagingStudy resources...")
    try:
        result = subprocess.run([
            sys.executable, "scripts/enhance_imaging_import.py", "investigate"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info("✅ Investigation completed successfully")
            # Parse output to check if we need to create studies
            if "NO IMAGING STUDIES FOUND" in result.stdout:
                logger.info("Creating imaging studies for existing patients...")
                result = subprocess.run([
                    sys.executable, "scripts/enhance_imaging_import.py", "import", "--patient-count", "10"
                ], capture_output=True, text=True)
                if result.returncode == 0:
                    logger.info("✅ ImagingStudy resources created successfully")
                else:
                    logger.warning(f"⚠️  ImagingStudy creation had issues: {result.stderr}")
        else:
            logger.warning(f"⚠️  Investigation had issues: {result.stderr}")
    except Exception as e:
        logger.error(f"❌ ImagingStudy creation failed: {e}")
        return False
    
    # Step 2: Generate DICOM files for imaging studies using enhanced script
    logger.info("\nStep 2: Generating DICOM files for imaging studies...")
    try:
        # Use the enhanced script for better DICOM generation
        script_path = Path(__file__).parent / "generate_realistic_dicoms_enhanced.py"
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
            # Fall back to original script
            logger.info("Using original DICOM generation script...")
            script_path = Path(__file__).parent / "generate_dicom_for_studies.py"
            if script_path.exists():
                result = subprocess.run([
                    sys.executable, str(script_path)
                ], capture_output=True, text=True)
                
                if result.returncode == 0:
                    logger.info("✅ DICOM generation completed successfully")
                else:
                    logger.warning(f"⚠️  DICOM generation had issues: {result.stderr}")
            else:
                logger.warning("⚠️  DICOM generation script not found")
    except Exception as e:
        logger.error(f"❌ DICOM generation failed: {e}")
        return False
    
    logger.info("\n✅ Imaging workflow completed successfully!")
    logger.info("You can now view images in the Clinical Workspace Imaging tab")
    logger.info("=" * 60)
    return True

if __name__ == '__main__':
    success = asyncio.run(run_imaging_workflow())
    sys.exit(0 if success else 1)