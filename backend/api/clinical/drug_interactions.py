"""
Drug Interaction Service
Provides comprehensive drug interaction and safety checking functionality
"""

from typing import List, Dict, Optional, Set, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime
import logging

from database import get_db_session as get_db
from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)
router = APIRouter()

# Request/Response Models
class MedicationCheck(BaseModel):
    """Model for medication to check"""
    name: str
    code: Optional[str] = None
    rxnorm_code: Optional[str] = None
    dose: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None

class SafetyCheckRequest(BaseModel):
    """Request model for comprehensive safety check"""
    patient_id: str
    medications: List[MedicationCheck]
    include_current_medications: bool = True
    include_allergies: bool = True
    include_contraindications: bool = True
    include_duplicate_therapy: bool = True
    include_dosage_check: bool = True

class InteractionResult(BaseModel):
    """Result model for drug interaction"""
    interaction_id: str
    drugs: List[str]
    severity: str
    description: str
    clinical_consequence: str
    management: str
    evidence_level: Optional[str] = None
    references: Optional[List[str]] = None

class AllergyAlert(BaseModel):
    """Alert model for drug-allergy interaction"""
    drug: str
    allergen: str
    reaction_type: str
    severity: str
    cross_reactivity: Optional[bool] = None
    management: str

class ContraindicationAlert(BaseModel):
    """Alert model for contraindications"""
    drug: str
    condition: str
    contraindication_type: str  # absolute, relative
    severity: str
    rationale: str
    alternative_therapy: Optional[str] = None

class DuplicateTherapyAlert(BaseModel):
    """Alert model for duplicate therapy"""
    drugs: List[str]
    therapeutic_class: str
    concern: str
    recommendation: str

class DosageAlert(BaseModel):
    """Alert model for dosage issues"""
    drug: str
    issue_type: str  # overdose, underdose, frequency
    current_dose: str
    recommended_range: str
    severity: str
    adjustment: Optional[str] = None

class SafetyCheckResult(BaseModel):
    """Comprehensive safety check result"""
    patient_id: str
    check_timestamp: datetime
    total_alerts: int
    critical_alerts: int
    interactions: List[InteractionResult]
    allergy_alerts: List[AllergyAlert]
    contraindications: List[ContraindicationAlert]
    duplicate_therapy: List[DuplicateTherapyAlert]
    dosage_alerts: List[DosageAlert]
    overall_risk_score: float  # 0-10 scale
    recommendations: List[str]

# Extended drug interaction database
# In production, this would be from a comprehensive drug interaction database like First Databank or Micromedex
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
    },
    "beta-blockers-calcium-channel": {
        "drugs": ["metoprolol", "atenolol", "verapamil", "diltiazem"],
        "rxnorm_codes": ["6918", "1202", "11170", "3443"],
        "severity": "major",
        "description": "Risk of bradycardia and heart block",
        "clinical_consequence": "Combination can cause severe bradycardia, AV block, and heart failure.",
        "management": "Use with extreme caution. Monitor heart rate and blood pressure. Consider alternative combinations."
    },
    "maoi-ssri": {
        "drugs": ["phenelzine", "selegiline", "sertraline", "fluoxetine", "paroxetine"],
        "rxnorm_codes": ["8123", "9639", "36437", "4493", "7975"],
        "severity": "contraindicated",
        "description": "Risk of serotonin syndrome",
        "clinical_consequence": "Can cause life-threatening serotonin syndrome with hyperthermia, rigidity, autonomic instability.",
        "management": "CONTRAINDICATED. Must wait at least 14 days between MAOI and SSRI. For fluoxetine, wait 5 weeks."
    },
    "lithium-nsaids": {
        "drugs": ["lithium", "ibuprofen", "naproxen", "indomethacin"],
        "rxnorm_codes": ["6448", "197805", "198013", "5781"],
        "severity": "moderate",
        "description": "Increased lithium levels",
        "clinical_consequence": "NSAIDs reduce renal lithium clearance, increasing risk of lithium toxicity.",
        "management": "Monitor lithium levels closely. Consider dose reduction. Aspirin or sulindac may be safer alternatives."
    },
    "anticoagulant-antiplatelet": {
        "drugs": ["warfarin", "apixaban", "rivaroxaban", "clopidogrel", "aspirin"],
        "rxnorm_codes": ["855332", "1364430", "1037045", "32968", "243670"],
        "severity": "major",
        "description": "Increased bleeding risk",
        "clinical_consequence": "Combination significantly increases risk of major bleeding including intracranial hemorrhage.",
        "management": "Use only when benefit outweighs risk. Monitor closely for bleeding. Consider gastroprotection."
    }
}

# Drug-Allergy Cross-Reactivity Database
DRUG_ALLERGY_CROSS_REACTIVITY = {
    "penicillin": {
        "cross_reactive_drugs": ["amoxicillin", "ampicillin", "cephalexin", "cefazolin"],
        "cross_reactivity_rate": {"cephalosporins": 0.1, "carbapenems": 0.01},
        "safe_alternatives": ["azithromycin", "levofloxacin", "doxycycline"]
    },
    "sulfa": {
        "cross_reactive_drugs": ["sulfamethoxazole", "furosemide", "hydrochlorothiazide", "celecoxib"],
        "cross_reactivity_rate": {"loop_diuretics": 0.1, "thiazides": 0.1, "cox2_inhibitors": 0.05},
        "safe_alternatives": ["trimethoprim", "spironolactone", "ethacrynic acid"]
    },
    "aspirin": {
        "cross_reactive_drugs": ["ibuprofen", "naproxen", "ketorolac", "diclofenac"],
        "cross_reactivity_rate": {"nsaids": 0.2},
        "safe_alternatives": ["acetaminophen", "tramadol", "celecoxib"]
    }
}

# Contraindications Database
CONTRAINDICATIONS = {
    "metformin": [
        {"condition": "egfr_below_30", "type": "absolute", "reason": "Risk of lactic acidosis"},
        {"condition": "acute_kidney_injury", "type": "absolute", "reason": "Risk of lactic acidosis"},
        {"condition": "liver_disease_severe", "type": "relative", "reason": "Impaired lactate clearance"}
    ],
    "warfarin": [
        {"condition": "active_bleeding", "type": "absolute", "reason": "Will worsen bleeding"},
        {"condition": "pregnancy", "type": "absolute", "reason": "Teratogenic effects"},
        {"condition": "frequent_falls", "type": "relative", "reason": "Increased risk of traumatic bleeding"}
    ],
    "nsaids": [
        {"condition": "peptic_ulcer_active", "type": "absolute", "reason": "Risk of GI bleeding"},
        {"condition": "severe_renal_impairment", "type": "relative", "reason": "May worsen renal function"},
        {"condition": "heart_failure", "type": "relative", "reason": "Fluid retention and worsening HF"}
    ]
}

# Therapeutic Duplication Classes
THERAPEUTIC_CLASSES = {
    "ace_inhibitors": ["lisinopril", "enalapril", "ramipril", "benazepril"],
    "arbs": ["losartan", "valsartan", "irbesartan", "telmisartan"],
    "statins": ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin"],
    "ppis": ["omeprazole", "esomeprazole", "pantoprazole", "lansoprazole"],
    "ssris": ["sertraline", "fluoxetine", "paroxetine", "citalopram", "escitalopram"],
    "beta_blockers": ["metoprolol", "atenolol", "carvedilol", "bisoprolol"],
    "calcium_channel_blockers": ["amlodipine", "diltiazem", "verapamil", "nifedipine"],
    "loop_diuretics": ["furosemide", "bumetanide", "torsemide"],
    "thiazide_diuretics": ["hydrochlorothiazide", "chlorthalidone", "indapamide"]
}

# Standard Dosage Ranges (simplified - in production would be much more comprehensive)
DOSAGE_RANGES = {
    "metformin": {"min_daily": 500, "max_daily": 2000, "unit": "mg", "frequency": "1-2 times daily"},
    "lisinopril": {"min_daily": 5, "max_daily": 40, "unit": "mg", "frequency": "once daily"},
    "amlodipine": {"min_daily": 2.5, "max_daily": 10, "unit": "mg", "frequency": "once daily"},
    "warfarin": {"min_daily": 1, "max_daily": 15, "unit": "mg", "frequency": "once daily", "note": "Highly variable"}
}

async def get_patient_current_medications(patient_id: str, db: AsyncSession = None) -> List[Dict[str, Any]]:
    """Get patient's current active medications from HAPI FHIR"""
    try:
        # Search for active MedicationRequests for the patient
        search_params = {
            "patient": f"Patient/{patient_id}",
            "status": "active"
        }

        hapi_client = HAPIFHIRClient()
        bundle = await hapi_client.search("MedicationRequest", search_params)
        resources = [entry.get("resource", {}) for entry in bundle.get("entry", [])]

        # Extract medication information
        medications = []
        for resource in resources:
            med_data = {
                "id": resource.get("id"),
                "name": "",
                "code": "",
                "rxnorm_code": "",
                "dose": "",
                "route": "",
                "frequency": ""
            }
            
            # Extract medication name and code
            med_codeable = resource.get("medicationCodeableConcept", {})
            if med_codeable:
                med_data["name"] = med_codeable.get("text", "")
                
                # Look for RxNorm code
                for coding in med_codeable.get("coding", []):
                    if coding.get("system") == "http://www.nlm.nih.gov/research/umls/rxnorm":
                        med_data["rxnorm_code"] = coding.get("code", "")
                        if not med_data["name"]:
                            med_data["name"] = coding.get("display", "")
                    med_data["code"] = coding.get("code", "")
            
            # Extract dosage information
            dosage_instructions = resource.get("dosageInstruction", [])
            if dosage_instructions:
                dosage = dosage_instructions[0]
                
                # Dose
                dose_and_rate = dosage.get("doseAndRate", [])
                if dose_and_rate:
                    dose_quantity = dose_and_rate[0].get("doseQuantity", {})
                    if dose_quantity:
                        med_data["dose"] = f"{dose_quantity.get('value', '')} {dose_quantity.get('unit', '')}"
                
                # Route
                route = dosage.get("route", {})
                med_data["route"] = route.get("text", "")
                
                # Frequency
                timing = dosage.get("timing", {})
                if timing:
                    repeat = timing.get("repeat", {})
                    if repeat:
                        frequency = repeat.get("frequency", "")
                        period = repeat.get("period", "")
                        period_unit = repeat.get("periodUnit", "")
                        if frequency and period and period_unit:
                            med_data["frequency"] = f"{frequency} times per {period} {period_unit}"
            
            medications.append(med_data)
        
        return medications
    
    except Exception as e:
        logger.error(f"Error fetching patient medications: {str(e)}")
        return []

async def get_patient_allergies(patient_id: str, db: AsyncSession = None) -> List[Dict[str, Any]]:
    """Get patient's allergies from HAPI FHIR"""
    try:
        # Search for AllergyIntolerance resources for the patient
        search_params = {
            "patient": f"Patient/{patient_id}",
            "clinical-status": "active"
        }

        hapi_client = HAPIFHIRClient()
        bundle = await hapi_client.search("AllergyIntolerance", search_params)
        resources = [entry.get("resource", {}) for entry in bundle.get("entry", [])]

        # Extract allergy information
        allergies = []
        for resource in resources:
            allergy_data = {
                "substance": "",
                "category": resource.get("category", ["unknown"])[0],
                "criticality": resource.get("criticality", "low"),
                "reactions": []
            }
            
            # Extract substance
            code = resource.get("code", {})
            if code:
                allergy_data["substance"] = code.get("text", "")
                if not allergy_data["substance"]:
                    codings = code.get("coding", [])
                    if codings:
                        allergy_data["substance"] = codings[0].get("display", "")
            
            # Extract reactions
            for reaction in resource.get("reaction", []):
                reaction_info = {
                    "manifestations": [],
                    "severity": reaction.get("severity", "mild")
                }
                
                for manifestation in reaction.get("manifestation", []):
                    reaction_info["manifestations"].append(
                        manifestation.get("text", manifestation.get("coding", [{}])[0].get("display", ""))
                    )
                
                allergy_data["reactions"].append(reaction_info)
            
            allergies.append(allergy_data)
        
        return allergies
    
    except Exception as e:
        logger.error(f"Error fetching patient allergies: {str(e)}")
        return []

async def get_patient_conditions(patient_id: str, db: AsyncSession = None) -> List[Dict[str, Any]]:
    """Get patient's active conditions from HAPI FHIR"""
    try:
        # Search for active Conditions for the patient
        search_params = {
            "patient": f"Patient/{patient_id}",
            "clinical-status": "active"
        }

        hapi_client = HAPIFHIRClient()
        bundle = await hapi_client.search("Condition", search_params)
        resources = [entry.get("resource", {}) for entry in bundle.get("entry", [])]

        # Extract condition information
        conditions = []
        for resource in resources:
            condition_data = {
                "code": "",
                "display": "",
                "severity": "",
                "onset": resource.get("onsetDateTime", "")
            }
            
            # Extract condition code and display
            code = resource.get("code", {})
            if code:
                condition_data["display"] = code.get("text", "")
                codings = code.get("coding", [])
                if codings:
                    condition_data["code"] = codings[0].get("code", "")
                    if not condition_data["display"]:
                        condition_data["display"] = codings[0].get("display", "")
            
            # Extract severity if available
            severity = resource.get("severity", {})
            if severity:
                condition_data["severity"] = severity.get("text", "")
            
            conditions.append(condition_data)
        
        return conditions
    
    except Exception as e:
        logger.error(f"Error fetching patient conditions: {str(e)}")
        return []

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

def check_drug_allergies(medications: List[Dict[str, str]], allergies: List[Dict[str, any]]) -> List[AllergyAlert]:
    """Check for potential drug-allergy interactions"""
    alerts = []
    
    for allergy in allergies:
        allergen = allergy.get("substance", "").lower()
        if not allergen:
            continue
        
        # Check each medication against allergy
        for med in medications:
            med_name = med.get("name", "").lower()
            
            # Direct match
            if allergen in med_name or med_name in allergen:
                alerts.append(AllergyAlert(
                    drug=med["name"],
                    allergen=allergy["substance"],
                    reaction_type="direct",
                    severity=allergy.get("criticality", "high"),
                    cross_reactivity=False,
                    management="CONTRAINDICATED - Patient has documented allergy"
                ))
            
            # Check cross-reactivity
            for allergy_class, cross_data in DRUG_ALLERGY_CROSS_REACTIVITY.items():
                if allergy_class in allergen:
                    for cross_drug in cross_data["cross_reactive_drugs"]:
                        if cross_drug.lower() in med_name:
                            alerts.append(AllergyAlert(
                                drug=med["name"],
                                allergen=allergy["substance"],
                                reaction_type="cross-reactivity",
                                severity="moderate",
                                cross_reactivity=True,
                                management=f"Potential cross-reactivity with {allergy_class} allergy. Consider alternatives: {', '.join(cross_data['safe_alternatives'][:3])}"
                            ))
    
    return alerts

def check_contraindications(medications: List[Dict[str, str]], conditions: List[Dict[str, any]]) -> List[ContraindicationAlert]:
    """Check for drug-disease contraindications"""
    alerts = []
    
    # Map conditions to contraindication checks
    condition_mappings = {
        "chronic kidney disease": ["egfr_below_30", "severe_renal_impairment"],
        "acute kidney injury": ["acute_kidney_injury"],
        "liver disease": ["liver_disease_severe"],
        "pregnancy": ["pregnancy"],
        "heart failure": ["heart_failure"],
        "peptic ulcer": ["peptic_ulcer_active"],
        "bleeding": ["active_bleeding"],
        "falls": ["frequent_falls"]
    }
    
    # Extract condition codes
    active_conditions = set()
    for condition in conditions:
        condition_text = condition.get("display", "").lower()
        for mapping, codes in condition_mappings.items():
            if mapping in condition_text:
                active_conditions.update(codes)
    
    # Check each medication for contraindications
    for med in medications:
        med_name = med.get("name", "").lower()
        
        # Check against contraindications database
        for drug, contraindications in CONTRAINDICATIONS.items():
            if drug.lower() in med_name:
                for contra in contraindications:
                    if contra["condition"] in active_conditions:
                        alerts.append(ContraindicationAlert(
                            drug=med["name"],
                            condition=contra["condition"].replace("_", " ").title(),
                            contraindication_type=contra["type"],
                            severity="high" if contra["type"] == "absolute" else "moderate",
                            rationale=contra["reason"],
                            alternative_therapy="Contact prescriber for alternative"
                        ))
    
    return alerts

def check_duplicate_therapy(medications: List[Dict[str, str]]) -> List[DuplicateTherapyAlert]:
    """Check for therapeutic duplication"""
    alerts = []
    
    # Group medications by therapeutic class
    med_by_class = {}
    for med in medications:
        med_name = med.get("name", "").lower()
        
        for class_name, drugs in THERAPEUTIC_CLASSES.items():
            for drug in drugs:
                if drug.lower() in med_name:
                    if class_name not in med_by_class:
                        med_by_class[class_name] = []
                    med_by_class[class_name].append(med["name"])
                    break
    
    # Check for duplications
    for class_name, meds in med_by_class.items():
        if len(meds) > 1:
            alerts.append(DuplicateTherapyAlert(
                drugs=meds,
                therapeutic_class=class_name.replace("_", " ").title(),
                concern=f"Multiple {class_name.replace('_', ' ')} prescribed",
                recommendation="Review for potential duplicate therapy. Consider if combination is intentional."
            ))
    
    return alerts

def check_dosage_ranges(medications: List[Dict[str, str]]) -> List[DosageAlert]:
    """Check for dosage issues"""
    alerts = []
    
    for med in medications:
        med_name = med.get("name", "").lower()
        dose_str = med.get("dose", "")
        
        # Extract numeric dose
        try:
            import re
            dose_match = re.search(r'(\d+\.?\d*)', dose_str)
            if dose_match:
                dose_value = float(dose_match.group(1))
                
                # Check against dosage database
                for drug, ranges in DOSAGE_RANGES.items():
                    if drug.lower() in med_name:
                        if dose_value < ranges["min_daily"]:
                            alerts.append(DosageAlert(
                                drug=med["name"],
                                issue_type="underdose",
                                current_dose=dose_str,
                                recommended_range=f"{ranges['min_daily']}-{ranges['max_daily']} {ranges['unit']} daily",
                                severity="moderate",
                                adjustment=f"Consider increasing to at least {ranges['min_daily']} {ranges['unit']}"
                            ))
                        elif dose_value > ranges["max_daily"]:
                            alerts.append(DosageAlert(
                                drug=med["name"],
                                issue_type="overdose",
                                current_dose=dose_str,
                                recommended_range=f"{ranges['min_daily']}-{ranges['max_daily']} {ranges['unit']} daily",
                                severity="high",
                                adjustment=f"Reduce to maximum {ranges['max_daily']} {ranges['unit']} daily"
                            ))
                        break
        except:
            pass  # Unable to parse dose
    
    return alerts

def calculate_risk_score(interactions: List[Dict], allergy_alerts: List[AllergyAlert], 
                        contraindications: List[ContraindicationAlert], 
                        duplicate_therapy: List[DuplicateTherapyAlert],
                        dosage_alerts: List[DosageAlert]) -> float:
    """Calculate overall risk score (0-10 scale)"""
    score = 0.0
    
    # Interactions scoring
    for interaction in interactions:
        if interaction["severity"] == "contraindicated":
            score += 3.0
        elif interaction["severity"] == "major":
            score += 2.0
        elif interaction["severity"] == "moderate":
            score += 1.0
        else:
            score += 0.5
    
    # Allergy alerts scoring
    for alert in allergy_alerts:
        if alert.reaction_type == "direct":
            score += 3.0
        else:
            score += 1.5
    
    # Contraindications scoring
    for contra in contraindications:
        if contra.contraindication_type == "absolute":
            score += 2.5
        else:
            score += 1.0
    
    # Duplicate therapy scoring
    score += len(duplicate_therapy) * 0.5
    
    # Dosage alerts scoring
    for dosage in dosage_alerts:
        if dosage.issue_type == "overdose":
            score += 2.0
        else:
            score += 1.0
    
    # Cap at 10
    return min(score, 10.0)

def generate_recommendations(safety_result: SafetyCheckResult) -> List[str]:
    """Generate clinical recommendations based on safety check results"""
    recommendations = []
    
    if safety_result.overall_risk_score >= 7:
        recommendations.append("HIGH RISK: Urgent pharmacy consultation recommended before dispensing")
    elif safety_result.overall_risk_score >= 5:
        recommendations.append("MODERATE RISK: Review medication regimen with prescriber")
    
    if safety_result.allergy_alerts:
        recommendations.append("Verify allergy documentation and consider alternatives")
    
    if any(i.severity == "contraindicated" for i in safety_result.interactions):
        recommendations.append("CONTRAINDICATED combinations present - contact prescriber immediately")
    
    if any(c.contraindication_type == "absolute" for c in safety_result.contraindications):
        recommendations.append("Absolute contraindications detected - do not dispense without prescriber approval")
    
    if safety_result.dosage_alerts:
        recommendations.append("Dosage concerns identified - verify with prescriber")
    
    if safety_result.duplicate_therapy:
        recommendations.append("Potential duplicate therapy - confirm if intentional")
    
    if not recommendations:
        recommendations.append("No significant safety concerns identified")
    
    return recommendations

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

@router.post("/comprehensive-safety-check")
async def comprehensive_safety_check(
    request: SafetyCheckRequest,
    db: AsyncSession = Depends(get_db)
) -> SafetyCheckResult:
    """
    Perform comprehensive drug safety checking including:
    - Drug-drug interactions
    - Drug-allergy interactions
    - Drug-disease contraindications
    - Duplicate therapy
    - Dosage range checking
    """
    try:
        # Get current medications if requested
        all_medications = [med.dict() for med in request.medications]
        
        if request.include_current_medications:
            current_meds = await get_patient_current_medications(request.patient_id, db)
            all_medications.extend(current_meds)
        
        # Initialize results
        interactions = []
        allergy_alerts = []
        contraindications = []
        duplicate_therapy = []
        dosage_alerts = []
        
        # Check drug-drug interactions
        interaction_results = check_drug_interactions(all_medications)
        interactions = [
            InteractionResult(
                interaction_id=i['id'],
                drugs=i['drugs'],
                severity=i['severity'],
                description=i['description'],
                clinical_consequence=i['clinical_consequence'],
                management=i['management']
            ) for i in interaction_results
        ]
        
        # Check drug-allergy interactions if requested
        if request.include_allergies:
            allergies = await get_patient_allergies(request.patient_id, db)
            allergy_alerts = check_drug_allergies(all_medications, allergies)
        
        # Check contraindications if requested
        if request.include_contraindications:
            conditions = await get_patient_conditions(request.patient_id, db)
            contraindications = check_contraindications(all_medications, conditions)
        
        # Check duplicate therapy if requested
        if request.include_duplicate_therapy:
            duplicate_therapy = check_duplicate_therapy(all_medications)
        
        # Check dosage ranges if requested
        if request.include_dosage_check:
            dosage_alerts = check_dosage_ranges(all_medications)
        
        # Calculate risk score
        risk_score = calculate_risk_score(
            interaction_results,
            allergy_alerts,
            contraindications,
            duplicate_therapy,
            dosage_alerts
        )
        
        # Create result
        result = SafetyCheckResult(
            patient_id=request.patient_id,
            check_timestamp=datetime.utcnow(),
            total_alerts=(
                len(interactions) + len(allergy_alerts) + 
                len(contraindications) + len(duplicate_therapy) + 
                len(dosage_alerts)
            ),
            critical_alerts=(
                len([i for i in interaction_results if i.get('severity') in ['major', 'contraindicated']]) +
                len([a for a in allergy_alerts if getattr(a, 'reaction_type', None) == 'direct']) +
                len([c for c in contraindications if getattr(c, 'contraindication_type', None) == 'absolute']) +
                len([d for d in dosage_alerts if getattr(d, 'issue_type', None) == 'overdose'])
            ),
            interactions=interactions,
            allergy_alerts=allergy_alerts,
            contraindications=contraindications,
            duplicate_therapy=duplicate_therapy,
            dosage_alerts=dosage_alerts,
            overall_risk_score=risk_score,
            recommendations=[]
        )
        
        # Generate recommendations
        result.recommendations = generate_recommendations(result)
        
        return result
    
    except Exception as e:
        logger.error(f"Error in comprehensive safety check: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/patient/{patient_id}/medication-summary")
async def get_patient_medication_summary(
    patient_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a summary of patient's medications, allergies, and conditions for safety checking.
    """
    try:
        # Fetch all relevant data
        medications = await get_patient_current_medications(patient_id, db)
        allergies = await get_patient_allergies(patient_id, db)
        conditions = await get_patient_conditions(patient_id, db)
        
        # Perform quick safety check on current medications
        interactions = check_drug_interactions(medications) if medications else []
        
        return {
            "patient_id": patient_id,
            "current_medications": medications,
            "medication_count": len(medications),
            "allergies": allergies,
            "allergy_count": len(allergies),
            "active_conditions": conditions,
            "condition_count": len(conditions),
            "current_interactions": interactions,
            "interaction_count": len(interactions)
        }
    
    except Exception as e:
        logger.error(f"Error getting patient medication summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/interaction-database")
async def get_interaction_database():
    """Get the full drug interaction database."""
    return {
        'total_interactions': len(DRUG_INTERACTIONS),
        'interactions': DRUG_INTERACTIONS
    }