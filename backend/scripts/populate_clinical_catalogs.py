#!/usr/bin/env python3
"""
Script to populate clinical catalogs with sample data for CPOE functionality
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database.database import get_db, engine
from models.clinical.catalogs import MedicationCatalog, LabTestCatalog, ImagingStudyCatalog, ClinicalOrderSet


def populate_medication_catalog(db: Session):
    """Populate medication catalog with common medications"""
    medications = [
        {
            "generic_name": "Lisinopril",
            "brand_name": "Prinivil",
            "strength": "10mg",
            "dosage_form": "tablet",
            "drug_class": "ACE Inhibitor",
            "therapeutic_category": "Cardiovascular",
            "route": "oral",
            "frequency_options": ["once daily", "twice daily"],
            "standard_doses": ["5mg", "10mg", "20mg", "40mg"],
            "rxnorm_code": "314076",
            "is_formulary": True
        },
        {
            "generic_name": "Metformin",
            "brand_name": "Glucophage",
            "strength": "500mg",
            "dosage_form": "tablet",
            "drug_class": "Biguanide",
            "therapeutic_category": "Endocrine",
            "route": "oral",
            "frequency_options": ["once daily", "twice daily", "three times daily"],
            "standard_doses": ["500mg", "850mg", "1000mg"],
            "rxnorm_code": "6809",
            "is_formulary": True
        },
        {
            "generic_name": "Amoxicillin",
            "brand_name": "Amoxil",
            "strength": "500mg",
            "dosage_form": "capsule",
            "drug_class": "Penicillin",
            "therapeutic_category": "Anti-infective",
            "route": "oral",
            "frequency_options": ["twice daily", "three times daily"],
            "standard_doses": ["250mg", "500mg", "875mg"],
            "rxnorm_code": "723",
            "is_formulary": True
        },
        {
            "generic_name": "Ibuprofen",
            "brand_name": "Advil",
            "strength": "600mg",
            "dosage_form": "tablet",
            "drug_class": "NSAID",
            "therapeutic_category": "Analgesic",
            "route": "oral",
            "frequency_options": ["as needed", "twice daily", "three times daily", "four times daily"],
            "standard_doses": ["200mg", "400mg", "600mg", "800mg"],
            "rxnorm_code": "5640",
            "max_daily_dose": "3200mg",
            "is_formulary": True
        },
        {
            "generic_name": "Atorvastatin",
            "brand_name": "Lipitor",
            "strength": "20mg",
            "dosage_form": "tablet",
            "drug_class": "Statin",
            "therapeutic_category": "Cardiovascular",
            "route": "oral",
            "frequency_options": ["once daily"],
            "standard_doses": ["10mg", "20mg", "40mg", "80mg"],
            "rxnorm_code": "83367",
            "is_formulary": True
        },
        {
            "generic_name": "Morphine",
            "brand_name": "MS Contin",
            "strength": "15mg",
            "dosage_form": "tablet",
            "drug_class": "Opioid Analgesic",
            "therapeutic_category": "Analgesic",
            "route": "oral",
            "frequency_options": ["every 4 hours", "every 6 hours", "twice daily"],
            "standard_doses": ["15mg", "30mg", "60mg", "100mg"],
            "rxnorm_code": "7052",
            "is_controlled_substance": True,
            "controlled_substance_schedule": "II",
            "requires_authorization": True,
            "is_formulary": True
        },
        {
            "generic_name": "Albuterol",
            "brand_name": "ProAir",
            "strength": "90mcg",
            "dosage_form": "inhaler",
            "drug_class": "Beta-2 Agonist",
            "therapeutic_category": "Respiratory",
            "route": "inhalation",
            "frequency_options": ["as needed", "every 4 hours", "every 6 hours"],
            "standard_doses": ["90mcg per puff"],
            "rxnorm_code": "435",
            "is_formulary": True
        },
        {
            "generic_name": "Furosemide",
            "brand_name": "Lasix",
            "strength": "40mg",
            "dosage_form": "tablet",
            "drug_class": "Loop Diuretic",
            "therapeutic_category": "Cardiovascular",
            "route": "oral",
            "frequency_options": ["once daily", "twice daily"],
            "standard_doses": ["20mg", "40mg", "80mg"],
            "rxnorm_code": "4603",
            "is_formulary": True
        }
    ]
    
    for med_data in medications:
        medication = MedicationCatalog(**med_data)
        db.add(medication)
    
    print(f"Added {len(medications)} medications to catalog")


def populate_lab_test_catalog(db: Session):
    """Populate lab test catalog with common tests"""
    lab_tests = [
        {
            "test_name": "Complete Blood Count with Differential",
            "test_code": "CBC_DIFF",
            "test_description": "Complete blood count with white blood cell differential",
            "test_category": "Hematology",
            "test_panel": "Complete Blood Count",
            "specimen_type": "Blood",
            "loinc_code": "57021-8",
            "cpt_code": "85025",
            "fasting_required": False,
            "stat_available": True,
            "typical_turnaround_time": "2-4 hours",
            "container_type": "Lavender top (EDTA)"
        },
        {
            "test_name": "Basic Metabolic Panel",
            "test_code": "BMP",
            "test_description": "Glucose, BUN, creatinine, electrolytes",
            "test_category": "Chemistry",
            "test_panel": "Basic Metabolic Panel",
            "specimen_type": "Blood",
            "loinc_code": "51990-0",
            "cpt_code": "80048",
            "fasting_required": True,
            "stat_available": True,
            "typical_turnaround_time": "1-2 hours",
            "container_type": "Green top (Lithium Heparin)"
        },
        {
            "test_name": "Lipid Panel",
            "test_code": "LIPID",
            "test_description": "Total cholesterol, HDL, LDL, triglycerides",
            "test_category": "Chemistry",
            "test_panel": "Lipid Panel",
            "specimen_type": "Blood",
            "loinc_code": "57698-3",
            "cpt_code": "80061",
            "fasting_required": True,
            "stat_available": False,
            "typical_turnaround_time": "4-6 hours",
            "container_type": "Red top"
        },
        {
            "test_name": "Thyroid Stimulating Hormone",
            "test_code": "TSH",
            "test_description": "Thyroid stimulating hormone",
            "test_category": "Endocrinology",
            "specimen_type": "Blood",
            "loinc_code": "3016-3",
            "cpt_code": "84443",
            "fasting_required": False,
            "stat_available": True,
            "typical_turnaround_time": "2-4 hours",
            "reference_range_low": 0.4,
            "reference_range_high": 4.0,
            "reference_units": "mIU/L",
            "container_type": "Red top"
        },
        {
            "test_name": "Hemoglobin A1c",
            "test_code": "HBA1C",
            "test_description": "Glycated hemoglobin (3-month glucose average)",
            "test_category": "Chemistry",
            "specimen_type": "Blood",
            "loinc_code": "4548-4",
            "cpt_code": "83036",
            "fasting_required": False,
            "stat_available": False,
            "typical_turnaround_time": "4-6 hours",
            "reference_range_high": 5.7,
            "reference_units": "%",
            "container_type": "Lavender top (EDTA)"
        },
        {
            "test_name": "Urinalysis with Microscopy",
            "test_code": "UA_MICRO",
            "test_description": "Complete urinalysis with microscopic examination",
            "test_category": "Urinalysis",
            "specimen_type": "Urine",
            "loinc_code": "24357-6",
            "cpt_code": "81001",
            "fasting_required": False,
            "stat_available": True,
            "typical_turnaround_time": "1-2 hours",
            "container_type": "Sterile urine cup"
        },
        {
            "test_name": "Prothrombin Time/INR",
            "test_code": "PT_INR",
            "test_description": "Prothrombin time and international normalized ratio",
            "test_category": "Coagulation",
            "specimen_type": "Blood",
            "loinc_code": "46418-0",
            "cpt_code": "85610",
            "fasting_required": False,
            "stat_available": True,
            "typical_turnaround_time": "1-2 hours",
            "reference_range_low": 0.8,
            "reference_range_high": 1.2,
            "reference_units": "ratio",
            "container_type": "Blue top (Sodium Citrate)"
        },
        {
            "test_name": "Blood Culture",
            "test_code": "BLOOD_CX",
            "test_description": "Aerobic and anaerobic blood culture",
            "test_category": "Microbiology",
            "specimen_type": "Blood",
            "loinc_code": "600-7",
            "cpt_code": "87040",
            "fasting_required": False,
            "stat_available": True,
            "typical_turnaround_time": "24-48 hours",
            "special_instructions": "Collect before antibiotics if possible",
            "container_type": "Blood culture bottles"
        }
    ]
    
    for test_data in lab_tests:
        test = LabTestCatalog(**test_data)
        db.add(test)
    
    print(f"Added {len(lab_tests)} lab tests to catalog")


def populate_imaging_catalog(db: Session):
    """Populate imaging study catalog"""
    imaging_studies = [
        {
            "study_name": "Chest X-Ray",
            "study_code": "CXR",
            "study_description": "Chest radiograph, 2 views",
            "modality": "X-Ray",
            "body_part": "Chest",
            "study_type": "2 views",
            "cpt_code": "71020",
            "contrast_required": False,
            "typical_duration": "15 minutes",
            "typical_turnaround_time": "30 minutes"
        },
        {
            "study_name": "CT Head without Contrast",
            "study_code": "CT_HEAD_WO",
            "study_description": "CT scan of head without contrast",
            "modality": "CT",
            "body_part": "Head",
            "study_type": "Without contrast",
            "cpt_code": "70460",
            "contrast_required": False,
            "typical_duration": "30 minutes",
            "typical_turnaround_time": "1-2 hours"
        },
        {
            "study_name": "CT Abdomen/Pelvis with Contrast",
            "study_code": "CT_ABD_PELV_W",
            "study_description": "CT scan of abdomen and pelvis with IV contrast",
            "modality": "CT",
            "body_part": "Abdomen/Pelvis",
            "study_type": "With contrast",
            "cpt_code": "74177",
            "contrast_required": True,
            "prep_instructions": "NPO 4 hours prior to exam. Check creatinine.",
            "contraindications": "Severe kidney disease, contrast allergy",
            "typical_duration": "45 minutes",
            "typical_turnaround_time": "2-4 hours"
        },
        {
            "study_name": "MRI Brain without Contrast",
            "study_code": "MRI_BRAIN_WO",
            "study_description": "MRI of brain without contrast",
            "modality": "MRI",
            "body_part": "Brain",
            "study_type": "Without contrast",
            "cpt_code": "70551",
            "contrast_required": False,
            "prep_instructions": "Remove all metal objects. Notify of pacemaker/implants.",
            "contraindications": "Pacemaker, certain implants",
            "typical_duration": "60 minutes",
            "typical_turnaround_time": "4-6 hours"
        },
        {
            "study_name": "Echocardiogram",
            "study_code": "ECHO",
            "study_description": "Transthoracic echocardiogram",
            "modality": "Ultrasound",
            "body_part": "Heart",
            "study_type": "Transthoracic",
            "cpt_code": "93306",
            "contrast_required": False,
            "typical_duration": "45 minutes",
            "typical_turnaround_time": "2-4 hours"
        },
        {
            "study_name": "Abdominal Ultrasound",
            "study_code": "US_ABD",
            "study_description": "Ultrasound of abdomen",
            "modality": "Ultrasound",
            "body_part": "Abdomen",
            "cpt_code": "76700",
            "contrast_required": False,
            "prep_instructions": "NPO 8 hours for gallbladder evaluation",
            "typical_duration": "30 minutes",
            "typical_turnaround_time": "1-2 hours"
        }
    ]
    
    for study_data in imaging_studies:
        study = ImagingStudyCatalog(**study_data)
        db.add(study)
    
    print(f"Added {len(imaging_studies)} imaging studies to catalog")


def populate_order_sets(db: Session):
    """Populate order sets for common clinical scenarios"""
    order_sets = [
        {
            "name": "Chest Pain Workup",
            "description": "Initial workup for patient with chest pain",
            "clinical_indication": "Chest Pain",
            "specialty": "Emergency Medicine",
            "orders": {
                "lab_tests": [
                    {"test_code": "CBC_DIFF", "urgency": "routine"},
                    {"test_code": "BMP", "urgency": "routine"},
                    {"test_code": "PT_INR", "urgency": "routine"}
                ],
                "imaging": [
                    {"study_code": "CXR", "urgency": "routine"}
                ]
            }
        },
        {
            "name": "Diabetes Management",
            "description": "Routine monitoring for diabetes patients",
            "clinical_indication": "Diabetes Mellitus",
            "specialty": "Endocrinology",
            "orders": {
                "lab_tests": [
                    {"test_code": "HBA1C", "urgency": "routine"},
                    {"test_code": "BMP", "urgency": "routine"},
                    {"test_code": "LIPID", "urgency": "routine"}
                ],
                "medications": [
                    {"generic_name": "Metformin", "dose": "500mg", "frequency": "twice daily"}
                ]
            }
        },
        {
            "name": "Hypertension Management",
            "description": "Initial treatment for hypertension",
            "clinical_indication": "Hypertension",
            "specialty": "Primary Care",
            "orders": {
                "medications": [
                    {"generic_name": "Lisinopril", "dose": "10mg", "frequency": "once daily"}
                ],
                "lab_tests": [
                    {"test_code": "BMP", "urgency": "routine"}
                ]
            }
        }
    ]
    
    for order_set_data in order_sets:
        order_set = ClinicalOrderSet(**order_set_data)
        db.add(order_set)
    
    print(f"Added {len(order_sets)} order sets")


def main():
    """Main function to populate all catalogs"""
    print("Populating clinical catalogs...")
    
    # Create tables
    from models.clinical.catalogs import Base
    Base.metadata.create_all(bind=engine)
    
    # Get database session
    db = next(get_db())
    
    try:
        # Clear existing data
        db.query(MedicationCatalog).delete()
        db.query(LabTestCatalog).delete()
        db.query(ImagingStudyCatalog).delete()
        db.query(ClinicalOrderSet).delete()
        
        # Populate catalogs
        populate_medication_catalog(db)
        populate_lab_test_catalog(db)
        populate_imaging_catalog(db)
        populate_order_sets(db)
        
        # Commit changes
        db.commit()
        print("✓ Successfully populated all clinical catalogs")
        
    except Exception as e:
        print(f"✗ Error populating catalogs: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()