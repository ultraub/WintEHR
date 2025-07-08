#!/usr/bin/env python3
"""
Create drug interaction data as FHIR DocumentReference resources.
Since MedicationKnowledge is not yet supported, we'll store interaction data in DocumentReferences.
"""

import asyncio
import json
import httpx
import base64
from datetime import datetime
import logging


FHIR_BASE_URL = "http://localhost:8000/fhir/R4"

# Define common drug interactions
DRUG_INTERACTIONS = [
    {
        "id": "warfarin-aspirin",
        "drugs": ["warfarin", "aspirin"],
        "rxnorm_codes": ["855332", "243670"],
        "severity": "major",
        "description": "Increased risk of bleeding",
        "clinical_consequence": "The combination of warfarin and aspirin significantly increases the risk of bleeding complications. Monitor INR more frequently and consider alternative antiplatelet therapy.",
        "management": "Monitor for signs of bleeding. Reduce warfarin dose if necessary. Consider using clopidogrel as alternative."
    },
    {
        "id": "warfarin-nsaids",
        "drugs": ["warfarin", "ibuprofen", "naproxen"],
        "rxnorm_codes": ["855332", "197805", "198013"],
        "severity": "major",
        "description": "Increased risk of bleeding",
        "clinical_consequence": "NSAIDs can increase the anticoagulant effect of warfarin and increase risk of GI bleeding.",
        "management": "Avoid combination if possible. Use acetaminophen for pain relief. Monitor INR closely if NSAID is necessary."
    },
    {
        "id": "metformin-contrast",
        "drugs": ["metformin", "iodinated contrast"],
        "rxnorm_codes": ["860974", "contrast"],
        "severity": "major",
        "description": "Risk of lactic acidosis",
        "clinical_consequence": "Iodinated contrast media can impair renal function, leading to metformin accumulation and lactic acidosis.",
        "management": "Hold metformin 48 hours before and after contrast administration. Check renal function before restarting."
    },
    {
        "id": "ace-potassium",
        "drugs": ["lisinopril", "enalapril", "potassium supplements", "spironolactone"],
        "rxnorm_codes": ["314076", "310404", "8126", "20610"],
        "severity": "moderate",
        "description": "Risk of hyperkalemia",
        "clinical_consequence": "ACE inhibitors reduce potassium excretion. Combined with potassium supplements or potassium-sparing diuretics can cause dangerous hyperkalemia.",
        "management": "Monitor potassium levels regularly. Avoid potassium supplements unless hypokalemia documented."
    },
    {
        "id": "statins-cyp3a4",
        "drugs": ["simvastatin", "atorvastatin", "clarithromycin", "erythromycin"],
        "rxnorm_codes": ["36567", "83367", "18631", "4053"],
        "severity": "major",
        "description": "Increased risk of myopathy/rhabdomyolysis",
        "clinical_consequence": "CYP3A4 inhibitors increase statin levels, increasing risk of muscle toxicity including rhabdomyolysis.",
        "management": "Use alternative antibiotic or reduce statin dose. Monitor for muscle pain, weakness, dark urine."
    },
    {
        "id": "ssri-nsaids",
        "drugs": ["sertraline", "fluoxetine", "ibuprofen", "naproxen"],
        "rxnorm_codes": ["36437", "4493", "197805", "198013"],
        "severity": "moderate",
        "description": "Increased risk of GI bleeding",
        "clinical_consequence": "SSRIs inhibit platelet aggregation. Combined with NSAIDs increases risk of GI bleeding.",
        "management": "Consider gastroprotection with PPI. Monitor for signs of bleeding. Use acetaminophen when possible."
    },
    {
        "id": "metformin-glipizide",
        "drugs": ["metformin", "glipizide", "glyburide"],
        "rxnorm_codes": ["860974", "4821", "4815"],
        "severity": "minor",
        "description": "Additive hypoglycemic effect",
        "clinical_consequence": "Combination increases risk of hypoglycemia, especially if meals are missed.",
        "management": "This is often an intended combination. Educate about hypoglycemia symptoms. Monitor blood glucose."
    },
    {
        "id": "digoxin-diuretics",
        "drugs": ["digoxin", "furosemide", "hydrochlorothiazide"],
        "rxnorm_codes": ["3407", "4603", "5487"],
        "severity": "moderate",
        "description": "Risk of digoxin toxicity",
        "clinical_consequence": "Loop and thiazide diuretics can cause hypokalemia, which increases risk of digoxin toxicity.",
        "management": "Monitor potassium and digoxin levels. Consider potassium supplementation if needed."
    }
]

async def create_drug_interaction_document(interaction_data):
    """Create a DocumentReference for drug interaction data."""
    document = {
        "resourceType": "DocumentReference",
        "id": f"drug-interaction-{interaction_data['id']}",
        "status": "current",
        "type": {
            "coding": [{
                "system": "http://loinc.org",
                "code": "11502-2",
                "display": "Laboratory report"
            }],
            "text": "Drug Interaction Information"
        },
        "category": [{
            "coding": [{
                "system": "http://medgenemr.com/document-category",
                "code": "drug-interaction",
                "display": "Drug Interaction"
            }]
        }],
        "subject": {
            "display": "Drug Interaction Database"
        },
        "date": datetime.now().strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        "description": f"Drug interaction: {' + '.join(interaction_data['drugs'])}",
        "content": [{
            "attachment": {
                "contentType": "application/json",
                "data": base64.b64encode(json.dumps({
                    "interaction_id": interaction_data['id'],
                    "drugs": interaction_data['drugs'],
                    "rxnorm_codes": interaction_data['rxnorm_codes'],
                    "severity": interaction_data['severity'],
                    "description": interaction_data['description'],
                    "clinical_consequence": interaction_data['clinical_consequence'],
                    "management": interaction_data['management']
                }).encode('utf-8')).decode('ascii')
            }
        }]
    }
    
    async with httpx.AsyncClient() as client:
        # Try to update if exists
        response = await client.put(
            f"{FHIR_BASE_URL}/DocumentReference/{document['id']}",
            json=document,
            headers={"Content-Type": "application/fhir+json"}
        )
        
        if response.status_code not in [200, 201]:
            # Try create instead
            response = await client.post(
                f"{FHIR_BASE_URL}/DocumentReference",
                json=document,
                headers={"Content-Type": "application/fhir+json"}
            )
        
        if response.status_code in [200, 201]:
            logging.info(f"✅ Created drug interaction: {interaction_data['id']}")
            return True
        else:
            logging.info(f"❌ Failed to create drug interaction: {response.status_code}")
            logging.info(response.text)
            return False

async def main():
    """Create all drug interaction documents."""
    logging.info("🏥 Creating Drug Interaction Database")
    logging.info("=" * 60)
    created_count = 0
    for interaction in DRUG_INTERACTIONS:
        if await create_drug_interaction_document(interaction):
            created_count += 1
    
    logging.info(f"\n✅ Created {created_count}/{len(DRUG_INTERACTIONS)} drug interactions")
if __name__ == "__main__":
    asyncio.run(main())