#!/usr/bin/env python3
"""
Direct Synthea FHIR Importer
Imports Synthea R4 data directly into the database without strict R5 validation.
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
import sys
import uuid

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from database import DATABASE_URL


class DirectSyntheaImporter:
    """Direct importer that bypasses strict validation."""
    
    def __init__(self):
        self.engine = create_async_engine(DATABASE_URL)
        self.async_session = async_sessionmaker(self.engine, class_=AsyncSession)
        self.stats = {
            "files_processed": 0,
            "resources_imported": 0,
            "errors": [],
            "resource_counts": {}
        }
    
    async def import_bundle_file(self, file_path: Path):
        """Import a single bundle file."""
        print(f"📄 Processing: {file_path.name}")
        
        try:
            with open(file_path, 'r') as f:
                bundle = json.load(f)
            
            if bundle.get('resourceType') != 'Bundle':
                print(f"  ⚠️  Not a bundle: {file_path.name}")
                return
            
            # Process each entry
            entries = bundle.get('entry', [])
            imported_count = 0
            
            async with self.async_session() as session:
                # First pass: Import resources without references
                resource_map = {}  # old_id -> new_id
                
                for entry in entries:
                    resource = entry.get('resource')
                    if not resource:
                        continue
                    
                    resource_type = resource.get('resourceType')
                    if not resource_type:
                        continue
                    
                    # Generate or use existing ID
                    old_id = resource.get('id')
                    if old_id:
                        new_id = old_id
                    else:
                        new_id = str(uuid.uuid4())
                    
                    resource['id'] = new_id
                    resource_map[f"{resource_type}/{old_id}"] = f"{resource_type}/{new_id}"
                    
                    # Update references in the resource
                    self._update_references(resource, resource_map)
                    
                    # Store in database
                    try:
                        await self._store_resource(session, resource_type, new_id, resource)
                        imported_count += 1
                        
                        # Update stats
                        self.stats["resource_counts"][resource_type] = \
                            self.stats["resource_counts"].get(resource_type, 0) + 1
                    except Exception as e:
                        self.stats["errors"].append({
                            "file": file_path.name,
                            "resource": f"{resource_type}/{new_id}",
                            "error": str(e)
                        })
                        print(f"  ❌ Error storing {resource_type}/{new_id}: {e}")
                
                await session.commit()
            
            print(f"  ✅ Imported {imported_count} resources")
            self.stats["resources_imported"] += imported_count
            self.stats["files_processed"] += 1
            
        except Exception as e:
            print(f"  ❌ Error processing file: {e}")
            self.stats["errors"].append({
                "file": file_path.name,
                "error": str(e)
            })
    
    async def _store_resource(self, session: AsyncSession, resource_type: str, fhir_id: str, resource: dict):
        """Store a resource directly in the database."""
        now = datetime.now(timezone.utc)
        
        # Check if resource already exists
        check_query = text("""
            SELECT id FROM fhir.resources 
            WHERE resource_type = :resource_type AND fhir_id = :fhir_id
        """)
        
        result = await session.execute(check_query, {
            "resource_type": resource_type,
            "fhir_id": fhir_id
        })
        existing = result.first()
        
        if existing:
            # Update existing resource
            update_query = text("""
                UPDATE fhir.resources 
                SET data = CAST(:data AS jsonb),
                    version_id = version_id + 1,
                    last_updated = :last_updated
                WHERE resource_type = :resource_type AND fhir_id = :fhir_id
            """)
            
            await session.execute(update_query, {
                "resource_type": resource_type,
                "fhir_id": fhir_id,
                "data": json.dumps(resource),
                "last_updated": now
            })
        else:
            # Insert new resource
            insert_query = text("""
                INSERT INTO fhir.resources (resource_type, fhir_id, version_id, data, last_updated, deleted)
                VALUES (:resource_type, :fhir_id, 1, CAST(:data AS jsonb), :last_updated, false)
            """)
            
            await session.execute(insert_query, {
                "resource_type": resource_type,
                "fhir_id": fhir_id,
                "data": json.dumps(resource),
                "last_updated": now
            })
        
        # Extract and index search parameters (simplified)
        await self._index_basic_search_params(session, resource_type, fhir_id, resource)
    
    async def _index_basic_search_params(self, session: AsyncSession, resource_type: str, fhir_id: str, resource: dict):
        """Index basic search parameters for common searches."""
        # Get resource ID
        id_query = text("""
            SELECT id FROM fhir.resources 
            WHERE resource_type = :resource_type AND fhir_id = :fhir_id
        """)
        result = await session.execute(id_query, {"resource_type": resource_type, "fhir_id": fhir_id})
        resource_id = result.scalar()
        
        if not resource_id:
            return
        
        # Clear existing search params
        delete_query = text("""
            DELETE FROM fhir.search_params WHERE resource_id = :resource_id
        """)
        await session.execute(delete_query, {"resource_id": resource_id})
        
        # Index common parameters based on resource type
        search_params = []
        
        if resource_type == "Patient":
            # Index patient name
            for name in resource.get('name', []):
                if name.get('family'):
                    search_params.append({
                        "resource_id": resource_id,
                        "param_name": "family",
                        "value_string": name['family'].lower()
                    })
                for given in name.get('given', []):
                    search_params.append({
                        "resource_id": resource_id,
                        "param_name": "given",
                        "value_string": given.lower()
                    })
            
            # Index birthdate
            if resource.get('birthDate'):
                search_params.append({
                    "resource_id": resource_id,
                    "param_name": "birthdate",
                    "value_date": resource['birthDate']
                })
        
        elif resource_type == "Encounter":
            # Index patient reference
            patient_ref = resource.get('subject', {}).get('reference', '')
            if patient_ref:
                patient_id = patient_ref.split('/')[-1]
                search_params.append({
                    "resource_id": resource_id,
                    "param_name": "patient",
                    "value_reference": patient_id
                })
            
            # Index date/period
            period = resource.get('period', {})
            if period.get('start'):
                search_params.append({
                    "resource_id": resource_id,
                    "param_name": "date",
                    "value_date": period['start'][:10]  # Just date part
                })
        
        elif resource_type == "Observation":
            # Index patient reference
            patient_ref = resource.get('subject', {}).get('reference', '')
            if patient_ref:
                patient_id = patient_ref.split('/')[-1]
                search_params.append({
                    "resource_id": resource_id,
                    "param_name": "patient",
                    "value_reference": patient_id
                })
            
            # Index code
            for coding in resource.get('code', {}).get('coding', []):
                if coding.get('code'):
                    search_params.append({
                        "resource_id": resource_id,
                        "param_name": "code",
                        "value_string": coding['code']
                    })
        
        # Insert search parameters
        if search_params:
            insert_query = text("""
                INSERT INTO fhir.search_params (resource_id, param_name, value_string, value_reference, value_date)
                VALUES (:resource_id, :param_name, :value_string, :value_reference, :value_date)
            """)
            
            for param in search_params:
                await session.execute(insert_query, {
                    "resource_id": param["resource_id"],
                    "param_name": param["param_name"],
                    "value_string": param.get("value_string"),
                    "value_reference": param.get("value_reference"),
                    "value_date": param.get("value_date")
                })
    
    def _update_references(self, resource: dict, resource_map: dict):
        """Update references in a resource."""
        if isinstance(resource, dict):
            for key, value in resource.items():
                if key == "reference" and isinstance(value, str):
                    # Update reference if it's in our map
                    if value in resource_map:
                        resource[key] = resource_map[value]
                    elif value.startswith("urn:uuid:"):
                        # Handle UUID references
                        for old_ref, new_ref in resource_map.items():
                            if value.endswith(old_ref.split("/")[1]):
                                resource[key] = new_ref
                                break
                elif isinstance(value, (dict, list)):
                    self._update_references(value, resource_map)
        elif isinstance(resource, list):
            for item in resource:
                if isinstance(item, (dict, list)):
                    self._update_references(item, resource_map)
    
    async def import_directory(self, directory_path: str):
        """Import all bundle files from a directory."""
        path = Path(directory_path)
        if not path.exists():
            print(f"❌ Directory not found: {directory_path}")
            return
        
        # Find all JSON files
        json_files = list(path.glob("*.json"))
        print(f"📁 Found {len(json_files)} JSON files")
        
        # Sort files to process in order: practitioners, hospitals, then patients
        practitioner_files = [f for f in json_files if 'practitioner' in f.name.lower()]
        hospital_files = [f for f in json_files if 'hospital' in f.name.lower()]
        patient_files = [f for f in json_files if f not in practitioner_files and f not in hospital_files]
        
        # Process in order
        for files, file_type in [(practitioner_files, "practitioner"),
                                 (hospital_files, "hospital"),
                                 (patient_files, "patient")]:
            if files:
                print(f"\n📂 Processing {file_type} files...")
                for file_path in files:
                    await self.import_bundle_file(file_path)
        
        # Print summary
        print("\n📊 Import Summary:")
        print(f"  Files processed: {self.stats['files_processed']}")
        print(f"  Resources imported: {self.stats['resources_imported']}")
        print("\n  Resource counts:")
        for resource_type, count in sorted(self.stats['resource_counts'].items()):
            print(f"    {resource_type}: {count}")
        
        if self.stats['errors']:
            print(f"\n  ⚠️  Errors: {len(self.stats['errors'])}")
            for error in self.stats['errors'][:5]:
                print(f"    - {error}")


async def main():
    """Main entry point."""
    importer = DirectSyntheaImporter()
    
    # Import from synthea output directory
    synthea_dir = "../synthea/output/fhir"
    
    print("🚀 Starting direct Synthea import...")
    print("  This bypasses strict R5 validation to import R4 data")
    
    await importer.import_directory(synthea_dir)
    
    # Close database connection
    await importer.engine.dispose()
    
    print("\n✅ Import complete!")


if __name__ == "__main__":
    asyncio.run(main())