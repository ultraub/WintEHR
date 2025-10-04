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
        
        # Count resources by type
        resource_count_query = """
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false
            GROUP BY resource_type
            ORDER BY count DESC
        """
        
        result = await db.execute(text(resource_count_query))
        for row in result:
            stats["resourceTypeCounts"][row.resource_type] = row.count
            stats["totalResources"] += row.count
        
        # Count relationships
        relationship_count_query = """
            SELECT 
                source_type || '->' || target_type as relationship_type,
                COUNT(*) as count
            FROM fhir.references
            GROUP BY source_type, target_type
            ORDER BY count DESC
            LIMIT 20
        """
        
        result = await db.execute(text(relationship_count_query))
        for row in result:
            stats["relationshipTypeCounts"][row.relationship_type] = row.count
            stats["totalRelationships"] += row.count
        
        # Find most connected resources
        # Note: source_id is BIGINT (internal ID), target_id is VARCHAR (FHIR ID)
        # We need to join with resources table to get consistent IDs
        connected_query = """
            WITH outgoing_connections AS (
                SELECT 
                    r.resource_type,
                    r.fhir_id as resource_id,
                    COUNT(*) as connection_count
                FROM fhir.references ref
                JOIN fhir.resources r ON ref.source_id = r.id
                WHERE r.deleted = false
                GROUP BY r.resource_type, r.fhir_id
            ),
            incoming_connections AS (
                SELECT 
                    ref.target_type as resource_type,
                    ref.target_id as resource_id,
                    COUNT(*) as connection_count
                FROM fhir.references ref
                GROUP BY ref.target_type, ref.target_id
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

def _get_resource_display(resource: Dict[str, Any]) -> str:
    """Extract a display name from a FHIR resource."""
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
    resource: Dict[str, Any],
    resource_type: str,
    resource_id: str,
    max_depth: int,
    current_depth: int,
    visited: set,
    result: Dict[str, Any],
    include_counts: bool
):
    """Recursively discover relationships from a resource."""
    if current_depth > max_depth:
        return

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

    # Check each reference field
    for field_name, field_config in reference_fields.items():
        if field_name in resource:
            references = resource[field_name]
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

                        # Add link
                        result["links"].append({
                            "source": node_id,
                            "target": target_node_id,
                            "field": field_name,
                            "type": field_config["type"]
                        })

                        # Recursively explore if not visited
                        if target_node_id not in visited and current_depth < max_depth:
                            visited.add(target_node_id)
                            try:
                                target_resource = get_resource(target_type, target_id)
                                if target_resource:
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
                            except Exception as e:
                                logger.warning(f"Could not fetch {target_type}/{target_id}: {str(e)}")

    # Also check for reverse relationships (resources that reference this one)
    if include_counts and current_depth < max_depth:
        reverse_refs_query = """
            SELECT r.resource_type as source_type, r.fhir_id as source_id, ref.reference_path as field_path
            FROM fhir.references ref
            JOIN fhir.resources r ON ref.source_id = r.id
            WHERE ref.target_type = :target_type AND ref.target_id = :target_id
            AND (r.deleted = false OR r.deleted IS NULL)
            LIMIT 50
        """

        result_refs = await db.execute(
            text(reverse_refs_query),
            {"target_type": resource_type, "target_id": resource_id}
        )

        for row in result_refs:
            source_node_id = f"{row.source_type}/{row.source_id}"

            # Add link
            result["links"].append({
                "source": source_node_id,
                "target": node_id,
                "field": row.field_path,
                "type": "reverse"
            })

            # Recursively explore if not visited
            if source_node_id not in visited:
                visited.add(source_node_id)
                try:
                    source_resource = get_resource(row.source_type, row.source_id)
                    if source_resource:
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
                except Exception as e:
                    logger.warning(f"Could not fetch {row.source_type}/{row.source_id}: {str(e)}")

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
            reference_fields = REFERENCE_FIELDS.get(current_type, {})
            for field_name, field_config in reference_fields.items():
                if field_name in resource:
                    references = resource[field_name]
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

        # Check reverse references
        reverse_refs_query = """
            SELECT r.resource_type || '/' || r.fhir_id as source
            FROM fhir.references ref
            JOIN fhir.resources r ON ref.source_id = r.id
            WHERE ref.target_type = :target_type AND ref.target_id = :target_id
            AND (r.deleted = false OR r.deleted IS NULL)
            LIMIT 20
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