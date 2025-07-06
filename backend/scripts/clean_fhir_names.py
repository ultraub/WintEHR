#!/usr/bin/env python3
"""
Clean FHIR Names Script

Removes numeric suffixes from patient and provider names in FHIR resources.
Updates Patient, Practitioner, and RelatedPerson resources to have clean names.

Example transformations:
- "Chrissy459" → "Chrissy"
- "Gabriel934" → "Gabriel"
- "Reilly981" → "Reilly"
"""

import asyncio
import json
import re
import sys
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from database import DATABASE_URL


class FHIRNameCleaner:
    """Cleans numeric suffixes from FHIR resource names."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.stats = {
            'patients_processed': 0,
            'patients_updated': 0,
            'practitioners_processed': 0,
            'practitioners_updated': 0,
            'related_persons_processed': 0,
            'related_persons_updated': 0,
            'errors': []
        }
    
    def clean_name_string(self, name: str) -> str:
        """Remove numeric suffixes from a name string."""
        if not name:
            return name
        
        # Remove trailing digits (e.g., "Chrissy459" → "Chrissy")
        cleaned = re.sub(r'\d+$', '', name)
        return cleaned.strip()
    
    def clean_human_name(self, name_obj: Dict) -> Tuple[Dict, bool]:
        """Clean a FHIR HumanName object."""
        if not isinstance(name_obj, dict):
            return name_obj, False
        
        modified = False
        cleaned_name = name_obj.copy()
        
        # Clean family name
        if 'family' in cleaned_name and cleaned_name['family']:
            new_family = self.clean_name_string(cleaned_name['family'])
            if new_family != cleaned_name['family']:
                cleaned_name['family'] = new_family
                modified = True
        
        # Clean given names (array)
        if 'given' in cleaned_name and isinstance(cleaned_name['given'], list):
            new_given = []
            for given_name in cleaned_name['given']:
                new_name = self.clean_name_string(given_name)
                new_given.append(new_name)
                if new_name != given_name:
                    modified = True
            cleaned_name['given'] = new_given
        
        # Update text/display if present
        if modified and 'text' in cleaned_name:
            # Reconstruct display text
            parts = []
            if 'prefix' in cleaned_name and cleaned_name['prefix']:
                parts.extend(cleaned_name['prefix'])
            if 'given' in cleaned_name and cleaned_name['given']:
                parts.extend(cleaned_name['given'])
            if 'family' in cleaned_name and cleaned_name['family']:
                parts.append(cleaned_name['family'])
            if 'suffix' in cleaned_name and cleaned_name['suffix']:
                parts.extend(cleaned_name['suffix'])
            
            cleaned_name['text'] = ' '.join(parts)
        
        return cleaned_name, modified
    
    async def clean_patient_resource(self, resource_id: str, resource_data: Dict) -> Optional[Dict]:
        """Clean names in a Patient resource."""
        if 'name' not in resource_data or not resource_data['name']:
            return None
        
        modified = False
        updated_resource = resource_data.copy()
        
        # Clean all name entries
        cleaned_names = []
        for name in resource_data['name']:
            cleaned_name, was_modified = self.clean_human_name(name)
            cleaned_names.append(cleaned_name)
            if was_modified:
                modified = True
        
        if modified:
            updated_resource['name'] = cleaned_names
            
            # Update meta.lastUpdated
            if 'meta' not in updated_resource:
                updated_resource['meta'] = {}
            updated_resource['meta']['lastUpdated'] = datetime.now(timezone.utc).isoformat()
            
            # Increment version
            if 'versionId' in updated_resource['meta']:
                try:
                    current_version = int(updated_resource['meta']['versionId'])
                    updated_resource['meta']['versionId'] = str(current_version + 1)
                except ValueError:
                    updated_resource['meta']['versionId'] = "2"
            else:
                updated_resource['meta']['versionId'] = "2"
            
            return updated_resource
        
        return None
    
    async def clean_practitioner_resource(self, resource_id: str, resource_data: Dict) -> Optional[Dict]:
        """Clean names in a Practitioner resource."""
        return await self.clean_patient_resource(resource_id, resource_data)  # Same logic
    
    async def clean_related_person_resource(self, resource_id: str, resource_data: Dict) -> Optional[Dict]:
        """Clean names in a RelatedPerson resource."""
        return await self.clean_patient_resource(resource_id, resource_data)  # Same logic
    
    async def process_patients(self, dry_run: bool = False):
        """Process all Patient resources."""
        print("\n=== Processing Patient Resources ===")
        
        result = await self.session.execute(
            text("SELECT fhir_id, resource, version_id FROM fhir.resources WHERE resource_type = 'Patient' AND deleted = false")
        )
        patients = result.fetchall()
        
        for fhir_id, resource_data, version_id in patients:
            self.stats['patients_processed'] += 1
            
            try:
                # Clean the resource
                updated_resource = await self.clean_patient_resource(fhir_id, resource_data)
                
                if updated_resource:
                    # Extract names for logging
                    old_names = []
                    new_names = []
                    
                    for old_name in resource_data.get('name', []):
                        old_parts = []
                        if 'given' in old_name:
                            old_parts.extend(old_name['given'])
                        if 'family' in old_name:
                            old_parts.append(old_name['family'])
                        old_names.append(' '.join(old_parts))
                    
                    for new_name in updated_resource.get('name', []):
                        new_parts = []
                        if 'given' in new_name:
                            new_parts.extend(new_name['given'])
                        if 'family' in new_name:
                            new_parts.append(new_name['family'])
                        new_names.append(' '.join(new_parts))
                    
                    print(f"  Patient {fhir_id}: {' | '.join(old_names)} → {' | '.join(new_names)}")
                    
                    if not dry_run:
                        # Update the resource
                        new_version = version_id + 1
                        await self.session.execute(
                            text("""
                                UPDATE fhir.resources 
                                SET resource = :resource,
                                    version_id = :version_id,
                                    last_updated = CURRENT_TIMESTAMP
                                WHERE fhir_id = :fhir_id 
                                AND resource_type = 'Patient'
                            """),
                            {
                                "resource": json.dumps(updated_resource),
                                "version_id": new_version,
                                "fhir_id": fhir_id
                            }
                        )
                        self.stats['patients_updated'] += 1
                        
            except Exception as e:
                error_msg = f"Error processing patient {fhir_id}: {str(e)}"
                print(f"  ERROR: {error_msg}")
                self.stats['errors'].append(error_msg)
    
    async def process_practitioners(self, dry_run: bool = False):
        """Process all Practitioner resources."""
        print("\n=== Processing Practitioner Resources ===")
        
        result = await self.session.execute(
            text("SELECT fhir_id, resource, version_id FROM fhir.resources WHERE resource_type = 'Practitioner' AND deleted = false")
        )
        practitioners = result.fetchall()
        
        for fhir_id, resource_data, version_id in practitioners:
            self.stats['practitioners_processed'] += 1
            
            try:
                # Clean the resource
                updated_resource = await self.clean_practitioner_resource(fhir_id, resource_data)
                
                if updated_resource:
                    # Extract names for logging
                    old_names = []
                    new_names = []
                    
                    for old_name in resource_data.get('name', []):
                        old_parts = []
                        if 'prefix' in old_name:
                            old_parts.extend(old_name['prefix'])
                        if 'given' in old_name:
                            old_parts.extend(old_name['given'])
                        if 'family' in old_name:
                            old_parts.append(old_name['family'])
                        old_names.append(' '.join(old_parts))
                    
                    for new_name in updated_resource.get('name', []):
                        new_parts = []
                        if 'prefix' in new_name:
                            new_parts.extend(new_name['prefix'])
                        if 'given' in new_name:
                            new_parts.extend(new_name['given'])
                        if 'family' in new_name:
                            new_parts.append(new_name['family'])
                        new_names.append(' '.join(new_parts))
                    
                    print(f"  Practitioner {fhir_id}: {' | '.join(old_names)} → {' | '.join(new_names)}")
                    
                    if not dry_run:
                        # Update the resource
                        new_version = version_id + 1
                        await self.session.execute(
                            text("""
                                UPDATE fhir.resources 
                                SET resource = :resource,
                                    version_id = :version_id,
                                    last_updated = CURRENT_TIMESTAMP
                                WHERE fhir_id = :fhir_id 
                                AND resource_type = 'Practitioner'
                            """),
                            {
                                "resource": json.dumps(updated_resource),
                                "version_id": new_version,
                                "fhir_id": fhir_id
                            }
                        )
                        self.stats['practitioners_updated'] += 1
                        
            except Exception as e:
                error_msg = f"Error processing practitioner {fhir_id}: {str(e)}"
                print(f"  ERROR: {error_msg}")
                self.stats['errors'].append(error_msg)
    
    async def process_related_persons(self, dry_run: bool = False):
        """Process all RelatedPerson resources."""
        print("\n=== Processing RelatedPerson Resources ===")
        
        result = await self.session.execute(
            text("SELECT fhir_id, resource, version_id FROM fhir.resources WHERE resource_type = 'RelatedPerson' AND deleted = false")
        )
        related_persons = result.fetchall()
        
        for fhir_id, resource_data, version_id in related_persons:
            self.stats['related_persons_processed'] += 1
            
            try:
                # Clean the resource
                updated_resource = await self.clean_related_person_resource(fhir_id, resource_data)
                
                if updated_resource:
                    # Extract names for logging
                    old_names = []
                    new_names = []
                    
                    for old_name in resource_data.get('name', []):
                        old_parts = []
                        if 'given' in old_name:
                            old_parts.extend(old_name['given'])
                        if 'family' in old_name:
                            old_parts.append(old_name['family'])
                        old_names.append(' '.join(old_parts))
                    
                    for new_name in updated_resource.get('name', []):
                        new_parts = []
                        if 'given' in new_name:
                            new_parts.extend(new_name['given'])
                        if 'family' in new_name:
                            new_parts.append(new_name['family'])
                        new_names.append(' '.join(new_parts))
                    
                    print(f"  RelatedPerson {fhir_id}: {' | '.join(old_names)} → {' | '.join(new_names)}")
                    
                    if not dry_run:
                        # Update the resource
                        new_version = version_id + 1
                        await self.session.execute(
                            text("""
                                UPDATE fhir.resources 
                                SET resource = :resource,
                                    version_id = :version_id,
                                    last_updated = CURRENT_TIMESTAMP
                                WHERE fhir_id = :fhir_id 
                                AND resource_type = 'RelatedPerson'
                            """),
                            {
                                "resource": json.dumps(updated_resource),
                                "version_id": new_version,
                                "fhir_id": fhir_id
                            }
                        )
                        self.stats['related_persons_updated'] += 1
                        
            except Exception as e:
                error_msg = f"Error processing related person {fhir_id}: {str(e)}"
                print(f"  ERROR: {error_msg}")
                self.stats['errors'].append(error_msg)
    
    async def run(self, dry_run: bool = False):
        """Run the complete cleaning process."""
        print("FHIR Name Cleaning Script")
        print("=" * 50)
        print(f"Mode: {'DRY RUN' if dry_run else 'LIVE UPDATE'}")
        print()
        
        try:
            # Process each resource type
            await self.process_patients(dry_run)
            await self.process_practitioners(dry_run)
            await self.process_related_persons(dry_run)
            
            if not dry_run:
                await self.session.commit()
                
            # Print summary
            print("\n" + "=" * 50)
            print("SUMMARY")
            print("=" * 50)
            print(f"Patients processed: {self.stats['patients_processed']}")
            print(f"Patients updated: {self.stats['patients_updated']}")
            print(f"Practitioners processed: {self.stats['practitioners_processed']}")
            print(f"Practitioners updated: {self.stats['practitioners_updated']}")
            print(f"RelatedPersons processed: {self.stats['related_persons_processed']}")
            print(f"RelatedPersons updated: {self.stats['related_persons_updated']}")
            
            if self.stats['errors']:
                print(f"\nErrors encountered: {len(self.stats['errors'])}")
                for error in self.stats['errors'][:5]:  # Show first 5 errors
                    print(f"  - {error}")
                if len(self.stats['errors']) > 5:
                    print(f"  ... and {len(self.stats['errors']) - 5} more errors")
            
            if dry_run:
                print("\nThis was a DRY RUN. No changes were made.")
                print("Run without --dry-run to apply changes.")
            else:
                print("\nAll changes have been committed to the database.")
                
        except Exception as e:
            print(f"\nFATAL ERROR: {str(e)}")
            if not dry_run:
                await self.session.rollback()
            raise


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Clean numeric suffixes from FHIR resource names')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without updating database')
    args = parser.parse_args()
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        cleaner = FHIRNameCleaner(session)
        await cleaner.run(dry_run=args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())