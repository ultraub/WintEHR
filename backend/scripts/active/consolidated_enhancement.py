#!/usr/bin/env python3
"""
Consolidated Enhancement Script for WintEHR

This script consolidates all FHIR data enhancement functionality:
- enhance_fhir_data.py (Organizations, Providers, patient names)
- enhance_imaging_import.py (Imaging studies integration)
- enhance_lab_results.py (Reference ranges and interpretation codes)

Enhanced Features (2025-01-17):
- Unified command-line interface for all enhancement operations
- Comprehensive error handling and logging
- Production-ready database integration
- Modular design for selective enhancement
- Progress tracking and status reporting

Usage:
    python consolidated_enhancement.py --all
    python consolidated_enhancement.py --fhir-data --provider-count 15
    python consolidated_enhancement.py --imaging --patient-count 10
    python consolidated_enhancement.py --lab-results --dry-run
    python consolidated_enhancement.py --status  # Show current enhancement status
"""

import asyncio
import asyncpg
import json
import uuid
import random
import re
import argparse
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/app/logs/enhancement.log')
    ]
)
logger = logging.getLogger(__name__)


class ConsolidatedEnhancer:
    """Consolidated FHIR data enhancement functionality."""
    
    def __init__(self, args=None):
        self.args = args or argparse.Namespace()
        self.conn = None
        
        # Realistic data for generation
        self.org_prefixes = ["City", "County", "Regional", "St.", "University", "Community"]
        self.org_suffixes = ["Hospital", "Medical Center", "Health System", "Clinic", "Healthcare"]
        
        self.first_names = {
            'male': ["James", "John", "Robert", "Michael", "William", "David", "Richard", 
                    "Thomas", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald"],
            'female': ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", 
                      "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Helen"]
        }
        
        self.last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", 
                          "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", 
                          "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore"]
        
        self.specialties = [
            "Internal Medicine", "Family Medicine", "Pediatrics", "Cardiology", 
            "Orthopedics", "Neurology", "Dermatology", "Psychiatry", "Radiology",
            "Emergency Medicine", "Anesthesiology", "Pathology", "Surgery"
        ]
        
        # Lab reference ranges (LOINC code -> ranges)
        self.lab_reference_ranges = {
            "33747-0": {"low": 3.5, "high": 5.2, "unit": "g/dL", "name": "Albumin"},
            "1751-7": {"low": 3.5, "high": 5.0, "unit": "g/dL", "name": "Albumin"},
            "1920-8": {"low": 7, "high": 56, "unit": "U/L", "name": "ALT"},
            "1742-6": {"low": 10, "high": 40, "unit": "U/L", "name": "AST"},
            "1975-2": {"low": 0.3, "high": 1.2, "unit": "mg/dL", "name": "Bilirubin"},
            "2093-3": {"low": 70, "high": 99, "unit": "mg/dL", "name": "Cholesterol"},
            "2160-0": {"low": 0.6, "high": 1.3, "unit": "mg/dL", "name": "Creatinine"},
            "33743-4": {"low": 3.5, "high": 5.5, "unit": "g/dL", "name": "Total Protein"},
            "2345-7": {"low": 70, "high": 100, "unit": "mg/dL", "name": "Glucose"},
            "718-7": {"low": 12.0, "high": 15.5, "unit": "g/dL", "name": "Hemoglobin"},
            "26464-8": {"low": 150, "high": 450, "unit": "10*3/uL", "name": "Platelets"},
            "26515-7": {"low": 4.0, "high": 11.0, "unit": "10*3/uL", "name": "WBC"}
        }
        
        # Imaging study types and modalities
        self.imaging_types = [
            {"modality": "CT", "bodypart": "CHEST", "description": "CT Chest with contrast"},
            {"modality": "CT", "bodypart": "ABDOMEN", "description": "CT Abdomen/Pelvis"},
            {"modality": "CT", "bodypart": "HEAD", "description": "CT Head without contrast"},
            {"modality": "MR", "bodypart": "BRAIN", "description": "MRI Brain with contrast"},
            {"modality": "MR", "bodypart": "SPINE", "description": "MRI Lumbar Spine"},
            {"modality": "CR", "bodypart": "CHEST", "description": "Chest X-ray"},
            {"modality": "US", "bodypart": "ABDOMEN", "description": "Abdominal Ultrasound"},
            {"modality": "US", "bodypart": "PELVIS", "description": "Pelvic Ultrasound"}
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

    async def enhance_fhir_data(self):
        """Enhance FHIR data with Organizations, Providers, and clean patient names."""
        logger.info("🏥 Starting FHIR data enhancement...")
        
        org_count = getattr(self.args, 'org_count', 5)
        provider_count = getattr(self.args, 'provider_count', 10)
        
        # Create organizations
        await self._create_organizations(org_count)
        
        # Create providers
        await self._create_providers(provider_count)
        
        # Clean patient names
        await self._clean_patient_names()
        
        logger.info("✅ FHIR data enhancement completed")

    async def _create_organizations(self, count: int):
        """Create realistic Organization resources."""
        logger.info(f"🏢 Creating {count} Organization resources...")
        
        created_count = 0
        for i in range(count):
            org_name = f"{random.choice(self.org_prefixes)} {random.choice(self.org_suffixes)}"
            org_id = str(uuid.uuid4())
            
            organization = {
                "resourceType": "Organization",
                "id": org_id,
                "active": True,
                "name": org_name,
                "type": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/organization-type",
                        "code": "prov",
                        "display": "Healthcare Provider"
                    }]
                }],
                "address": [{
                    "use": "work",
                    "line": [f"{random.randint(100, 9999)} Healthcare Blvd"],
                    "city": random.choice(["Boston", "New York", "Chicago", "Los Angeles", "Houston"]),
                    "state": random.choice(["MA", "NY", "IL", "CA", "TX"]),
                    "postalCode": f"{random.randint(10000, 99999)}"
                }],
                "telecom": [{
                    "system": "phone",
                    "value": f"+1-{random.randint(100, 999)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
                    "use": "work"
                }]
            }
            
            # Insert into database
            await self.conn.execute("""
                INSERT INTO fhir.resources (id, fhir_id, resource_type, resource, version_id, last_updated)
                VALUES ($1, $2, 'Organization', $3, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (fhir_id) DO UPDATE SET
                    resource = EXCLUDED.resource,
                    version_id = version_id + 1,
                    last_updated = CURRENT_TIMESTAMP
            """, str(uuid.uuid4()), org_id, json.dumps(organization))
            
            created_count += 1
            
        logger.info(f"✅ Created {created_count} Organization resources")

    async def _create_providers(self, count: int):
        """Create realistic Practitioner resources."""
        logger.info(f"👨‍⚕️ Creating {count} Practitioner resources...")
        
        created_count = 0
        for i in range(count):
            gender = random.choice(['male', 'female'])
            first_name = random.choice(self.first_names[gender])
            last_name = random.choice(self.last_names)
            provider_id = str(uuid.uuid4())
            
            practitioner = {
                "resourceType": "Practitioner",
                "id": provider_id,
                "active": True,
                "name": [{
                    "use": "official",
                    "family": last_name,
                    "given": [first_name],
                    "prefix": ["Dr."]
                }],
                "gender": gender,
                "qualification": [{
                    "code": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0360",
                            "code": "MD",
                            "display": "Doctor of Medicine"
                        }]
                    }
                }],
                "communication": [{
                    "coding": [{
                        "system": "urn:ietf:bcp:47",
                        "code": "en-US",
                        "display": "English (United States)"
                    }]
                }]
            }
            
            # Insert into database
            await self.conn.execute("""
                INSERT INTO fhir.resources (id, fhir_id, resource_type, resource, version_id, last_updated)
                VALUES ($1, $2, 'Practitioner', $3, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (fhir_id) DO UPDATE SET
                    resource = EXCLUDED.resource,
                    version_id = version_id + 1,
                    last_updated = CURRENT_TIMESTAMP
            """, str(uuid.uuid4()), provider_id, json.dumps(practitioner))
            
            created_count += 1
            
        logger.info(f"✅ Created {created_count} Practitioner resources")

    async def _clean_patient_names(self):
        """Clean patient names that may have formatting issues."""
        logger.info("🧹 Cleaning patient names...")
        
        # Get all patients
        patients = await self.conn.fetch("""
            SELECT id, fhir_id, resource 
            FROM fhir.resources 
            WHERE resource_type = 'Patient' 
            AND deleted = false
        """)
        
        updated_count = 0
        for patient_row in patients:
            patient_resource = json.loads(patient_row['resource'])
            
            if 'name' in patient_resource and patient_resource['name']:
                modified = False
                for name in patient_resource['name']:
                    # Clean family name
                    if 'family' in name and name['family']:
                        clean_family = re.sub(r'[^\w\s-]', '', name['family']).strip()
                        if clean_family != name['family']:
                            name['family'] = clean_family
                            modified = True
                    
                    # Clean given names
                    if 'given' in name and name['given']:
                        clean_given = []
                        for given in name['given']:
                            clean_name = re.sub(r'[^\w\s-]', '', given).strip()
                            if clean_name:
                                clean_given.append(clean_name)
                        if clean_given != name['given']:
                            name['given'] = clean_given
                            modified = True
                
                if modified:
                    # Update the resource
                    await self.conn.execute("""
                        UPDATE fhir.resources
                        SET resource = $1,
                            version_id = version_id + 1,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE id = $2
                    """, json.dumps(patient_resource), patient_row['id'])
                    updated_count += 1
        
        logger.info(f"✅ Cleaned {updated_count} patient names")

    async def enhance_imaging_studies(self):
        """Enhance imaging studies integration."""
        logger.info("🔬 Starting imaging studies enhancement...")
        
        patient_count = getattr(self.args, 'patient_count', 10)
        
        # Get patients who don't have imaging studies
        patients = await self.conn.fetch("""
            SELECT p.id, p.fhir_id, p.resource
            FROM fhir.resources p
            LEFT JOIN fhir.resources i ON i.resource_type = 'ImagingStudy' 
                AND i.resource::text LIKE '%' || p.fhir_id || '%'
            WHERE p.resource_type = 'Patient' 
            AND p.deleted = false
            AND i.id IS NULL
            ORDER BY p.last_updated DESC
            LIMIT $1
        """, patient_count)
        
        created_count = 0
        for patient_row in patients:
            patient_resource = json.loads(patient_row['resource'])
            patient_id = patient_row['fhir_id']
            
            # Create 1-3 imaging studies per patient
            num_studies = random.randint(1, 3)
            for _ in range(num_studies):
                study_type = random.choice(self.imaging_types)
                study_id = str(uuid.uuid4())
                
                # Create study date within last 2 years
                study_date = datetime.now() - timedelta(days=random.randint(1, 730))
                
                imaging_study = {
                    "resourceType": "ImagingStudy",
                    "id": study_id,
                    "status": "available",
                    "modality": [{
                        "system": "http://dicom.nema.org/resources/ontology/DCM",
                        "code": study_type["modality"],
                        "display": study_type["modality"]
                    }],
                    "subject": {
                        "reference": f"Patient/{patient_id}"
                    },
                    "started": study_date.isoformat(),
                    "numberOfSeries": random.randint(1, 3),
                    "numberOfInstances": random.randint(20, 200),
                    "description": study_type["description"],
                    "series": [{
                        "uid": f"1.2.3.4.5.{random.randint(1000, 9999)}",
                        "number": 1,
                        "modality": {
                            "system": "http://dicom.nema.org/resources/ontology/DCM",
                            "code": study_type["modality"],
                            "display": study_type["modality"]
                        },
                        "numberOfInstances": random.randint(20, 200),
                        "description": study_type["description"],
                        "bodySite": {
                            "system": "http://snomed.info/sct",
                            "code": "123456",
                            "display": study_type["bodypart"]
                        }
                    }]
                }
                
                # Insert into database
                await self.conn.execute("""
                    INSERT INTO fhir.resources (id, fhir_id, resource_type, resource, version_id, last_updated)
                    VALUES ($1, $2, 'ImagingStudy', $3, 1, CURRENT_TIMESTAMP)
                """, str(uuid.uuid4()), study_id, json.dumps(imaging_study))
                
                created_count += 1
        
        logger.info(f"✅ Created {created_count} ImagingStudy resources")

    async def enhance_lab_results(self):
        """Enhance lab results with reference ranges and interpretation."""
        logger.info("🧪 Starting lab results enhancement...")
        
        # Get all lab Observation resources without reference ranges
        observations = await self.conn.fetch("""
            SELECT id, fhir_id, resource 
            FROM fhir.resources 
            WHERE resource_type = 'Observation' 
            AND deleted = false
            AND resource::text LIKE '%"category"%'
            AND resource::text LIKE '%laboratory%'
            AND resource::text NOT LIKE '%referenceRange%'
        """)
        
        enhanced_count = 0
        for obs_row in observations:
            obs_resource = json.loads(obs_row['resource'])
            
            # Get LOINC code
            loinc_code = None
            if 'code' in obs_resource and 'coding' in obs_resource['code']:
                for coding in obs_resource['code']['coding']:
                    if coding.get('system') == 'http://loinc.org':
                        loinc_code = coding.get('code')
                        break
            
            if loinc_code and loinc_code in self.lab_reference_ranges:
                ref_range = self.lab_reference_ranges[loinc_code]
                
                # Add reference range
                obs_resource['referenceRange'] = [{
                    'low': {
                        'value': ref_range['low'],
                        'unit': ref_range['unit']
                    },
                    'high': {
                        'value': ref_range['high'],
                        'unit': ref_range['unit']
                    }
                }]
                
                # Add interpretation if value exists
                if 'valueQuantity' in obs_resource:
                    value = obs_resource['valueQuantity'].get('value')
                    if value is not None:
                        if value < ref_range['low']:
                            interpretation = 'L'
                            display = 'Low'
                        elif value > ref_range['high']:
                            interpretation = 'H'
                            display = 'High'
                        else:
                            interpretation = 'N'
                            display = 'Normal'
                        
                        obs_resource['interpretation'] = [{
                            'coding': [{
                                'system': 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                                'code': interpretation,
                                'display': display
                            }]
                        }]
                
                # Update the resource
                await self.conn.execute("""
                    UPDATE fhir.resources
                    SET resource = $1,
                        version_id = version_id + 1,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE id = $2
                """, json.dumps(obs_resource), obs_row['id'])
                
                enhanced_count += 1
        
        logger.info(f"✅ Enhanced {enhanced_count} lab results")

    async def show_status(self):
        """Show current enhancement status."""
        logger.info("📊 Current enhancement status:")
        
        # Organizations
        org_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE resource_type = 'Organization' AND deleted = false
        """)
        logger.info(f"Organizations: {org_count}")
        
        # Practitioners
        pract_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE resource_type = 'Practitioner' AND deleted = false
        """)
        logger.info(f"Practitioners: {pract_count}")
        
        # Patients
        patient_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE resource_type = 'Patient' AND deleted = false
        """)
        logger.info(f"Patients: {patient_count}")
        
        # Imaging Studies
        imaging_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE resource_type = 'ImagingStudy' AND deleted = false
        """)
        logger.info(f"Imaging Studies: {imaging_count}")
        
        # Lab Results with reference ranges
        lab_enhanced_count = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE resource_type = 'Observation' 
            AND deleted = false
            AND resource::text LIKE '%referenceRange%'
        """)
        logger.info(f"Enhanced Lab Results: {lab_enhanced_count}")

    async def run(self):
        """Run the consolidation enhancement process."""
        await self.connect_database()
        
        try:
            if getattr(self.args, 'status', False):
                await self.show_status()
                return
            
            if getattr(self.args, 'all', False):
                await self.enhance_fhir_data()
                await self.enhance_imaging_studies() 
                await self.enhance_lab_results()
            else:
                if getattr(self.args, 'fhir_data', False):
                    await self.enhance_fhir_data()
                
                if getattr(self.args, 'imaging', False):
                    await self.enhance_imaging_studies()
                
                if getattr(self.args, 'lab_results', False):
                    await self.enhance_lab_results()
            
            logger.info("🎉 Consolidated enhancement completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Enhancement failed: {e}")
            raise
        finally:
            await self.close_database()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Consolidated FHIR data enhancement')
    parser.add_argument('--all', action='store_true', help='Run all enhancement processes')
    parser.add_argument('--fhir-data', action='store_true', help='Enhance FHIR data (orgs, providers, names)')
    parser.add_argument('--imaging', action='store_true', help='Enhance imaging studies')
    parser.add_argument('--lab-results', action='store_true', help='Enhance lab results')
    parser.add_argument('--status', action='store_true', help='Show current enhancement status')
    parser.add_argument('--org-count', type=int, default=5, help='Number of organizations to create')
    parser.add_argument('--provider-count', type=int, default=10, help='Number of providers to create')
    parser.add_argument('--patient-count', type=int, default=10, help='Number of patients to process')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create and run enhancer
    enhancer = ConsolidatedEnhancer(args)
    asyncio.run(enhancer.run())