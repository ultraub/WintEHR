#!/usr/bin/env python3
"""
Enhanced Imaging Study Import and Integration Script

This script investigates and enhances the Synthea imaging study import process,
ensuring proper FHIR ImagingStudy resources are created and linked with DICOM generation.

Key Functionality:
1. Analyzes current imaging study data availability
2. Enhances Synthea import to include imaging studies
3. Creates proper FHIR ImagingStudy resources with complete metadata
4. Links imaging studies with DICOM generation
5. Integrates with the clinical workspace imaging tab

Usage:
    python scripts/enhance_imaging_import.py investigate
    python scripts/enhance_imaging_import.py import --patient-count 10
    python scripts/enhance_imaging_import.py generate-dicoms
    python scripts/enhance_imaging_import.py full-workflow --patient-count 5
"""

import asyncio
import sys
import json
import uuid
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import argparse
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
import requests

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ImagingStudyEnhancer:
    """Enhanced imaging study import and integration manager."""
    
    def __init__(self):
        self.engine = None
        self.base_url = "http://localhost:8000"
        
        # FHIR ImagingStudy template for Synthea enhancement
        self.imaging_study_templates = {
            "CT_CHEST": {
                "description": "CT Chest without contrast",
                "modality": [{"system": "http://dicom.nema.org/resources/ontology/DCM", "code": "CT", "display": "Computed Tomography"}],
                "bodySite": [{"system": "http://snomed.info/sct", "code": "51185008", "display": "Thoracic structure"}],
                "numberOfSeries": 1,
                "numberOfInstances": random.randint(64, 128),
                "procedureCodes": ["71250", "71260", "71270"]
            },
            "CT_HEAD": {
                "description": "CT Head without contrast",
                "modality": [{"system": "http://dicom.nema.org/resources/ontology/DCM", "code": "CT", "display": "Computed Tomography"}],
                "bodySite": [{"system": "http://snomed.info/sct", "code": "69536005", "display": "Head structure"}],
                "numberOfSeries": 1,
                "numberOfInstances": random.randint(32, 64),
                "procedureCodes": ["70450", "70460", "70470"]
            },
            "MR_BRAIN": {
                "description": "MRI Brain with and without contrast",
                "modality": [{"system": "http://dicom.nema.org/resources/ontology/DCM", "code": "MR", "display": "Magnetic Resonance"}],
                "bodySite": [{"system": "http://snomed.info/sct", "code": "12738006", "display": "Brain structure"}],
                "numberOfSeries": 3,
                "numberOfInstances": random.randint(176, 240),
                "procedureCodes": ["70551", "70552", "70553"]
            },
            "XR_CHEST": {
                "description": "Chest X-ray PA and lateral",
                "modality": [{"system": "http://dicom.nema.org/resources/ontology/DCM", "code": "CR", "display": "Computed Radiography"}],
                "bodySite": [{"system": "http://snomed.info/sct", "code": "51185008", "display": "Thoracic structure"}],
                "numberOfSeries": 1,
                "numberOfInstances": 2,
                "procedureCodes": ["71010", "71020", "71030"]
            },
            "US_ABDOMEN": {
                "description": "Abdominal ultrasound complete",
                "modality": [{"system": "http://dicom.nema.org/resources/ontology/DCM", "code": "US", "display": "Ultrasound"}],
                "bodySite": [{"system": "http://snomed.info/sct", "code": "818983003", "display": "Abdomen structure"}],
                "numberOfSeries": 1,
                "numberOfInstances": random.randint(20, 50),
                "procedureCodes": ["76700", "76705"]
            },
            "MR_LUMBAR_SPINE": {
                "description": "MRI Lumbar spine without contrast",
                "modality": [{"system": "http://dicom.nema.org/resources/ontology/DCM", "code": "MR", "display": "Magnetic Resonance"}],
                "bodySite": [{"system": "http://snomed.info/sct", "code": "122496007", "display": "Lumbar spine structure"}],
                "numberOfSeries": 4,
                "numberOfInstances": random.randint(120, 160),
                "procedureCodes": ["72148", "72149"]
            }
        }
    
    async def investigate_current_state(self) -> Dict[str, Any]:
        """Investigate current imaging study availability and structure."""
        logger.info("🔍 Investigating current imaging study state...")
        
        try:
            if not self.engine:
                self.engine = create_async_engine(DATABASE_URL, echo=False)
            
            async with AsyncSession(self.engine) as session:
                # Check total FHIR resources
                result = await session.execute(text("""
                    SELECT resource_type, COUNT(*) as count
                    FROM fhir.resources
                    WHERE deleted = false
                    GROUP BY resource_type
                    ORDER BY count DESC
                """))
                
                resource_counts = {}
                for row in result:
                    resource_counts[row[0]] = row[1]
                
                # Check ImagingStudy specifically
                imaging_count = resource_counts.get('ImagingStudy', 0)
                patient_count = resource_counts.get('Patient', 0)
                
                # Analyze existing imaging studies
                imaging_analysis = {}
                if imaging_count > 0:
                    result = await session.execute(text("""
                        SELECT 
                            resource->>'status' as status,
                            resource->'modality'->0->>'code' as modality,
                            resource->>'started' as started,
                            resource->>'numberOfSeries' as series_count,
                            resource->>'numberOfInstances' as instance_count
                        FROM fhir.resources 
                        WHERE resource_type = 'ImagingStudy' 
                        AND deleted = false
                        LIMIT 10
                    """))
                    
                    studies = result.fetchall()
                    imaging_analysis = {
                        'sample_studies': [{
                            'status': study[0], 
                            'modality': study[1], 
                            'started': study[2], 
                            'series_count': study[3], 
                            'instance_count': study[4]
                        } for study in studies],
                        'modalities': list(set(study[1] for study in studies if study[1])),
                        'statuses': list(set(study[0] for study in studies if study[0]))
                    }
                
                # Check for Encounter resources (often linked to imaging)
                encounter_count = resource_counts.get('Encounter', 0)
                
                # Check for Procedure resources (may contain imaging orders)
                procedure_count = resource_counts.get('Procedure', 0)
                
                investigation_result = {
                    'total_resources': sum(resource_counts.values()),
                    'resource_counts': resource_counts,
                    'imaging_studies': {
                        'count': imaging_count,
                        'analysis': imaging_analysis
                    },
                    'patient_count': patient_count,
                    'encounter_count': encounter_count,
                    'procedure_count': procedure_count,
                    'imaging_ratio': imaging_count / patient_count if patient_count > 0 else 0
                }
                
                return investigation_result
                
        except Exception as e:
            logger.error(f"Investigation failed: {e}")
            return {'error': str(e)}
    
    def print_investigation_report(self, result: Dict[str, Any]):
        """Print a comprehensive investigation report."""
        print("\n" + "="*80)
        print("📊 IMAGING STUDY INVESTIGATION REPORT")
        print("="*80)
        
        if 'error' in result:
            print(f"❌ Investigation failed: {result['error']}")
            return
        
        print(f"📈 Total FHIR Resources: {result['total_resources']:,}")
        print(f"👥 Patients: {result['patient_count']:,}")
        print(f"🏥 Encounters: {result['encounter_count']:,}")
        print(f"⚕️  Procedures: {result['procedure_count']:,}")
        
        imaging = result['imaging_studies']
        print(f"\n🖼️  IMAGING STUDIES: {imaging['count']:,}")
        
        if imaging['count'] > 0:
            print(f"📊 Imaging-to-Patient Ratio: {result['imaging_ratio']:.2f}")
            
            analysis = imaging.get('analysis', {})
            if analysis:
                modalities = analysis.get('modalities', [])
                statuses = analysis.get('statuses', [])
                
                print(f"🔬 Modalities found: {', '.join(modalities) if modalities else 'None'}")
                print(f"📋 Statuses found: {', '.join(statuses) if statuses else 'None'}")
                
                # Show sample studies
                samples = analysis.get('sample_studies', [])
                if samples:
                    print(f"\n📝 Sample Studies:")
                    for i, study in enumerate(samples[:3]):
                        print(f"  {i+1}. {study.get('modality', 'Unknown')} - "
                             f"{study.get('series_count', 0)} series, "
                             f"{study.get('instance_count', 0)} instances")
        else:
            print("❌ NO IMAGING STUDIES FOUND!")
            print("\nThis indicates that:")
            print("  • Synthea is not generating imaging studies")
            print("  • Imaging studies are not being imported properly")
            print("  • Manual creation is needed for demonstration")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        if imaging['count'] == 0:
            print("  1. ✅ Run: enhance_imaging_import.py import --patient-count 10")
            print("  2. ✅ Run: enhance_imaging_import.py generate-dicoms")
            print("  3. ✅ Test clinical workspace imaging tab")
        elif result['imaging_ratio'] < 0.5:
            print("  1. ✅ Low imaging study ratio - consider importing more")
            print("  2. ✅ Run DICOM generation for existing studies")
        else:
            print("  1. ✅ Good imaging study coverage")
            print("  2. ✅ Ensure DICOM files are generated")
            print("  3. ✅ Test clinical workspace integration")
        
        print("="*80)
    
    async def create_imaging_studies_for_patients(self, patient_count: int = 10) -> Dict[str, Any]:
        """Create realistic imaging studies for existing patients."""
        logger.info(f"🏥 Creating imaging studies for {patient_count} patients...")
        
        try:
            if not self.engine:
                self.engine = create_async_engine(DATABASE_URL, echo=False)
            
            async with AsyncSession(self.engine) as session:
                # Get patients to assign imaging studies to
                result = await session.execute(text("""
                    SELECT fhir_id, resource
                    FROM fhir.resources 
                    WHERE resource_type = 'Patient' 
                    AND deleted = false
                    ORDER BY RANDOM()
                    LIMIT :limit
                """), {"limit": patient_count})
                
                patients = result.fetchall()
                
                if not patients:
                    return {'error': 'No patients found in database'}
                
                created_studies = []
                
                for patient_row in patients:
                    patient_id = patient_row[0]
                    patient_resource = patient_row[1]
                    
                    # Create 1-3 imaging studies per patient
                    study_count = random.randint(1, 3)
                    
                    for _ in range(study_count):
                        study_type = random.choice(list(self.imaging_study_templates.keys()))
                        template = self.imaging_study_templates[study_type]
                        
                        study_id = str(uuid.uuid4())
                        study_date = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 365))
                        
                        # Create FHIR ImagingStudy resource
                        imaging_study = {
                            "resourceType": "ImagingStudy",
                            "id": study_id,
                            "meta": {
                                "versionId": "1",
                                "lastUpdated": datetime.now(timezone.utc).isoformat()
                            },
                            "identifier": [
                                {
                                    "system": "http://example.org/imaging-study-id",
                                    "value": f"IMG-{random.randint(100000, 999999)}"
                                }
                            ],
                            "status": "available",
                            "modality": template["modality"],
                            "subject": {
                                "reference": f"Patient/{patient_id}",
                                "display": self._get_patient_display_name(patient_resource)
                            },
                            "started": study_date.isoformat(),
                            "description": template["description"],
                            "numberOfSeries": template["numberOfSeries"],
                            "numberOfInstances": template["numberOfInstances"],
                            "bodySite": template.get("bodySite", []),
                            "procedureCode": [
                                {
                                    "coding": [
                                        {
                                            "system": "http://www.ama-assn.org/go/cpt",
                                            "code": random.choice(template["procedureCodes"]),
                                            "display": template["description"]
                                        }
                                    ]
                                }
                            ],
                            "series": self._create_series_data(template, study_date)
                        }
                        
                        # Store in database
                        await self._store_fhir_resource(session, imaging_study)
                        created_studies.append({
                            'id': study_id,
                            'patient_id': patient_id,
                            'type': study_type,
                            'description': template['description'],
                            'study_date': study_date.isoformat()
                        })
                
                await session.commit()
                
                return {
                    'success': True,
                    'patients_processed': len(patients),
                    'studies_created': len(created_studies),
                    'studies': created_studies
                }
                
        except Exception as e:
            logger.error(f"Failed to create imaging studies: {e}")
            return {'error': str(e)}
    
    def _get_patient_display_name(self, patient_resource: Dict) -> str:
        """Extract patient display name from FHIR Patient resource."""
        names = patient_resource.get('name', [])
        if names:
            name = names[0]
            family = name.get('family', '')
            given = name.get('given', [])
            given_str = ' '.join(given) if given else ''
            return f"{given_str} {family}".strip()
        return "Unknown Patient"
    
    def _create_series_data(self, template: Dict, study_date: datetime) -> List[Dict]:
        """Create FHIR series data for imaging study."""
        series_list = []
        
        for i in range(template['numberOfSeries']):
            series_id = str(uuid.uuid4())
            instances_per_series = template['numberOfInstances'] // template['numberOfSeries']
            
            series = {
                "uid": f"1.2.826.0.1.3680043.8.498.{random.randint(100000, 999999)}.{i+1}",
                "number": i + 1,
                "modality": template['modality'][0],
                "description": f"{template['description']} - Series {i+1}",
                "numberOfInstances": instances_per_series,
                "started": study_date.isoformat(),
                "bodySite": template.get('bodySite', [{}])[0] if template.get('bodySite') else {},
                "instance": [
                    {
                        "uid": f"1.2.826.0.1.3680043.8.498.{random.randint(100000, 999999)}.{i+1}.{j+1}",
                        "sopClass": {
                            "system": "urn:ietf:rfc:3986",
                            "code": "urn:oid:1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage
                        },
                        "number": j + 1
                    }
                    for j in range(instances_per_series)
                ]
            }
            
            series_list.append(series)
        
        return series_list
    
    async def _store_fhir_resource(self, session: AsyncSession, resource: Dict):
        """Store FHIR resource in database."""
        query = text("""
            INSERT INTO fhir.resources (
                resource_type, fhir_id, version_id, last_updated, resource, deleted
            ) VALUES (
                :resource_type, :fhir_id, :version_id, :last_updated, :resource, false
            )
            ON CONFLICT (resource_type, fhir_id) 
            DO UPDATE SET 
                version_id = fhir.resources.version_id + 1,
                last_updated = EXCLUDED.last_updated,
                resource = EXCLUDED.resource
            RETURNING id
        """)
        
        result = await session.execute(query, {
            'resource_type': resource['resourceType'],
            'fhir_id': resource['id'],
            'version_id': 1,
            'last_updated': datetime.now(timezone.utc),
            'resource': json.dumps(resource)
        })
        
        resource_db_id = result.scalar()
        
        # Add search parameters
        await self._add_search_parameters(session, resource_db_id, resource)
    
    async def _add_search_parameters(self, session: AsyncSession, resource_id: int, resource: Dict):
        """Add search parameters for imaging study."""
        # Patient reference
        subject_ref = resource.get('subject', {}).get('reference', '')
        if subject_ref.startswith('Patient/'):
            patient_id = subject_ref.split('/')[-1]
            await self._add_search_param(session, resource_id, 'patient', 'reference', value_reference=patient_id)
            await self._add_search_param(session, resource_id, 'subject', 'reference', value_string=subject_ref)
        
        # Status
        if resource.get('status'):
            await self._add_search_param(session, resource_id, 'status', 'token', value_string=resource['status'])
        
        # Modality
        modalities = resource.get('modality', [])
        for modality in modalities:
            if modality.get('code'):
                await self._add_search_param(session, resource_id, 'modality', 'token', value_string=modality['code'])
        
        # Started date
        if resource.get('started'):
            try:
                date_val = datetime.fromisoformat(resource['started'].replace('Z', '+00:00')).date()
                await self._add_search_param(session, resource_id, 'started', 'date', value_date=date_val)
            except:
                pass
    
    async def _add_search_param(self, session: AsyncSession, resource_id: int, param_name: str, param_type: str, **values):
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
    
    async def generate_dicom_files(self) -> Dict[str, Any]:
        """Generate DICOM files for imaging studies using the demo generator."""
        logger.info("🖼️  Generating DICOM files for imaging studies...")
        
        try:
            # Use the existing demo DICOM generator
            import subprocess
            import sys
            
            script_path = Path(__file__).parent / "generate_demo_dicoms.py"
            
            if not script_path.exists():
                return {'error': 'DICOM generator script not found'}
            
            # Run the DICOM generator
            result = subprocess.run([
                sys.executable, str(script_path)
            ], capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                return {
                    'success': True,
                    'message': 'DICOM files generated successfully',
                    'output': result.stdout
                }
            else:
                return {
                    'error': f'DICOM generation failed: {result.stderr}',
                    'output': result.stdout
                }
                
        except subprocess.TimeoutExpired:
            return {'error': 'DICOM generation timed out'}
        except Exception as e:
            return {'error': f'DICOM generation failed: {e}'}
    
    async def test_fhir_endpoints(self) -> Dict[str, Any]:
        """Test FHIR endpoints for imaging studies."""
        logger.info("🧪 Testing FHIR endpoints...")
        
        try:
            # Test basic ImagingStudy endpoint
            response = requests.get(f"{self.base_url}/fhir/R4/ImagingStudy", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                entries = data.get('entry', [])
                
                return {
                    'success': True,
                    'endpoint_status': response.status_code,
                    'total_studies': data.get('total', 0),
                    'returned_studies': len(entries),
                    'sample_study_ids': [entry['resource'].get('id') for entry in entries[:3]]
                }
            else:
                return {
                    'error': f'FHIR endpoint returned {response.status_code}',
                    'response': response.text[:500]
                }
                
        except requests.RequestException as e:
            return {'error': f'Failed to connect to FHIR endpoint: {e}'}
    
    async def full_workflow(self, patient_count: int = 5) -> Dict[str, Any]:
        """Run the complete imaging enhancement workflow."""
        logger.info("🚀 Starting full imaging enhancement workflow...")
        
        workflow_results = {}
        
        # Step 1: Investigate current state
        investigation = await self.investigate_current_state()
        workflow_results['investigation'] = investigation
        
        # Step 2: Create imaging studies if needed
        if investigation.get('imaging_studies', {}).get('count', 0) < patient_count:
            creation_result = await self.create_imaging_studies_for_patients(patient_count)
            workflow_results['creation'] = creation_result
        
        # Step 3: Generate DICOM files
        dicom_result = await self.generate_dicom_files()
        workflow_results['dicom_generation'] = dicom_result
        
        # Step 4: Test endpoints
        endpoint_test = await self.test_fhir_endpoints()
        workflow_results['endpoint_test'] = endpoint_test
        
        return workflow_results
    
    async def cleanup(self):
        """Cleanup resources."""
        if self.engine:
            await self.engine.dispose()

async def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Enhanced Imaging Study Import and Integration",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "command",
        choices=["investigate", "import", "generate-dicoms", "test-endpoints", "full-workflow"],
        help="Operation to perform"
    )
    
    parser.add_argument(
        "--patient-count", type=int, default=10,
        help="Number of patients to process (default: 10)"
    )
    
    args = parser.parse_args()
    
    enhancer = ImagingStudyEnhancer()
    
    try:
        if args.command == "investigate":
            result = await enhancer.investigate_current_state()
            enhancer.print_investigation_report(result)
        
        elif args.command == "import":
            result = await enhancer.create_imaging_studies_for_patients(args.patient_count)
            if result.get('success'):
                print(f"✅ Created {result['studies_created']} imaging studies for {result['patients_processed']} patients")
                for study in result['studies'][:5]:  # Show first 5
                    print(f"  - {study['type']}: {study['description']}")
            else:
                print(f"❌ Failed: {result.get('error')}")
        
        elif args.command == "generate-dicoms":
            result = await enhancer.generate_dicom_files()
            if result.get('success'):
                print("✅ DICOM files generated successfully")
                print(result.get('output', ''))
            else:
                print(f"❌ Failed: {result.get('error')}")
        
        elif args.command == "test-endpoints":
            result = await enhancer.test_fhir_endpoints()
            if result.get('success'):
                print(f"✅ FHIR endpoints working - {result['total_studies']} studies available")
            else:
                print(f"❌ Endpoint test failed: {result.get('error')}")
        
        elif args.command == "full-workflow":
            results = await enhancer.full_workflow(args.patient_count)
            
            print("📊 Full Workflow Results:")
            print("="*50)
            
            for step, result in results.items():
                if result.get('success') or (step == 'investigation' and 'error' not in result):
                    print(f"✅ {step.replace('_', ' ').title()}: Success")
                else:
                    print(f"❌ {step.replace('_', ' ').title()}: {result.get('error', 'Failed')}")
    
    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        await enhancer.cleanup()

if __name__ == "__main__":
    asyncio.run(main())