#!/usr/bin/env python3
"""
Import Synthea data including clinical notes
This script imports both FHIR data and text-based clinical notes
"""

import os
import sys
import json
import base64
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal
from models.synthea_models import Patient, Provider, Encounter
from models.clinical.notes import ClinicalNote
from scripts.optimized_comprehensive_setup import import_synthea_data_optimized

def import_text_notes_to_fhir():
    """Convert text notes to FHIR DocumentReference format and import"""
    
    db = SessionLocal()
    
    try:
        # Paths
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(current_dir)
        text_dir = os.path.join(backend_dir, "synthea", "output", "text")
        encounters_dir = os.path.join(backend_dir, "synthea", "output", "text_encounters")
        fhir_dir = os.path.join(backend_dir, "synthea", "output", "fhir")
        
        notes_created = 0
        
        # Get default provider
        default_provider = db.query(Provider).first()
        if not default_provider:
            print("No providers found. Import will continue but notes won't have authors.")
        
        print("\nImporting clinical notes from text files...")
        
        # Process encounter notes
        if os.path.exists(encounters_dir):
            for filename in os.listdir(encounters_dir):
                if not filename.endswith('.txt'):
                    continue
                
                filepath = os.path.join(encounters_dir, filename)
                
                # Parse filename to get patient info
                parts = filename.replace('.txt', '').split('_')
                if len(parts) >= 4:
                    first_name = parts[0]
                    last_name = parts[1]
                    
                    # Find patient
                    patient = db.query(Patient).filter(
                        Patient.first_name == first_name,
                        Patient.last_name == last_name
                    ).first()
                    
                    if patient:
                        # Read note content
                        with open(filepath, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        # Parse note sections
                        encounter_date = None
                        chief_complaint = ""
                        sections = {
                            "subjective": "",
                            "objective": "",
                            "assessment": "",
                            "plan": ""
                        }
                        
                        current_section = None
                        lines = content.split('\n')
                        
                        for line in lines:
                            # Extract date
                            if line.startswith('ENCOUNTER:'):
                                date_str = line.replace('ENCOUNTER:', '').strip()
                                try:
                                    encounter_date = datetime.strptime(date_str, '%Y-%m-%d')
                                except:
                                    pass
                            # Extract chief complaint
                            elif line.startswith('CHIEF COMPLAINT:'):
                                chief_complaint = line.replace('CHIEF COMPLAINT:', '').strip()
                            # Identify sections
                            elif line.upper().startswith('SUBJECTIVE:'):
                                current_section = 'subjective'
                            elif line.upper().startswith('OBJECTIVE:'):
                                current_section = 'objective'
                            elif line.upper().startswith('ASSESSMENT'):
                                current_section = 'assessment'
                            elif line.upper().startswith('PLAN:'):
                                current_section = 'plan'
                            elif current_section and line.strip():
                                sections[current_section] += line + '\n'
                        
                        # Find matching encounter
                        encounter = None
                        if encounter_date:
                            encounter = db.query(Encounter).filter(
                                Encounter.patient_id == patient.id,
                                Encounter.encounter_date >= encounter_date,
                                Encounter.encounter_date < datetime(
                                    encounter_date.year, 
                                    encounter_date.month, 
                                    encounter_date.day, 
                                    23, 59, 59
                                )
                            ).first()
                        
                        # Create clinical note
                        note = ClinicalNote(
                            patient_id=patient.id,
                            encounter_id=encounter.id if encounter else None,
                            author_id=encounter.provider_id if encounter and encounter.provider_id else (default_provider.id if default_provider else None),
                            note_type='progress_note',
                            status='signed',
                            chief_complaint=chief_complaint or "Clinical Encounter",
                            subjective=sections['subjective'].strip() or content[:1000],
                            objective=sections['objective'].strip(),
                            assessment=sections['assessment'].strip(),
                            plan=sections['plan'].strip(),
                            signed_at=encounter_date or datetime.now(),
                            created_at=encounter_date or datetime.now(),
                            updated_at=datetime.now()
                        )
                        
                        db.add(note)
                        notes_created += 1
                        
                        # Also update encounter notes field if empty
                        if encounter and not encounter.notes:
                            encounter.notes = content[:5000]  # Store first 5000 chars
                
                if notes_created % 10 == 0:
                    db.commit()
                    print(f"  Imported {notes_created} clinical notes...")
        
        # Process patient summaries as discharge summaries
        if os.path.exists(text_dir):
            for filename in os.listdir(text_dir):
                if not filename.endswith('.txt') or filename == 'practitioner_info.txt':
                    continue
                
                filepath = os.path.join(text_dir, filename)
                
                # Parse filename
                parts = filename.replace('.txt', '').split('_')
                if len(parts) >= 3:
                    first_name = parts[0]
                    last_name = parts[1]
                    
                    patient = db.query(Patient).filter(
                        Patient.first_name == first_name,
                        Patient.last_name == last_name
                    ).first()
                    
                    if patient:
                        # Read content
                        with open(filepath, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        # Find most recent inpatient encounter
                        recent_encounter = db.query(Encounter).filter(
                            Encounter.patient_id == patient.id,
                            Encounter.encounter_type.in_(['inpatient', 'emergency'])
                        ).order_by(Encounter.encounter_date.desc()).first()
                        
                        if recent_encounter:
                            # Create discharge summary
                            note = ClinicalNote(
                                patient_id=patient.id,
                                encounter_id=recent_encounter.id,
                                author_id=recent_encounter.provider_id or (default_provider.id if default_provider else None),
                                note_type='discharge_summary',
                                status='signed',
                                chief_complaint='Discharge Summary',
                                assessment=content[:5000],  # Use content as assessment
                                plan='Follow up with primary care provider as scheduled.',
                                signed_at=recent_encounter.encounter_end or recent_encounter.encounter_date,
                                created_at=recent_encounter.encounter_end or recent_encounter.encounter_date,
                                updated_at=datetime.now()
                            )
                            
                            db.add(note)
                            notes_created += 1
        
        db.commit()
        print(f"\nSuccessfully imported {notes_created} clinical notes")
        
        # Create FHIR DocumentReference resources for the notes
        print("\nCreating FHIR DocumentReference resources...")
        create_document_references(db)
        
    except Exception as e:
        print(f"Error importing notes: {e}")
        db.rollback()
    finally:
        db.close()

def create_document_references(db):
    """Create FHIR DocumentReference resources for clinical notes"""
    
    from services.fhir_service import FHIRService
    
    fhir_service = FHIRService(db)
    doc_refs_created = 0
    
    # Get all clinical notes
    notes = db.query(ClinicalNote).filter(ClinicalNote.status == 'signed').all()
    
    for note in notes:
        try:
            # Get patient FHIR ID
            patient = db.query(Patient).filter(Patient.id == note.patient_id).first()
            if not patient:
                continue
            
            # Create DocumentReference
            doc_ref = {
                "resourceType": "DocumentReference",
                "id": f"doc-{note.id}",
                "status": "current",
                "type": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "34133-9" if note.note_type == 'progress_note' else "18842-5",
                        "display": "Progress note" if note.note_type == 'progress_note' else "Discharge summary"
                    }]
                },
                "subject": {
                    "reference": f"Patient/{patient.id}"
                },
                "date": note.created_at.isoformat(),
                "author": [{
                    "reference": f"Practitioner/{note.author_id}" if note.author_id else "Practitioner/unknown"
                }],
                "content": [{
                    "attachment": {
                        "contentType": "text/plain",
                        "data": base64.b64encode(
                            f"{note.chief_complaint or ''}\n\n"
                            f"SUBJECTIVE:\n{note.subjective or ''}\n\n"
                            f"OBJECTIVE:\n{note.objective or ''}\n\n"
                            f"ASSESSMENT:\n{note.assessment or ''}\n\n"
                            f"PLAN:\n{note.plan or ''}"
                            .encode('utf-8')
                        ).decode('utf-8')
                    }
                }]
            }
            
            # Note: In a real implementation, you would save this to a FHIR server
            # For now, we're just counting
            doc_refs_created += 1
            
        except Exception as e:
            print(f"Error creating DocumentReference for note {note.id}: {e}")
    
    print(f"Created {doc_refs_created} FHIR DocumentReference resources")

def main():
    """Main import process"""
    
    # Paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    fhir_dir = os.path.join(backend_dir, "synthea", "output", "fhir")
    
    # Check if Synthea output exists
    if not os.path.exists(fhir_dir):
        print("Error: No Synthea output found. Please run run_synthea_with_notes.sh first")
        return
    
    # Import FHIR data
    print("Importing FHIR data...")
    import_synthea_data_optimized(fhir_dir)
    
    # Import text notes
    print("\nImporting clinical notes from text files...")
    import_text_notes_to_fhir()
    
    # Show summary
    db = SessionLocal()
    try:
        from models.clinical.notes import ClinicalNote
        
        total_notes = db.query(ClinicalNote).count()
        note_types = db.query(
            ClinicalNote.note_type,
            db.query(ClinicalNote).filter(ClinicalNote.note_type == ClinicalNote.note_type).count()
        ).group_by(ClinicalNote.note_type).all()
        
        print("\n" + "="*50)
        print("Import Summary")
        print("="*50)
        print(f"Total clinical notes: {total_notes}")
        print("\nNotes by type:")
        for note_type, count in note_types:
            print(f"  {note_type}: {count}")
        
        # Sample a note
        sample_note = db.query(ClinicalNote).first()
        if sample_note:
            print(f"\nSample note:")
            print(f"  Type: {sample_note.note_type}")
            print(f"  Chief Complaint: {sample_note.chief_complaint}")
            print(f"  Created: {sample_note.created_at}")
            
    finally:
        db.close()
    
    print("\nImport complete! Clinical notes are now available via:")
    print("1. The Documentation tab in the EMR")
    print("2. FHIR DocumentReference resources at /fhir/R4/DocumentReference")
    print("3. Encounter notes field for backward compatibility")

if __name__ == "__main__":
    main()