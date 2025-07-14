"""
Comprehensive FHIR R4 API Router
Implements FHIR R4 standard with chained queries, complex queries, and bulk operations
Reference: HAPI FHIR Server specifications
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, func, text
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from urllib.parse import unquote, parse_qs
import json
import uuid
import re
import io
from enum import Enum

from database import get_db_session as get_db
from database import get_db_session
from models.synthea_models import Patient, Encounter, Organization, Location, Observation, Provider, Device, DiagnosticReport, ImagingStudy, DocumentReference, Coverage
from models.clinical.appointments import Appointment, AppointmentParticipant
from models.clinical.orders import MedicationOrder as MedicationRequest
from models.fhir_extended_models import Medication, MedicationAdministration, CareTeam, PractitionerRole, Claim, ExplanationOfBenefit, SupplyDelivery, Provenance
from models.fhir_resource import FHIRResource, Condition, AllergyIntolerance, Immunization, Procedure, CarePlan
from .schemas import *
from .bulk_export import BulkExportRouter
from .batch_transaction import BatchProcessor
from .converters import (
    patient_to_fhir, encounter_to_fhir, observation_to_fhir,
    condition_to_fhir, medication_request_to_fhir, practitioner_to_fhir,
    organization_to_fhir, location_to_fhir, allergy_intolerance_to_fhir,
    immunization_to_fhir, procedure_to_fhir, care_plan_to_fhir,
    device_to_fhir, diagnostic_report_to_fhir, imaging_study_to_fhir,
    appointment_to_fhir, document_reference_to_fhir, medication_to_fhir,
    medication_administration_to_fhir, care_team_to_fhir, practitioner_role_to_fhir,
    coverage_to_fhir, claim_to_fhir, explanation_of_benefit_to_fhir,
    supply_delivery_to_fhir, provenance_to_fhir, service_request_to_fhir
)
from .query_builder import FHIRQueryBuilder
from .optimized_queries import get_optimized_queries
from api.services.audit_service import AuditService
from emr_api.auth import get_current_user
from core.fhir.operations import OperationHandler
from core.fhir.storage import FHIRStorageEngine
from core.fhir.validator import FHIRValidator

router = APIRouter(prefix="/R4", tags=["FHIR R4"])

# Performance-optimized endpoints
@router.get("/Patient/{patient_id}/$bundle-optimized")
async def get_patient_bundle_optimized(
    patient_id: str,
    resource_types: Optional[str] = Query(None, description="Comma-separated list of resource types"),
    limit: int = Query(100, description="Limit per resource type"),
    priority: str = Query("all", description="Priority level: critical, important, all"),
    db: Session = Depends(get_db)
):
    """
    Optimized patient bundle endpoint for better performance
    Returns all resources for a patient with efficient querying
    """
    try:
        queries = get_optimized_queries(db)
        
        # Define resource types based on priority
        if priority == "critical":
            default_types = ["Encounter", "Condition", "MedicationRequest", "AllergyIntolerance"]
        elif priority == "important":
            default_types = ["Encounter", "Condition", "MedicationRequest", "AllergyIntolerance", 
                           "Observation", "Procedure", "DiagnosticReport"]
        else:
            default_types = ["Encounter", "Condition", "MedicationRequest", "AllergyIntolerance",
                           "Observation", "Procedure", "DiagnosticReport", "DocumentReference",
                           "ImagingStudy", "Immunization", "CarePlan", "CareTeam"]
        
        if resource_types:
            requested_types = [t.strip() for t in resource_types.split(",")]
        else:
            requested_types = default_types
        
        bundle = queries.get_patient_bundle_optimized(
            patient_id=patient_id,
            resource_types=requested_types,
            limit_per_type=limit,
            include_counts=True
        )
        
        # Format as FHIR Bundle
        return {
            "resourceType": "Bundle",
            "id": f"patient-bundle-{patient_id}",
            "type": "collection",
            "timestamp": datetime.utcnow().isoformat(),
            "total": sum(bundle.get("counts", {}).values()),
            "link": [
                {
                    "relation": "self",
                    "url": f"/fhir/R4/Patient/{patient_id}/$bundle-optimized"
                }
            ],
            "entry": bundle["bundle"],
            "meta": {
                "counts": bundle.get("counts", {}),
                "performance": "optimized"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating patient bundle: {str(e)}")

@router.get("/Patient/{patient_id}/$timeline")
async def get_patient_timeline(
    patient_id: str,
    days: int = Query(365, description="Number of days to look back"),
    limit: int = Query(100, description="Maximum number of events"),
    resource_types: Optional[str] = Query(None, description="Comma-separated list of resource types"),
    db: Session = Depends(get_db)
):
    """
    Optimized timeline endpoint for better performance
    """
    try:
        queries = get_optimized_queries(db)
        
        if resource_types:
            requested_types = [t.strip() for t in resource_types.split(",")]
        else:
            requested_types = None
        
        events = queries.get_timeline_events(
            patient_id=patient_id,
            resource_types=requested_types,
            days=days,
            limit=limit
        )
        
        return {
            "resourceType": "Bundle",
            "id": f"timeline-{patient_id}",
            "type": "collection",
            "timestamp": datetime.utcnow().isoformat(),
            "total": len(events),
            "entry": [{"resource": event} for event in events]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating timeline: {str(e)}")

@router.get("/Patient/{patient_id}/$summary")
async def get_patient_summary(
    patient_id: str,
    db: Session = Depends(get_db)
):
    """
    Optimized patient summary with counts
    """
    try:
        queries = get_optimized_queries(db)
        
        counts = queries.get_patient_summary_counts(patient_id)
        
        return {
            "resourceType": "Parameters",
            "id": f"summary-{patient_id}",
            "parameter": [
                {
                    "name": "counts",
                    "part": [
                        {
                            "name": resource_type,
                            "valueInteger": data["total"]
                        } for resource_type, data in counts.items()
                    ]
                },
                {
                    "name": "activeCounts", 
                    "part": [
                        {
                            "name": resource_type,
                            "valueInteger": data["active"]
                        } for resource_type, data in counts.items() if data["active"] > 0
                    ]
                }
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating summary: {str(e)}")

@router.get("/Patient/{patient_id}/test-everything")
async def patient_everything(
    patient_id: str,
    db: Session = Depends(get_db)
):
    """
    Patient/$everything operation - return all resources related to the patient.
    
    This operation returns a Bundle containing:
    - The Patient resource itself
    - All resources that reference the patient (Observations, Conditions, etc.)
    - Resources referenced by the patient
    """
    try:
        # Debug: Show all patients
        all_patients = db.query(FHIRResource).filter(FHIRResource.resource_type == "Patient").all()
        patient_ids = [p.fhir_id for p in all_patients]
        
        # Get patient from FHIR resources table
        patient_result = db.query(FHIRResource).filter(
            FHIRResource.resource_type == "Patient",
            FHIRResource.fhir_id == patient_id
        ).first()
        
        if not patient_result:
            raise HTTPException(status_code=404, detail=f"Patient/{patient_id} not found. Available: {patient_ids}")
        
        # Create the bundle with the patient resource
        bundle_entries = []
        
        # Add the patient resource itself
        bundle_entries.append({
            "fullUrl": f"Patient/{patient_id}",
            "resource": patient_result.data
        })
        
        # Get all resources that reference this patient
        patient_reference_patterns = [
            f"Patient/{patient_id}",
            f"urn:uuid:{patient_id}"
        ]
        
        # Search for resources that reference this patient
        for resource_type in ["Observation", "Condition", "MedicationRequest", "Encounter", 
                             "AllergyIntolerance", "Immunization", "Procedure", "CarePlan"]:
            # Query resources that reference this patient
            related_resources = db.query(FHIRResource).filter(
                FHIRResource.resource_type == resource_type,
                or_(
                    func.jsonb_extract_path_text(FHIRResource.data, "subject", "reference").in_(patient_reference_patterns),
                    func.jsonb_extract_path_text(FHIRResource.data, "patient", "reference").in_(patient_reference_patterns)
                )
            ).all()
            
            for resource in related_resources:
                bundle_entries.append({
                    "fullUrl": f"{resource_type}/{resource.fhir_id}",
                    "resource": resource.data
                })
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving patient data: {str(e)}")

# FHIR Resource Type Mappings
RESOURCE_MAPPINGS = {
    "AuditEvent": {
        "model": None,  # Special handling for AuditEvent
        "search_params": [
            "date", "agent", "entity", "type", "action", "outcome",
            "patient", "entity-type", "entity-role", "_id", "_lastUpdated"
        ]
    },
    "Patient": {
        "model": Patient,
        "search_params": [
            "identifier", "name", "family", "given", "birthdate", "gender", 
            "address", "address-city", "address-state", "address-postalcode",
            "telecom", "active", "deceased", "_id", "_lastUpdated"
        ]
    },
    "Encounter": {
        "model": Encounter,
        "search_params": [
            "identifier", "status", "class", "type", "subject", "participant",
            "period", "date", "reason-code", "reason-reference", "location", 
            "service-provider", "_id", "_lastUpdated"
        ]
    },
    "Observation": {
        "model": Observation,
        "search_params": [
            "identifier", "status", "category", "code", "subject", "patient", "encounter",
            "date", "effective", "performer", "value-quantity", "value-string", 
            "value-concept", "component-code", "component-value-quantity", "_id", "_lastUpdated"
        ]
    },
    "Condition": {
        "model": Condition,
        "search_params": [
            "identifier", "clinical-status", "verification-status", "category", "severity",
            "code", "subject", "patient", "encounter", "onset-date", "onset-age", 
            "recorded-date", "abatement-date", "_id", "_lastUpdated"
        ]
    },
    "MedicationRequest": {
        "model": MedicationRequest,
        "search_params": [
            "identifier", "status", "intent", "category", "medication", "code", 
            "subject", "patient", "encounter", "authored-on", "requester", "_id", "_lastUpdated"
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
    },
    "AllergyIntolerance": {
        "model": AllergyIntolerance,
        "search_params": [
            "identifier", "clinical-status", "verification-status", "type", "category",
            "criticality", "code", "patient", "encounter", "onset", "date",
            "recorder", "asserter", "_id", "_lastUpdated"
        ]
    },
    "Immunization": {
        "model": Immunization,
        "search_params": [
            "identifier", "status", "vaccine-code", "patient", "date", "lot-number",
            "manufacturer", "performer", "reaction", "reaction-date", "reason-code",
            "reason-reference", "_id", "_lastUpdated"
        ]
    },
    "Procedure": {
        "model": Procedure,
        "search_params": [
            "identifier", "status", "category", "code", "subject", "patient",
            "encounter", "date", "performer", "reason-code", "reason-reference",
            "body-site", "outcome", "_id", "_lastUpdated"
        ]
    },
    "CarePlan": {
        "model": CarePlan,
        "search_params": [
            "identifier", "status", "intent", "category", "subject", "patient",
            "encounter", "date", "period", "addresses", "goal", "activity-code",
            "_id", "_lastUpdated"
        ]
    },
    "Device": {
        "model": Device,
        "search_params": [
            "identifier", "status", "type", "manufacturer", "model", "patient",
            "organization", "udi-carrier", "udi-di", "device-name", "_id", "_lastUpdated"
        ]
    },
    "DiagnosticReport": {
        "model": DiagnosticReport,
        "search_params": [
            "identifier", "status", "category", "code", "subject", "patient",
            "encounter", "date", "issued", "performer", "result", "_id", "_lastUpdated"
        ]
    },
    "ImagingStudy": {
        "model": ImagingStudy,
        "search_params": [
            "identifier", "status", "subject", "patient", "started", "modality",
            "body-site", "instance", "series", "dicom-class", "_id", "_lastUpdated"
        ]
    },
    "Appointment": {
        "model": Appointment,
        "search_params": [
            "identifier", "status", "service-category", "service-type", "specialty",
            "appointment-type", "reason-code", "reason-reference", "priority",
            "date", "start", "end", "participant", "participant-status", "patient",
            "practitioner", "location", "based-on", "_id", "_lastUpdated"
        ]
    },
    "DocumentReference": {
        "model": DocumentReference,
        "search_params": [
            "identifier", "status", "type", "category", "subject", "patient",
            "encounter", "date", "author", "authenticator", "custodian",
            "format", "description", "security-label", "_id", "_lastUpdated"
        ]
    },
    "Medication": {
        "model": Medication,
        "search_params": [
            "identifier", "code", "status", "manufacturer", "form",
            "ingredient", "ingredient-code", "batch-number", "_id", "_lastUpdated"
        ]
    },
    "MedicationAdministration": {
        "model": MedicationAdministration,
        "search_params": [
            "identifier", "status", "patient", "subject", "context", "encounter",
            "effective-time", "code", "medication", "performer", "request",
            "device", "reason-given", "reason-not-given", "_id", "_lastUpdated"
        ]
    },
    "CareTeam": {
        "model": CareTeam,
        "search_params": [
            "identifier", "patient", "subject", "encounter", "status",
            "category", "participant", "date", "_id", "_lastUpdated"
        ]
    },
    "PractitionerRole": {
        "model": PractitionerRole,
        "search_params": [
            "identifier", "practitioner", "organization", "role", "specialty",
            "location", "service", "active", "date", "telecom", "_id", "_lastUpdated"
        ]
    },
    "Coverage": {
        "model": Coverage,
        "search_params": [
            "identifier", "status", "type", "policy-holder", "subscriber",
            "beneficiary", "patient", "dependent", "relationship", "payor",
            "class-type", "class-value", "network", "_id", "_lastUpdated"
        ]
    },
    "Claim": {
        "model": Claim,
        "search_params": [
            "identifier", "status", "use", "patient", "insurer", "provider",
            "priority", "payee", "care-team", "encounter", "facility",
            "item-encounter", "created", "_id", "_lastUpdated"
        ]
    },
    "ExplanationOfBenefit": {
        "model": ExplanationOfBenefit,
        "search_params": [
            "identifier", "status", "type", "patient", "claim", "provider",
            "created", "encounter", "payee", "care-team", "coverage",
            "insurer", "disposition", "_id", "_lastUpdated"
        ]
    },
    "SupplyDelivery": {
        "model": SupplyDelivery,
        "search_params": [
            "identifier", "patient", "receiver", "status", "supplier",
            "type", "_id", "_lastUpdated"
        ]
    },
    "Provenance": {
        "model": Provenance,
        "search_params": [
            "target", "patient", "location", "agent", "agent-type", "agent-role",
            "recorded", "activity", "signature", "_id", "_lastUpdated"
        ]
    },
    "ServiceRequest": {
        "model": ServiceRequest,
        "search_params": [
            "identifier", "status", "intent", "category", "priority", "code",
            "subject", "patient", "encounter", "requester", "performer", 
            "authored", "occurrence", "requisition", "instantiates-canonical",
            "based-on", "replaces", "_id", "_lastUpdated"
        ]
    },
    "Task": {
        "model": FHIRResource,  # Stored as JSONB
        "search_params": [
            "identifier", "status", "intent", "priority", "code", "subject",
            "patient", "encounter", "requester", "owner", "performer",
            "focus", "for", "part-of", "authored-on", "period", 
            "business-status", "group-identifier", "_id", "_lastUpdated"
        ]
    },
    "MedicationDispense": {
        "model": FHIRResource,  # Stored as JSONB
        "search_params": [
            "identifier", "status", "patient", "subject", "context", "encounter",
            "medication", "code", "performer", "receiver", "destination",
            "responsibleparty", "prescription", "type", "whenhandedover",
            "whenprepared", "_id", "_lastUpdated"
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
    
    def _validate_search_parameters(self, params: Dict[str, Any]) -> None:
        """Validate search parameters against allowed list"""
        allowed_params = set(self.resource_config["search_params"])
        # Add common control parameters
        allowed_params.update(['_count', '_offset', '_sort', '_include', 
                              '_revinclude', '_summary', '_total', '_format'])
        
        errors = []
        for param in params:
            # Skip pagination parameters that are handled separately
            if param in ['_count', '_offset', '_total', '_include', '_revinclude']:
                continue
                
            # Extract base parameter name (remove modifiers and chains)
            base_param = param.split(':')[0].split('.')[0]
            
            # Check if parameter is allowed
            if base_param not in allowed_params and not base_param.startswith('_'):
                errors.append(f"Unknown search parameter '{base_param}' for resource type {self.resource_type}")
        
        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "resourceType": "OperationOutcome",
                    "issue": [{
                        "severity": "error",
                        "code": "invalid",
                        "diagnostics": error,
                        "expression": [f"{self.resource_type}.search"]
                    } for error in errors]
                }
            )
    
    def build_query(self, search_params: Dict[str, Any]):
        """Build SQLAlchemy query from FHIR search parameters"""
        # Validate parameters first
        self._validate_search_parameters(search_params)
        
        # Check if this is a JSONB-stored resource
        if issubclass(self.model, FHIRResource):
            # Use JSONB query builder for resources stored as JSONB
            query_builder = FHIRQueryBuilder(self.resource_type)
            query = query_builder.base_query(self.db)
            
            # Process search parameters
            for param, value in search_params.items():
                if param.startswith("_"):
                    query = self._handle_control_parameter(query, param, value)
                else:
                    # Use generic JSONB handling
                    query = self._handle_jsonb_search_parameter(query, param, value)
            
            return query
        else:
            # Use regular model-based query
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
    
    def _parse_search_value(self, value):
        """Parse search value that may contain comma-separated values for OR logic"""
        if isinstance(value, list):
            return value
        if ',' in value:
            return [v.strip() for v in value.split(',')]
        return [value]
    
    def _parse_token_value(self, value: str) -> tuple[Optional[str], str]:
        """Parse token value that may contain system|code format"""
        if '|' in value:
            parts = value.split('|', 1)
            return parts[0] if parts[0] else None, parts[1]
        return None, value
    
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
            # Support comma-separated IDs
            ids = self._parse_search_value(value)
            if issubclass(self.model, FHIRResource):
                # For JSONB resources, use fhir_id
                if len(ids) > 1:
                    query = query.filter(FHIRResource.fhir_id.in_(ids))
                else:
                    query = query.filter(FHIRResource.fhir_id == ids[0])
            else:
                # For regular models, use id
                if len(ids) > 1:
                    query = query.filter(self.model.id.in_(ids))
                else:
                    query = query.filter(self.model.id == ids[0])
        
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
        elif self.resource_type == "AllergyIntolerance":
            query = self._handle_allergy_params(query, base_param, value, modifier)
        elif self.resource_type == "Immunization":
            query = self._handle_immunization_params(query, base_param, value, modifier)
        elif self.resource_type == "Procedure":
            query = self._handle_procedure_params(query, base_param, value, modifier)
        elif self.resource_type == "CarePlan":
            query = self._handle_careplan_params(query, base_param, value, modifier)
        elif self.resource_type == "Device":
            query = self._handle_device_params(query, base_param, value, modifier)
        elif self.resource_type == "DiagnosticReport":
            query = self._handle_diagnostic_report_params(query, base_param, value, modifier)
        elif self.resource_type == "ImagingStudy":
            query = self._handle_imaging_study_params(query, base_param, value, modifier)
        elif self.resource_type == "Appointment":
            query = self._handle_appointment_params(query, base_param, value, modifier)
        
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
            # Token search - exact match
            query = query.filter(Patient.gender == value)
        elif param == "identifier":
            query = query.filter(Patient.mrn == value)
        elif param == "address":
            # Search across all address fields
            query = query.filter(
                or_(
                    Patient.address.ilike(f"%{value}%"),
                    Patient.city.ilike(f"%{value}%"),
                    Patient.state.ilike(f"%{value}%"),
                    Patient.zip_code.ilike(f"%{value}%")
                )
            )
        elif param == "telecom":
            # Search phone and email
            query = query.filter(
                or_(
                    Patient.phone.ilike(f"%{value}%"),
                    Patient.email.ilike(f"%{value}%")
                )
            )
        elif param == "address-city":
            query = self._apply_string_filter(query, Patient.city, value, modifier)
        elif param == "address-state":
            query = self._apply_string_filter(query, Patient.state, value, modifier)
        elif param == "address-postalcode":
            query = self._apply_string_filter(query, Patient.zip_code, value, modifier)
        elif param == "active":
            # Token search - exact match for boolean
            is_active = value == "true"
            query = query.filter(Patient.is_active == is_active)
        elif param == "deceased":
            # Handle deceased status - check if deceased_date is set
            if modifier == "missing":
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Patient.date_of_death.is_(None))
                else:
                    query = query.filter(Patient.date_of_death.isnot(None))
            else:
                # If value is "true", find deceased patients
                is_deceased = value == "true"
                if is_deceased:
                    query = query.filter(Patient.date_of_death.isnot(None))
                else:
                    query = query.filter(Patient.date_of_death.is_(None))
        
        return query
    
    def _handle_encounter_params(self, query, param, value, modifier):
        """Handle Encounter-specific search parameters"""
        if param == "subject" or param == "patient":
            # Check if this is a chained parameter (modifier contains Patient.xxx)
            if modifier and "Patient." in modifier:
                # Parse the chain: Patient.family, Patient.given, etc.
                _, chain_param = modifier.split(".", 1)
                if chain_param == "family":
                    query = query.join(Patient).filter(Patient.last_name.ilike(f"%{value}%"))
                elif chain_param == "given":
                    query = query.join(Patient).filter(Patient.first_name.ilike(f"%{value}%"))
                elif chain_param == "name":
                    query = query.join(Patient).filter(
                        or_(
                            Patient.first_name.ilike(f"%{value}%"),
                            Patient.last_name.ilike(f"%{value}%")
                        )
                    )
                elif chain_param == "gender":
                    query = query.join(Patient).filter(Patient.gender == value)
            else:
                # Handle FHIR reference format: Patient/123 or just 123
                patient_id = value.replace("Patient/", "") if value.startswith("Patient/") else value
                query = query.filter(Encounter.patient_id == patient_id)
        elif param == "status":
            # Token search - exact match
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
        elif param == "location":
            if modifier == "missing":
                # Handle :missing modifier
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Encounter.location_id.is_(None))
                else:
                    query = query.filter(Encounter.location_id.isnot(None))
            else:
                # Handle FHIR reference format: Location/123 or just 123
                location_id = value.replace("Location/", "") if value.startswith("Location/") else value
                query = query.filter(Encounter.location_id == location_id)
        elif param == "participant":
            if modifier == "missing":
                # Handle :missing modifier
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Encounter.provider_id.is_(None))
                else:
                    query = query.filter(Encounter.provider_id.isnot(None))
            else:
                # Handle FHIR reference format: Practitioner/123 or just 123
                provider_id = value.replace("Practitioner/", "") if value.startswith("Practitioner/") else value
                query = query.filter(Encounter.provider_id == provider_id)
        elif param == "class":
            # Token search - exact match
            query = query.filter(Encounter.encounter_class == value)
        elif param == "reason-code":
            # Search in chief complaint
            query = self._apply_string_filter(query, Encounter.chief_complaint, value, modifier)
        elif param == "service-provider":
            # Search by organization
            if modifier == "missing":
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Encounter.organization_id.is_(None))
                else:
                    query = query.filter(Encounter.organization_id.isnot(None))
            else:
                # Handle FHIR reference format: Organization/123 or just 123
                org_id = value.replace("Organization/", "") if value.startswith("Organization/") else value
                query = query.filter(Encounter.organization_id == org_id)
        
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
            # Support comma-separated LOINC codes with system|code format
            codes = self._parse_search_value(value)
            or_conditions = []
            
            for code in codes:
                system, code_value = self._parse_token_value(code)
                
                if system == "http://loinc.org" or not system:
                    # LOINC code search - exact match for tokens
                    or_conditions.append(Observation.loinc_code == code_value)
                
                # Support :text modifier for display text search
                if modifier == "text":
                    or_conditions.append(Observation.display.ilike(f"%{code_value}%"))
            
            if or_conditions:
                query = query.filter(or_(*or_conditions))
        elif param == "category":
            # Token search - exact match
            query = query.filter(Observation.observation_type == value)
        elif param == "value-quantity":
            # Handle quantity searches with units
            query = self._apply_quantity_filter(query, Observation.value_quantity, value, modifier)
        elif param == "effective" or param == "date":
            query = self._apply_date_filter(query, Observation.observation_date, value, modifier)
        elif param == "status":
            # Token search - exact match
            query = query.filter(Observation.status == value)
        elif param == "performer":
            # Handle performer reference
            if modifier == "missing":
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Observation.provider_id.is_(None))
                else:
                    query = query.filter(Observation.provider_id.isnot(None))
            else:
                # Handle FHIR reference format: Practitioner/123 or just 123
                provider_id = value.replace("Practitioner/", "") if value.startswith("Practitioner/") else value
                query = query.filter(Observation.provider_id == provider_id)
        elif param == "encounter":
            # Handle encounter reference
            if modifier == "missing":
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Observation.encounter_id.is_(None))
                else:
                    query = query.filter(Observation.encounter_id.isnot(None))
            else:
                # Handle FHIR reference format: Encounter/123 or just 123
                encounter_id = value.replace("Encounter/", "") if value.startswith("Encounter/") else value
                query = query.filter(Observation.encounter_id == encounter_id)
        elif param == "value-string":
            # Search string values
            query = self._apply_string_filter(query, Observation.value, value, modifier)
        elif param == "value-concept":
            # Search coded values
            query = self._apply_string_filter(query, Observation.value_code, value, modifier)
        
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
            # Support comma-separated values for OR logic
            codes = self._parse_search_value(value)
            or_conditions = []
            
            for code in codes:
                system, code_value = self._parse_token_value(code)
                
                if system == "http://snomed.info/sct":
                    # SNOMED code search
                    or_conditions.append(Condition.snomed_code == code_value)
                elif system == "http://hl7.org/fhir/sid/icd-10":
                    # ICD-10 code search
                    or_conditions.append(Condition.icd10_code == code_value)
                elif not system:
                    # No system specified, search all code fields and description
                    or_conditions.extend([
                        Condition.snomed_code == code_value,
                        Condition.icd10_code == code_value,
                        Condition.description.ilike(f"%{code_value}%")
                    ])
                
                # Support :text modifier for description search
                if modifier == "text":
                    or_conditions.append(Condition.description.ilike(f"%{code_value}%"))
            
            if or_conditions:
                query = query.filter(or_(*or_conditions))
        elif param == "clinical-status":
            # Token search - exact match
            query = query.filter(Condition.clinical_status == value)
        elif param == "verification-status":
            # Token search - exact match
            query = query.filter(Condition.verification_status == value)
        elif param == "severity":
            # Token search - exact match
            query = query.filter(Condition.severity == value)
        elif param == "onset-date":
            query = self._apply_date_filter(query, Condition.onset_date, value, modifier)
        elif param == "recorded-date":
            # Map to recorded_date field
            query = self._apply_date_filter(query, Condition.recorded_date, value, modifier)
        elif param == "abatement-date":
            query = self._apply_date_filter(query, Condition.abatement_date, value, modifier)
        elif param == "encounter":
            # Handle encounter reference
            if modifier == "missing":
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Condition.encounter_id.is_(None))
                else:
                    query = query.filter(Condition.encounter_id.isnot(None))
            else:
                # Handle FHIR reference format: Encounter/123 or just 123
                encounter_id = value.replace("Encounter/", "") if value.startswith("Encounter/") else value
                query = query.filter(Condition.encounter_id == encounter_id)
        
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
            # Token search - exact match
            query = query.filter(Medication.status == value)
        elif param == "authored-on":
            query = self._apply_date_filter(query, Medication.start_date, value, modifier)
        elif param == "requester":
            if modifier == "missing":
                # Handle :missing modifier
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Medication.prescriber_id.is_(None))
                else:
                    query = query.filter(Medication.prescriber_id.isnot(None))
            else:
                # Handle FHIR reference format: Practitioner/123 or just 123
                prescriber_id = value.replace("Practitioner/", "") if value.startswith("Practitioner/") else value
                query = query.filter(Medication.prescriber_id == prescriber_id)
        elif param == "code":
            # Search by RxNorm code with system|code support
            codes = self._parse_search_value(value)
            or_conditions = []
            
            for code in codes:
                system, code_value = self._parse_token_value(code)
                
                if system == "http://www.nlm.nih.gov/research/umls/rxnorm" or not system:
                    # RxNorm code search - exact match for tokens
                    or_conditions.append(Medication.rxnorm_code == code_value)
                
                # Support :text modifier for medication name search
                if modifier == "text":
                    or_conditions.append(Medication.medication_name.ilike(f"%{code_value}%"))
            
            if or_conditions:
                query = query.filter(or_(*or_conditions))
        elif param == "encounter":
            # Handle encounter reference
            if modifier == "missing":
                is_missing = value == "true"
                if is_missing:
                    query = query.filter(Medication.encounter_id.is_(None))
                else:
                    query = query.filter(Medication.encounter_id.isnot(None))
            else:
                # Handle FHIR reference format: Encounter/123 or just 123
                encounter_id = value.replace("Encounter/", "") if value.startswith("Encounter/") else value
                query = query.filter(Medication.encounter_id == encounter_id)
        elif param == "intent":
            # Intent is always "order" for prescriptions in our system
            if value == "order":
                # Return all results since all are orders
                pass
            else:
                # No results if searching for other intents
                query = query.filter(False)
        
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
            # Token search - exact match for boolean
            query = query.filter(Provider.active == (value == "true"))
        elif param == "identifier":
            query = query.filter(or_(Provider.id == value, Provider.npi == value))
        elif param == "qualification":
            # Search in specialty field
            query = query.filter(Provider.specialty.ilike(f"%{value}%"))
        
        return query
    
    def _handle_organization_params(self, query, param, value, modifier):
        """Handle Organization-specific search parameters"""
        if param == "name":
            if modifier == "exact":
                query = query.filter(Organization.name == value)
            else:
                query = query.filter(Organization.name.ilike(f"%{value}%"))
        elif param == "type":
            # Token search - exact match
            query = query.filter(Organization.type == value)
        elif param == "active":
            # Organization doesn't have active field, so return all if true
            if value != "true":
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
            # Token search - exact match
            query = query.filter(Location.type == value)
        elif param == "status":
            # Location doesn't have status field, so return all if active
            if value != "active":
                query = query.filter(False)  # Return empty if not active
        elif param == "identifier":
            query = query.filter(Location.id == value)
        
        return query
    
    def _handle_allergy_params(self, query, param, value, modifier):
        """Handle AllergyIntolerance-specific search parameters"""
        if param == "patient":
            query = query.filter(Allergy.patient_id == value)
        elif param == "clinical-status":
            # Token search - exact match
            query = query.filter(Allergy.clinical_status == value)
        elif param == "verification-status":
            # Token search - exact match
            query = query.filter(Allergy.verification_status == value)
        elif param == "type":
            # Token search - exact match
            query = query.filter(Allergy.allergy_type == value)
        elif param == "category":
            # Token search - exact match
            query = query.filter(Allergy.category == value)
        elif param == "criticality":
            # Token search - exact match
            query = query.filter(Allergy.severity == value)
        elif param == "code":
            # Token search - can search SNOMED code or description
            system, code = self._parse_token_value(value)
            if system and "snomed" in system.lower():
                query = query.filter(Allergy.snomed_code == code)
            else:
                # Search description if no system specified
                query = query.filter(
                    or_(
                        Allergy.snomed_code == value,
                        Allergy.description.ilike(f"%{value}%")
                    )
                )
        elif param == "encounter":
            if modifier == "missing":
                is_missing = value.lower() == "true"
                if is_missing:
                    query = query.filter(Allergy.encounter_id == None)
                else:
                    query = query.filter(Allergy.encounter_id != None)
            else:
                query = query.filter(Allergy.encounter_id == value)
        elif param == "onset":
            query = self._apply_date_filter(query, Allergy.onset_date, value, modifier)
        elif param == "date":
            # Use onset_date as the main date
            query = self._apply_date_filter(query, Allergy.onset_date, value, modifier)
        elif param == "identifier":
            query = query.filter(Allergy.id == value)
        
        return query
    
    def _handle_immunization_params(self, query, param, value, modifier):
        """Handle Immunization-specific search parameters"""
        if param == "patient":
            query = query.filter(Immunization.patient_id == value)
        elif param == "status":
            # Token search - exact match
            query = query.filter(Immunization.status == value)
        elif param == "vaccine-code":
            # Token search - can search CVX code or description
            system, code = self._parse_token_value(value)
            if system and "cvx" in system.lower():
                query = query.filter(Immunization.cvx_code == code)
            else:
                # Search description if no system specified
                query = query.filter(
                    or_(
                        Immunization.cvx_code == value,
                        Immunization.description.ilike(f"%{value}%")
                    )
                )
        elif param == "date":
            query = self._apply_date_filter(query, Immunization.immunization_date, value, modifier)
        elif param == "identifier":
            query = query.filter(Immunization.id == value)
        
        return query
    
    def _handle_procedure_params(self, query, param, value, modifier):
        """Handle Procedure-specific search parameters"""
        if param == "patient" or param == "subject":
            query = query.filter(Procedure.patient_id == value)
        elif param == "status":
            # Token search - exact match
            query = query.filter(Procedure.status == value)
        elif param == "code":
            # Token search - can search SNOMED code or description
            system, code = self._parse_token_value(value)
            if system and "snomed" in system.lower():
                query = query.filter(Procedure.snomed_code == code)
            else:
                # Search description if no system specified
                query = query.filter(
                    or_(
                        Procedure.snomed_code == value,
                        Procedure.description.ilike(f"%{value}%")
                    )
                )
        elif param == "encounter":
            if modifier == "missing":
                is_missing = value.lower() == "true"
                if is_missing:
                    query = query.filter(Procedure.encounter_id == None)
                else:
                    query = query.filter(Procedure.encounter_id != None)
            else:
                query = query.filter(Procedure.encounter_id == value)
        elif param == "date":
            query = self._apply_date_filter(query, Procedure.procedure_date, value, modifier)
        elif param == "reason-code":
            query = query.filter(
                or_(
                    Procedure.reason_code.ilike(f"%{value}%"),
                    Procedure.reason_description.ilike(f"%{value}%")
                )
            )
        elif param == "outcome":
            query = query.filter(Procedure.outcome.ilike(f"%{value}%"))
        elif param == "identifier":
            query = query.filter(Procedure.id == value)
        
        return query
    
    def _handle_careplan_params(self, query, param, value, modifier):
        """Handle CarePlan-specific search parameters"""
        if param == "patient" or param == "subject":
            query = query.filter(CarePlan.patient_id == value)
        elif param == "status":
            # Token search - exact match
            query = query.filter(CarePlan.status == value)
        elif param == "intent":
            # Token search - exact match
            query = query.filter(CarePlan.intent == value)
        elif param == "category":
            # Token search - can search SNOMED code or description
            system, code = self._parse_token_value(value)
            if system and "snomed" in system.lower():
                query = query.filter(CarePlan.snomed_code == code)
            else:
                query = query.filter(
                    or_(
                        CarePlan.snomed_code == value,
                        CarePlan.description.ilike(f"%{value}%")
                    )
                )
        elif param == "encounter":
            if modifier == "missing":
                is_missing = value.lower() == "true"
                if is_missing:
                    query = query.filter(CarePlan.encounter_id == None)
                else:
                    query = query.filter(CarePlan.encounter_id != None)
            else:
                query = query.filter(CarePlan.encounter_id == value)
        elif param == "date":
            query = self._apply_date_filter(query, CarePlan.start_date, value, modifier)
        elif param == "period":
            query = self._apply_date_filter(query, CarePlan.start_date, value, modifier)
        elif param == "identifier":
            query = query.filter(CarePlan.id == value)
        
        return query
    
    def _handle_device_params(self, query, param, value, modifier):
        """Handle Device-specific search parameters"""
        if param == "patient":
            query = query.filter(Device.patient_id == value)
        elif param == "status":
            # Token search - exact match
            query = query.filter(Device.status == value)
        elif param == "type":
            # Token search - can search SNOMED code or description
            system, code = self._parse_token_value(value)
            if system and "snomed" in system.lower():
                query = query.filter(Device.snomed_code == code)
            else:
                query = query.filter(
                    or_(
                        Device.snomed_code == value,
                        Device.description.ilike(f"%{value}%")
                    )
                )
        elif param == "udi-carrier" or param == "udi-di":
            query = query.filter(Device.udi.ilike(f"%{value}%"))
        elif param == "device-name":
            query = query.filter(Device.description.ilike(f"%{value}%"))
        elif param == "identifier":
            query = query.filter(Device.id == value)
        
        return query
    
    def _handle_diagnostic_report_params(self, query, param, value, modifier):
        """Handle DiagnosticReport-specific search parameters"""
        if param == "patient" or param == "subject":
            query = query.filter(DiagnosticReport.patient_id == value)
        elif param == "status":
            # Token search - exact match
            query = query.filter(DiagnosticReport.status == value)
        elif param == "code":
            # Token search - can search LOINC code or description
            system, code = self._parse_token_value(value)
            if system and "loinc" in system.lower():
                query = query.filter(DiagnosticReport.loinc_code == code)
            else:
                query = query.filter(
                    or_(
                        DiagnosticReport.loinc_code == value,
                        DiagnosticReport.description.ilike(f"%{value}%")
                    )
                )
        elif param == "encounter":
            if modifier == "missing":
                is_missing = value.lower() == "true"
                if is_missing:
                    query = query.filter(DiagnosticReport.encounter_id == None)
                else:
                    query = query.filter(DiagnosticReport.encounter_id != None)
            else:
                query = query.filter(DiagnosticReport.encounter_id == value)
        elif param == "date" or param == "issued":
            query = self._apply_date_filter(query, DiagnosticReport.report_date, value, modifier)
        elif param == "identifier":
            query = query.filter(DiagnosticReport.id == value)
        
        return query
    
    def _handle_imaging_study_params(self, query, param, value, modifier):
        """Handle ImagingStudy-specific search parameters"""
        if param == "patient" or param == "subject":
            query = query.filter(ImagingStudy.patient_id == value)
        elif param == "status":
            # Token search - exact match
            query = query.filter(ImagingStudy.status == value)
        elif param == "modality":
            # Token search - exact match
            query = query.filter(ImagingStudy.modality == value)
        elif param == "started":
            query = self._apply_date_filter(query, ImagingStudy.study_date, value, modifier)
        elif param == "body-site":
            query = query.filter(ImagingStudy.body_part.ilike(f"%{value}%"))
        elif param == "identifier":
            query = query.filter(ImagingStudy.id == value)
        
        return query
    
    def _handle_appointment_params(self, query, param, value, modifier):
        """Handle Appointment-specific search parameters"""
        if param == "patient":
            # Search participants for patient references
            query = query.join(AppointmentParticipant).filter(
                and_(
                    AppointmentParticipant.actor_type == "Patient",
                    AppointmentParticipant.actor_id == value.replace("Patient/", "")
                )
            )
        elif param == "practitioner":
            # Search participants for practitioner references
            query = query.join(AppointmentParticipant).filter(
                and_(
                    AppointmentParticipant.actor_type == "Practitioner",
                    AppointmentParticipant.actor_id == value.replace("Practitioner/", "")
                )
            )
        elif param == "location":
            # Search participants for location references
            query = query.join(AppointmentParticipant).filter(
                and_(
                    AppointmentParticipant.actor_type == "Location",
                    AppointmentParticipant.actor_id == value.replace("Location/", "")
                )
            )
        elif param == "status":
            # Token search - exact match
            try:
                from models.clinical.appointments import AppointmentStatus
                status_enum = AppointmentStatus(value)
                query = query.filter(Appointment.status == status_enum)
            except ValueError:
                # Invalid status - return no results
                query = query.filter(False)
        elif param == "date" or param == "start":
            query = self._apply_date_filter(query, Appointment.start, value, modifier)
        elif param == "end":
            query = self._apply_date_filter(query, Appointment.end, value, modifier)
        elif param == "service-category":
            # Search in service_category JSON field
            query = query.filter(Appointment.service_category.ilike(f"%{value}%"))
        elif param == "service-type":
            # Search in service_type JSON field
            query = query.filter(Appointment.service_type.ilike(f"%{value}%"))
        elif param == "specialty":
            # Search in specialty JSON field
            query = query.filter(Appointment.specialty.ilike(f"%{value}%"))
        elif param == "appointment-type":
            # Search in appointment_type JSON field
            query = query.filter(Appointment.appointment_type.ilike(f"%{value}%"))
        elif param == "reason-code":
            # Search in reason_code JSON field
            query = query.filter(Appointment.reason_code.ilike(f"%{value}%"))
        elif param == "reason-reference":
            # Search in reason_reference JSON field
            query = query.filter(Appointment.reason_reference.ilike(f"%{value}%"))
        elif param == "priority":
            # Numeric search
            try:
                priority_value = int(value)
                query = query.filter(Appointment.priority == priority_value)
            except ValueError:
                # Invalid priority - return no results
                query = query.filter(False)
        elif param == "participant":
            # General participant search
            query = query.join(AppointmentParticipant).filter(
                AppointmentParticipant.actor_id == value.split("/")[-1]
            )
        elif param == "participant-status":
            # Search by participant status
            try:
                from models.clinical.appointments import ParticipantStatus
                status_enum = ParticipantStatus(value)
                query = query.join(AppointmentParticipant).filter(
                    AppointmentParticipant.status == status_enum
                )
            except ValueError:
                # Invalid status - return no results
                query = query.filter(False)
        elif param == "identifier":
            query = query.filter(Appointment.id == value)
        elif param == "based-on":
            # Search in based_on JSON field
            query = query.filter(Appointment.based_on.ilike(f"%{value}%"))
        
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
                # Invalid date format - raise proper error
                raise HTTPException(
                    status_code=400,
                    detail={
                        "resourceType": "OperationOutcome",
                        "issue": [{
                            "severity": "error",
                            "code": "invalid",
                            "diagnostics": f"Invalid date format: '{date_value}'. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ",
                            "expression": ["Bundle.entry.request.url"]
                        }]
                    }
                )
        
        # Convert date to string format for comparison with database strings
        # Database format: "2003-11-12 23:17:36.000000"
        date_str = date_obj.strftime('%Y-%m-%d')
        
        if prefix == "eq":
            # For equality, check if date starts with the date string
            query = query.filter(func.substr(field, 1, 10) == date_str)
        elif prefix == "ne":
            query = query.filter(func.substr(field, 1, 10) != date_str)
        elif prefix == "gt" or prefix == "above":
            # For greater than, add time to ensure we get dates after midnight
            query = query.filter(field > f"{date_str} 23:59:59")
        elif prefix == "ge":
            query = query.filter(field >= f"{date_str} 00:00:00")
        elif prefix == "lt" or prefix == "below":
            query = query.filter(field < f"{date_str} 00:00:00")
        elif prefix == "le":
            # For less than or equal, include the entire day
            query = query.filter(field <= f"{date_str} 23:59:59")
        
        return query
    
    def _apply_quantity_filter(self, query, field, value, modifier):
        """Apply quantity filters for numeric values"""
        # Handle modifier-based filtering
        if modifier in ["above", "below", "missing"]:
            if modifier == "missing":
                is_missing = value == "true"
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
    
    def _apply_last_updated_filter(self, query, value):
        """Apply _lastUpdated filter to query"""
        if issubclass(self.model, FHIRResource):
            # For JSONB resources, use last_updated column
            return self._apply_date_filter(query, FHIRResource.last_updated, value, None)
        else:
            # For regular models, check if they have updated_at field
            if hasattr(self.model, 'updated_at'):
                return self._apply_date_filter(query, self.model.updated_at, value, None)
            else:
                # No last updated field available
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
            is_missing = value == "true"
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
    
    def _handle_jsonb_search_parameter(self, query, param, value):
        """Handle search parameters for JSONB-stored FHIR resources"""
        # Create query builder instance
        query_builder = FHIRQueryBuilder(self.resource_type)
        
        # Parse modifiers (e.g., name:exact, birthdate:ge)
        param_parts = param.split(":")
        base_param = param_parts[0]
        modifier = param_parts[1] if len(param_parts) > 1 else None
        
        # Handle common search parameters
        if base_param in ["patient", "subject"]:
            # Extract patient ID from reference
            patient_id = value.replace("Patient/", "") if value.startswith("Patient/") else value
            query = query_builder.apply_patient_filter(query, patient_id)
        
        elif base_param == "encounter":
            # Extract encounter ID from reference
            encounter_id = value.replace("Encounter/", "") if value.startswith("Encounter/") else value
            query = query_builder.apply_encounter_filter(query, encounter_id)
        
        elif base_param == "code":
            # Handle code search with optional system
            if '|' in value:
                system, code = value.split('|', 1)
                query = query_builder.apply_code_filter(query, code, system)
            else:
                query = query_builder.apply_code_filter(query, value)
        
        elif base_param == "status":
            # Handle status search
            query = query_builder.apply_status_filter(query, value)
        
        elif base_param == "clinical-status":
            # Handle clinical status for conditions/allergies
            query = query_builder.apply_status_filter(query, value, 'clinicalStatus.coding[0].code')
        
        elif base_param == "verification-status":
            # Handle verification status
            query = query_builder.apply_status_filter(query, value, 'verificationStatus.coding[0].code')
        
        elif base_param == "date" or base_param.endswith("-date"):
            # Handle date searches
            date_field = base_param.replace("-date", "Date") if base_param.endswith("-date") else "date"
            if base_param == "onset-date":
                date_field = "onsetDateTime"
            elif base_param == "recorded-date":
                date_field = "recordedDate"
            elif base_param == "authored-on":
                date_field = "authoredOn"
            
            query = query_builder.apply_date_filter(query, date_field, value, modifier)
        
        elif base_param == "identifier":
            # Handle identifier search
            if '|' in value:
                system, identifier = value.split('|', 1)
                query = query_builder.apply_identifier_filter(query, identifier, system)
            else:
                query = query_builder.apply_identifier_filter(query, value)
        
        elif base_param == "category":
            # Handle category search
            query = query_builder.apply_token_filter(query, "category", value, modifier)
        
        elif base_param == "type":
            # Handle type search
            query = query_builder.apply_token_filter(query, "type", value, modifier)
        
        # Resource-specific parameters
        elif self.resource_type == "Condition":
            if base_param == "severity":
                query = query_builder.apply_string_filter(query, "severity", value, modifier)
            elif base_param == "abatement-date":
                query = query_builder.apply_date_filter(query, "abatementDateTime", value, modifier)
        
        elif self.resource_type == "AllergyIntolerance":
            if base_param == "criticality":
                query = query_builder.apply_string_filter(query, "criticality", value, modifier)
        
        elif self.resource_type == "Procedure":
            if base_param == "performer":
                performer_ref = f"Practitioner/{value}" if not value.startswith("Practitioner/") else value
                query = query_builder.apply_reference_filter(query, "performer[0].actor", performer_ref)
        
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
async def batch_transaction(request: Request, db: Session = Depends(get_db)):
    """Handle FHIR batch and transaction bundles"""
    try:
        bundle = await request.json()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid JSON in request body: {str(e)}"
        )
    
    # Validate it's a Bundle
    if not isinstance(bundle, dict) or bundle.get('resourceType') != 'Bundle':
        raise HTTPException(
            status_code=400,
            detail="Request body must be a FHIR Bundle resource"
        )
    
    processor = BatchProcessor(db)
    return processor.process_bundle(bundle)

# AuditEvent endpoints
@router.get("/AuditEvent")
async def search_audit_events(
    request: Request,
    async_db: AsyncSession = Depends(get_db_session),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    _count: int = Query(50, le=1000),
    _offset: int = Query(0),
    date: Optional[str] = Query(None),
    agent: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    patient: Optional[str] = Query(None)
):
    """Search for FHIR AuditEvent resources"""
    
    # Build filters for the audit service
    filters = {}
    
    if date:
        # Parse date parameter (supports gt, lt, ge, le, eq)
        if date.startswith("gt"):
            filters["date_from"] = datetime.fromisoformat(date[2:])
        elif date.startswith("ge"):
            filters["date_from"] = datetime.fromisoformat(date[2:])
        elif date.startswith("lt"):
            filters["date_to"] = datetime.fromisoformat(date[2:])
        elif date.startswith("le"):
            filters["date_to"] = datetime.fromisoformat(date[2:])
        else:
            # Exact date - search for same day
            target_date = datetime.fromisoformat(date)
            filters["date_from"] = target_date.replace(hour=0, minute=0, second=0)
            filters["date_to"] = target_date.replace(hour=23, minute=59, second=59)
    
    if agent:
        # Extract user ID from agent reference
        if "/" in agent:
            filters["user_id"] = agent.split("/")[-1]
        else:
            filters["user_id"] = agent
    
    if entity:
        # Extract resource type and ID from entity reference
        if "/" in entity:
            parts = entity.split("/")
            if len(parts) == 2:
                filters["resource_type"] = parts[0]
                filters["resource_id"] = parts[1]
    
    if action:
        # Map FHIR action codes to our action names
        action_map = {
            "C": "create",
            "R": "read", 
            "U": "update",
            "D": "delete",
            "E": "execute"
        }
        filters["action"] = action_map.get(action.upper(), action.lower())
    
    # Get audit events from the service
    audit_events = await AuditService.get_audit_events(
        db=async_db,
        filters=filters,
        limit=_count,
        offset=_offset
    )
    
    # Create FHIR Bundle
    bundle = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(audit_events),  # In production, get actual total count
        "link": [
            {
                "relation": "self",
                "url": str(request.url)
            }
        ],
        "entry": []
    }
    
    for audit_event in audit_events:
        bundle["entry"].append({
            "resource": audit_event,
            "fullUrl": f"AuditEvent/{audit_event['id']}",
            "search": {
                "mode": "match"
            }
        })
    
    # Add pagination link if needed
    if len(audit_events) == _count:
        next_url = str(request.url.include_query_params(_offset=_offset + _count))
        bundle["link"].append({
            "relation": "next",
            "url": next_url
        })
    
    return bundle

@router.get("/AuditEvent/{audit_id}")
async def get_audit_event(
    audit_id: str,
    request: Request,
    async_db: AsyncSession = Depends(get_db_session),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Get a specific AuditEvent by ID"""
    
    # Get the audit event by ID directly
    query = text("""
        SELECT * FROM emr.audit_logs 
        WHERE id = :audit_id
        LIMIT 1
    """)
    
    result = await async_db.execute(query, {"audit_id": uuid.UUID(audit_id)})
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="AuditEvent not found")
    
    # Convert to FHIR AuditEvent
    from api.fhir.converters.audit_event import audit_log_to_fhir
    audit_dict = {
        "id": row.id,
        "user_id": str(row.user_id) if row.user_id else None,
        "action": row.action,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "details": json.loads(row.details) if row.details else None,
        "ip_address": row.ip_address,
        "user_agent": row.user_agent,
        "created_at": row.created_at
    }
    
    return audit_log_to_fhir(audit_dict)

# Generic resource endpoints - must be after specific endpoints

@router.get("/{resource_type}")
async def search_resources(
    resource_type: str,
    request: Request,
    db: Session = Depends(get_db),
    async_db: AsyncSession = Depends(get_db_session),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
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
    
    # Special handling for AuditEvent
    if resource_type == "AuditEvent":
        # Redirect to the specialized AuditEvent search endpoint
        return await search_audit_events(
            request=request,
            async_db=async_db,
            current_user=current_user,
            _count=_count,
            _offset=_offset,
            date=search_params.get("date"),
            agent=search_params.get("agent"),
            entity=search_params.get("entity"),
            type=search_params.get("type"),
            action=search_params.get("action"),
            outcome=search_params.get("outcome"),
            patient=search_params.get("patient")
        )
    
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
        "Location": location_to_fhir,
        "AllergyIntolerance": allergy_intolerance_to_fhir,
        "Immunization": immunization_to_fhir,
        "Procedure": procedure_to_fhir,
        "CarePlan": care_plan_to_fhir,
        "Device": device_to_fhir,
        "DiagnosticReport": diagnostic_report_to_fhir,
        "ImagingStudy": imaging_study_to_fhir,
        "Appointment": appointment_to_fhir,
        "DocumentReference": document_reference_to_fhir,
        "Medication": medication_to_fhir,
        "MedicationAdministration": medication_administration_to_fhir,
        "CareTeam": care_team_to_fhir,
        "PractitionerRole": practitioner_role_to_fhir,
        "Coverage": coverage_to_fhir,
        "Claim": claim_to_fhir,
        "ExplanationOfBenefit": explanation_of_benefit_to_fhir,
        "SupplyDelivery": supply_delivery_to_fhir,
        "Provenance": provenance_to_fhir,
        "ServiceRequest": service_request_to_fhir
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
        # Handle JSONB resources differently
        if isinstance(resource, FHIRResource):
            # For JSONB resources, use the generic converter
            from .converter_modules.generic_converter import generic_resource_to_fhir
            fhir_resource = generic_resource_to_fhir(resource)
            resource_id = resource.fhir_id
        else:
            # For model-based resources, use specific converters
            fhir_resource = converter(resource)
            resource_id = resource.id
        
        entry = {
            "resource": fhir_resource,
            "fullUrl": f"{resource_type}/{resource_id}",
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
    
    # Create audit log for the search operation
    await AuditService.audit_fhir_operation(
        db=async_db,
        operation="search",
        resource_type=resource_type,
        user_id=current_user["id"] if current_user else None,
        success=True,
        details={
            "search_params": search_params,
            "result_count": len(resources),
            "total_count": total_count
        },
        request=request
    )
    
    return bundle

# Individual resource endpoints
@router.get("/{resource_type}/{resource_id}")
async def get_resource(
    resource_type: str,
    resource_id: str,
    request: Request,
    db: Session = Depends(get_db),
    async_db: AsyncSession = Depends(get_db_session),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Get a specific resource by ID"""
    
    if resource_type not in RESOURCE_MAPPINGS:
        raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
    
    # Special handling for AuditEvent
    if resource_type == "AuditEvent":
        return await get_audit_event(
            audit_id=resource_id,
            request=request,
            async_db=async_db,
            current_user=current_user
        )
    
    model = RESOURCE_MAPPINGS[resource_type]["model"]
    
    # Check if this is a JSONB-stored resource
    if issubclass(model, FHIRResource):
        # Query by fhir_id for JSONB resources
        resource = db.query(FHIRResource).filter(
            FHIRResource.resource_type == resource_type,
            FHIRResource.fhir_id == resource_id,
            FHIRResource.deleted == False
        ).first()
    else:
        # Query by id for regular models
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
        "Location": location_to_fhir,
        "AllergyIntolerance": allergy_intolerance_to_fhir,
        "Immunization": immunization_to_fhir,
        "Procedure": procedure_to_fhir,
        "CarePlan": care_plan_to_fhir,
        "Device": device_to_fhir,
        "DiagnosticReport": diagnostic_report_to_fhir,
        "ImagingStudy": imaging_study_to_fhir,
        "Appointment": appointment_to_fhir,
        "DocumentReference": document_reference_to_fhir,
        "Medication": medication_to_fhir,
        "MedicationAdministration": medication_administration_to_fhir,
        "CareTeam": care_team_to_fhir,
        "PractitionerRole": practitioner_role_to_fhir,
        "Coverage": coverage_to_fhir,
        "Claim": claim_to_fhir,
        "ExplanationOfBenefit": explanation_of_benefit_to_fhir,
        "SupplyDelivery": supply_delivery_to_fhir,
        "Provenance": provenance_to_fhir,
        "ServiceRequest": service_request_to_fhir
    }
    
    # Handle JSONB resources differently
    if isinstance(resource, FHIRResource):
        # For JSONB resources, return the resource data directly
        from .converter_modules.generic_converter import generic_resource_to_fhir
        fhir_resource = generic_resource_to_fhir(resource)
    else:
        # For model-based resources, use specific converters
        converter = converter_map.get(resource_type)
        if not converter:
            raise HTTPException(status_code=500, detail=f"No converter for {resource_type}")
        fhir_resource = converter(resource)
    
    # Create audit log for the read operation
    await AuditService.audit_fhir_operation(
        db=async_db,
        operation="read",
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=current_user["id"] if current_user else None,
        success=True,
        request=request
    )
    
    return fhir_resource

@router.put("/{resource_type}/{resource_id}")
async def update_resource(
    resource_type: str,
    resource_id: str,
    resource_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    async_db: AsyncSession = Depends(get_db_session),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
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
    
    # Create audit log for the update operation
    success = "resource" in result
    await AuditService.audit_fhir_operation(
        db=async_db,
        operation="update",
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=current_user["id"] if current_user else None,
        success=success,
        request=request
    )
    
    # Return the updated resource
    if success:
        return result["resource"]
    else:
        raise HTTPException(status_code=500, detail="Failed to update resource")

@router.delete("/{resource_type}/{resource_id}")
async def delete_resource(
    resource_type: str,
    resource_id: str,
    request: Request,
    db: Session = Depends(get_db),
    async_db: AsyncSession = Depends(get_db_session),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Delete a specific resource"""
    
    if resource_type not in RESOURCE_MAPPINGS:
        raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
    
    model = RESOURCE_MAPPINGS[resource_type]["model"]
    resource = db.query(model).filter(model.id == resource_id).first()
    
    if not resource:
        raise HTTPException(status_code=404, detail=f"{resource_type} not found")
    
    try:
        # Perform soft delete by updating status field if it exists
        if hasattr(resource, 'status'):
            resource.status = 'inactive'
        elif hasattr(resource, 'clinical_status'):
            resource.clinical_status = 'inactive'
        elif hasattr(resource, 'verification_status'):
            resource.verification_status = 'entered-in-error'
        else:
            # Hard delete if no status field
            db.delete(resource)
        
        db.commit()
        success = True
        
    except Exception as e:
        db.rollback()
        success = False
        raise HTTPException(status_code=500, detail=f"Failed to delete {resource_type}: {str(e)}")
    
    # Create audit log for the delete operation
    await AuditService.audit_fhir_operation(
        db=async_db,
        operation="delete",
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=current_user["id"] if current_user else None,
        success=success,
        request=request
    )
    
    return Response(status_code=204)

@router.post("/{resource_type}")
async def create_resource(
    resource_type: str,
    resource_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    async_db: AsyncSession = Depends(get_db_session),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Create a new resource"""
    
    if resource_type not in RESOURCE_MAPPINGS:
        raise HTTPException(status_code=404, detail=f"Resource type {resource_type} not supported")
    
    # Use batch processor to handle the creation
    processor = BatchProcessor(db)
    entry = {
        "resource": resource_data,
        "request": {
            "method": "POST",
            "url": resource_type
        }
    }
    
    from .batch_transaction import BatchEntry
    batch_entry = BatchEntry(entry)
    result = processor._handle_create(batch_entry)
    
    # Commit the transaction
    db.commit()
    
    # Create audit log for the create operation
    success = "resource" in result
    await AuditService.audit_fhir_operation(
        db=async_db,
        operation="create",
        resource_type=resource_type,
        resource_id=result.get("resource", {}).get("id") if success else None,
        user_id=current_user["id"] if current_user else None,
        success=success,
        request=request
    )
    
    # Return the created resource with 201 status
    if success:
        resource_id = result["resource"]["id"]
        return Response(
            status_code=201,
            headers={"Location": f"/{resource_type}/{resource_id}"},
            content=json.dumps(result["resource"])
        )
    else:
        raise HTTPException(status_code=500, detail="Failed to create resource")

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

# Import and include notifications router
from .notifications import router as notifications_router
router.include_router(notifications_router)
