"""
FHIR R4 Summary Field Definitions

Defines which fields should be included when _summary=true for each resource type
according to the FHIR R4 specification.
"""

from typing import Dict, List, Set

# Base elements that are always included
BASE_SUMMARY_ELEMENTS = {
    "resourceType",
    "id", 
    "meta",
    "implicitRules"
}

# Resource-specific summary elements per FHIR R4 spec
RESOURCE_SUMMARY_ELEMENTS: Dict[str, Set[str]] = {
    "Patient": {
        "identifier",
        "active", 
        "name",
        "telecom",
        "gender",
        "birthDate",
        "deceasedBoolean",
        "deceasedDateTime",
        "address",
        "maritalStatus",
        "multipleBirthBoolean",
        "multipleBirthInteger",
        "photo",
        "contact",
        "communication",
        "generalPractitioner",
        "managingOrganization",
        "link"
    },
    
    "Observation": {
        "identifier",
        "basedOn",
        "partOf",
        "status",
        "category",
        "code",
        "subject",
        "focus",
        "encounter",
        "effectiveDateTime",
        "effectivePeriod",
        "effectiveTiming",
        "effectiveInstant",
        "issued",
        "performer",
        "valueQuantity",
        "valueCodeableConcept",
        "valueString",
        "valueBoolean",
        "valueInteger",
        "valueRange",
        "valueRatio",
        "valueSampledData",
        "valueTime",
        "valueDateTime",
        "valuePeriod",
        "dataAbsentReason",
        "interpretation",
        "note",
        "bodySite",
        "method",
        "specimen",
        "device",
        "referenceRange",
        "hasMember",
        "derivedFrom"
    },
    
    "Condition": {
        "identifier",
        "clinicalStatus",
        "verificationStatus", 
        "category",
        "severity",
        "code",
        "bodySite",
        "subject",
        "encounter",
        "onsetDateTime",
        "onsetAge",
        "onsetPeriod",
        "onsetRange",
        "onsetString",
        "abatementDateTime",
        "abatementAge",
        "abatementPeriod",
        "abatementRange",
        "abatementString",
        "recordedDate",
        "recorder",
        "asserter",
        "stage",
        "evidence",
        "note"
    },
    
    "MedicationRequest": {
        "identifier",
        "status",
        "statusReason",
        "intent",
        "category",
        "priority",
        "doNotPerform",
        "reportedBoolean",
        "reportedReference",
        "medicationCodeableConcept",
        "medicationReference",
        "subject",
        "encounter",
        "supportingInformation",
        "authoredOn",
        "requester",
        "performer",
        "performerType",
        "recorder",
        "reasonCode",
        "reasonReference",
        "instantiatesCanonical",
        "instantiatesUri",
        "basedOn",
        "groupIdentifier",
        "courseOfTherapyType",
        "insurance",
        "note"
    },
    
    "Encounter": {
        "identifier",
        "status",
        "statusHistory",
        "class",
        "classHistory",
        "type",
        "serviceType",
        "priority",
        "subject",
        "episodeOfCare",
        "basedOn",
        "participant",
        "appointment",
        "period",
        "length",
        "reasonCode",
        "reasonReference",
        "diagnosis",
        "account",
        "hospitalization",
        "location",
        "serviceProvider",
        "partOf"
    },
    
    "Procedure": {
        "identifier",
        "instantiatesCanonical",
        "instantiatesUri",
        "basedOn",
        "partOf",
        "status",
        "statusReason",
        "category",
        "code",
        "subject",
        "encounter",
        "performedDateTime",
        "performedPeriod",
        "performedString",
        "performedAge",
        "performedRange",
        "recorder",
        "asserter",
        "performer",
        "location",
        "reasonCode",
        "reasonReference",
        "bodySite",
        "outcome",
        "report",
        "complication",
        "complicationDetail",
        "followUp",
        "note",
        "focalDevice",
        "usedReference",
        "usedCode"
    },
    
    "AllergyIntolerance": {
        "identifier",
        "clinicalStatus",
        "verificationStatus",
        "type",
        "category",
        "criticality",
        "code",
        "patient",
        "encounter",
        "onsetDateTime",
        "onsetAge",
        "onsetPeriod",
        "onsetRange",
        "onsetString",
        "recordedDate",
        "recorder",
        "asserter",
        "lastOccurrence",
        "note",
        "reaction"
    },
    
    "DiagnosticReport": {
        "identifier",
        "basedOn",
        "status",
        "category",
        "code",
        "subject",
        "encounter",
        "effectiveDateTime",
        "effectivePeriod",
        "issued",
        "performer",
        "resultsInterpreter",
        "specimen",
        "result",
        "imagingStudy",
        "media",
        "conclusion",
        "conclusionCode",
        "presentedForm"
    },
    
    "ImagingStudy": {
        "identifier",
        "status",
        "modality",
        "subject",
        "encounter",
        "started",
        "basedOn",
        "referrer",
        "interpreter",
        "endpoint",
        "numberOfSeries",
        "numberOfInstances",
        "procedureReference",
        "procedureCode",
        "location",
        "reasonCode",
        "reasonReference",
        "note",
        "description",
        "series"
    },
    
    "DocumentReference": {
        "masterIdentifier",
        "identifier",
        "status",
        "docStatus",
        "type",
        "category",
        "subject",
        "date",
        "author",
        "authenticator",
        "custodian",
        "relatesTo",
        "description",
        "securityLabel",
        "content",
        "context"
    },
    
    "Coverage": {
        "identifier",
        "status",
        "type",
        "policyHolder",
        "subscriber",
        "subscriberId",
        "beneficiary",
        "dependent",
        "relationship",
        "period",
        "payor",
        "class",
        "order",
        "network",
        "costToBeneficiary",
        "subrogation",
        "contract"
    },
    
    "Organization": {
        "identifier",
        "active",
        "type",
        "name",
        "alias",
        "telecom",
        "address",
        "partOf",
        "contact",
        "endpoint"
    },
    
    "Practitioner": {
        "identifier",
        "active",
        "name",
        "telecom",
        "address",
        "gender",
        "birthDate",
        "photo",
        "qualification",
        "communication"
    },
    
    "PractitionerRole": {
        "identifier",
        "active",
        "period",
        "practitioner",
        "organization",
        "code",
        "specialty",
        "location",
        "healthcareService",
        "telecom",
        "availableTime",
        "notAvailable",
        "availabilityExceptions",
        "endpoint"
    },
    
    "Location": {
        "identifier",
        "status",
        "operationalStatus",
        "name",
        "alias",
        "description",
        "mode",
        "type",
        "telecom",
        "address",
        "physicalType",
        "position",
        "managingOrganization",
        "partOf",
        "hoursOfOperation",
        "availabilityExceptions",
        "endpoint"
    },
    
    "ServiceRequest": {
        "identifier",
        "instantiatesCanonical",
        "instantiatesUri",
        "basedOn",
        "replaces",
        "requisition",
        "status",
        "intent",
        "category",
        "priority",
        "doNotPerform",
        "code",
        "orderDetail",
        "quantityQuantity",
        "quantityRatio",
        "quantityRange",
        "subject",
        "encounter",
        "occurrenceDateTime",
        "occurrencePeriod",
        "occurrenceTiming",
        "asNeededBoolean",
        "asNeededCodeableConcept",
        "authoredOn",
        "requester",
        "performerType",
        "performer",
        "locationCode",
        "locationReference",
        "reasonCode",
        "reasonReference",
        "insurance",
        "supportingInfo",
        "specimen",
        "bodySite",
        "note",
        "patientInstruction",
        "relevantHistory"
    },
    
    "MedicationDispense": {
        "identifier",
        "partOf",
        "status",
        "statusReasonCodeableConcept",
        "statusReasonReference",
        "category",
        "medicationCodeableConcept",
        "medicationReference",
        "subject",
        "context",
        "supportingInformation",
        "performer",
        "location",
        "authorizingPrescription",
        "type",
        "quantity",
        "daysSupply",
        "whenPrepared",
        "whenHandedOver",
        "destination",
        "receiver",
        "note",
        "dosageInstruction",
        "substitution",
        "detectedIssue",
        "eventHistory"
    },
    
    "Immunization": {
        "identifier",
        "status",
        "statusReason",
        "vaccineCode",
        "patient",
        "encounter",
        "occurrenceDateTime",
        "occurrenceString",
        "recorded",
        "primarySource",
        "reportOrigin",
        "location",
        "manufacturer",
        "lotNumber",
        "expirationDate",
        "site",
        "route",
        "doseQuantity",
        "performer",
        "note",
        "reasonCode",
        "reasonReference",
        "isSubpotent",
        "subpotentReason",
        "education",
        "programEligibility",
        "fundingSource",
        "reaction",
        "protocolApplied"
    },
    
    "CarePlan": {
        "identifier",
        "instantiatesCanonical",
        "instantiatesUri",
        "basedOn",
        "replaces",
        "partOf",
        "status",
        "intent",
        "category",
        "title",
        "description",
        "subject",
        "encounter",
        "period",
        "created",
        "author",
        "contributor",
        "careTeam",
        "addresses",
        "supportingInfo",
        "goal",
        "activity",
        "note"
    },
    
    "CareTeam": {
        "identifier",
        "status",
        "category",
        "name",
        "subject",
        "encounter",
        "period",
        "participant",
        "reasonCode",
        "reasonReference",
        "managingOrganization",
        "telecom",
        "note"
    }
}


def get_summary_fields(resource_type: str) -> Set[str]:
    """
    Get the set of fields to include for a resource when _summary=true.
    
    Args:
        resource_type: The FHIR resource type
        
    Returns:
        Set of field names to include in the summary
    """
    # Start with base elements
    fields = BASE_SUMMARY_ELEMENTS.copy()
    
    # Add resource-specific summary elements
    if resource_type in RESOURCE_SUMMARY_ELEMENTS:
        fields.update(RESOURCE_SUMMARY_ELEMENTS[resource_type])
    
    return fields


def apply_summary_to_resource(resource: Dict, summary_mode: str) -> Dict:
    """
    Apply _summary parameter to a single resource.
    
    Args:
        resource: The FHIR resource dictionary
        summary_mode: The _summary mode (true, text, data, count, false)
        
    Returns:
        The filtered resource based on summary mode
    """
    if not resource or summary_mode == "false" or not summary_mode:
        return resource
        
    resource_type = resource.get("resourceType")
    if not resource_type:
        return resource
    
    if summary_mode == "true":
        # Return only summary elements
        summary_fields = get_summary_fields(resource_type)
        return _filter_resource_fields(resource, summary_fields)
        
    elif summary_mode == "text":
        # Return only text, id, meta, and mandatory elements
        text_fields = {"resourceType", "id", "meta", "implicitRules", "text"}
        # Add mandatory elements based on resource type
        # For now, keep it simple with just the base fields
        return _filter_resource_fields(resource, text_fields)
        
    elif summary_mode == "data":
        # Remove text element
        result = resource.copy()
        result.pop("text", None)
        return result
        
    elif summary_mode == "count":
        # This is handled at bundle level, not resource level
        return resource
        
    return resource


def _filter_resource_fields(resource: Dict, allowed_fields: Set[str]) -> Dict:
    """
    Filter a resource to only include allowed fields.
    
    Handles nested fields properly to maintain resource structure.
    """
    result = {}
    
    for field, value in resource.items():
        if field in allowed_fields:
            if isinstance(value, list):
                # Handle arrays - check if they contain complex objects
                if value and isinstance(value[0], dict):
                    # For complex objects in arrays, we include the whole object
                    # This handles cases like Patient.name, Patient.address, etc.
                    result[field] = value
                else:
                    # Simple arrays
                    result[field] = value
            elif isinstance(value, dict):
                # For nested objects, include the whole object if the field is allowed
                result[field] = value
            else:
                # Simple values
                result[field] = value
    
    return result


def apply_elements_to_resource(resource: Dict, elements: List[str]) -> Dict:
    """
    Apply _elements parameter to filter resource fields.
    
    Args:
        resource: The FHIR resource dictionary
        elements: List of element paths to include
        
    Returns:
        The filtered resource
    """
    if not elements:
        return resource
        
    # Always include mandatory elements
    result = {
        "resourceType": resource.get("resourceType"),
        "id": resource.get("id")
    }
    
    if "meta" in resource:
        result["meta"] = resource["meta"]
    
    # Process each requested element
    for element_path in elements:
        if "." in element_path:
            # Handle nested paths
            _apply_nested_element(resource, result, element_path)
        else:
            # Simple field
            if element_path in resource:
                result[element_path] = resource[element_path]
    
    return result


def _apply_nested_element(source: Dict, target: Dict, path: str):
    """
    Apply a nested element path to copy from source to target.
    
    Example: "name.family" would copy resource["name"][n]["family"]
    """
    parts = path.split(".")
    current_source = source
    
    # Navigate to the parent of the final element
    for i, part in enumerate(parts[:-1]):
        if part not in current_source:
            return
            
        if i == 0:
            # First level - ensure structure exists in target
            if part not in target:
                if isinstance(current_source[part], list):
                    target[part] = []
                else:
                    target[part] = {}
                    
        current_source = current_source[part]
    
    # Copy the final element
    final_part = parts[-1]
    if isinstance(current_source, list):
        # Handle arrays
        for i, item in enumerate(current_source):
            if isinstance(item, dict) and final_part in item:
                if len(target[parts[0]]) <= i:
                    target[parts[0]].append({})
                target[parts[0]][i][final_part] = item[final_part]
    elif isinstance(current_source, dict) and final_part in current_source:
        # Handle objects
        _ensure_nested_structure(target, parts[:-1])
        _set_nested_value(target, parts, current_source[final_part])


def _ensure_nested_structure(obj: Dict, path_parts: List[str]):
    """Ensure nested structure exists in object."""
    current = obj
    for part in path_parts:
        if part not in current:
            current[part] = {}
        current = current[part]


def _set_nested_value(obj: Dict, path_parts: List[str], value):
    """Set a value at a nested path."""
    current = obj
    for part in path_parts[:-1]:
        current = current[part]
    current[path_parts[-1]] = value