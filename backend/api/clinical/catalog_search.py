"""
Clinical Catalog Search Service
Provides search functionality for medications, lab tests, and imaging procedures
using FHIR resources.
"""

from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json

from database import get_db_session as get_db
from core.fhir.storage import FHIRStorageEngine

router = APIRouter()

@router.get("/medications/search")
async def search_medications(
    query: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for medications in the FHIR Medication resources.
    Returns medications matching the search query.
    """
    storage = FHIRStorageEngine(db)
    
    try:
        # Search in Medication resources
        # Using direct SQL query for flexible text search
        sql = text("""
            SELECT fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Medication'
            AND (
                resource->>'code' ILIKE :query
                OR resource->'code'->'coding'->0->>'display' ILIKE :query
                OR resource->'code'->>'text' ILIKE :query
                OR resource->>'id' ILIKE :query
            )
            LIMIT :limit
        """)
        
        result = await db.execute(sql, {
            "query": f"%{query}%",
            "limit": limit
        })
        
        medications = []
        for row in result:
            # Handle both JSON string and dict formats
            if isinstance(row.resource, str):
                resource = json.loads(row.resource)
            else:
                resource = row.resource
            
            # Extract medication information
            med_info = {
                "id": row.fhir_id,
                "resourceType": "Medication",
                "name": None,
                "code": None,
                "system": None,
                "form": None,
                "status": resource.get("status", "active")
            }
            
            # Extract code information
            if "code" in resource:
                code_data = resource["code"]
                if "coding" in code_data and len(code_data["coding"]) > 0:
                    coding = code_data["coding"][0]
                    med_info["code"] = coding.get("code")
                    med_info["system"] = coding.get("system", "http://www.nlm.nih.gov/research/umls/rxnorm")
                    med_info["name"] = coding.get("display", code_data.get("text", "Unknown"))
                elif "text" in code_data:
                    med_info["name"] = code_data["text"]
            
            # Extract form if available
            if "form" in resource:
                form_data = resource["form"]
                if "text" in form_data:
                    med_info["form"] = form_data["text"]
                elif "coding" in form_data and len(form_data["coding"]) > 0:
                    med_info["form"] = form_data["coding"][0].get("display")
            
            medications.append(med_info)
        
        # Add common medications catalog if we don't have many results
        seen_codes = set(med["code"] for med in medications if med["code"])
        if len(medications) < limit:
            common_medications = [
                {"code": "197361", "name": "Lisinopril 10mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "198013", "name": "Metformin 500mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "259255", "name": "Atorvastatin 20mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "433800", "name": "Amlodipine 5mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "577156", "name": "Hydrochlorothiazide 25mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "206765", "name": "Omeprazole 20mg capsule", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "capsule"},
                {"code": "152923", "name": "Acetaminophen 325mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "849574", "name": "Ibuprofen 200mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "308136", "name": "Aspirin 81mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "312961", "name": "Gabapentin 300mg capsule", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "capsule"},
                {"code": "104894", "name": "Sertraline 50mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "1292737", "name": "Rosuvastatin 10mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "139825", "name": "Escitalopram 10mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "892255", "name": "Trazodone 50mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"},
                {"code": "150690", "name": "Furosemide 20mg tablet", "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "form": "tablet"}
            ]
            
            # Add matching common medications
            for med in common_medications:
                if (query.lower() in med["name"].lower() or 
                    query.lower() in med["code"].lower()) and \
                   med["code"] not in seen_codes and \
                   len(medications) < limit:
                    medications.append({
                        "id": f"catalog-{med['code']}",
                        "resourceType": "Medication",
                        "name": med["name"],
                        "code": med["code"],
                        "system": med["system"],
                        "form": med["form"],
                        "status": "active",
                        "source": "catalog"
                    })
        
        return {
            "total": len(medications),
            "medications": medications
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching medications: {str(e)}")

@router.get("/lab-tests/search")
async def search_lab_tests(
    query: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for laboratory tests in FHIR Observation and DiagnosticReport resources.
    Returns lab tests matching the search query.
    """
    try:
        # Search in DiagnosticReport resources for lab test definitions
        sql = text("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'display' as display,
                resource->'code'->'coding'->0->>'system' as system,
                resource->'code'->>'text' as text
            FROM fhir.resources
            WHERE resource_type = 'DiagnosticReport'
            AND resource->'category'->0->'coding'->0->>'code' = 'LAB'
            AND (
                resource->'code'->'coding'->0->>'display' ILIKE :query
                OR resource->'code'->>'text' ILIKE :query
                OR resource->'code'->'coding'->0->>'code' ILIKE :query
            )
            LIMIT :limit
        """)
        
        result = await db.execute(sql, {
            "query": f"%{query}%",
            "limit": limit
        })
        
        lab_tests = []
        seen_codes = set()
        
        for row in result:
            if row.code and row.code not in seen_codes:
                seen_codes.add(row.code)
                lab_tests.append({
                    "code": row.code,
                    "display": row.display or row.text or "Unknown",
                    "system": row.system or "http://loinc.org",
                    "type": "laboratory"
                })
        
        # Also search in common lab test catalog
        common_tests = [
            {"code": "24323-8", "display": "Comprehensive metabolic panel", "system": "http://loinc.org"},
            {"code": "58410-2", "display": "Complete blood count (CBC) with differential", "system": "http://loinc.org"},
            {"code": "57698-3", "display": "Lipid panel", "system": "http://loinc.org"},
            {"code": "4548-4", "display": "Hemoglobin A1c", "system": "http://loinc.org"},
            {"code": "3016-3", "display": "Thyroid stimulating hormone (TSH)", "system": "http://loinc.org"},
            {"code": "24356-8", "display": "Urinalysis complete", "system": "http://loinc.org"},
            {"code": "24325-3", "display": "Hepatic function panel", "system": "http://loinc.org"},
            {"code": "5902-2", "display": "Prothrombin time (PT)", "system": "http://loinc.org"},
            {"code": "1558-6", "display": "Fasting glucose", "system": "http://loinc.org"},
            {"code": "2524-7", "display": "Lactate", "system": "http://loinc.org"},
            {"code": "33762-6", "display": "NT-proBNP", "system": "http://loinc.org"},
            {"code": "42757-5", "display": "Troponin I", "system": "http://loinc.org"}
        ]
        
        for test in common_tests:
            if (query.lower() in test["display"].lower() or 
                query.lower() in test["code"].lower()) and \
               test["code"] not in seen_codes:
                lab_tests.append({**test, "type": "laboratory"})
        
        return {
            "total": len(lab_tests),
            "labTests": lab_tests[:limit]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching lab tests: {str(e)}")

@router.get("/imaging-procedures/search")
async def search_imaging_procedures(
    query: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for imaging procedures in FHIR ImagingStudy and DiagnosticReport resources.
    Returns imaging procedures matching the search query.
    """
    try:
        # Search in ImagingStudy resources
        sql = text("""
            SELECT DISTINCT
                resource->'procedureCode'->0->'coding'->0->>'code' as code,
                resource->'procedureCode'->0->'coding'->0->>'display' as display,
                resource->'procedureCode'->0->'coding'->0->>'system' as system,
                resource->>'description' as description
            FROM fhir.resources
            WHERE resource_type = 'ImagingStudy'
            AND (
                resource->'procedureCode'->0->'coding'->0->>'display' ILIKE :query
                OR resource->>'description' ILIKE :query
                OR resource->'procedureCode'->0->'coding'->0->>'code' ILIKE :query
            )
            LIMIT :limit
        """)
        
        result = await db.execute(sql, {
            "query": f"%{query}%",
            "limit": limit
        })
        
        imaging_procedures = []
        seen_codes = set()
        
        for row in result:
            if row.code and row.code not in seen_codes:
                seen_codes.add(row.code)
                imaging_procedures.append({
                    "code": row.code,
                    "display": row.display or row.description or "Unknown",
                    "system": row.system or "http://loinc.org",
                    "type": "imaging"
                })
        
        # Common imaging procedures catalog
        common_imaging = [
            {"code": "36643-5", "display": "Chest X-ray", "system": "http://loinc.org"},
            {"code": "24648-8", "display": "CT Head without contrast", "system": "http://loinc.org"},
            {"code": "36554-4", "display": "MRI Brain without contrast", "system": "http://loinc.org"},
            {"code": "24627-2", "display": "CT Chest with contrast", "system": "http://loinc.org"},
            {"code": "24566-6", "display": "CT Abdomen and Pelvis with contrast", "system": "http://loinc.org"},
            {"code": "30746-2", "display": "Ultrasound Abdomen", "system": "http://loinc.org"},
            {"code": "11524-6", "display": "EKG 12-lead", "system": "http://loinc.org"},
            {"code": "18748-4", "display": "Echocardiogram", "system": "http://loinc.org"},
            {"code": "24861-7", "display": "Mammogram bilateral", "system": "http://loinc.org"},
            {"code": "25061-3", "display": "Bone density scan (DEXA)", "system": "http://loinc.org"}
        ]
        
        for proc in common_imaging:
            if (query.lower() in proc["display"].lower() or 
                query.lower() in proc["code"].lower()) and \
               proc["code"] not in seen_codes:
                imaging_procedures.append({**proc, "type": "imaging"})
        
        return {
            "total": len(imaging_procedures),
            "imagingProcedures": imaging_procedures[:limit]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching imaging procedures: {str(e)}")

@router.get("/conditions/search")
async def search_conditions(
    query: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for conditions/problems using both live FHIR Condition resources
    and standard condition catalogs (ICD-10, SNOMED).
    Returns conditions matching the search query.
    """
    try:
        # Search in live FHIR Condition resources first
        sql = text("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'display' as display,
                resource->'code'->'coding'->0->>'system' as system,
                resource->'code'->>'text' as text,
                resource->>'clinicalStatus' as clinical_status
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND (
                resource->'code'->'coding'->0->>'display' ILIKE :query
                OR resource->'code'->>'text' ILIKE :query
                OR resource->'code'->'coding'->0->>'code' ILIKE :query
            )
            LIMIT :limit
        """)
        
        result = await db.execute(sql, {
            "query": f"%{query}%",
            "limit": limit
        })
        
        conditions = []
        seen_codes = set()
        
        for row in result:
            if row.code and row.code not in seen_codes:
                seen_codes.add(row.code)
                conditions.append({
                    "code": row.code,
                    "display": row.display or row.text or "Unknown condition",
                    "system": row.system or "http://snomed.info/sct",
                    "type": "condition",
                    "source": "patient_data"
                })
        
        # Common conditions catalog with ICD-10 and SNOMED codes
        common_conditions = [
            {"code": "E11.9", "display": "Type 2 diabetes mellitus without complications", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "I10", "display": "Essential hypertension", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "E78.5", "display": "Hyperlipidemia", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "J44.1", "display": "Chronic obstructive pulmonary disease with acute exacerbation", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "M25.50", "display": "Pain in unspecified joint", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "R06.02", "display": "Shortness of breath", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "R50.9", "display": "Fever", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "K59.00", "display": "Constipation", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "R51", "display": "Headache", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "M79.3", "display": "Panniculitis", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
            {"code": "73211009", "display": "Diabetes mellitus", "system": "http://snomed.info/sct"},
            {"code": "38341003", "display": "Hypertensive disorder", "system": "http://snomed.info/sct"},
            {"code": "55822004", "display": "Hyperlipidemia", "system": "http://snomed.info/sct"},
            {"code": "13645005", "display": "Chronic obstructive lung disease", "system": "http://snomed.info/sct"},
            {"code": "22253000", "display": "Pain", "system": "http://snomed.info/sct"},
            {"code": "267036007", "display": "Dyspnea", "system": "http://snomed.info/sct"},
            {"code": "386661006", "display": "Fever", "system": "http://snomed.info/sct"},
            {"code": "14760008", "display": "Constipation", "system": "http://snomed.info/sct"},
            {"code": "25064002", "display": "Headache", "system": "http://snomed.info/sct"},
            {"code": "271737000", "display": "Anemia", "system": "http://snomed.info/sct"},
            {"code": "44054006", "display": "Type 2 diabetes mellitus", "system": "http://snomed.info/sct"},
            {"code": "59621000", "display": "Essential hypertension", "system": "http://snomed.info/sct"},
            {"code": "84757009", "display": "Epilepsy", "system": "http://snomed.info/sct"},
            {"code": "195967001", "display": "Asthma", "system": "http://snomed.info/sct"},
            {"code": "35489007", "display": "Depressive disorder", "system": "http://snomed.info/sct"}
        ]
        
        # Add common conditions that match the search query
        for condition in common_conditions:
            if (query.lower() in condition["display"].lower() or 
                query.lower() in condition["code"].lower()) and \
               condition["code"] not in seen_codes:
                conditions.append({
                    **condition, 
                    "type": "condition",
                    "source": "catalog"
                })
        
        return {
            "total": len(conditions),
            "conditions": conditions[:limit]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching conditions: {str(e)}")

@router.get("/all/search")
async def search_all_catalogs(
    query: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Results per category"),
    db: AsyncSession = Depends(get_db)
):
    """
    Search across all clinical catalogs (medications, lab tests, imaging, conditions).
    Returns results from all categories.
    """
    results = {
        "medications": [],
        "labTests": [],
        "imagingProcedures": [],
        "conditions": []
    }
    
    # Search medications
    try:
        med_result = await search_medications(query, limit, db)
        results["medications"] = med_result["medications"]
    except:
        pass
    
    # Search lab tests
    try:
        lab_result = await search_lab_tests(query, limit, db)
        results["labTests"] = lab_result["labTests"]
    except:
        pass
    
    # Search imaging
    try:
        imaging_result = await search_imaging_procedures(query, limit, db)
        results["imagingProcedures"] = imaging_result["imagingProcedures"]
    except:
        pass
    
    # Search conditions
    try:
        condition_result = await search_conditions(query, limit, db)
        results["conditions"] = condition_result["conditions"]
    except:
        pass
    
    return {
        "query": query,
        "results": results,
        "total": len(results["medications"]) + len(results["labTests"]) + len(results["imagingProcedures"]) + len(results["conditions"])
    }