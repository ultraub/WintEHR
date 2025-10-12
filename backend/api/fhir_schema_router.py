"""
FHIR Schema API Router
Provides endpoints for accessing FHIR R4 resource schemas and definitions
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import json
import os
from pathlib import Path
from .fhir_schema_definitions import FHIR_R4_SCHEMAS, get_schema, get_all_resource_types

router = APIRouter(prefix="/api/fhir-schemas", tags=["fhir-schemas"])

# Path to FHIR resource definitions
RESOURCE_DEFINITIONS_PATH = Path(__file__).parent.parent / "fhir" / "resource_definitions" / "official_resources" / "r4"

# Cache for loaded schemas
_schema_cache: Dict[str, Dict[str, Any]] = {}

def load_resource_schema(resource_type: str) -> Dict[str, Any]:
    """Load a FHIR resource schema from disk with caching"""
    if resource_type in _schema_cache:
        return _schema_cache[resource_type]
    
    schema_file = RESOURCE_DEFINITIONS_PATH / f"{resource_type}.json"
    if not schema_file.exists():
        raise HTTPException(status_code=404, detail=f"Schema for resource type '{resource_type}' not found")
    
    try:
        with open(schema_file, 'r') as f:
            schema = json.load(f)
        _schema_cache[resource_type] = schema
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading schema: {str(e)}")

def get_available_resources() -> List[str]:
    """Get list of all available FHIR resource types"""
    # First, get resources from our schema definitions
    resources = get_all_resource_types()
    
    # Then add any additional resources from files
    if RESOURCE_DEFINITIONS_PATH.exists():
        for file in RESOURCE_DEFINITIONS_PATH.glob("*.json"):
            if file.stem not in ['README', 'package'] and file.stem not in resources:
                resources.append(file.stem)
    
    return sorted(resources)

def simplify_element_definition(element: Dict[str, Any]) -> Dict[str, Any]:
    """Convert FHIR StructureDefinition element to simplified schema format"""
    simplified = {
        "path": element.get("path", ""),
        "type": None,
        "required": element.get("min", 0) > 0,
        "array": element.get("max", "1") != "1",
        "description": element.get("short", element.get("definition", "")),
    }
    
    # Extract type information
    if "type" in element and element["type"]:
        type_info = element["type"][0] if isinstance(element["type"], list) else element["type"]
        simplified["type"] = type_info.get("code", "unknown")
        
        # Handle references
        if simplified["type"] == "Reference" and "targetProfile" in type_info:
            profiles = type_info["targetProfile"]
            if isinstance(profiles, list) and profiles:
                # Extract resource type from profile URL
                simplified["targetTypes"] = [p.split("/")[-1] for p in profiles]
    
    # Handle fixed values
    if "fixed" in element:
        for key, value in element.items():
            if key.startswith("fixed"):
                simplified["fixed"] = value
                break
    
    # Handle bindings
    if "binding" in element:
        binding = element["binding"]
        simplified["binding"] = binding.get("description", binding.get("valueSet", ""))
    
    return simplified

@router.get("/resources", response_model=List[str])
async def list_resources():
    """Get list of all available FHIR R4 resource types"""
    return get_available_resources()

@router.get("/resource/{resource_type}")
async def get_resource_schema(resource_type: str):
    """Get simplified schema for a specific FHIR resource type"""
    # First check if we have a pre-defined schema
    schema = get_schema(resource_type)
    if schema:
        return schema
    
    # If not, try to load from file
    try:
        file_schema = load_resource_schema(resource_type)
        
        # Convert StructureDefinition to simplified format
        simplified_schema = {
            "resourceType": resource_type,
            "description": file_schema.get("description", ""),
            "elements": {}
        }
        
        # Process differential elements
        if "differential" in file_schema and "element" in file_schema["differential"]:
            for element in file_schema["differential"]["element"]:
                path = element.get("path", "")
                if "." in path:
                    # Extract element name from path
                    parts = path.split(".")
                    if len(parts) == 2:  # Direct child of resource
                        element_name = parts[1]
                        simplified_schema["elements"][element_name] = simplify_element_definition(element)
        
        # If differential is empty, try snapshot
        if not simplified_schema["elements"] and "snapshot" in file_schema and "element" in file_schema["snapshot"]:
            for element in file_schema["snapshot"]["element"]:
                path = element.get("path", "")
                if "." in path:
                    parts = path.split(".")
                    if len(parts) == 2:  # Direct child of resource
                        element_name = parts[1]
                        simplified_schema["elements"][element_name] = simplify_element_definition(element)
        
        return simplified_schema
    except HTTPException:
        raise HTTPException(status_code=404, detail=f"Schema for resource type '{resource_type}' not found")

@router.get("/resource/{resource_type}/full")
async def get_full_resource_schema(resource_type: str):
    """Get full StructureDefinition for a FHIR resource type"""
    return load_resource_schema(resource_type)

@router.get("/search")
async def search_schemas(
    q: str = Query(..., description="Search query"),
    limit: int = Query(20, ge=1, le=100)
):
    """Search across all resource schemas"""
    query = q.lower()
    results = []
    
    for resource_type in get_available_resources():
        try:
            schema = load_resource_schema(resource_type)
            
            # Search in resource type name and description
            if (query in resource_type.lower() or 
                query in schema.get("description", "").lower() or
                query in schema.get("purpose", "").lower()):
                
                results.append({
                    "resourceType": resource_type,
                    "description": schema.get("description", ""),
                    "url": schema.get("url", ""),
                    "status": schema.get("status", ""),
                    "kind": schema.get("kind", "resource")
                })
                
            if len(results) >= limit:
                break
                
        except Exception:
            continue
    
    return results

@router.get("/element-types")
async def get_element_types():
    """Get list of all FHIR data types with descriptions"""
    return {
        "primitive": {
            "boolean": {"description": "true | false", "color": "#2196F3"},
            "integer": {"description": "Whole number", "color": "#FF9800"},
            "string": {"description": "Sequence of characters", "color": "#4CAF50"},
            "decimal": {"description": "Decimal number", "color": "#FF9800"},
            "uri": {"description": "Uniform Resource Identifier", "color": "#9C27B0"},
            "url": {"description": "Uniform Resource Locator", "color": "#9C27B0"},
            "canonical": {"description": "Canonical URL reference", "color": "#9C27B0"},
            "base64Binary": {"description": "Base64 encoded binary", "color": "#795548"},
            "instant": {"description": "An instant in time", "color": "#00BCD4"},
            "date": {"description": "Date (year, month, day)", "color": "#00BCD4"},
            "dateTime": {"description": "Date and time", "color": "#00BCD4"},
            "time": {"description": "Time during the day", "color": "#00BCD4"},
            "code": {"description": "Coded value", "color": "#E91E63"},
            "markdown": {"description": "Markdown formatted text", "color": "#4CAF50"},
            "id": {"description": "Technical identifier", "color": "#9E9E9E"},
            "oid": {"description": "OID identifier", "color": "#9E9E9E"},
            "uuid": {"description": "UUID identifier", "color": "#9E9E9E"}
        },
        "complex": {
            "Identifier": {"description": "Business identifier", "color": "#3F51B5"},
            "HumanName": {"description": "Name of a human", "color": "#3F51B5"},
            "Address": {"description": "Postal address", "color": "#3F51B5"},
            "ContactPoint": {"description": "Contact details", "color": "#3F51B5"},
            "Timing": {"description": "Timing schedule", "color": "#3F51B5"},
            "Quantity": {"description": "Measured amount", "color": "#3F51B5"},
            "Attachment": {"description": "Content attachment", "color": "#3F51B5"},
            "Range": {"description": "Range of values", "color": "#3F51B5"},
            "Period": {"description": "Time period", "color": "#3F51B5"},
            "Ratio": {"description": "Ratio of quantities", "color": "#3F51B5"},
            "CodeableConcept": {"description": "Coded concept", "color": "#E91E63"},
            "Coding": {"description": "Code defined by system", "color": "#E91E63"},
            "Reference": {"description": "Reference to resource", "color": "#FF5722"},
            "Meta": {"description": "Resource metadata", "color": "#607D8B"},
            "Narrative": {"description": "Human-readable summary", "color": "#607D8B"}
        }
    }

@router.get("/stats")
async def get_schema_stats():
    """Get statistics about available FHIR schemas"""
    resources = get_available_resources()
    
    stats = {
        "totalResources": len(resources),
        "categories": {
            "clinical": 0,
            "administrative": 0,
            "workflow": 0,
            "financial": 0,
            "infrastructure": 0
        },
        "withSchemas": len(FHIR_R4_SCHEMAS),
        "resourceTypes": []
    }
    
    # Categorize resources
    clinical_resources = ["Patient", "Condition", "Observation", "Procedure", "MedicationRequest", 
                         "DiagnosticReport", "AllergyIntolerance", "Immunization", "CarePlan"]
    administrative_resources = ["Organization", "Practitioner", "PractitionerRole", "Location", 
                               "HealthcareService", "Endpoint", "Device"]
    workflow_resources = ["Task", "Appointment", "Schedule", "Slot", "AppointmentResponse", 
                         "ServiceRequest", "ReferralRequest"]
    financial_resources = ["Coverage", "Claim", "ClaimResponse", "ExplanationOfBenefit", 
                          "PaymentNotice", "PaymentReconciliation"]
    
    for resource in resources:
        if resource in clinical_resources:
            stats["categories"]["clinical"] += 1
        elif resource in administrative_resources:
            stats["categories"]["administrative"] += 1
        elif resource in workflow_resources:
            stats["categories"]["workflow"] += 1
        elif resource in financial_resources:
            stats["categories"]["financial"] += 1
        else:
            stats["categories"]["infrastructure"] += 1
    
    # Add sample resource types
    stats["resourceTypes"] = resources[:10]  # First 10 as sample
    
    return stats