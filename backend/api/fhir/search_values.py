"""
FHIR Search Parameter Distinct Values API
Provides distinct values for token-type search parameters

Updated: 2025-10-05 - Migrated to use HAPI FHIR JPA search index tables
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Optional
import logging
from sqlalchemy import text
from database import get_db_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fhir/search-values", tags=["fhir-search-values"])


@router.get("/{resource_type}/{parameter_name}")
async def get_distinct_values(
    resource_type: str,
    parameter_name: str,
    limit: int = Query(default=100, description="Maximum number of distinct values to return"),
    db = Depends(get_db_session)
):
    """
    Get distinct values for a specific search parameter.
    
    This is particularly useful for token-type parameters like gender, status, etc.
    """
    try:
        # Map common parameter aliases
        param_aliases = {
            'patient': 'subject',  # patient is often an alias for subject
            'subject': 'patient'   # and vice versa
        }

        # Query HAPI FHIR search index tables (updated 2025-10-05)
        # Try token index first (most common for parameters like status, gender, code)
        query = text("""
            SELECT DISTINCT
                sp.sp_value as value,
                COUNT(*) as usage_count
            FROM hfj_spidx_token sp
            WHERE sp.res_type = :resource_type
            AND sp.sp_name = :param_name
            AND sp.sp_value IS NOT NULL
            GROUP BY sp.sp_value
            ORDER BY usage_count DESC
            LIMIT :limit
        """)

        result = db.execute(
            query,
            {
                "resource_type": resource_type,
                "param_name": parameter_name,
                "limit": limit
            }
        )

        values = []
        for row in result:
            value = row.value
            if value:
                # Clean up the value
                # Remove prefixes like "urn:uuid:" or resource type prefixes
                if value.startswith("urn:uuid:"):
                    continue  # Skip UUIDs
                if "/" in value:
                    value = value.split("/", 1)[1]  # Get just the ID part

                values.append({
                    "value": value,
                    "display": value.replace("-", " ").replace("_", " ").title(),
                    "count": row.usage_count
                })

        # If no results from token index, try string index (for name, address, etc.)
        if not values:
            string_query = text("""
                SELECT DISTINCT
                    sp.sp_value_normalized as value,
                    COUNT(*) as usage_count
                FROM hfj_spidx_string sp
                WHERE sp.res_type = :resource_type
                AND sp.sp_name = :param_name
                AND sp.sp_value_normalized IS NOT NULL
                GROUP BY sp.sp_value_normalized
                ORDER BY usage_count DESC
                LIMIT :limit
            """)

            result = db.execute(
                string_query,
                {
                    "resource_type": resource_type,
                    "param_name": parameter_name,
                    "limit": limit
                }
            )

            for row in result:
                value = row.value
                if value:
                    values.append({
                        "value": value,
                        "display": value.title() if value.islower() else value,
                        "count": row.usage_count
                    })
        
        # For certain well-known parameters, add standard values if not present
        standard_values = {
            "gender": [
                {"value": "male", "display": "Male", "count": 0},
                {"value": "female", "display": "Female", "count": 0},
                {"value": "other", "display": "Other", "count": 0},
                {"value": "unknown", "display": "Unknown", "count": 0}
            ],
            "status": {
                "Patient": [
                    {"value": "active", "display": "Active", "count": 0},
                    {"value": "inactive", "display": "Inactive", "count": 0}
                ],
                "Observation": [
                    {"value": "registered", "display": "Registered", "count": 0},
                    {"value": "preliminary", "display": "Preliminary", "count": 0},
                    {"value": "final", "display": "Final", "count": 0},
                    {"value": "amended", "display": "Amended", "count": 0},
                    {"value": "corrected", "display": "Corrected", "count": 0},
                    {"value": "cancelled", "display": "Cancelled", "count": 0},
                    {"value": "entered-in-error", "display": "Entered in Error", "count": 0}
                ],
                "MedicationRequest": [
                    {"value": "active", "display": "Active", "count": 0},
                    {"value": "on-hold", "display": "On Hold", "count": 0},
                    {"value": "cancelled", "display": "Cancelled", "count": 0},
                    {"value": "completed", "display": "Completed", "count": 0},
                    {"value": "entered-in-error", "display": "Entered in Error", "count": 0},
                    {"value": "stopped", "display": "Stopped", "count": 0},
                    {"value": "draft", "display": "Draft", "count": 0}
                ]
            },
            "clinical-status": [
                {"value": "active", "display": "Active", "count": 0},
                {"value": "recurrence", "display": "Recurrence", "count": 0},
                {"value": "relapse", "display": "Relapse", "count": 0},
                {"value": "inactive", "display": "Inactive", "count": 0},
                {"value": "remission", "display": "Remission", "count": 0},
                {"value": "resolved", "display": "Resolved", "count": 0}
            ]
        }
        
        # Merge with standard values if applicable
        if parameter_name in standard_values:
            std_vals = standard_values[parameter_name]
            if isinstance(std_vals, dict):
                std_vals = std_vals.get(resource_type, [])
            
            # Create a map of existing values
            existing_values = {v["value"]: v for v in values}
            
            # Add standard values that aren't already present
            for std_val in std_vals:
                if std_val["value"] not in existing_values:
                    values.append(std_val)
        
        return {
            "resource_type": resource_type,
            "parameter": parameter_name,
            "values": values,
            "total": len(values)
        }
        
    except Exception as e:
        logger.error(f"Error getting distinct values: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get distinct values: {str(e)}"
        )


@router.get("/{resource_type}")
async def get_searchable_parameters(
    resource_type: str,
    db = Depends(get_db_session)
):
    """
    Get all searchable parameters for a resource type that have values in the database.
    """
    try:
        query = text("""
            SELECT DISTINCT sp.param_name
            FROM fhir.search_params sp
            JOIN fhir.resources r ON sp.resource_id = r.id
            WHERE r.resource_type = :resource_type
            ORDER BY sp.param_name
        """)
        
        result = db.execute(query, {"resource_type": resource_type})
        
        parameters = [row.param_name for row in result]
        
        return {
            "resource_type": resource_type,
            "parameters": parameters,
            "total": len(parameters)
        }
        
    except Exception as e:
        logger.error(f"Error getting searchable parameters: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get searchable parameters: {str(e)}"
        )