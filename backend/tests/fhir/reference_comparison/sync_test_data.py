#!/usr/bin/env python3
"""
Synchronize test data between our FHIR server and reference implementation

Ensures both servers have identical data for accurate comparison testing.
"""

import asyncio
import aiohttp
import json
import logging
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FHIRDataSynchronizer:
    """Synchronize FHIR data between servers"""
    
    def __init__(self, source_server: str, target_server: str):
        self.source_server = source_server.rstrip('/')
        self.target_server = target_server.rstrip('/')
        self.session = None
        self.resource_map = {}  # Map source IDs to target IDs
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def get_all_resources(self, server: str, resource_type: str) -> List[Dict[str, Any]]:
        """Get all resources of a type from a server"""
        resources = []
        next_url = f"{server}/{resource_type}?_count=100"
        
        while next_url:
            try:
                async with self.session.get(next_url) as resp:
                    if resp.status == 200:
                        bundle = await resp.json()
                        
                        # Extract resources
                        for entry in bundle.get('entry', []):
                            if 'resource' in entry:
                                resources.append(entry['resource'])
                        
                        # Find next link
                        next_url = None
                        for link in bundle.get('link', []):
                            if link.get('relation') == 'next':
                                next_url = link.get('url')
                                # Make URL absolute if relative
                                if next_url and not next_url.startswith('http'):
                                    next_url = f"{server}{next_url}"
                                break
                    else:
                        logger.error(f"Failed to get {resource_type} from {server}: {resp.status}")
                        break
            except Exception as e:
                logger.error(f"Error getting resources: {e}")
                break
        
        return resources
    
    async def create_resource(self, server: str, resource: Dict[str, Any]) -> Optional[str]:
        """Create a resource on a server"""
        resource_type = resource['resourceType']
        
        # Remove server-specific metadata
        cleaned = self._clean_resource_for_sync(resource)
        
        try:
            async with self.session.post(
                f"{server}/{resource_type}",
                json=cleaned,
                headers={'Content-Type': 'application/fhir+json'}
            ) as resp:
                if resp.status == 201:
                    created = await resp.json()
                    return created.get('id')
                else:
                    error_text = await resp.text()
                    logger.error(f"Failed to create {resource_type}: {resp.status} - {error_text}")
                    return None
        except Exception as e:
            logger.error(f"Error creating resource: {e}")
            return None
    
    def _clean_resource_for_sync(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a resource for synchronization"""
        import copy
        cleaned = copy.deepcopy(resource)
        
        # Remove server-specific fields
        cleaned.pop('id', None)  # Will get new ID on target
        
        if 'meta' in cleaned:
            cleaned['meta'].pop('versionId', None)
            cleaned['meta'].pop('lastUpdated', None)
            cleaned['meta'].pop('source', None)
        
        # Update references to use mapped IDs
        self._update_references(cleaned)
        
        return cleaned
    
    def _update_references(self, resource: Dict[str, Any]):
        """Update references in a resource to use mapped IDs"""
        # Common reference fields
        reference_fields = [
            'subject', 'patient', 'encounter', 'requester', 'performer',
            'author', 'recorder', 'asserter', 'serviceProvider',
            'generalPractitioner', 'managingOrganization', 'partOf',
            'medication', 'medicationReference', 'basedOn',
            'supportingInformation', 'reasonReference'
        ]
        
        for field in reference_fields:
            if field in resource:
                if isinstance(resource[field], dict) and 'reference' in resource[field]:
                    resource[field]['reference'] = self._map_reference(resource[field]['reference'])
                elif isinstance(resource[field], list):
                    for item in resource[field]:
                        if isinstance(item, dict) and 'reference' in item:
                            item['reference'] = self._map_reference(item['reference'])
    
    def _map_reference(self, reference: str) -> str:
        """Map a reference from source to target server"""
        if '/' in reference:
            resource_type, resource_id = reference.split('/', 1)
            key = f"{resource_type}/{resource_id}"
            
            if key in self.resource_map:
                return self.resource_map[key]
        
        return reference
    
    async def sync_resource_type(self, resource_type: str) -> Dict[str, int]:
        """Sync all resources of a specific type"""
        logger.info(f"Syncing {resource_type} resources...")
        
        # Get resources from source
        source_resources = await self.get_all_resources(self.source_server, resource_type)
        logger.info(f"Found {len(source_resources)} {resource_type} resources on source")
        
        # Get existing resources from target
        target_resources = await self.get_all_resources(self.target_server, resource_type)
        target_ids = {r.get('id') for r in target_resources}
        logger.info(f"Found {len(target_resources)} {resource_type} resources on target")
        
        # Sync resources
        created = 0
        failed = 0
        
        for resource in source_resources:
            source_id = resource.get('id')
            
            # Create on target
            target_id = await self.create_resource(self.target_server, resource)
            
            if target_id:
                # Map the ID
                self.resource_map[f"{resource_type}/{source_id}"] = f"{resource_type}/{target_id}"
                created += 1
            else:
                failed += 1
        
        logger.info(f"Synced {resource_type}: {created} created, {failed} failed")
        
        return {
            'total': len(source_resources),
            'created': created,
            'failed': failed
        }
    
    async def sync_all_data(self, resource_types: Optional[List[str]] = None):
        """Sync all data between servers"""
        # Default resource types in dependency order
        if resource_types is None:
            resource_types = [
                'Organization',
                'Practitioner',
                'PractitionerRole',
                'Location',
                'HealthcareService',
                'Medication',
                'Substance',
                'Patient',
                'RelatedPerson',
                'Encounter',
                'EpisodeOfCare',
                'Condition',
                'Procedure',
                'MedicationRequest',
                'MedicationDispense',
                'MedicationAdministration',
                'Observation',
                'DiagnosticReport',
                'ImagingStudy',
                'CarePlan',
                'CareTeam',
                'Goal',
                'ServiceRequest',
                'Task',
                'DocumentReference',
                'AllergyIntolerance',
                'Immunization'
            ]
        
        logger.info(f"Starting data sync from {self.source_server} to {self.target_server}")
        
        results = {}
        total_created = 0
        total_failed = 0
        
        for resource_type in resource_types:
            result = await self.sync_resource_type(resource_type)
            results[resource_type] = result
            total_created += result['created']
            total_failed += result['failed']
        
        # Generate summary
        logger.info("\nSync Summary:")
        logger.info(f"Total resources created: {total_created}")
        logger.info(f"Total resources failed: {total_failed}")
        
        for resource_type, result in results.items():
            if result['total'] > 0:
                logger.info(f"  {resource_type}: {result['created']}/{result['total']} synced")
        
        return results
    
    async def verify_sync(self, resource_types: Optional[List[str]] = None) -> Dict[str, Any]:
        """Verify that servers have matching data counts"""
        if resource_types is None:
            resource_types = ['Patient', 'Observation', 'MedicationRequest', 
                            'Practitioner', 'Organization']
        
        verification = {
            'timestamp': datetime.utcnow().isoformat(),
            'source_server': self.source_server,
            'target_server': self.target_server,
            'resource_counts': {},
            'matches': True
        }
        
        for resource_type in resource_types:
            source_count = await self._get_resource_count(self.source_server, resource_type)
            target_count = await self._get_resource_count(self.target_server, resource_type)
            
            verification['resource_counts'][resource_type] = {
                'source': source_count,
                'target': target_count,
                'match': source_count == target_count
            }
            
            if source_count != target_count:
                verification['matches'] = False
        
        return verification
    
    async def _get_resource_count(self, server: str, resource_type: str) -> int:
        """Get count of resources on a server"""
        try:
            async with self.session.get(
                f"{server}/{resource_type}",
                params={'_summary': 'count'}
            ) as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    return bundle.get('total', 0)
                else:
                    return -1
        except Exception:
            return -1


async def main():
    """Main sync function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Sync FHIR data between servers')
    parser.add_argument('--source', default='http://localhost:8000/fhir/R4',
                       help='Source FHIR server URL')
    parser.add_argument('--target', default='http://localhost:8080/fhir',
                       help='Target FHIR server URL')
    parser.add_argument('--verify-only', action='store_true',
                       help='Only verify sync status without syncing')
    parser.add_argument('--resource-types', nargs='+',
                       help='Specific resource types to sync')
    
    args = parser.parse_args()
    
    async with FHIRDataSynchronizer(args.source, args.target) as syncer:
        if args.verify_only:
            # Verify sync status
            verification = await syncer.verify_sync(args.resource_types)
            
            print("\nSync Verification Report")
            print("=" * 50)
            print(f"Source: {verification['source_server']}")
            print(f"Target: {verification['target_server']}")
            print(f"Timestamp: {verification['timestamp']}")
            print(f"Overall Match: {'✓' if verification['matches'] else '✗'}")
            print("\nResource Counts:")
            
            for resource_type, counts in verification['resource_counts'].items():
                match_symbol = '✓' if counts['match'] else '✗'
                print(f"  {resource_type}: {counts['source']} → {counts['target']} {match_symbol}")
        else:
            # Perform sync
            results = await syncer.sync_all_data(args.resource_types)
            
            # Verify after sync
            print("\nVerifying sync...")
            verification = await syncer.verify_sync(args.resource_types)
            
            if verification['matches']:
                print("✓ Sync completed successfully!")
            else:
                print("✗ Sync completed with discrepancies")


if __name__ == "__main__":
    asyncio.run(main())