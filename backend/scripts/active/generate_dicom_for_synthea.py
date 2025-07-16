#!/usr/bin/env python3
"""
Generate DICOM files for Synthea imaging studies
This is a wrapper that calls enhance_imaging_import.py
"""

import subprocess
import sys
import os
import logging


# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    """Run the enhanced imaging import script to generate DICOMs."""
    script_path = os.path.join(os.path.dirname(__file__), 'enhance_imaging_import.py')
    
    # Run the enhanced imaging import script with generate-dicoms command
    cmd = [sys.executable, script_path, 'generate-dicoms']
    
    logging.info("🖼️  Generating DICOM files for imaging studies...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        logging.info("✅ DICOM generation completed successfully")
        logging.info(result.stdout)
    else:
        logging.info("❌ DICOM generation failed:")
        logging.info(result.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()