#!/usr/bin/env python3
"""
Optimized comprehensive database setup script for EMR system
Memory-efficient version that prevents heap overflow errors
"""
import sys
import os
import subprocess
import argparse
import gc
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database.database import get_db, engine
from models import models, synthea_models
from models.session import UserSession, PatientProviderAssignment
from models.clinical.catalogs import MedicationCatalog, LabTestCatalog, ImagingStudyCatalog, ClinicalOrderSet
from models.clinical.notes import ClinicalNote, NoteTemplate
from models.clinical.orders import Order, OrderSet as OrderSetModel
from models.clinical.tasks import ClinicalTask, InboxItem


def create_all_tables():
    """Create all database tables with memory optimization"""
    print("Creating database tables...")
    
    # Import and create tables in smaller chunks to avoid memory issues
    models.Base.metadata.create_all(bind=engine)
    gc.collect()
    
    synthea_models.Base.metadata.create_all(bind=engine)
    gc.collect()
    
    # Import clinical models
    from models.clinical import notes, orders, tasks, catalogs
    notes.Base.metadata.create_all(bind=engine)
    gc.collect()
    
    orders.Base.metadata.create_all(bind=engine)
    gc.collect()
    
    tasks.Base.metadata.create_all(bind=engine)
    gc.collect()
    
    catalogs.Base.metadata.create_all(bind=engine)
    gc.collect()
    
    print("✓ Database tables created successfully")


def run_script_with_memory_management(script_path, description, memory_limit_mb=1000):
    """Run a Python script with memory management and monitoring"""
    try:
        print(f"\n{description}...")
        
        # Use subprocess with memory limits if available
        env = os.environ.copy()
        env['NODE_OPTIONS'] = f'--max-old-space-size={memory_limit_mb}'
        
        result = subprocess.run(
            [sys.executable, script_path], 
            capture_output=True, 
            text=True, 
            check=True,
            env=env
        )
        
        print(f"✓ {description} completed successfully")
        if result.stdout:
            print(result.stdout[-1000:])  # Show only last 1000 chars to avoid memory issues
        
        # Force garbage collection after each script
        gc.collect()
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"✗ {description} failed:")
        print(f"Error: {e.stderr[-1000:]}")  # Show only last 1000 chars
        return False
    except FileNotFoundError:
        print(f"✗ Script not found: {script_path}")
        return False


def run_optimized_synthea_generation(num_patients=50):
    """Generate synthetic patients using Synthea with memory optimization"""
    print(f"\nGenerating {num_patients} synthetic patients with Synthea (optimized)...")
    
    # Find Synthea JAR file
    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent
    
    # Check multiple possible locations
    possible_paths = [
        backend_dir / "synthea-with-dependencies.jar",
        backend_dir / "synthea" / "synthea-with-dependencies.jar", 
        script_dir / "synthea-with-dependencies.jar",
        script_dir / "synthea" / "synthea-with-dependencies.jar"
    ]
    
    synthea_jar = None
    for path in possible_paths:
        if path.exists():
            synthea_jar = path
            break
    
    if not synthea_jar:
        print("✗ Synthea JAR file not found. Please ensure synthea-with-dependencies.jar is available.")
        print("  Checked locations:")
        for path in possible_paths:
            print(f"    {path}")
        return False
    
    # Create output directory
    output_dir = script_dir.parent / "data" / "synthea_output"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Run Synthea with memory constraints (smaller heap size)
        java_cmd = [
            "java", 
            "-Xmx2g",  # Limit Java heap to 2GB
            "-XX:+UseG1GC",  # Use G1 garbage collector for better memory management
            "-XX:MaxGCPauseMillis=200",  # Limit GC pause time
            "-jar", str(synthea_jar),
            "-p", str(num_patients),
            "-s", "12345",  # Fixed seed for reproducibility
            "--exporter.fhir.export", "true",
            "--exporter.baseDirectory", str(output_dir),
            "Massachusetts"  # Default state
        ]
        
        print(f"Running: {' '.join(java_cmd)}")
        result = subprocess.run(java_cmd, capture_output=True, text=True, check=True, timeout=300)
        
        print("✓ Synthea generation completed successfully")
        
        # Force garbage collection
        gc.collect()
        return True
        
    except subprocess.TimeoutExpired:
        print("✗ Synthea generation timed out (5 minutes)")
        return False
    except subprocess.CalledProcessError as e:
        print(f"✗ Synthea generation failed: {e.stderr}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error during Synthea generation: {e}")
        return False


def run_optimized_import(num_patients=50):
    """Run the optimized import process"""
    print(f"\nImporting Synthea data using optimized importer...")
    
    script_dir = Path(__file__).parent
    output_dir = script_dir.parent / "data" / "synthea_output" / "fhir"
    import_script = script_dir / "optimized_synthea_import.py"
    
    if not output_dir.exists():
        print(f"✗ Synthea output directory not found: {output_dir}")
        return False
    
    try:
        # Calculate appropriate batch size based on number of patients
        batch_size = max(10, min(50, num_patients // 5))
        
        result = subprocess.run([
            sys.executable, 
            str(import_script),
            "--input-dir", str(output_dir),
            "--batch-size", str(batch_size)
        ], capture_output=True, text=True, check=True)
        
        print("✓ Optimized data import completed successfully")
        print(result.stdout[-500:])  # Show last 500 chars of output
        
        # Force garbage collection
        gc.collect()
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"✗ Data import failed: {e.stderr}")
        return False


def main():
    """Main setup function with memory optimization"""
    parser = argparse.ArgumentParser(description='Optimized EMR System Setup')
    parser.add_argument('--patients', type=int, default=50,
                       help='Number of patients to generate (default: 50)')
    parser.add_argument('--skip-synthea', action='store_true',
                       help='Skip Synthea generation step')
    parser.add_argument('--skip-import', action='store_true',
                       help='Skip data import step')
    parser.add_argument('--quick', action='store_true',
                       help='Quick setup with minimal data (25 patients)')
    
    args = parser.parse_args()
    
    if args.quick:
        args.patients = 25
    
    print("🏥 EMR System - Optimized Comprehensive Setup")
    print("=" * 60)
    print(f"Generating {args.patients} patients with memory optimization")
    
    success_count = 0
    total_steps = 6
    
    # Step 1: Create database tables
    try:
        create_all_tables()
        success_count += 1
    except Exception as e:
        print(f"✗ Database table creation failed: {e}")
    
    # Force garbage collection after table creation
    gc.collect()
    
    # Step 2: Create sample providers
    script_dir = Path(__file__).parent
    if run_script_with_memory_management(
        script_dir / "create_sample_providers.py",
        "Creating sample providers"
    ):
        success_count += 1
    
    # Step 3: Populate clinical catalogs
    if run_script_with_memory_management(
        script_dir / "populate_clinical_catalogs.py",
        "Populating clinical catalogs"
    ):
        success_count += 1
    
    # Step 4: Generate Synthea data (if not skipped)
    if not args.skip_synthea:
        if run_optimized_synthea_generation(args.patients):
            success_count += 1
    else:
        print("Skipping Synthea generation...")
        success_count += 1
    
    # Step 5: Import Synthea data (if not skipped)
    if not args.skip_import:
        if run_optimized_import(args.patients):
            success_count += 1
    else:
        print("Skipping data import...")
        success_count += 1
    
    # Step 6: Assign patients to providers
    if run_script_with_memory_management(
        script_dir / "assign_patients_to_providers.py",
        "Assigning patients to providers"
    ):
        success_count += 1
    
    # Final summary
    print("\n" + "=" * 60)
    print("📊 Setup Summary")
    print("=" * 60)
    
    success_rate = (success_count / total_steps) * 100
    print(f"Steps completed: {success_count}/{total_steps}")
    print(f"Success rate: {success_rate:.1f}%")
    
    if success_count == total_steps:
        print("\n🎉 EMR system setup completed successfully!")
        print("\n📋 Next Steps:")
        print("1. Start backend: cd EMR/backend && python main.py")
        print("2. Start frontend: cd EMR/frontend && npm start")
        print("3. Access system: http://localhost:3000")
        return 0
    else:
        failed_steps = total_steps - success_count
        print(f"\n⚠️  {failed_steps} step(s) failed. Please review errors above.")
        print("You may be able to run the system with partial data.")
        return 1


if __name__ == "__main__":
    exit(main())