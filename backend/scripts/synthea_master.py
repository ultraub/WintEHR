#!/usr/bin/env python3
"""
Synthea Master Script - Unified Synthea Management Tool

This script provides a complete workflow for Synthea operations:
1. Setup and installation of Synthea
2. Data generation with various options
3. Database management (reset/wipe)
4. Data import with configurable validation
5. Validation and reporting
6. DICOM generation (optional)

Usage:
    python synthea_master.py setup                           # Install/setup Synthea
    python synthea_master.py generate --count 10             # Generate 10 patients
    python synthea_master.py wipe                           # Wipe database
    python synthea_master.py import --validation-mode light # Import with validation
    python synthea_master.py full --count 5                 # Complete workflow
    python synthea_master.py validate                       # Validate existing data
    python synthea_master.py dicom                          # Generate DICOM files
"""

import asyncio
import subprocess
import sys
import os
import json
import shutil
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple
import argparse
import logging
from collections import defaultdict

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
from core.fhir.storage import FHIRStorageEngine
from core.fhir.profile_transformer import ProfileAwareFHIRTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SyntheaMaster:
    """Master class for all Synthea operations."""
    
    def __init__(self):
        self.synthea_dir = Path("../synthea")
        self.output_dir = self.synthea_dir / "output" / "fhir"
        self.backup_dir = Path("data/synthea_backups")
        self.log_file = Path("logs/synthea_master.log")
        self.engine = None
        
        # Statistics tracking
        self.stats = {
            'total_files': 0,
            'total_processed': 0,
            'total_imported': 0,
            'total_failed': 0,
            'total_validation_errors': 0,
            'errors_by_type': defaultdict(int),
            'resources_by_type': defaultdict(int),
            'validation_errors_by_type': defaultdict(int)
        }
        
        # Validation errors for reporting
        self.validation_errors = []
        
        # Initialize transformer
        self.transformer = ProfileAwareFHIRTransformer()
        
        # Try to load fhir.resources for validation
        self.fhir_validation_available = False
        try:
            from fhir.resources import construct_fhir_element
            self.construct_fhir_element = construct_fhir_element
            self.fhir_validation_available = True
        except ImportError:
            logger.warning("fhir.resources not available, validation will be limited")
        
        # Ensure directories exist
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message to both console and file."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] [{level}] {message}"
        
        print(log_message)
        
        with open(self.log_file, "a") as f:
            f.write(log_message + "\n")
    
    # =================
    # SETUP OPERATIONS
    # =================
    
    def setup_synthea(self, force_reinstall: bool = False) -> bool:
        """Setup and install Synthea."""
        self.log("🔧 Setting up Synthea")
        self.log("=" * 60)
        
        # Check if Java is installed
        try:
            result = subprocess.run(["java", "-version"], capture_output=True, text=True)
            if result.returncode != 0:
                self.log("❌ Java not found. Please install Java first.", "ERROR")
                return False
        except FileNotFoundError:
            self.log("❌ Java not found. Please install Java first.", "ERROR")
            return False
        
        # Create/update Synthea directory
        if force_reinstall and self.synthea_dir.exists():
            self.log("🗑️ Removing existing Synthea installation...")
            shutil.rmtree(self.synthea_dir)
        
        if not self.synthea_dir.exists() or force_reinstall:
            self.log("📥 Cloning Synthea repository...")
            try:
                subprocess.run([
                    "git", "clone", "--depth", "1", 
                    "https://github.com/synthetichealth/synthea.git", 
                    str(self.synthea_dir)
                ], check=True)
            except subprocess.CalledProcessError as e:
                self.log(f"❌ Failed to clone Synthea: {e}", "ERROR")
                return False
        
        # Check if already built
        jar_file = self.synthea_dir / "build" / "libs" / "synthea-with-dependencies.jar"
        if not jar_file.exists():
            self.log("🔨 Building Synthea...")
            try:
                os.chdir(self.synthea_dir)
                subprocess.run(["./gradlew", "build", "-x", "test"], check=True)
                os.chdir("..")
            except subprocess.CalledProcessError as e:
                self.log(f"❌ Synthea build failed: {e}", "ERROR")
                return False
        
        # Configure Synthea for FHIR R4 output
        self.log("⚙️ Configuring Synthea for FHIR R4...")
        properties_dir = self.synthea_dir / "src" / "main" / "resources"
        properties_dir.mkdir(parents=True, exist_ok=True)
        
        properties_content = """# FHIR Configuration
exporter.fhir.export = true
exporter.fhir_stu3.export = false
exporter.fhir_dstu2.export = false
exporter.ccda.export = false
exporter.csv.export = false
exporter.text.export = false
exporter.hospital.fhir.export = false
exporter.practitioner.fhir.export = false

# Output directory
exporter.baseDirectory = ./output/

# Generate configuration
generate.log_patients.detail = simple
generate.only_alive_patients = true

# Default location
generate.demographics.default_city = Boston
generate.demographics.default_state = Massachusetts
"""
        
        with open(properties_dir / "synthea.properties", "w") as f:
            f.write(properties_content)
        
        self.log("✅ Synthea setup complete!")
        return True
    
    # =====================
    # GENERATION OPERATIONS
    # =====================
    
    def generate_synthea_data(self, count: int = 10, state: str = "Massachusetts", 
                            city: Optional[str] = None, seed: int = 0) -> bool:
        """Generate Synthea patient data."""
        self.log("🏥 Generating Synthea Data")
        self.log("=" * 60)
        
        if not self.synthea_dir.exists():
            self.log("❌ Synthea not found. Run setup first.", "ERROR")
            return False
        
        # Backup existing data
        if self.output_dir.exists():
            self.log("📁 Backing up existing data...")
            backup_name = f"synthea_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            backup_path = self.backup_dir / backup_name
            shutil.move(str(self.output_dir), str(backup_path))
            self.log(f"✅ Backed up to: {backup_path}")
        
        # Generate data
        self.log(f"🚀 Generating {count} patients...")
        
        try:
            os.chdir(self.synthea_dir)
            
            cmd = [
                "java", "-jar", "build/libs/synthea-with-dependencies.jar",
                "-p", str(count),
                "-s", str(seed),
                state
            ]
            
            if city:
                cmd.append(city)
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            os.chdir("..")
            
            if result.returncode == 0:
                self.log(f"✅ Successfully generated {count} patients")
                
                # Count generated files
                if self.output_dir.exists():
                    files = list(self.output_dir.glob("*.json"))
                    self.log(f"📄 Generated {len(files)} FHIR bundle files")
                
                return True
            else:
                self.log(f"❌ Generation failed: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error generating data: {e}", "ERROR")
            return False
    
    # =====================
    # DATABASE OPERATIONS
    # =====================
    
    async def init_db(self):
        """Initialize database connection."""
        self.engine = create_async_engine(DATABASE_URL, echo=False)
    
    async def close_db(self):
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()
    
    async def wipe_database(self) -> bool:
        """Wipe FHIR data from database."""
        self.log("🗄️ Wiping Database")
        self.log("=" * 60)
        
        try:
            async with self.engine.begin() as conn:
                # Delete search parameters first (foreign key constraint)
                await conn.execute(text("DELETE FROM fhir.search_params"))
                
                # Delete resources
                await conn.execute(text("DELETE FROM fhir.resources"))
                
                # Reset sequences
                await conn.execute(text("ALTER SEQUENCE fhir.resources_id_seq RESTART WITH 1"))
                
                self.log("✅ Database wiped successfully")
                return True
                
        except Exception as e:
            self.log(f"❌ Database wipe failed: {e}", "ERROR")
            return False
    
    async def reset_database(self) -> bool:
        """Reset and initialize the database."""
        self.log("🗄️ Resetting Database")
        self.log("=" * 60)
        
        try:
            result = subprocess.run(
                [sys.executable, "scripts/reset_and_init_database.py"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                self.log("✅ Database reset successfully")
                return True
            else:
                self.log(f"❌ Database reset failed: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error resetting database: {e}", "ERROR")
            return False
    
    # ==================
    # IMPORT OPERATIONS
    # ==================
    
    def validate_resource(self, resource_data: Dict) -> Tuple[bool, Optional[Exception]]:
        """Validate a FHIR resource if validation is available."""
        if not self.fhir_validation_available:
            return True, None
        
        try:
            resource_type = resource_data.get('resourceType')
            if not resource_type:
                raise ValueError("Missing resourceType")
            
            # Construct FHIR resource to validate
            fhir_resource = self.construct_fhir_element(resource_type, resource_data)
            return True, None
            
        except Exception as e:
            return False, e
    
    async def import_data(self, validation_mode: str = 'transform_only', 
                         batch_size: int = 50) -> bool:
        """Import Synthea data with configurable validation."""
        self.log("📥 Importing Synthea Data")
        self.log("=" * 60)
        
        if not self.output_dir.exists():
            self.log("❌ No Synthea output found. Run generate first.", "ERROR")
            return False
        
        # Find all bundle files
        files = list(self.output_dir.glob("*.json"))
        self.log(f"📄 Found {len(files)} bundle files to import")
        
        try:
            for file_path in files:
                await self._import_bundle_file(file_path, validation_mode, batch_size)
            
            self.log("✅ Data imported successfully")
            self._print_import_stats()
            return True
            
        except Exception as e:
            self.log(f"❌ Import failed: {e}", "ERROR")
            return False
    
    async def _import_bundle_file(self, file_path: Path, validation_mode: str, 
                                batch_size: int):
        """Import a single bundle file."""
        self.log(f"Processing: {file_path.name}")
        
        with open(file_path, 'r') as f:
            bundle_data = json.load(f)
        
        if bundle_data.get('resourceType') != 'Bundle':
            self.log(f"⚠️ Not a Bundle resource: {file_path.name}", "WARNING")
            return
        
        entries = bundle_data.get('entry', [])
        
        # Process in batches
        async with AsyncSession(self.engine) as session:
            for i in range(0, len(entries), batch_size):
                batch = entries[i:i + batch_size]
                await self._process_batch(session, batch, validation_mode)
            
            await session.commit()
        
        self.stats['total_files'] += 1
    
    async def _process_batch(self, session, batch: List[Dict], validation_mode: str):
        """Process a batch of resources."""
        for entry in batch:
            resource = entry.get('resource', {})
            if not resource:
                continue
            
            resource_type = resource.get('resourceType')
            resource_id = resource.get('id')
            
            if not resource_type:
                continue
            
            self.stats['total_processed'] += 1
            
            try:
                # Validate original resource if required
                if validation_mode in ['light', 'strict']:
                    is_valid, error = self.validate_resource(resource)
                    if not is_valid:
                        self.stats['total_validation_errors'] += 1
                        self.stats['validation_errors_by_type'][f"{resource_type}: {type(error).__name__}"] += 1
                        
                        if validation_mode == 'strict':
                            self.stats['total_failed'] += 1
                            continue
                
                # Transform resource
                try:
                    transformed = self.transformer.transform_resource(resource)
                except Exception as e:
                    if validation_mode == 'strict':
                        self.stats['total_failed'] += 1
                        continue
                    else:
                        transformed = resource
                
                # Validate transformed resource if required
                if validation_mode in ['transform_only', 'light', 'strict']:
                    is_valid, error = self.validate_resource(transformed)
                    if not is_valid:
                        self.stats['total_validation_errors'] += 1
                        self.stats['validation_errors_by_type'][f"{resource_type}: {type(error).__name__}"] += 1
                        
                        if validation_mode == 'strict':
                            self.stats['total_failed'] += 1
                            continue
                
                # Store resource
                await self._store_resource(session, resource_type, resource_id, transformed)
                
                self.stats['total_imported'] += 1
                self.stats['resources_by_type'][resource_type] += 1
                
            except Exception as e:
                self.stats['total_failed'] += 1
                self.stats['errors_by_type'][f"{resource_type}: {type(e).__name__}"] += 1
    
    async def _store_resource(self, session, resource_type: str, resource_id: str, 
                             resource_data: Dict):
        """Store a resource in the database."""
        # Ensure required metadata
        if 'id' not in resource_data:
            resource_data['id'] = resource_id or str(uuid.uuid4())
        
        if 'meta' not in resource_data:
            resource_data['meta'] = {}
        
        if 'versionId' not in resource_data['meta']:
            resource_data['meta']['versionId'] = '1'
        
        if 'lastUpdated' not in resource_data['meta']:
            resource_data['meta']['lastUpdated'] = datetime.now(timezone.utc).isoformat()
        
        # Insert resource
        query = text("""
            INSERT INTO fhir.resources (
                resource_type, fhir_id, version_id, last_updated, resource
            ) VALUES (
                :resource_type, :fhir_id, :version_id, :last_updated, :resource
            )
            ON CONFLICT (resource_type, fhir_id) 
            DO UPDATE SET 
                version_id = fhir.resources.version_id + 1,
                last_updated = EXCLUDED.last_updated,
                resource = EXCLUDED.resource
            RETURNING id
        """)
        
        result = await session.execute(query, {
            'resource_type': resource_type,
            'fhir_id': resource_data['id'],
            'version_id': 1,
            'last_updated': datetime.now(timezone.utc),
            'resource': json.dumps(resource_data)
        })
        
        resource_db_id = result.scalar()
        
        # Extract basic search parameters
        await self._extract_search_params(session, resource_db_id, resource_type, resource_data)
    
    async def _extract_search_params(self, session, resource_id: int, resource_type: str, 
                                   resource_data: Dict):
        """Extract and store search parameters."""
        # Always index the resource ID
        await self._add_search_param(
            session, resource_id, '_id', 'token', 
            value_string=resource_data.get('id')
        )
        
        # Extract common search parameters by resource type
        if resource_type == 'Patient':
            # Name parameters
            if 'name' in resource_data:
                for name in resource_data['name']:
                    if 'family' in name:
                        await self._add_search_param(
                            session, resource_id, 'family', 'string',
                            value_string=name['family']
                        )
                    if 'given' in name:
                        for given in name['given']:
                            await self._add_search_param(
                                session, resource_id, 'given', 'string',
                                value_string=given
                            )
            
            # Gender
            if 'gender' in resource_data:
                await self._add_search_param(
                    session, resource_id, 'gender', 'token',
                    value_string=resource_data['gender']
                )
            
            # Birthdate
            if 'birthDate' in resource_data:
                birthdate = resource_data['birthDate']
                if isinstance(birthdate, str):
                    try:
                        birthdate = datetime.fromisoformat(birthdate.replace('Z', '+00:00')).date()
                    except:
                        birthdate = datetime.strptime(birthdate, '%Y-%m-%d').date()
                
                await self._add_search_param(
                    session, resource_id, 'birthdate', 'date',
                    value_date=birthdate
                )
        
        elif resource_type in ['Encounter', 'Observation', 'Condition']:
            # Patient reference
            if 'subject' in resource_data and isinstance(resource_data['subject'], dict):
                ref = resource_data['subject'].get('reference', '')
                if ref.startswith('Patient/'):
                    patient_id = ref.split('/')[-1]
                    await self._add_search_param(
                        session, resource_id, 'patient', 'reference',
                        value_reference=patient_id
                    )
    
    async def _add_search_param(self, session, resource_id: int, param_name: str, 
                               param_type: str, **values):
        """Add a search parameter to the database."""
        query = text("""
            INSERT INTO fhir.search_params (
                resource_id, param_name, param_type,
                value_string, value_number, value_date,
                value_token_system, value_token_code, value_reference
            ) VALUES (
                :resource_id, :param_name, :param_type,
                :value_string, :value_number, :value_date,
                :value_token_system, :value_token_code, :value_reference
            )
            ON CONFLICT DO NOTHING
        """)
        
        await session.execute(query, {
            'resource_id': resource_id,
            'param_name': param_name,
            'param_type': param_type,
            'value_string': values.get('value_string'),
            'value_number': values.get('value_number'),
            'value_date': values.get('value_date'),
            'value_token_system': values.get('value_token_system'),
            'value_token_code': values.get('value_token_code'),
            'value_reference': values.get('value_reference')
        })
    
    # =====================
    # VALIDATION OPERATIONS
    # =====================
    
    async def validate_imported_data(self) -> bool:
        """Validate the imported data in the database."""
        self.log("🔍 Validating Imported Data")
        self.log("=" * 60)
        
        try:
            async with self.engine.begin() as conn:
                # Check resource counts
                result = await conn.execute(text("""
                    SELECT resource_type, COUNT(*) as count
                    FROM fhir.resources
                    WHERE NOT deleted
                    GROUP BY resource_type
                    ORDER BY count DESC
                """))
                
                resources = result.fetchall()
                
                if resources:
                    self.log("✅ Validation successful")
                    self.log("\n📊 Resource Summary:")
                    
                    total = 0
                    for resource_type, count in resources:
                        self.log(f"  {resource_type}: {count}")
                        total += count
                    
                    self.log(f"\n  Total Resources: {total}")
                    
                    # Sample patient check
                    patient_result = await conn.execute(text("""
                        SELECT COUNT(*) FROM fhir.resources 
                        WHERE resource_type = 'Patient' AND NOT deleted
                    """))
                    patient_count = patient_result.scalar()
                    
                    if patient_count > 0:
                        self.log(f"\n✅ Found {patient_count} patients")
                        
                        # Sample patient names
                        sample_result = await conn.execute(text("""
                            SELECT resource->>'id', 
                                   resource->'name'->0->>'family',
                                   resource->'name'->0->'given'->0
                            FROM fhir.resources 
                            WHERE resource_type = 'Patient' AND NOT deleted
                            LIMIT 5
                        """))
                        
                        self.log("\n👥 Sample Patients:")
                        for fhir_id, family, given in sample_result:
                            try:
                                given_str = json.loads(given) if given else "Unknown"
                            except:
                                given_str = str(given) if given else "Unknown"
                            self.log(f"  - {given_str} {family or 'Unknown'} (ID: {fhir_id})")
                    
                    return True
                else:
                    self.log("❌ No resources found in database", "ERROR")
                    return False
                    
        except Exception as e:
            self.log(f"❌ Validation failed: {e}", "ERROR")
            return False
    
    # ==================
    # DICOM OPERATIONS
    # ==================
    
    def generate_dicom_files(self) -> bool:
        """Generate DICOM files for imaging studies."""
        self.log("🏥 Generating DICOM Files")
        self.log("=" * 60)
        
        try:
            result = subprocess.run(
                [sys.executable, "scripts/generate_dicom_for_synthea.py"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                self.log("✅ DICOM files generated successfully")
                return True
            else:
                self.log(f"❌ DICOM generation failed: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error generating DICOM files: {e}", "ERROR")
            return False
    
    # ==================
    # WORKFLOW OPERATIONS
    # ==================
    
    async def full_workflow(self, count: int = 10, state: str = "Massachusetts", 
                           city: Optional[str] = None, validation_mode: str = 'transform_only',
                           include_dicom: bool = False) -> bool:
        """Run the complete Synthea workflow."""
        self.log("🚀 Starting Full Synthea Workflow")
        self.log("=" * 60)
        self.log(f"Parameters: count={count}, state={state}, city={city or 'Any'}")
        self.log(f"Validation mode: {validation_mode}")
        self.log(f"Include DICOM: {include_dicom}")
        
        # Step 1: Generate data
        if not self.generate_synthea_data(count, state, city):
            self.log("❌ Workflow failed at data generation", "ERROR")
            return False
        
        # Step 2: Reset database
        if not await self.reset_database():
            self.log("❌ Workflow failed at database reset", "ERROR")
            return False
        
        # Step 3: Import data
        if not await self.import_data(validation_mode):
            self.log("❌ Workflow failed at data import", "ERROR")
            return False
        
        # Step 4: Validate
        if not await self.validate_imported_data():
            self.log("❌ Workflow failed at validation", "ERROR")
            return False
        
        # Step 5: Generate DICOM files (optional)
        if include_dicom:
            if not self.generate_dicom_files():
                self.log("⚠️ DICOM generation failed, but continuing...", "WARNING")
        
        self.log("\n🎉 Workflow completed successfully!")
        self.log("=" * 60)
        return True
    
    # ================
    # UTILITY METHODS
    # ================
    
    def _print_import_stats(self):
        """Print import statistics."""
        self.log("\n" + "=" * 60)
        self.log("📊 Import Summary")
        self.log("=" * 60)
        self.log(f"Total Files Processed: {self.stats['total_files']}")
        self.log(f"Total Resources Processed: {self.stats['total_processed']}")
        self.log(f"Successfully Imported: {self.stats['total_imported']}")
        self.log(f"Failed: {self.stats['total_failed']}")
        self.log(f"Validation Errors: {self.stats['total_validation_errors']}")
        
        if self.stats['resources_by_type']:
            self.log("\n✅ Resources by Type:")
            for resource_type, count in sorted(self.stats['resources_by_type'].items()):
                self.log(f"  {resource_type}: {count}")
        
        if self.stats['validation_errors_by_type']:
            self.log("\n⚠️ Validation Errors by Type:")
            for error_type, count in sorted(self.stats['validation_errors_by_type'].items()):
                self.log(f"  {error_type}: {count}")
        
        if self.stats['errors_by_type']:
            self.log("\n❌ Other Errors by Type:")
            for error_type, count in sorted(self.stats['errors_by_type'].items()):
                self.log(f"  {error_type}: {count}")
        
        # Success rate
        total_attempts = self.stats['total_processed']
        if total_attempts > 0:
            success_rate = (self.stats['total_imported'] / total_attempts) * 100
            self.log(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        self.log("=" * 60)
    
    def save_report(self, filename: str = "synthea_master_report.json"):
        """Save a detailed report of the last operation."""
        report = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'stats': dict(self.stats),
            'fhir_validation_available': self.fhir_validation_available,
            'validation_errors': [
                {
                    'resource_type': error.get('resource_type'),
                    'error_type': error.get('error_type'),
                    'error_message': error.get('error_message'),
                    'timestamp': error.get('timestamp')
                }
                for error in self.validation_errors
            ]
        }
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        self.log(f"📝 Report saved to {filename}")


async def main():
    """Main entry point with comprehensive command-line interface."""
    parser = argparse.ArgumentParser(
        description='Synthea Master Script - Unified Synthea Management Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  setup                     Setup/install Synthea
  generate                  Generate patient data
  wipe                      Wipe database FHIR data
  reset                     Reset and initialize database
  import                    Import existing data
  validate                  Validate imported data
  dicom                     Generate DICOM files
  full                      Run complete workflow

Examples:
  python synthea_master.py setup --force
  python synthea_master.py generate --count 20 --state California
  python synthea_master.py import --validation-mode strict
  python synthea_master.py full --count 5 --include-dicom
        """
    )
    
    parser.add_argument(
        'command',
        choices=['setup', 'generate', 'wipe', 'reset', 'import', 'validate', 'dicom', 'full'],
        help='Command to execute'
    )
    
    # Generation options
    parser.add_argument('--count', type=int, default=10, help='Number of patients to generate')
    parser.add_argument('--state', default='Massachusetts', help='State for patient generation')
    parser.add_argument('--city', help='City for patient generation')
    parser.add_argument('--seed', type=int, default=0, help='Random seed for reproducible generation')
    
    # Import options
    parser.add_argument(
        '--validation-mode',
        choices=['none', 'transform_only', 'light', 'strict'],
        default='transform_only',
        help='Validation mode for import'
    )
    parser.add_argument('--batch-size', type=int, default=50, help='Batch size for import')
    
    # Setup options
    parser.add_argument('--force', action='store_true', help='Force reinstall/reset')
    
    # Full workflow options
    parser.add_argument('--include-dicom', action='store_true', help='Include DICOM generation in full workflow')
    
    # Reporting options
    parser.add_argument('--report-file', help='Save detailed report to file')
    
    args = parser.parse_args()
    
    # Create master instance
    master = SyntheaMaster()
    
    try:
        # Initialize database connection for operations that need it
        if args.command in ['wipe', 'reset', 'import', 'validate', 'full']:
            await master.init_db()
        
        # Execute command
        success = False
        
        if args.command == 'setup':
            success = master.setup_synthea(args.force)
        
        elif args.command == 'generate':
            success = master.generate_synthea_data(args.count, args.state, args.city, args.seed)
        
        elif args.command == 'wipe':
            success = await master.wipe_database()
        
        elif args.command == 'reset':
            success = await master.reset_database()
        
        elif args.command == 'import':
            success = await master.import_data(args.validation_mode, args.batch_size)
        
        elif args.command == 'validate':
            success = await master.validate_imported_data()
        
        elif args.command == 'dicom':
            success = master.generate_dicom_files()
        
        elif args.command == 'full':
            success = await master.full_workflow(
                args.count, args.state, args.city, args.validation_mode, args.include_dicom
            )
        
        # Save report if requested
        if args.report_file:
            master.save_report(args.report_file)
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        master.log("\n⚠️ Operation interrupted by user", "WARNING")
        sys.exit(1)
    except Exception as e:
        master.log(f"\n❌ Unexpected error: {e}", "ERROR")
        sys.exit(1)
    finally:
        # Clean up database connection
        if master.engine:
            await master.close_db()


if __name__ == "__main__":
    asyncio.run(main())