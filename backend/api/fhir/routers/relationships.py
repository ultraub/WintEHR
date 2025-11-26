"""
FHIR Relationships API Router

Provides endpoints for discovering and analyzing relationships between FHIR resources.
Used by the FHIR Explorer RelationshipMapper component.

Architecture:
- Uses RelationshipCache service for all relationship operations
- RelationshipCache uses HAPIFHIRClient for FHIR API operations (no direct DB access)
- Results are cached with TTL for performance
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Optional, Any
import logging

from api.services.fhir.relationship_cache import (
    get_relationship_cache,
    RelationshipCache,
)
from shared.exceptions import FHIRConnectionError, FHIRResourceNotFoundError

logger = logging.getLogger(__name__)

relationships_router = APIRouter(
    prefix="/fhir-relationships",
    tags=["fhir-relationships"]
)


# FHIR reference field mappings by resource type
# Comprehensive schema for the /schema endpoint
REFERENCE_FIELDS = {
    "Patient": {
        "generalPractitioner": {"target": ["Practitioner", "Organization", "PractitionerRole"], "type": "many-to-many"},
        "managingOrganization": {"target": ["Organization"], "type": "many-to-one"}
    },
    "Observation": {
        "subject": {"target": ["Patient", "Group", "Device", "Location"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "performer": {"target": ["Practitioner", "PractitionerRole", "Organization", "CareTeam", "Patient", "RelatedPerson"], "type": "many-to-many"},
        "basedOn": {"target": ["CarePlan", "DeviceRequest", "ImmunizationRecommendation", "MedicationRequest", "NutritionOrder", "ServiceRequest"], "type": "many-to-many"},
        "partOf": {"target": ["MedicationAdministration", "MedicationDispense", "MedicationStatement", "Procedure", "Immunization", "ImagingStudy"], "type": "many-to-many"},
        "specimen": {"target": ["Specimen"], "type": "many-to-one"},
        "device": {"target": ["Device", "DeviceMetric"], "type": "many-to-one"}
    },
    "Condition": {
        "subject": {"target": ["Patient", "Group"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "recorder": {"target": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "type": "many-to-one"},
        "asserter": {"target": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "type": "many-to-one"},
        "evidence": {"target": ["Observation", "DocumentReference", "DiagnosticReport"], "type": "one-to-many"}
    },
    "MedicationRequest": {
        "subject": {"target": ["Patient", "Group"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "requester": {"target": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"], "type": "many-to-one"},
        "performer": {"target": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device", "CareTeam"], "type": "many-to-one"},
        "medication": {"target": ["Medication"], "type": "many-to-one"},
        "reasonReference": {"target": ["Condition", "Observation"], "type": "many-to-many"},
        "basedOn": {"target": ["CarePlan", "MedicationRequest", "ServiceRequest", "ImmunizationRecommendation"], "type": "many-to-many"},
        "priorPrescription": {"target": ["MedicationRequest"], "type": "many-to-one"}
    },
    "Encounter": {
        "subject": {"target": ["Patient", "Group"], "type": "many-to-one"},
        "participant": {"target": ["Practitioner", "PractitionerRole", "RelatedPerson"], "type": "one-to-many"},
        "appointment": {"target": ["Appointment"], "type": "many-to-many"},
        "reasonReference": {"target": ["Condition", "Procedure", "Observation", "ImmunizationRecommendation"], "type": "many-to-many"},
        "diagnosis": {"target": ["Condition", "Procedure"], "type": "one-to-many"},
        "hospitalization": {"target": ["Location", "Organization"], "type": "many-to-one"},
        "serviceProvider": {"target": ["Organization"], "type": "many-to-one"},
        "partOf": {"target": ["Encounter"], "type": "many-to-one"}
    },
    "Procedure": {
        "subject": {"target": ["Patient", "Group"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "performer": {"target": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"], "type": "one-to-many"},
        "location": {"target": ["Location"], "type": "many-to-one"},
        "reasonReference": {"target": ["Condition", "Observation", "Procedure", "DiagnosticReport", "DocumentReference"], "type": "many-to-many"},
        "basedOn": {"target": ["CarePlan", "ServiceRequest"], "type": "many-to-many"},
        "partOf": {"target": ["Procedure", "Observation", "MedicationAdministration"], "type": "many-to-many"}
    },
    "DiagnosticReport": {
        "subject": {"target": ["Patient", "Group", "Device", "Location"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "basedOn": {"target": ["CarePlan", "ImmunizationRecommendation", "MedicationRequest", "NutritionOrder", "ServiceRequest"], "type": "many-to-many"},
        "performer": {"target": ["Practitioner", "PractitionerRole", "Organization", "CareTeam"], "type": "many-to-many"},
        "resultsInterpreter": {"target": ["Practitioner", "PractitionerRole", "Organization", "CareTeam"], "type": "many-to-many"},
        "specimen": {"target": ["Specimen"], "type": "many-to-many"},
        "result": {"target": ["Observation"], "type": "one-to-many"},
        "imagingStudy": {"target": ["ImagingStudy"], "type": "many-to-many"},
        "media": {"target": ["Media"], "type": "one-to-many"}
    },
    "AllergyIntolerance": {
        "patient": {"target": ["Patient"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "recorder": {"target": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "type": "many-to-one"},
        "asserter": {"target": ["Patient", "RelatedPerson", "Practitioner", "PractitionerRole"], "type": "many-to-one"}
    },
    "Immunization": {
        "patient": {"target": ["Patient"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "location": {"target": ["Location"], "type": "many-to-one"},
        "manufacturer": {"target": ["Organization"], "type": "many-to-one"},
        "performer": {"target": ["Practitioner", "PractitionerRole", "Organization"], "type": "one-to-many"},
        "reasonReference": {"target": ["Condition", "Observation", "DiagnosticReport"], "type": "many-to-many"}
    },
    "ServiceRequest": {
        "subject": {"target": ["Patient", "Group", "Location", "Device"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "requester": {"target": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"], "type": "many-to-one"},
        "performer": {"target": ["Practitioner", "PractitionerRole", "Organization", "CareTeam", "HealthcareService", "Patient", "Device", "RelatedPerson"], "type": "many-to-many"},
        "locationReference": {"target": ["Location"], "type": "many-to-many"},
        "reasonReference": {"target": ["Condition", "Observation", "DiagnosticReport", "DocumentReference"], "type": "many-to-many"},
        "insurance": {"target": ["Coverage", "ClaimResponse"], "type": "many-to-many"},
        "supportingInfo": {"target": ["Any"], "type": "many-to-many"},
        "specimen": {"target": ["Specimen"], "type": "many-to-many"}
    },
    "CarePlan": {
        "subject": {"target": ["Patient", "Group"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "author": {"target": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson", "Organization", "CareTeam", "Device"], "type": "many-to-one"},
        "careTeam": {"target": ["CareTeam"], "type": "many-to-many"},
        "addresses": {"target": ["Condition"], "type": "many-to-many"},
        "supportingInfo": {"target": ["Any"], "type": "many-to-many"},
        "goal": {"target": ["Goal"], "type": "many-to-many"},
        "basedOn": {"target": ["CarePlan"], "type": "many-to-many"},
        "replaces": {"target": ["CarePlan"], "type": "many-to-many"},
        "partOf": {"target": ["CarePlan"], "type": "many-to-many"}
    },
    "CareTeam": {
        "subject": {"target": ["Patient", "Group"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "managingOrganization": {"target": ["Organization"], "type": "many-to-many"},
        "participant": {"target": ["Practitioner", "PractitionerRole", "RelatedPerson", "Patient", "Organization", "CareTeam"], "type": "one-to-many"}
    },
    "Claim": {
        "patient": {"target": ["Patient"], "type": "many-to-one"},
        "enterer": {"target": ["Practitioner", "PractitionerRole"], "type": "many-to-one"},
        "insurer": {"target": ["Organization"], "type": "many-to-one"},
        "provider": {"target": ["Practitioner", "PractitionerRole", "Organization"], "type": "many-to-one"},
        "priority": {"target": ["CodeableConcept"], "type": "many-to-one"},
        "prescription": {"target": ["MedicationRequest", "VisionPrescription"], "type": "many-to-one"},
        "originalPrescription": {"target": ["MedicationRequest"], "type": "many-to-one"},
        "payee": {"target": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson"], "type": "many-to-one"},
        "referral": {"target": ["ServiceRequest"], "type": "many-to-one"},
        "facility": {"target": ["Location"], "type": "many-to-one"},
        "careTeam": {"target": ["Practitioner", "PractitionerRole", "Organization"], "type": "one-to-many"},
        "procedure": {"target": ["Procedure"], "type": "one-to-many"}
    },
    "Practitioner": {
        "qualification": {"target": ["Organization"], "type": "one-to-many"}
    },
    "PractitionerRole": {
        "practitioner": {"target": ["Practitioner"], "type": "many-to-one"},
        "organization": {"target": ["Organization"], "type": "many-to-one"},
        "location": {"target": ["Location"], "type": "many-to-many"},
        "healthcareService": {"target": ["HealthcareService"], "type": "many-to-many"},
        "endpoint": {"target": ["Endpoint"], "type": "many-to-many"}
    },
    "Organization": {
        "partOf": {"target": ["Organization"], "type": "many-to-one"},
        "endpoint": {"target": ["Endpoint"], "type": "many-to-many"}
    },
    "Location": {
        "managingOrganization": {"target": ["Organization"], "type": "many-to-one"},
        "partOf": {"target": ["Location"], "type": "many-to-one"},
        "endpoint": {"target": ["Endpoint"], "type": "many-to-many"}
    },
    "Device": {
        "location": {"target": ["Location"], "type": "many-to-one"},
        "patient": {"target": ["Patient"], "type": "many-to-one"},
        "owner": {"target": ["Organization"], "type": "many-to-one"},
        "parent": {"target": ["Device"], "type": "many-to-one"}
    },
    "ExplanationOfBenefit": {
        "patient": {"target": ["Patient"], "type": "many-to-one"},
        "enterer": {"target": ["Practitioner", "PractitionerRole"], "type": "many-to-one"},
        "insurer": {"target": ["Organization"], "type": "many-to-one"},
        "provider": {"target": ["Practitioner", "PractitionerRole", "Organization"], "type": "many-to-one"},
        "prescription": {"target": ["MedicationRequest", "VisionPrescription"], "type": "many-to-one"},
        "originalPrescription": {"target": ["MedicationRequest"], "type": "many-to-one"},
        "payee": {"target": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson"], "type": "many-to-one"},
        "referral": {"target": ["ServiceRequest"], "type": "many-to-one"},
        "facility": {"target": ["Location"], "type": "many-to-one"},
        "claim": {"target": ["Claim"], "type": "many-to-one"},
        "claimResponse": {"target": ["ClaimResponse"], "type": "many-to-one"}
    },
    "MedicationAdministration": {
        "subject": {"target": ["Patient", "Group"], "type": "many-to-one"},
        "context": {"target": ["Encounter", "EpisodeOfCare"], "type": "many-to-one"},
        "supportingInformation": {"target": ["Any"], "type": "many-to-many"},
        "performer": {"target": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson", "Device"], "type": "one-to-many"},
        "reasonReference": {"target": ["Condition", "Observation", "DiagnosticReport"], "type": "many-to-many"},
        "request": {"target": ["MedicationRequest"], "type": "many-to-one"},
        "device": {"target": ["Device"], "type": "many-to-many"},
        "eventHistory": {"target": ["Provenance"], "type": "many-to-many"}
    },
    "Medication": {
        "manufacturer": {"target": ["Organization"], "type": "many-to-one"},
        "ingredient": {"target": ["Medication", "Substance"], "type": "one-to-many"}
    },
    "DocumentReference": {
        "subject": {"target": ["Patient", "Practitioner", "Group", "Device"], "type": "many-to-one"},
        "author": {"target": ["Practitioner", "PractitionerRole", "Organization", "Device", "Patient", "RelatedPerson"], "type": "many-to-many"},
        "authenticator": {"target": ["Practitioner", "PractitionerRole", "Organization"], "type": "many-to-one"},
        "custodian": {"target": ["Organization"], "type": "many-to-one"},
        "relatesTo": {"target": ["DocumentReference"], "type": "many-to-many"},
        "context": {"target": ["Encounter", "EpisodeOfCare"], "type": "many-to-many"}
    },
    "ImagingStudy": {
        "subject": {"target": ["Patient", "Device", "Group"], "type": "many-to-one"},
        "encounter": {"target": ["Encounter"], "type": "many-to-one"},
        "basedOn": {"target": ["CarePlan", "ServiceRequest", "Appointment", "AppointmentResponse", "Task"], "type": "many-to-many"},
        "referrer": {"target": ["Practitioner", "PractitionerRole"], "type": "many-to-one"},
        "interpreter": {"target": ["Practitioner", "PractitionerRole"], "type": "many-to-many"},
        "endpoint": {"target": ["Endpoint"], "type": "many-to-many"},
        "procedureReference": {"target": ["Procedure"], "type": "many-to-one"},
        "location": {"target": ["Location"], "type": "many-to-one"},
        "reasonReference": {"target": ["Condition", "Observation", "DiagnosticReport", "DocumentReference"], "type": "many-to-many"}
    },
    "Provenance": {
        "target": {"target": ["Any"], "type": "many-to-many"},
        "location": {"target": ["Location"], "type": "many-to-one"},
        "agent": {"target": ["Practitioner", "PractitionerRole", "RelatedPerson", "Patient", "Device", "Organization"], "type": "one-to-many"},
        "entity": {"target": ["Any"], "type": "one-to-many"}
    },
    "SupplyDelivery": {
        "basedOn": {"target": ["SupplyRequest"], "type": "many-to-many"},
        "partOf": {"target": ["SupplyDelivery", "Contract"], "type": "many-to-many"},
        "patient": {"target": ["Patient"], "type": "many-to-one"},
        "supplier": {"target": ["Practitioner", "PractitionerRole", "Organization"], "type": "many-to-one"},
        "destination": {"target": ["Location"], "type": "many-to-one"},
        "receiver": {"target": ["Practitioner", "PractitionerRole"], "type": "many-to-many"}
    }
}


def get_cache() -> RelationshipCache:
    """Get the relationship cache service instance."""
    return get_relationship_cache()


@relationships_router.get("/schema")
async def get_relationship_schema():
    """
    Get the complete FHIR relationship schema.

    Returns all possible relationships between resource types.
    Uses the comprehensive schema defined in this router.
    """
    return {
        "resourceTypes": list(REFERENCE_FIELDS.keys()),
        "relationships": REFERENCE_FIELDS,
        "totalResourceTypes": len(REFERENCE_FIELDS)
    }


@relationships_router.get("/discover/{resource_type}/{resource_id}")
async def discover_relationships(
    resource_type: str,
    resource_id: str,
    depth: int = Query(1, ge=1, le=3, description="How many hops to traverse"),
    include_counts: bool = Query(True, description="Include relationship counts"),
    cache: RelationshipCache = Depends(get_cache)
):
    """
    Discover actual relationships for a specific resource instance.

    Returns connected resources with relationship metadata.
    Uses FHIR API operations through RelationshipCache service.

    Args:
        resource_type: FHIR resource type (e.g., "Patient", "Observation")
        resource_id: Resource identifier
        depth: How many relationship hops to traverse (1-3)
        include_counts: Include relationship counts in results

    Returns:
        Dict with source resource, nodes, links, and relationships
    """
    try:
        result = await cache.discover_relationships(
            resource_type=resource_type,
            resource_id=resource_id,
            depth=depth,
            include_counts=include_counts
        )
        return result

    except FHIRResourceNotFoundError:
        logger.warning(f"Resource not found: {resource_type}/{resource_id}")
        raise HTTPException(
            status_code=404,
            detail=f"{resource_type}/{resource_id} not found"
        )
    except FHIRConnectionError as e:
        logger.error(f"FHIR connection error discovering relationships: {e}")
        raise HTTPException(
            status_code=503,
            detail="FHIR server unavailable"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error discovering relationships: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@relationships_router.get("/statistics")
async def get_relationship_statistics(
    resource_type: Optional[str] = None,
    cache: RelationshipCache = Depends(get_cache)
):
    """
    Get statistical information about relationships.

    Uses FHIR API searches to count resources and analyze connectivity.
    Useful for understanding data patterns and resource distribution.

    Args:
        resource_type: Optional - filter statistics to specific resource type

    Returns:
        Dict with totalResources, resourceTypeCounts, and mostConnectedTypes
    """
    try:
        stats = await cache.get_relationship_statistics(resource_type=resource_type)
        return stats

    except FHIRConnectionError as e:
        logger.error(f"FHIR connection error getting statistics: {e}")
        raise HTTPException(
            status_code=503,
            detail="FHIR server unavailable"
        )
    except Exception as e:
        logger.error(f"Error getting relationship statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@relationships_router.get("/paths")
async def find_relationship_paths(
    source_type: str,
    source_id: str,
    target_type: str,
    target_id: str,
    max_depth: int = Query(3, ge=1, le=5),
    cache: RelationshipCache = Depends(get_cache)
):
    """
    Find all paths between two resources.

    Uses breadth-first search through FHIR references to discover
    how resources are connected. Useful for understanding relationships.

    Args:
        source_type: Source resource type
        source_id: Source resource identifier
        target_type: Target resource type
        target_id: Target resource identifier
        max_depth: Maximum path length to search (1-5)

    Returns:
        Dict with source, target, paths list, and pathCount
    """
    try:
        result = await cache.find_relationship_paths(
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
            max_depth=max_depth
        )
        return result

    except FHIRResourceNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Source or target resource not found"
        )
    except FHIRConnectionError as e:
        logger.error(f"FHIR connection error finding paths: {e}")
        raise HTTPException(
            status_code=503,
            detail="FHIR server unavailable"
        )
    except Exception as e:
        logger.error(f"Error finding relationship paths: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@relationships_router.post("/cache/invalidate")
async def invalidate_relationship_cache(
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    cache: RelationshipCache = Depends(get_cache)
):
    """
    Invalidate cached relationship data.

    Use this endpoint when data has changed and cached relationships
    need to be refreshed.

    Args:
        resource_type: Optional - invalidate all cache for this resource type
        resource_id: Optional - if resource_type also given, invalidate specific resource

    Returns:
        Confirmation message
    """
    cache.invalidate_cache(resource_type=resource_type, resource_id=resource_id)

    if resource_type and resource_id:
        return {"message": f"Cache invalidated for {resource_type}/{resource_id}"}
    elif resource_type:
        return {"message": f"Cache invalidated for all {resource_type} resources"}
    else:
        return {"message": "All relationship cache cleared"}
