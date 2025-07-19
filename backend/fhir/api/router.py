"""
Consolidated FHIR R4 API Router

Combines the clean architecture of the active router with all Phase 1-3 features.
This is the single source of truth for FHIR API functionality.

Features:
- All basic FHIR operations (CRUD, search, history, bundles)
- Composite search parameters
- _has parameter support
- Advanced search modifiers (:missing, :exact, :contains)
- MedicationDispense lot tracking
- Observation based-on linking
- Full _include/_revinclude support
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, Body
from fastapi.responses import JSONResponse, Response as FastAPIResponse
from typing import Dict, List, Optional, Any, Set
from datetime import datetime
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, and_, or_, func

from fhir.core.storage import FHIRStorageEngine, ConditionalCreateExistingResource, FHIRJSONEncoder
from fhir.core.validators.synthea import SyntheaFHIRValidator
from fhir.core.operations import OperationHandler
from fhir.core.search.basic import SearchParameterHandler
from fhir.core.search.composite import CompositeSearchHandler
from fhir.core.utils import search_all_resources
from fhir.api.summary_definitions import apply_summary_to_resource, apply_elements_to_resource
from fhir.api.cache import get_search_cache
from database import get_db_session
from fhir.core.resources_r4b import construct_fhir_element, Bundle, Parameters
import logging

logger = logging.getLogger(__name__)


class FHIRJSONResponse(Response):
    """Custom JSON response that handles FHIR resources with proper encoding"""
    
    def __init__(self, content: Any, status_code: int = 200, headers: Optional[Dict[str, str]] = None):
        # Use our custom encoder to serialize the content
        json_content = json.dumps(content, cls=FHIRJSONEncoder, separators=(',', ':'))
        
        response_headers = headers or {}
        response_headers["Content-Type"] = "application/fhir+json"
        
        super().__init__(
            content=json_content,
            status_code=status_code,
            headers=response_headers,
            media_type="application/fhir+json"
        )


# Create main FHIR router
fhir_router = APIRouter(prefix="/fhir/R4", tags=["FHIR"])

# Supported resource types - comprehensive list
SUPPORTED_RESOURCES = [
    "Patient", "Practitioner", "Organization", "Location",
    "Encounter", "Appointment", "Observation", "Condition",
    "Procedure", "Medication", "MedicationRequest", "MedicationStatement",
    "MedicationDispense", "MedicationAdministration",
    "DiagnosticReport", "ImagingStudy", "CarePlan", "Goal",
    "Immunization", "AllergyIntolerance", "DocumentReference",
    "Task", "ServiceRequest", "Specimen", "Device",
    "Questionnaire", "QuestionnaireResponse", "ValueSet",
    "CodeSystem", "ConceptMap", "StructureDefinition",
    "PractitionerRole", "CareTeam", "Claim", "Coverage",
    "ExplanationOfBenefit", "SupplyDelivery", "Provenance", 
    "List", "Basic", "Composition", "Media", "Schedule",
    "Slot", "Communication", "CommunicationRequest"
]


@fhir_router.get("/metadata")
async def get_capability_statement():
    """
    Get server capability statement.
    
    Returns the server's CapabilityStatement resource describing
    what operations and resources are supported.
    """
    # Build CapabilityStatement as a dictionary since we work with JSON
    capability_statement = {
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": datetime.now().isoformat(),
        "kind": "instance",
        "fhirVersion": "4.0.1",
        "format": ["application/fhir+json", "application/json"],
        "implementation": {
            "description": "WintEHR FHIR R4 Server - Consolidated Implementation",
            "url": "http://localhost:8000/fhir/R4"
        },
        "rest": [{
            "mode": "server",
            "resource": [
                {
                    "type": resource_type,
                    "interaction": [
                        {"code": "read"},
                        {"code": "vread"},
                        {"code": "update"},
                        {"code": "delete"},
                        {"code": "history-instance"},
                        {"code": "history-type"},
                        {"code": "create"},
                        {"code": "search-type"}
                    ],
                    "versioning": "versioned",
                    "readHistory": True,
                    "updateCreate": True,
                    "conditionalCreate": True,
                    "conditionalRead": "full-support",
                    "conditionalUpdate": True,
                    "conditionalDelete": "single",
                    "searchParam": _get_search_params_for_resource(resource_type)
                }
                for resource_type in SUPPORTED_RESOURCES
            ],
            "interaction": [
                {"code": "transaction"},
                {"code": "batch"},
                {"code": "search-system"},
                {"code": "history-system"}
            ],
            "searchParam": [
                {
                    "name": "_id",
                    "type": "token",
                    "documentation": "Resource ID"
                },
                {
                    "name": "_lastUpdated",
                    "type": "date",
                    "documentation": "Last updated date"
                },
                {
                    "name": "_has",
                    "type": "string",
                    "documentation": "Reverse chaining parameter"
                }
            ]
        }]
    }
    
    return capability_statement


@fhir_router.post("/")
async def process_bundle(
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Process a Bundle (batch/transaction).
    
    Handles batch and transaction bundles according to FHIR specifications.
    """
    storage = FHIRStorageEngine(db)
    
    # Get the raw request body
    try:
        bundle_data = await request.json()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid JSON in request body: {str(e)}"
        )
    
    # Validate it's a Bundle
    if not isinstance(bundle_data, dict) or bundle_data.get('resourceType') != 'Bundle':
        raise HTTPException(
            status_code=400,
            detail="Request body must be a FHIR Bundle resource"
        )
    
    # Construct Bundle object
    try:
        # Clean bundle data to remove any invalid fields
        clean_bundle_data = {k: v for k, v in bundle_data.items() if k != 'fhirVersion'}
        
        # Also clean nested resources in entries
        if 'entry' in clean_bundle_data:
            for entry in clean_bundle_data.get('entry', []):
                if 'resource' in entry and isinstance(entry['resource'], dict):
                    # Remove fhirVersion from nested resources
                    entry['resource'].pop('fhirVersion', None)
        
        bundle = clean_bundle_data
    except Exception as e:
        # If validation fails, try direct processing
        try:
            response_data = await storage.process_bundle_dict(clean_bundle_data)
            return FHIRJSONResponse(response_data)
        except Exception as e2:
            logger.error(f"Bundle processing failed: {e2}")
            raise HTTPException(status_code=500, detail=str(e2))
    
    if bundle.get("type") not in ["batch", "transaction"]:
        raise HTTPException(
            status_code=400,
            detail="Only batch and transaction bundles are supported"
        )
    
    try:
        response_bundle = await storage.process_bundle_dict(bundle)
        return FHIRJSONResponse(response_bundle)
    except Exception as e:
        logger.error(f"ERROR in process_bundle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@fhir_router.get("/{resource_type}")
async def search_resources(
    resource_type: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _format: Optional[str] = Query(None, alias="_format"),
    _pretty: Optional[bool] = Query(None, alias="_pretty"),
    _summary: Optional[str] = Query(None, alias="_summary"),
    _elements: Optional[str] = Query(None, alias="_elements"),
    _count: Optional[int] = Query(None, alias="_count"),
    _page: Optional[int] = Query(None, alias="_page"),
    _has: Optional[List[str]] = Query(None, alias="_has")
):
    """
    Search for resources with full Phase 1-3 feature support.
    
    Supports:
    - All standard search parameters
    - Composite search parameters  
    - _has parameter (reverse chaining)
    - Advanced modifiers (:missing, :exact, :contains)
    - _include/_revinclude
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    search_handler = SearchParameterHandler(storage._get_search_parameter_definitions())
    
    # Get all query parameters
    query_params = dict(request.query_params)
    
    # Parse search parameters
    search_params, result_params = search_handler.parse_search_params(
        resource_type, query_params
    )
    
    # Handle _has parameter if present
    if _has:
        # Process _has parameters to filter resources
        has_resource_ids = await _process_has_parameters(resource_type, _has, db)
        if has_resource_ids is not None:
            # Add ID filter to search params
            if '_id' not in search_params:
                search_params['_id'] = {
                    'name': '_id',
                    'type': 'token',
                    'modifier': None,
                    'values': []
                }
            # Add the filtered IDs
            for resource_id in has_resource_ids:
                search_params['_id']['values'].append({'code': resource_id})
    
    # Handle _summary=count specially - only return count, no resources
    if _summary == "count":
        # Get only the count, not the actual resources
        _, total = await storage.search_resources(
            resource_type,
            search_params,
            offset=0,
            limit=0  # Don't fetch any resources
        )
        
        # Return count-only bundle
        bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "total": total
        }
        return bundle
    
    # Calculate pagination for normal searches
    count = _count or 10
    page = _page or 1
    offset = (page - 1) * count
    
    # Try to get from cache first (only for GET requests without _include/_revinclude)
    cache = get_search_cache()
    use_cache = (
        request.method == "GET" and 
        "_include" not in result_params and 
        "_revinclude" not in result_params
    )
    
    if use_cache:
        # Create cache key from search params
        cache_params = {
            "search_params": search_params,
            "offset": offset,
            "limit": count,
            "_summary": _summary,
            "_elements": _elements
        }
        cached_result = cache.get(resource_type, cache_params)
        if cached_result is not None:
            resources, total = cached_result
            logger.debug(f"Using cached search results for {resource_type}")
        else:
            # Execute search
            resources, total = await storage.search_resources(
                resource_type,
                search_params,
                offset=offset,
                limit=count
            )
            # Cache the result
            cache.set(resource_type, cache_params, resources, total)
    else:
        # Execute search without caching
        resources, total = await storage.search_resources(
            resource_type,
            search_params,
            offset=offset,
            limit=count
        )
    
    # Build search bundle
    bundle = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": total,
        "entry": []
    }
    
    # Add navigation links
    base_url = str(request.url).split('?')[0]
    params_str = str(request.url.query)
    
    bundle["link"] = [
        {"relation": "self", "url": str(request.url)}
    ]
    
    if page > 1:
        prev_page = page - 1
        prev_url = f"{base_url}?{params_str.replace(f'_page={page}', f'_page={prev_page}')}"
        bundle["link"].append({"relation": "previous", "url": prev_url})
    
    if offset + count < total:
        next_page = page + 1
        next_url = f"{base_url}?{params_str.replace(f'_page={page}', f'_page={next_page}')}"
        bundle["link"].append({"relation": "next", "url": next_url})
    
    # Add resources to bundle with _summary and _elements applied
    for resource_data in resources:
        # Apply _summary parameter if present
        if _summary and _summary != "count":
            resource_data = apply_summary_to_resource(resource_data, _summary)
        
        # Apply _elements parameter if present
        if _elements:
            elements_list = [e.strip() for e in _elements.split(',')]
            resource_data = apply_elements_to_resource(resource_data, elements_list)
        
        entry = {
            "fullUrl": f"{base_url}/{resource_data['id']}",
            "resource": resource_data,
            "search": {"mode": "match"}
        }
        bundle["entry"].append(entry)
    
    # Handle _include and _revinclude
    if "_include" in result_params:
        await _process_includes(storage, bundle, result_params["_include"], base_url)
    
    if "_revinclude" in result_params:
        await _process_revincludes(storage, bundle, result_params["_revinclude"], base_url)
    
    return bundle


@fhir_router.post("/{resource_type}")
async def create_resource(
    resource_type: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Create a new resource.
    
    Supports conditional create with If-None-Exist header.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    
    # Check for If-None-Exist header
    if_none_exist = request.headers.get("If-None-Exist")
    
    # Get resource data
    resource_data = await request.json()
    
    try:
        # Create resource
        fhir_id, version_id, last_updated = await storage.create_resource(
            resource_type,
            resource_data,
            if_none_exist
        )
        
        # Get the created resource to return in response body
        created_resource = await storage.read_resource(resource_type, fhir_id)
        
        # Invalidate cache for this resource type
        cache = get_search_cache()
        cache.invalidate_resource_type(resource_type)
        
        # Build response for newly created resource
        response = FHIRJSONResponse(
            content=created_resource,
            status_code=201,
            headers={
                "Location": f"{resource_type}/{fhir_id}",
                "ETag": f'W/"{version_id}"',
                "Last-Modified": last_updated.strftime("%a, %d %b %Y %H:%M:%S GMT") if isinstance(last_updated, datetime) else str(last_updated)
            }
        )
        
        return response
        
    except ConditionalCreateExistingResource as e:
        # Conditional create found existing resource - return 200 OK
        existing_resource = await storage.read_resource(resource_type, e.fhir_id)
        
        response = FHIRJSONResponse(
            content=existing_resource,
            status_code=200,
            headers={
                "Location": f"{resource_type}/{e.fhir_id}",
                "ETag": f'W/"{e.version_id}"',
                "Last-Modified": e.last_updated.strftime("%a, %d %b %Y %H:%M:%S GMT") if isinstance(e.last_updated, datetime) else str(e.last_updated)
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error in create_resource: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@fhir_router.get("/{resource_type}/{id}")
async def read_resource(
    resource_type: str,
    id: str,
    db: AsyncSession = Depends(get_db_session),
    _format: Optional[str] = Query(None, alias="_format"),
    _pretty: Optional[bool] = Query(None, alias="_pretty"),
    _summary: Optional[str] = Query(None, alias="_summary"),
    _elements: Optional[str] = Query(None, alias="_elements")
):
    """
    Read a resource by ID.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    
    # Read resource
    resource = await storage.read_resource(resource_type, id)
    
    if not resource:
        raise HTTPException(
            status_code=404,
            detail=f"Resource {resource_type}/{id} not found"
        )
    
    # Apply _summary and _elements
    if _summary:
        resource = _apply_summary(resource, _summary)
    
    if _elements:
        resource = _apply_elements(resource, _elements.split(','))
    
    # Build response
    response = JSONResponse(content=resource)
    response.headers["ETag"] = f'W/"{resource.get("meta", {}).get("versionId", "1")}"'
    response.headers["Last-Modified"] = resource.get("meta", {}).get("lastUpdated", "")
    
    return response


@fhir_router.put("/{resource_type}/{id}")
async def update_resource(
    resource_type: str,
    id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Update a resource.
    
    Supports conditional update with If-Match header.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    
    # Check for If-Match header
    if_match = request.headers.get("If-Match")
    
    # Get resource data
    resource_data = await request.json()
    
    # Ensure ID matches
    if resource_data.get("id") and resource_data["id"] != id:
        raise HTTPException(
            status_code=400,
            detail="Resource ID in URL must match ID in resource"
        )
    
    resource_data["id"] = id
    
    try:
        # Update resource
        version_id, last_updated = await storage.update_resource(
            resource_type,
            id,
            resource_data,
            if_match
        )
        
        # Get the updated resource to return in response body
        updated_resource = await storage.read_resource(resource_type, id)
        
        # Invalidate cache for this resource type
        cache = get_search_cache()
        cache.invalidate_resource_type(resource_type)
        
        # Build response
        response = FHIRJSONResponse(
            content=updated_resource,
            status_code=200,
            headers={
                "ETag": f'W/"{version_id}"',
                "Last-Modified": last_updated.strftime("%a, %d %b %Y %H:%M:%S GMT") if isinstance(last_updated, datetime) else str(last_updated)
            }
        )
        
        return response
        
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        elif "version mismatch" in str(e):
            raise HTTPException(status_code=409, detail=str(e))
        else:
            raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@fhir_router.delete("/{resource_type}/{id}")
async def delete_resource(
    resource_type: str,
    id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Delete a resource.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    
    # Delete resource
    deleted = await storage.delete_resource(resource_type, id)
    
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Resource {resource_type}/{id} not found"
        )
    
    # Invalidate cache for this resource type
    cache = get_search_cache()
    cache.invalidate_resource_type(resource_type)
    
    return Response(status_code=204)


@fhir_router.get("/{resource_type}/_history")
async def get_type_history(
    resource_type: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _count: Optional[int] = Query(None, alias="_count"),
    _since: Optional[str] = Query(None, alias="_since"),
    _at: Optional[str] = Query(None, alias="_at"),
    _page: Optional[int] = Query(None, alias="_page")
):
    """
    Get history for all resources of a type.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    
    # Parse datetime parameters
    since = None
    at = None
    if _since:
        try:
            since = datetime.fromisoformat(_since.replace('Z', '+00:00'))
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid _since parameter format: {str(e)}")
    
    if _at:
        try:
            at = datetime.fromisoformat(_at.replace('Z', '+00:00'))
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid _at parameter format: {str(e)}")
    
    # Calculate pagination
    count = _count or 100
    page = _page or 1
    offset = (page - 1) * count
    
    # Get history
    history = await storage.get_history(
        resource_type=resource_type,
        offset=offset,
        limit=count,
        since=since,
        at=at
    )
    
    # Get total count for pagination
    total_history = await storage.get_history(
        resource_type=resource_type,
        limit=999999,  # Get all for count
        since=since,
        at=at
    )
    total = len(total_history)
    
    # Build history bundle
    bundle = {
        "resourceType": "Bundle",
        "type": "history",
        "total": total,
        "entry": []
    }
    
    # Add navigation links
    base_url = str(request.url).split('?')[0]
    params_dict = dict(request.query_params)
    
    bundle["link"] = [
        {"relation": "self", "url": str(request.url)}
    ]
    
    if page > 1:
        prev_params = params_dict.copy()
        prev_params['_page'] = str(page - 1)
        prev_url = f"{base_url}?" + "&".join(f"{k}={v}" for k, v in prev_params.items())
        bundle["link"].append({"relation": "previous", "url": prev_url})
    
    if offset + count < total:
        next_params = params_dict.copy()
        next_params['_page'] = str(page + 1)
        next_url = f"{base_url}?" + "&".join(f"{k}={v}" for k, v in next_params.items())
        bundle["link"].append({"relation": "next", "url": next_url})
    
    for entry in history:
        bundle["entry"].append({
            "fullUrl": f"{base_url.replace('/_history', '')}/{entry['id']}/_history/{entry['versionId']}",
            "resource": entry['resource'],
            "request": {
                "method": entry['operation'].upper(),
                "url": f"{resource_type}/{entry['id']}"
            },
            "response": {
                "status": "200",
                "lastModified": entry['lastUpdated']
            }
        })
    
    return bundle


@fhir_router.get("/{resource_type}/{id}/_history")
async def get_instance_history(
    resource_type: str,
    id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _count: Optional[int] = Query(None, alias="_count"),
    _since: Optional[str] = Query(None, alias="_since"),
    _at: Optional[str] = Query(None, alias="_at"),
    _page: Optional[int] = Query(None, alias="_page")
):
    """
    Get history for a specific resource.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    
    # Parse datetime parameters
    since = None
    at = None
    if _since:
        try:
            since = datetime.fromisoformat(_since.replace('Z', '+00:00'))
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid _since parameter format: {str(e)}")
    
    if _at:
        try:
            at = datetime.fromisoformat(_at.replace('Z', '+00:00'))
        except (ValueError, AttributeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid _at parameter format: {str(e)}")
    
    # Calculate pagination
    count = _count or 100
    page = _page or 1
    offset = (page - 1) * count
    
    # Get history
    history = await storage.get_history(
        resource_type=resource_type,
        fhir_id=id,
        offset=offset,
        limit=count,
        since=since,
        at=at
    )
    
    # Check if resource exists
    if not history:
        # Check if resource exists at all
        current = await storage.read_resource(resource_type, id)
        if not current:
            raise HTTPException(
                status_code=404,
                detail=f"Resource {resource_type}/{id} not found"
            )
    
    # Get total count for pagination
    total_history = await storage.get_history(
        resource_type=resource_type,
        fhir_id=id,
        limit=999999,  # Get all for count
        since=since,
        at=at
    )
    total = len(total_history)
    
    # Build history bundle
    bundle = {
        "resourceType": "Bundle",
        "type": "history",
        "total": total,
        "entry": []
    }
    
    # Add navigation links
    base_url = str(request.url).split('?')[0]
    params_dict = dict(request.query_params)
    
    bundle["link"] = [
        {"relation": "self", "url": str(request.url)}
    ]
    
    if page > 1:
        prev_params = params_dict.copy()
        prev_params['_page'] = str(page - 1)
        prev_url = f"{base_url}?" + "&".join(f"{k}={v}" for k, v in prev_params.items())
        bundle["link"].append({"relation": "previous", "url": prev_url})
    
    if offset + count < total:
        next_params = params_dict.copy()
        next_params['_page'] = str(page + 1)
        next_url = f"{base_url}?" + "&".join(f"{k}={v}" for k, v in next_params.items())
        bundle["link"].append({"relation": "next", "url": next_url})
    
    for entry in history:
        bundle["entry"].append({
            "fullUrl": f"{base_url.replace('/_history', '')}/_history/{entry['versionId']}",
            "resource": entry['resource'],
            "request": {
                "method": entry['operation'].upper(),
                "url": f"{resource_type}/{id}"
            },
            "response": {
                "status": "200",
                "lastModified": entry['lastUpdated']
            }
        })
    
    return bundle


@fhir_router.get("/{resource_type}/{id}/_history/{version_id}")
async def read_version(
    resource_type: str,
    id: str,
    version_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Read a specific version of a resource.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    
    # Read specific version
    resource = await storage.read_resource(resource_type, id, version_id)
    
    if not resource:
        raise HTTPException(
            status_code=404,
            detail=f"Resource {resource_type}/{id}/_history/{version_id} not found"
        )
    
    # Build response
    response = JSONResponse(content=resource)
    response.headers["ETag"] = f'W/"{version_id}"'
    response.headers["Last-Modified"] = resource.get("meta", {}).get("lastUpdated", "")
    
    return response


@fhir_router.get("/Patient/{patient_id}/$everything")
async def patient_everything(
    patient_id: str,
    _since: Optional[str] = Query(None, description="Only include resources modified after this date"),
    _type: Optional[str] = Query(None, description="Comma-separated list of resource types to include"),
    _count: Optional[int] = Query(None, description="Maximum number of resources to return"),
    _offset: Optional[int] = Query(None, description="Number of resources to skip for pagination"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Patient/$everything operation - return all resources related to the patient.
    
    This operation returns a Bundle containing:
    - The Patient resource itself
    - All resources that reference the patient (Observations, Conditions, etc.)
    - Resources referenced by the patient
    
    Parameters:
    - _since: Only include resources modified after this date (ISO 8601)
    - _type: Comma-separated list of resource types to include
    - _count: Maximum number of resources to return (for pagination)
    - _offset: Number of resources to skip (for pagination)
    """
    try:
        storage = FHIRStorageEngine(db)
        validator = SyntheaFHIRValidator()
        operation_handler = OperationHandler(storage, validator)
        
        # Build parameters dict from query params
        parameters = {}
        if _since:
            parameters['_since'] = _since
        if _type:
            parameters['_type'] = _type
        if _count is not None:
            parameters['_count'] = _count
        if _offset is not None:
            parameters['_offset'] = _offset
        
        # Execute the operation
        result = await operation_handler.execute_operation(
            "everything",
            resource_type="Patient",
            resource_id=patient_id,
            parameters=parameters
        )
        
        return result
        
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving patient data: {str(e)}")


@fhir_router.post("/{resource_type}/${operation}")
async def type_operation(
    resource_type: str,
    operation: str,
    parameters: Optional[dict] = Body(None),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Execute a type-level operation.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    validator = SyntheaFHIRValidator()
    operation_handler = OperationHandler(storage, validator)
    
    try:
        result = await operation_handler.execute_operation(
            operation,
            resource_type=resource_type,
            parameters=parameters
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@fhir_router.post("/{resource_type}/{id}/${operation}")
async def instance_operation(
    resource_type: str,
    id: str,
    operation: str,
    parameters: Optional[dict] = Body(None),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Execute an instance-level operation.
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=404,
            detail=f"Resource type {resource_type} not supported"
        )
    
    storage = FHIRStorageEngine(db)
    validator = SyntheaFHIRValidator()
    operation_handler = OperationHandler(storage, validator)
    
    try:
        result = await operation_handler.execute_operation(
            operation,
            resource_type=resource_type,
            resource_id=id,
            parameters=parameters
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@fhir_router.post("/${operation}")
async def system_operation(
    operation: str,
    parameters: Optional[dict] = Body(None),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Execute a system-level operation.
    """
    storage = FHIRStorageEngine(db)
    validator = SyntheaFHIRValidator()
    operation_handler = OperationHandler(storage, validator)
    
    try:
        result = await operation_handler.execute_operation(
            operation,
            parameters=parameters
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions

def _get_search_params_for_resource(resource_type: str) -> List[Dict[str, str]]:
    """Get search parameters for a resource type."""
    # Base parameters for all resources
    common_params = [
        {
            "name": "_id",
            "type": "token",
            "documentation": "Logical id of this artifact"
        },
        {
            "name": "_lastUpdated",
            "type": "date",
            "documentation": "When the resource version last changed"
        }
    ]
    
    # Add resource-specific parameters
    if resource_type == "Patient":
        common_params.extend([
            {
                "name": "identifier",
                "type": "token",
                "documentation": "A patient identifier"
            },
            {
                "name": "name",
                "type": "string",
                "documentation": "A portion of either family or given name of the patient"
            },
            {
                "name": "family",
                "type": "string",
                "documentation": "A portion of the family name of the patient"
            },
            {
                "name": "given",
                "type": "string",
                "documentation": "A portion of the given name of the patient"
            },
            {
                "name": "birthdate",
                "type": "date",
                "documentation": "The patient's date of birth"
            },
            {
                "name": "gender",
                "type": "token",
                "documentation": "Gender of the patient"
            }
        ])
    elif resource_type == "Observation":
        common_params.extend([
            {
                "name": "code",
                "type": "token",
                "documentation": "The code of the observation type"
            },
            {
                "name": "date",
                "type": "date",
                "documentation": "Date/time of observation"
            },
            {
                "name": "patient",
                "type": "reference",
                "documentation": "The subject that the observation is about (if patient)"
            },
            {
                "name": "subject",
                "type": "reference",
                "documentation": "The subject that the observation is about"
            },
            {
                "name": "based-on",
                "type": "reference",
                "documentation": "Reference to the service request"
            },
            {
                "name": "code-value-quantity",
                "type": "composite",
                "documentation": "Code and quantity value composite search"
            },
            {
                "name": "component-code-value-quantity",
                "type": "composite",
                "documentation": "Component code and quantity value composite search"
            }
        ])
    elif resource_type == "MedicationDispense":
        common_params.extend([
            {
                "name": "identifier",
                "type": "token",
                "documentation": "Return dispenses with this external identifier"
            },
            {
                "name": "patient",
                "type": "reference",
                "documentation": "The identity of a patient to list dispenses for"
            },
            {
                "name": "status",
                "type": "token",
                "documentation": "Status of the dispense"
            },
            {
                "name": "lot-number",
                "type": "string",
                "documentation": "Returns dispenses with this lot number"
            },
            {
                "name": "expiration-date",
                "type": "date",
                "documentation": "Returns dispenses with a specific expiration date"
            }
        ])
    
    return common_params


async def _process_includes(storage: FHIRStorageEngine, bundle: Bundle, includes: List[str], base_url: str):
    """Process _include parameters."""
    included_resources = set()
    
    # Get search parameter definitions to validate reference types
    search_definitions = storage._get_search_parameter_definitions()
    
    for include in includes:
        parts = include.split(':')
        if len(parts) >= 2:
            source_type = parts[0]
            search_param = parts[1]
            target_type = parts[2] if len(parts) > 2 else None
            
            # Validate that the search parameter exists and is a reference type
            param_def = search_definitions.get(source_type, {}).get(search_param, {})
            if param_def.get('type') != 'reference':
                continue  # Skip non-reference parameters
            
            # Find references in the bundle entries
            for entry in bundle["entry"]:
                if entry.get("search", {}).get("mode") == "match":
                    resource = entry["resource"]
                    if resource.get("resourceType") == source_type:
                        # Extract reference values based on the search parameter
                        ref_values = _extract_reference_values(resource, search_param)
                        
                        
                        for ref_value in ref_values:
                            # Extract resource type and ID from reference
                            if ref_value.startswith('urn:uuid:'):
                                # Handle urn:uuid references
                                ref_id = ref_value.replace('urn:uuid:', '')
                                # Try to infer type from parameter name if not specified
                                ref_type = target_type or _infer_resource_type_from_param(search_param)
                                if not ref_type:
                                    continue
                            elif '/' in ref_value:
                                # Handle ResourceType/id format
                                ref_parts = ref_value.split('/', 1)
                                if len(ref_parts) == 2:
                                    ref_type, ref_id = ref_parts
                                else:
                                    continue
                            else:
                                continue
                            
                            # Check if target type matches (if specified)
                            if target_type and ref_type != target_type:
                                continue
                            
                            resource_key = f"{ref_type}/{ref_id}"
                            if resource_key not in included_resources:
                                # Fetch the referenced resource
                                try:
                                    included = await storage.read_resource(ref_type, ref_id)
                                    if included:
                                        bundle["entry"].append({
                                            "fullUrl": f"{base_url}/{ref_type}/{ref_id}",
                                            "resource": included,
                                            "search": {"mode": "include"}
                                        })
                                        included_resources.add(resource_key)
                                    else:
                                        import logging
                                        logging.warning(f"Could not fetch resource: {resource_key}")
                                except Exception as e:
                                    import logging
                                    logging.error(f"Error fetching resource {resource_key}: {e}")


def _extract_reference_values(resource: dict, search_param: str) -> List[str]:
    """
    Extract reference values from a resource based on the search parameter name.
    Returns a list of reference strings.
    """
    references = []
    
    # Map search parameters to FHIR paths
    # This mapping covers common patterns - can be extended as needed
    param_to_paths = {
        # Common patterns
        'patient': ['subject', 'patient'],
        'subject': ['subject'],
        'encounter': ['encounter', 'context'],
        'requester': ['requester'],
        'performer': ['performer', 'performer[*].actor'],
        'author': ['author'],
        'medication': ['medicationReference', 'medication'],
        'prescription': ['prescription', 'authorizingPrescription'],
        'location': ['location'],
        'organization': ['organization', 'managingOrganization'],
        'practitioner': ['practitioner', 'generalPractitioner'],
        'general-practitioner': ['generalPractitioner'],
        'based-on': ['basedOn'],
        'part-of': ['partOf'],
        'replaces': ['replaces'],
        'context': ['context', 'encounter'],
        'focus': ['focus'],
        'definition': ['definition'],
        'destination': ['destination'],
        'receiver': ['receiver'],
        'responsible': ['responsible'],
        'responsibleparty': ['responsibleParty']
    }
    
    # Get potential paths for this search parameter
    paths = param_to_paths.get(search_param, [search_param])
    
    for path in paths:
        if '[*]' in path:
            # Handle array notation
            base_path = path.split('[*]')[0]
            sub_path = path.split('[*].')[1] if '[*].' in path else None
            
            if base_path in resource and isinstance(resource[base_path], list):
                for item in resource[base_path]:
                    if sub_path and isinstance(item, dict) and sub_path in item:
                        ref_obj = item[sub_path]
                    elif isinstance(item, dict) and 'reference' in item:
                        ref_obj = item
                    else:
                        continue
                    
                    if isinstance(ref_obj, dict) and 'reference' in ref_obj:
                        references.append(ref_obj['reference'])
        else:
            # Direct path
            if path in resource:
                value = resource[path]
                if isinstance(value, dict) and 'reference' in value:
                    references.append(value['reference'])
                elif isinstance(value, list):
                    # Handle arrays of references
                    for item in value:
                        if isinstance(item, dict) and 'reference' in item:
                            references.append(item['reference'])
    
    return references


def _infer_resource_type_from_param(search_param: str) -> Optional[str]:
    """
    Infer the likely resource type from a search parameter name.
    Used for urn:uuid references where type isn't explicit.
    """
    param_to_type = {
        'patient': 'Patient',
        'subject': 'Patient',  # Usually Patient
        'encounter': 'Encounter',
        'practitioner': 'Practitioner',
        'organization': 'Organization',
        'location': 'Location',
        'medication': 'Medication',
        'requester': 'Practitioner',  # Often Practitioner
        'performer': 'Practitioner',  # Often Practitioner
        'author': 'Practitioner',  # Often Practitioner
        'prescription': 'MedicationRequest',
        'based-on': 'ServiceRequest',  # Often ServiceRequest
        'context': 'Encounter',  # Usually Encounter
        'general-practitioner': 'Practitioner'
    }
    
    return param_to_type.get(search_param)


async def _process_revincludes(storage: FHIRStorageEngine, bundle: Bundle, revincludes: List[str], base_url: str):
    """Process _revinclude parameters."""
    included_resources = set()
    
    # Get search parameter definitions to validate reference types
    search_definitions = storage._get_search_parameter_definitions()
    
    for revinclude in revincludes:
        parts = revinclude.split(':')
        if len(parts) >= 2:
            source_type = parts[0]
            search_param = parts[1]
            target_type = parts[2] if len(parts) > 2 else None
            
            # Validate that the search parameter exists and is a reference type
            param_def = search_definitions.get(source_type, {}).get(search_param, {})
            if param_def.get('type') != 'reference':
                continue  # Skip non-reference parameters
            
            # Find resources that reference the resources in our bundle
            for entry in bundle["entry"]:
                if entry.get("search", {}).get("mode") == "match":
                    resource = entry["resource"]
                    resource_type = resource.get('resourceType', '')
                    resource_id = resource.get('id', '')
                    
                    # Skip if target type specified and doesn't match
                    if target_type and resource_type != target_type:
                        continue
                    
                    resource_ref = f"{resource_type}/{resource_id}"
                    
                    # Build search parameters with proper reference format
                    # The parsed values expect dict format with 'type' and 'id'
                    search_params = {
                        search_param: {
                            'name': search_param,
                            'type': 'reference',
                            'modifier': None,
                            'values': [{
                                'type': resource_type,
                                'id': resource_id
                            }]
                        }
                    }
                    
                    # Search for resources that reference this one
                    try:
                        referring_resources, _ = await storage.search_resources(
                            source_type,
                            search_params,
                            offset=0,
                            limit=100
                        )
                        
                        for referring in referring_resources:
                            resource_key = f"{source_type}/{referring['id']}"
                            if resource_key not in included_resources:
                                bundle["entry"].append({
                                    "fullUrl": f"{base_url}/{source_type}/{referring['id']}",
                                    "resource": referring,
                                    "search": {"mode": "include"}
                                })
                                included_resources.add(resource_key)
                    except Exception as e:
                        # Log but don't fail the whole request
                        import logging
                        logging.warning(f"Failed to process _revinclude {revinclude}: {e}")


async def _process_has_parameters(target_resource_type: str, has_params: List[str], db: AsyncSession) -> Optional[Set[str]]:
    """
    Process _has parameters to find resources referenced by other resources
    
    Format: _has:ResourceType:reference:parameter=value
    Example: _has:Observation:patient:code=http://loinc.org|2339-0
    
    Returns set of resource IDs that match all _has criteria, or None if no _has filtering needed
    """
    if not has_params:
        return None
        
    storage = FHIRStorageEngine(db)
    all_matching_ids = None
    
    for has_param in has_params:
        # Parse _has parameter
        parts = has_param.split(':', 3)
        if len(parts) < 4:
            logger.warning(f"Invalid _has parameter format: {has_param}")
            continue
            
        _, ref_resource_type, ref_field, search_expr = parts
        
        # Parse the search expression (parameter=value)
        if '=' not in search_expr:
            logger.warning(f"Invalid _has search expression: {search_expr}")
            continue
            
        param_name, param_value = search_expr.split('=', 1)
        
        # Search for resources of ref_resource_type matching the search criteria
        search_params = {param_name: param_value}
        search_handler = SearchParameterHandler(storage._get_search_parameter_definitions())
        parsed_params, _ = search_handler.parse_search_params(ref_resource_type, search_params)
        
        # Use paginated search to handle large result sets
        matching_resources = await search_all_resources(
            storage,
            ref_resource_type,
            parsed_params
        )
        
        # Extract IDs of target resources referenced by matching resources
        matching_ids = set()
        for resource in matching_resources:
            # Look for references in the specified field
            ref_value = None
            
            # Handle different reference field patterns
            if ref_field in resource:
                ref_obj = resource[ref_field]
                if isinstance(ref_obj, dict) and 'reference' in ref_obj:
                    ref_value = ref_obj['reference']
                elif isinstance(ref_obj, str):
                    ref_value = ref_obj
            elif ref_field == 'patient' and 'subject' in resource:
                # Common pattern: patient parameter maps to subject field
                ref_obj = resource['subject']
                if isinstance(ref_obj, dict) and 'reference' in ref_obj:
                    ref_value = ref_obj['reference']
            
            if ref_value:
                # Extract resource type and ID from reference
                if ref_value.startswith('urn:uuid:'):
                    # Handle Synthea-style references
                    ref_id = ref_value.replace('urn:uuid:', '')
                    matching_ids.add(ref_id)
                else:
                    # Handle standard references
                    ref_parts = ref_value.split('/')
                    if len(ref_parts) == 2:
                        ref_type, ref_id = ref_parts
                        if ref_type == target_resource_type:
                            matching_ids.add(ref_id)
        
        # Intersect with previous results (AND logic)
        if all_matching_ids is None:
            all_matching_ids = matching_ids
        else:
            all_matching_ids = all_matching_ids.intersection(matching_ids)
            
        # Early exit if no matches
        if not all_matching_ids:
            return set()
    
    return all_matching_ids


def _apply_summary(resource: Dict[str, Any], summary: str) -> Dict[str, Any]:
    """Apply _summary parameter to resource using comprehensive field definitions."""
    return apply_summary_to_resource(resource, summary)


def _apply_elements(resource: Dict[str, Any], elements: List[str]) -> Dict[str, Any]:
    """Apply _elements parameter to resource using comprehensive implementation."""
    return apply_elements_to_resource(resource, elements)