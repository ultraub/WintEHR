#!/usr/bin/env python3
"""
Consolidated Clinical Catalog Setup Script for WintEHR

This script consolidates all clinical catalog population functionality:
- populate_clinical_catalogs.py (static catalog data)
- populate_from_extracted_catalogs.py (dynamic FHIR extraction)

Enhanced Features (2025-01-17):
- Unified catalog management for all clinical data types
- Dynamic extraction from existing FHIR resources
- Static fallback data for essential catalogs
- Production-ready database integration
- Comprehensive validation and error handling
- Progress tracking and status reporting

Usage:
    python consolidated_catalog_setup.py --all
    python consolidated_catalog_setup.py --extract-from-fhir
    python consolidated_catalog_setup.py --populate-static
    python consolidated_catalog_setup.py --status
    python consolidated_catalog_setup.py --validate
"""

import asyncio
import asyncpg
import json
import argparse
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/app/logs/catalog_setup.log')
    ]
)
logger = logging.getLogger(__name__)


class ConsolidatedCatalogSetup:
    """Consolidated clinical catalog setup functionality."""
    
    def __init__(self, args=None):
        self.args = args or argparse.Namespace()
        self.conn = None
        
        # Static catalog data for fallback
        self.static_medications = [
            {
                "generic_name": "Lisinopril",
                "brand_name": "Prinivil",
                "strength": "10mg",
                "dosage_form": "tablet",
                "drug_class": "ACE Inhibitor",
                "therapeutic_category": "Cardiovascular",
                "route": "oral",
                "frequency_options": ["once daily", "twice daily"],
                "standard_doses": ["5mg", "10mg", "20mg", "40mg"],
                "rxnorm_code": "314076",
                "is_formulary": True
            },
            {
                "generic_name": "Metformin",
                "brand_name": "Glucophage",
                "strength": "500mg",
                "dosage_form": "tablet",
                "drug_class": "Biguanide",
                "therapeutic_category": "Endocrine",
                "route": "oral",
                "frequency_options": ["once daily", "twice daily", "three times daily"],
                "standard_doses": ["500mg", "850mg", "1000mg"],
                "rxnorm_code": "6809",
                "is_formulary": True
            },
            {
                "generic_name": "Amoxicillin",
                "brand_name": "Amoxil",
                "strength": "500mg",
                "dosage_form": "capsule",
                "drug_class": "Penicillin",
                "therapeutic_category": "Infectious Disease",
                "route": "oral",
                "frequency_options": ["twice daily", "three times daily"],
                "standard_doses": ["250mg", "500mg", "875mg"],
                "rxnorm_code": "723",
                "is_formulary": True
            },
            {
                "generic_name": "Atorvastatin",
                "brand_name": "Lipitor",
                "strength": "20mg",
                "dosage_form": "tablet",
                "drug_class": "HMG-CoA Reductase Inhibitor",
                "therapeutic_category": "Cardiovascular",
                "route": "oral",
                "frequency_options": ["once daily"],
                "standard_doses": ["10mg", "20mg", "40mg", "80mg"],
                "rxnorm_code": "83367",
                "is_formulary": True
            },
            {
                "generic_name": "Omeprazole",
                "brand_name": "Prilosec",
                "strength": "20mg",
                "dosage_form": "capsule",
                "drug_class": "Proton Pump Inhibitor",
                "therapeutic_category": "Gastrointestinal",
                "route": "oral",
                "frequency_options": ["once daily", "twice daily"],
                "standard_doses": ["20mg", "40mg"],
                "rxnorm_code": "7646",
                "is_formulary": True
            }
        ]
        
        self.static_lab_tests = [
            {
                "name": "Complete Blood Count",
                "code": "58410-2",
                "system": "http://loinc.org",
                "category": "Hematology",
                "specimen_type": "Blood",
                "turnaround_time": "2 hours",
                "normal_range": "Various",
                "units": "Various",
                "is_stat_available": True
            },
            {
                "name": "Basic Metabolic Panel",
                "code": "80048",
                "system": "http://www.ama-assn.org/go/cpt",
                "category": "Chemistry",
                "specimen_type": "Blood",
                "turnaround_time": "1 hour",
                "normal_range": "Various",
                "units": "Various",
                "is_stat_available": True
            },
            {
                "name": "Lipid Panel",
                "code": "57698-3",
                "system": "http://loinc.org",
                "category": "Chemistry",
                "specimen_type": "Blood",
                "turnaround_time": "2 hours",
                "normal_range": "Various",
                "units": "mg/dL",
                "is_stat_available": False
            },
            {
                "name": "Thyroid Stimulating Hormone",
                "code": "3016-3",
                "system": "http://loinc.org",
                "category": "Endocrinology",
                "specimen_type": "Blood",
                "turnaround_time": "4 hours",
                "normal_range": "0.4-4.0",
                "units": "mIU/L",
                "is_stat_available": False
            },
            {
                "name": "Hemoglobin A1c",
                "code": "4548-4",
                "system": "http://loinc.org",
                "category": "Chemistry",
                "specimen_type": "Blood",
                "turnaround_time": "2 hours",
                "normal_range": "<7.0",
                "units": "%",
                "is_stat_available": False
            }
        ]
        
        self.static_imaging_studies = [
            {
                "name": "Chest X-ray",
                "code": "36643-5",
                "system": "http://loinc.org",
                "modality": "CR",
                "body_part": "Chest",
                "contrast": False,
                "typical_duration": "15 minutes",
                "preparation": "None",
                "is_stat_available": True
            },
            {
                "name": "CT Chest with Contrast",
                "code": "24627-2",
                "system": "http://loinc.org",
                "modality": "CT",
                "body_part": "Chest",
                "contrast": True,
                "typical_duration": "30 minutes",
                "preparation": "NPO 4 hours",
                "is_stat_available": True
            },
            {
                "name": "MRI Brain",
                "code": "24558-9",
                "system": "http://loinc.org",
                "modality": "MR",
                "body_part": "Brain",
                "contrast": False,
                "typical_duration": "45 minutes",
                "preparation": "Remove metal objects",
                "is_stat_available": False
            },
            {
                "name": "Abdominal Ultrasound",
                "code": "24982-1",
                "system": "http://loinc.org",
                "modality": "US",
                "body_part": "Abdomen",
                "contrast": False,
                "typical_duration": "30 minutes",
                "preparation": "NPO 8 hours",
                "is_stat_available": True
            }
        ]

    async def connect_database(self):
        """Connect to the database."""
        try:
            self.conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
            logger.info("✅ Connected to database")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise

    async def close_database(self):
        """Close database connection."""
        if self.conn:
            await self.conn.close()
            logger.info("🔌 Database connection closed")

    async def create_catalog_tables(self):
        """Create catalog tables if they don't exist."""
        logger.info("🏗️ Creating catalog tables...")
        
        # Create catalog tables
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS clinical_catalogs.medication_catalog (
                id SERIAL PRIMARY KEY,
                generic_name VARCHAR(255) NOT NULL,
                brand_name VARCHAR(255),
                strength VARCHAR(100),
                dosage_form VARCHAR(100),
                drug_class VARCHAR(255),
                therapeutic_category VARCHAR(255),
                route VARCHAR(100),
                frequency_options JSONB,
                standard_doses JSONB,
                rxnorm_code VARCHAR(50),
                is_formulary BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(generic_name, strength, dosage_form)
            )
        """)
        
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS clinical_catalogs.lab_test_catalog (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) NOT NULL,
                system VARCHAR(255),
                category VARCHAR(100),
                specimen_type VARCHAR(100),
                turnaround_time VARCHAR(100),
                normal_range VARCHAR(255),
                units VARCHAR(50),
                is_stat_available BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(code, system)
            )
        """)
        
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS clinical_catalogs.imaging_study_catalog (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) NOT NULL,
                system VARCHAR(255),
                modality VARCHAR(10),
                body_part VARCHAR(100),
                contrast BOOLEAN DEFAULT false,
                typical_duration VARCHAR(100),
                preparation VARCHAR(500),
                is_stat_available BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(code, system)
            )
        """)
        
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS clinical_catalogs.condition_catalog (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) NOT NULL,
                system VARCHAR(255),
                category VARCHAR(100),
                severity VARCHAR(50),
                chronic BOOLEAN DEFAULT false,
                icd10_code VARCHAR(20),
                frequency_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(code, system)
            )
        """)
        
        logger.info("✅ Catalog tables created successfully")

    async def extract_from_fhir(self):
        """Extract catalog data from existing FHIR resources."""
        logger.info("🔍 Extracting catalog data from FHIR resources...")
        
        # Extract medications from MedicationRequest resources
        await self._extract_medications()
        
        # Extract lab tests from Observation resources
        await self._extract_lab_tests()
        
        # Extract conditions from Condition resources
        await self._extract_conditions()
        
        # Extract imaging studies from ImagingStudy resources
        await self._extract_imaging_studies()
        
        logger.info("✅ FHIR extraction completed")

    async def _extract_medications(self):
        """Extract medication data from MedicationRequest resources."""
        logger.info("💊 Extracting medication data...")
        
        # Get unique medications from MedicationRequest resources
        medications = await self.conn.fetch("""
            SELECT DISTINCT 
                resource->'medicationCodeableConcept'->'coding'->0->>'display' as name,
                resource->'medicationCodeableConcept'->'coding'->0->>'code' as code,
                resource->'medicationCodeableConcept'->'coding'->0->>'system' as system,
                COUNT(*) as frequency
            FROM fhir.resources 
            WHERE resource_type = 'MedicationRequest'
            AND resource->'medicationCodeableConcept'->'coding'->0->>'display' IS NOT NULL
            AND deleted = false
            GROUP BY 
                resource->'medicationCodeableConcept'->'coding'->0->>'display',
                resource->'medicationCodeableConcept'->'coding'->0->>'code',
                resource->'medicationCodeableConcept'->'coding'->0->>'system'
            ORDER BY frequency DESC
        """)
        
        extracted_count = 0
        for med in medications:
            if med['name'] and med['code']:
                # Extract generic name (remove strength info)
                generic_name = med['name'].split(' ')[0]
                
                # Insert into medication catalog
                await self.conn.execute("""
                    INSERT INTO clinical_catalogs.medication_catalog 
                    (generic_name, brand_name, strength, dosage_form, drug_class, 
                     therapeutic_category, route, frequency_options, standard_doses, 
                     rxnorm_code, is_formulary)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (generic_name, strength, dosage_form) DO UPDATE SET
                        updated_at = CURRENT_TIMESTAMP
                """, 
                generic_name, med['name'], 'Variable', 'tablet', 'Unknown', 
                'General', 'oral', json.dumps(['once daily', 'twice daily']),
                json.dumps(['Variable']), med['code'], True)
                
                extracted_count += 1
        
        logger.info(f"✅ Extracted {extracted_count} medications")

    async def _extract_lab_tests(self):
        """Extract lab test data from Observation resources."""
        logger.info("🧪 Extracting lab test data...")
        
        # Get unique lab tests from Observation resources
        lab_tests = await self.conn.fetch("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'display' as name,
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'system' as system,
                resource->'category'->0->'coding'->0->>'display' as category,
                COUNT(*) as frequency
            FROM fhir.resources 
            WHERE resource_type = 'Observation'
            AND resource->'category'->0->'coding'->0->>'code' = 'laboratory'
            AND resource->'code'->'coding'->0->>'display' IS NOT NULL
            AND deleted = false
            GROUP BY 
                resource->'code'->'coding'->0->>'display',
                resource->'code'->'coding'->0->>'code',
                resource->'code'->'coding'->0->>'system',
                resource->'category'->0->'coding'->0->>'display'
            ORDER BY frequency DESC
        """)
        
        extracted_count = 0
        for test in lab_tests:
            if test['name'] and test['code']:
                # Insert into lab test catalog
                await self.conn.execute("""
                    INSERT INTO clinical_catalogs.lab_test_catalog 
                    (name, code, system, category, specimen_type, turnaround_time, 
                     normal_range, units, is_stat_available)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (code, system) DO UPDATE SET
                        updated_at = CURRENT_TIMESTAMP
                """, 
                test['name'], test['code'], test['system'], test['category'] or 'Laboratory',
                'Blood', '2 hours', 'See reference range', 'Various', True)
                
                extracted_count += 1
        
        logger.info(f"✅ Extracted {extracted_count} lab tests")

    async def _extract_conditions(self):
        """Extract condition data from Condition resources."""
        logger.info("🩺 Extracting condition data...")
        
        # Get unique conditions from Condition resources
        conditions = await self.conn.fetch("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'display' as name,
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'system' as system,
                resource->'category'->0->'coding'->0->>'display' as category,
                COUNT(*) as frequency
            FROM fhir.resources 
            WHERE resource_type = 'Condition'
            AND resource->'code'->'coding'->0->>'display' IS NOT NULL
            AND deleted = false
            GROUP BY 
                resource->'code'->'coding'->0->>'display',
                resource->'code'->'coding'->0->>'code',
                resource->'code'->'coding'->0->>'system',
                resource->'category'->0->'coding'->0->>'display'
            ORDER BY frequency DESC
        """)
        
        extracted_count = 0
        for condition in conditions:
            if condition['name'] and condition['code']:
                # Insert into condition catalog
                await self.conn.execute("""
                    INSERT INTO clinical_catalogs.condition_catalog 
                    (name, code, system, category, severity, chronic, 
                     icd10_code, frequency_count)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (code, system) DO UPDATE SET
                        frequency_count = EXCLUDED.frequency_count,
                        updated_at = CURRENT_TIMESTAMP
                """, 
                condition['name'], condition['code'], condition['system'], 
                condition['category'] or 'General', 'Unknown', False, 
                condition['code'], condition['frequency'])
                
                extracted_count += 1
        
        logger.info(f"✅ Extracted {extracted_count} conditions")

    async def _extract_imaging_studies(self):
        """Extract imaging study data from ImagingStudy resources."""
        logger.info("🔬 Extracting imaging study data...")
        
        # Get unique imaging studies from ImagingStudy resources
        studies = await self.conn.fetch("""
            SELECT DISTINCT 
                resource->>'description' as name,
                resource->'modality'->0->>'code' as modality,
                resource->'modality'->0->>'display' as modality_display,
                COUNT(*) as frequency
            FROM fhir.resources 
            WHERE resource_type = 'ImagingStudy'
            AND resource->>'description' IS NOT NULL
            AND deleted = false
            GROUP BY 
                resource->>'description',
                resource->'modality'->0->>'code',
                resource->'modality'->0->>'display'
            ORDER BY frequency DESC
        """)
        
        extracted_count = 0
        for study in studies:
            if study['name'] and study['modality']:
                # Generate a code for the study
                study_code = f"IMG-{study['modality']}-{hash(study['name']) % 10000}"
                
                # Insert into imaging study catalog
                await self.conn.execute("""
                    INSERT INTO clinical_catalogs.imaging_study_catalog 
                    (name, code, system, modality, body_part, contrast, 
                     typical_duration, preparation, is_stat_available)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (code, system) DO UPDATE SET
                        updated_at = CURRENT_TIMESTAMP
                """, 
                study['name'], study_code, 'http://local.codes/imaging', 
                study['modality'], 'Various', False, '30 minutes', 
                'Follow department protocol', True)
                
                extracted_count += 1
        
        logger.info(f"✅ Extracted {extracted_count} imaging studies")

    async def populate_static_catalogs(self):
        """Populate catalogs with static fallback data."""
        logger.info("📋 Populating static catalog data...")
        
        # Populate medication catalog
        for med in self.static_medications:
            await self.conn.execute("""
                INSERT INTO clinical_catalogs.medication_catalog 
                (generic_name, brand_name, strength, dosage_form, drug_class, 
                 therapeutic_category, route, frequency_options, standard_doses, 
                 rxnorm_code, is_formulary)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (generic_name, strength, dosage_form) DO UPDATE SET
                    brand_name = EXCLUDED.brand_name,
                    drug_class = EXCLUDED.drug_class,
                    therapeutic_category = EXCLUDED.therapeutic_category,
                    updated_at = CURRENT_TIMESTAMP
            """, 
            med['generic_name'], med['brand_name'], med['strength'], med['dosage_form'],
            med['drug_class'], med['therapeutic_category'], med['route'],
            json.dumps(med['frequency_options']), json.dumps(med['standard_doses']),
            med['rxnorm_code'], med['is_formulary'])
        
        # Populate lab test catalog
        for test in self.static_lab_tests:
            await self.conn.execute("""
                INSERT INTO clinical_catalogs.lab_test_catalog 
                (name, code, system, category, specimen_type, turnaround_time, 
                 normal_range, units, is_stat_available)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (code, system) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    updated_at = CURRENT_TIMESTAMP
            """, 
            test['name'], test['code'], test['system'], test['category'],
            test['specimen_type'], test['turnaround_time'], test['normal_range'],
            test['units'], test['is_stat_available'])
        
        # Populate imaging study catalog
        for study in self.static_imaging_studies:
            await self.conn.execute("""
                INSERT INTO clinical_catalogs.imaging_study_catalog 
                (name, code, system, modality, body_part, contrast, 
                 typical_duration, preparation, is_stat_available)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (code, system) DO UPDATE SET
                    name = EXCLUDED.name,
                    modality = EXCLUDED.modality,
                    updated_at = CURRENT_TIMESTAMP
            """, 
            study['name'], study['code'], study['system'], study['modality'],
            study['body_part'], study['contrast'], study['typical_duration'],
            study['preparation'], study['is_stat_available'])
        
        logger.info("✅ Static catalog population completed")

    async def show_status(self):
        """Show current catalog status."""
        logger.info("📊 Current catalog status:")
        
        # Check if catalog schema exists
        schema_exists = await self.conn.fetchval("""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.schemata 
                WHERE schema_name = 'clinical_catalogs'
            )
        """)
        
        if not schema_exists:
            logger.warning("⚠️ Clinical catalogs schema does not exist")
            return
        
        # Medication catalog
        med_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM clinical_catalogs.medication_catalog
        """)
        logger.info(f"Medications in catalog: {med_count}")
        
        # Lab test catalog
        lab_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM clinical_catalogs.lab_test_catalog
        """)
        logger.info(f"Lab tests in catalog: {lab_count}")
        
        # Imaging study catalog
        img_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM clinical_catalogs.imaging_study_catalog
        """)
        logger.info(f"Imaging studies in catalog: {img_count}")
        
        # Condition catalog
        cond_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM clinical_catalogs.condition_catalog
        """)
        logger.info(f"Conditions in catalog: {cond_count}")

    async def validate_catalogs(self):
        """Validate catalog data integrity."""
        logger.info("🔍 Validating catalog data...")
        
        validation_errors = []
        
        # Validate medication catalog
        med_issues = await self.conn.fetch("""
            SELECT id, generic_name FROM clinical_catalogs.medication_catalog
            WHERE generic_name IS NULL OR generic_name = ''
        """)
        if med_issues:
            validation_errors.append(f"Found {len(med_issues)} medications with missing names")
        
        # Validate lab test catalog
        lab_issues = await self.conn.fetch("""
            SELECT id, name, code FROM clinical_catalogs.lab_test_catalog
            WHERE name IS NULL OR name = '' OR code IS NULL OR code = ''
        """)
        if lab_issues:
            validation_errors.append(f"Found {len(lab_issues)} lab tests with missing name/code")
        
        if validation_errors:
            logger.warning("⚠️ Validation issues found:")
            for error in validation_errors:
                logger.warning(f"  - {error}")
        else:
            logger.info("✅ All catalog data validated successfully")

    async def run(self):
        """Run the consolidated catalog setup process."""
        await self.connect_database()
        
        try:
            # Create schema if it doesn't exist
            await self.conn.execute("CREATE SCHEMA IF NOT EXISTS clinical_catalogs")
            
            # Create tables
            await self.create_catalog_tables()
            
            if getattr(self.args, 'status', False):
                await self.show_status()
                return
            
            if getattr(self.args, 'validate', False):
                await self.validate_catalogs()
                return
            
            if getattr(self.args, 'all', False):
                await self.extract_from_fhir()
                await self.populate_static_catalogs()
            else:
                if getattr(self.args, 'extract_from_fhir', False):
                    await self.extract_from_fhir()
                
                if getattr(self.args, 'populate_static', False):
                    await self.populate_static_catalogs()
            
            # Final validation
            await self.validate_catalogs()
            
            logger.info("🎉 Consolidated catalog setup completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Catalog setup failed: {e}")
            raise
        finally:
            await self.close_database()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Consolidated clinical catalog setup')
    parser.add_argument('--all', action='store_true', help='Run all catalog setup processes')
    parser.add_argument('--extract-from-fhir', action='store_true', help='Extract catalogs from FHIR data')
    parser.add_argument('--populate-static', action='store_true', help='Populate static catalog data')
    parser.add_argument('--status', action='store_true', help='Show current catalog status')
    parser.add_argument('--validate', action='store_true', help='Validate catalog data integrity')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create and run catalog setup
    catalog_setup = ConsolidatedCatalogSetup(args)
    asyncio.run(catalog_setup.run())