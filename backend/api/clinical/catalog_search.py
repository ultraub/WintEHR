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
            resource = json.loads(row.resource)
            
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

@router.get("/all/search")
async def search_all_catalogs(
    query: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Results per category"),
    db: AsyncSession = Depends(get_db)
):
    """
    Search across all clinical catalogs (medications, lab tests, imaging).
    Returns results from all categories.
    """
    results = {
        "medications": [],
        "labTests": [],
        "imagingProcedures": []
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
    
    return {
        "query": query,
        "results": results,
        "total": len(results["medications"]) + len(results["labTests"]) + len(results["imagingProcedures"])
    }