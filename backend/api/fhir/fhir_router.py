"""
Comprehensive FHIR R4 API Router
Implements FHIR R4 standard with chained queries, complex queries, and bulk operations
Reference: HAPI FHIR Server specifications
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, text
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from urllib.parse import unquote, parse_qs
import json
import uuid
import re
import io
from enum import Enum

from database.database import get_db
from models.synthea_models import Patient, Encounter, Organization, Location, Observation, Condition, Medication, Provider
from .schemas import *
from .bulk_export import BulkExportRouter
from .batch_transaction import BatchProcessor
from .converters import (
    patient_to_fhir, encounter_to_fhir, observation_to_fhir,
    condition_to_fhir, medication_request_to_fhir, practitioner_to_fhir,
    organization_to_fhir, location_to_fhir
)

router = APIRouter(prefix="/R4", tags=["FHIR R4"])

# FHIR Resource Type Mappings
RESOURCE_MAPPINGS = {
    "Patient": {
        "model": Patient,
        "search_params": [
            "identifier", "name", "family", "given", "birthdate", "gender", 
            "address", "telecom", "active", "_id", "_lastUpdated"
        ]
    },
    "Encounter": {
        "model": Encounter,
        "search_params": [
            "identifier", "status", "class", "type", "subject", "participant",
            "period", "reason-code", "reason-reference", "location", "_id", "_lastUpdated"
        ]
    },
    "Observation": {
        "model": Observation,
        "search_params": [
            "identifier", "status", "category", "code", "subject", "encounter",
            "effective", "performer", "value-quantity", "value-string", "component-code",
            "component-value-quantity", "_id", "_lastUpdated"
        ]
    },
    "Condition": {
        "model": Condition,
        "search_params": [
            "identifier", "clinical-status", "verification-status", "category", "severity",
            "code", "subject", "encounter", "onset-date", "onset-age", "recorded-date",
            "_id", "_lastUpdated"
        ]
    },
    "MedicationRequest": {
        "model": Medication,
        "search_params": [
            "identifier", "status", "intent", "category", "medication", "subject",
            "encounter", "authored-on", "requester", "_id", "_lastUpdated"
        ]
    },
    "Practitioner": {
        "model": Provider,
        "search_params": [
            "identifier", "active", "name", "family", "given", "telecom", 
            "qualification", "_id", "_lastUpdated"
        ]
    },
    "Organization": {
        "model": Organization,
        "search_params": [
            "identifier", "active", "name", "type", "address", "partof",
            "_id", "_lastUpdated"
        ]
    },
    "Location": {
        "model": Location,
        "search_params": [
            "identifier", "status", "name", "type", "address", "position",
            "_id", "_lastUpdated"
        ]
    }
}

class SearchModifier(str, Enum):
    EXACT = "exact"
    CONTAINS = "contains"
    MISSING = "missing"
    TEXT = "text"
    IN = "in"
    NOT_IN = "not-in"
    ABOVE = "above"
    BELOW = "below"

class FHIRSearchProcessor:
    """Processes FHIR search parameters and builds database queries"""
    
    def __init__(self, resource_type: str, db: Session):
        self.resource_type = resource_type
        self.db = db
        self.resource_config = RESOURCE_MAPPINGS.get(resource_type)
        if not self.resource_config:
            raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
        self.model = self.resource_config["model"]
    
    def build_query(self, search_params: Dict[str, Any]):
        """Build SQLAlchemy query from FHIR search parameters"""
        query = self.db.query(self.model)
        
        # Handle include parameters for joins
        if "_include" in search_params:
            query = self._add_includes(query, search_params["_include"])
        
        # Process search parameters
        for param, value in search_params.items():
            if param.startswith("_"):
                query = self._handle_control_parameter(query, param, value)
            else:
                query = self._handle_search_parameter(query, param, value)
        
        return query
    
    def _add_includes(self, query, include_params):
        """Add JOIN clauses for _include parameters"""
        if isinstance(include_params, str):
            include_params = [include_params]
        
        for include in include_params:
            # Parse include: ResourceType:field or ResourceType:field:target
            parts = include.split(":")
            if len(parts) >= 2:
                source_type, field = parts[0], parts[1]
                
                if source_type == self.resource_type:
                    if field == "subject" and hasattr(self.model, "patient_id"):
                        query = query.options(joinedload(self.model.patient))
                    elif field == "encounter" and hasattr(self.model, "encounter_id"):
                        query = query.options(joinedload(self.model.encounter))
                    elif field == "performer" and hasattr(self.model, "provider_id"):
                        query = query.options(joinedload(self.model.provider))
        
        return query
    
    def _handle_control_parameter(self, query, param, value):
        """Handle FHIR control parameters like _count, _sort, etc."""
        if param == "_count":
            # Handled separately in the endpoint
            pass
        elif param == "_sort":
            query = self._apply_sort(query, value)
        elif param == "_lastUpdated":
            query = self._apply_last_updated_filter(query, value)
        elif param == "_id":
            if isinstance(value, list):
                query = query.filter(self.model.id.in_(value))
            else:
                query = query.filter(self.model.id == value)
        
        return query
    
    def _handle_search_parameter(self, query, param, value):
        """Handle resource-specific search parameters"""
        # Parse modifiers (e.g., name:exact, birthdate:ge)
        param_parts = param.split(":")
        base_param = param_parts[0]
        modifier = param_parts[1] if len(param_parts) > 1 else None
        
        # Check for chained parameters (e.g., subject.family)
        if "." in base_param:
            reference_param, chain_param = base_param.split(".", 1)
            # Handle chained queries by passing both the reference and chain parts
            base_param = reference_param
            value = f"{chain_param}.{value}"
        
        # Resource-specific parameter handling
        if self.resource_type == "Patient":
            query = self._handle_patient_params(query, base_param, value, modifier)
        elif self.resource_type == "Encounter":
            query = self._handle_encounter_params(query, base_param, value, modifier)
        elif self.resource_type == "Observation":
            query = self._handle_observation_params(query, base_param, value, modifier)
        elif self.resource_type == "Condition":
            query = self._handle_condition_params(query, base_param, value, modifier)
        elif self.resource_type == "MedicationRequest":
            query = self._handle_medication_params(query, base_param, value, modifier)
        elif self.resource_type == "Practitioner":
            query = self._handle_practitioner_params(query, base_param, value, modifier)
        elif self.resource_type == "Organization":
            query = self._handle_organization_params(query, base_param, value, modifier)
        elif self.resource_type == "Location":
            query = self._handle_location_params(query, base_param, value, modifier)
        
        return query
    
    def _handle_patient_params(self, query, param, value, modifier):
        """Handle Patient-specific search parameters"""
        if param == "family":
            query = self._apply_string_filter(query, Patient.last_name, value, modifier)
        elif param == "given":
            query = self._apply_string_filter(query, Patient.first_name, value, modifier)
        elif param == "name":
            # Search both first and last name
            query = query.filter(
                or_(
                    Patient.first_name.ilike(f"%{value}%"),
                    Patient.last_name.ilike(f"%{value}%")
                )
            )
        elif param == "birthdate":
            query = self._apply_date_filter(query, Patient.date_of_birth, value, modifier)
        elif param == "gender":
            # FHIR gender values should map to our M/F values
            if value.lower() == "male":
                query = query.filter(Patient.gender == "M")
            elif value.lower() == "female":
                query = query.filter(Patient.gender == "F")
            else:
                query = query.filter(Patient.gender == value)
        elif param == "identifier":
            query = query.filter(Patient.mrn == value)
        
        return query
    
    def _handle_encounter_params(self, query, param, value, modifier):
        """Handle Encounter-specific search parameters"""
        if param == "subject" or param == "patient":
            # Handle chained parameter: subject.family, subject.given, etc.
            if "." in value:
                chain_param, chain_value = value.split(".", 1)
                if chain_param in ["family", "given", "name"]:
                    query = query.join(Patient).filter(
                        Patient.last_name.ilike(f"%{chain_value}%") if chain_param == "family"
                        else Patient.first_name.ilike(f"%{chain_value}%") if chain_param == "given"
                        else or_(
                            Patient.first_name.ilike(f"%{chain_value}%"),
                            Patient.last_name.ilike(f"%{chain_value}%")
                        )
                    )
            else:
                # Handle FHIR reference format: Patient/123 or just 123
                patient_id = value.replace("Patient/", "") if value.startswith("Patient/") else value
                query = query.filter(Encounter.patient_id == patient_id)
        elif param == "status":
            query = query.filter(Encounter.status == value)
        elif param == "type":
            query = query.filter(Encounter.encounter_type.ilike(f"%{value}%"))
        elif param == "date" or param == "period":
            # Handle multiple date values (e.g., period=ge2024-01-01&period=le2024-12-31)
            if isinstance(value, list):
                for v in value:
                    query = self._apply_date_filter(query, Encounter.encounter_date, v, modifier)
            else:
                query = self._apply_date_filter(query, Encounter.encounter_date, value, modifier)
        
        return query
    
    def _handle_observation_params(self, query, param, value, modifier):
        """Handle Observation-specific search parameters"""
        if param == "subject" or param == "patient":
            if "." in value:
                # Chained parameter
                chain_param, chain_value = value.split(".", 1)
                query = query.join(Patient).filter(
                    Patient.last_name.ilike(f"%{chain_value}%") if chain_param == "family"
                    else Patient.first_name.ilike(f"%{chain_value}%")
                )
            else:
                # Handle FHIR reference format: Patient/123 or just 123
                patient_id = value.replace("Patient/", "") if value.startswith("Patient/") else value
                query = query.filter(Observation.patient_id == patient_id)
        elif param == "code":
            query = query.filter(Observation.loinc_code == value)
        elif param == "category":
            query = query.filter(Observation.observation_type == value)
        elif param == "value-quantity":
            # Handle quantity searches with units
            query = self._apply_quantity_filter(query, Observation.value_quantity, value, modifier)
        elif param == "effective":
            query = self._apply_date_filter(query, Observation.observation_date, value, modifier)
        
        return query
    
    def _handle_condition_params(self, query, param, value, modifier):
        """Handle Condition-specific search parameters"""
        if param == "subject" or param == "patient":
            if "." in value:
                chain_param, chain_value = value.split(".", 1)
                query = query.join(Patient).filter(
                    Patient.last_name.ilike(f"%{chain_value}%") if chain_param == "family"
                    else Patient.first_name.ilike(f"%{chain_value}%")
                )
            else:
                # Handle FHIR reference format: Patient/123 or just 123
                patient_id = value.replace("Patient/", "") if value.startswith("Patient/") else value
                query = query.filter(Condition.patient_id == patient_id)
        elif param == "code":
            query = query.filter(Condition.icd10_code == value)
        elif param == "clinical-status":
            query = query.filter(Condition.clinical_status == value)
        elif param == "onset-date":
            query = self._apply_date_filter(query, Condition.onset_date, value, modifier)
        
        return query
    
    def _handle_medication_params(self, query, param, value, modifier):
        """Handle MedicationRequest-specific search parameters"""
        if param == "subject" or param == "patient":
            if "." in value:
                chain_param, chain_value = value.split(".", 1)
                query = query.join(Patient).filter(
                    Patient.last_name.ilike(f"%{chain_value}%") if chain_param == "family"
                    else Patient.first_name.ilike(f"%{chain_value}%")
                )
            else:
                # Handle FHIR reference format: Patient/123 or just 123
                patient_id = value.replace("Patient/", "") if value.startswith("Patient/") else value
                query = query.filter(Medication.patient_id == patient_id)
        elif param == "medication":
            query = query.filter(Medication.medication_name.ilike(f"%{value}%"))
        elif param == "status":
            query = query.filter(Medication.status == value)
        elif param == "authored-on":
            query = self._apply_date_filter(query, Medication.start_date, value, modifier)
        
        return query
    
    def _handle_practitioner_params(self, query, param, value, modifier):
        """Handle Practitioner-specific search parameters"""
        if param == "name":
            query = query.filter(
                or_(
                    Provider.first_name.ilike(f"%{value}%"),
                    Provider.last_name.ilike(f"%{value}%")
                )
            )
        elif param == "family":
            if modifier == "exact":
                query = query.filter(Provider.last_name == value)
            else:
                query = query.filter(Provider.last_name.ilike(f"%{value}%"))
        elif param == "given":
            if modifier == "exact":
                query = query.filter(Provider.first_name == value)
            else:
                query = query.filter(Provider.first_name.ilike(f"%{value}%"))
        elif param == "active":
            query = query.filter(Provider.active == (value.lower() == "true"))
        elif param == "identifier":
            query = query.filter(or_(Provider.id == value, Provider.npi == value))
        
        return query
    
    def _handle_organization_params(self, query, param, value, modifier):
        """Handle Organization-specific search parameters"""
        if param == "name":
            if modifier == "exact":
                query = query.filter(Organization.name == value)
            else:
                query = query.filter(Organization.name.ilike(f"%{value}%"))
        elif param == "type":
            query = query.filter(Organization.type == value)
        elif param == "active":
            # Organization doesn't have active field, so return all if true
            if value.lower() != "true":
                query = query.filter(False)  # Return empty if searching for inactive
        elif param == "identifier":
            query = query.filter(Organization.id == value)
        
        return query
    
    def _handle_location_params(self, query, param, value, modifier):
        """Handle Location-specific search parameters"""
        if param == "name":
            if modifier == "exact":
                query = query.filter(Location.name == value)
            else:
                query = query.filter(Location.name.ilike(f"%{value}%"))
        elif param == "type":
            query = query.filter(Location.type == value)
        elif param == "status":
            # Location doesn't have status field, so return all if active
            if value.lower() != "active":
                query = query.filter(False)  # Return empty if not active
        elif param == "identifier":
            query = query.filter(Location.id == value)
        
        return query
    
    def _apply_date_filter(self, query, field, value, modifier):
        """Apply date filters with FHIR prefixes (ge, le, gt, lt, eq, ne) and modifiers"""
        if modifier in ["ge", "gt", "le", "lt", "eq", "ne", "above", "below", "missing"]:
            prefix = modifier
            date_value = value
        else:
            # Extract prefix from value (e.g., "ge2021-01-01")
            match = re.match(r"^(eq|ne|gt|ge|lt|le)(.+)$", value)
            if match:
                prefix, date_value = match.groups()
            else:
                prefix, date_value = "eq", value
        
        # Handle missing modifier
        if prefix == "missing":
            is_missing = value.lower() == "true"
            if is_missing:
                query = query.filter(field == None)
            else:
                query = query.filter(field != None)
            return query
        
        try:
            date_obj = datetime.fromisoformat(date_value.replace("Z", "+00:00")).date()
        except:
            try:
                date_obj = datetime.strptime(date_value, "%Y-%m-%d").date()
            except:
                # Invalid date - return empty results
                return query.filter(False)
        
        if prefix == "eq":
            query = query.filter(field == date_obj)
        elif prefix == "ne":
            query = query.filter(field != date_obj)
        elif prefix == "gt" or prefix == "above":
            # :above is same as gt for dates
            query = query.filter(field > date_obj)
        elif prefix == "ge":
            query = query.filter(field >= date_obj)
        elif prefix == "lt" or prefix == "below":
            # :below is same as lt for dates
            query = query.filter(field < date_obj)
        elif prefix == "le":
            query = query.filter(field <= date_obj)
        
        return query
    
    def _apply_quantity_filter(self, query, field, value, modifier):
        """Apply quantity filters for numeric values"""
        # Handle modifier-based filtering
        if modifier in ["above", "below", "missing"]:
            if modifier == "missing":
                is_missing = value.lower() == "true"
                if is_missing:
                    query = query.filter(field == None)
                else:
                    query = query.filter(field != None)
                return query
            else:
                # For above/below, extract the numeric value
                try:
                    numeric_value = float(value.split("||")[0])
                except:
                    return query
                
                if modifier == "above":
                    query = query.filter(field > numeric_value)
                elif modifier == "below":
                    query = query.filter(field < numeric_value)
                return query
        
        # Parse quantity value (e.g., "5.4||mg", "100", "gt5.4")
        match = re.match(r"^(eq|ne|gt|ge|lt|le)?([0-9.]+)(\|\|(.+))?$", value)
        if not match:
            return query
        
        prefix = match.group(1) or "eq"
        numeric_value = float(match.group(2))
        unit = match.group(4)
        
        # Filter out null values first
        query = query.filter(field.isnot(None))
        
        if prefix == "eq":
            query = query.filter(field == numeric_value)
        elif prefix == "ne":
            query = query.filter(field != numeric_value)
        elif prefix == "gt":
            query = query.filter(field > numeric_value)
        elif prefix == "ge":
            query = query.filter(field >= numeric_value)
        elif prefix == "lt":
            query = query.filter(field < numeric_value)
        elif prefix == "le":
            query = query.filter(field <= numeric_value)
        
        return query
    
    def _apply_sort(self, query, sort_value):
        """Apply sorting to query"""
        if isinstance(sort_value, str):
            sort_params = [sort_value]
        else:
            sort_params = sort_value
        
        for sort_param in sort_params:
            if sort_param.startswith("-"):
                # Descending
                field_name = sort_param[1:]
                desc = True
            else:
                # Ascending
                field_name = sort_param
                desc = False
            
            # Handle special field mappings
            if field_name == "birthdate" and self.resource_type == "Patient":
                field = Patient.date_of_birth
            elif hasattr(self.model, field_name):
                field = getattr(self.model, field_name)
            else:
                continue
                
            query = query.order_by(field.desc() if desc else field.asc())
        
        return query
    
    def _apply_string_filter(self, query, field, value, modifier):
        """Apply string filters with modifiers"""
        if modifier == "exact":
            query = query.filter(field == value)
        elif modifier == "contains":
            query = query.filter(field.contains(value))
        elif modifier == "missing":
            is_missing = value.lower() == "true"
            if is_missing:
                query = query.filter(or_(field == None, field == ""))
            else:
                query = query.filter(and_(field != None, field != ""))
        elif modifier == "text":
            # :text modifier searches across all text fields (simplified implementation)
            query = query.filter(field.ilike(f"%{value}%"))
        else:
            # Default contains behavior
            query = query.filter(field.ilike(f"%{value}%"))
        
        return query

# Conversion functions are now imported from converters.py

# Capability Statement - must be before generic routes
@router.get("/metadata")
async def get_capability_statement():
    """FHIR Capability Statement"""
    return {
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": datetime.now().isoformat(),
        "publisher": "Teaching EMR System",
        "kind": "instance",
        "software": {
            "name": "Teaching EMR FHIR Server",
            "version": "1.0.0"
        },
        "implementation": {
            "description": "Teaching EMR FHIR R4 Implementation"
        },
        "fhirVersion": "4.0.1",
        "format": ["json"],
        "rest": [
            {
                "mode": "server",
                "resource": [
                    {
                        "type": resource_type,
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"}
                        ],
                        "searchParam": [
                            {"name": param, "type": "string"}
                            for param in RESOURCE_MAPPINGS[resource_type]["search_params"]
                        ]
                    }
                    for resource_type in RESOURCE_MAPPINGS.keys()
                ]
            }
        ]
    }

# Bulk Export endpoints
@router.get("/$export")
async def bulk_export_all(
    background_tasks: BackgroundTasks,
    _type: Optional[str] = Query(None),
    _since: Optional[str] = Query(None),
    _outputFormat: str = Query("application/fhir+ndjson"),
    db: Session = Depends(get_db)
):
    """Bulk export all data"""
    
    if _outputFormat not in ["application/fhir+ndjson", "application/ndjson"]:
        raise HTTPException(status_code=400, detail="Unsupported output format")
    
    # Use the BulkExportRouter to handle the export
    export_id = await BulkExportRouter.initiate_export(
        export_type="system",
        db=db,
        type_filter=_type,
        since=_since
    )
    
    return Response(
        status_code=202,
        headers={
            "Content-Location": f"/fhir/R4/$export-status/{export_id}",
            "X-Progress": "Accepted for processing"
        }
    )

@router.get("/Patient/$export")
async def bulk_export_patients(
    background_tasks: BackgroundTasks,
    _type: Optional[str] = Query(None),
    _since: Optional[str] = Query(None),
    _outputFormat: str = Query("application/fhir+ndjson"),
    db: Session = Depends(get_db)
):
    """Bulk export all patient data"""
    
    # Get all patient IDs for patient compartment export
    patient_ids = [p.id for p in db.query(Patient.id).all()]
    
    export_id = await BulkExportRouter.initiate_export(
        export_type="patient",
        db=db,
        type_filter=_type,
        since=_since,
        patient_ids=patient_ids
    )
    
    return Response(
        status_code=202,
        headers={
            "Content-Location": f"/fhir/R4/$export-status/{export_id}",
            "X-Progress": "Accepted for processing"
        }
    )

# Export status endpoint
@router.get("/$export-status/{export_id}")
async def get_export_status(export_id: str, db: Session = Depends(get_db)):
    """Get the status of a bulk export job"""
    
    result = BulkExportRouter.get_export_status(export_id, db)
    if not result:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    status_code, response = result
    
    if status_code == 202:
        return Response(
            status_code=202,
            headers={"X-Progress": "In progress"},
            content=json.dumps(response)
        )
    else:
        return response

# Export file download endpoint
@router.get("/$export-download/{export_id}/{filename}")
async def download_export_file(
    export_id: str,
    filename: str
):
    """Download a bulk export file"""
    
    file_stream = await BulkExportRouter.get_export_file(export_id, filename)
    if not file_stream:
        raise HTTPException(status_code=404, detail="Export file not found")
    
    return StreamingResponse(
        file_stream,
        media_type="application/gzip" if filename.endswith(".gz") else "application/ndjson",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# Cancel export endpoint
@router.delete("/$export-status/{export_id}")
async def cancel_export(export_id: str, db: Session = Depends(get_db)):
    """Cancel a bulk export job"""
    
    result = BulkExportRouter.cancel_export(export_id, db)
    if not result:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    return Response(status_code=204)

# Batch and Transaction endpoint
@router.post("/")
async def batch_transaction(bundle: dict, db: Session = Depends(get_db)):
    """Handle FHIR batch and transaction bundles"""
    processor = BatchProcessor(db)
    return processor.process_bundle(bundle)

# Generic resource endpoints - must be after specific endpoints

@router.get("/{resource_type}")
async def search_resources(
    resource_type: str,
    request: Request,
    db: Session = Depends(get_db),
    _count: int = Query(50, le=1000),
    _offset: int = Query(0),
    _total: str = Query("accurate"),
    _include: Optional[List[str]] = Query(None),
    _revinclude: Optional[List[str]] = Query(None)
):
    """Generic FHIR search endpoint supporting all resource types"""
    
    if resource_type not in RESOURCE_MAPPINGS:
        raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
    
    # Parse query parameters - handle multiple values
    search_params = {}
    for key in request.query_params.keys():
        values = request.query_params.getlist(key)
        if len(values) == 1:
            search_params[key] = values[0]
        else:
            search_params[key] = values
    
    # Build and execute query
    processor = FHIRSearchProcessor(resource_type, db)
    query = processor.build_query(search_params)
    
    # Apply pagination
    total_count = query.count() if _total == "accurate" else None
    resources = query.offset(_offset).limit(_count).all()
    
    # Add pagination links if needed
    next_url = None
    if total_count and total_count > _offset + _count:
        next_offset = _offset + _count
        next_url = str(request.url.include_query_params(_offset=next_offset))
    
    # Convert to FHIR format
    converter_map = {
        "Patient": patient_to_fhir,
        "Encounter": encounter_to_fhir,
        "Observation": observation_to_fhir,
        "Condition": condition_to_fhir,
        "MedicationRequest": medication_request_to_fhir,
        "Practitioner": practitioner_to_fhir,
        "Organization": organization_to_fhir,
        "Location": location_to_fhir
    }
    
    converter = converter_map.get(resource_type)
    if not converter:
        raise HTTPException(status_code=500, detail=f"No converter for {resource_type}")
    
    # Create FHIR Bundle
    bundle = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": total_count,
        "link": [
            {
                "relation": "self",
                "url": str(request.url)
            }
        ],
        "entry": []
    }
    
    for resource in resources:
        entry = {
            "resource": converter(resource),
            "fullUrl": f"{resource_type}/{resource.id}",
            "search": {
                "mode": "match"
            }
        }
        bundle["entry"].append(entry)
    
    # Add pagination links if needed
    if next_url:
        bundle["link"].append({
            "relation": "next",
            "url": next_url
        })
    
    # Handle _include and _revinclude
    if _include:
        bundle["entry"].extend(await _process_includes(resources, _include, db, request.base_url))
    
    if _revinclude:
        bundle["entry"].extend(await _process_revincludes(resources, _revinclude, db, request.base_url))
    
    return bundle

# Individual resource endpoints
@router.get("/{resource_type}/{resource_id}")
async def get_resource(
    resource_type: str,
    resource_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific resource by ID"""
    
    if resource_type not in RESOURCE_MAPPINGS:
        raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
    
    model = RESOURCE_MAPPINGS[resource_type]["model"]
    resource = db.query(model).filter(model.id == resource_id).first()
    
    if not resource:
        raise HTTPException(status_code=404, detail=f"{resource_type} not found")
    
    # Convert to FHIR format
    converter_map = {
        "Patient": patient_to_fhir,
        "Encounter": encounter_to_fhir,
        "Observation": observation_to_fhir,
        "Condition": condition_to_fhir,
        "MedicationRequest": medication_request_to_fhir,
        "Practitioner": practitioner_to_fhir,
        "Organization": organization_to_fhir,
        "Location": location_to_fhir
    }
    
    converter = converter_map.get(resource_type)
    if not converter:
        raise HTTPException(status_code=500, detail=f"No converter for {resource_type}")
    
    return converter(resource)

@router.put("/{resource_type}/{resource_id}")
async def update_resource(
    resource_type: str,
    resource_id: str,
    resource_data: dict,
    db: Session = Depends(get_db)
):
    """Update or create a specific resource"""
    
    if resource_type not in RESOURCE_MAPPINGS:
        raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
    
    # Use batch processor to handle the update
    processor = BatchProcessor(db)
    entry = {
        "resource": resource_data,
        "request": {
            "method": "PUT",
            "url": f"{resource_type}/{resource_id}"
        }
    }
    
    from .batch_transaction import BatchEntry
    batch_entry = BatchEntry(entry)
    result = processor._handle_update(batch_entry)
    
    # Commit the transaction
    db.commit()
    
    # Return the updated resource
    if "resource" in result:
        return result["resource"]
    else:
        raise HTTPException(status_code=500, detail="Failed to update resource")

@router.get("/Patient/{patient_id}/$export")
async def bulk_export_patient(
    patient_id: str,
    background_tasks: BackgroundTasks,
    _type: Optional[str] = Query(None),
    _since: Optional[str] = Query(None),
    _outputFormat: str = Query("application/fhir+ndjson"),
    db: Session = Depends(get_db)
):
    """Bulk export data for a specific patient"""
    
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    export_id = await BulkExportRouter.initiate_export(
        export_type="patient",
        db=db,
        type_filter=_type,
        since=_since,
        patient_ids=[patient_id]
    )
    
    return Response(
        status_code=202,
        headers={
            "Content-Location": f"/fhir/R4/$export-status/{export_id}",
            "X-Progress": "Accepted for processing"
        }
    )

# Helper functions
async def _process_includes(resources, include_params, db, base_url):
    """Process _include parameters"""
    include_entries = []
    
    for include in include_params:
        parts = include.split(":")
        if len(parts) >= 2:
            source_type, field = parts[0], parts[1]
            
            # Get related resources based on include parameter
            if field == "subject":
                patient_ids = [r.patient_id for r in resources if hasattr(r, 'patient_id') and r.patient_id]
                patients = db.query(Patient).filter(Patient.id.in_(patient_ids)).all()
                for patient in patients:
                    include_entries.append({
                        "resource": patient_to_fhir(patient),
                        "fullUrl": f"Patient/{patient.id}",
                        "search": {"mode": "include"}
                    })
    
    return include_entries

async def _process_revincludes(resources, revinclude_params, db, base_url):
    """Process _revinclude parameters"""
    revinclude_entries = []
    seen_resources = set()
    
    # Convert to list if single string
    if isinstance(revinclude_params, str):
        revinclude_params = [revinclude_params]
    
    for revinclude in revinclude_params:
        # Parse revinclude: ResourceType:field or ResourceType:field:target
        parts = revinclude.split(":")
        if len(parts) >= 2:
            source_type, field = parts[0], parts[1]
            
            # Get IDs of current resources
            resource_ids = [str(r.id) for r in resources]
            
            # Find resources that reference the current ones
            if source_type == "Observation" and field in ["subject", "patient"]:
                # Find observations that reference these patients
                observations = db.query(Observation).filter(
                    Observation.patient_id.in_(resource_ids)
                ).all()
                for obs in observations:
                    resource_key = f"Observation/{obs.id}"
                    if resource_key not in seen_resources:
                        seen_resources.add(resource_key)
                        revinclude_entries.append({
                            "resource": observation_to_fhir(obs),
                            "fullUrl": resource_key,
                            "search": {"mode": "include"}
                        })
                        
            elif source_type == "Encounter" and field in ["subject", "patient"]:
                # Find encounters that reference these patients
                encounters = db.query(Encounter).filter(
                    Encounter.patient_id.in_(resource_ids)
                ).all()
                for enc in encounters:
                    resource_key = f"Encounter/{enc.id}"
                    if resource_key not in seen_resources:
                        seen_resources.add(resource_key)
                        revinclude_entries.append({
                            "resource": encounter_to_fhir(enc),
                            "fullUrl": resource_key,
                            "search": {"mode": "include"}
                        })
                        
            elif source_type == "Condition" and field in ["subject", "patient"]:
                # Find conditions that reference these patients
                conditions = db.query(Condition).filter(
                    Condition.patient_id.in_(resource_ids)
                ).all()
                for cond in conditions:
                    resource_key = f"Condition/{cond.id}"
                    if resource_key not in seen_resources:
                        seen_resources.add(resource_key)
                        revinclude_entries.append({
                            "resource": condition_to_fhir(cond),
                            "fullUrl": resource_key,
                            "search": {"mode": "include"}
                        })
                        
            elif source_type == "MedicationRequest" and field in ["subject", "patient"]:
                # Find medications that reference these patients
                medications = db.query(Medication).filter(
                    Medication.patient_id.in_(resource_ids)
                ).all()
                for med in medications:
                    resource_key = f"MedicationRequest/{med.id}"
                    if resource_key not in seen_resources:
                        seen_resources.add(resource_key)
                        revinclude_entries.append({
                            "resource": medication_request_to_fhir(med),
                            "fullUrl": resource_key,
                            "search": {"mode": "include"}
                        })
                        
            elif source_type == "Observation" and field == "encounter":
                # Find observations that reference these encounters
                observations = db.query(Observation).filter(
                    Observation.encounter_id.in_(resource_ids)
                ).all()
                for obs in observations:
                    resource_key = f"Observation/{obs.id}"
                    if resource_key not in seen_resources:
                        seen_resources.add(resource_key)
                        revinclude_entries.append({
                            "resource": observation_to_fhir(obs),
                            "fullUrl": resource_key,
                            "search": {"mode": "include"}
                        })
    
    return revinclude_entries

# The _process_bulk_export function is no longer needed as we're using BulkExportRouter
