"""Debug router for troubleshooting patient access issues."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db_session

debug_router = APIRouter(prefix="/api/debug", tags=["debug"])

@debug_router.get("/patient/{patient_id}")
async def debug_patient_lookup(
    patient_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Debug endpoint to trace patient lookup issues."""
    
    # First check the current schema
    schema_query = text("SELECT current_schema()")
    schema_result = await db.execute(schema_query)
    current_schema = schema_result.scalar()
    
    # Check search path
    search_path_query = text("SHOW search_path")
    search_path_result = await db.execute(search_path_query)
    search_path = search_path_result.scalar()
    
    # Count total patients first
    count_query = text("SELECT COUNT(*) FROM resources WHERE resource_type = 'Patient'")
    count_result = await db.execute(count_query)
    total_patients = count_result.scalar()
    
    # Get first few patients
    sample_query = text("""
        SELECT fhir_id, resource->>'birthDate' as birthdate
        FROM resources
        WHERE resource_type = 'Patient'
        LIMIT 3
    """)
    sample_result = await db.execute(sample_query)
    sample_patients = [{"id": row.fhir_id, "birthdate": row.birthdate} for row in sample_result]
    
    # Direct database query (without schema prefix since search_path is set)
    query = text("""
        SELECT fhir_id, resource_type, deleted, 
               resource->>'id' as resource_id,
               resource->'identifier'->0->>'value' as identifier
        FROM resources
        WHERE resource_type = 'Patient'
        AND fhir_id = :patient_id
    """)
    
    result = await db.execute(query, {"patient_id": patient_id})
    row = result.fetchone()
    
    if row:
        return {
            "found": True,
            "current_schema": current_schema,
            "search_path": search_path,
            "db_fhir_id": row.fhir_id,
            "resource_type": row.resource_type,
            "deleted": row.deleted,
            "resource_id": row.resource_id,
            "identifier": row.identifier
        }
    else:
        # Try to find by partial match
        partial_query = text("""
            SELECT fhir_id, resource_type, 
                   resource->>'id' as resource_id
            FROM resources
            WHERE resource_type = 'Patient'
            AND fhir_id LIKE :pattern
            LIMIT 5
        """)
        
        partial_result = await db.execute(partial_query, {"pattern": f"%{patient_id[:8]}%"})
        partial_rows = partial_result.fetchall()
        
        return {
            "found": False,
            "current_schema": current_schema,
            "search_path": search_path,
            "searched_id": patient_id,
            "total_patients": total_patients,
            "sample_patients": sample_patients,
            "partial_matches": [
                {
                    "fhir_id": row.fhir_id,
                    "resource_id": row.resource_id
                }
                for row in partial_rows
            ]
        }

@debug_router.get("/test-fhir-client/{patient_id}")
async def test_fhir_client(
    patient_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Test HAPI FHIR client connectivity."""
    from services.fhir_client_config import get_resource

    # Try to read the patient
    try:
        resource = get_resource("Patient", patient_id)
        return {
            "fhir_client_result": "Found" if resource else "Not found",
            "resource": resource if resource else None
        }
    except Exception as e:
        return {
            "fhir_client_result": "Error",
            "error": str(e),
            "error_type": type(e).__name__
        }