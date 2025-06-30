"""
Update existing patient demographics with race/ethnicity data from Synthea bundles
"""

import json
import os
import sys
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import func

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal
from models.models import Patient

def update_patient_demographics():
    """Update patient race and ethnicity from Synthea FHIR bundles"""
    db = SessionLocal()
    
    # Get all patients
    patients = db.query(Patient).all()
    print(f"Found {len(patients)} patients to update")
    
    # Path to Synthea output
    synthea_path = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    
    if not synthea_path.exists():
        print(f"Synthea output path not found: {synthea_path}")
        return
    
    updated_count = 0
    
    # Process each FHIR bundle
    for bundle_file in synthea_path.glob("*.json"):
        try:
            with open(bundle_file, 'r') as f:
                bundle = json.load(f)
            
            # Find Patient resources
            for entry in bundle.get('entry', []):
                resource = entry.get('resource', {})
                if resource.get('resourceType') != 'Patient':
                    continue
                
                # Get patient ID
                patient_id = resource.get('id')
                
                # Find patient in database by synthea_id
                patient = db.query(Patient).filter(Patient.synthea_id == patient_id).first()
                if not patient:
                    continue
                
                # Extract race and ethnicity
                race = None
                ethnicity = None
                
                for extension in resource.get('extension', []):
                    if 'us-core-race' in extension.get('url', ''):
                        # Look for the text extension within the race extension
                        for race_ext in extension.get('extension', []):
                            if race_ext.get('url') == 'text':
                                race = race_ext.get('valueString')
                                break
                    elif 'us-core-ethnicity' in extension.get('url', ''):
                        # Look for the text extension within the ethnicity extension
                        for ethnicity_ext in extension.get('extension', []):
                            if ethnicity_ext.get('url') == 'text':
                                ethnicity = ethnicity_ext.get('valueString')
                                break
                
                # Update patient if data found
                if race or ethnicity:
                    if race:
                        patient.race = race
                    if ethnicity:
                        patient.ethnicity = ethnicity
                    updated_count += 1
                    print(f"Updated patient {patient.synthea_id}: race={race}, ethnicity={ethnicity}")
                    
        except Exception as e:
            print(f"Error processing bundle {bundle_file}: {str(e)}")
            continue
    
    # Commit all updates
    db.commit()
    print(f"\nSuccessfully updated {updated_count} patients with race/ethnicity data")
    
    # Show summary
    race_summary = db.query(Patient.race, func.count(Patient.id)).group_by(Patient.race).all()
    print("\nRace distribution after update:")
    for race, count in race_summary:
        print(f"  {race or 'Unknown'}: {count}")
    
    ethnicity_summary = db.query(Patient.ethnicity, func.count(Patient.id)).group_by(Patient.ethnicity).all()
    print("\nEthnicity distribution after update:")
    for ethnicity, count in ethnicity_summary:
        print(f"  {ethnicity or 'Unknown'}: {count}")
    
    db.close()

if __name__ == "__main__":
    update_patient_demographics()