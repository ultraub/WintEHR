#!/usr/bin/env python3
"""
Download Official FHIR StructureMaps
Downloads official HL7-maintained StructureMaps for version conversions
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

class StructureMapDownloader:
    """Downloads official FHIR StructureMaps from HL7"""
    
    def __init__(self, base_dir: str = "backend/core/fhir/official_resources"):
        self.base_dir = Path(base_dir)
        self.session = None
        
        # StructureMap base URLs - Updated with correct sources
        self.structure_map_bases = {
            'cross_version_pack': {
                'base_url': 'https://build.fhir.org/ig/HL7/fhir-cross-version',
                'description': 'FHIR Cross-Version Mapping Pack (Official R4↔R5 conversions)'
            },
            'r4_extensions': {
                'base_url': 'https://hl7.org/fhir/extensions/5.1.0-ballot',
                'description': 'FHIR Extensions Pack with version maps'
            },
            'r6_build': {
                'base_url': 'https://build.fhir.org',
                'description': 'FHIR R6 Build (potential R6↔R5 conversions)'
            }
        }
        
        # Core resources that likely have StructureMaps
        self.core_resources = [
            'AllergyIntolerance',
            'Condition', 
            'Patient',
            'Practitioner',
            'PractitionerRole',
            'Organization',
            'Location',
            'Encounter',
            'Observation',
            'DiagnosticReport',
            'Medication',
            'MedicationRequest',
            'MedicationDispense',
            'MedicationAdministration',
            'MedicationStatement',
            'ServiceRequest',
            'Procedure',
            'Immunization',
            'CarePlan',
            'CareTeam',
            'Goal',
            'Coverage',
            'Device',
            'DeviceRequest',
            'Communication',
            'Flag',
            'List',
            'Composition',
            'Bundle'
        ]
        
        # Version conversion patterns - Updated for actual available maps
        self.conversion_patterns = [
            '4to5',  # R4 to R5
            '5to4',  # R5 to R4 (round-trip)
            '5to6',  # R5 to R6 (if available)
            '6to5'   # R6 to R5 (if available)
        ]
        
        # Known StructureMaps from FHIR Cross-Version Pack
        self.known_structure_maps = [
            'StructureMap4to5',
            'StructureMap5to4', 
            'Bundle4to5',
            'Bundle5to4',
            'Period4to5',
            'Period5to4',
            'ContactPoint4to5',
            'ContactPoint5to4',
            'Address4to5',
            'Address5to4',
            'HumanName4to5',
            'HumanName5to4',
            'Identifier4to5',
            'Identifier5to4'
        ]
        
        # Track download results
        self.download_results = {
            'successful': [],
            'failed': [],
            'not_found': []
        }
    
    async def download_all_structure_maps(self):
        """Download all available StructureMaps"""
        
        # Create directory structure
        structure_maps_dir = self.base_dir / 'structure_maps'
        structure_maps_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories for different conversion types
        for pattern in self.conversion_patterns:
            pattern_dir = structure_maps_dir / pattern
            pattern_dir.mkdir(exist_ok=True)
        
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=10)
        ) as session:
            self.session = session
            
            # Download known StructureMaps from Cross-Version Pack
            tasks = []
            
            # Download known StructureMaps from Cross-Version Pack
            for structure_map in self.known_structure_maps:
                task = self._download_cross_version_structure_map(
                    'cross_version_pack',
                    structure_map,
                    self.structure_map_bases['cross_version_pack']['base_url']
                )
                tasks.append(task)
            
            # Try resource-specific conversions from Extensions Pack
            for resource in self.core_resources:
                for pattern in ['4to5', '5to4']:  # Extensions pack only has R4↔R5
                    task = self._download_structure_map(
                        'r4_extensions',
                        resource,
                        pattern,
                        self.structure_map_bases['r4_extensions']['base_url']
                    )
                    tasks.append(task)
            
            # Try R6 conversions from build.fhir.org
            for resource in self.core_resources:
                for pattern in ['5to6', '6to5']:  # R6 conversions
                    task = self._download_structure_map(
                        'r6_build',
                        resource,
                        pattern,
                        self.structure_map_bases['r6_build']['base_url']
                    )
                    tasks.append(task)
            
            # Execute downloads with concurrency control
            semaphore = asyncio.Semaphore(3)  # Conservative limit for HL7 servers
            
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
    
    async def _download_structure_map(self, source: str, resource: str, pattern: str, base_url: str):
        """Download a single StructureMap"""
        
        # Try multiple URL patterns
        url_patterns = [
            f"{base_url}/StructureMap/{resource}{pattern}.json",
            f"{base_url}/structuremap-{resource.lower()}{pattern}.json",
            f"{base_url}/StructureMap-{resource}{pattern}.json",
            f"{base_url}/{resource.lower()}-{pattern}.json"
        ]
        
        output_file = self.base_dir / 'structure_maps' / pattern / f"{resource}{pattern}.json"
        
        for url in url_patterns:
            try:
                async with self.session.get(url) as response:
                    if response.status == 200:
                        content = await response.text()
                        
                        # Validate JSON and check it's a StructureMap
                        try:
                            json_data = json.loads(content)
                            
                            if json_data.get('resourceType') == 'StructureMap':
                                # Save to file
                                with open(output_file, 'w') as f:
                                    json.dump(json_data, f, indent=2)
                                
                                self.download_results['successful'].append({
                                    'source': source,
                                    'resource': resource,
                                    'pattern': pattern,
                                    'url': url,
                                    'file': str(output_file),
                                    'structure_map_id': json_data.get('id'),
                                    'name': json_data.get('name')
                                })
                                
                                logger.info(f"✓ Downloaded {resource}{pattern} StructureMap from {source}")
                                return True
                            else:
                                logger.warning(f"✗ Wrong resource type for {resource}{pattern}: got {json_data.get('resourceType')}")
                                continue
                                
                        except json.JSONDecodeError as e:
                            logger.error(f"✗ Invalid JSON for {resource}{pattern} from {url}: {e}")
                            continue
                    
                    elif response.status == 404:
                        # Try next URL pattern
                        continue
                    
                    else:
                        logger.warning(f"✗ HTTP {response.status} for {resource}{pattern} from {url}")
                        continue
                        
            except Exception as e:
                logger.warning(f"✗ Exception downloading {resource}{pattern} from {url}: {e}")
                continue
        
        # If we get here, all URL patterns failed
        self.download_results['not_found'].append({
            'source': source,
            'resource': resource,
            'pattern': pattern,
            'attempted_urls': url_patterns
        })
        
        logger.warning(f"✗ StructureMap not found: {resource}{pattern}")
        return False
    
    async def _download_cross_version_structure_map(self, source: str, structure_map_name: str, base_url: str):
        """Download a StructureMap from the Cross-Version Pack"""
        
        # URL patterns for Cross-Version Pack
        url_patterns = [
            f"{base_url}/StructureMap-{structure_map_name}.json",
            f"{base_url}/StructureMap/{structure_map_name}.json",
            f"{base_url}/{structure_map_name}.json"
        ]
        
        output_file = self.base_dir / 'structure_maps' / 'cross_version' / f"{structure_map_name}.json"
        output_file.parent.mkdir(exist_ok=True)
        
        for url in url_patterns:
            try:
                async with self.session.get(url) as response:
                    if response.status == 200:
                        content = await response.text()
                        
                        # Validate JSON and check it's a StructureMap
                        try:
                            json_data = json.loads(content)
                            
                            if json_data.get('resourceType') == 'StructureMap':
                                # Save to file
                                with open(output_file, 'w') as f:
                                    json.dump(json_data, f, indent=2)
                                
                                self.download_results['successful'].append({
                                    'source': source,
                                    'structure_map': structure_map_name,
                                    'url': url,
                                    'file': str(output_file),
                                    'structure_map_id': json_data.get('id'),
                                    'name': json_data.get('name'),
                                    'description': json_data.get('description')
                                })
                                
                                logger.info(f"✓ Downloaded {structure_map_name} from Cross-Version Pack")
                                return True
                            else:
                                logger.warning(f"✗ Wrong resource type for {structure_map_name}: got {json_data.get('resourceType')}")
                                continue
                                
                        except json.JSONDecodeError as e:
                            logger.error(f"✗ Invalid JSON for {structure_map_name} from {url}: {e}")
                            continue
                    
                    elif response.status == 404:
                        # Try next URL pattern
                        continue
                    
                    else:
                        logger.warning(f"✗ HTTP {response.status} for {structure_map_name} from {url}")
                        continue
                        
            except Exception as e:
                logger.warning(f"✗ Exception downloading {structure_map_name} from {url}: {e}")
                continue
        
        # If we get here, all URL patterns failed
        self.download_results['not_found'].append({
            'source': source,
            'structure_map': structure_map_name,
            'attempted_urls': url_patterns
        })
        
        logger.warning(f"✗ Cross-Version StructureMap not found: {structure_map_name}")
        return False
    
    async def download_additional_maps(self):
        """Download additional known StructureMaps and ConceptMaps"""
        
        additional_urls = [
            # Known StructureMap collections
            'https://hl7.org/fhir/R4/r3-r4-structuremaps.json',
            'https://hl7.org/fhir/R5/r4-r5-structuremaps.json',
            
            # ConceptMaps
            'https://hl7.org/fhir/R4/conceptmap-examples.json',
            'https://hl7.org/fhir/R5/conceptmap-examples.json',
            
            # Version comparison documents
            'https://hl7.org/fhir/R5/diff.html',
            'https://hl7.org/fhir/R4/r3-diff.html'
        ]
        
        misc_dir = self.base_dir / 'structure_maps' / 'collections'
        misc_dir.mkdir(exist_ok=True)
        
        for url in additional_urls:
            try:
                async with self.session.get(url) as response:
                    if response.status == 200:
                        content = await response.text()
                        
                        # Determine filename from URL
                        filename = url.split('/')[-1]
                        if not filename.endswith(('.json', '.html')):
                            filename += '.json'
                        
                        output_file = misc_dir / filename
                        
                        if url.endswith('.json'):
                            # Validate JSON
                            try:
                                json_data = json.loads(content)
                                with open(output_file, 'w') as f:
                                    json.dump(json_data, f, indent=2)
                            except json.JSONDecodeError:
                                # Save as text if not valid JSON
                                with open(output_file.with_suffix('.txt'), 'w') as f:
                                    f.write(content)
                        else:
                            # Save HTML/text content
                            with open(output_file, 'w') as f:
                                f.write(content)
                        
                        logger.info(f"✓ Downloaded additional resource: {filename}")
            
            except Exception as e:
                logger.warning(f"✗ Failed to download {url}: {e}")
    
    def generate_structure_map_inventory(self):
        """Generate inventory of downloaded StructureMaps"""
        
        inventory = {
            'download_summary': {
                'total_attempts': len(self.download_results['successful']) + 
                                len(self.download_results['failed']) + 
                                len(self.download_results['not_found']),
                'successful': len(self.download_results['successful']),
                'failed': len(self.download_results['failed']),
                'not_found': len(self.download_results['not_found'])
            },
            'by_pattern': {},
            'by_resource': {},
            'available_conversions': [],
            'results': self.download_results
        }
        
        # Organize by conversion pattern
        for pattern in self.conversion_patterns:
            successful_for_pattern = [r for r in self.download_results['successful'] if r.get('pattern') == pattern]
            inventory['by_pattern'][pattern] = {
                'downloaded': len(successful_for_pattern),
                'resources': [r.get('resource', r.get('structure_map', 'unknown')) for r in successful_for_pattern],
                'description': f"FHIR R{pattern[0]} to R{pattern[-1]} conversions"
            }
        
        # Organize by resource
        for resource in self.core_resources:
            successful_for_resource = [r for r in self.download_results['successful'] if r.get('resource') == resource]
            patterns_available = [r.get('pattern') for r in successful_for_resource if r.get('pattern')]
            inventory['by_resource'][resource] = {
                'conversion_patterns': patterns_available,
                'total_patterns': len(patterns_available)
            }
            
            if patterns_available:
                inventory['available_conversions'].append({
                    'resource': resource,
                    'patterns': patterns_available
                })
        
        # Add Cross-Version Pack StructureMaps
        cross_version_maps = [r for r in self.download_results['successful'] if r.get('structure_map')]
        inventory['cross_version_maps'] = {
            'total': len(cross_version_maps),
            'maps': [r.get('structure_map') for r in cross_version_maps]
        }
        
        return inventory
    
    def save_results(self):
        """Save StructureMap download results and inventory"""
        
        inventory = self.generate_structure_map_inventory()
        
        # Save inventory
        analysis_dir = self.base_dir / 'analysis'
        analysis_dir.mkdir(exist_ok=True)
        
        inventory_file = analysis_dir / 'structure_map_inventory.json'
        with open(inventory_file, 'w') as f:
            json.dump(inventory, f, indent=2)
        
        # Save download log
        log_file = analysis_dir / 'structure_map_download_log.json'
        with open(log_file, 'w') as f:
            json.dump(self.download_results, f, indent=2)
        
        logger.info(f"StructureMap results saved to {analysis_dir}")
        
        return inventory
    
    def print_summary(self, inventory: Dict):
        """Print StructureMap download summary"""
        
        print("\n" + "="*60)
        print("FHIR StructureMap Download Summary")
        print("="*60)
        
        summary = inventory['download_summary']
        print(f"Total attempts: {summary['total_attempts']}")
        print(f"Successful: {summary['successful']} ({summary['successful']/summary['total_attempts']*100:.1f}%)")
        print(f"Failed: {summary['failed']}")
        print(f"Not found: {summary['not_found']}")
        
        print("\nBy Conversion Pattern:")
        for pattern, stats in inventory['by_pattern'].items():
            print(f"  {pattern}: {stats['downloaded']} StructureMaps - {stats['description']}")
        
        print("\nAvailable Conversions:")
        for conversion in inventory['available_conversions'][:10]:  # Show first 10
            patterns = ', '.join(conversion['patterns'])
            print(f"  • {conversion['resource']}: {patterns}")
        
        if len(inventory['available_conversions']) > 10:
            print(f"  ... and {len(inventory['available_conversions']) - 10} more resources")
        
        print("\nNext Steps:")
        print("  1. Install MaLaC-HD: pip install malac-hd")
        print("  2. Test StructureMap execution with downloaded maps")
        print("  3. Integrate with version-aware storage system")
        print("  4. Validate round-trip conversions")

async def main():
    """Main StructureMap download function"""
    
    downloader = StructureMapDownloader()
    
    logger.info("Starting FHIR StructureMap download...")
    logger.info(f"Target directory: {downloader.base_dir / 'structure_maps'}")
    logger.info(f"Resources to check: {len(downloader.core_resources)}")
    logger.info(f"Conversion patterns: {', '.join(downloader.conversion_patterns)}")
    
    # Download StructureMaps
    await downloader.download_all_structure_maps()
    
    # Download additional collections
    logger.info("Downloading additional StructureMap collections...")
    await downloader.download_additional_maps()
    
    # Generate and save results
    inventory = downloader.save_results()
    
    # Print summary
    downloader.print_summary(inventory)
    
    logger.info("StructureMap download complete!")

if __name__ == "__main__":
    asyncio.run(main())