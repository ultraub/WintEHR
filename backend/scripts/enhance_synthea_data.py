#!/usr/bin/env python3
"""
Enhance Synthea Data with Relationships

This script enhances existing Synthea FHIR data by adding missing relationships:
- Adds generalPractitioner references to Patients
- Adds managingOrganization references to Patients  
- Creates RelatedPerson resources for family relationships
- Ensures consistent reference formats
- Adds missing search parameter values

Usage:
    python enhance_synthea_data.py [--input-dir INPUT_DIR] [--output-dir OUTPUT_DIR] [--create-families]
"""

import json
import asyncio
import random
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import argparse
import logging
from collections import defaultdict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SyntheaDataEnhancer:
    """Enhances Synthea FHIR data with additional relationships and references"""
    
    def __init__(self):
        self.patients: Dict[str, Dict[str, Any]] = {}
        self.practitioners: Dict[str, Dict[str, Any]] = {}
        self.organizations: Dict[str, Dict[str, Any]] = {}
        self.encounters: Dict[str, Dict[str, Any]] = {}
        self.resources_by_type: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.enhancements_made = {
            "generalPractitioner": 0,
            "managingOrganization": 0,
            "relatedPerson": 0,
            "organizationHierarchy": 0,
            "referenceFormat": 0
        }
    
    def load_bundle(self, bundle_path: Path) -> None:
        """Load a FHIR bundle and extract resources"""
        logger.info(f"Loading bundle: {bundle_path}")
        
        with open(bundle_path, 'r') as f:
            bundle = json.load(f)
        
        if bundle.get('resourceType') != 'Bundle':
            logger.warning(f"Not a bundle: {bundle_path}")
            return
        
        for entry in bundle.get('entry', []):
            resource = entry.get('resource', {})
            resource_type = resource.get('resourceType')
            resource_id = resource.get('id')
            
            if not resource_type or not resource_id:
                continue
            
            # Store by type
            self.resources_by_type[resource_type].append(resource)
            
            # Store specific types for easy access
            if resource_type == 'Patient':
                self.patients[resource_id] = resource
            elif resource_type == 'Practitioner':
                self.practitioners[resource_id] = resource
            elif resource_type == 'Organization':
                self.organizations[resource_id] = resource
            elif resource_type == 'Encounter':
                self.encounters[resource_id] = resource
    
    def find_practitioner_for_patient(self, patient_id: str) -> Optional[str]:
        """Find the most appropriate practitioner for a patient based on encounters"""
        # Look through encounters to find practitioners who have treated this patient
        practitioner_counts = defaultdict(int)
        
        for encounter in self.encounters.values():
            # Check if encounter is for this patient
            subject_ref = encounter.get('subject', {}).get('reference', '')
            if patient_id in subject_ref:
                # Count practitioners in this encounter
                for participant in encounter.get('participant', []):
                    individual_ref = participant.get('individual', {}).get('reference', '')
                    if 'Practitioner' in individual_ref:
                        practitioner_id = individual_ref.split('/')[-1]
                        if practitioner_id in self.practitioners:
                            practitioner_counts[practitioner_id] += 1
        
        # Return the practitioner with most encounters, or random if none found
        if practitioner_counts:
            return max(practitioner_counts, key=practitioner_counts.get)
        elif self.practitioners:
            return random.choice(list(self.practitioners.keys()))
        else:
            return None
    
    def find_organization_for_patient(self, patient_id: str) -> Optional[str]:
        """Find the most appropriate organization for a patient based on encounters"""
        # Look through encounters to find organizations
        org_counts = defaultdict(int)
        
        for encounter in self.encounters.values():
            subject_ref = encounter.get('subject', {}).get('reference', '')
            if patient_id in subject_ref:
                # Check serviceProvider
                service_provider_ref = encounter.get('serviceProvider', {}).get('reference', '')
                if 'Organization' in service_provider_ref:
                    org_id = service_provider_ref.split('/')[-1]
                    if org_id in self.organizations:
                        org_counts[org_id] += 1
        
        # Return the organization with most encounters, or random if none found
        if org_counts:
            return max(org_counts, key=org_counts.get)
        elif self.organizations:
            return random.choice(list(self.organizations.keys()))
        else:
            return None
    
    def enhance_patient_references(self) -> None:
        """Add generalPractitioner and managingOrganization to patients"""
        logger.info("Enhancing patient references...")
        
        for patient_id, patient in self.patients.items():
            # Add generalPractitioner if missing
            if not patient.get('generalPractitioner'):
                practitioner_id = self.find_practitioner_for_patient(patient_id)
                if practitioner_id:
                    # Use urn:uuid format for Synthea compatibility
                    patient['generalPractitioner'] = [{
                        "reference": f"urn:uuid:{practitioner_id}"
                    }]
                    self.enhancements_made['generalPractitioner'] += 1
            
            # Add managingOrganization if missing
            if not patient.get('managingOrganization'):
                org_id = self.find_organization_for_patient(patient_id)
                if org_id:
                    patient['managingOrganization'] = {
                        "reference": f"urn:uuid:{org_id}"
                    }
                    self.enhancements_made['managingOrganization'] += 1
    
    def create_organization_hierarchy(self) -> None:
        """Create hierarchical relationships between organizations"""
        logger.info("Creating organization hierarchy...")
        
        orgs_list = list(self.organizations.values())
        if len(orgs_list) < 2:
            return
        
        # Sort organizations by name to create consistent hierarchy
        orgs_list.sort(key=lambda x: x.get('name', ''))
        
        # Create hierarchy: First org is parent, others are children
        parent_org = orgs_list[0]
        parent_id = parent_org['id']
        
        for child_org in orgs_list[1:]:
            if not child_org.get('partOf'):
                child_org['partOf'] = {
                    "reference": f"urn:uuid:{parent_id}"
                }
                self.enhancements_made['organizationHierarchy'] += 1
    
    def create_family_relationships(self, create_families: bool = False) -> List[Dict[str, Any]]:
        """Create RelatedPerson resources for family relationships"""
        related_persons = []
        
        if not create_families:
            return related_persons
        
        logger.info("Creating family relationships...")
        
        # Group patients by last name to infer families
        families = defaultdict(list)
        for patient_id, patient in self.patients.items():
            names = patient.get('name', [])
            if names:
                family_name = names[0].get('family', 'Unknown')
                families[family_name].append((patient_id, patient))
        
        # Create relationships within families
        for family_name, family_members in families.items():
            if len(family_members) < 2:
                continue
            
            # Sort by birth date to determine relationships
            family_members.sort(key=lambda x: x[1].get('birthDate', '9999'))
            
            # Assume first two are parents, rest are children
            if len(family_members) >= 3:
                # Create parent relationships for children
                parent1_id, parent1 = family_members[0]
                parent2_id, parent2 = family_members[1]
                
                parent1_gender = parent1.get('gender', 'unknown')
                parent2_gender = parent2.get('gender', 'unknown')
                
                for child_id, child in family_members[2:]:
                    # Create mother relationship
                    if parent1_gender == 'female':
                        mother_id, mother = parent1_id, parent1
                        father_id, father = parent2_id, parent2
                    else:
                        mother_id, mother = parent2_id, parent2
                        father_id, father = parent1_id, parent1
                    
                    # Create RelatedPerson for mother
                    if mother_id and mother.get('gender') == 'female':
                        related_person = {
                            "resourceType": "RelatedPerson",
                            "id": f"related-{mother_id}-to-{child_id}",
                            "patient": {
                                "reference": f"urn:uuid:{child_id}"
                            },
                            "relationship": [{
                                "coding": [{
                                    "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                                    "code": "MTH",
                                    "display": "mother"
                                }]
                            }],
                            "name": mother.get('name', [{}])[0] if mother.get('name') else {},
                            "gender": "female"
                        }
                        related_persons.append(related_person)
                        self.enhancements_made['relatedPerson'] += 1
                    
                    # Create RelatedPerson for father
                    if father_id and father.get('gender') == 'male':
                        related_person = {
                            "resourceType": "RelatedPerson",
                            "id": f"related-{father_id}-to-{child_id}",
                            "patient": {
                                "reference": f"urn:uuid:{child_id}"
                            },
                            "relationship": [{
                                "coding": [{
                                    "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                                    "code": "FTH",
                                    "display": "father"
                                }]
                            }],
                            "name": father.get('name', [{}])[0] if father.get('name') else {},
                            "gender": "male"
                        }
                        related_persons.append(related_person)
                        self.enhancements_made['relatedPerson'] += 1
        
        return related_persons
    
    def standardize_reference_formats(self) -> None:
        """Ensure all references use consistent format (urn:uuid for Synthea)"""
        logger.info("Standardizing reference formats...")
        
        def fix_reference(ref_dict: Dict[str, Any]) -> bool:
            """Fix a reference object to use urn:uuid format"""
            if 'reference' in ref_dict:
                ref = ref_dict['reference']
                # Check if it's already in urn:uuid format
                if not ref.startswith('urn:uuid:'):
                    # Extract resource type and ID
                    parts = ref.split('/')
                    if len(parts) == 2:
                        resource_type, resource_id = parts
                        ref_dict['reference'] = f"urn:uuid:{resource_id}"
                        return True
            return False
        
        # Fix references in all resources
        for resource_type, resources in self.resources_by_type.items():
            for resource in resources:
                # Common reference fields
                reference_fields = [
                    'subject', 'patient', 'encounter', 'requester', 'performer',
                    'author', 'recorder', 'asserter', 'serviceProvider',
                    'generalPractitioner', 'managingOrganization', 'partOf',
                    'individual', 'actor', 'agent', 'onBehalfOf'
                ]
                
                for field in reference_fields:
                    if field in resource:
                        if isinstance(resource[field], dict):
                            if fix_reference(resource[field]):
                                self.enhancements_made['referenceFormat'] += 1
                        elif isinstance(resource[field], list):
                            for item in resource[field]:
                                if isinstance(item, dict) and fix_reference(item):
                                    self.enhancements_made['referenceFormat'] += 1
                
                # Fix references in arrays
                array_fields_with_refs = {
                    'performer': ['reference', 'actor'],
                    'participant': ['individual', 'actor'],
                    'agent': ['who', 'onBehalfOf'],
                    'basedOn': ['reference'],
                    'partOf': ['reference'],
                    'reasonReference': ['reference'],
                    'supportingInfo': ['reference']
                }
                
                for field, ref_keys in array_fields_with_refs.items():
                    if field in resource and isinstance(resource[field], list):
                        for item in resource[field]:
                            for ref_key in ref_keys:
                                if ref_key in item and isinstance(item[ref_key], dict):
                                    if fix_reference(item[ref_key]):
                                        self.enhancements_made['referenceFormat'] += 1
    
    def add_missing_search_values(self) -> None:
        """Add commonly searched fields that might be missing"""
        logger.info("Adding missing search parameter values...")
        
        # Add categories to observations that are missing them
        for observation in self.resources_by_type.get('Observation', []):
            if not observation.get('category'):
                # Determine category based on code
                code = observation.get('code', {}).get('coding', [{}])[0].get('code', '')
                
                if code in ['8480-6', '8462-4', '8867-4', '8302-2', '9279-1']:
                    observation['category'] = [{
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "vital-signs",
                            "display": "Vital Signs"
                        }]
                    }]
                elif code.startswith('2') or code.startswith('1'):
                    observation['category'] = [{
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "laboratory",
                            "display": "Laboratory"
                        }]
                    }]
        
        # Ensure all patients have active status
        for patient in self.patients.values():
            if 'active' not in patient:
                patient['active'] = True
    
    def create_enhanced_bundle(self, resources_to_add: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a bundle with all enhanced resources"""
        entries = []
        
        # Add all resources
        for resource_type, resources in self.resources_by_type.items():
            for resource in resources:
                entry = {
                    "fullUrl": f"urn:uuid:{resource['id']}",
                    "resource": resource,
                    "request": {
                        "method": "PUT",
                        "url": f"{resource_type}/{resource['id']}"
                    }
                }
                entries.append(entry)
        
        # Add new resources (like RelatedPerson)
        if resources_to_add:
            for resource in resources_to_add:
                entry = {
                    "fullUrl": f"urn:uuid:{resource['id']}",
                    "resource": resource,
                    "request": {
                        "method": "POST",
                        "url": resource['resourceType']
                    }
                }
                entries.append(entry)
        
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": entries,
            "meta": {
                "lastUpdated": datetime.utcnow().isoformat() + "Z",
                "tag": [{
                    "system": "http://example.org/fhir/tag",
                    "code": "synthea-enhanced",
                    "display": "Enhanced Synthea Data"
                }]
            }
        }
        
        return bundle
    
    def save_enhanced_data(self, output_dir: Path, create_bundle: bool = True) -> None:
        """Save enhanced data to files"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if create_bundle:
            # Save as single bundle
            related_persons = self.resources_by_type.get('RelatedPerson', [])
            bundle = self.create_enhanced_bundle(related_persons)
            
            bundle_path = output_dir / "enhanced_synthea_bundle.json"
            with open(bundle_path, 'w') as f:
                json.dump(bundle, f, indent=2)
            
            logger.info(f"Saved enhanced bundle to: {bundle_path}")
        
        # Save individual resource types
        for resource_type, resources in self.resources_by_type.items():
            if resources:
                file_path = output_dir / f"enhanced_{resource_type}.json"
                with open(file_path, 'w') as f:
                    json.dump(resources, f, indent=2)
                
                logger.info(f"Saved {len(resources)} {resource_type} resources to: {file_path}")
    
    def print_enhancement_summary(self) -> None:
        """Print summary of enhancements made"""
        logger.info("\n=== Enhancement Summary ===")
        logger.info(f"Resources loaded:")
        for resource_type, resources in self.resources_by_type.items():
            logger.info(f"  {resource_type}: {len(resources)}")
        
        logger.info(f"\nEnhancements made:")
        for enhancement, count in self.enhancements_made.items():
            logger.info(f"  {enhancement}: {count}")
        
        # Calculate coverage
        total_patients = len(self.patients)
        if total_patients > 0:
            gp_coverage = sum(1 for p in self.patients.values() if p.get('generalPractitioner')) / total_patients * 100
            org_coverage = sum(1 for p in self.patients.values() if p.get('managingOrganization')) / total_patients * 100
            
            logger.info(f"\nPatient reference coverage:")
            logger.info(f"  generalPractitioner: {gp_coverage:.1f}%")
            logger.info(f"  managingOrganization: {org_coverage:.1f}%")


async def main():
    parser = argparse.ArgumentParser(description='Enhance Synthea FHIR data with relationships')
    parser.add_argument('--input-dir', type=str, default='synthea_output',
                      help='Directory containing Synthea output files')
    parser.add_argument('--output-dir', type=str, default='enhanced_synthea_output',
                      help='Directory to save enhanced data')
    parser.add_argument('--create-families', action='store_true',
                      help='Create RelatedPerson resources for family relationships')
    parser.add_argument('--bundle-only', action='store_true',
                      help='Only save as bundle, not individual files')
    
    args = parser.parse_args()
    
    input_path = Path(args.input_dir)
    output_path = Path(args.output_dir)
    
    if not input_path.exists():
        logger.error(f"Input directory not found: {input_path}")
        return
    
    enhancer = SyntheaDataEnhancer()
    
    # Load all bundles from input directory
    bundle_files = list(input_path.glob("**/*.json"))
    logger.info(f"Found {len(bundle_files)} JSON files to process")
    
    for bundle_file in bundle_files:
        try:
            enhancer.load_bundle(bundle_file)
        except Exception as e:
            logger.error(f"Error loading {bundle_file}: {e}")
    
    # Perform enhancements
    enhancer.enhance_patient_references()
    enhancer.create_organization_hierarchy()
    enhancer.standardize_reference_formats()
    enhancer.add_missing_search_values()
    
    # Create family relationships if requested
    if args.create_families:
        related_persons = enhancer.create_family_relationships(create_families=True)
        if related_persons:
            enhancer.resources_by_type['RelatedPerson'] = related_persons
    
    # Save enhanced data
    enhancer.save_enhanced_data(output_path, create_bundle=not args.bundle_only)
    
    # Print summary
    enhancer.print_enhancement_summary()
    
    logger.info(f"\nEnhancement complete! Enhanced data saved to: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())