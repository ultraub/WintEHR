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
from models.synthea_models import Patient, Encounter, Organization, Location, Observation, Condition, Medication, Provider, Allergy, Immunization, Procedure, CarePlan, Device, DiagnosticReport, ImagingStudy
from .schemas import *
from .bulk_export import BulkExportRouter
from .batch_transaction import BatchProcessor
from .converters import (
    patient_to_fhir, encounter_to_fhir, observation_to_fhir,
    condition_to_fhir, medication_request_to_fhir, practitioner_to_fhir,
    organization_to_fhir, location_to_fhir, allergy_intolerance_to_fhir,
    immunization_to_fhir, procedure_to_fhir, care_plan_to_fhir,
    device_to_fhir, diagnostic_report_to_fhir, imaging_study_to_fhir
)

router = APIRouter(prefix="/R4", tags=["FHIR R4"])

# FHIR Resource Type Mappings
RESOURCE_MAPPINGS = {
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
        "model": Medication,
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
        "model": Allergy,
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
        "Location": location_to_fhir,
        "AllergyIntolerance": allergy_intolerance_to_fhir,
        "Immunization": immunization_to_fhir,
        "Procedure": procedure_to_fhir,
        "CarePlan": care_plan_to_fhir,
        "Device": device_to_fhir,
        "DiagnosticReport": diagnostic_report_to_fhir,
        "ImagingStudy": imaging_study_to_fhir
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
        "Location": location_to_fhir,
        "AllergyIntolerance": allergy_intolerance_to_fhir,
        "Immunization": immunization_to_fhir,
        "Procedure": procedure_to_fhir,
        "CarePlan": care_plan_to_fhir,
        "Device": device_to_fhir,
        "DiagnosticReport": diagnostic_report_to_fhir,
        "ImagingStudy": imaging_study_to_fhir
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
