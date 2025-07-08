#!/usr/bin/env python3
"""
Script to add reference ranges and interpretations to existing lab data
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database.database import get_db, engine
from models.synthea_models import Observation
import random
import logging



def add_reference_ranges_and_interpretations(db: Session):
    """Add reference ranges and interpretations to existing observations"""
    
    # Define reference ranges for common lab tests
    reference_ranges = {
        "6690-2": {"name": "WBC", "low": 4.0, "high": 11.0, "unit": "10*3/uL"},
        "789-8": {"name": "RBC", "low": 4.2, "high": 5.4, "unit": "10*6/uL"},
        "718-7": {"name": "Hemoglobin", "low": 12.0, "high": 16.0, "unit": "g/dL"},
        "4544-3": {"name": "Hematocrit", "low": 36.0, "high": 48.0, "unit": "%"},
        "787-2": {"name": "MCV", "low": 80.0, "high": 100.0, "unit": "fL"},
        "785-6": {"name": "MCH", "low": 27.0, "high": 33.0, "unit": "pg"},
        "786-4": {"name": "MCHC", "low": 32.0, "high": 36.0, "unit": "g/dL"},
        "777-3": {"name": "Platelets", "low": 150.0, "high": 450.0, "unit": "10*3/uL"},
        "2093-3": {"name": "Cholesterol", "low": 0.0, "high": 200.0, "unit": "mg/dL"},
        "2085-9": {"name": "HDL Cholesterol", "low": 40.0, "high": 999.0, "unit": "mg/dL"},
        "13457-7": {"name": "LDL Cholesterol", "low": 0.0, "high": 100.0, "unit": "mg/dL"},
        "2571-8": {"name": "Triglycerides", "low": 0.0, "high": 150.0, "unit": "mg/dL"},
        "33747-0": {"name": "Glucose", "low": 70.0, "high": 100.0, "unit": "mg/dL"},
        "3016-3": {"name": "TSH", "low": 0.4, "high": 4.0, "unit": "mIU/L"},
        "4548-4": {"name": "HbA1c", "low": 0.0, "high": 5.7, "unit": "%"},
        "6768-6": {"name": "Alkaline Phosphatase", "low": 44.0, "high": 147.0, "unit": "U/L"},
        "1742-6": {"name": "ALT", "low": 7.0, "high": 56.0, "unit": "U/L"},
        "1920-8": {"name": "AST", "low": 10.0, "high": 40.0, "unit": "U/L"},
        "1975-2": {"name": "Bilirubin", "low": 0.2, "high": 1.2, "unit": "mg/dL"},
        "2160-0": {"name": "Creatinine", "low": 0.6, "high": 1.2, "unit": "mg/dL"},
        "3094-0": {"name": "BUN", "low": 7.0, "high": 20.0, "unit": "mg/dL"},
        "2947-0": {"name": "Sodium", "low": 136.0, "high": 145.0, "unit": "mEq/L"},
        "2823-3": {"name": "Potassium", "low": 3.5, "high": 5.1, "unit": "mEq/L"},
        "2075-0": {"name": "Chloride", "low": 98.0, "high": 107.0, "unit": "mEq/L"},
        "2028-9": {"name": "CO2", "low": 22.0, "high": 28.0, "unit": "mEq/L"},
    }
    
    # Get all laboratory observations that have numeric values
    observations = db.query(Observation).filter(
        Observation.observation_type == 'laboratory',
        Observation.value_quantity.isnot(None)
    ).all()
    
    updated_count = 0
    
    for obs in observations:
        if obs.loinc_code in reference_ranges:
            ref_range = reference_ranges[obs.loinc_code]
            
            # Add reference ranges
            obs.reference_range_low = ref_range["low"]
            obs.reference_range_high = ref_range["high"]
            
            # Calculate interpretation based on value
            if obs.value_quantity is not None:
                if obs.value_quantity < ref_range["low"]:
                    obs.interpretation = "low"
                elif obs.value_quantity > ref_range["high"]:
                    obs.interpretation = "high"
                else:
                    obs.interpretation = "normal"
            
            updated_count += 1
    
    # Add some random abnormal values for demonstration
    demo_observations = [
        {
            "loinc_code": "718-7",
            "display": "Hemoglobin [Mass/volume] in Blood",
            "value_quantity": 8.5,  # Low
            "value_unit": "g/dL",
            "interpretation": "low",
            "reference_range_low": 12.0,
            "reference_range_high": 16.0
        },
        {
            "loinc_code": "2093-3", 
            "display": "Cholesterol [Mass/volume] in Serum or Plasma",
            "value_quantity": 250.0,  # High
            "value_unit": "mg/dL",
            "interpretation": "high",
            "reference_range_low": 0.0,
            "reference_range_high": 200.0
        },
        {
            "loinc_code": "33747-0",
            "display": "Glucose [Mass/volume] in Blood",
            "value_quantity": 180.0,  # High
            "value_unit": "mg/dL", 
            "interpretation": "high",
            "reference_range_low": 70.0,
            "reference_range_high": 100.0
        }
    ]
    
    # Add demo observations to a few patients
    sample_patients = db.query(Observation).filter(
        Observation.observation_type == 'laboratory'
    ).limit(3).all()
    
    for i, patient_obs in enumerate(sample_patients):
        if i < len(demo_observations):
            demo_data = demo_observations[i]
            new_obs = Observation(
                patient_id=patient_obs.patient_id,
                encounter_id=patient_obs.encounter_id,
                observation_type='laboratory',
                loinc_code=demo_data["loinc_code"],
                display=demo_data["display"],
                value=f"{demo_data['value_quantity']} {demo_data['value_unit']}",
                value_quantity=demo_data["value_quantity"],
                value_unit=demo_data["value_unit"],
                interpretation=demo_data["interpretation"],
                reference_range_low=demo_data["reference_range_low"],
                reference_range_high=demo_data["reference_range_high"],
                observation_date=patient_obs.observation_date
            )
            db.add(new_obs)
            updated_count += 1
    
    db.commit()
    logging.info(f"✓ Updated {updated_count} observations with reference ranges and interpretations")
def main():
    """Main function"""
    logging.info("Adding reference ranges and interpretations to lab data...")
    db = next(get_db())
    try:
        add_reference_ranges_and_interpretations(db)
        logging.info("✓ Successfully updated lab data with reference ranges")
    except Exception as e:
        logging.error(f"✗ Error updating lab data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()