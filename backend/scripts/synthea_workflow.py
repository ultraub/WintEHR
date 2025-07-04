#!/usr/bin/env python3
"""
Consolidated Synthea Workflow Script
A unified script for managing Synthea data generation, validation, and import processes.

This replaces multiple scattered scripts with a single, comprehensive tool for:
- Running Synthea to generate synthetic patient data
- Validating and transforming FHIR resources
- Importing data into the MedGenEMR database
- Managing database setup and cleanup
- Generating additional clinical data (DICOM, etc.)
"""

import asyncio
import json
import os
import sys
import subprocess
import argparse
import shutil
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4
import time

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
from importers.synthea_fhir import SyntheaFHIRImporter


class SyntheaWorkflow:
    """Unified Synthea workflow management."""
    
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.backend_dir = self.script_dir.parent
        self.root_dir = self.backend_dir.parent
        self.synthea_dir = self.backend_dir / "synthea"
        self.output_dir = self.synthea_dir / "output" / "fhir"
        
        # Database setup
        self.engine = None
        
    async def init_db(self):
        """Initialize database connection."""
        self.engine = create_async_engine(DATABASE_URL)
        
    async def close_db(self):
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()
    
    def run_command(self, command, cwd=None, shell=False):
        """Run a shell command and return the result."""
        try:
            print(f"Running: {' '.join(command) if isinstance(command, list) else command}")
            result = subprocess.run(
                command,
                cwd=cwd or self.synthea_dir,
                shell=shell,
                capture_output=True,
                text=True,
                check=True
            )
            print(f"✅ Command completed successfully")
            return result
        except subprocess.CalledProcessError as e:
            print(f"❌ Command failed: {e}")
            print(f"stdout: {e.stdout}")
            print(f"stderr: {e.stderr}")
            raise
    
    def setup_synthea(self):
        """Set up Synthea environment."""
        print("🔧 Setting up Synthea environment...")
        
        if not self.synthea_dir.exists():
            print(f"❌ Synthea directory not found: {self.synthea_dir}")
            print("Please clone Synthea into the backend/synthea directory")
            return False
        
        # Check if Synthea is built
        gradle_jar = self.synthea_dir / "build" / "libs"
        if not gradle_jar.exists() or not list(gradle_jar.glob("synthea-*.jar")):
            print("🔨 Building Synthea...")
            self.run_command(["./gradlew", "build"], cwd=self.synthea_dir)
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        print("✅ Synthea environment ready")
        return True
    
    def generate_patients(self, count=5, state="Massachusetts", city=None):
        """Generate synthetic patients using Synthea."""
        print(f"👥 Generating {count} patients...")
        
        # Build command
        cmd = ["./run_synthea"]
        if state:
            cmd.extend(["-s", str(count), state])
        else:
            cmd.extend(["-p", str(count)])
        
        if city:
            cmd.extend(["-c", city])
        
        # Run Synthea
        self.run_command(cmd, cwd=self.synthea_dir)
        
        # List generated files
        fhir_files = list(self.output_dir.glob("*.json"))
        print(f"✅ Generated {len(fhir_files)} FHIR files")
        
        return fhir_files
    
    async def clear_database(self, confirm=False):
        """Clear all data from the database."""
        if not confirm:
            response = input("⚠️  This will delete ALL data. Type 'yes' to confirm: ")
            if response.lower() != 'yes':
                print("❌ Database clear cancelled")
                return False
        
        print("🗑️  Clearing database...")
        
        async with AsyncSession(self.engine) as session:
            # Drop all tables and recreate schema
            await session.execute(text("""
                DROP SCHEMA IF EXISTS public CASCADE;
                CREATE SCHEMA public;
            """))
            await session.commit()
        
        print("✅ Database cleared")
        return True
    
    async def init_database_schema(self):
        """Initialize database schema."""
        print("🏗️  Initializing database schema...")
        
        # Import models to create tables
        from models.models import Base
        from database import engine as sync_engine
        
        # Create all tables
        Base.metadata.create_all(sync_engine)
        
        print("✅ Database schema initialized")
    
    async def import_fhir_data(self, file_paths=None, validate=True):
        """Import FHIR data into the database."""
        if file_paths is None:
            file_paths = list(self.output_dir.glob("*.json"))
        
        if not file_paths:
            print("❌ No FHIR files found to import")
            return False
        
        print(f"📥 Importing {len(file_paths)} FHIR files...")
        
        # Use the existing FHIR importer
        importer = SyntheaFHIRImporter()
        
        total_imported = 0
        for file_path in file_paths:
            try:
                print(f"  📄 Importing: {file_path.name}")
                result = await importer.import_bundle_file(str(file_path))
                total_imported += result.get('total_imported', 0)
                print(f"    ✅ Imported {result.get('total_imported', 0)} resources")
            except Exception as e:
                print(f"    ❌ Failed to import {file_path.name}: {e}")
        
        print(f"✅ Import completed. Total resources imported: {total_imported}")
        return True
    
    async def generate_sample_data(self):
        """Generate additional sample data."""
        print("🎲 Generating additional sample data...")
        
        # Run additional data generation scripts
        scripts_to_run = [
            "create_sample_providers.py",
            "assign_patients_to_providers_auto.py",
            "populate_clinical_catalogs.py"
        ]
        
        for script in scripts_to_run:
            script_path = self.script_dir / script
            if script_path.exists():
                print(f"  📝 Running: {script}")
                try:
                    subprocess.run([sys.executable, str(script_path)], 
                                 cwd=self.backend_dir, check=True)
                    print(f"    ✅ {script} completed")
                except subprocess.CalledProcessError as e:
                    print(f"    ⚠️  {script} failed: {e}")
            else:
                print(f"    ⏭️  Skipping missing script: {script}")
        
        print("✅ Sample data generation completed")
    
    async def run_full_workflow(self, patient_count=5, state="Massachusetts", clear_db=False):
        """Run the complete Synthea workflow."""
        print("🚀 Starting full Synthea workflow...")
        start_time = time.time()
        
        try:
            # 1. Setup Synthea
            if not self.setup_synthea():
                return False
            
            # 2. Initialize database
            await self.init_db()
            
            # 3. Clear database if requested
            if clear_db:
                if not await self.clear_database():
                    return False
                await self.init_database_schema()
            
            # 4. Generate patients
            fhir_files = self.generate_patients(patient_count, state)
            
            # 5. Import FHIR data
            await self.import_fhir_data(fhir_files)
            
            # 6. Generate additional sample data
            await self.generate_sample_data()
            
            elapsed_time = time.time() - start_time
            print(f"🎉 Workflow completed successfully in {elapsed_time:.2f} seconds!")
            print(f"📊 Generated and imported {patient_count} patients with complete clinical data")
            
            return True
            
        except Exception as e:
            print(f"❌ Workflow failed: {e}")
            return False
        finally:
            await self.close_db()
    
    async def validate_data(self):
        """Validate imported data integrity."""
        print("🔍 Validating imported data...")
        
        async with AsyncSession(self.engine) as session:
            # Count resources by type
            resource_counts = {}
            
            tables_to_check = [
                ('patients', 'Patient'),
                ('encounters', 'Encounter'),
                ('observations', 'Observation'),
                ('conditions', 'Condition'),
                ('medications', 'Medication'),
                ('procedures', 'Procedure'),
                ('providers', 'Provider'),
                ('organizations', 'Organization')
            ]
            
            for table, resource_type in tables_to_check:
                try:
                    result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    resource_counts[resource_type] = count
                    print(f"  📋 {resource_type}: {count}")
                except Exception as e:
                    print(f"  ❌ Error counting {resource_type}: {e}")
            
            # Check for orphaned records
            print("\n🔗 Checking data integrity...")
            
            # Check patient-encounter relationships
            result = await session.execute(text("""
                SELECT COUNT(*) FROM encounters e 
                LEFT JOIN patients p ON e.patient_id = p.id 
                WHERE p.id IS NULL
            """))
            orphaned_encounters = result.scalar()
            if orphaned_encounters > 0:
                print(f"  ⚠️  Found {orphaned_encounters} encounters without patients")
            
            # Check encounter-observation relationships
            result = await session.execute(text("""
                SELECT COUNT(*) FROM observations o 
                LEFT JOIN encounters e ON o.encounter_id = e.id 
                WHERE o.encounter_id IS NOT NULL AND e.id IS NULL
            """))
            orphaned_observations = result.scalar()
            if orphaned_observations > 0:
                print(f"  ⚠️  Found {orphaned_observations} observations without encounters")
        
        print("✅ Data validation completed")
        return resource_counts


def main():
    """Main entry point for the Synthea workflow."""
    parser = argparse.ArgumentParser(description="Synthea Workflow Management")
    parser.add_argument('action', choices=[
        'setup', 'generate', 'import', 'clear', 'full', 'validate'
    ], help='Action to perform')
    parser.add_argument('--count', '-c', type=int, default=5, help='Number of patients to generate')
    parser.add_argument('--state', '-s', default='Massachusetts', help='State for patient generation')
    parser.add_argument('--city', help='City for patient generation')
    parser.add_argument('--clear-db', action='store_true', help='Clear database before import')
    parser.add_argument('--no-validate', action='store_true', help='Skip validation during import')
    parser.add_argument('--files', nargs='*', help='Specific FHIR files to import')
    
    args = parser.parse_args()
    
    workflow = SyntheaWorkflow()
    
    async def run_action():
        await workflow.init_db()
        
        try:
            if args.action == 'setup':
                workflow.setup_synthea()
            
            elif args.action == 'generate':
                if not workflow.setup_synthea():
                    return
                workflow.generate_patients(args.count, args.state, args.city)
            
            elif args.action == 'import':
                file_paths = None
                if args.files:
                    file_paths = [Path(f) for f in args.files]
                await workflow.import_fhir_data(file_paths, not args.no_validate)
            
            elif args.action == 'clear':
                await workflow.clear_database()
                await workflow.init_database_schema()
            
            elif args.action == 'full':
                await workflow.run_full_workflow(args.count, args.state, args.clear_db)
            
            elif args.action == 'validate':
                await workflow.validate_data()
        
        finally:
            await workflow.close_db()
    
    try:
        asyncio.run(run_action())
    except KeyboardInterrupt:
        print("\n⏹️  Workflow interrupted by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()