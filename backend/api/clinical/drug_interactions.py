"""
Drug Interaction Service
Provides drug interaction checking functionality
"""

from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db_session as get_db

router = APIRouter()

# In-memory drug interaction database
# In production, this would be from a proper drug interaction database
DRUG_INTERACTIONS = {
    "warfarin-aspirin": {
        "drugs": ["warfarin", "aspirin"],
        "rxnorm_codes": ["855332", "243670"],
        "severity": "major",
        "description": "Increased risk of bleeding",
        "clinical_consequence": "The combination of warfarin and aspirin significantly increases the risk of bleeding complications. Monitor INR more frequently and consider alternative antiplatelet therapy.",
        "management": "Monitor for signs of bleeding. Reduce warfarin dose if necessary. Consider using clopidogrel as alternative."
    },
    "warfarin-nsaids": {
        "drugs": ["warfarin", "ibuprofen", "naproxen"],
        "rxnorm_codes": ["855332", "197805", "198013"],
        "severity": "major",
        "description": "Increased risk of bleeding",
        "clinical_consequence": "NSAIDs can increase the anticoagulant effect of warfarin and increase risk of GI bleeding.",
        "management": "Avoid combination if possible. Use acetaminophen for pain relief. Monitor INR closely if NSAID is necessary."
    },
    "metformin-contrast": {
        "drugs": ["metformin", "iodinated contrast"],
        "rxnorm_codes": ["860974", "contrast"],
        "severity": "major",
        "description": "Risk of lactic acidosis",
        "clinical_consequence": "Iodinated contrast media can impair renal function, leading to metformin accumulation and lactic acidosis.",
        "management": "Hold metformin 48 hours before and after contrast administration. Check renal function before restarting."
    },
    "ace-potassium": {
        "drugs": ["lisinopril", "enalapril", "potassium", "spironolactone"],
        "rxnorm_codes": ["314076", "310404", "8126", "20610"],
        "severity": "moderate",
        "description": "Risk of hyperkalemia",
        "clinical_consequence": "ACE inhibitors reduce potassium excretion. Combined with potassium supplements or potassium-sparing diuretics can cause dangerous hyperkalemia.",
        "management": "Monitor potassium levels regularly. Avoid potassium supplements unless hypokalemia documented."
    },
    "statins-cyp3a4": {
        "drugs": ["simvastatin", "atorvastatin", "clarithromycin", "erythromycin"],
        "rxnorm_codes": ["36567", "83367", "18631", "4053"],
        "severity": "major",
        "description": "Increased risk of myopathy/rhabdomyolysis",
        "clinical_consequence": "CYP3A4 inhibitors increase statin levels, increasing risk of muscle toxicity including rhabdomyolysis.",
        "management": "Use alternative antibiotic or reduce statin dose. Monitor for muscle pain, weakness, dark urine."
    },
    "ssri-nsaids": {
        "drugs": ["sertraline", "fluoxetine", "ibuprofen", "naproxen"],
        "rxnorm_codes": ["36437", "4493", "197805", "198013"],
        "severity": "moderate",
        "description": "Increased risk of GI bleeding",
        "clinical_consequence": "SSRIs inhibit platelet aggregation. Combined with NSAIDs increases risk of GI bleeding.",
        "management": "Consider gastroprotection with PPI. Monitor for signs of bleeding. Use acetaminophen when possible."
    },
    "metformin-glipizide": {
        "drugs": ["metformin", "glipizide", "glyburide"],
        "rxnorm_codes": ["860974", "4821", "4815"],
        "severity": "minor",
        "description": "Additive hypoglycemic effect",
        "clinical_consequence": "Combination increases risk of hypoglycemia, especially if meals are missed.",
        "management": "This is often an intended combination. Educate about hypoglycemia symptoms. Monitor blood glucose."
    },
    "digoxin-diuretics": {
        "drugs": ["digoxin", "furosemide", "hydrochlorothiazide"],
        "rxnorm_codes": ["3407", "4603", "5487"],
        "severity": "moderate",
        "description": "Risk of digoxin toxicity",
        "clinical_consequence": "Loop and thiazide diuretics can cause hypokalemia, which increases risk of digoxin toxicity.",
        "management": "Monitor potassium and digoxin levels. Consider potassium supplementation if needed."
    }
}

def check_drug_interactions(medication_list: List[Dict[str, str]]) -> List[Dict[str, any]]:
    """
    Check for drug interactions in a list of medications.
    
    Args:
        medication_list: List of medications with 'name' and 'code' fields
        
    Returns:
        List of interaction warnings
    """
    interactions = []
    med_names = [med.get('name', '').lower() for med in medication_list]
    med_codes = [med.get('code', '') for med in medication_list]
    
    # Check each interaction rule
    for interaction_id, interaction_data in DRUG_INTERACTIONS.items():
        # Check if any drugs from the interaction are in the medication list
        matching_drugs = []
        
        for drug in interaction_data['drugs']:
            # Check by name (partial match)
            for med_name in med_names:
                if drug.lower() in med_name:
                    matching_drugs.append(drug)
                    break
        
        # Also check by RxNorm code
        for code in interaction_data['rxnorm_codes']:
            if code in med_codes and len(matching_drugs) < 2:
                # Find which drug this code represents
                for i, drug_code in enumerate(interaction_data['rxnorm_codes']):
                    if drug_code == code and i < len(interaction_data['drugs']):
                        drug_name = interaction_data['drugs'][i]
                        if drug_name not in matching_drugs:
                            matching_drugs.append(drug_name)
        
        # If we found 2 or more interacting drugs, add the interaction
        if len(matching_drugs) >= 2:
            interactions.append({
                'id': interaction_id,
                'drugs': matching_drugs,
                'severity': interaction_data['severity'],
                'description': interaction_data['description'],
                'clinical_consequence': interaction_data['clinical_consequence'],
                'management': interaction_data['management']
            })
    
    return interactions

@router.post("/check-interactions")
async def check_interactions(
    medications: List[Dict[str, str]],
    db: AsyncSession = Depends(get_db)
):
    """
    Check for drug interactions among a list of medications.
    
    Request body should contain a list of medications with 'name' and 'code' fields.
    """
    interactions = check_drug_interactions(medications)
    
    return {
        'medication_count': len(medications),
        'interaction_count': len(interactions),
        'interactions': interactions
    }

@router.get("/interaction-database")
async def get_interaction_database():
    """Get the full drug interaction database."""
    return {
        'total_interactions': len(DRUG_INTERACTIONS),
        'interactions': DRUG_INTERACTIONS
    }