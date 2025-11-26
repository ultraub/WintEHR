"""
FHIR R4 Schema Definitions
Provides structured schema information for FHIR resources
"""

# Core FHIR R4 Resource Schemas
FHIR_R4_SCHEMAS = {
    "Patient": {
        "description": "Demographics and other administrative information about an individual or animal receiving care or other health-related services",
        "url": "http://hl7.org/fhir/StructureDefinition/Patient",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": "Patient",
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            },
            "identifier": {
                "type": "Identifier",
                "array": True,
                "required": False,
                "description": "An identifier for this patient"
            },
            "active": {
                "type": "boolean",
                "required": False,
                "description": "Whether this patient record is in active use"
            },
            "name": {
                "type": "HumanName",
                "array": True,
                "required": False,
                "description": "A name associated with the patient"
            },
            "telecom": {
                "type": "ContactPoint",
                "array": True,
                "required": False,
                "description": "A contact detail for the individual"
            },
            "gender": {
                "type": "code",
                "required": False,
                "binding": "AdministrativeGender",
                "description": "male | female | other | unknown"
            },
            "birthDate": {
                "type": "date",
                "required": False,
                "description": "The date of birth for the individual"
            },
            "deceasedBoolean": {
                "type": "boolean",
                "required": False,
                "description": "Indicates if the individual is deceased or not"
            },
            "deceasedDateTime": {
                "type": "dateTime",
                "required": False,
                "description": "Time of death"
            },
            "address": {
                "type": "Address",
                "array": True,
                "required": False,
                "description": "An address for the individual"
            },
            "maritalStatus": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "MaritalStatus",
                "description": "Marital (civil) status of a patient"
            },
            "multipleBirthBoolean": {
                "type": "boolean",
                "required": False,
                "description": "Whether patient is part of a multiple birth"
            },
            "multipleBirthInteger": {
                "type": "integer",
                "required": False,
                "description": "Birth order"
            },
            "photo": {
                "type": "Attachment",
                "array": True,
                "required": False,
                "description": "Image of the patient"
            },
            "contact": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "A contact party (e.g. guardian, partner, friend) for the patient"
            },
            "communication": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "A language which may be used to communicate with the patient"
            },
            "generalPractitioner": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Organization", "Practitioner", "PractitionerRole"],
                "description": "Patient's primary care provider"
            },
            "managingOrganization": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Organization"],
                "description": "Organization that is the custodian of the patient record"
            },
            "link": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "Link to another patient resource that concerns the same actual patient"
            }
        }
    },
    "Condition": {
        "description": "A clinical condition, problem, diagnosis, or other event, situation, issue, or clinical concept that has risen to a level of concern",
        "url": "http://hl7.org/fhir/StructureDefinition/Condition",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": "Condition",
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            },
            "identifier": {
                "type": "Identifier",
                "array": True,
                "required": False,
                "description": "External identifiers for this condition"
            },
            "clinicalStatus": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ConditionClinicalStatus",
                "description": "active | recurrence | relapse | inactive | remission | resolved"
            },
            "verificationStatus": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ConditionVerificationStatus",
                "description": "unconfirmed | provisional | differential | confirmed | refuted | entered-in-error"
            },
            "category": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "ConditionCategory",
                "description": "problem-list-item | encounter-diagnosis"
            },
            "severity": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ConditionSeverity",
                "description": "Subjective severity of condition"
            },
            "code": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ConditionCode",
                "description": "Identification of the condition, problem or diagnosis"
            },
            "bodySite": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "BodySite",
                "description": "Anatomical location, if relevant"
            },
            "subject": {
                "type": "Reference",
                "required": True,
                "targetTypes": ["Patient", "Group"],
                "description": "Who has the condition?"
            },
            "encounter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Encounter"],
                "description": "Encounter created as part of"
            },
            "onsetDateTime": {
                "type": "dateTime",
                "required": False,
                "description": "Estimated or actual date, date-time, or age"
            },
            "onsetAge": {
                "type": "Age",
                "required": False,
                "description": "Age when condition started"
            },
            "onsetPeriod": {
                "type": "Period",
                "required": False,
                "description": "Period when condition was active"
            },
            "onsetRange": {
                "type": "Range",
                "required": False,
                "description": "Age range when condition started"
            },
            "onsetString": {
                "type": "string",
                "required": False,
                "description": "Simple text description of when condition started"
            },
            "abatementDateTime": {
                "type": "dateTime",
                "required": False,
                "description": "When in resolution/remission"
            },
            "abatementAge": {
                "type": "Age",
                "required": False,
                "description": "Age when condition resolved"
            },
            "abatementPeriod": {
                "type": "Period",
                "required": False,
                "description": "Period when condition was resolved"
            },
            "abatementRange": {
                "type": "Range",
                "required": False,
                "description": "Age range when condition resolved"
            },
            "abatementString": {
                "type": "string",
                "required": False,
                "description": "Simple text description of resolution"
            },
            "recordedDate": {
                "type": "dateTime",
                "required": False,
                "description": "Date record was first recorded"
            },
            "recorder": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"],
                "description": "Who recorded the condition"
            },
            "asserter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"],
                "description": "Person who asserts this condition"
            },
            "stage": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "Stage/grade, usually assessed formally"
            },
            "evidence": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "Supporting evidence"
            },
            "note": {
                "type": "Annotation",
                "array": True,
                "required": False,
                "description": "Additional information about the Condition"
            }
        }
    },
    "Observation": {
        "description": "Measurements and simple assertions made about a patient, device or other subject",
        "url": "http://hl7.org/fhir/StructureDefinition/Observation",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": "Observation",
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            },
            "identifier": {
                "type": "Identifier",
                "array": True,
                "required": False,
                "description": "Business identifier for observation"
            },
            "basedOn": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["CarePlan", "DeviceRequest", "ImmunizationRecommendation", "MedicationRequest", "NutritionOrder", "ServiceRequest"],
                "description": "Fulfills plan, proposal or order"
            },
            "partOf": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["MedicationAdministration", "MedicationDispense", "MedicationStatement", "Procedure", "Immunization", "ImagingStudy"],
                "description": "Part of referenced event"
            },
            "status": {
                "type": "code",
                "required": True,
                "binding": "ObservationStatus",
                "description": "registered | preliminary | final | amended | corrected | cancelled | entered-in-error | unknown"
            },
            "category": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "ObservationCategory",
                "description": "Classification of type of observation"
            },
            "code": {
                "type": "CodeableConcept",
                "required": True,
                "binding": "ObservationCode",
                "description": "Type of observation (code / type)"
            },
            "subject": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Patient", "Group", "Device", "Location"],
                "description": "Who and/or what the observation is about"
            },
            "focus": {
                "type": "Reference",
                "array": True,
                "required": False,
                "description": "What the observation is about, when it is not about the subject of record"
            },
            "encounter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Encounter"],
                "description": "Healthcare event during which this observation is made"
            },
            "effectiveDateTime": {
                "type": "dateTime",
                "required": False,
                "description": "Clinically relevant time/time-period for observation"
            },
            "effectivePeriod": {
                "type": "Period",
                "required": False,
                "description": "Clinically relevant time-period for observation"
            },
            "effectiveTiming": {
                "type": "Timing",
                "required": False,
                "description": "Clinically relevant timing for observation"
            },
            "effectiveInstant": {
                "type": "instant",
                "required": False,
                "description": "Clinically relevant instant for observation"
            },
            "issued": {
                "type": "instant",
                "required": False,
                "description": "Date/Time this version was made available"
            },
            "performer": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole", "Organization", "CareTeam", "Patient", "RelatedPerson"],
                "description": "Who is responsible for the observation"
            },
            "valueQuantity": {
                "type": "Quantity",
                "required": False,
                "description": "Actual result"
            },
            "valueCodeableConcept": {
                "type": "CodeableConcept",
                "required": False,
                "description": "Actual result"
            },
            "valueString": {
                "type": "string",
                "required": False,
                "description": "Actual result"
            },
            "valueBoolean": {
                "type": "boolean",
                "required": False,
                "description": "Actual result"
            },
            "valueInteger": {
                "type": "integer",
                "required": False,
                "description": "Actual result"
            },
            "valueRange": {
                "type": "Range",
                "required": False,
                "description": "Actual result"
            },
            "valueRatio": {
                "type": "Ratio",
                "required": False,
                "description": "Actual result"
            },
            "valueSampledData": {
                "type": "SampledData",
                "required": False,
                "description": "Actual result"
            },
            "valueTime": {
                "type": "time",
                "required": False,
                "description": "Actual result"
            },
            "valueDateTime": {
                "type": "dateTime",
                "required": False,
                "description": "Actual result"
            },
            "valuePeriod": {
                "type": "Period",
                "required": False,
                "description": "Actual result"
            },
            "dataAbsentReason": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "DataAbsentReason",
                "description": "Why the result is missing"
            },
            "interpretation": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "ObservationInterpretation",
                "description": "High, low, normal, etc."
            },
            "note": {
                "type": "Annotation",
                "array": True,
                "required": False,
                "description": "Comments about the observation"
            },
            "bodySite": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "BodySite",
                "description": "Observed body part"
            },
            "method": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ObservationMethod",
                "description": "How it was done"
            },
            "specimen": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Specimen"],
                "description": "Specimen used for this observation"
            },
            "device": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Device", "DeviceMetric"],
                "description": "(Measurement) Device"
            },
            "referenceRange": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "Provides guide for interpretation"
            },
            "hasMember": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Observation", "QuestionnaireResponse", "MolecularSequence"],
                "description": "Related resource that belongs to the Observation group"
            },
            "derivedFrom": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["DocumentReference", "ImagingStudy", "Media", "QuestionnaireResponse", "Observation", "MolecularSequence"],
                "description": "Related measurements the observation is made from"
            },
            "component": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "Component results"
            }
        }
    },
    "MedicationRequest": {
        "description": "An order or request for both supply of the medication and the instructions for administration of the medication to a patient",
        "url": "http://hl7.org/fhir/StructureDefinition/MedicationRequest",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": "MedicationRequest",
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            },
            "identifier": {
                "type": "Identifier",
                "array": True,
                "required": False,
                "description": "External ids for this request"
            },
            "status": {
                "type": "code",
                "required": True,
                "binding": "MedicationRequestStatus",
                "description": "active | on-hold | cancelled | completed | entered-in-error | stopped | draft | unknown"
            },
            "statusReason": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "MedicationRequestStatusReason",
                "description": "Reason for current status"
            },
            "intent": {
                "type": "code",
                "required": True,
                "binding": "MedicationRequestIntent",
                "description": "proposal | plan | order | original-order | reflex-order | filler-order | instance-order | option"
            },
            "category": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "MedicationRequestCategory",
                "description": "Type of medication usage"
            },
            "priority": {
                "type": "code",
                "required": False,
                "binding": "RequestPriority",
                "description": "routine | urgent | asap | stat"
            },
            "doNotPerform": {
                "type": "boolean",
                "required": False,
                "description": "True if request is prohibiting action"
            },
            "reportedBoolean": {
                "type": "boolean",
                "required": False,
                "description": "Reported rather than primary record"
            },
            "reportedReference": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Patient", "Practitioner", "PractitionerRole", "RelatedPerson", "Organization"],
                "description": "Person/organization reporting the medication"
            },
            "medicationCodeableConcept": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "MedicationCode",
                "description": "Medication to be taken"
            },
            "medicationReference": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Medication"],
                "description": "Medication to be taken"
            },
            "subject": {
                "type": "Reference",
                "required": True,
                "targetTypes": ["Patient", "Group"],
                "description": "Who or group medication request is for"
            },
            "encounter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Encounter"],
                "description": "Encounter created as part of encounter/admission/stay"
            },
            "supportingInformation": {
                "type": "Reference",
                "array": True,
                "required": False,
                "description": "Information to support ordering of the medication"
            },
            "authoredOn": {
                "type": "dateTime",
                "required": False,
                "description": "When request was initially authored"
            },
            "requester": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"],
                "description": "Who/What requested the medication"
            },
            "performer": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole", "Organization", "Patient", "Device", "RelatedPerson", "CareTeam"],
                "description": "Intended performer of administration"
            },
            "performerType": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "MedicationPerformerType",
                "description": "Desired kind of performer of the medication administration"
            },
            "recorder": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole"],
                "description": "Person who entered the request"
            },
            "reasonCode": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "ConditionCode",
                "description": "Reason or indication for ordering or not ordering the medication"
            },
            "reasonReference": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Condition", "Observation"],
                "description": "Condition or observation that supports why the medication was ordered"
            },
            "instantiatesCanonical": {
                "type": "canonical",
                "array": True,
                "required": False,
                "description": "Instantiates FHIR protocol or definition"
            },
            "instantiatesUri": {
                "type": "uri",
                "array": True,
                "required": False,
                "description": "Instantiates external protocol or definition"
            },
            "basedOn": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["CarePlan", "MedicationRequest", "ServiceRequest", "ImmunizationRecommendation"],
                "description": "What request fulfills"
            },
            "groupIdentifier": {
                "type": "Identifier",
                "required": False,
                "description": "Composite request this is part of"
            },
            "courseOfTherapyType": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "MedicationRequestCourseOfTherapy",
                "description": "Overall pattern of medication administration"
            },
            "insurance": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Coverage", "ClaimResponse"],
                "description": "Associated insurance coverage"
            },
            "note": {
                "type": "Annotation",
                "array": True,
                "required": False,
                "description": "Information about the prescription"
            },
            "dosageInstruction": {
                "type": "Dosage",
                "array": True,
                "required": False,
                "description": "How the medication should be taken"
            },
            "dispenseRequest": {
                "type": "BackboneElement",
                "required": False,
                "description": "Medication supply authorization"
            },
            "substitution": {
                "type": "BackboneElement",
                "required": False,
                "description": "Any restrictions on medication substitution"
            },
            "priorPrescription": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["MedicationRequest"],
                "description": "An order/prescription that is being replaced"
            },
            "detectedIssue": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["DetectedIssue"],
                "description": "Clinical Issue with action"
            },
            "eventHistory": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Provenance"],
                "description": "A list of events of interest in the lifecycle"
            }
        }
    },
    "Procedure": {
        "description": "An action that is or was performed on or for a patient. This can be a physical intervention like an operation, or less invasive like long term services, counseling, or hypnotherapy",
        "url": "http://hl7.org/fhir/StructureDefinition/Procedure",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": "Procedure",
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            },
            "identifier": {
                "type": "Identifier",
                "array": True,
                "required": False,
                "description": "External identifiers for this procedure"
            },
            "instantiatesCanonical": {
                "type": "canonical",
                "array": True,
                "required": False,
                "description": "Instantiates FHIR protocol or definition"
            },
            "instantiatesUri": {
                "type": "uri",
                "array": True,
                "required": False,
                "description": "Instantiates external protocol or definition"
            },
            "basedOn": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["CarePlan", "ServiceRequest"],
                "description": "A request for this procedure"
            },
            "partOf": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Procedure", "Observation", "MedicationAdministration"],
                "description": "Part of referenced event"
            },
            "status": {
                "type": "code",
                "required": True,
                "binding": "EventStatus",
                "description": "preparation | in-progress | not-done | on-hold | stopped | completed | entered-in-error | unknown"
            },
            "statusReason": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ProcedureNotPerformedReason",
                "description": "Reason for current status"
            },
            "category": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ProcedureCategory",
                "description": "Classification of the procedure"
            },
            "code": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ProcedureCode",
                "description": "Identification of the procedure"
            },
            "subject": {
                "type": "Reference",
                "required": True,
                "targetTypes": ["Patient", "Group"],
                "description": "Who the procedure was performed on"
            },
            "encounter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Encounter"],
                "description": "Encounter created as part of"
            },
            "performedDateTime": {
                "type": "dateTime",
                "required": False,
                "description": "When the procedure was performed"
            },
            "performedPeriod": {
                "type": "Period",
                "required": False,
                "description": "When the procedure was performed"
            },
            "performedString": {
                "type": "string",
                "required": False,
                "description": "When the procedure was performed"
            },
            "performedAge": {
                "type": "Age",
                "required": False,
                "description": "When the procedure was performed"
            },
            "performedRange": {
                "type": "Range",
                "required": False,
                "description": "When the procedure was performed"
            },
            "recorder": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Patient", "RelatedPerson", "Practitioner", "PractitionerRole"],
                "description": "Who recorded the procedure"
            },
            "asserter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Patient", "RelatedPerson", "Practitioner", "PractitionerRole"],
                "description": "Person who asserts this procedure"
            },
            "performer": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "The people who performed the procedure"
            },
            "location": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Location"],
                "description": "Where the procedure happened"
            },
            "reasonCode": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "ProcedureReason",
                "description": "Coded reason procedure performed"
            },
            "reasonReference": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Condition", "Observation", "Procedure", "DiagnosticReport", "DocumentReference"],
                "description": "The justification that the procedure was performed"
            },
            "bodySite": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "BodySite",
                "description": "Target body sites"
            },
            "outcome": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ProcedureOutcome",
                "description": "The result of procedure"
            },
            "report": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["DiagnosticReport", "DocumentReference", "Composition"],
                "description": "Any report resulting from the procedure"
            },
            "complication": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "Condition",
                "description": "Complication following the procedure"
            },
            "complicationDetail": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Condition"],
                "description": "A condition that is a result of the procedure"
            },
            "followUp": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "ProcedureFollowUp",
                "description": "Instructions for follow up"
            },
            "note": {
                "type": "Annotation",
                "array": True,
                "required": False,
                "description": "Additional information about the procedure"
            },
            "focalDevice": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "Manipulated, implanted, or removed device"
            },
            "usedReference": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Device", "Medication", "Substance"],
                "description": "Items used during procedure"
            },
            "usedCode": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "FHIRDeviceType",
                "description": "Coded items used during the procedure"
            }
        }
    },
    "Encounter": {
        "description": "An interaction between a patient and healthcare provider(s) for the purpose of providing healthcare service(s) or assessing the health status of a patient",
        "url": "http://hl7.org/fhir/StructureDefinition/Encounter",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": "Encounter",
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            },
            "identifier": {
                "type": "Identifier",
                "array": True,
                "required": False,
                "description": "Identifier(s) by which this encounter is known"
            },
            "status": {
                "type": "code",
                "required": True,
                "binding": "EncounterStatus",
                "description": "planned | arrived | triaged | in-progress | onleave | finished | cancelled | entered-in-error | unknown"
            },
            "statusHistory": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "List of past encounter statuses"
            },
            "class": {
                "type": "Coding",
                "required": True,
                "binding": "ActEncounterCode",
                "description": "Classification of patient encounter"
            },
            "classHistory": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "List of past encounter classes"
            },
            "type": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "EncounterType",
                "description": "Specific type of encounter"
            },
            "serviceType": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ServiceType",
                "description": "Specific type of service"
            },
            "priority": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "ActPriority",
                "description": "Indicates the urgency of the encounter"
            },
            "subject": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Patient", "Group"],
                "description": "The patient or group present at the encounter"
            },
            "episodeOfCare": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["EpisodeOfCare"],
                "description": "Episode(s) of care that this encounter should be recorded against"
            },
            "basedOn": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["ServiceRequest"],
                "description": "The ServiceRequest that initiated this encounter"
            },
            "participant": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "List of participants involved in the encounter"
            },
            "appointment": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Appointment"],
                "description": "The appointment that scheduled this encounter"
            },
            "period": {
                "type": "Period",
                "required": False,
                "description": "The start and end time of the encounter"
            },
            "length": {
                "type": "Duration",
                "required": False,
                "description": "Quantity of time the encounter lasted"
            },
            "reasonCode": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "EncounterReason",
                "description": "Coded reason the encounter takes place"
            },
            "reasonReference": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Condition", "Procedure", "Observation", "ImmunizationRecommendation"],
                "description": "Reason the encounter takes place (reference)"
            },
            "diagnosis": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "The list of diagnosis relevant to this encounter"
            },
            "account": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Account"],
                "description": "The set of accounts that may be used for billing for this Encounter"
            },
            "hospitalization": {
                "type": "BackboneElement",
                "required": False,
                "description": "Details about the admission to a healthcare service"
            },
            "location": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "List of locations where the patient has been"
            },
            "serviceProvider": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Organization"],
                "description": "The organization that is primarily responsible for this Encounter's services"
            },
            "partOf": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Encounter"],
                "description": "Another Encounter this encounter is part of"
            }
        }
    },
    "DiagnosticReport": {
        "description": "The findings and interpretation of diagnostic tests performed on patients, groups of patients, devices, and locations, and/or specimens derived from these",
        "url": "http://hl7.org/fhir/StructureDefinition/DiagnosticReport",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": "DiagnosticReport",
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            },
            "identifier": {
                "type": "Identifier",
                "array": True,
                "required": False,
                "description": "Business identifier for report"
            },
            "basedOn": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["CarePlan", "ImmunizationRecommendation", "MedicationRequest", "NutritionOrder", "ServiceRequest"],
                "description": "What was requested"
            },
            "status": {
                "type": "code",
                "required": True,
                "binding": "DiagnosticReportStatus",
                "description": "registered | partial | preliminary | final | amended | corrected | appended | cancelled | entered-in-error | unknown"
            },
            "category": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "DiagnosticServiceSection",
                "description": "Service category"
            },
            "code": {
                "type": "CodeableConcept",
                "required": True,
                "binding": "DiagnosticReportCode",
                "description": "Name/Code for this diagnostic report"
            },
            "subject": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Patient", "Group", "Device", "Location"],
                "description": "The subject of the report - usually, but not always, the patient"
            },
            "encounter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Encounter"],
                "description": "Healthcare event when test ordered"
            },
            "effectiveDateTime": {
                "type": "dateTime",
                "required": False,
                "description": "Clinically relevant time/time-period for report"
            },
            "effectivePeriod": {
                "type": "Period",
                "required": False,
                "description": "Clinically relevant time/time-period for report"
            },
            "issued": {
                "type": "instant",
                "required": False,
                "description": "DateTime this version was made"
            },
            "performer": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole", "Organization", "CareTeam"],
                "description": "Responsible Diagnostic Service"
            },
            "resultsInterpreter": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole", "Organization", "CareTeam"],
                "description": "Primary result interpreter"
            },
            "specimen": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Specimen"],
                "description": "Specimens this report is based on"
            },
            "result": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["Observation"],
                "description": "Observations"
            },
            "imagingStudy": {
                "type": "Reference",
                "array": True,
                "required": False,
                "targetTypes": ["ImagingStudy"],
                "description": "Reference to full details of imaging associated with the diagnostic report"
            },
            "media": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "Key images associated with this report"
            },
            "conclusion": {
                "type": "string",
                "required": False,
                "description": "Clinical conclusion (interpretation) of test results"
            },
            "conclusionCode": {
                "type": "CodeableConcept",
                "array": True,
                "required": False,
                "binding": "ClinicalFindings",
                "description": "Codes for the clinical conclusion of test results"
            },
            "presentedForm": {
                "type": "Attachment",
                "array": True,
                "required": False,
                "description": "Entire report as issued"
            }
        }
    },
    "AllergyIntolerance": {
        "description": "Risk of harmful or undesirable, physiological response which is unique to an individual and associated with exposure to a substance",
        "url": "http://hl7.org/fhir/StructureDefinition/AllergyIntolerance",
        "elements": {
            "resourceType": {
                "type": "string",
                "required": True,
                "fixed": "AllergyIntolerance",
                "description": "Resource type identifier"
            },
            "id": {
                "type": "id",
                "required": False,
                "description": "Logical id of this artifact"
            },
            "meta": {
                "type": "Meta",
                "required": False,
                "description": "Metadata about the resource"
            },
            "identifier": {
                "type": "Identifier",
                "array": True,
                "required": False,
                "description": "External ids for this item"
            },
            "clinicalStatus": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "AllergyIntoleranceClinicalStatus",
                "description": "active | inactive | resolved"
            },
            "verificationStatus": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "AllergyIntoleranceVerificationStatus",
                "description": "unconfirmed | confirmed | refuted | entered-in-error"
            },
            "type": {
                "type": "code",
                "required": False,
                "binding": "AllergyIntoleranceType",
                "description": "allergy | intolerance - Underlying mechanism (if known)"
            },
            "category": {
                "type": "code",
                "array": True,
                "required": False,
                "binding": "AllergyIntoleranceCategory",
                "description": "food | medication | environment | biologic"
            },
            "criticality": {
                "type": "code",
                "required": False,
                "binding": "AllergyIntoleranceCriticality",
                "description": "low | high | unable-to-assess"
            },
            "code": {
                "type": "CodeableConcept",
                "required": False,
                "binding": "AllergyIntoleranceCode",
                "description": "Code that identifies the allergy or intolerance"
            },
            "patient": {
                "type": "Reference",
                "required": True,
                "targetTypes": ["Patient"],
                "description": "Who the sensitivity is for"
            },
            "encounter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Encounter"],
                "description": "Encounter when the allergy or intolerance was asserted"
            },
            "onsetDateTime": {
                "type": "dateTime",
                "required": False,
                "description": "When allergy or intolerance was identified"
            },
            "onsetAge": {
                "type": "Age",
                "required": False,
                "description": "When allergy or intolerance was identified"
            },
            "onsetPeriod": {
                "type": "Period",
                "required": False,
                "description": "When allergy or intolerance was identified"
            },
            "onsetRange": {
                "type": "Range",
                "required": False,
                "description": "When allergy or intolerance was identified"
            },
            "onsetString": {
                "type": "string",
                "required": False,
                "description": "When allergy or intolerance was identified"
            },
            "recordedDate": {
                "type": "dateTime",
                "required": False,
                "description": "Date first version of the resource instance was recorded"
            },
            "recorder": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"],
                "description": "Who recorded the sensitivity"
            },
            "asserter": {
                "type": "Reference",
                "required": False,
                "targetTypes": ["Patient", "RelatedPerson", "Practitioner", "PractitionerRole"],
                "description": "Source of the information about the allergy"
            },
            "lastOccurrence": {
                "type": "dateTime",
                "required": False,
                "description": "Date(/time) of last known occurrence of a reaction"
            },
            "note": {
                "type": "Annotation",
                "array": True,
                "required": False,
                "description": "Additional text not captured in other fields"
            },
            "reaction": {
                "type": "BackboneElement",
                "array": True,
                "required": False,
                "description": "Adverse Reaction Events linked to exposure to substance"
            }
        }
    }
}

def get_schema(resource_type: str):
    """Get schema for a specific resource type"""
    return FHIR_R4_SCHEMAS.get(resource_type)

def get_all_resource_types():
    """Get list of all available resource types"""
    return list(FHIR_R4_SCHEMAS.keys())

def get_resource_schema_summary(resource_type: str):
    """Get a summary of the resource schema"""
    schema = get_schema(resource_type)
    if not schema:
        return None
    
    return {
        "resourceType": resource_type,
        "description": schema.get("description", ""),
        "url": schema.get("url", ""),
        "elementCount": len(schema.get("elements", {})),
        "requiredElements": [
            key for key, elem in schema.get("elements", {}).items() 
            if elem.get("required", False)
        ]
    }