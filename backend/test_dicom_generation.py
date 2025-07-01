#!/usr/bin/env python3
"""
Test DICOM generation with the enhanced Synthea import
"""

import os
import sys
import subprocess
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_dicom_generation():
    """Test the enhanced Synthea import with DICOM generation"""
    
    print("=== Testing DICOM Generation with Synthea Import ===\n")
    
    # First, let's check current status
    print("1. Checking current database status...")
    from sqlalchemy import create_engine, text
    from database.database import engine
    
    with engine.connect() as conn:
        # Check for existing studies
        result = conn.execute(text('SELECT COUNT(*) FROM imaging_studies'))
        imaging_count = result.scalar()
        print(f"   Existing imaging studies: {imaging_count}")
        
        result = conn.execute(text('SELECT COUNT(*) FROM dicom_studies'))
        dicom_count = result.scalar()
        print(f"   Existing DICOM studies: {dicom_count}")
        
        # Show some imaging studies
        result = conn.execute(text('''
            SELECT id, description, modality, study_date 
            FROM imaging_studies 
            LIMIT 5
        '''))
        print("\n   Sample imaging studies:")
        for row in result:
            print(f"   - {row[1]} ({row[2]}) on {row[3]}")
    
    print("\n2. Running enhanced Synthea import with DICOM generation...")
    
    # Path to Synthea output
    script_dir = Path(__file__).parent
    synthea_dir = script_dir / "data" / "synthea_output" / "fhir"
    import_script = script_dir / "scripts" / "optimized_synthea_import_with_dicom.py"
    
    if not synthea_dir.exists():
        print(f"   ERROR: Synthea output directory not found: {synthea_dir}")
        return False
    
    # Run the import with DICOM generation
    try:
        result = subprocess.run([
            sys.executable,
            str(import_script),
            "--input-dir", str(synthea_dir),
            "--batch-size", "20"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"   ERROR: Import failed\n{result.stderr}")
            return False
            
        print("   ✓ Import completed successfully")
        
        # Show last part of output
        output_lines = result.stdout.strip().split('\n')
        print("\n   Import summary:")
        for line in output_lines[-15:]:
            if line.strip():
                print(f"   {line}")
        
    except Exception as e:
        print(f"   ERROR: {e}")
        return False
    
    print("\n3. Checking results after import...")
    
    with engine.connect() as conn:
        # Check updated counts
        result = conn.execute(text('SELECT COUNT(*) FROM imaging_studies'))
        new_imaging_count = result.scalar()
        print(f"   Total imaging studies: {new_imaging_count}")
        
        result = conn.execute(text('SELECT COUNT(*) FROM dicom_studies'))
        new_dicom_count = result.scalar()
        print(f"   Total DICOM studies: {new_dicom_count}")
        
        print(f"\n   New DICOM studies created: {new_dicom_count - dicom_count}")
        
        # Show DICOM study details
        result = conn.execute(text('''
            SELECT ds.study_description, ds.modality, ds.number_of_instances,
                   p.first_name, p.last_name
            FROM dicom_studies ds
            JOIN patients p ON ds.patient_id = p.id
            ORDER BY ds.created_at DESC
            LIMIT 5
        '''))
        
        print("\n   Recent DICOM studies:")
        for row in result:
            print(f"   - {row[0]} ({row[1]}) - {row[2]} images for {row[3]} {row[4]}")
    
    # Check DICOM files on disk
    dicom_dir = script_dir / "data" / "dicom_uploads"
    if dicom_dir.exists():
        dicom_files = list(dicom_dir.rglob("*.dcm"))
        print(f"\n   DICOM files on disk: {len(dicom_files)}")
    
    return True


if __name__ == "__main__":
    success = test_dicom_generation()
    sys.exit(0 if success else 1)