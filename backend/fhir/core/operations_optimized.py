"""
Optimized FHIR Operations Implementation with Database-Level Pagination

Implements efficient pagination for Patient/$everything and other operations
that doesn't require loading all resources into memory.
"""

from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime
import logging
from sqlalchemy import text, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from fhir.core.resources_r4b import Bundle, BundleEntry, Parameters, construct_fhir_element
from fhir.core.storage import FHIRStorageEngine

logger = logging.getLogger(__name__)


class OptimizedPatientEverythingOperation:
    """
    Optimized implementation of Patient/$everything with database-level pagination.
    """
    
    def __init__(self, storage: FHIRStorageEngine, db_session: AsyncSession):
        self.storage = storage
        self.db = db_session
    
    async def execute(
        self,
        patient_id: str,
        parameters: Optional[dict] = None
    ) -> dict:
        """
        Execute Patient/$everything with efficient pagination.
        
        Args:
            patient_id: The patient ID
            parameters: Operation parameters (_since, _type, _count, _offset)
            
        Returns:
            Bundle with paginated results
        """
        # Validate patient exists
        patient = await self.storage.read_resource("Patient", patient_id)
        if not patient:
            raise ValueError(f"Patient/{patient_id} not found")
        
        # Extract parameters
        params = self._extract_parameters(parameters)
        
        # Get total count first (for accurate pagination)
        total_count = await self._get_total_count(patient_id, params)
        
        # Create result bundle
        bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "total": total_count,
            "entry": []
        }
        
        # Always include the patient as the first entry
        bundle["entry"].append({
            "fullUrl": f"Patient/{patient_id}",
            "resource": patient,
            "search": {"mode": "match"}
        })
        
        # If we have more resources beyond the patient
        if total_count > 1:
            # Fetch paginated resources
            resources = await self._fetch_paginated_resources(
                patient_id, 
                params,
                # Adjust offset and count to account for the patient resource
                offset=max(0, params['offset'] - 1) if params['offset'] > 0 else 0,
                limit=params['count'] - 1 if params['offset'] == 0 else params['count']
            )
            
            # Add resources to bundle
            for resource in resources:
                bundle["entry"].append({
                    "fullUrl": f"{resource['resource_type']}/{resource['id']}",
                    "resource": resource,
                    "search": {"mode": "match"}
                })
        
        # Add pagination links
        bundle["link"] = self._build_pagination_links(
            patient_id, params, total_count
        )
        
        return bundle
    
    def _extract_parameters(self, parameters: Optional[dict]) -> dict:
        """Extract and validate operation parameters."""
        params = {
            'since': None,
            'types': None,
            'count': 100,  # Default page size
            'offset': 0
        }
        
        if not parameters:
            return params
        
        # Handle both dict and Parameters object
        if hasattr(parameters, 'parameter'):
            # Parameters object
            for param in parameters.parameter or []:
                if param.name == "_since" and param.valueDateTime:
                    params['since'] = param.valueDateTime
                elif param.name == "_type" and param.valueString:
                    params['types'] = [t.strip() for t in param.valueString.split(',')]
                elif param.name == "_count" and param.valueInteger:
                    params['count'] = min(param.valueInteger, 1000)  # Max 1000 per page
                elif param.name == "_offset" and param.valueInteger:
                    params['offset'] = param.valueInteger
        else:
            # Dict parameters
            if parameters.get('_since'):
                params['since'] = parameters['_since']
            if parameters.get('_type'):
                params['types'] = [t.strip() for t in parameters['_type'].split(',')]
            if parameters.get('_count'):
                params['count'] = min(int(parameters['_count']), 1000)
            if parameters.get('_offset'):
                params['offset'] = int(parameters['_offset'])
        
        return params
    
    async def _get_total_count(self, patient_id: str, params: dict) -> int:
        """Get total count of resources in patient compartment."""
        # Start with 1 for the patient resource itself
        total = 1
        
        # Get resource types to search
        types_to_search = self._get_resource_types_to_search(params['types'])
        
        # Build the count query
        for resource_type in types_to_search:
            search_param = self._get_patient_search_param(resource_type)
            
            query = text("""
                SELECT COUNT(*)
                FROM fhir.resources r
                WHERE r.resource_type = :resource_type
                AND r.deleted = false
                AND EXISTS (
                    SELECT 1 FROM fhir.search_params sp
                    WHERE sp.resource_id = r.id
                    AND sp.resource_type = r.resource_type
                    AND sp.param_name = :param_name
                    AND sp.value_string = :patient_ref
                )
            """)
            
            # Add _since filter if specified
            if params['since']:
                query = text("""
                    SELECT COUNT(*)
                    FROM fhir.resources r
                    WHERE r.resource_type = :resource_type
                    AND r.deleted = false
                    AND r.last_updated > :since_date
                    AND EXISTS (
                        SELECT 1 FROM fhir.search_params sp
                        WHERE sp.resource_id = r.id
                        AND sp.resource_type = r.resource_type
                        AND sp.param_name = :param_name
                        AND sp.value_string = :patient_ref
                    )
                """)
            
            result = await self.db.execute(
                query,
                {
                    "resource_type": resource_type,
                    "param_name": search_param,
                    "patient_ref": f"Patient/{patient_id}",
                    "since_date": params['since']
                }
            )
            
            count = result.scalar()
            if count:
                total += count
        
        return total
    
    async def _fetch_paginated_resources(
        self, 
        patient_id: str, 
        params: dict,
        offset: int,
        limit: int
    ) -> List[dict]:
        """Fetch resources with database-level pagination."""
        all_resources = []
        types_to_search = self._get_resource_types_to_search(params['types'])
        
        # We need to implement pagination across multiple resource types
        # This is complex because we need to maintain consistent ordering
        
        # Strategy: Use a UNION query with consistent ordering
        union_parts = []
        
        for resource_type in types_to_search:
            search_param = self._get_patient_search_param(resource_type)
            
            if params['since']:
                query_part = f"""
                    SELECT r.data, r.resource_type, r.id, r.last_updated
                    FROM fhir.resources r
                    WHERE r.resource_type = '{resource_type}'
                    AND r.deleted = false
                    AND r.last_updated > :since_date
                    AND EXISTS (
                        SELECT 1 FROM fhir.search_params sp
                        WHERE sp.resource_id = r.id
                        AND sp.resource_type = r.resource_type
                        AND sp.param_name = '{search_param}'
                        AND sp.value_string = :patient_ref
                    )
                """
            else:
                query_part = f"""
                    SELECT r.data, r.resource_type, r.id, r.last_updated
                    FROM fhir.resources r
                    WHERE r.resource_type = '{resource_type}'
                    AND r.deleted = false
                    AND EXISTS (
                        SELECT 1 FROM fhir.search_params sp
                        WHERE sp.resource_id = r.id
                        AND sp.resource_type = r.resource_type
                        AND sp.param_name = '{search_param}'
                        AND sp.value_string = :patient_ref
                    )
                """
            
            union_parts.append(query_part)
        
        if union_parts:
            # Combine with UNION and apply pagination
            full_query = " UNION ALL ".join(union_parts)
            paginated_query = f"""
                WITH all_resources AS (
                    {full_query}
                )
                SELECT data
                FROM all_resources
                ORDER BY last_updated DESC, resource_type, id
                LIMIT :limit OFFSET :offset
            """
            
            result = await self.db.execute(
                text(paginated_query),
                {
                    "patient_ref": f"Patient/{patient_id}",
                    "since_date": params['since'],
                    "limit": limit,
                    "offset": offset
                }
            )
            
            for row in result:
                all_resources.append(row.data)
        
        return all_resources
    
    def _get_resource_types_to_search(self, requested_types: Optional[List[str]]) -> List[str]:
        """Get the list of resource types to search."""
        # All patient compartment resource types
        all_types = [
            "AllergyIntolerance", "CarePlan", "CareTeam", "ClinicalImpression",
            "Condition", "DiagnosticReport", "DocumentReference", "Encounter",
            "Goal", "ImagingStudy", "Immunization", "MedicationAdministration",
            "MedicationDispense", "MedicationRequest", "MedicationStatement",
            "Observation", "Procedure", "RiskAssessment", "ServiceRequest",
            "Account", "AdverseEvent", "Appointment", "AppointmentResponse",
            "Basic", "BodyStructure", "ChargeItem", "Claim", "ClaimResponse",
            "Communication", "CommunicationRequest", "Composition", "Consent",
            "Coverage", "DetectedIssue", "DeviceRequest", "DeviceUseStatement",
            "EpisodeOfCare", "ExplanationOfBenefit", "FamilyMemberHistory",
            "Flag", "Invoice", "List", "Media", "NutritionOrder",
            "Person", "Provenance", "QuestionnaireResponse", "RelatedPerson",
            "RequestGroup", "ResearchSubject", "Schedule", "Specimen",
            "SupplyDelivery", "SupplyRequest", "VisionPrescription"
        ]
        
        if requested_types:
            # Filter to only requested types (excluding Patient)
            return [t for t in requested_types if t in all_types and t != "Patient"]
        else:
            return all_types
    
    def _get_patient_search_param(self, resource_type: str) -> str:
        """Get the appropriate search parameter name for patient references."""
        # Resources that use 'subject' instead of 'patient'
        subject_params = {
            "Basic", "BodyStructure", "Consent", "DetectedIssue",
            "Media", "QuestionnaireResponse", "RiskAssessment"
        }
        
        # Special cases
        special_params = {
            "Account": "subject",
            "Coverage": "beneficiary",
            "Group": "member",
            "Person": "link",
            "RelatedPerson": "patient"
        }
        
        if resource_type in special_params:
            return special_params[resource_type]
        elif resource_type in subject_params:
            return "subject"
        else:
            return "patient"
    
    def _build_pagination_links(
        self, 
        patient_id: str, 
        params: dict, 
        total: int
    ) -> List[dict]:
        """Build FHIR-compliant pagination links."""
        links = []
        base_url = f"Patient/{patient_id}/$everything"
        
        # Build query parameters
        query_params = []
        if params['types']:
            query_params.append(f"_type={','.join(params['types'])}")
        if params['since']:
            query_params.append(f"_since={params['since']}")
        query_params.append(f"_count={params['count']}")
        
        # Self link
        self_params = query_params.copy()
        if params['offset'] > 0:
            self_params.append(f"_offset={params['offset']}")
        
        self_url = base_url
        if self_params:
            self_url += "?" + "&".join(self_params)
        links.append({"relation": "self", "url": self_url})
        
        # Next link
        if params['offset'] + params['count'] < total:
            next_params = query_params.copy()
            next_params.append(f"_offset={params['offset'] + params['count']}")
            links.append({
                "relation": "next",
                "url": f"{base_url}?" + "&".join(next_params)
            })
        
        # Previous link
        if params['offset'] > 0:
            prev_offset = max(0, params['offset'] - params['count'])
            prev_params = query_params.copy()
            if prev_offset > 0:
                prev_params.append(f"_offset={prev_offset}")
            links.append({
                "relation": "previous",
                "url": f"{base_url}?" + "&".join(prev_params) if prev_params else base_url
            })
        
        # First link
        first_params = query_params.copy()
        links.append({
            "relation": "first",
            "url": f"{base_url}?" + "&".join(first_params) if first_params else base_url
        })
        
        # Last link
        last_offset = max(0, total - params['count'])
        last_params = query_params.copy()
        if last_offset > 0:
            last_params.append(f"_offset={last_offset}")
        links.append({
            "relation": "last",
            "url": f"{base_url}?" + "&".join(last_params) if last_params else base_url
        })
        
        return links


async def create_optimized_operation_handler(
    storage: FHIRStorageEngine,
    db_session: AsyncSession
) -> OptimizedPatientEverythingOperation:
    """
    Factory function to create an optimized operation handler.
    """
    return OptimizedPatientEverythingOperation(storage, db_session)