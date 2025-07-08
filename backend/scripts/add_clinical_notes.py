#!/usr/bin/env python3
"""
Add sample clinical notes to existing patients
"""

import os
import sys
from datetime import datetime, timedelta
import random

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal
from models.clinical.notes import ClinicalNote
from models.synthea_models import Patient, Provider, Encounter
import logging


# Sample note templates
PROGRESS_NOTE_TEMPLATES = [
    {
        "chief_complaint": "Follow-up visit for diabetes management",
        "subjective": """Patient reports feeling well overall. Blood sugar levels have been stable with current medication regimen. 
Denies polyuria, polydipsia, or unexplained weight loss. Reports occasional mild fatigue after meals.
Adherent to prescribed medications and dietary recommendations.
Checking blood glucose twice daily as instructed.""",
        "objective": """Vital Signs: BP 128/78, HR 72, RR 16, Temp 98.6°F, SpO2 98% on RA
General: Alert and oriented x3, in no acute distress
HEENT: PERRLA, EOMI, oropharynx clear
Cardiovascular: RRR, no murmurs/rubs/gallops
Pulmonary: CTAB, no wheezes/rales/rhonchi
Extremities: No edema, pedal pulses intact bilaterally
Skin: Warm and dry, no lesions
Neurological: CN II-XII intact, sensation intact to light touch""",
        "assessment": """Type 2 Diabetes Mellitus (E11.9) - Well controlled on current regimen
- HbA1c 6.8% (improved from 7.2% three months ago)
- No evidence of diabetic complications
- Good medication adherence""",
        "plan": """1. Continue metformin 1000mg PO BID
2. Continue lifestyle modifications (diet and exercise)
3. Recheck HbA1c in 3 months
4. Annual diabetic eye exam - referral placed
5. Annual nephropathy screening ordered
6. Continue home glucose monitoring
7. Return to clinic in 3 months or sooner if concerns"""
    },
    {
        "chief_complaint": "Hypertension follow-up",
        "subjective": """Patient presents for routine blood pressure check. Reports compliance with medications.
Denies headaches, chest pain, shortness of breath, or palpitations.
Has been monitoring BP at home with readings averaging 130s/80s.
Following low sodium diet as discussed. Walking 30 minutes daily.""",
        "objective": """Vital Signs: BP 134/82 (left arm, sitting), HR 68, RR 14, Temp 98.4°F
General: Well-appearing, no acute distress
Cardiovascular: Regular rate and rhythm, no murmurs
Pulmonary: Clear to auscultation bilaterally
Extremities: No peripheral edema""",
        "assessment": """Essential Hypertension (I10) - Improved control
- BP at goal on current medication
- No evidence of end-organ damage
- Good lifestyle modification adherence""",
        "plan": """1. Continue lisinopril 10mg daily
2. Continue DASH diet and regular exercise
3. Home BP monitoring - log readings
4. Basic metabolic panel in 6 months
5. Follow up in 3 months"""
    },
    {
        "chief_complaint": "Annual wellness visit",
        "subjective": """Patient here for annual preventive care visit. Generally feeling well.
No new complaints or concerns. Denies constitutional symptoms.
Up to date with recommended screenings. Takes daily multivitamin.
Exercises regularly, 3-4 times per week. Non-smoker, occasional alcohol.""",
        "objective": """Vital Signs: BP 118/76, HR 66, RR 14, Temp 98.2°F, BMI 24.5
General: Healthy-appearing adult in no distress
HEENT: Normocephalic, atraumatic, PERRLA
Neck: Supple, no lymphadenopathy or thyromegaly
Cardiovascular: RRR, no murmurs
Pulmonary: CTAB
Abdomen: Soft, non-tender, no masses
Skin: No concerning lesions""",
        "assessment": """Annual health maintenance exam
- No acute issues identified
- Health maintenance up to date
- Low cardiovascular risk""",
        "plan": """1. Continue current health maintenance
2. Lipid panel ordered
3. Colonoscopy screening discussed (due next year)
4. Influenza vaccine administered today
5. Continue regular exercise and healthy diet
6. Follow up in 1 year or as needed"""
    },
    {
        "chief_complaint": "Acute upper respiratory infection",
        "subjective": """Patient presents with 3-day history of nasal congestion, sore throat, and mild cough.
Denies fever, shortness of breath, or chest pain. No sick contacts identified.
Symptoms started gradually. Using OTC acetaminophen with minimal relief.
Denies ear pain or sinus pressure. Mild fatigue noted.""",
        "objective": """Vital Signs: BP 122/78, HR 74, RR 16, Temp 99.1°F, SpO2 98%
General: Mildly ill-appearing but in no acute distress
HEENT: Mild pharyngeal erythema, no exudate, TMs clear bilaterally
Neck: No lymphadenopathy
Pulmonary: Clear to auscultation, no wheezes
Cardiovascular: RRR, no murmurs""",
        "assessment": """Acute viral upper respiratory infection (J06.9)
- Likely viral etiology
- No signs of bacterial infection
- No evidence of complications""",
        "plan": """1. Supportive care - rest, fluids, humidification
2. Continue acetaminophen PRN for comfort
3. Can add pseudoephedrine for congestion if needed
4. Return if symptoms worsen or persist >10 days
5. Return precautions discussed (fever >103°F, SOB, chest pain)"""
    },
    {
        "chief_complaint": "Medication refill visit",
        "subjective": """Patient requests refill of chronic medications. Reports stable symptoms on current regimen.
No side effects noted. Good medication compliance. No new concerns today.
Continues to follow previously discussed lifestyle modifications.""",
        "objective": """Vital Signs: BP 126/80, HR 70, RR 14
Brief focused exam performed, no acute findings
Patient appears well""",
        "assessment": """Stable chronic conditions on current medication regimen
- No medication adjustments needed
- Good therapeutic response""",
        "plan": """1. Refilled all chronic medications for 90 days
2. Continue current management plan
3. Routine follow-up in 3 months
4. Labs due at next visit"""
    }
]

SPECIALTY_NOTES = {
    "admission_note": {
        "chief_complaint": "Admitted for management of community-acquired pneumonia",
        "history_present_illness": """72-year-old male with history of COPD presents to ED with 4-day history of productive cough,
fever to 101.5°F, and increasing dyspnea. Started with mild URI symptoms which progressively worsened.
Yellow-green sputum production noted. Using accessory muscles at rest. Home O2 requirement increased from 2L to 4L.
Denies chest pain, hemoptysis, or recent travel. Last hospitalization 8 months ago for COPD exacerbation.""",
        "review_of_systems": {
            "Constitutional": "Positive for fever, chills, fatigue",
            "Respiratory": "Positive for cough, dyspnea, sputum production",
            "Cardiovascular": "Negative for chest pain, palpitations",
            "Gastrointestinal": "Mild decreased appetite, no nausea/vomiting",
            "Genitourinary": "No dysuria or frequency",
            "Neurological": "No headache, dizziness, or confusion"
        },
        "physical_exam": {
            "General": "Ill-appearing elderly male in mild respiratory distress",
            "Vital Signs": "T 100.8°F, BP 142/88, HR 98, RR 24, SpO2 89% on 4L NC",
            "HEENT": "Dry mucous membranes, no pharyngeal erythema",
            "Pulmonary": "Decreased breath sounds right lower lobe, crackles present, using accessory muscles",
            "Cardiovascular": "Tachycardic, regular rhythm, no murmurs",
            "Abdomen": "Soft, non-tender, no distention",
            "Extremities": "No edema, no cyanosis"
        },
        "assessment": """1. Community-acquired pneumonia - likely bacterial etiology given presentation
2. COPD exacerbation secondary to pneumonia
3. Hypoxemia requiring supplemental oxygen""",
        "plan": """1. Admit to medical floor with telemetry monitoring
2. IV antibiotics - ceftriaxone and azithromycin
3. Bronchodilators - albuterol/ipratropium nebulizers Q4H
4. Prednisone 40mg daily x 5 days
5. Supplemental oxygen to maintain SpO2 >92%
6. Chest X-ray completed, blood cultures pending
7. Monitor respiratory status closely
8. DVT prophylaxis with heparin SQ
9. Incentive spirometry
10. ID consultation if no improvement in 48 hours"""
    },
    "discharge_summary": {
        "chief_complaint": "Discharge summary following treatment for acute cholecystitis",
        "assessment": """HOSPITAL COURSE:
Patient was admitted with acute cholecystitis confirmed by ultrasound showing gallbladder wall thickening,
pericholecystic fluid, and multiple gallstones. Initially treated with IV antibiotics and bowel rest.
Pain well-controlled with scheduled acetaminophen and PRN opioids. Diet advanced slowly without complications.
Surgical consultation obtained, recommended elective cholecystectomy in 6-8 weeks after inflammation resolves.

DISCHARGE DIAGNOSIS:
1. Acute calculous cholecystitis - resolved
2. Cholelithiasis

DISCHARGE CONDITION:
Stable, tolerating regular diet, pain controlled on oral medications""",
        "plan": """DISCHARGE INSTRUCTIONS:
1. Medications:
   - Augmentin 875mg PO BID x 7 days (4 days remaining)
   - Acetaminophen 650mg PO Q6H PRN pain
   - Omeprazole 20mg PO daily
   
2. Diet: Low-fat diet until surgery
3. Activity: As tolerated, no heavy lifting >10 lbs
4. Follow-up:
   - Primary care in 1 week
   - General surgery in 2 weeks for surgical planning
   
5. Return to ED if: Fever, severe abdominal pain, persistent vomiting, jaundice"""
    }
}

def create_clinical_notes():
    """Create sample clinical notes for existing patients"""
    db = SessionLocal()
    
    try:
        # Get all patients
        patients = db.query(Patient).all()
        if not patients:
            logging.info("No patients found. Please run patient generation first.")
            return
        
        # Get all providers
        providers = db.query(Provider).all()
        if not providers:
            logging.info("No providers found. Please run provider generation first.")
            return
        
        notes_created = 0
        
        # Create notes for each patient
        for patient in patients:
            # Get patient's encounters
            encounters = db.query(Encounter).filter(
                Encounter.patient_id == patient.id
            ).order_by(Encounter.encounter_date.desc()).limit(5).all()
            
            if not encounters:
                logging.info(f"No encounters found for patient {patient.first_name} {patient.last_name}")
                continue
            
            # Create 2-3 progress notes for recent encounters
            for i, encounter in enumerate(encounters[:3]):
                # Skip if encounter already has a note
                existing_note = db.query(ClinicalNote).filter(
                    ClinicalNote.encounter_id == encounter.id
                ).first()
                if existing_note:
                    continue
                
                # Select random template
                template = random.choice(PROGRESS_NOTE_TEMPLATES)
                
                # Create progress note
                note = ClinicalNote(
                    patient_id=patient.id,
                    encounter_id=encounter.id,
                    author_id=encounter.provider_id or random.choice(providers).id,
                    note_type='progress_note',
                    status='signed',
                    chief_complaint=template["chief_complaint"],
                    subjective=template["subjective"],
                    objective=template["objective"],
                    assessment=template["assessment"],
                    plan=template["plan"],
                    signed_at=encounter.encounter_date + timedelta(hours=1),
                    created_at=encounter.encounter_date,
                    updated_at=encounter.encounter_date + timedelta(hours=1)
                )
                
                db.add(note)
                notes_created += 1
            
            # Add one specialty note (admission or discharge) for patients with hospitalizations
            hospital_encounters = [e for e in encounters if e.encounter_type in ['emergency', 'inpatient']]
            if hospital_encounters:
                encounter = hospital_encounters[0]
                
                # Randomly choose admission or discharge note
                if random.choice([True, False]):
                    note_type = 'admission_note'
                    template = SPECIALTY_NOTES['admission_note']
                    note_time = encounter.encounter_date
                else:
                    note_type = 'discharge_summary'
                    template = SPECIALTY_NOTES['discharge_summary']
                    note_time = encounter.encounter_date + timedelta(days=random.randint(2, 5))
                
                note = ClinicalNote(
                    patient_id=patient.id,
                    encounter_id=encounter.id,
                    author_id=encounter.provider_id or random.choice(providers).id,
                    note_type=note_type,
                    status='signed',
                    chief_complaint=template.get('chief_complaint', ''),
                    history_present_illness=template.get('history_present_illness', ''),
                    review_of_systems=template.get('review_of_systems', {}),
                    physical_exam=template.get('physical_exam', {}),
                    assessment=template.get('assessment', ''),
                    plan=template.get('plan', ''),
                    signed_at=note_time + timedelta(hours=2),
                    created_at=note_time,
                    updated_at=note_time + timedelta(hours=2)
                )
                
                db.add(note)
                notes_created += 1
            
            # Commit every 10 notes
            if notes_created % 10 == 0:
                db.commit()
                logging.info(f"Created {notes_created} clinical notes...")
        # Final commit
        db.commit()
        logging.info(f"\nSuccessfully created {notes_created} clinical notes!")
        # Show summary
        note_counts = db.query(
            ClinicalNote.note_type,
            db.query(ClinicalNote).filter(ClinicalNote.note_type == ClinicalNote.note_type).count()
        ).group_by(ClinicalNote.note_type).all()
        
        logging.info("\nNote summary by type:")
        for note_type, count in note_counts:
            logging.info(f"  {note_type}: {count}")
    except Exception as e:
        logging.error(f"Error creating clinical notes: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    logging.info("Adding clinical notes to existing patients...")
    create_clinical_notes()