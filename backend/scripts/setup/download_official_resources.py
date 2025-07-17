#!/usr/bin/env python3
"""
Download Official FHIR Resources
Automatically downloads official FHIR resource examples across R4, R5, and R6
"""

import asyncio
import aiohttp
import json
import logging
from pathlib import Path
from typing import Dict, List, Set
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FHIRResourceDownloader:
    """Downloads official FHIR resource examples from HL7"""
    
    def __init__(self, base_dir: str = "backend/core/fhir/official_resources"):
        self.base_dir = Path(base_dir)
        self.session = None
        
        # FHIR version configurations
        self.versions = {
            'r4': {
                'base_url': 'https://hl7.org/fhir/R4',
                'name': 'FHIR R4',
                'status': 'Current Published'
            },
            'r5': {
                'base_url': 'https://hl7.org/fhir/R5',
                'name': 'FHIR R5', 
                'status': 'Current Published'
            },
            'r6': {
                'base_url': 'https://build.fhir.org',
                'name': 'FHIR R6',
                'status': 'Current Ballot'
            }
        }
        
        # Core EMR resources to download
        self.core_resources = [
            # Patient Administration
            'Patient',
            'Practitioner', 
            'PractitionerRole',
            'Organization',
            'Location',
            'Encounter',
            'EpisodeOfCare',
            
            # Clinical Summary
            'AllergyIntolerance',
            'Condition',
            'Procedure',
            'FamilyMemberHistory',
            'Immunization',
            'CarePlan',
            'CareTeam',
            'Goal',
            'RiskAssessment',
            
            # Diagnostics
            'Observation',
            'DiagnosticReport',
            'ImagingStudy',
            'Specimen',
            'BodyStructure',
            
            # Medications
            'Medication',
            'MedicationRequest',
            'MedicationDispense',
            'MedicationAdministration',
            'MedicationStatement',
            
            # Care Provision
            'ServiceRequest',
            'Task',
            'Appointment',
            'AppointmentResponse',
            'Schedule',
            'Slot',
            
            # Financial
            'Coverage',
            'ClaimResponse',
            'ExplanationOfBenefit',
            
            # Specialized System Capabilities
            'Device',
            'DeviceRequest',
            'DeviceUseStatement',
            'Communication',
            'CommunicationRequest',
            
            # Clinical Reasoning
            'DetectedIssue',
            'Flag',
            'Library',
            'Measure',
            'MeasureReport',
            
            # Quality Reporting and Research
            'ResearchStudy',
            'ResearchSubject',
            'ActivityDefinition',
            'PlanDefinition',
            
            # Documents & Lists
            'DocumentReference',
            'DocumentManifest',
            'List',
            'Composition',
            
            # Infrastructure
            'Bundle',
            'MessageHeader',
            'OperationOutcome',
            'Subscription',
            'AuditEvent'
        ]
        
        # Track download results
        self.download_results = {
            'successful': [],
            'failed': [],
            'not_found': []
        }
    
    async def download_all_resources(self):
        """Download all resources across all versions"""
        
        # Create directory structure
        for version in self.versions.keys():
            version_dir = self.base_dir / version
            version_dir.mkdir(parents=True, exist_ok=True)
        
        # Create analysis directory
        analysis_dir = self.base_dir / 'analysis'
        analysis_dir.mkdir(exist_ok=True)
        
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=10)
        ) as session:
            self.session = session
            
            # Download resources for each version
            tasks = []
            for version, config in self.versions.items():
                for resource in self.core_resources:
                    task = self._download_resource(version, resource, config['base_url'])
                    tasks.append(task)
            
            # Execute downloads with concurrency control
            semaphore = asyncio.Semaphore(5)  # Limit concurrent downloads
            
            async def bounded_download(task):
                async with semaphore:
                    return await task
            
            results = await asyncio.gather(
                *[bounded_download(task) for task in tasks],
                return_exceptions=True
            )
            
            # Process results
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Download failed with exception: {result}")
    
    async def _download_resource(self, version: str, resource: str, base_url: str):
        """Download a single resource example"""
        
        # Construct URL - handle different naming conventions
        resource_name = resource.lower()
        url = f"{base_url}/{resource_name}-example.json"
        
        output_file = self.base_dir / version / f"{resource}.json"
        
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    content = await response.text()
                    
                    # Validate JSON
                    try:
                        json_data = json.loads(content)
                        
                        # Verify it's the expected resource type
                        if json_data.get('resourceType') == resource:
                            # Save to file
                            with open(output_file, 'w') as f:
                                json.dump(json_data, f, indent=2)
                            
                            self.download_results['successful'].append({
                                'version': version,
                                'resource': resource,
                                'url': url,
                                'file': str(output_file)
                            })
                            
                            logger.info(f"✓ Downloaded {version}/{resource}")
                            return True
                        else:
                            logger.warning(f"✗ Wrong resource type for {version}/{resource}: got {json_data.get('resourceType')}")
                            return False
                            
                    except json.JSONDecodeError as e:
                        logger.error(f"✗ Invalid JSON for {version}/{resource}: {e}")
                        self.download_results['failed'].append({
                            'version': version,
                            'resource': resource,
                            'url': url,
                            'error': f"JSON decode error: {e}"
                        })
                        return False
                
                elif response.status == 404:
                    logger.warning(f"✗ Not found: {version}/{resource}")
                    self.download_results['not_found'].append({
                        'version': version,
                        'resource': resource,
                        'url': url
                    })
                    return False
                
                else:
                    logger.error(f"✗ HTTP {response.status} for {version}/{resource}")
                    self.download_results['failed'].append({
                        'version': version,
                        'resource': resource,
                        'url': url,
                        'error': f"HTTP {response.status}"
                    })
                    return False
                    
        except Exception as e:
            logger.error(f"✗ Exception downloading {version}/{resource}: {e}")
            self.download_results['failed'].append({
                'version': version,
                'resource': resource,
                'url': url,
                'error': str(e)
            })
            return False
    
    def generate_inventory(self):
        """Generate inventory of downloaded resources"""
        
        inventory = {
            'download_summary': {
                'total_attempts': len(self.download_results['successful']) + 
                                len(self.download_results['failed']) + 
                                len(self.download_results['not_found']),
                'successful': len(self.download_results['successful']),
                'failed': len(self.download_results['failed']),
                'not_found': len(self.download_results['not_found'])
            },
            'by_version': {},
            'by_resource': {},
            'results': self.download_results
        }
        
        # Organize by version
        for version in self.versions.keys():
            successful_for_version = [r for r in self.download_results['successful'] if r['version'] == version]
            inventory['by_version'][version] = {
                'downloaded': len(successful_for_version),
                'total_attempted': len(self.core_resources),
                'resources': [r['resource'] for r in successful_for_version]
            }
        
        # Organize by resource
        for resource in self.core_resources:
            successful_for_resource = [r for r in self.download_results['successful'] if r['resource'] == resource]
            inventory['by_resource'][resource] = {
                'versions_available': [r['version'] for r in successful_for_resource],
                'total_versions': len(successful_for_resource)
            }
        
        return inventory
    
    def save_results(self):
        """Save download results and inventory"""
        
        inventory = self.generate_inventory()
        
        # Save inventory
        inventory_file = self.base_dir / 'analysis' / 'resource_inventory.json'
        with open(inventory_file, 'w') as f:
            json.dump(inventory, f, indent=2)
        
        # Save download log
        log_file = self.base_dir / 'analysis' / 'download_log.json'
        with open(log_file, 'w') as f:
            json.dump(self.download_results, f, indent=2)
        
        logger.info(f"Results saved to {self.base_dir / 'analysis'}")
        
        return inventory
    
    def print_summary(self, inventory: Dict):
        """Print download summary"""
        
        print("\n" + "="*60)
        print("FHIR Resource Download Summary")
        print("="*60)
        
        summary = inventory['download_summary']
        print(f"Total attempts: {summary['total_attempts']}")
        print(f"Successful: {summary['successful']} ({summary['successful']/summary['total_attempts']*100:.1f}%)")
        print(f"Failed: {summary['failed']}")
        print(f"Not found: {summary['not_found']}")
        
        print("\nBy Version:")
        for version, stats in inventory['by_version'].items():
            print(f"  {version.upper()}: {stats['downloaded']}/{stats['total_attempted']} resources")
        
        print("\nResources Available in All Versions:")
        all_versions_resources = [
            resource for resource, stats in inventory['by_resource'].items()
            if stats['total_versions'] == len(self.versions)
        ]
        print(f"  {len(all_versions_resources)} resources available across all versions")
        for resource in all_versions_resources[:10]:  # Show first 10
            print(f"    • {resource}")
        if len(all_versions_resources) > 10:
            print(f"    ... and {len(all_versions_resources) - 10} more")
        
        print("\nMissing Resources (need manual review):")
        missing_resources = [
            resource for resource, stats in inventory['by_resource'].items()
            if stats['total_versions'] < len(self.versions)
        ]
        for resource in missing_resources[:10]:  # Show first 10
            available = inventory['by_resource'][resource]['versions_available']
            missing = [v for v in self.versions.keys() if v not in available]
            print(f"    • {resource}: missing from {', '.join(missing)}")
        
        if self.download_results['failed']:
            print(f"\nFailed Downloads ({len(self.download_results['failed'])}):")
            for failure in self.download_results['failed'][:5]:  # Show first 5
                print(f"    • {failure['version']}/{failure['resource']}: {failure['error']}")

async def main():
    """Main download function"""
    
    downloader = FHIRResourceDownloader()
    
    logger.info("Starting FHIR resource download...")
    logger.info(f"Target directory: {downloader.base_dir}")
    logger.info(f"Resources to download: {len(downloader.core_resources)}")
    logger.info(f"Versions: {', '.join(downloader.versions.keys())}")
    
    # Download all resources
    await downloader.download_all_resources()
    
    # Generate and save results
    inventory = downloader.save_results()
    
    # Print summary
    downloader.print_summary(inventory)
    
    logger.info("Download complete!")

if __name__ == "__main__":
    asyncio.run(main())