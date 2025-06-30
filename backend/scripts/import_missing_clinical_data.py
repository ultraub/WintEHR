#!/usr/bin/env python3
"""
Script to import missing clinical data from Synthea FHIR bundles:
1. Clinical notes from DocumentReference resources
2. Reference ranges from Observation resources
"""
import sys
import os
import json
import base64
from pathlib import Path
from datetime import datetime
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database.database import SessionLocal
from models.synthea_models import Encounter, Observation, Patient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ClinicalDataImporter:
    def __init__(self):
        self.stats = {
            'notes_imported': 0,
            'reference_ranges_updated': 0,
            'errors': 0
        }
        self.encounter_map = {}  # synthea_id -> database encounter
        self.observation_map = {}  # synthea_id -> database observation
        
    def load_mappings(self, session: Session):
        """Load existing encounters and observations into memory for quick lookup"""
        logger.info("Loading existing encounters and observations...")
        
        # Load encounters
        encounters = session.query(Encounter).filter(Encounter.synthea_id.isnot(None)).all()
        for enc in encounters:
            self.encounter_map[enc.synthea_id] = enc
        logger.info(f"Loaded {len(self.encounter_map)} encounters")
        
        # Load observations
        observations = session.query(Observation).filter(Observation.synthea_id.isnot(None)).all()
        for obs in observations:
            self.observation_map[obs.synthea_id] = obs
        logger.info(f"Loaded {len(self.observation_map)} observations")
    
    def process_bundle(self, bundle_path: Path, session: Session):
        """Process a single FHIR bundle file"""
        try:
            with open(bundle_path, 'r') as f:
                bundle = json.load(f)
            
            if bundle.get('resourceType') != 'Bundle':
                return
            
            # Process each entry in the bundle
            for entry in bundle.get('entry', []):
                resource = entry.get('resource', {})
                resource_type = resource.get('resourceType')
                
                if resource_type == 'DocumentReference':
                    self.import_clinical_note(resource, session)
                elif resource_type == 'Observation':
                    self.update_observation_reference_ranges(resource, session)
            
        except Exception as e:
            logger.error(f"Error processing bundle {bundle_path}: {e}")
            self.stats['errors'] += 1
    
    def import_clinical_note(self, resource: dict, session: Session):
        """Import clinical note from DocumentReference resource"""
        try:
            doc_id = resource.get('id')
            
            # Find the encounter reference
            encounter_ref = None
            context = resource.get('context', {})
            
            # Try different possible encounter reference locations
            if context.get('encounter'):
                # Some versions have it as a list
                if isinstance(context.get('encounter'), list):
                    encounter_ref = context.get('encounter')[0].get('reference')
                else:
                    encounter_ref = context.get('encounter').get('reference')
            elif context.get('related'):
                # Some versions use 'related' field
                for related in context.get('related', []):
                    if related.get('reference', '').startswith('Encounter/'):
                        encounter_ref = related.get('reference')
                        break
            
            if not encounter_ref:
                return
            
            # Extract encounter ID from reference (format: "Encounter/uuid")
            encounter_id = encounter_ref.split('/')[-1]
            encounter = self.encounter_map.get(encounter_id)
            
            if not encounter:
                return
            
            # Extract clinical note content
            notes_added = False
            for content in resource.get('content', []):
                attachment = content.get('attachment', {})
                if attachment.get('data'):
                    try:
                        # Decode base64 content
                        note_content = base64.b64decode(attachment.get('data')).decode('utf-8')
                        
                        # Add document type/title if available
                        doc_type = resource.get('type', {}).get('text', 'Clinical Note')
                        formatted_note = f"=== {doc_type} ===\n{note_content}"
                        
                        # Update encounter with clinical notes
                        if encounter.notes:
                            encounter.notes += f"\n\n{formatted_note}"
                        else:
                            encounter.notes = formatted_note
                        
                        notes_added = True
                        logger.debug(f"Added clinical note to encounter {encounter.synthea_id}")
                        
                    except Exception as e:
                        logger.error(f"Error decoding clinical note: {e}")
            
            if notes_added:
                self.stats['notes_imported'] += 1
                
        except Exception as e:
            logger.error(f"Error importing document {resource.get('id')}: {e}")
            self.stats['errors'] += 1
    
    def update_observation_reference_ranges(self, resource: dict, session: Session):
        """Update observation with reference ranges from FHIR data"""
        try:
            obs_id = resource.get('id')
            observation = self.observation_map.get(obs_id)
            
            if not observation:
                return
            
            # Check if reference ranges already exist
            if observation.reference_range_low is not None or observation.reference_range_high is not None:
                return
            
            # Extract reference ranges
            reference_ranges = resource.get('referenceRange', [])
            if reference_ranges:
                ref_range = reference_ranges[0]  # Use first reference range
                
                if ref_range.get('low'):
                    observation.reference_range_low = ref_range.get('low', {}).get('value')
                    
                if ref_range.get('high'):
                    observation.reference_range_high = ref_range.get('high', {}).get('value')
                
                # Update interpretation if not already set
                if not observation.interpretation and resource.get('interpretation'):
                    interpretations = resource.get('interpretation', [])
                    if interpretations:
                        interp_coding = interpretations[0].get('coding', [])
                        if interp_coding:
                            observation.interpretation = interp_coding[0].get('code', '')
                
                self.stats['reference_ranges_updated'] += 1
                logger.debug(f"Updated reference ranges for observation {obs_id}")
                
        except Exception as e:
            logger.error(f"Error updating observation {resource.get('id')}: {e}")
            self.stats['errors'] += 1
    
    def import_directory(self, synthea_dir: Path):
        """Import missing clinical data from all FHIR bundles in directory"""
        fhir_dir = synthea_dir / 'fhir'
        if not fhir_dir.exists():
            logger.error(f"FHIR directory not found: {fhir_dir}")
            return False
        
        # Get all JSON files
        json_files = list(fhir_dir.glob('*.json'))
        logger.info(f"Found {len(json_files)} FHIR bundle files")
        
        with SessionLocal() as session:
            # Load existing data mappings
            self.load_mappings(session)
            
            # Process each bundle
            for i, bundle_path in enumerate(json_files):
                if i % 10 == 0:
                    logger.info(f"Processing bundle {i+1}/{len(json_files)}...")
                    session.commit()  # Commit periodically
                
                self.process_bundle(bundle_path, session)
            
            # Final commit
            session.commit()
        
        # Print statistics
        logger.info("\n=== Import Statistics ===")
        logger.info(f"Clinical notes imported: {self.stats['notes_imported']}")
        logger.info(f"Reference ranges updated: {self.stats['reference_ranges_updated']}")
        logger.info(f"Errors: {self.stats['errors']}")
        
        return True


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import missing clinical data from Synthea FHIR bundles')
    parser.add_argument(
        '--synthea-dir',
        type=str,
        default='data/synthea_output',
        help='Path to Synthea output directory'
    )
    parser.add_argument(
        '--add-default-ranges',
        action='store_true',
        help='Also run add_reference_ranges.py to add default ranges for common labs'
    )
    
    args = parser.parse_args()
    
    # Import missing clinical data
    importer = ClinicalDataImporter()
    success = importer.import_directory(Path(args.synthea_dir))
    
    if success and args.add_default_ranges:
        # Run the existing script to add default reference ranges
        logger.info("\nAdding default reference ranges for common labs...")
        from add_reference_ranges import main as add_ranges_main
        add_ranges_main()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())