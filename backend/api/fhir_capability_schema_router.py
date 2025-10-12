"""
FHIR Schema API Router using Capability Statement
Dynamically discovers resources from server capability statement
and fetches StructureDefinitions from FHIR registries
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Dict, Any, Optional
import httpx
import json
from functools import lru_cache
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/fhir-schemas-v2", tags=["fhir-schemas-v2"])

# Cache settings
CACHE_DURATION = timedelta(hours=1)
_cache: Dict[str, Any] = {}
_cache_timestamps: Dict[str, datetime] = {}

# FHIR Registry URLs for StructureDefinitions
FHIR_REGISTRIES = [
    "https://hl7.org/fhir/R4/",
    "https://build.fhir.org/",
    "http://hl7.org/fhir/"
]

def is_cache_valid(key: str) -> bool:
    """Check if cached data is still valid"""
    if key not in _cache_timestamps:
        return False
    return datetime.now() - _cache_timestamps[key] < CACHE_DURATION

def set_cache(key: str, value: Any):
    """Set cache with timestamp"""
    _cache[key] = value
    _cache_timestamps[key] = datetime.now()

def get_cache(key: str) -> Optional[Any]:
    """Get from cache if valid"""
    if is_cache_valid(key):
        return _cache.get(key)
    return None

async def fetch_capability_statement() -> Dict[str, Any]:
    """Fetch capability statement from HAPI FHIR server"""
    cache_key = "capability_statement"
    cached = get_cache(cache_key)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Updated to use HAPI FHIR endpoint
            response = await client.get("http://hapi-fhir:8080/fhir/metadata")
            if response.status_code == 200:
                data = response.json()
                set_cache(cache_key, data)
                return data
    except Exception as e:
        print(f"Error fetching capability statement from HAPI FHIR: {e}")

    # Return minimal capability statement if fetch fails
    return {
        "resourceType": "CapabilityStatement",
        "rest": [{
            "resource": []
        }]
    }

async def fetch_structure_definition(resource_type: str) -> Optional[Dict[str, Any]]:
    """Fetch StructureDefinition from FHIR registries"""
    cache_key = f"structure_def_{resource_type}"
    cached = get_cache(cache_key)
    if cached:
        return cached
    
    # Try different URLs for the StructureDefinition
    urls = [
        f"https://hl7.org/fhir/R4/{resource_type.lower()}.profile.json",
        f"https://hl7.org/fhir/R4/structuredefinition-{resource_type.lower()}.json",
        f"https://build.fhir.org/{resource_type.lower()}.profile.json"
    ]
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        for url in urls:
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    set_cache(cache_key, data)
                    return data
            except Exception:
                continue
    
    return None

def extract_schema_from_structure_definition(struct_def: Dict[str, Any]) -> Dict[str, Any]:
    """Extract simplified schema from StructureDefinition"""
    schema = {
        "resourceType": struct_def.get("id", "Unknown"),
        "url": struct_def.get("url", ""),
        "version": struct_def.get("version", ""),
        "name": struct_def.get("name", ""),
        "title": struct_def.get("title", ""),
        "status": struct_def.get("status", ""),
        "description": struct_def.get("description", ""),
        "elements": {}
    }
    
    # Extract elements from snapshot or differential
    elements_source = struct_def.get("snapshot", struct_def.get("differential", {}))
    elements = elements_source.get("element", [])
    
    # Group elements by their parent path
    element_tree = {}
    
    for element in elements:
        path = element.get("path", "")
        if "." not in path:
            continue  # Skip root element
            
        parts = path.split(".")
        
        # Build element info
        elem_info = {
            "path": path,
            "type": None,
            "required": element.get("min", 0) > 0,
            "array": element.get("max", "1") != "1",
            "description": element.get("short", element.get("definition", "")),
        }
        
        # Extract type - handle multiple types for choice elements
        if "type" in element and element["type"]:
            types = element["type"] if isinstance(element["type"], list) else [element["type"]]
            
            if len(types) == 1:
                type_info = types[0]
                type_code = type_info.get("code", "unknown")
                
                # Clean up type code if it's a URL
                if type_code.startswith("http://"):
                    # Extract the last part of the URL
                    type_code = type_code.split("/")[-1]
                    # Handle System.String -> string conversion
                    if type_code.startswith("System."):
                        type_code = type_code[7:].lower()
                
                elem_info["type"] = type_code
                
                # Handle references
                if elem_info["type"] == "Reference" and "targetProfile" in type_info:
                    profiles = type_info["targetProfile"]
                    if isinstance(profiles, list):
                        elem_info["targetTypes"] = [p.split("/")[-1] for p in profiles]
            else:
                # Choice element with multiple types
                elem_info["type"] = "Choice"
                elem_info["choices"] = []
                for type_info in types:
                    type_code = type_info.get("code", "unknown")
                    
                    # Clean up type code if it's a URL
                    if type_code.startswith("http://"):
                        type_code = type_code.split("/")[-1]
                        if type_code.startswith("System."):
                            type_code = type_code[7:].lower()
                    
                    choice = {
                        "type": type_code
                    }
                    if type_code == "Reference" and "targetProfile" in type_info:
                        profiles = type_info["targetProfile"]
                        if isinstance(profiles, list):
                            choice["targetTypes"] = [p.split("/")[-1] for p in profiles]
                    elem_info["choices"].append(choice)
        
        # Handle bindings
        if "binding" in element:
            binding = element["binding"]
            elem_info["binding"] = {
                "strength": binding.get("strength", ""),
                "valueSet": binding.get("valueSet", ""),
                "description": binding.get("description", "")
            }
        
        # Handle constraints
        if "constraint" in element:
            elem_info["constraints"] = [
                {
                    "key": c.get("key", ""),
                    "severity": c.get("severity", ""),
                    "human": c.get("human", ""),
                    "expression": c.get("expression", "")
                }
                for c in element.get("constraint", [])
            ]
        
        # Store in tree structure
        if len(parts) == 2:  # Direct child of resource
            element_name = parts[1]
            # Handle choice elements that end with [x]
            if element_name.endswith("[x]"):
                element_name = element_name[:-3]
                elem_info["isChoice"] = True
            schema["elements"][element_name] = elem_info
        else:
            # For nested elements, find the parent and add as sub-element
            parent_parts = parts[:-1]
            element_name = parts[-1]
            
            # Find the parent element
            parent_key = None
            for i in range(len(parent_parts) - 1, 0, -1):
                potential_key = parent_parts[i]
                if potential_key in schema["elements"]:
                    parent_key = potential_key
                    break
            
            if parent_key:
                # Initialize elements dict if not exists
                if "elements" not in schema["elements"][parent_key]:
                    schema["elements"][parent_key]["elements"] = {}
                
                # Handle choice elements
                if element_name.endswith("[x]"):
                    element_name = element_name[:-3]
                    elem_info["isChoice"] = True
                    
                schema["elements"][parent_key]["elements"][element_name] = elem_info
            else:
                # Store as flat if parent not found
                full_path = ".".join(parts[1:])
                schema["elements"][full_path] = elem_info
    
    return schema

@router.get("/resources")
async def list_resources():
    """Get list of resources from server capability statement"""
    capability = await fetch_capability_statement()
    
    resources = []
    for rest in capability.get("rest", []):
        for resource in rest.get("resource", []):
            resources.append(resource.get("type"))
    
    return sorted(list(set(resources)))

@router.get("/capability-statement")
async def get_capability_statement():
    """Get the full capability statement"""
    return await fetch_capability_statement()

@router.get("/resource/{resource_type}")
async def get_resource_schema(resource_type: str):
    """Get schema for a specific resource type"""
    # First check if resource is supported
    capability = await fetch_capability_statement()
    supported_resources = set()
    
    for rest in capability.get("rest", []):
        for resource in rest.get("resource", []):
            supported_resources.add(resource.get("type"))
    
    if resource_type not in supported_resources:
        raise HTTPException(
            status_code=404, 
            detail=f"Resource type '{resource_type}' is not supported by this server"
        )
    
    # Try to fetch StructureDefinition
    struct_def = await fetch_structure_definition(resource_type)
    if struct_def:
        return extract_schema_from_structure_definition(struct_def)
    
    # Return basic schema if StructureDefinition not found
    return {
        "resourceType": resource_type,
        "description": f"FHIR R4 {resource_type} resource",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": resource_type,
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            }
        }
    }

@router.get("/resource/{resource_type}/interactions")
async def get_resource_interactions(resource_type: str):
    """Get supported interactions for a resource type"""
    capability = await fetch_capability_statement()
    
    for rest in capability.get("rest", []):
        for resource in rest.get("resource", []):
            if resource.get("type") == resource_type:
                return {
                    "resourceType": resource_type,
                    "interactions": resource.get("interaction", []),
                    "searchParams": resource.get("searchParam", []),
                    "versioning": resource.get("versioning"),
                    "readHistory": resource.get("readHistory"),
                    "updateCreate": resource.get("updateCreate"),
                    "conditionalCreate": resource.get("conditionalCreate"),
                    "conditionalRead": resource.get("conditionalRead"),
                    "conditionalUpdate": resource.get("conditionalUpdate"),
                    "conditionalDelete": resource.get("conditionalDelete")
                }
    
    raise HTTPException(status_code=404, detail=f"Resource type '{resource_type}' not found")

@router.get("/search-parameters/{resource_type}")
async def get_search_parameters(resource_type: str):
    """Get search parameters for a resource type"""
    capability = await fetch_capability_statement()
    
    # Get resource-specific search params
    resource_params = []
    for rest in capability.get("rest", []):
        for resource in rest.get("resource", []):
            if resource.get("type") == resource_type:
                resource_params = resource.get("searchParam", [])
                break
        
        # Also include system-wide search params
        system_params = rest.get("searchParam", [])
    
    return {
        "resourceType": resource_type,
        "resourceParams": resource_params,
        "systemParams": system_params
    }

@router.get("/stats")
async def get_schema_stats():
    """Get statistics about server capabilities"""
    capability = await fetch_capability_statement()
    
    stats = {
        "fhirVersion": capability.get("fhirVersion", "Unknown"),
        "serverDescription": capability.get("implementation", {}).get("description", ""),
        "totalResources": 0,
        "categories": {
            "clinical": 0,
            "administrative": 0,
            "financial": 0,
            "workflow": 0,
            "infrastructure": 0
        },
        "interactions": set(),
        "formats": capability.get("format", [])
    }
    
    # Categorize resources
    clinical = {"Patient", "Condition", "Observation", "Procedure", "MedicationRequest", 
                "DiagnosticReport", "AllergyIntolerance", "Immunization", "CarePlan"}
    administrative = {"Organization", "Practitioner", "PractitionerRole", "Location", 
                     "HealthcareService", "Endpoint", "Device"}
    financial = {"Coverage", "Claim", "ClaimResponse", "ExplanationOfBenefit"}
    workflow = {"Task", "Appointment", "ServiceRequest", "Schedule", "Slot"}
    
    for rest in capability.get("rest", []):
        for resource in rest.get("resource", []):
            resource_type = resource.get("type", "")
            stats["totalResources"] += 1
            
            # Categorize
            if resource_type in clinical:
                stats["categories"]["clinical"] += 1
            elif resource_type in administrative:
                stats["categories"]["administrative"] += 1
            elif resource_type in financial:
                stats["categories"]["financial"] += 1
            elif resource_type in workflow:
                stats["categories"]["workflow"] += 1
            else:
                stats["categories"]["infrastructure"] += 1
            
            # Collect interactions
            for interaction in resource.get("interaction", []):
                stats["interactions"].add(interaction.get("code", ""))
    
    stats["interactions"] = list(stats["interactions"])
    return stats

@router.post("/refresh-cache")
async def refresh_cache():
    """Force refresh of cached data"""
    global _cache, _cache_timestamps
    _cache.clear()
    _cache_timestamps.clear()
    
    # Pre-fetch capability statement
    await fetch_capability_statement()
    
    return {"message": "Cache cleared and capability statement refreshed"}