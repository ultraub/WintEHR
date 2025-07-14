"""
ServiceRequest Dictionary Converter
Converts ServiceRequest models to FHIR JSON dictionaries
"""

from typing import Dict, Any, Optional
from datetime import datetime
from models.synthea_models import ServiceRequest


def service_request_to_fhir_dict(service_request: ServiceRequest) -> Dict[str, Any]:
    """Convert ServiceRequest model to FHIR dictionary"""
    
    resource = {
        "resourceType": "ServiceRequest",
        "id": str(service_request.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": (service_request.updated_at or datetime.utcnow()).isoformat() + "Z"
        }
    }
    
    # Status and intent (required)
    resource["status"] = service_request.status or "active"
    resource["intent"] = service_request.intent or "order"
    
    # Priority
    if service_request.priority:
        resource["priority"] = service_request.priority
    
    # Subject (required)
    resource["subject"] = {
        "reference": f"Patient/{service_request.patient_id}"
    }
    
    # Encounter
    if service_request.encounter_id:
        resource["encounter"] = {
            "reference": f"Encounter/{service_request.encounter_id}"
        }
    
    # Requester
    if service_request.requester_id:
        resource["requester"] = {
            "reference": f"Practitioner/{service_request.requester_id}"
        }
    
    # Category
    if service_request.category:
        resource["category"] = service_request.category
    else:
        # Default to laboratory
        resource["category"] = [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "108252007",
                "display": "Laboratory procedure"
            }]
        }]
    
    # Code (what is being requested)
    if service_request.code:
        resource["code"] = service_request.code
    
    # Order details
    if service_request.order_detail:
        resource["orderDetail"] = service_request.order_detail
    
    # Quantity
    if service_request.quantity_quantity:
        resource["quantityQuantity"] = service_request.quantity_quantity
    elif service_request.quantity_ratio:
        resource["quantityRatio"] = service_request.quantity_ratio
    elif service_request.quantity_range:
        resource["quantityRange"] = service_request.quantity_range
    
    # Timing
    if service_request.occurrence_datetime:
        resource["occurrenceDateTime"] = service_request.occurrence_datetime.isoformat()
    elif service_request.occurrence_period:
        resource["occurrencePeriod"] = service_request.occurrence_period
    elif service_request.occurrence_timing:
        resource["occurrenceTiming"] = service_request.occurrence_timing
    
    # As needed
    if service_request.as_needed_boolean is not None:
        resource["asNeededBoolean"] = service_request.as_needed_boolean
    elif service_request.as_needed_codeable_concept:
        resource["asNeededCodeableConcept"] = service_request.as_needed_codeable_concept
    
    # Authored on
    if service_request.authored_on:
        resource["authoredOn"] = service_request.authored_on.isoformat()
    
    # Performer
    if service_request.performer_type:
        resource["performerType"] = service_request.performer_type
    
    if service_request.performer:
        resource["performer"] = service_request.performer
    
    # Location
    if service_request.location_code:
        resource["locationCode"] = service_request.location_code
    
    if service_request.location_reference:
        resource["locationReference"] = service_request.location_reference
    
    # Reason
    if service_request.reason_code:
        resource["reasonCode"] = service_request.reason_code
    
    if service_request.reason_reference:
        resource["reasonReference"] = service_request.reason_reference
    
    # Insurance
    if service_request.insurance:
        resource["insurance"] = service_request.insurance
    
    # Supporting info
    if service_request.supporting_info:
        resource["supportingInfo"] = service_request.supporting_info
    
    # Specimen
    if service_request.specimen:
        resource["specimen"] = service_request.specimen
    
    # Body site
    if service_request.body_site:
        resource["bodySite"] = service_request.body_site
    
    # Note
    if service_request.note:
        resource["note"] = service_request.note
    
    # Patient instruction
    if service_request.patient_instruction:
        resource["patientInstruction"] = service_request.patient_instruction
    
    # Relevant history
    if service_request.relevant_history:
        resource["relevantHistory"] = service_request.relevant_history
    
    # Identifiers
    if service_request.identifier:
        resource["identifier"] = service_request.identifier
    elif service_request.synthea_id:
        resource["identifier"] = [{
            "system": "http://synthea.mitre.org/identifier",
            "value": service_request.synthea_id
        }]
    
    # Based on
    if service_request.based_on:
        resource["basedOn"] = service_request.based_on
    
    # Replaces
    if service_request.replaces:
        resource["replaces"] = service_request.replaces
    
    # Requisition
    if service_request.requisition:
        resource["requisition"] = {
            "system": "http://medgenemr.com/requisition",
            "value": service_request.requisition
        }
    
    # Do not perform
    if service_request.do_not_perform is not None:
        resource["doNotPerform"] = service_request.do_not_perform
    
    return resource