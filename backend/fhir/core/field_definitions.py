"""
FHIR R4 Field Definitions

Comprehensive field whitelists for each FHIR resource type based on the R4 specification.
Used to clean resources by removing any fields not in the specification.
"""

# Common fields that appear in all resources
COMMON_RESOURCE_FIELDS = {
    'resourceType', 'id', 'meta', 'implicitRules', 'language'
}

# Common fields for all DomainResource types
DOMAIN_RESOURCE_FIELDS = COMMON_RESOURCE_FIELDS | {
    'text', 'contained', 'extension', 'modifierExtension'
}

# Common fields for all BackboneElements
BACKBONE_ELEMENT_FIELDS = {
    'id', 'extension', 'modifierExtension'
}

# Field definitions for each resource type
RESOURCE_FIELDS = {
    'Patient': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'active', 'name', 'telecom', 'gender', 'birthDate',
        'deceasedBoolean', 'deceasedDateTime', 'address', 'maritalStatus',
        'multipleBirthBoolean', 'multipleBirthInteger', 'photo', 'contact',
        'communication', 'generalPractitioner', 'managingOrganization', 'link'
    },
    
    'Encounter': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'status', 'statusHistory', 'class', 'classHistory', 'type',
        'serviceType', 'priority', 'subject', 'episodeOfCare', 'basedOn',
        'participant', 'appointment', 'period', 'actualPeriod', 'length', 'reasonCode', 'reason',
        'reasonReference', 'diagnosis', 'account', 'hospitalization', 'admission',
        'location', 'serviceProvider', 'partOf', 'careTeam', 'dietPreference',
        'specialArrangement', 'specialCourtesy'
    },
    
    'Observation': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'basedOn', 'partOf', 'status', 'category', 'code',
        'subject', 'focus', 'encounter', 'effectiveDateTime', 'effectivePeriod',
        'effectiveTiming', 'effectiveInstant', 'issued', 'performer',
        'valueQuantity', 'valueCodeableConcept', 'valueString', 'valueBoolean',
        'valueInteger', 'valueRange', 'valueRatio', 'valueSampledData',
        'valueTime', 'valueDateTime', 'valuePeriod', 'dataAbsentReason',
        'interpretation', 'note', 'bodySite', 'method', 'specimen', 'device',
        'referenceRange', 'hasMember', 'derivedFrom', 'component'
    },
    
    'Condition': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'clinicalStatus', 'verificationStatus', 'category',
        'severity', 'code', 'bodySite', 'subject', 'encounter', 'onsetDateTime',
        'onsetAge', 'onsetPeriod', 'onsetRange', 'onsetString',
        'abatementDateTime', 'abatementAge', 'abatementPeriod',
        'abatementRange', 'abatementString', 'recordedDate', 'recorder',
        'asserter', 'stage', 'evidence', 'note'
    },
    
    'Procedure': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'instantiatesCanonical', 'instantiatesUri', 'basedOn',
        'partOf', 'status', 'statusReason', 'category', 'code', 'subject',
        'encounter', 'performedDateTime', 'performedPeriod', 'performedString',
        'performedAge', 'performedRange', 'occurrenceDateTime', 'occurrencePeriod', 
        'occurrenceString', 'occurrenceAge', 'occurrenceRange', 'occurrenceTiming',
        'recorder', 'asserter', 'performer',
        'location', 'reason', 'bodySite', 'outcome',
        'report', 'complication', 'complicationDetail', 'followUp', 'note',
        'focalDevice', 'used'
    },
    
    'MedicationRequest': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'status', 'statusReason', 'intent', 'category', 'priority',
        'doNotPerform', 'reportedBoolean', 'reportedReference',
        'medication', 'medicationCodeableConcept', 'medicationReference', 'subject',
        'encounter', 'supportingInformation', 'authoredOn', 'requester',
        'performer', 'performerType', 'recorder', 'reason',
        'instantiatesCanonical', 'instantiatesUri',
        'basedOn', 'groupIdentifier', 'courseOfTherapyType', 'insurance',
        'note', 'dosageInstruction', 'dispenseRequest', 'substitution',
        'priorPrescription', 'detectedIssue', 'eventHistory'
    },
    
    'DiagnosticReport': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'basedOn', 'status', 'category', 'code', 'subject',
        'encounter', 'effectiveDateTime', 'effectivePeriod', 'issued',
        'performer', 'resultsInterpreter', 'specimen', 'result',
        'imagingStudy', 'media', 'conclusion', 'conclusionCode',
        'presentedForm'
    },
    
    'DocumentReference': DOMAIN_RESOURCE_FIELDS | {
        'masterIdentifier', 'identifier', 'status', 'docStatus', 'type',
        'category', 'subject', 'date', 'author', 'authenticator', 'custodian',
        'relatesTo', 'description', 'securityLabel', 'content', 'context'
    },
    
    'Organization': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'active', 'type', 'name', 'alias', 'telecom', 'address',
        'partOf', 'contact', 'endpoint'
    },
    
    'Practitioner': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'active', 'name', 'telecom', 'address', 'gender',
        'birthDate', 'photo', 'qualification', 'communication'
    },
    
    'Location': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'status', 'operationalStatus', 'name', 'alias',
        'description', 'mode', 'type', 'telecom', 'address', 'physicalType',
        'position', 'managingOrganization', 'partOf', 'hoursOfOperation',
        'availabilityExceptions', 'endpoint'
    },
    
    'Device': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'definition', 'udiCarrier', 'status', 'statusReason',
        'distinctIdentifier', 'manufacturer', 'manufactureDate',
        'expirationDate', 'lotNumber', 'serialNumber', 'deviceName',
        'modelNumber', 'partNumber', 'type', 'specialization', 'version',
        'property', 'patient', 'owner', 'contact', 'location', 'url', 'note',
        'safety', 'parent'
    },
    
    'Claim': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'status', 'type', 'subType', 'use', 'patient',
        'billablePeriod', 'created', 'enterer', 'insurer', 'provider',
        'priority', 'fundsReserve', 'related', 'prescription',
        'originalPrescription', 'payee', 'referral', 'facility', 'careTeam',
        'supportingInfo', 'diagnosis', 'procedure', 'insurance', 'accident',
        'item', 'total'
    },
    
    'ExplanationOfBenefit': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'status', 'type', 'subType', 'use', 'patient',
        'billablePeriod', 'created', 'enterer', 'insurer', 'provider',
        'priority', 'fundsReserveRequested', 'fundsReserve', 'related',
        'prescription', 'originalPrescription', 'payee', 'referral',
        'facility', 'claim', 'claimResponse', 'outcome', 'disposition',
        'preAuthRef', 'preAuthRefPeriod', 'careTeam', 'supportingInfo',
        'diagnosis', 'procedure', 'precedence', 'insurance', 'accident',
        'item', 'addItem', 'adjudication', 'total', 'payment', 'formCode',
        'form', 'processNote', 'benefitPeriod', 'benefitBalance'
    },
    
    'ImagingStudy': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'status', 'modality', 'subject', 'encounter', 'started',
        'basedOn', 'referrer', 'interpreter', 'endpoint', 'numberOfSeries',
        'numberOfInstances', 'procedureReference', 'procedureCode', 'location',
        'reasonCode', 'reasonReference', 'note', 'description', 'series'
    },
    
    'Immunization': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'status', 'statusReason', 'vaccineCode', 'patient',
        'encounter', 'occurrenceDateTime', 'occurrenceString', 'recorded',
        'primarySource', 'reportOrigin', 'location', 'manufacturer',
        'lotNumber', 'expirationDate', 'site', 'route', 'doseQuantity',
        'performer', 'note', 'reasonCode', 'reasonReference', 'isSubpotent',
        'subpotentReason', 'education', 'programEligibility', 'fundingSource',
        'reaction', 'protocolApplied'
    },
    
    'AllergyIntolerance': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'clinicalStatus', 'verificationStatus', 'type',
        'category', 'criticality', 'code', 'patient', 'encounter',
        'onsetDateTime', 'onsetAge', 'onsetPeriod', 'onsetRange', 'onsetString',
        'recordedDate', 'recorder', 'asserter', 'lastOccurrence', 'note',
        'reaction'
    },
    
    'CarePlan': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'instantiatesCanonical', 'instantiatesUri', 'basedOn',
        'replaces', 'partOf', 'status', 'intent', 'category', 'title',
        'description', 'subject', 'encounter', 'period', 'created', 'author',
        'contributor', 'careTeam', 'addresses', 'supportingInfo', 'goal',
        'activity', 'note'
    },
    
    'CareTeam': DOMAIN_RESOURCE_FIELDS | {
        'identifier', 'status', 'category', 'name', 'subject', 'encounter',
        'period', 'participant', 'reasonCode', 'reasonReference',
        'managingOrganization', 'telecom', 'note'
    },
}

# BackboneElement field definitions
BACKBONE_ELEMENTS = {
    'Encounter.statusHistory': BACKBONE_ELEMENT_FIELDS | {
        'status', 'period'
    },
    'Encounter.classHistory': BACKBONE_ELEMENT_FIELDS | {
        'class', 'period'
    },
    'Encounter.participant': BACKBONE_ELEMENT_FIELDS | {
        'type', 'period', 'actor'  # Note: NOT 'individual'
    },
    'Encounter.diagnosis': BACKBONE_ELEMENT_FIELDS | {
        'condition', 'use', 'rank'
    },
    'Encounter.hospitalization': BACKBONE_ELEMENT_FIELDS | {
        'preAdmissionIdentifier', 'origin', 'admitSource',
        'reAdmission', 'dietPreference', 'specialCourtesy',
        'specialArrangement', 'destination', 'dischargeDisposition'
    },
    'Encounter.location': BACKBONE_ELEMENT_FIELDS | {
        'location', 'status', 'physicalType', 'period'
    },
    'Observation.component': BACKBONE_ELEMENT_FIELDS | {
        'code', 'valueQuantity', 'valueCodeableConcept', 'valueString',
        'valueBoolean', 'valueInteger', 'valueRange', 'valueRatio',
        'valueSampledData', 'valueTime', 'valueDateTime', 'valuePeriod',
        'dataAbsentReason', 'interpretation', 'referenceRange'
    },
    'Observation.referenceRange': BACKBONE_ELEMENT_FIELDS | {
        'low', 'high', 'type', 'appliesTo', 'age', 'text'
    },
    'MedicationRequest.dosageInstruction': BACKBONE_ELEMENT_FIELDS | {
        'sequence', 'text', 'additionalInstruction', 'patientInstruction',
        'timing', 'asNeeded', 'asNeededFor', 'site', 'route', 'method',
        'doseAndRate', 'maxDosePerPeriod', 'maxDosePerAdministration',
        'maxDosePerLifetime'
    },
    'MedicationRequest.dispenseRequest': BACKBONE_ELEMENT_FIELDS | {
        'initialFill', 'dispenseInterval', 'validityPeriod',
        'numberOfRepeatsAllowed', 'quantity', 'expectedSupplyDuration',
        'performer'
    },
    'Device.udiCarrier': BACKBONE_ELEMENT_FIELDS | {
        'deviceIdentifier', 'issuer', 'jurisdiction', 'carrierAIDC',
        'carrierHRF', 'entryType'
    },
    'Device.deviceName': BACKBONE_ELEMENT_FIELDS | {
        'name', 'type'
    },
    'DocumentReference.content': BACKBONE_ELEMENT_FIELDS | {
        'attachment', 'format'
    },
    'DocumentReference.context': BACKBONE_ELEMENT_FIELDS | {
        'encounter', 'event', 'period', 'facilityType', 'practiceSetting',
        'sourcePatientInfo', 'related'
    },
    'CarePlan.activity': BACKBONE_ELEMENT_FIELDS | {
        'outcomeCodeableConcept', 'outcomeReference', 'progress', 'reference', 'detail',
        'plannedActivityReference', 'performedActivity'
    },
    'CarePlan.activity.detail': BACKBONE_ELEMENT_FIELDS | {
        'kind', 'instantiatesCanonical', 'instantiatesUri', 'code', 'reasonCode',
        'reasonReference', 'goal', 'status', 'statusReason', 'doNotPerform',
        'scheduledTiming', 'scheduledPeriod', 'scheduledString', 'location',
        'performer', 'productCodeableConcept', 'productReference', 'dailyAmount',
        'quantity', 'description'
    },
}

def clean_resource(resource: dict) -> dict:
    """
    Clean a FHIR resource by removing fields not in the R4 specification.
    
    Args:
        resource: The resource to clean
        
    Returns:
        Cleaned resource with only valid fields
    """
    import copy
    
    cleaned = copy.deepcopy(resource)
    resource_type = cleaned.get('resourceType')
    
    if not resource_type or resource_type not in RESOURCE_FIELDS:
        return cleaned
    
    # Get allowed fields for this resource type
    allowed_fields = RESOURCE_FIELDS[resource_type]
    
    # Remove top-level fields not in allowed list
    keys_to_remove = [k for k in cleaned.keys() if k not in allowed_fields]
    for key in keys_to_remove:
        del cleaned[key]
    
    # Clean backbone elements
    _clean_backbone_elements(cleaned, resource_type)
    
    return cleaned


def _clean_backbone_elements(resource: dict, resource_type: str):
    """Clean backbone elements within a resource."""
    # Clean common backbone elements
    if 'identifier' in resource and isinstance(resource['identifier'], list):
        for identifier in resource['identifier']:
            _clean_dict(identifier, BACKBONE_ELEMENT_FIELDS | {
                'use', 'type', 'system', 'value', 'period', 'assigner'
            })
    
    if 'name' in resource and isinstance(resource['name'], list):
        for name in resource['name']:
            _clean_dict(name, BACKBONE_ELEMENT_FIELDS | {
                'use', 'text', 'family', 'given', 'prefix', 'suffix', 'period'
            })
    
    if 'telecom' in resource and isinstance(resource['telecom'], list):
        for telecom in resource['telecom']:
            _clean_dict(telecom, BACKBONE_ELEMENT_FIELDS | {
                'system', 'value', 'use', 'rank', 'period'
            })
    
    if 'address' in resource and isinstance(resource['address'], list):
        for address in resource['address']:
            _clean_dict(address, BACKBONE_ELEMENT_FIELDS | {
                'use', 'type', 'text', 'line', 'city', 'district', 'state',
                'postalCode', 'country', 'period'
            })
    
    # Clean resource-specific backbone elements
    # First pass: clean direct backbone elements
    for field_path, allowed_fields in BACKBONE_ELEMENTS.items():
        if field_path.startswith(resource_type + '.'):
            parts = field_path.split('.')
            if len(parts) == 2:  # Direct backbone element like CarePlan.activity
                field_name = parts[1]
                if field_name in resource:
                    if isinstance(resource[field_name], list):
                        for item in resource[field_name]:
                            _clean_dict(item, allowed_fields)
                            # Clean nested backbone elements within this item
                            _clean_nested_backbone_elements(item, field_path, resource_type)
                    elif isinstance(resource[field_name], dict):
                        _clean_dict(resource[field_name], allowed_fields)
                        # Clean nested backbone elements within this item
                        _clean_nested_backbone_elements(resource[field_name], field_path, resource_type)


def _clean_nested_backbone_elements(parent_item: dict, parent_path: str, resource_type: str):
    """Clean nested backbone elements within a parent backbone element."""
    if not isinstance(parent_item, dict):
        return
    
    # Look for nested backbone elements like CarePlan.activity.detail
    for field_path, allowed_fields in BACKBONE_ELEMENTS.items():
        if field_path.startswith(parent_path + '.'):
            # Extract the nested field name
            remaining_path = field_path[len(parent_path) + 1:]
            if '.' not in remaining_path:  # Direct child field
                field_name = remaining_path
                if field_name in parent_item:
                    if isinstance(parent_item[field_name], list):
                        for item in parent_item[field_name]:
                            _clean_dict(item, allowed_fields)
                    elif isinstance(parent_item[field_name], dict):
                        _clean_dict(parent_item[field_name], allowed_fields)


def _clean_dict(obj: dict, allowed_fields: set):
    """Remove fields from a dictionary that aren't in the allowed set."""
    if not isinstance(obj, dict):
        return
    
    keys_to_remove = [k for k in obj.keys() if k not in allowed_fields]
    for key in keys_to_remove:
        del obj[key]