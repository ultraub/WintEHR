"""
FHIR Batch and Transaction Implementation
Supports processing multiple FHIR operations in a single request
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import uuid
import json

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import exc

from models.synthea_models import Patient, Encounter, Observation, Condition, Medication, Provider, Organization, Location
from .converters import (
    patient_to_fhir, encounter_to_fhir, observation_to_fhir, 
    condition_to_fhir, medication_request_to_fhir, practitioner_to_fhir,
    organization_to_fhir, location_to_fhir
)


class BatchEntry:
    """Represents a single entry in a batch/transaction bundle"""
    
    def __init__(self, entry_data: Dict[str, Any]):
        self.fullUrl = entry_data.get("fullUrl")
        self.resource = entry_data.get("resource", {})
        self.request = entry_data.get("request", {})
        
        # Extract request details
        self.method = self.request.get("method", "").upper()
        self.url = self.request.get("url", "")
        
        # Parse URL components
        self._parse_url()
        
    def _parse_url(self):
        """Parse the request URL to extract resource type and ID"""
        if not self.url:
            self.resource_type = None
            self.resource_id = None
            return
            
        # Remove leading slash
        url_parts = self.url.strip("/").split("/")
        
        # Handle different URL patterns
        if len(url_parts) >= 1:
            self.resource_type = url_parts[0]
        else:
            self.resource_type = None
            
        if len(url_parts) >= 2 and not url_parts[1].startswith("?"):
            self.resource_id = url_parts[1]
        else:
            self.resource_id = None


class BatchProcessor:
    """Processes FHIR batch and transaction bundles"""
    
    def __init__(self, db: Session):
        self.db = db
        self.results = []
        self.references_map = {}  # Map temporary IDs to actual IDs
        
    def process_bundle(self, bundle: Dict[str, Any]) -> Dict[str, Any]:
        """Process a batch or transaction bundle"""
        bundle_type = bundle.get("type", "").lower()
        
        if bundle_type not in ["batch", "transaction"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid bundle type: {bundle_type}. Must be 'batch' or 'transaction'"
            )
            
        entries = bundle.get("entry", [])
        
        if bundle_type == "transaction":
            return self._process_transaction(entries)
        else:
            return self._process_batch(entries)
            
    def _process_batch(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process batch bundle - each entry independently"""
        response_bundle = {
            "resourceType": "Bundle",
            "type": "batch-response",
            "entry": []
        }
        
        for entry_data in entries:
            try:
                entry = BatchEntry(entry_data)
                result = self._process_entry(entry)
                response_bundle["entry"].append(result)
            except Exception as e:
                # In batch mode, failures don't stop processing
                error_result = self._create_error_response(str(e), 500)
                response_bundle["entry"].append(error_result)
                
        return response_bundle
        
    def _process_transaction(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process transaction bundle - all or nothing"""
        response_bundle = {
            "resourceType": "Bundle",
            "type": "transaction-response",
            "entry": []
        }
        
        try:
            # Start transaction
            for entry_data in entries:
                entry = BatchEntry(entry_data)
                result = self._process_entry(entry)
                response_bundle["entry"].append(result)
                
            # Commit transaction
            self.db.commit()
            
        except Exception as e:
            # Rollback on any error
            self.db.rollback()
            raise HTTPException(status_code=400, detail=f"Transaction failed: {str(e)}")
            
        return response_bundle
        
    def _process_entry(self, entry: BatchEntry) -> Dict[str, Any]:
        """Process a single bundle entry"""
        if entry.method == "GET":
            return self._handle_read(entry)
        elif entry.method == "POST":
            return self._handle_create(entry)
        elif entry.method == "PUT":
            return self._handle_update(entry)
        elif entry.method == "DELETE":
            return self._handle_delete(entry)
        else:
            raise ValueError(f"Unsupported method: {entry.method}")
            
    def _handle_read(self, entry: BatchEntry) -> Dict[str, Any]:
        """Handle GET request"""
        if not entry.resource_type or not entry.resource_id:
            raise ValueError("Invalid URL for GET request")
            
        # Get the model and converter
        model, converter = self._get_model_and_converter(entry.resource_type)
        
        # Query the resource
        resource = self.db.query(model).filter(model.id == entry.resource_id).first()
        
        if not resource:
            return self._create_error_response("Resource not found", 404)
            
        # Convert to FHIR and return success response
        fhir_resource = converter(resource)
        
        return {
            "resource": fhir_resource,
            "response": {
                "status": "200 OK",
                "lastModified": datetime.utcnow().isoformat() + "Z"
            }
        }
        
    def _handle_create(self, entry: BatchEntry) -> Dict[str, Any]:
        """Handle POST request"""
        if not entry.resource_type:
            raise ValueError("Resource type required for POST")
            
        # Get the model
        model = self._get_model(entry.resource_type)
        
        # Convert FHIR resource to model
        resource_data = entry.resource
        new_resource = self._fhir_to_model(resource_data, model, entry.resource_type)
        
        # Save to database
        self.db.add(new_resource)
        self.db.flush()  # Get the ID without committing
        
        # Store reference mapping if temporary ID was used
        if entry.fullUrl and entry.fullUrl.startswith("urn:"):
            self.references_map[entry.fullUrl] = f"{entry.resource_type}/{new_resource.id}"
            
        # Convert back to FHIR
        _, converter = self._get_model_and_converter(entry.resource_type)
        created_resource = converter(new_resource)
        
        return {
            "resource": created_resource,
            "response": {
                "status": "201 Created",
                "location": f"{entry.resource_type}/{new_resource.id}",
                "lastModified": datetime.utcnow().isoformat() + "Z"
            }
        }
        
    def _handle_update(self, entry: BatchEntry) -> Dict[str, Any]:
        """Handle PUT request"""
        if not entry.resource_type or not entry.resource_id:
            raise ValueError("Invalid URL for PUT request")
            
        # Get the model
        model = self._get_model(entry.resource_type)
        
        # Find existing resource
        existing = self.db.query(model).filter(model.id == entry.resource_id).first()
        
        if not existing:
            # Create new resource with specified ID
            new_resource = self._fhir_to_model(entry.resource, model, entry.resource_type)
            new_resource.id = entry.resource_id
            self.db.add(new_resource)
            status = "201 Created"
        else:
            # Update existing resource
            self._update_model_from_fhir(existing, entry.resource, entry.resource_type)
            status = "200 OK"
            
        self.db.flush()
        
        # Convert back to FHIR
        _, converter = self._get_model_and_converter(entry.resource_type)
        updated_resource = converter(existing if existing else new_resource)
        
        return {
            "resource": updated_resource,
            "response": {
                "status": status,
                "location": f"{entry.resource_type}/{entry.resource_id}",
                "lastModified": datetime.utcnow().isoformat() + "Z"
            }
        }
        
    def _handle_delete(self, entry: BatchEntry) -> Dict[str, Any]:
        """Handle DELETE request"""
        if not entry.resource_type or not entry.resource_id:
            raise ValueError("Invalid URL for DELETE request")
            
        # Get the model
        model = self._get_model(entry.resource_type)
        
        # Find and delete resource
        resource = self.db.query(model).filter(model.id == entry.resource_id).first()
        
        if not resource:
            return self._create_error_response("Resource not found", 404)
            
        self.db.delete(resource)
        self.db.flush()
        
        return {
            "response": {
                "status": "204 No Content"
            }
        }
        
    def _get_model_and_converter(self, resource_type: str) -> Tuple[Any, Any]:
        """Get the SQLAlchemy model and FHIR converter for a resource type"""
        mapping = {
            "Patient": (Patient, patient_to_fhir),
            "Encounter": (Encounter, encounter_to_fhir),
            "Observation": (Observation, observation_to_fhir),
            "Condition": (Condition, condition_to_fhir),
            "MedicationRequest": (Medication, medication_request_to_fhir),
            "Practitioner": (Provider, practitioner_to_fhir),
            "Organization": (Organization, organization_to_fhir),
            "Location": (Location, location_to_fhir)
        }
        
        if resource_type not in mapping:
            raise ValueError(f"Unsupported resource type: {resource_type}")
            
        return mapping[resource_type]
        
    def _get_model(self, resource_type: str) -> Any:
        """Get just the SQLAlchemy model"""
        model, _ = self._get_model_and_converter(resource_type)
        return model
        
    def _fhir_to_model(self, fhir_resource: Dict[str, Any], model_class: Any, resource_type: str) -> Any:
        """Convert FHIR resource to SQLAlchemy model (simplified)"""
        # This is a simplified implementation - in production, you'd want full mapping
        
        if resource_type == "Patient":
            patient = Patient()
            patient.id = fhir_resource.get("id", str(uuid.uuid4()))
            
            # Extract name
            if fhir_resource.get("name"):
                name = fhir_resource["name"][0]
                patient.first_name = name.get("given", [""])[0]
                patient.last_name = name.get("family", "")
                
            # Extract other fields
            patient.gender = "M" if fhir_resource.get("gender") == "male" else "F"
            patient.date_of_birth = datetime.fromisoformat(
                fhir_resource.get("birthDate", "1900-01-01")
            ).date()
            
            # Extract contact info
            if fhir_resource.get("telecom"):
                for telecom in fhir_resource["telecom"]:
                    if telecom.get("system") == "phone":
                        patient.phone = telecom.get("value")
                    elif telecom.get("system") == "email":
                        patient.email = telecom.get("value")
                        
            return patient
            
        elif resource_type == "Observation":
            obs = Observation()
            obs.id = fhir_resource.get("id", str(uuid.uuid4()))
            
            # Extract patient reference
            if fhir_resource.get("subject"):
                ref = fhir_resource["subject"].get("reference", "")
                obs.patient_id = ref.replace("Patient/", "")
                
            # Extract code
            if fhir_resource.get("code", {}).get("coding"):
                coding = fhir_resource["code"]["coding"][0]
                obs.loinc_code = coding.get("code")
                obs.display = coding.get("display", f"LOINC {coding.get('code', 'unknown')}")
                
            # Extract value
            if fhir_resource.get("valueQuantity"):
                obs.value = str(fhir_resource["valueQuantity"].get("value"))
                obs.value_quantity = fhir_resource["valueQuantity"].get("value")
                obs.value_unit = fhir_resource["valueQuantity"].get("unit")
                
            # Set other fields
            obs.observation_date = datetime.utcnow()
            obs.status = fhir_resource.get("status", "final")
            obs.observation_type = "laboratory"  # Default
            
            return obs
            
        # Add more resource type conversions as needed
        else:
            raise NotImplementedError(f"FHIR to model conversion not implemented for {resource_type}")
            
    def _update_model_from_fhir(self, model_instance: Any, fhir_resource: Dict[str, Any], resource_type: str):
        """Update existing model instance from FHIR resource"""
        # This is a simplified implementation
        if resource_type == "Patient":
            if fhir_resource.get("name"):
                name = fhir_resource["name"][0]
                model_instance.first_name = name.get("given", [""])[0]
                model_instance.last_name = name.get("family", "")
                
            if fhir_resource.get("gender"):
                model_instance.gender = "M" if fhir_resource["gender"] == "male" else "F"
                
        # Add more update logic as needed
        
    def _create_error_response(self, message: str, status_code: int) -> Dict[str, Any]:
        """Create an error response entry"""
        return {
            "response": {
                "status": f"{status_code}",
                "outcome": {
                    "resourceType": "OperationOutcome",
                    "issue": [
                        {
                            "severity": "error",
                            "code": "exception",
                            "diagnostics": message
                        }
                    ]
                }
            }
        }