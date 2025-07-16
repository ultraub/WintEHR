"""
Analytics API Router

Provides analytics endpoints for:
- Patient demographics
- Disease prevalence
- Medication patterns
- Clinical outcomes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, List, Any
import logging

from database import get_db_session
from fhir.core.storage import FHIRStorageEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

async def get_storage(db: AsyncSession = Depends(get_db_session)) -> FHIRStorageEngine:
    """Get FHIR storage engine instance"""
    return FHIRStorageEngine(db)


@router.get("/demographics")
async def get_patient_demographics(
    storage: FHIRStorageEngine = Depends(get_storage)
):
    """
    Get patient demographics analytics.
    
    Returns:
    - Gender distribution
    - Age distribution
    - Race distribution
    """
    try:
        # Search for all patients
        patients, total = await storage.search_resources("Patient", {}, limit=1000)
        
        # Initialize counters
        gender_dist = {}
        age_dist = {"0-18": 0, "19-35": 0, "36-50": 0, "51-65": 0, "65+": 0}
        race_dist = {}
        
        # Process each patient
        for patient in patients:
            # Gender
            gender = patient.get("gender", "unknown")
            gender_dist[gender] = gender_dist.get(gender, 0) + 1
            
            # Age (if birthDate available)
            if "birthDate" in patient:
                from datetime import datetime
                birth_date = datetime.fromisoformat(patient["birthDate"].replace("Z", "+00:00"))
                age = (datetime.now() - birth_date).days // 365
                
                if age <= 18:
                    age_dist["0-18"] += 1
                elif age <= 35:
                    age_dist["19-35"] += 1
                elif age <= 50:
                    age_dist["36-50"] += 1
                elif age <= 65:
                    age_dist["51-65"] += 1
                else:
                    age_dist["65+"] += 1
            
            # Race (from extensions)
            for ext in patient.get("extension", []):
                if "race" in ext.get("url", ""):
                    race = ext.get("valueCodeableConcept", {}).get("coding", [{}])[0].get("display", "unknown")
                    race_dist[race] = race_dist.get(race, 0) + 1
        
        # Convert to percentages
        total_patients = len(patients)
        
        gender_distribution = [
            {"gender": gender.title(), "count": count, "percentage": round((count/total_patients)*100, 1)}
            for gender, count in gender_dist.items()
        ]
        
        age_distribution = {
            age_range: {"count": count, "percentage": round((count/total_patients)*100, 1)}
            for age_range, count in age_dist.items()
        }
        
        race_distribution = [
            {"race": race, "count": count, "percentage": round((count/total_patients)*100, 1)}
            for race, count in race_dist.items()
        ]
        
        return {
            "total_patients": total_patients,
            "gender_distribution": gender_distribution,
            "age_distribution": age_distribution,
            "race_distribution": race_distribution
        }
        
    except Exception as e:
        logger.error(f"Error getting demographics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/disease-prevalence")
async def get_disease_prevalence(
    limit: int = 20,
    storage: FHIRStorageEngine = Depends(get_storage)
):
    """
    Get disease prevalence analytics.
    
    Returns top conditions by frequency.
    """
    try:
        # Search for all active conditions
        conditions, total = await storage.search_resources(
            "Condition", 
            {"clinical-status": "active"},
            limit=5000
        )
        
        # Count condition frequencies
        condition_counts = {}
        
        for condition in conditions:
            # Get condition name
            coding = condition.get("code", {}).get("coding", [])
            if coding:
                display = coding[0].get("display", "Unknown condition")
                condition_counts[display] = condition_counts.get(display, 0) + 1
        
        # Sort by frequency and take top N
        sorted_conditions = sorted(
            condition_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:limit]
        
        # Convert to response format
        disease_prevalence = [
            {
                "condition": condition,
                "count": count,
                "percentage": round((count/total)*100, 1)
            }
            for condition, count in sorted_conditions
        ]
        
        return {
            "total_conditions": total,
            "disease_prevalence": disease_prevalence
        }
        
    except Exception as e:
        logger.error(f"Error getting disease prevalence: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/medication-patterns")
async def get_medication_patterns(
    limit: int = 20,
    storage: FHIRStorageEngine = Depends(get_storage)
):
    """
    Get medication prescription patterns.
    
    Returns:
    - Most prescribed medications
    - Medication class distribution
    """
    try:
        # Search for all medication requests
        med_requests, total = await storage.search_resources(
            "MedicationRequest",
            {"status": "active"},
            limit=5000
        )
        
        # Count medication frequencies
        med_counts = {}
        class_counts = {}
        
        for med_req in med_requests:
            # Get medication name
            med_ref = med_req.get("medicationReference", {})
            med_concept = med_req.get("medicationCodeableConcept", {})
            
            if med_concept:
                coding = med_concept.get("coding", [])
                if coding:
                    display = coding[0].get("display", "Unknown medication")
                    med_counts[display] = med_counts.get(display, 0) + 1
                    
                    # Categorize by class (simplified)
                    display_lower = display.lower()
                    if any(term in display_lower for term in ["aspirin", "ibuprofen", "acetaminophen"]):
                        med_class = "Analgesics"
                    elif any(term in display_lower for term in ["lisinopril", "atenolol", "amlodipine"]):
                        med_class = "Cardiovascular"
                    elif any(term in display_lower for term in ["metformin", "insulin", "glipizide"]):
                        med_class = "Antidiabetics"
                    elif any(term in display_lower for term in ["amoxicillin", "azithromycin", "ciprofloxacin"]):
                        med_class = "Antibiotics"
                    else:
                        med_class = "Other"
                    
                    class_counts[med_class] = class_counts.get(med_class, 0) + 1
        
        # Sort medications by frequency
        sorted_meds = sorted(
            med_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        # Convert to response format
        top_medications = [
            {
                "medication": med,
                "count": count,
                "percentage": round((count/total)*100, 1)
            }
            for med, count in sorted_meds
        ]
        
        medication_classes = [
            {
                "class": med_class,
                "count": count,
                "percentage": round((count/sum(class_counts.values()))*100, 1)
            }
            for med_class, count in class_counts.items()
        ]
        
        return {
            "total_prescriptions": total,
            "top_medications": top_medications,
            "medication_classes": medication_classes
        }
        
    except Exception as e:
        logger.error(f"Error getting medication patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clinical-outcomes")
async def get_clinical_outcomes(
    storage: FHIRStorageEngine = Depends(get_storage)
):
    """
    Get clinical outcomes analytics.
    
    Returns:
    - Lab result trends
    - Vital sign statistics
    - Procedure outcomes
    """
    try:
        # This is a placeholder for more complex analytics
        # In a real system, this would aggregate outcome data
        
        return {
            "message": "Clinical outcomes analytics endpoint",
            "status": "not_implemented",
            "planned_features": [
                "Lab result trend analysis",
                "Vital sign statistics",
                "Procedure success rates",
                "Readmission rates",
                "Treatment effectiveness metrics"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting clinical outcomes: {e}")
        raise HTTPException(status_code=500, detail=str(e))