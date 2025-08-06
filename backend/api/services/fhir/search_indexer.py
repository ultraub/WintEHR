"""
Search Parameter Indexer Service

Extracts and indexes search parameters from FHIR resources.
Runs asynchronously to update search indices.
"""

import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from decimal import Decimal
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

from fhir.core.resources_r4b import construct_fhir_element


class SearchParameterIndexer:
    """
    Indexes FHIR resources for search.
    
    Extracts searchable values based on SearchParameter definitions
    and stores them in the search_params table.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self._init_search_definitions()
    
    def _init_search_definitions(self):
        """Initialize search parameter definitions for each resource type."""
        # This is a subset of search parameters - full implementation would load from SearchParameter resources
        self.search_definitions = {
            "Patient": {
                "_id": {"type": "token", "path": "id"},
                "_lastUpdated": {"type": "date", "path": "meta.lastUpdated"},
                "identifier": {"type": "token", "path": "identifier"},
                "name": {"type": "string", "path": "name"},
                "family": {"type": "string", "path": "name.family"},
                "given": {"type": "string", "path": "name.given"},
                "birthdate": {"type": "date", "path": "birthDate"},
                "gender": {"type": "token", "path": "gender"},
                "address": {"type": "string", "path": "address"},
                "address-city": {"type": "string", "path": "address.city"},
                "address-state": {"type": "string", "path": "address.state"},
                "address-postalcode": {"type": "string", "path": "address.postalCode"},
                "phone": {"type": "token", "path": "telecom[system=phone].value"},
                "email": {"type": "token", "path": "telecom[system=email].value"},
                "general-practitioner": {"type": "reference", "path": "generalPractitioner"},
                "organization": {"type": "reference", "path": "managingOrganization"}
            },
            "Observation": {
                "_id": {"type": "token", "path": "id"},
                "_lastUpdated": {"type": "date", "path": "meta.lastUpdated"},
                "identifier": {"type": "token", "path": "identifier"},
                "status": {"type": "token", "path": "status"},
                "category": {"type": "token", "path": "category"},
                "code": {"type": "token", "path": "code"},
                "subject": {"type": "reference", "path": "subject"},
                "patient": {"type": "reference", "path": "subject"},
                "encounter": {"type": "reference", "path": "encounter"},
                "date": {"type": "date", "path": "effectiveDateTime"},
                "issued": {"type": "date", "path": "issued"},
                "performer": {"type": "reference", "path": "performer"},
                "value-quantity": {"type": "quantity", "path": "valueQuantity"},
                "value-string": {"type": "string", "path": "valueString"},
                "value-concept": {"type": "token", "path": "valueCodeableConcept"},
                "component-code": {"type": "token", "path": "component.code"},
                "component-value-quantity": {"type": "quantity", "path": "component.valueQuantity"}
            },
            "Condition": {
                "_id": {"type": "token", "path": "id"},
                "_lastUpdated": {"type": "date", "path": "meta.lastUpdated"},
                "identifier": {"type": "token", "path": "identifier"},
                "clinical-status": {"type": "token", "path": "clinicalStatus"},
                "verification-status": {"type": "token", "path": "verificationStatus"},
                "category": {"type": "token", "path": "category"},
                "severity": {"type": "token", "path": "severity"},
                "code": {"type": "token", "path": "code"},
                "subject": {"type": "reference", "path": "subject"},
                "patient": {"type": "reference", "path": "subject"},
                "encounter": {"type": "reference", "path": "encounter"},
                "onset-date": {"type": "date", "path": "onsetDateTime"},
                "abatement-date": {"type": "date", "path": "abatementDateTime"},
                "recorded-date": {"type": "date", "path": "recordedDate"},
                "asserter": {"type": "reference", "path": "asserter"}
            },
            "Encounter": {
                "_id": {"type": "token", "path": "id"},
                "_lastUpdated": {"type": "date", "path": "meta.lastUpdated"},
                "identifier": {"type": "token", "path": "identifier"},
                "status": {"type": "token", "path": "status"},
                "class": {"type": "token", "path": "class"},
                "type": {"type": "token", "path": "type"},
                "subject": {"type": "reference", "path": "subject"},
                "patient": {"type": "reference", "path": "subject"},
                "participant": {"type": "reference", "path": "participant.individual"},
                "period": {"type": "date", "path": "period"},
                "length": {"type": "quantity", "path": "length"},
                "location": {"type": "reference", "path": "location.location"},
                "service-provider": {"type": "reference", "path": "serviceProvider"}
            },
            "MedicationRequest": {
                "_id": {"type": "token", "path": "id"},
                "_lastUpdated": {"type": "date", "path": "meta.lastUpdated"},
                "identifier": {"type": "token", "path": "identifier"},
                "status": {"type": "token", "path": "status"},
                "intent": {"type": "token", "path": "intent"},
                "category": {"type": "token", "path": "category"},
                "priority": {"type": "token", "path": "priority"},
                "medication": {"type": "reference", "path": "medicationReference"},
                "subject": {"type": "reference", "path": "subject"},
                "patient": {"type": "reference", "path": "subject"},
                "encounter": {"type": "reference", "path": "encounter"},
                "requester": {"type": "reference", "path": "requester"},
                "authoredon": {"type": "date", "path": "authoredOn"},
                "code": {"type": "token", "path": "medicationCodeableConcept"}
            },
            "Procedure": {
                "_id": {"type": "token", "path": "id"},
                "_lastUpdated": {"type": "date", "path": "meta.lastUpdated"},
                "identifier": {"type": "token", "path": "identifier"},
                "status": {"type": "token", "path": "status"},
                "category": {"type": "token", "path": "category"},
                "code": {"type": "token", "path": "code"},
                "subject": {"type": "reference", "path": "subject"},
                "patient": {"type": "reference", "path": "subject"},
                "encounter": {"type": "reference", "path": "encounter"},
                "performed": {"type": "date", "path": "performedDateTime"},
                "performer": {"type": "reference", "path": "performer.actor"},
                "location": {"type": "reference", "path": "location"},
                "outcome": {"type": "token", "path": "outcome"}
            }
        }
    
    async def index_resource(
        self,
        resource_id: uuid.UUID,
        resource_type: str,
        resource_data: Dict[str, Any]
    ):
        """
        Index a FHIR resource for search.
        
        Extracts all searchable parameters and stores them.
        """
        # Get search definitions for this resource type
        definitions = self.search_definitions.get(resource_type, {})
        
        # Extract search parameters
        for param_name, definition in definitions.items():
            param_type = definition["type"]
            path = definition["path"]
            
            # Extract values from resource using path
            values = self._extract_values(resource_data, path)
            
            # Store each value
            for value in values:
                await self._store_search_param(
                    resource_id, resource_type, param_name, param_type, value
                )
    
    def _extract_values(
        self,
        resource_data: Dict[str, Any],
        path: str
    ) -> List[Any]:
        """
        Extract values from resource using FHIRPath-like syntax.
        
        Simplified implementation supporting:
        - Simple paths: "status", "name.family"
        - Array access: "name.given", "identifier"
        - Filtered arrays: "telecom[system=phone].value"
        """
        values = []
        
        # Handle special case for root-level paths
        if path in ["id", "_id"]:
            if "id" in resource_data:
                values.append(resource_data["id"])
            return values
        
        # Parse path
        if "[" in path:
            # Handle filtered array access
            match = re.match(r"(.+)\[(.+)=(.+)\]\.(.+)", path)
            if match:
                array_path, filter_field, filter_value, value_field = match.groups()
                arrays = self._navigate_path(resource_data, array_path)
                
                for array in arrays:
                    if isinstance(array, list):
                        for item in array:
                            if isinstance(item, dict) and item.get(filter_field) == filter_value:
                                val = item.get(value_field)
                                if val is not None:
                                    values.append(val)
        else:
            # Simple path navigation
            values = self._navigate_path(resource_data, path)
        
        return values
    
    def _navigate_path(
        self,
        data: Union[Dict, List],
        path: str
    ) -> List[Any]:
        """Navigate a dot-separated path through the data structure."""
        if not path:
            return [data] if data is not None else []
        
        parts = path.split(".")
        current = [data]
        
        for part in parts:
            next_values = []
            
            for value in current:
                if isinstance(value, dict):
                    if part in value:
                        val = value[part]
                        if isinstance(val, list):
                            next_values.extend(val)
                        elif val is not None:
                            next_values.append(val)
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict) and part in item:
                            val = item[part]
                            if isinstance(val, list):
                                next_values.extend(val)
                            elif val is not None:
                                next_values.append(val)
            
            current = next_values
        
        return current
    
    async def _store_search_param(
        self,
        resource_id: uuid.UUID,
        resource_type: str,
        param_name: str,
        param_type: str,
        value: Any
    ):
        """Store a single search parameter value."""
        # Prepare values based on type
        values = {
            "resource_id": resource_id,
            "resource_type": resource_type,
            "param_name": param_name,
            "param_type": param_type,
            "value_string": None,
            "value_number": None,
            "value_date": None,
            "value_token_system": None,
            "value_token_code": None
        }
        
        if param_type == "string":
            if isinstance(value, str):
                values["value_string"] = value
            elif isinstance(value, dict):
                # Handle complex types by converting to string
                if "text" in value:
                    values["value_string"] = value["text"]
                elif "value" in value:
                    values["value_string"] = str(value["value"])
        
        elif param_type == "token":
            if isinstance(value, str):
                values["value_token_code"] = value
            elif isinstance(value, dict):
                # Handle CodeableConcept and Coding
                if "coding" in value and isinstance(value["coding"], list):
                    for coding in value["coding"]:
                        await self._store_search_param(
                            resource_id, resource_type, param_name, param_type, coding
                        )
                    return
                else:
                    values["value_token_system"] = value.get("system")
                    values["value_token_code"] = value.get("code") or value.get("value")
        
        elif param_type == "date":
            if isinstance(value, str):
                try:
                    # Parse ISO date/datetime
                    if "T" in value:
                        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    else:
                        dt = datetime.strptime(value, "%Y-%m-%d")
                    values["value_date"] = dt
                except:
                    pass
            elif isinstance(value, datetime):
                values["value_date"] = value
        
        elif param_type == "number" or param_type == "quantity":
            if isinstance(value, (int, float, Decimal)):
                values["value_number"] = Decimal(str(value))
            elif isinstance(value, dict) and "value" in value:
                try:
                    values["value_number"] = Decimal(str(value["value"]))
                except:
                    pass
        
        elif param_type == "reference":
            if isinstance(value, str):
                values["value_string"] = value
            elif isinstance(value, dict) and "reference" in value:
                values["value_string"] = value["reference"]
        
        # Only store if we have a value
        has_value = any([
            values["value_string"],
            values["value_number"],
            values["value_date"],
            values["value_token_code"]
        ])
        
        if has_value:
            query = text("""
                INSERT INTO fhir.search_params (
                    resource_id, resource_type, param_name, param_type,
                    value_string, value_number, value_date,
                    value_token_system, value_token_code
                ) VALUES (
                    :resource_id, :resource_type, :param_name, :param_type,
                    :value_string, :value_number, :value_date,
                    :value_token_system, :value_token_code
                )
            """)
            
            await self.session.execute(query, values)
    
    async def reindex_resource(
        self,
        resource_id: uuid.UUID,
        resource_type: str,
        resource_data: Dict[str, Any]
    ):
        """
        Reindex a resource (delete old params and create new ones).
        """
        # Delete existing parameters
        delete_query = text("""
            DELETE FROM fhir.search_params
            WHERE resource_id = :resource_id
        """)
        
        await self.session.execute(delete_query, {"resource_id": resource_id})
        
        # Index new parameters
        await self.index_resource(resource_id, resource_type, resource_data)
    
    async def bulk_index_resources(
        self,
        resources: List[tuple[uuid.UUID, str, Dict[str, Any]]]
    ):
        """
        Index multiple resources efficiently.
        
        Args:
            resources: List of (resource_id, resource_type, resource_data) tuples
        """
        for resource_id, resource_type, resource_data in resources:
            await self.index_resource(resource_id, resource_type, resource_data)
    
    async def get_indexed_params(
        self,
        resource_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """Get all indexed parameters for a resource (for debugging)."""
        query = text("""
            SELECT 
                param_name, param_type,
                value_string, value_number, value_date,
                value_token_system, value_token_code
            FROM fhir.search_params
            WHERE resource_id = :resource_id
            ORDER BY param_name
        """)
        
        result = await self.session.execute(query, {"resource_id": resource_id})
        
        params = []
        for row in result:
            params.append({
                "name": row.param_name,
                "type": row.param_type,
                "string": row.value_string,
                "number": row.value_number,
                "date": row.value_date.isoformat() if row.value_date else None,
                "token_system": row.value_token_system,
                "token_code": row.value_token_code
            })
        
        return params