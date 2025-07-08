"""
FHIR R4 API Router

Implements the complete FHIR R4 REST API specification.
Handles all resource types, search operations, and custom operations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, Body
from fastapi.responses import JSONResponse, Response as FastAPIResponse
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
from sqlalchemy.ext.asyncio import AsyncSession

from core.fhir.storage import FHIRStorageEngine, ConditionalCreateExistingResource
from core.fhir.synthea_validator import SyntheaFHIRValidator
from core.fhir.operations import OperationHandler
from core.fhir.search import SearchParameterHandler
from database import get_db_session
from fhir.resources import construct_fhir_element
from fhir.resources.bundle import Bundle
from fhir.resources.parameters import Parameters
from fhir.resources.capabilitystatement import (
    CapabilityStatement,
    CapabilityStatementRest,
    CapabilityStatementRestResource,
    CapabilityStatementRestResourceInteraction,
    CapabilityStatementRestResourceSearchParam
)
import logging


# Create main FHIR router
fhir_router = APIRouter(prefix="/fhir/R4", tags=["FHIR"])

# Supported resource types
SUPPORTED_RESOURCES = [
    "Patient", "Practitioner", "Organization", "Location",
    "Encounter", "Appointment", "Observation", "Condition",
    "Procedure", "Medication", "MedicationRequest", "MedicationStatement",
    "DiagnosticReport", "ImagingStudy", "CarePlan", "Goal",
    "Immunization", "AllergyIntolerance", "DocumentReference",
    "Task", "ServiceRequest", "Specimen", "Device",
    "Questionnaire", "QuestionnaireResponse", "ValueSet",
    "CodeSystem", "ConceptMap", "StructureDefinition",
    # Additional resources from Synthea
    "PractitionerRole", "CareTeam", "Claim", "Coverage",
    "ExplanationOfBenefit", "MedicationAdministration",
    "Composition", "Media", "SupplyDelivery", "Schedule",
    "Slot", "Communication", "CommunicationRequest",
    # Recently identified missing resources
    "Provenance"
]


@fhir_router.get("/metadata")
async def get_capability_statement():
    """
    Get server capability statement.
    
    Returns the server's CapabilityStatement resource describing
    what operations and resources are supported.
    """
    capability_statement = CapabilityStatement(
        status="active",
        date=datetime.now().isoformat(),
        kind="instance",
        fhirVersion="4.0.1",
        format=["application/fhir+json", "application/json"],
        implementation={
            "description": "MedGenEMR FHIR R4 Server",
            "url": "http://localhost:8000/fhir/R4"
        },
        rest=[
            CapabilityStatementRest(
                mode="server",
                resource=[
                    CapabilityStatementRestResource(
                        type=resource_type,
                        interaction=[
                            CapabilityStatementRestResourceInteraction(code="read"),
                            CapabilityStatementRestResourceInteraction(code="vread"),
                            CapabilityStatementRestResourceInteraction(code="update"),
                            CapabilityStatementRestResourceInteraction(code="delete"),
                            CapabilityStatementRestResourceInteraction(code="history-instance"),
                            CapabilityStatementRestResourceInteraction(code="history-type"),
                            CapabilityStatementRestResourceInteraction(code="create"),
                            CapabilityStatementRestResourceInteraction(code="search-type")
                        ],
                        versioning="versioned",
                        readHistory=True,
                        updateCreate=True,
                        conditionalCreate=True,
                        conditionalRead="full-support",
                        conditionalUpdate=True,
                        conditionalDelete="single",
                        searchParam=_get_search_params_for_resource(resource_type)
                    )
                    for resource_type in SUPPORTED_RESOURCES
                ],
                interaction=[
                    {"code": "transaction"},
                    {"code": "batch"},
                    {"code": "search-system"},
                    {"code": "history-system"}
                ],
                searchParam=[
                    CapabilityStatementRestResourceSearchParam(
                        name="_id",
                        type="token",
                        documentation="Resource ID"
                    ),
                    CapabilityStatementRestResourceSearchParam(
                        name="_lastUpdated",
                        type="date",
                        documentation="Last updated date"
                    )
                ]
            )
        ]
    )
    
    # Convert to dict for JSON response
    return capability_statement.dict()


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
        bundle = Bundle(**bundle_data)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Bundle resource: {str(e)}"
        )
    
    if bundle.type not in ["batch", "transaction"]:
        raise HTTPException(
            status_code=400,
            detail="Only batch and transaction bundles are supported"
        )
    
    try:
        response_bundle = await storage.process_bundle(bundle)
        logging.debug(f"DEBUG: Response bundle type: {type(response_bundle)}")
        if response_bundle is None:
            logging.error("ERROR: Response bundle is None!")
            raise HTTPException(status_code=500, detail="Bundle processing returned None")
        return response_bundle.dict()
    except Exception as e:
        import traceback
        logging.error(f"ERROR in process_bundle: {e}")
        logging.info(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


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
        except:
            raise HTTPException(status_code=400, detail="Invalid _since parameter format")
    
    if _at:
        try:
            at = datetime.fromisoformat(_at.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=400, detail="Invalid _at parameter format")
    
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
    bundle = Bundle(
        type="history",
        total=total,
        entry=[]
    )
    
    # Add navigation links
    base_url = str(request.url).split('?')[0]
    params_dict = dict(request.query_params)
    
    bundle.link = [
        {"relation": "self", "url": str(request.url)}
    ]
    
    if page > 1:
        prev_params = params_dict.copy()
        prev_params['_page'] = str(page - 1)
        prev_url = f"{base_url}?" + "&".join(f"{k}={v}" for k, v in prev_params.items())
        bundle.link.append({"relation": "previous", "url": prev_url})
    
    if offset + count < total:
        next_params = params_dict.copy()
        next_params['_page'] = str(page + 1)
        next_url = f"{base_url}?" + "&".join(f"{k}={v}" for k, v in next_params.items())
        bundle.link.append({"relation": "next", "url": next_url})
    
    for entry in history:
        bundle.entry.append({
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
    
    return bundle.dict()


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
    _page: Optional[int] = Query(None, alias="_page")
):
    """
    Search for resources.
    
    Implements FHIR search with all parameters and modifiers.
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
    
    # Calculate pagination
    count = _count or 10
    page = _page or 1
    offset = (page - 1) * count
    
    # Execute search
    resources, total = await storage.search_resources(
        resource_type,
        search_params,
        offset=offset,
        limit=count
    )
    
    # Build search bundle
    bundle = Bundle(
        type="searchset",
        total=total,
        entry=[]
    )
    
    # Add navigation links
    base_url = str(request.url).split('?')[0]
    params_str = str(request.url.query)
    
    bundle.link = [
        {"relation": "self", "url": str(request.url)}
    ]
    
    if page > 1:
        prev_page = page - 1
        prev_url = f"{base_url}?{params_str.replace(f'_page={page}', f'_page={prev_page}')}"
        bundle.link.append({"relation": "previous", "url": prev_url})
    
    if offset + count < total:
        next_page = page + 1
        next_url = f"{base_url}?{params_str.replace(f'_page={page}', f'_page={next_page}')}"
        bundle.link.append({"relation": "next", "url": next_url})
    
    # Add resources to bundle
    for resource_data in resources:
        entry = {
            "fullUrl": f"{base_url}/{resource_data['id']}",
            "resource": resource_data,
            "search": {"mode": "match"}
        }
        bundle.entry.append(entry)
    
    # Handle _include and _revinclude
    if "_include" in result_params:
        await _process_includes(storage, bundle, result_params["_include"])
    
    if "_revinclude" in result_params:
        await _process_revincludes(storage, bundle, result_params["_revinclude"])
    
    return bundle.dict()


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
        
        # Build response for newly created resource
        response = Response(status_code=201)
        response.headers["Location"] = f"{resource_type}/{fhir_id}"
        response.headers["ETag"] = f'W/"{version_id}"'
        if isinstance(last_updated, datetime):
            response.headers["Last-Modified"] = last_updated.strftime("%a, %d %b %Y %H:%M:%S GMT")
        else:
            response.headers["Last-Modified"] = last_updated
        
        return response
        
    except ConditionalCreateExistingResource as e:
        # Conditional create found existing resource - return 200 OK
        response = Response(status_code=200)
        response.headers["Location"] = f"{resource_type}/{e.fhir_id}"
        response.headers["ETag"] = f'W/"{e.version_id}"'
        if isinstance(e.last_updated, datetime):
            response.headers["Last-Modified"] = e.last_updated.strftime("%a, %d %b %Y %H:%M:%S GMT")
        else:
            response.headers["Last-Modified"] = str(e.last_updated)
        
        return response
        
    except TypeError as e:
        # This is likely the "an integer is required (got type str)" error
        import traceback
        logging.error(f"TypeError in create_resource: {e}")
        logging.info(f"Resource type: {resource_type}")
        logging.info(f"Traceback: {traceback.format_exc()}")
        # Try to identify which field is causing the issue
        if resource_type == "Observation" and "component" in resource_data:
            logging.debug("DEBUG: Checking component structure...")
            for i, comp in enumerate(resource_data.get("component", [])):
                if "valueQuantity" in comp:
                    vq = comp["valueQuantity"]
                    logging.info(f"  Component {i} valueQuantity.value: {vq.get('value')} (type: {type(vq.get('value'))})")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        import traceback
        logging.error(f"Error in create_resource: {e}")
        logging.info(f"Resource type: {resource_type}")
        logging.info(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


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
        except:
            raise HTTPException(status_code=400, detail="Invalid _since parameter format")
    
    if _at:
        try:
            at = datetime.fromisoformat(_at.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=400, detail="Invalid _at parameter format")
    
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
    bundle = Bundle(
        type="history",
        total=total,
        entry=[]
    )
    
    # Add navigation links
    base_url = str(request.url).split('?')[0]
    params_dict = dict(request.query_params)
    
    bundle.link = [
        {"relation": "self", "url": str(request.url)}
    ]
    
    if page > 1:
        prev_params = params_dict.copy()
        prev_params['_page'] = str(page - 1)
        prev_url = f"{base_url}?" + "&".join(f"{k}={v}" for k, v in prev_params.items())
        bundle.link.append({"relation": "previous", "url": prev_url})
    
    if offset + count < total:
        next_params = params_dict.copy()
        next_params['_page'] = str(page + 1)
        next_url = f"{base_url}?" + "&".join(f"{k}={v}" for k, v in next_params.items())
        bundle.link.append({"relation": "next", "url": next_url})
    
    # Check if resource exists
    if not history:
        # Check if resource exists at all
        current = await storage.read_resource(resource_type, id)
        if not current:
            raise HTTPException(
                status_code=404,
                detail=f"Resource {resource_type}/{id} not found"
            )
    
    for entry in history:
        bundle.entry.append({
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
    
    return bundle.dict()


@fhir_router.get("/Patient/{patient_id}/$everything")
async def patient_everything(
    patient_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Patient/$everything operation - return all resources related to the patient.
    
    This operation returns a Bundle containing:
    - The Patient resource itself
    - All resources that reference the patient (Observations, Conditions, etc.)
    - Resources referenced by the patient
    """
    try:
        storage = FHIRStorageEngine(db)
        
        # Get the patient resource
        patient_resource = await storage.read_resource("Patient", patient_id)
        if not patient_resource:
            raise HTTPException(status_code=404, detail=f"Patient/{patient_id} not found")
        
        # Create bundle entries
        bundle_entries = []
        
        # Add the patient resource itself
        bundle_entries.append({
            "fullUrl": f"Patient/{patient_id}",
            "resource": patient_resource
        })
        
        # Get all resources that reference this patient
        patient_reference = f"Patient/{patient_id}"
        
        # Search for related resources using direct database queries
        for resource_type in ["Observation", "Condition", "MedicationRequest", "Encounter", 
                             "AllergyIntolerance", "Immunization", "Procedure", "CarePlan",
                             "DiagnosticReport", "ImagingStudy", "DocumentReference"]:
            try:
                # Direct database query for resources that reference this patient
                from sqlalchemy import text
                
                query = text("""
                    SELECT resource 
                    FROM fhir.resources 
                    WHERE resource_type = :resource_type 
                    AND (
                        resource->'subject'->>'reference' = :patient_ref OR
                        resource->'patient'->>'reference' = :patient_ref OR
                        resource->'subject'->>'reference' = :patient_ref_urn
                    )
                    AND deleted = false
                    LIMIT 100
                """)
                
                # Also check for urn:uuid: references (from Synthea)
                patient_ref_urn = f"urn:uuid:{patient_id}"
                
                result = await db.execute(query, {
                    "resource_type": resource_type,
                    "patient_ref": patient_reference,
                    "patient_ref_urn": patient_ref_urn
                })
                
                count = 0
                for row in result:
                    resource_data = row[0]  # The JSONB resource data
                    resource_id = resource_data.get('id', 'unknown')
                    bundle_entries.append({
                        "fullUrl": f"{resource_type}/{resource_id}",
                        "resource": resource_data
                    })
                    count += 1
                
                if count > 0:
                    logging.info(f"Found {count} {resource_type} resources for patient {patient_id}")
            except Exception as e:
                # Log the exception but continue
                import traceback
                logging.error(f"Error searching {resource_type}: {e}")
                logging.info(traceback.format_exc())
                pass
        
        # Create the bundle
        bundle = {
            "resourceType": "Bundle",
            "id": f"patient-everything-{patient_id}",
            "type": "searchset",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "total": len(bundle_entries),
            "entry": bundle_entries
        }
        
        return bundle
        
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving patient data: {str(e)}")


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
        
        # Build response
        response = Response(status_code=200)
        response.headers["ETag"] = f'W/"{version_id}"'
        response.headers["Last-Modified"] = last_updated.strftime("%a, %d %b %Y %H:%M:%S GMT")
        
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
    
    return Response(status_code=204)


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


@fhir_router.post("/{resource_type}/${operation}")
async def type_operation(
    resource_type: str,
    operation: str,
    parameters: Optional[Parameters] = Body(None),
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
    parameters: Optional[Parameters] = Body(None),
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
    parameters: Optional[Parameters] = Body(None),
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


def _get_search_params_for_resource(resource_type: str) -> List[CapabilityStatementRestResourceSearchParam]:
    """Get search parameters for a resource type."""
    # This is a simplified version - would be populated from SearchParameter resources
    common_params = [
        CapabilityStatementRestResourceSearchParam(
            name="_id",
            type="token",
            documentation="Logical id of this artifact"
        ),
        CapabilityStatementRestResourceSearchParam(
            name="_lastUpdated",
            type="date",
            documentation="When the resource version last changed"
        )
    ]
    
    # Add resource-specific parameters
    if resource_type == "Patient":
        common_params.extend([
            CapabilityStatementRestResourceSearchParam(
                name="identifier",
                type="token",
                documentation="A patient identifier"
            ),
            CapabilityStatementRestResourceSearchParam(
                name="name",
                type="string",
                documentation="A portion of either family or given name of the patient"
            ),
            CapabilityStatementRestResourceSearchParam(
                name="family",
                type="string",
                documentation="A portion of the family name of the patient"
            ),
            CapabilityStatementRestResourceSearchParam(
                name="given",
                type="string",
                documentation="A portion of the given name of the patient"
            ),
            CapabilityStatementRestResourceSearchParam(
                name="birthdate",
                type="date",
                documentation="The patient's date of birth"
            ),
            CapabilityStatementRestResourceSearchParam(
                name="gender",
                type="token",
                documentation="Gender of the patient"
            )
        ])
    
    return common_params


async def _process_includes(storage: FHIRStorageEngine, bundle: Bundle, includes: List[str]):
    """Process _include parameters."""
    # This is a simplified implementation
    # Would need to parse include parameters and fetch referenced resources
    pass


async def _process_revincludes(storage: FHIRStorageEngine, bundle: Bundle, revincludes: List[str]):
    """Process _revinclude parameters."""
    # This is a simplified implementation
    # Would need to parse revinclude parameters and fetch referring resources
    pass


def _apply_summary(resource: Dict[str, Any], summary: str) -> Dict[str, Any]:
    """Apply _summary parameter to resource."""
    if summary == "true":
        # Return summary elements only
        summary_elements = ["id", "meta", "implicitRules"]
        return {k: v for k, v in resource.items() if k in summary_elements}
    elif summary == "text":
        # Return text, id, and meta only
        text_elements = ["id", "meta", "implicitRules", "text"]
        return {k: v for k, v in resource.items() if k in text_elements}
    elif summary == "data":
        # Remove text element
        return {k: v for k, v in resource.items() if k != "text"}
    elif summary == "count":
        # Return count only (handled at bundle level)
        return resource
    else:
        return resource


def _apply_elements(resource: Dict[str, Any], elements: List[str]) -> Dict[str, Any]:
    """Apply _elements parameter to resource."""
    # Always include mandatory elements
    result = {
        "resourceType": resource.get("resourceType"),
        "id": resource.get("id"),
        "meta": resource.get("meta")
    }
    
    # Add requested elements
    for element in elements:
        if "." in element:
            # Handle nested elements
            parts = element.split(".")
            current = resource
            for part in parts[:-1]:
                if part in current:
                    current = current[part]
                else:
                    break
            if parts[-1] in current:
                # Reconstruct nested structure
                # This is simplified - would need proper path handling
                result[parts[0]] = resource.get(parts[0])
        else:
            # Simple element
            if element in resource:
                result[element] = resource[element]
    
    return result