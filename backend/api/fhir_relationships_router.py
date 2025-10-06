"""
FHIR Relationships API Router

Provides endpoints for discovering and analyzing relationships between FHIR resources.
Used by the FHIR Explorer RelationshipMapper component.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func
from typing import List, Dict, Optional, Any
import json
import logging
from collections import defaultdict

from database import get_db_session
from services.fhir_client_config import get_resource

logger = logging.getLogger(__name__)

relationships_router = APIRouter(
    prefix="/fhir-relationships",
    tags=["fhir-relationships"]
)

# FHIR reference field mappings by resource type
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

@relationships_router.get("/schema")
async def get_relationship_schema():
    """
    Get the complete FHIR relationship schema.
    Returns all possible relationships between resource types.
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
    db: AsyncSession = Depends(get_db_session)
):
    """
    Discover actual relationships for a specific resource instance.
    Returns connected resources with relationship metadata.
    """
    try:
        # Get the source resource
        logger.info(f"Attempting to read resource: {resource_type}/{resource_id}")
        try:
            source_resource = get_resource(resource_type, resource_id)
        except AttributeError as ae:
            logger.error(f"AttributeError when reading resource: {ae}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"FHIR client error: {str(ae)}")
        except Exception as e:
            logger.error(f"Unexpected error reading resource: {e}", exc_info=True)
            raise

        if not source_resource:
            logger.warning(f"Resource not found: {resource_type}/{resource_id}")
            raise HTTPException(status_code=404, detail=f"{resource_type}/{resource_id} not found")

        # Initialize result structure
        result = {
            "source": {
                "resourceType": resource_type,
                "id": resource_id,
                "display": _get_resource_display(source_resource)
            },
            "relationships": [],
            "nodes": [],
            "links": []
        }

        # Track visited resources to avoid cycles
        visited = set()
        visited.add(f"{resource_type}/{resource_id}")

        # Discover relationships recursively
        await _discover_relationships_recursive(
            db,
            source_resource,
            resource_type,
            resource_id,
            depth,
            1,
            visited,
            result,
            include_counts
        )
        
        return result
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error discovering relationships: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@relationships_router.get("/statistics")
async def get_relationship_statistics(
    resource_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get statistical information about relationships in the database.
    Useful for understanding data patterns and connectivity.

    Updated: 2025-10-05 - Migrated to HAPI FHIR JPA tables
    """
    try:
        stats = {
            "totalResources": 0,
            "totalRelationships": 0,
            "resourceTypeCounts": {},
            "relationshipTypeCounts": {},
            "mostConnectedResources": [],
            "orphanedResources": []
        }

        # Count resources by type from HAPI FHIR
        resource_count_query = """
            SELECT res_type as resource_type, COUNT(*) as count
            FROM hfj_resource
            WHERE res_deleted_at IS NULL
            GROUP BY res_type
            ORDER BY count DESC
        """

        result = await db.execute(text(resource_count_query))
        for row in result:
            stats["resourceTypeCounts"][row.resource_type] = row.count
            stats["totalResources"] += row.count

        # Count relationships from HAPI FHIR resource links
        relationship_count_query = """
            SELECT
                r.res_type || '->' || link.target_resource_type as relationship_type,
                COUNT(*) as count
            FROM hfj_res_link link
            JOIN hfj_resource r ON link.src_resource_id = r.res_id
            WHERE r.res_deleted_at IS NULL
            GROUP BY r.res_type, link.target_resource_type
            ORDER BY count DESC
            LIMIT 20
        """

        result = await db.execute(text(relationship_count_query))
        for row in result:
            stats["relationshipTypeCounts"][row.relationship_type] = row.count
            stats["totalRelationships"] += row.count

        # Find most connected resources from HAPI FHIR
        # Count both outgoing and incoming links
        # Fixed 2025-10-05: Cast all resource_id to text for UNION compatibility
        connected_query = """
            WITH outgoing_connections AS (
                SELECT
                    r.res_type as resource_type,
                    r.res_id::text as resource_id,
                    COUNT(*) as connection_count
                FROM hfj_res_link link
                JOIN hfj_resource r ON link.src_resource_id = r.res_id
                WHERE r.res_deleted_at IS NULL
                GROUP BY r.res_type, r.res_id
            ),
            incoming_connections AS (
                SELECT
                    target_resource_type as resource_type,
                    CAST(target_resource_id AS text) as resource_id,
                    COUNT(*) as connection_count
                FROM hfj_res_link
                GROUP BY target_resource_type, target_resource_id
            ),
            all_connections AS (
                SELECT resource_type, resource_id, connection_count FROM outgoing_connections
                UNION ALL
                SELECT resource_type, resource_id, connection_count FROM incoming_connections
            )
            SELECT
                resource_type,
                resource_id,
                SUM(connection_count) as total_connections
            FROM all_connections
            GROUP BY resource_type, resource_id
            ORDER BY total_connections DESC
            LIMIT 10
        """

        result = await db.execute(text(connected_query))
        for row in result:
            stats["mostConnectedResources"].append({
                "resourceType": row.resource_type,
                "id": row.resource_id,
                "connectionCount": row.total_connections
            })

        return stats

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
    db: AsyncSession = Depends(get_db_session)
):
    """
    Find all paths between two resources.
    Useful for understanding how resources are connected.
    """
    try:
        # Verify both resources exist
        source = get_resource(source_type, source_id)
        target = get_resource(target_type, target_id)

        if not source or not target:
            raise HTTPException(status_code=404, detail="Source or target resource not found")

        # Find paths using breadth-first search
        paths = await _find_paths_bfs(
            db,
            f"{source_type}/{source_id}",
            f"{target_type}/{target_id}",
            max_depth
        )
        
        return {
            "source": {
                "resourceType": source_type,
                "id": source_id,
                "display": _get_resource_display(source)
            },
            "target": {
                "resourceType": target_type,
                "id": target_id,
                "display": _get_resource_display(target)
            },
            "paths": paths,
            "pathCount": len(paths)
        }
        
    except Exception as e:
        logger.error(f"Error finding relationship paths: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions

def _get_resource_display(resource: Any) -> str:
    """
    Extract a display name from a FHIR resource.

    Handles both fhirclient objects and dictionaries.
    Fixed 2025-10-05: Convert fhirclient objects to dict first
    """
    # Convert fhirclient object to dictionary if needed
    if hasattr(resource, 'as_json'):
        resource = resource.as_json()

    # Now resource is guaranteed to be a dictionary
    if not isinstance(resource, dict):
        return "Unknown Resource"

    if "name" in resource:
        if isinstance(resource["name"], list) and len(resource["name"]) > 0:
            name = resource["name"][0]
            if "text" in name:
                return name["text"]
            elif "family" in name:
                given = " ".join(name.get("given", []))
                return f"{given} {name['family']}".strip()

    if "display" in resource:
        return resource["display"]

    if "code" in resource and "text" in resource["code"]:
        return resource["code"]["text"]

    if "code" in resource and "coding" in resource["code"]:
        for coding in resource["code"]["coding"]:
            if "display" in coding:
                return coding["display"]

    return f"{resource.get('resourceType', 'Resource')} {resource.get('id', '')}"

async def _discover_relationships_recursive(
    db: AsyncSession,
    resource: Any,  # Can be fhirclient object or dict
    resource_type: str,
    resource_id: str,
    max_depth: int,
    current_depth: int,
    visited: set,
    result: Dict[str, Any],
    include_counts: bool
):
    """
    Recursively discover relationships from a resource.

    Fixed 2025-10-05: Handle fhirclient objects properly
    """
    if current_depth > max_depth:
        return

    # Convert fhirclient object to dictionary if needed
    resource_dict = resource.as_json() if hasattr(resource, 'as_json') else resource

    # Add current resource as a node
    node_id = f"{resource_type}/{resource_id}"
    result["nodes"].append({
        "id": node_id,
        "resourceType": resource_type,
        "display": _get_resource_display(resource),
        "depth": current_depth - 1
    })

    # Get reference fields for this resource type
    reference_fields = REFERENCE_FIELDS.get(resource_type, {})

    # Check each reference field (use resource_dict for field access)
    for field_name, field_config in reference_fields.items():
        if field_name in resource_dict:
            references = resource_dict[field_name]
            if not isinstance(references, list):
                references = [references]

            logger.info(f"Found field {field_name} with {len(references)} references in {resource_type}/{resource_id}")

            for ref in references:
                if isinstance(ref, dict) and "reference" in ref:
                    ref_string = ref["reference"]
                    target_type = None
                    target_id = None

                    # Handle both standard and URN format references
                    if ref_string.startswith("urn:uuid:"):
                        # URN format - need to determine resource type from context
                        target_id = ref_string[9:]  # Remove "urn:uuid:" prefix
                        logger.info(f"Found URN reference: {ref_string} in field {field_name}")
                        # For URN references, we need to determine the resource type
                        # from the field configuration
                        if field_config.get("target"):
                            # Try to resolve the actual resource type
                            for possible_type in field_config["target"]:
                                try:
                                    test_resource = get_resource(possible_type, target_id)
                                    if test_resource:
                                        target_type = possible_type
                                        logger.info(f"Resolved URN {ref_string} to {possible_type}/{target_id}")
                                        break
                                except:
                                    continue
                    else:
                        # Standard format: ResourceType/ResourceId
                        ref_parts = ref_string.split("/")
                        if len(ref_parts) == 2:
                            target_type, target_id = ref_parts

                    if target_type and target_id:
                        target_node_id = f"{target_type}/{target_id}"

                        # LONG-TERM FIX (2025-10-05): Verify target resource exists before adding link
                        # This prevents links to non-existent nodes in the graph
                        target_resource = None
                        if target_node_id not in visited and current_depth < max_depth:
                            try:
                                target_resource = get_resource(target_type, target_id)
                                if not target_resource:
                                    logger.debug(f"Skipping forward reference to {target_node_id} - resource not found in FHIR")
                                    continue
                            except Exception as e:
                                logger.debug(f"Skipping forward reference to {target_node_id} - fetch failed: {str(e)}")
                                continue

                        # Resource exists - safe to add link
                        result["links"].append({
                            "source": node_id,
                            "target": target_node_id,
                            "field": field_name,
                            "type": field_config["type"]
                        })

                        # Recursively explore if not visited
                        if target_node_id not in visited and current_depth < max_depth:
                            visited.add(target_node_id)
                            await _discover_relationships_recursive(
                                db,
                                target_resource,
                                target_type,
                                target_id,
                                max_depth,
                                current_depth + 1,
                                visited,
                                result,
                                include_counts
                            )

    # Also check for reverse relationships (resources that reference this one)
    # Updated 2025-10-05: Query HAPI FHIR hfj_res_link table
    # Fixed 2025-10-05: Join through resource table to match FHIR logical ID
    # Fixed 2025-10-05: Use r.fhir_id (source resource ID), not target_res.fhir_id
    if include_counts and current_depth < max_depth:
        reverse_refs_query = """
            SELECT r.res_type as source_type, r.fhir_id as source_id, link.src_path as field_path
            FROM hfj_res_link link
            JOIN hfj_resource r ON link.src_resource_id = r.res_id
            JOIN hfj_resource target_res ON link.target_resource_id = target_res.res_id
            WHERE target_res.res_type = :target_type
            AND target_res.fhir_id = :target_id
            AND r.res_deleted_at IS NULL
            AND target_res.res_deleted_at IS NULL
            LIMIT 200
        """

        result_refs = await db.execute(
            text(reverse_refs_query),
            {"target_type": resource_type, "target_id": resource_id}
        )

        for row in result_refs:
            source_node_id = f"{row.source_type}/{row.source_id}"

            # LONG-TERM FIX (2025-10-05): Only add link if source resource actually exists
            # Verify the resource can be fetched before adding it to the graph
            try:
                source_resource = get_resource(row.source_type, row.source_id)
                if not source_resource:
                    logger.debug(f"Skipping reverse reference from {source_node_id} - resource not found in FHIR")
                    continue
            except Exception as e:
                logger.debug(f"Skipping reverse reference from {source_node_id} - fetch failed: {str(e)}")
                continue

            # Resource exists - safe to add link
            result["links"].append({
                "source": source_node_id,
                "target": node_id,
                "field": row.field_path,
                "type": "reverse"
            })

            # Recursively explore if not visited
            if source_node_id not in visited:
                visited.add(source_node_id)
                await _discover_relationships_recursive(
                    db,
                    source_resource,
                    row.source_type,
                    row.source_id,
                    max_depth,
                    current_depth + 1,
                    visited,
                    result,
                    include_counts
                )

async def _find_paths_bfs(
    db: AsyncSession,
    source: str,
    target: str,
    max_depth: int
) -> List[List[Dict[str, Any]]]:
    """Find all paths between two resources using breadth-first search."""
    paths = []
    queue = [(source, [source])]
    visited = set()

    while queue and len(paths) < 10:  # Limit to 10 paths
        current, path = queue.pop(0)

        if len(path) > max_depth:
            continue

        if current == target:
            # Found a path
            path_details = []
            for i in range(len(path) - 1):
                path_details.append({
                    "from": path[i],
                    "to": path[i + 1],
                    "step": i + 1
                })
            paths.append(path_details)
            continue

        if current in visited:
            continue

        visited.add(current)

        # Get all connected resources
        current_type, current_id = current.split("/")

        # Check forward references
        resource = get_resource(current_type, current_id)
        if resource:
            # Convert fhirclient object to dictionary if needed
            # Fixed 2025-10-05: Handle fhirclient objects properly
            resource_dict = resource.as_json() if hasattr(resource, 'as_json') else resource

            reference_fields = REFERENCE_FIELDS.get(current_type, {})
            for field_name, field_config in reference_fields.items():
                if field_name in resource_dict:
                    references = resource_dict[field_name]
                    if not isinstance(references, list):
                        references = [references]

                    for ref in references:
                        if isinstance(ref, dict) and "reference" in ref:
                            ref_string = ref["reference"]

                            # Handle URN format references
                            if ref_string.startswith("urn:uuid:"):
                                # For URN references, try to resolve the resource type
                                target_id = ref_string[9:]
                                if field_config.get("target"):
                                    for possible_type in field_config["target"]:
                                        try:
                                            test_resource = get_resource(possible_type, target_id)
                                            if test_resource:
                                                next_node = f"{possible_type}/{target_id}"
                                                if next_node not in path:
                                                    queue.append((next_node, path + [next_node]))
                                                break
                                        except:
                                            continue
                            else:
                                # Standard format
                                next_node = ref_string
                                if next_node not in path:  # Avoid cycles
                                    queue.append((next_node, path + [next_node]))

        # Check reverse references from HAPI FHIR (updated 2025-10-05)
        # Fixed 2025-10-05: Join through resource table to match FHIR logical ID
        reverse_refs_query = """
            SELECT r.res_type || '/' || r.fhir_id as source
            FROM hfj_res_link link
            JOIN hfj_resource r ON link.src_resource_id = r.res_id
            JOIN hfj_resource target_res ON link.target_resource_id = target_res.res_id
            WHERE target_res.res_type = :target_type
            AND target_res.fhir_id = :target_id
            AND r.res_deleted_at IS NULL
            AND target_res.res_deleted_at IS NULL
            LIMIT 100
        """

        result_refs = await db.execute(
            text(reverse_refs_query),
            {"target_type": current_type, "target_id": current_id}
        )

        for row in result_refs:
            next_node = row.source
            if next_node not in path:  # Avoid cycles
                queue.append((next_node, path + [next_node]))

    return paths