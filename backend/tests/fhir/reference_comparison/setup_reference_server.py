#!/usr/bin/env python3
"""
Setup script for reference FHIR server with test data

This script:
1. Starts a reference FHIR implementation (HAPI FHIR)
2. Loads the same test data as our server
3. Prepares for comparison testing
"""

import asyncio
import aiohttp
import json
import time
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from tests.fhir.test_data_factory import FHIRTestDataFactory, ReferenceFormat


class ReferenceServerSetup:
    """Setup reference FHIR server for testing"""
    
    def __init__(self, reference_url: str = "http://localhost:8080/fhir"):
        self.reference_url = reference_url.rstrip('/')
        self.session = None
        self.factory = FHIRTestDataFactory()
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def start_reference_server(self):
        """Start the reference FHIR server using Docker Compose"""
        compose_file = Path(__file__).parent / "docker-compose.reference.yml"
        
        print("Starting reference FHIR server...")
        subprocess.run([
            "docker-compose", "-f", str(compose_file), "up", "-d"
        ], check=True)
        
        # Wait for server to be ready
        print("Waiting for server to be ready...")
        self._wait_for_server()
        
    def _wait_for_server(self, max_attempts: int = 30):
        """Wait for the reference server to be ready"""
        import requests
        
        for attempt in range(max_attempts):
            try:
                response = requests.get(f"{self.reference_url}/metadata")
                if response.status_code == 200:
                    print("Reference server is ready!")
                    return
            except:
                pass
            
            print(f"Waiting for server... (attempt {attempt + 1}/{max_attempts})")
            time.sleep(2)
        
        raise RuntimeError("Reference server failed to start")
    
    async def create_resource(self, resource: Dict[str, Any]) -> Optional[str]:
        """Create a resource on the reference server"""
        resource_type = resource['resourceType']
        
        try:
            async with self.session.post(
                f"{self.reference_url}/{resource_type}",
                json=resource,
                headers={'Content-Type': 'application/fhir+json'}
            ) as resp:
                if resp.status == 201:
                    created = await resp.json()
                    return created.get('id')
                else:
                    error_text = await resp.text()
                    print(f"Failed to create {resource_type}: {resp.status} - {error_text}")
                    return None
        except Exception as e:
            print(f"Error creating resource: {e}")
            return None
    
    async def load_test_dataset(self):
        """Load a comprehensive test dataset into the reference server"""
        print("Loading test dataset into reference server...")
        
        # Generate test data
        dataset = self.factory.generate_comprehensive_dataset(
            num_patients=5,
            observations_per_patient=3,
            medications_per_patient=2,
            encounters_per_patient=2
        )
        
        # Track created resources
        created_count = 0
        failed_count = 0
        
        # Create resources in dependency order
        resource_order = [
            'Organization',
            'Practitioner', 
            'Location',
            'Medication',
            'Patient',
            'Encounter',
            'Condition',
            'MedicationRequest',
            'Observation',
            'DiagnosticReport',
            'DocumentReference'
        ]
        
        for resource_type in resource_order:
            if resource_type in dataset.resources:
                print(f"\nCreating {resource_type} resources...")
                resources = dataset.resources[resource_type]
                
                for resource_id, resource in resources.items():
                    # Convert resource references if needed
                    resource = self._convert_references(resource, dataset)
                    
                    result = await self.create_resource(resource)
                    if result:
                        created_count += 1
                        print(f"  Created {resource_type}/{result}")
                    else:
                        failed_count += 1
                        print(f"  Failed to create {resource_type}")
        
        print(f"\nDataset loaded: {created_count} created, {failed_count} failed")
        return created_count > 0
    
    def _convert_references(self, resource: Dict[str, Any], dataset: Any) -> Dict[str, Any]:
        """Convert internal references to FHIR references"""
        # Deep copy to avoid modifying original
        import copy
        resource = copy.deepcopy(resource)
        
        # Convert references in common fields
        reference_fields = [
            'subject', 'patient', 'encounter', 'requester', 'performer',
            'author', 'recorder', 'asserter', 'serviceProvider',
            'generalPractitioner', 'managingOrganization', 'partOf',
            'medication', 'medicationReference', 'basedOn', 'encounter',
            'supportingInformation'
        ]
        
        for field in reference_fields:
            if field in resource:
                if isinstance(resource[field], dict) and 'reference' in resource[field]:
                    # Already a proper reference
                    pass
                elif isinstance(resource[field], list):
                    # Handle array of references
                    for i, item in enumerate(resource[field]):
                        if isinstance(item, dict) and 'reference' in item:
                            # Already a proper reference
                            pass
        
        return resource
    
    async def load_synthea_bundle(self, bundle_file: Path):
        """Load a Synthea bundle into the reference server"""
        print(f"Loading Synthea bundle: {bundle_file}")
        
        with open(bundle_file, 'r') as f:
            bundle = json.load(f)
        
        if bundle.get('resourceType') != 'Bundle':
            print("Error: Not a valid FHIR Bundle")
            return False
        
        # Post the bundle as a transaction
        try:
            async with self.session.post(
                self.reference_url,
                json=bundle,
                headers={'Content-Type': 'application/fhir+json'}
            ) as resp:
                if resp.status in [200, 201]:
                    result = await resp.json()
                    print(f"Successfully loaded bundle with {len(bundle.get('entry', []))} resources")
                    return True
                else:
                    error_text = await resp.text()
                    print(f"Failed to load bundle: {resp.status} - {error_text}")
                    return False
        except Exception as e:
            print(f"Error loading bundle: {e}")
            return False
    
    def stop_reference_server(self):
        """Stop the reference server"""
        compose_file = Path(__file__).parent / "docker-compose.reference.yml"
        
        print("Stopping reference server...")
        subprocess.run([
            "docker-compose", "-f", str(compose_file), "down"
        ], check=True)


async def main():
    """Main setup function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Setup reference FHIR server')
    parser.add_argument('--start', action='store_true', help='Start reference server')
    parser.add_argument('--stop', action='store_true', help='Stop reference server')
    parser.add_argument('--load-data', action='store_true', help='Load test data')
    parser.add_argument('--synthea-bundle', help='Load Synthea bundle file')
    parser.add_argument('--server-url', default='http://localhost:8080/fhir',
                       help='Reference server URL')
    
    args = parser.parse_args()
    
    setup = ReferenceServerSetup(args.server_url)
    
    if args.stop:
        setup.stop_reference_server()
        return
    
    if args.start:
        setup.start_reference_server()
    
    async with setup:
        if args.load_data:
            await setup.load_test_dataset()
        
        if args.synthea_bundle:
            bundle_path = Path(args.synthea_bundle)
            if bundle_path.exists():
                await setup.load_synthea_bundle(bundle_path)
            else:
                print(f"Bundle file not found: {args.synthea_bundle}")


if __name__ == "__main__":
    asyncio.run(main())