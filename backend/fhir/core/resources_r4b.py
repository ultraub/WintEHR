"""
FHIR R4B Resource Imports

This module provides a compatibility layer for FHIR resource imports.
Since we don't strictly need the fhir.resources package for our JSON-based
FHIR implementation, we'll provide the necessary constructs here.
"""

# Provide a simple construct_fhir_element function for compatibility
def construct_fhir_element(name, data):
    """
    Compatibility function that mimics fhir.resources construct_fhir_element.
    Our system works with JSON/dict representations directly.
    """
    return data

# Placeholder classes for type hints and compatibility
# These are not used in runtime as we work with JSON/dict representations
class Resource:
    pass

class DomainResource(Resource):
    pass

class Bundle(DomainResource):
    pass

class Parameters(DomainResource):
    pass

class ParametersParameter:
    pass

class OperationOutcome(DomainResource):
    pass

class OperationOutcomeIssue:
    pass

class Patient(DomainResource):
    pass

class Encounter(DomainResource):
    pass

class Observation(DomainResource):
    pass

class Condition(DomainResource):
    pass

class Procedure(DomainResource):
    pass

class MedicationRequest(DomainResource):
    pass

class MedicationAdministration(DomainResource):
    pass

class DiagnosticReport(DomainResource):
    pass

class DocumentReference(DomainResource):
    pass

class Immunization(DomainResource):
    pass

class AllergyIntolerance(DomainResource):
    pass

class CareTeam(DomainResource):
    pass

class CarePlan(DomainResource):
    pass

class Goal(DomainResource):
    pass

class Organization(DomainResource):
    pass

class Practitioner(DomainResource):
    pass

class PractitionerRole(DomainResource):
    pass

class Location(DomainResource):
    pass

class Device(DomainResource):
    pass

class Claim(DomainResource):
    pass

class ExplanationOfBenefit(DomainResource):
    pass

class Coverage(DomainResource):
    pass

class ImagingStudy(DomainResource):
    pass

class Media(DomainResource):
    pass

class Provenance(DomainResource):
    pass

class SupplyDelivery(DomainResource):
    pass

class ServiceRequest(DomainResource):
    pass

class Task(DomainResource):
    pass

class TaskRestriction:
    pass

class MedicationDispense(DomainResource):
    pass

class Communication(DomainResource):
    pass

class BundleEntry:
    pass

class BundleEntryRequest:
    pass

class BundleEntryResponse:
    pass

class CodeableConcept:
    pass

class Coding:
    pass

class Identifier:
    pass

class Reference:
    pass

class Attachment:
    pass

class Extension:
    pass

class Annotation:
    pass

class Id:
    pass

class Period:
    pass

# Export all resources
__all__ = [
    'Patient', 'Encounter', 'Observation', 'Condition', 'Procedure',
    'MedicationRequest', 'MedicationAdministration', 'DiagnosticReport',
    'DocumentReference', 'Immunization', 'AllergyIntolerance', 'CareTeam',
    'CarePlan', 'Goal', 'Organization', 'Practitioner', 'PractitionerRole',
    'Location', 'Device', 'Claim', 'ExplanationOfBenefit', 'Coverage',
    'ImagingStudy', 'Media', 'Provenance', 'SupplyDelivery', 'ServiceRequest',
    'Task', 'TaskRestriction', 'MedicationDispense', 'Parameters', 'ParametersParameter', 'Communication', 'Bundle',
    'BundleEntry', 'BundleEntryRequest', 'BundleEntryResponse', 'OperationOutcome',
    'OperationOutcomeIssue', 'Resource', 'DomainResource', 'Id', 'CodeableConcept',
    'Coding', 'Identifier', 'Reference', 'Attachment', 'Extension', 'Annotation',
    'Period', 'construct_fhir_element'
]