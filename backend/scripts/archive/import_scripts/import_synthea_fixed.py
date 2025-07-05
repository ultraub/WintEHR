#!/usr/bin/env python3
"""
Import Synthea FHIR bundles with proper transformation and validation handling
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
from core.fhir.storage import FHIRStorageEngine
from core.fhir.profile_transformer import ProfileAwareFHIRTransformer


class ImprovedSyntheaImporter:
    """Improved Synthea importer that handles validation properly."""
    
    def __init__(self):
        self.transformer = ProfileAwareFHIRTransformer()
        self.engine = None
        self.stats = {
            'total_processed': 0,
            'total_imported': 0,
            'total_failed': 0,
            'errors_by_type': {}
        }
    
    async def init_db(self):
        """Initialize database connection."""
        self.engine = create_async_engine(DATABASE_URL)
    
    async def close_db(self):
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()
    
    async def import_bundle_file(self, file_path: str):
        """Import a single FHIR bundle file."""
        print(f"\n📄 Processing: {Path(file_path).name}")
        
        with open(file_path, 'r') as f:
            bundle_data = json.load(f)
        
        if bundle_data.get('resourceType') != 'Bundle':
            print(f"  ❌ Not a Bundle resource")
            return
        
        entries = bundle_data.get('entry', [])
        print(f"  📦 Found {len(entries)} resources in bundle")
        
        async with AsyncSession(self.engine) as session:
            storage = FHIRStorageEngine(session)
            
            # Process each entry
            for entry in entries:
                resource = entry.get('resource', {})
                resource_type = resource.get('resourceType')
                resource_id = resource.get('id')
                
                if not resource_type:
                    continue
                
                self.stats['total_processed'] += 1
                
                try:
                    # Transform the resource
                    transformed = self.transformer.transform_resource(resource)
                    
                    # For now, store the transformed resource as JSONB without strict validation
                    # This allows us to import the data and fix validation issues incrementally
                    await self._store_resource_directly(
                        session, 
                        resource_type, 
                        resource_id, 
                        transformed
                    )
                    
                    self.stats['total_imported'] += 1
                    print(f"    ✅ {resource_type}/{resource_id}")
                    
                except Exception as e:
                    self.stats['total_failed'] += 1
                    error_key = f"{resource_type}: {type(e).__name__}"
                    self.stats['errors_by_type'][error_key] = \
                        self.stats['errors_by_type'].get(error_key, 0) + 1
                    print(f"    ❌ {resource_type}/{resource_id}: {str(e)[:100]}")
            
            await session.commit()
    
    async def _store_resource_directly(self, session, resource_type, resource_id, resource_data):
        """Store resource directly in FHIR storage without strict validation."""
        # Ensure resource has required metadata
        if 'id' not in resource_data:
            resource_data['id'] = resource_id
        
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
        
        resource_id = result.scalar()
        
        # Extract basic search parameters
        await self._extract_basic_search_params(session, resource_id, resource_type, resource_data)
    
    async def _extract_basic_search_params(self, session, resource_id, resource_type, resource_data):
        """Extract basic search parameters for the resource."""
        # Always index the resource ID
        await self._add_search_param(
            session, resource_id, '_id', 'token', 
            value_string=resource_data.get('id')
        )
        
        # Extract common search parameters based on resource type
        if resource_type == 'Patient':
            # Name
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
                await self._add_search_param(
                    session, resource_id, 'birthdate', 'date',
                    value_date=resource_data['birthDate']
                )
        
        elif resource_type == 'Encounter':
            # Patient reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                if ref.startswith('Patient/'):
                    patient_id = ref.split('/')[-1]
                    await self._add_search_param(
                        session, resource_id, 'patient', 'reference',
                        value_reference=patient_id
                    )
        
        elif resource_type == 'Observation':
            # Patient reference
            if 'subject' in resource_data and 'reference' in resource_data['subject']:
                ref = resource_data['subject']['reference']
                if ref.startswith('Patient/'):
                    patient_id = ref.split('/')[-1]
                    await self._add_search_param(
                        session, resource_id, 'patient', 'reference',
                        value_reference=patient_id
                    )
            
            # Code
            if 'code' in resource_data and 'coding' in resource_data['code']:
                for coding in resource_data['code']['coding']:
                    if 'code' in coding:
                        await self._add_search_param(
                            session, resource_id, 'code', 'token',
                            value_token_system=coding.get('system'),
                            value_token_code=coding['code']
                        )
    
    async def _add_search_param(self, session, resource_id, param_name, param_type, 
                               value_string=None, value_number=None, value_date=None,
                               value_token_system=None, value_token_code=None,
                               value_reference=None):
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
        """)
        
        await session.execute(query, {
            'resource_id': resource_id,
            'param_name': param_name,
            'param_type': param_type,
            'value_string': value_string,
            'value_number': value_number,
            'value_date': value_date,
            'value_token_system': value_token_system,
            'value_token_code': value_token_code,
            'value_reference': value_reference
        })
    
    def print_summary(self):
        """Print import summary."""
        print("\n" + "="*60)
        print("📊 Import Summary")
        print("="*60)
        print(f"Total Resources Processed: {self.stats['total_processed']}")
        print(f"Successfully Imported: {self.stats['total_imported']}")
        print(f"Failed: {self.stats['total_failed']}")
        
        if self.stats['errors_by_type']:
            print("\n❌ Errors by Type:")
            for error_type, count in sorted(self.stats['errors_by_type'].items()):
                print(f"  {error_type}: {count}")
        
        print("="*60)


async def main():
    """Main entry point."""
    # Find FHIR files
    synthea_output_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    
    # Import files in order: support files first, then patient bundles
    files_to_import = [
        "practitionerInformation1751693434580.json",
        "hospitalInformation1751693434580.json",
        "Chrissy459_Ignacia942_Yost751_40cde260-e3f1-9cb5-266a-faa553126d9a.json",
        "Dustin31_Bradtke547_553b82ff-f57c-2cd1-4af3-a625205e996b.json",
        "Jc393_Gutmann970_00903ceb-1b90-b9a6-b683-a53911e928a6.json",
        "Jim478_Ruecker817_19de6e54-54dd-472a-ec69-b70b2462753b.json",
        "Latoya8_Stehr398_37c94163-eb8b-2a98-e02a-60c8ac40a42f.json",
        "María_Eugenia578_Almaraz628_32ee7c1f-aaba-03ce-4d1e-9d207d70102b.json",
        "Marshall526_Corkery305_8cf4ce9c-5077-9317-29c2-1647b3c4e3a7.json",
        "Tyree261_Fahey393_b8e87dbf-d2a2-b556-2d78-8a9158c677c5.json",
        "Weston546_Keeling57_d39c8ef8-83af-abf5-056b-a090da6156a9.json",
        "Yan646_Goyette777_e7f260d9-70cf-b216-3bc7-da24e33b7be9.json"
    ]
    
    print("🚀 Starting Synthea FHIR Import")
    print(f"📁 Source directory: {synthea_output_dir}")
    
    importer = ImprovedSyntheaImporter()
    await importer.init_db()
    
    try:
        for filename in files_to_import:
            file_path = synthea_output_dir / filename
            if file_path.exists():
                await importer.import_bundle_file(str(file_path))
            else:
                print(f"\n⚠️  File not found: {filename}")
        
        importer.print_summary()
        
    finally:
        await importer.close_db()


if __name__ == "__main__":
    asyncio.run(main())