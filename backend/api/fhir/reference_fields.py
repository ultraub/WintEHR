"""
FHIR reference-field map — the ONE source (bug B5, docs/ARCHITECTURE_DEBT.md).

Two same-named REFERENCE_FIELDS maps used to drift independently: the
/api/fhir-relationships/schema endpoint advertised 25 resource types while
the traversal cache could only follow 13 — clicking through the other 12
silently failed. Both consumers now derive their shapes from this module:

- api/fhir/routers/relationships.py   ({"target": [...], "type": ...})
- api/services/fhir/relationship_cache.py ({"targets": [...], "cardinality": ...})

Each field entry: targets (allowed reference target types), cardinality
(FHIR-style, "0..1"/"0..*"/"1..1"), type (relationship arity label the
schema endpoint exposes). Add a resource type HERE and both the schema
endpoint and the traversal engine pick it up together.
"""

REFERENCE_FIELDS = {
    "AllergyIntolerance": {
        "patient": {"targets": ["Patient"], "cardinality": "1..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "recorder": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "cardinality": "0..1", "type": "many-to-one"},
        "asserter": {"targets": ["Patient", "RelatedPerson", "Practitioner", "PractitionerRole"], "cardinality": "0..1", "type": "many-to-one"},
    },
    "CarePlan": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "1..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "author": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson", "Organization", "CareTeam", "Device"], "cardinality": "0..1", "type": "many-to-one"},
        "careTeam": {"targets": ["CareTeam"], "cardinality": "0..*", "type": "many-to-many"},
        "addresses": {"targets": ["Condition"], "cardinality": "0..*", "type": "many-to-many"},
        "supportingInfo": {"targets": ["Any"], "cardinality": "0..*", "type": "many-to-many"},
        "goal": {"targets": ["Goal"], "cardinality": "0..*", "type": "many-to-many"},
        "basedOn": {"targets": ["CarePlan"], "cardinality": "0..*", "type": "many-to-many"},
        "replaces": {"targets": ["CarePlan"], "cardinality": "0..*", "type": "many-to-many"},
        "partOf": {"targets": ["CarePlan"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "CareTeam": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "0..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "managingOrganization": {"targets": ["Organization"], "cardinality": "0..*", "type": "many-to-many"},
        "participant": {"targets": ["Practitioner", "PractitionerRole", "RelatedPerson", "Patient", "Organization", "CareTeam"], "cardinality": "0..*", "type": "one-to-many"},
    },
    "Claim": {
        "patient": {"targets": ["Patient"], "cardinality": "0..1", "type": "many-to-one"},
        "enterer": {"targets": ["Practitioner", "PractitionerRole"], "cardinality": "0..1", "type": "many-to-one"},
        "insurer": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "provider": {"targets": ["Practitioner", "PractitionerRole", "Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "priority": {"targets": ["CodeableConcept"], "cardinality": "0..1", "type": "many-to-one"},
        "prescription": {"targets": ["MedicationRequest", "VisionPrescription"], "cardinality": "0..1", "type": "many-to-one"},
        "originalPrescription": {"targets": ["MedicationRequest"], "cardinality": "0..1", "type": "many-to-one"},
        "payee": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson"], "cardinality": "0..1", "type": "many-to-one"},
        "referral": {"targets": ["ServiceRequest"], "cardinality": "0..1", "type": "many-to-one"},
        "facility": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "careTeam": {"targets": ["Practitioner", "PractitionerRole", "Organization"], "cardinality": "0..*", "type": "one-to-many"},
        "procedure": {"targets": ["Procedure"], "cardinality": "0..*", "type": "one-to-many"},
    },
    "Condition": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "1..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "recorder": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "cardinality": "0..1", "type": "many-to-one"},
        "asserter": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson"], "cardinality": "0..1", "type": "many-to-one"},
        "evidence": {"targets": ["Observation", "DocumentReference", "DiagnosticReport"], "cardinality": "0..*", "type": "one-to-many"},
    },
    "Device": {
        "location": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "patient": {"targets": ["Patient"], "cardinality": "0..1", "type": "many-to-one"},
        "owner": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "parent": {"targets": ["Device"], "cardinality": "0..1", "type": "many-to-one"},
    },
    "DiagnosticReport": {
        "subject": {"targets": ["Patient", "Group", "Device", "Location"], "cardinality": "0..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "basedOn": {"targets": ["CarePlan", "ImmunizationRecommendation", "MedicationRequest", "NutritionOrder", "ServiceRequest"], "cardinality": "0..*", "type": "many-to-many"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization", "CareTeam"], "cardinality": "0..*", "type": "many-to-many"},
        "resultsInterpreter": {"targets": ["Practitioner", "PractitionerRole", "Organization", "CareTeam"], "cardinality": "0..*", "type": "many-to-many"},
        "specimen": {"targets": ["Specimen"], "cardinality": "0..*", "type": "many-to-many"},
        "result": {"targets": ["Observation"], "cardinality": "0..*", "type": "one-to-many"},
        "imagingStudy": {"targets": ["ImagingStudy"], "cardinality": "0..*", "type": "many-to-many"},
        "media": {"targets": ["Media"], "cardinality": "0..*", "type": "one-to-many"},
    },
    "DocumentReference": {
        "subject": {"targets": ["Patient", "Practitioner", "Group", "Device"], "cardinality": "0..1", "type": "many-to-one"},
        "author": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Device", "Patient", "RelatedPerson"], "cardinality": "0..*", "type": "many-to-many"},
        "authenticator": {"targets": ["Practitioner", "PractitionerRole", "Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "custodian": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "relatesTo": {"targets": ["DocumentReference"], "cardinality": "0..*", "type": "many-to-many"},
        "context": {"targets": ["Encounter", "EpisodeOfCare"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "Encounter": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "0..1", "type": "many-to-one"},
        "participant": {"targets": ["Practitioner", "PractitionerRole", "RelatedPerson"], "cardinality": "0..*", "type": "one-to-many"},
        "appointment": {"targets": ["Appointment"], "cardinality": "0..*", "type": "many-to-many"},
        "reasonReference": {"targets": ["Condition", "Procedure", "Observation", "ImmunizationRecommendation"], "cardinality": "0..*", "type": "many-to-many"},
        "diagnosis": {"targets": ["Condition", "Procedure"], "cardinality": "0..*", "type": "one-to-many"},
        "hospitalization": {"targets": ["Location", "Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "serviceProvider": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "partOf": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
    },
    "ExplanationOfBenefit": {
        "patient": {"targets": ["Patient"], "cardinality": "0..1", "type": "many-to-one"},
        "enterer": {"targets": ["Practitioner", "PractitionerRole"], "cardinality": "0..1", "type": "many-to-one"},
        "insurer": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "provider": {"targets": ["Practitioner", "PractitionerRole", "Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "prescription": {"targets": ["MedicationRequest", "VisionPrescription"], "cardinality": "0..1", "type": "many-to-one"},
        "originalPrescription": {"targets": ["MedicationRequest"], "cardinality": "0..1", "type": "many-to-one"},
        "payee": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson"], "cardinality": "0..1", "type": "many-to-one"},
        "referral": {"targets": ["ServiceRequest"], "cardinality": "0..1", "type": "many-to-one"},
        "facility": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "claim": {"targets": ["Claim"], "cardinality": "0..1", "type": "many-to-one"},
        "claimResponse": {"targets": ["ClaimResponse"], "cardinality": "0..1", "type": "many-to-one"},
    },
    "ImagingStudy": {
        "subject": {"targets": ["Patient", "Device", "Group"], "cardinality": "1..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "basedOn": {"targets": ["CarePlan", "ServiceRequest", "Appointment", "AppointmentResponse", "Task"], "cardinality": "0..*", "type": "many-to-many"},
        "referrer": {"targets": ["Practitioner", "PractitionerRole"], "cardinality": "0..1", "type": "many-to-one"},
        "interpreter": {"targets": ["Practitioner", "PractitionerRole"], "cardinality": "0..*", "type": "many-to-many"},
        "endpoint": {"targets": ["Endpoint"], "cardinality": "0..*", "type": "many-to-many"},
        "procedureReference": {"targets": ["Procedure"], "cardinality": "0..1", "type": "many-to-one"},
        "location": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "reasonReference": {"targets": ["Condition", "Observation", "DiagnosticReport", "DocumentReference"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "Immunization": {
        "patient": {"targets": ["Patient"], "cardinality": "1..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "location": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "manufacturer": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization"], "cardinality": "0..*", "type": "one-to-many"},
        "reasonReference": {"targets": ["Condition", "Observation", "DiagnosticReport"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "Location": {
        "managingOrganization": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "partOf": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "endpoint": {"targets": ["Endpoint"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "Medication": {
        "manufacturer": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "ingredient": {"targets": ["Medication", "Substance"], "cardinality": "0..*", "type": "one-to-many"},
    },
    "MedicationAdministration": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "0..1", "type": "many-to-one"},
        "context": {"targets": ["Encounter", "EpisodeOfCare"], "cardinality": "0..1", "type": "many-to-one"},
        "supportingInformation": {"targets": ["Any"], "cardinality": "0..*", "type": "many-to-many"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Patient", "RelatedPerson", "Device"], "cardinality": "0..*", "type": "one-to-many"},
        "reasonReference": {"targets": ["Condition", "Observation", "DiagnosticReport"], "cardinality": "0..*", "type": "many-to-many"},
        "request": {"targets": ["MedicationRequest"], "cardinality": "0..1", "type": "many-to-one"},
        "device": {"targets": ["Device"], "cardinality": "0..*", "type": "many-to-many"},
        "eventHistory": {"targets": ["Provenance"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "MedicationRequest": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "1..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "requester": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"], "cardinality": "0..1", "type": "many-to-one"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device", "CareTeam"], "cardinality": "0..1", "type": "many-to-one"},
        "medication": {"targets": ["Medication"], "cardinality": "0..1", "type": "many-to-one"},
        "reasonReference": {"targets": ["Condition", "Observation"], "cardinality": "0..*", "type": "many-to-many"},
        "basedOn": {"targets": ["CarePlan", "MedicationRequest", "ServiceRequest", "ImmunizationRecommendation"], "cardinality": "0..*", "type": "many-to-many"},
        "priorPrescription": {"targets": ["MedicationRequest"], "cardinality": "0..1", "type": "many-to-one"},
    },
    "Observation": {
        "subject": {"targets": ["Patient", "Group", "Device", "Location"], "cardinality": "0..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization", "CareTeam", "Patient", "RelatedPerson"], "cardinality": "0..*", "type": "many-to-many"},
        "basedOn": {"targets": ["CarePlan", "DeviceRequest", "ImmunizationRecommendation", "MedicationRequest", "NutritionOrder", "ServiceRequest"], "cardinality": "0..*", "type": "many-to-many"},
        "partOf": {"targets": ["MedicationAdministration", "MedicationDispense", "MedicationStatement", "Procedure", "Immunization", "ImagingStudy"], "cardinality": "0..*", "type": "many-to-many"},
        "specimen": {"targets": ["Specimen"], "cardinality": "0..1", "type": "many-to-one"},
        "device": {"targets": ["Device", "DeviceMetric"], "cardinality": "0..1", "type": "many-to-one"},
    },
    "Organization": {
        "partOf": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "endpoint": {"targets": ["Endpoint"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "Patient": {
        "generalPractitioner": {"targets": ["Practitioner", "Organization", "PractitionerRole"], "cardinality": "0..*", "type": "many-to-many"},
        "managingOrganization": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
    },
    "Practitioner": {
        "qualification": {"targets": ["Organization"], "cardinality": "0..*", "type": "one-to-many"},
    },
    "PractitionerRole": {
        "practitioner": {"targets": ["Practitioner"], "cardinality": "0..1", "type": "many-to-one"},
        "organization": {"targets": ["Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "location": {"targets": ["Location"], "cardinality": "0..*", "type": "many-to-many"},
        "healthcareService": {"targets": ["HealthcareService"], "cardinality": "0..*", "type": "many-to-many"},
        "endpoint": {"targets": ["Endpoint"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "Procedure": {
        "subject": {"targets": ["Patient", "Group"], "cardinality": "1..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"], "cardinality": "0..*", "type": "one-to-many"},
        "location": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "reasonReference": {"targets": ["Condition", "Observation", "Procedure", "DiagnosticReport", "DocumentReference"], "cardinality": "0..*", "type": "many-to-many"},
        "basedOn": {"targets": ["CarePlan", "ServiceRequest"], "cardinality": "0..*", "type": "many-to-many"},
        "partOf": {"targets": ["Procedure", "Observation", "MedicationAdministration"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "Provenance": {
        "target": {"targets": ["Any"], "cardinality": "0..*", "type": "many-to-many"},
        "location": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "agent": {"targets": ["Practitioner", "PractitionerRole", "RelatedPerson", "Patient", "Device", "Organization"], "cardinality": "0..*", "type": "one-to-many"},
        "entity": {"targets": ["Any"], "cardinality": "0..*", "type": "one-to-many"},
    },
    "ServiceRequest": {
        "subject": {"targets": ["Patient", "Group", "Location", "Device"], "cardinality": "1..1", "type": "many-to-one"},
        "encounter": {"targets": ["Encounter"], "cardinality": "0..1", "type": "many-to-one"},
        "requester": {"targets": ["Practitioner", "PractitionerRole", "Organization", "Patient", "RelatedPerson", "Device"], "cardinality": "0..1", "type": "many-to-one"},
        "performer": {"targets": ["Practitioner", "PractitionerRole", "Organization", "CareTeam", "HealthcareService", "Patient", "Device", "RelatedPerson"], "cardinality": "0..*", "type": "many-to-many"},
        "locationReference": {"targets": ["Location"], "cardinality": "0..*", "type": "many-to-many"},
        "reasonReference": {"targets": ["Condition", "Observation", "DiagnosticReport", "DocumentReference"], "cardinality": "0..*", "type": "many-to-many"},
        "insurance": {"targets": ["Coverage", "ClaimResponse"], "cardinality": "0..*", "type": "many-to-many"},
        "supportingInfo": {"targets": ["Any"], "cardinality": "0..*", "type": "many-to-many"},
        "specimen": {"targets": ["Specimen"], "cardinality": "0..*", "type": "many-to-many"},
    },
    "SupplyDelivery": {
        "basedOn": {"targets": ["SupplyRequest"], "cardinality": "0..*", "type": "many-to-many"},
        "partOf": {"targets": ["SupplyDelivery", "Contract"], "cardinality": "0..*", "type": "many-to-many"},
        "patient": {"targets": ["Patient"], "cardinality": "0..1", "type": "many-to-one"},
        "supplier": {"targets": ["Practitioner", "PractitionerRole", "Organization"], "cardinality": "0..1", "type": "many-to-one"},
        "destination": {"targets": ["Location"], "cardinality": "0..1", "type": "many-to-one"},
        "receiver": {"targets": ["Practitioner", "PractitionerRole"], "cardinality": "0..*", "type": "many-to-many"},
    },
}
