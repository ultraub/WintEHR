#!/usr/bin/env python3
"""
Synthea Master Script - Unified Synthea Data Management

This script consolidates all Synthea operations into a single, comprehensive tool:
- Setup and installation of Synthea
- Data generation with configurable options  
- Database management (wipe, reset)
- Data import with multiple validation modes
- DICOM generation for imaging workflows
- Complete end-to-end workflows

Enhanced Features (2025-01-17):
- Comprehensive search parameter extraction for all FHIR resource types
- Improved reference handling for urn:uuid and standard references
- Enhanced CodeableConcept processing with system|code format
- Support for all major FHIR R4 resource types and search parameters

Usage Examples:
    # Complete workflow (most common)
    python synthea_master.py full --count 10
    
    # Individual operations
    python synthea_master.py setup                    # Install/setup Synthea
    python synthea_master.py generate --count 20      # Generate patients
    python synthea_master.py wipe                     # Clear database
    python synthea_master.py import --validation-mode light  # Import with validation
    python synthea_master.py validate                 # Validate existing data
    python synthea_master.py dicom                    # Generate DICOM files
    
    # Advanced workflows
    python synthea_master.py full --count 50 --validation-mode strict --include-dicom
    python synthea_master.py generate --state California --city "Los Angeles"
"""

import asyncio
import subprocess
import sys
import json
import shutil
import time
from pathlib import Path
from datetime import datetime, timezone
import argparse
from typing import Optional
import logging
from collections import defaultdict
import uuid

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
from fhir.core.storage import FHIRStorageEngine
from fhir.core.converters.profile_transformer import ProfileAwareFHIRTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SyntheaMaster:
    """Unified Synthea data management tool."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        if verbose:
            logging.getLogger().setLevel(logging.DEBUG)
        
        # Paths
        self.script_dir = Path(__file__).parent
        self.backend_dir = self.script_dir.parent
        self.project_root = self.backend_dir.parent
        self.synthea_dir = self.project_root / "synthea"
        self.output_dir = self.synthea_dir / "output" / "fhir"
        self.backup_dir = self.backend_dir / "data" / "synthea_backups"
        self.log_dir = self.backend_dir / "logs"
        self.log_file = self.log_dir / "synthea_master.log"
        
        # Ensure directories exist
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Statistics
        self.stats = {
            'start_time': datetime.now(),
            'operations': [],
            'errors': [],
            'total_resources': 0,
            'import_stats': {}
        }
        
        # Database engine
        self.engine = None
        
        # Define comprehensive search parameters for ALL resource types
        self.search_param_definitions = self._define_search_parameters()
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message to console, file, and internal tracking."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] [{level}] {message}"
        
        # Console output with colors
        if level == "ERROR":
            logging.info(f"❌ {log_message}")
        elif level == "WARN":
            logging.info(f"⚠️  {log_message}")
        elif level == "SUCCESS":
            logging.info(f"✅ {log_message}")
        else:
            logging.info(f"ℹ️  {log_message}")
        # File logging
        with open(self.log_file, "a") as f:
            f.write(log_message + "\n")
        
        # Track in stats
        self.stats['operations'].append({
            'timestamp': timestamp,
            'level': level,
            'message': message
        })
    
    def _define_search_parameters(self) -> dict:
        """Define comprehensive search parameters for all FHIR resource types."""
        return {
            # Patient demographics
            'Patient': {
                'family': ('name', 'string', lambda r: [n.get('family') for n in r.get('name', []) if n.get('family')]),
                'given': ('name', 'string', lambda r: [g for n in r.get('name', []) for g in n.get('given', [])]),
                'gender': ('gender', 'token', lambda r: [r.get('gender')] if r.get('gender') else []),
                'birthdate': ('birthDate', 'date', lambda r: [r.get('birthDate')] if r.get('birthDate') else []),
                'identifier': ('identifier', 'token', lambda r: [f"{i.get('system', '')}|{i.get('value', '')}" for i in r.get('identifier', [])])
            },
            
            # Clinical resources with patient reference
            'Observation': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'date': ('effectiveDateTime', 'date', lambda r: [r.get('effectiveDateTime')] if r.get('effectiveDateTime') else []),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', []))),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'Condition': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'clinical-status': ('clinicalStatus', 'token', self._extract_codings),
                'verification-status': ('verificationStatus', 'token', self._extract_codings),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', []))),
                'onset-date': ('onsetDateTime', 'date', lambda r: [r.get('onsetDateTime')] if r.get('onsetDateTime') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'MedicationRequest': {
                'patient': ('subject', 'reference', self._extract_reference),
                'medication': ('medicationCodeableConcept', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'intent': ('intent', 'token', lambda r: [r.get('intent')] if r.get('intent') else []),
                'authoredon': ('authoredOn', 'date', lambda r: [r.get('authoredOn')] if r.get('authoredOn') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'ServiceRequest': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'intent': ('intent', 'token', lambda r: [r.get('intent')] if r.get('intent') else []),
                'authored': ('authoredOn', 'date', lambda r: [r.get('authoredOn')] if r.get('authoredOn') else []),
                'encounter': ('encounter', 'reference', self._extract_reference),
                'based-on': ('basedOn', 'reference', lambda r: [self._extract_reference(ref) for ref in r.get('basedOn', [])])
            },
            
            'DiagnosticReport': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'date': ('effectiveDateTime', 'date', lambda r: [r.get('effectiveDateTime')] if r.get('effectiveDateTime') else []),
                'encounter': ('encounter', 'reference', self._extract_reference),
                'based-on': ('basedOn', 'reference', lambda r: [self._extract_reference(ref) for ref in r.get('basedOn', [])])
            },
            
            'Coverage': {
                'patient': ('beneficiary', 'reference', self._extract_reference),
                'subscriber': ('subscriber', 'reference', self._extract_reference),
                'identifier': ('identifier', 'token', lambda r: [f"{i.get('system', '')}|{i.get('value', '')}" for i in r.get('identifier', [])]),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'type': ('type', 'token', self._extract_codings),
                'payor': ('payor', 'reference', lambda r: [self._extract_reference(ref) for ref in r.get('payor', [])])
            },
            
            'Encounter': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'class': ('class', 'token', self._extract_codings),
                'type': ('type', 'token', lambda r: self._extract_codings_from_list(r.get('type', []))),
                'date': ('period', 'date', lambda r: [r.get('period', {}).get('start')] if r.get('period', {}).get('start') else [])
            },
            
            'Procedure': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'date': ('performedDateTime', 'date', lambda r: [r.get('performedDateTime')] if r.get('performedDateTime') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'Immunization': {
                'patient': ('patient', 'reference', self._extract_reference),
                'vaccine-code': ('vaccineCode', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'date': ('occurrenceDateTime', 'date', lambda r: [r.get('occurrenceDateTime')] if r.get('occurrenceDateTime') else [])
            },
            
            'AllergyIntolerance': {
                'patient': ('patient', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'clinical-status': ('clinicalStatus', 'token', self._extract_codings),
                'verification-status': ('verificationStatus', 'token', self._extract_codings),
                'type': ('type', 'token', lambda r: [r.get('type')] if r.get('type') else []),
                'category': ('category', 'token', lambda r: r.get('category', []))
            },
            
            'CarePlan': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', []))),
                'date': ('period', 'date', lambda r: [r.get('period', {}).get('start')] if r.get('period', {}).get('start') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'CareTeam': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', [])))
            },
            
            'Goal': {
                'patient': ('subject', 'reference', self._extract_reference),
                'lifecycle-status': ('lifecycleStatus', 'token', lambda r: [r.get('lifecycleStatus')] if r.get('lifecycleStatus') else []),
                'target-date': ('target', 'date', lambda r: [t.get('dueDate') for t in r.get('target', []) if t.get('dueDate')])
            },
            
            'DocumentReference': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'type': ('type', 'token', self._extract_codings),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', []))),
                'date': ('date', 'date', lambda r: [r.get('date')] if r.get('date') else []),
                'encounter': ('context.encounter', 'reference', lambda r: self._extract_reference(r.get('context', {}).get('encounter')))
            },
            
            'ImagingStudy': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'started': ('started', 'date', lambda r: [r.get('started')] if r.get('started') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            # Organization and Practitioner
            'Organization': {
                'name': ('name', 'string', lambda r: [r.get('name')] if r.get('name') else []),
                'identifier': ('identifier', 'token', lambda r: [f"{i.get('system', '')}|{i.get('value', '')}" for i in r.get('identifier', [])])
            },
            
            'Practitioner': {
                'name': ('name', 'string', lambda r: [n.get('family') for n in r.get('name', []) if n.get('family')]),
                'identifier': ('identifier', 'token', lambda r: [f"{i.get('system', '')}|{i.get('value', '')}" for i in r.get('identifier', [])])
            },
            
            'Location': {
                'name': ('name', 'string', lambda r: [r.get('name')] if r.get('name') else []),
                'address': ('address', 'string', lambda r: [r.get('address', {}).get('city')] if r.get('address', {}).get('city') else [])
            },
            
            # Financial resources
            'Claim': {
                'patient': ('patient', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'use': ('use', 'token', lambda r: [r.get('use')] if r.get('use') else [])
            },
            
            'ExplanationOfBenefit': {
                'patient': ('patient', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else [])
            }
        }
    
    def _extract_reference(self, ref_obj) -> str:
        """Extract reference ID from various reference formats."""
        if not ref_obj:
            return None
            
        if isinstance(ref_obj, dict):
            ref = ref_obj.get('reference', '')
        else:
            ref = str(ref_obj)
            
        if ref.startswith('urn:uuid:'):
            return ref.replace('urn:uuid:', '')
        elif '/' in ref:
            return ref.split('/')[-1]
        return ref
    
    def _extract_codings(self, element) -> list:
        """Extract coding values from CodeableConcept."""
        if not element:
            return []
            
        if isinstance(element, dict):
            codings = element.get('coding', [])
            values = []
            for coding in codings:
                system = coding.get('system', '')
                code = coding.get('code', '')
                if code:
                    values.append(f"{system}|{code}")
            return values
        return []
    
    def _extract_codings_from_list(self, elements: list) -> list:
        """Extract codings from a list of CodeableConcepts."""
        values = []
        for element in elements:
            values.extend(self._extract_codings(element))
        return values
    
    async def setup_synthea(self) -> bool:
        """Setup and install Synthea if not already present."""
        self.log("🔧 Setting up Synthea")
        self.log("=" * 60)
        
        try:
            # Check Java
            result = subprocess.run(
                ["java", "-version"], 
                capture_output=True, text=True, 
                timeout=10
            )
            if result.returncode != 0:
                self.log("Java not found. Please install Java 11+ first.", "ERROR")
                return False
            self.log("✅ Java found")
            
            # Check if Synthea exists
            if self.synthea_dir.exists() and (self.synthea_dir / ".git").exists():
                self.log("📁 Synthea directory found, updating...")
                try:
                    result = subprocess.run(
                        ["git", "pull"],
                        cwd=self.synthea_dir,
                        capture_output=True, text=True,
                        timeout=60
                    )
                    if result.returncode == 0:
                        self.log("✅ Synthea updated")
                    else:
                        self.log("Could not update, using existing version", "WARN")
                except subprocess.TimeoutExpired:
                    self.log("Git update timed out, using existing version", "WARN")
            else:
                self.log("📥 Cloning Synthea repository...")
                if self.synthea_dir.exists():
                    shutil.rmtree(self.synthea_dir)
                
                result = subprocess.run([
                    "git", "clone", "--depth", "1",
                    "https://github.com/synthetichealth/synthea.git",
                    str(self.synthea_dir)
                ], capture_output=True, text=True, timeout=300)
                
                if result.returncode != 0:
                    self.log(f"Failed to clone Synthea: {result.stderr}", "ERROR")
                    return False
                self.log("✅ Synthea cloned")
            
            # Check if built
            jar_file = self.synthea_dir / "build" / "libs" / "synthea-with-dependencies.jar"
            if not jar_file.exists():
                self.log("🔨 Building Synthea...")
                result = subprocess.run(
                    ["./gradlew", "build", "-x", "test"],
                    cwd=self.synthea_dir,
                    capture_output=True, text=True,
                    timeout=600
                )
                
                if result.returncode != 0:
                    self.log(f"Failed to build Synthea: {result.stderr}", "ERROR")
                    return False
                self.log("✅ Synthea built successfully")
            else:
                self.log("✅ Synthea already built")
            
            # Configure Synthea
            self._configure_synthea()
            
            self.log("🎉 Synthea setup complete!", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"Setup failed: {e}", "ERROR")
            return False
    
    def _configure_synthea(self):
        """Configure Synthea for optimal FHIR R4 output."""
        config_dir = self.synthea_dir / "src" / "main" / "resources"
        config_dir.mkdir(parents=True, exist_ok=True)
        
        config_content = """# FHIR Configuration
exporter.fhir.export = true
exporter.fhir_stu3.export = false
exporter.fhir_dstu2.export = false
exporter.ccda.export = false
exporter.csv.export = false
exporter.text.export = false
exporter.hospital.fhir.export = true
exporter.practitioner.fhir.export = true

# Output directory
exporter.baseDirectory = ./output/

# Generate comprehensive patient data
generate.log_patients.detail = simple
generate.only_alive_patients = false
generate.years_of_history = 10

# Demographics
generate.demographics.default_city = Boston
generate.demographics.default_state = Massachusetts
"""
        
        config_file = config_dir / "synthea.properties"
        config_file.write_text(config_content)
        self.log("✅ Synthea configured for FHIR R4 output")
    
    async def generate_data(self, count: int = 10, state: str = "Massachusetts", 
                          city: Optional[str] = None, seed: int = 0) -> bool:
        """Generate Synthea patient data."""
        self.log(f"🧬 Generating {count} Synthea patients")
        self.log("=" * 60)
        
        if not (self.synthea_dir / "build" / "libs" / "synthea-with-dependencies.jar").exists():
            self.log("Synthea not properly set up. Running setup first...", "WARN")
            if not await self.setup_synthea():
                return False
        
        try:
            # Backup existing data
            if self.output_dir.exists() and any(self.output_dir.glob("*.json")):
                self.log("📁 Backing up existing data...")
                backup_name = f"synthea_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                backup_path = self.backup_dir / backup_name
                shutil.copytree(self.output_dir, backup_path)
                self.log(f"✅ Backed up to: {backup_path}")
            
            # Clear output directory
            if self.output_dir.exists():
                shutil.rmtree(self.output_dir)
            self.output_dir.mkdir(parents=True, exist_ok=True)
            
            # Build command
            cmd = [
                "java", "-jar", "build/libs/synthea-with-dependencies.jar",
                "-p", str(count),
                "-s", str(seed),
                "--exporter.years_of_history", "10",
                "--exporter.fhir.export", "true",
                "--exporter.baseDirectory", "./output",
                state
            ]
            
            if city:
                cmd.append(city)
            
            # Run generation
            self.log(f"🚀 Running: {' '.join(cmd)}")
            start_time = time.time()
            
            result = subprocess.run(
                cmd,
                cwd=self.synthea_dir,
                capture_output=True,
                text=True,
                timeout=1800  # 30 minutes max
            )
            
            duration = time.time() - start_time
            
            if result.returncode != 0:
                self.log(f"Generation failed: {result.stderr}", "ERROR")
                return False
            
            # Verify output
            files = list(self.output_dir.glob("*.json"))
            if not files:
                self.log("No FHIR files generated!", "ERROR")
                return False
            
            self.log(f"✅ Generated {len(files)} FHIR files in {duration:.1f}s", "SUCCESS")
            self.log(f"📁 Output directory: {self.output_dir}")
            
            # Quick stats
            total_size = sum(f.stat().st_size for f in files)
            self.log(f"📊 Total size: {total_size / 1024 / 1024:.1f} MB")
            
            return True
            
        except subprocess.TimeoutExpired:
            self.log("Generation timed out (30 minutes)", "ERROR")
            return False
        except Exception as e:
            self.log(f"Generation failed: {e}", "ERROR")
            return False
    
    async def wipe_database(self) -> bool:
        """Wipe all FHIR data from the database (preserving schema)."""
        self.log("🗑️  Wiping FHIR database data (preserving schema)")
        self.log("=" * 60)
        
        try:
            if not self.engine:
                self.engine = create_async_engine(DATABASE_URL, echo=False)
            
            async with AsyncSession(self.engine) as session:
                # Check if proper schema exists
                schema_check = await session.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'fhir' 
                        AND table_name = 'resource_history'
                    )
                """))
                has_proper_schema = schema_check.scalar()
                
                if not has_proper_schema:
                    self.log("❌ Proper FHIR schema not found. Please run init_database_definitive.py first", "ERROR")
                    return False
                
                # Clear data only, preserve schema structure
                await session.execute(text("TRUNCATE fhir.references CASCADE"))
                await session.execute(text("TRUNCATE fhir.resource_history CASCADE"))
                await session.execute(text("TRUNCATE fhir.search_params CASCADE"))
                await session.execute(text("TRUNCATE fhir.resources CASCADE"))
                
                await session.commit()
            
            self.log("✅ Database data cleared (schema preserved)", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"Database wipe failed: {e}", "ERROR")
            return False
    
    async def import_data(self, validation_mode: str = "transform_only", 
                        batch_size: int = 50) -> bool:
        """Import FHIR data with configurable validation."""
        self.log(f"📥 Importing FHIR data (validation: {validation_mode})")
        self.log("=" * 60)
        
        if not self.output_dir.exists():
            self.log("No Synthea output found. Run generate first.", "ERROR")
            return False
        
        files = list(self.output_dir.glob("*.json"))
        if not files:
            self.log("No FHIR files to import.", "ERROR")
            return False
        
        try:
            if not self.engine:
                self.engine = create_async_engine(DATABASE_URL, echo=False)
            
            transformer = ProfileAwareFHIRTransformer()
            stats = {
                'files_processed': 0,
                'resources_processed': 0,
                'resources_imported': 0,
                'resources_failed': 0,
                'errors_by_type': defaultdict(int),
                'resources_by_type': defaultdict(int)
            }
            
            self.log(f"📄 Found {len(files)} files to import")
            
            for file_path in files:
                self.log(f"Processing: {file_path.name}")
                
                try:
                    with open(file_path, 'r') as f:
                        bundle_data = json.load(f)
                    
                    if bundle_data.get('resourceType') != 'Bundle':
                        self.log(f"Skipping non-bundle: {file_path.name}", "WARN")
                        continue
                    
                    entries = bundle_data.get('entry', [])
                    stats['files_processed'] += 1
                    
                    # Process in batches
                    async with AsyncSession(self.engine) as session:
                        storage = FHIRStorageEngine(session)
                        
                        for i in range(0, len(entries), batch_size):
                            batch = entries[i:i + batch_size]
                            await self._process_batch(
                                session, storage, transformer, batch, 
                                validation_mode, stats
                            )
                        
                        await session.commit()
                    
                except Exception as e:
                    self.log(f"Failed to process {file_path.name}: {e}", "ERROR")
                    stats['errors_by_type'][f"file_error"] += 1
            
            # Report results
            self.log("📊 Import Summary:", "SUCCESS")
            self.log(f"  Files processed: {stats['files_processed']}")
            self.log(f"  Resources processed: {stats['resources_processed']}")
            self.log(f"  Successfully imported: {stats['resources_imported']}")
            self.log(f"  Failed: {stats['resources_failed']}")
            
            if stats['resources_by_type']:
                self.log("  By resource type:")
                for resource_type, count in sorted(stats['resources_by_type'].items()):
                    self.log(f"    {resource_type}: {count}")
            
            self.stats['import_stats'] = stats
            self.stats['total_resources'] = stats['resources_imported']
            
            # Remind about database initialization
            if stats['resources_imported'] > 0:
                self.log("\n⚠️  IMPORTANT: Run database initialization to fix references and search parameters:", "WARN")
                self.log("  docker exec emr-backend python scripts/init_database.py", "INFO")
                self.log("  or: cd backend && python scripts/init_database.py", "INFO")
            
            return stats['resources_imported'] > 0
            
        except Exception as e:
            self.log(f"Import failed: {e}", "ERROR")
            return False
    
    async def _process_batch(self, session, _, transformer, batch, 
                           validation_mode, stats):
        """Process a batch of resources with specified validation."""
        for entry in batch:
            resource = entry.get('resource', {})
            if not resource:
                continue
            
            resource_type = resource.get('resourceType')
            resource_id = resource.get('id')
            
            if not resource_type:
                continue
            
            stats['resources_processed'] += 1
            
            try:
                # Transform the resource
                transformed = transformer.transform_resource(resource)
                
                # Validation based on mode
                if validation_mode == "strict":
                    # Full FHIR validation (can be slow)
                    from fhir.resources import construct_fhir_element
                    construct_fhir_element(resource_type, transformed)
                elif validation_mode == "light":
                    # Basic structure validation
                    if not transformed.get('resourceType') or not transformed.get('id'):
                        raise ValueError("Missing required fields")
                # transform_only and none modes skip validation
                
                # Store the resource
                await self._store_resource(
                    session, resource_type, resource_id, transformed
                )
                
                stats['resources_imported'] += 1
                stats['resources_by_type'][resource_type] += 1
                
                if stats['resources_imported'] % 100 == 0:
                    self.log(f"Progress: {stats['resources_imported']} resources imported")
                
            except Exception as e:
                stats['resources_failed'] += 1
                error_key = f"{resource_type}: {type(e).__name__}"
                stats['errors_by_type'][error_key] += 1
                # Always log the first few errors for debugging
                if stats['resources_failed'] <= 5 or self.verbose:
                    self.log(f"Failed to import {resource_type}/{resource_id}: {e}")
                    import traceback
                    traceback.print_exc()
    
    async def _store_resource(self, session, resource_type, resource_id, resource_data):
        """Store a resource in the database."""
        # Ensure resource has required metadata
        if 'id' not in resource_data:
            resource_data['id'] = resource_id or str(uuid.uuid4())
        
        if 'meta' not in resource_data:
            resource_data['meta'] = {}
        
        if 'versionId' not in resource_data['meta']:
            resource_data['meta']['versionId'] = '1'
        
        if 'lastUpdated' not in resource_data['meta']:
            resource_data['meta']['lastUpdated'] = datetime.now(timezone.utc).isoformat()
        
        # Insert into FHIR storage
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
    
    async def _extract_search_params(self, session, resource_id, resource_type, resource_data):
        """Extract and store comprehensive search parameters for all resource types."""
        # Always index the resource ID
        await self._add_search_param(
            session, resource_id, resource_type, '_id', 'token', 
            value_string=resource_data.get('id')
        )
        
        # Get search parameter definitions for this resource type
        param_defs = self.search_param_definitions.get(resource_type, {})
        
        for param_name, (field_path, param_type, extractor) in param_defs.items():
            try:
                # Extract values using the defined extractor function
                values = extractor(resource_data)
                
                # Store each extracted value
                for value in values:
                    if value is not None:
                        if param_type == 'string':
                            await self._add_search_param(
                                session, resource_id, resource_type, param_name, param_type,
                                value_string=str(value)
                            )
                        elif param_type == 'token':
                            # Handle system|code format
                            if '|' in str(value):
                                system, code = str(value).split('|', 1)
                                await self._add_search_param(
                                    session, resource_id, resource_type, param_name, param_type,
                                    value_token_system=system, value_token_code=code
                                )
                            else:
                                await self._add_search_param(
                                    session, resource_id, resource_type, param_name, param_type,
                                    value_string=str(value)
                                )
                        elif param_type == 'reference':
                            await self._add_search_param(
                                session, resource_id, resource_type, param_name, param_type,
                                value_reference=str(value)
                            )
                        elif param_type == 'date':
                            # Convert to datetime if needed
                            if isinstance(value, str):
                                try:
                                    # Parse ISO date/datetime
                                    if 'T' in value:
                                        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                                    else:
                                        dt = datetime.strptime(value, '%Y-%m-%d')
                                    await self._add_search_param(
                                        session, resource_id, resource_type, param_name, param_type,
                                        value_date=dt
                                    )
                                except:
                                    pass
                            
            except Exception as e:
                if self.verbose:
                    self.log(f"Error extracting {param_name} for {resource_type}: {e}", "WARN")
    
    # Note: All individual parameter extraction methods have been consolidated 
    # into the comprehensive search_param_definitions and unified extraction logic above
    
    async def _add_search_param(self, session, resource_id, resource_type, param_name, param_type, **values):
        """Add a search parameter to the database."""
        query = text("""
            INSERT INTO fhir.search_params (
                resource_id, resource_type, param_name, param_type,
                value_string, value_number, value_date,
                value_token_system, value_token_code, value_reference
            ) VALUES (
                :resource_id, :resource_type, :param_name, :param_type,
                :value_string, :value_number, :value_date,
                :value_token_system, :value_token_code, :value_reference
            )
            ON CONFLICT DO NOTHING
        """)
        
        await session.execute(query, {
            'resource_id': resource_id,
            'resource_type': resource_type,
            'param_name': param_name,
            'param_type': param_type,
            'value_string': values.get('value_string'),
            'value_number': values.get('value_number'),
            'value_date': values.get('value_date'),
            'value_token_system': values.get('value_token_system'),
            'value_token_code': values.get('value_token_code'),
            'value_reference': values.get('value_reference')
        })
    
    async def validate_data(self) -> bool:
        """Validate imported FHIR data."""
        self.log("🔍 Validating imported data")
        self.log("=" * 60)
        
        try:
            if not self.engine:
                self.engine = create_async_engine(DATABASE_URL, echo=False)
            
            async with AsyncSession(self.engine) as session:
                # Count resources by type
                result = await session.execute(text("""
                    SELECT resource_type, COUNT(*) as count
                    FROM fhir.resources
                    GROUP BY resource_type
                    ORDER BY count DESC
                """))
                
                resources = result.fetchall()
                
                if not resources:
                    self.log("No resources found in database", "ERROR")
                    return False
                
                total = sum(row[1] for row in resources)
                self.log(f"✅ Found {total} resources across {len(resources)} types:")
                
                for resource_type, count in resources:
                    self.log(f"  {resource_type}: {count}")
                
                # Check for common issues
                issues = []
                
                # Check for patients without names
                result = await session.execute(text("""
                    SELECT COUNT(*) FROM fhir.resources 
                    WHERE resource_type = 'Patient' 
                    AND (resource->'name' IS NULL OR jsonb_array_length(resource->'name') = 0)
                """))
                unnamed_patients = result.scalar()
                if unnamed_patients > 0:
                    issues.append(f"{unnamed_patients} patients without names")
                
                # Check for broken references
                result = await session.execute(text("""
                    SELECT COUNT(*) FROM fhir.search_params 
                    WHERE param_type = 'reference' 
                    AND value_reference NOT IN (
                        SELECT fhir_id FROM fhir.resources
                    )
                """))
                broken_refs = result.scalar()
                if broken_refs > 0:
                    issues.append(f"{broken_refs} broken references")
                
                if issues:
                    self.log("⚠️  Issues found:", "WARN")
                    for issue in issues:
                        self.log(f"  - {issue}", "WARN")
                else:
                    self.log("✅ No issues found", "SUCCESS")
                
                return True
                
        except Exception as e:
            self.log(f"Validation failed: {e}", "ERROR")
            return False
    
    async def generate_dicom(self) -> bool:
        """Generate DICOM files for imaging studies."""
        self.log("🖼️  Generating DICOM files")
        self.log("=" * 60)
        
        dicom_script = self.script_dir / "generate_dicom_for_synthea.py"
        if not dicom_script.exists():
            self.log("DICOM generation script not found", "ERROR")
            return False
        
        try:
            result = subprocess.run([
                sys.executable, str(dicom_script)
            ], capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                self.log(f"DICOM generation failed: {result.stderr}", "ERROR")
                return False
            
            self.log("✅ DICOM files generated", "SUCCESS")
            return True
            
        except subprocess.TimeoutExpired:
            self.log("DICOM generation timed out", "ERROR")
            return False
        except Exception as e:
            self.log(f"DICOM generation failed: {e}", "ERROR")
            return False
    
    async def clean_names(self) -> bool:
        """Clean numeric suffixes from patient and provider names."""
        self.log("🏷️  Cleaning patient and provider names...")
        
        try:
            # Run the cleaning script
            result = subprocess.run(
                [sys.executable, str(self.script_dir / "clean_fhir_names.py")],
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode != 0:
                self.log(f"Name cleaning failed: {result.stderr}", "ERROR")
                return False
            
            # Parse output for statistics
            output_lines = result.stdout.strip().split('\n')
            for line in output_lines:
                if "Patients updated:" in line:
                    patients_updated = line.split(':')[1].strip()
                    self.log(f"✓ Updated {patients_updated} patient names")
                elif "Practitioners updated:" in line:
                    practitioners_updated = line.split(':')[1].strip()
                    self.log(f"✓ Updated {practitioners_updated} practitioner names")
            
            return True
            
        except Exception as e:
            self.log(f"Name cleaning failed: {e}", "ERROR")
            return False
    
    async def enhance_lab_results(self) -> bool:
        """Enhance lab results with reference ranges and interpretations."""
        self.log("🧪 Enhancing lab results with reference ranges...")
        
        try:
            # Run the lab enhancement script
            result = subprocess.run(
                [sys.executable, str(self.script_dir / "enhance_lab_results.py")],
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode != 0:
                self.log(f"Lab enhancement failed: {result.stderr}", "ERROR")
                return False
            
            # Parse output for statistics
            output_lines = result.stdout.strip().split('\n')
            for line in output_lines:
                if "Observations updated:" in line:
                    obs_updated = line.split(':')[1].strip()
                    self.log(f"✓ Enhanced {obs_updated} lab observations")
                elif "Already had reference range:" in line:
                    already_had = line.split(':')[1].strip()
                    self.log(f"ℹ️  {already_had} observations already had reference ranges")
            
            return True
            
        except Exception as e:
            self.log(f"Lab enhancement failed: {e}", "ERROR")
            return False
    
    async def full_workflow(self, count: int = 10, validation_mode: str = "transform_only",
                          include_dicom: bool = False, clean_names: bool = False,
                          state: str = "Massachusetts", city: Optional[str] = None) -> bool:
        """Run the complete Synthea workflow."""
        self.log("🚀 Starting full Synthea workflow")
        self.log("=" * 80)
        
        workflow_start = time.time()
        success = True
        
        # Step 1: Setup
        if not await self.setup_synthea():
            return False
        
        # Step 2: Generate data
        if not await self.generate_data(count, state, city):
            return False
        
        # Step 3: Wipe database
        if not await self.wipe_database():
            return False
        
        # Step 4: Import data
        if not await self.import_data(validation_mode):
            return False
        
        # Step 5: Validate
        if not await self.validate_data():
            success = False  # Continue anyway
        
        # Step 6: Enhance lab results
        if not await self.enhance_lab_results():
            success = False  # Continue anyway
        
        # Step 7: DICOM (optional)
        if include_dicom:
            if not await self.generate_dicom():
                success = False  # Continue anyway
        
        # Step 8: Clean names (optional but recommended)
        if clean_names:
            if not await self.clean_names():
                success = False  # Continue anyway
        
        workflow_duration = time.time() - workflow_start
        
        # Final summary
        self.log("=" * 80)
        if success:
            self.log("🎉 Full workflow completed successfully!", "SUCCESS")
        else:
            self.log("⚠️  Workflow completed with some issues", "WARN")
        
        self.log(f"⏱️  Total time: {workflow_duration:.1f} seconds")
        self.log(f"📊 Resources imported: {self.stats.get('total_resources', 0)}")
        
        return success
    
    async def cleanup(self):
        """Cleanup resources."""
        if self.engine:
            await self.engine.dispose()
    
    def print_stats(self):
        """Print final statistics."""
        duration = datetime.now() - self.stats['start_time']
        
        logging.info("\n" + "=" * 60)
        logging.info("📊 Synthea Master - Final Statistics")
        logging.info("=" * 60)
        logging.info(f"Total Duration: {duration}")
        logging.info(f"Operations: {len(self.stats['operations'])}")
        logging.error(f"Errors: {len(self.stats['errors'])}")
        logging.info(f"Resources Imported: {self.stats['total_resources']}")
        if self.stats['import_stats']:
            logging.info("\nImport Details:")
            for key, value in self.stats['import_stats'].items():
                if isinstance(value, dict):
                    logging.info(f"  {key}:")
                    for k, v in value.items():
                        logging.info(f"    {k}: {v}")
                else:
                    logging.info(f"  {key}: {value}")
        logging.info("=" * 60)
async def main():
    """Main entry point with comprehensive CLI."""
    parser = argparse.ArgumentParser(
        description="Synthea Master - Unified Synthea Data Management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s full --count 10                          # Complete workflow
  %(prog)s setup                                    # Setup Synthea
  %(prog)s generate --count 20 --state California   # Generate data
  %(prog)s wipe                                     # Clear database
  %(prog)s import --validation-mode light           # Import with validation
  %(prog)s validate                                 # Validate data
  %(prog)s dicom                                    # Generate DICOM
        """
    )
    
    parser.add_argument(
        "command",
        choices=["full", "setup", "generate", "wipe", "import", "validate", "dicom"],
        help="Operation to perform"
    )
    
    # Generation options
    parser.add_argument(
        "--count", type=int, default=10,
        help="Number of patients to generate (default: 10)"
    )
    parser.add_argument(
        "--state", default="Massachusetts",
        help="State for patient generation (default: Massachusetts)"
    )
    parser.add_argument(
        "--city",
        help="City for patient generation (optional)"
    )
    parser.add_argument(
        "--seed", type=int, default=0,
        help="Random seed for generation (default: 0)"
    )
    
    # Import options
    parser.add_argument(
        "--validation-mode",
        choices=["none", "transform_only", "light", "strict"],
        default="transform_only",
        help="Validation level for import (default: transform_only)"
    )
    parser.add_argument(
        "--batch-size", type=int, default=50,
        help="Batch size for import (default: 50)"
    )
    
    # Workflow options
    parser.add_argument(
        "--include-dicom", action="store_true",
        help="Include DICOM generation in full workflow"
    )
    parser.add_argument(
        "--clean-names", action="store_true",
        help="Remove numeric suffixes from patient and provider names after import"
    )
    
    # General options
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    # Create master instance
    master = SyntheaMaster(verbose=args.verbose)
    
    try:
        success = False
        
        if args.command == "setup":
            success = await master.setup_synthea()
        
        elif args.command == "generate":
            success = await master.generate_data(
                count=args.count,
                state=args.state,
                city=args.city,
                seed=args.seed
            )
        
        elif args.command == "wipe":
            success = await master.wipe_database()
        
        elif args.command == "import":
            success = await master.import_data(
                validation_mode=args.validation_mode,
                batch_size=args.batch_size
            )
        
        elif args.command == "validate":
            success = await master.validate_data()
        
        elif args.command == "dicom":
            success = await master.generate_dicom()
        
        elif args.command == "full":
            success = await master.full_workflow(
                count=args.count,
                validation_mode=args.validation_mode,
                include_dicom=args.include_dicom,
                clean_names=args.clean_names,
                state=args.state,
                city=args.city
            )
        
        # Print final stats
        if args.verbose:
            master.print_stats()
        
        # Exit with appropriate code
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        master.log("Operation cancelled by user", "WARN")
        sys.exit(1)
    except Exception as e:
        master.log(f"Unexpected error: {e}", "ERROR")
        sys.exit(1)
    finally:
        await master.cleanup()


if __name__ == "__main__":
    asyncio.run(main())