"""
FHIR R4B Resource Imports

This module provides a compatibility layer for FHIR resource imports.
Since we don't strictly need the fhir.resources package for our JSON-based
FHIR implementation, we'll provide the necessary constructs here.
"""

# Base class for FHIR resources that provides dict conversion
class FHIRBase:
    """Base class for FHIR resources with dict conversion support"""
    
    def __init__(self, **kwargs):
        """Initialize with keyword arguments"""
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    def dict(self):
        """Convert resource to dictionary representation"""
        result = {}
        for key, value in self.__dict__.items():
            if not key.startswith('_'):
                if hasattr(value, 'dict'):
                    result[key] = value.dict()
                elif isinstance(value, list):
                    result[key] = [
                        item.dict() if hasattr(item, 'dict') else item 
                        for item in value
                    ]
                else:
                    result[key] = value
        return result
    
    def json(self):
        """Alias for dict() to match Pydantic interface"""
        return self.dict()

# Note: construct_fhir_element is defined at the bottom of the file after all classes

# Placeholder classes for type hints and compatibility
# These are not used in runtime as we work with JSON/dict representations
class Resource(FHIRBase):
    pass

class DomainResource(Resource):
    pass

class Bundle(DomainResource):
    def __init__(self, **kwargs):
        # Ensure resourceType is always set for Bundle
        kwargs['resourceType'] = 'Bundle'
        super().__init__(**kwargs)

class Parameters(DomainResource):
    def __init__(self, **kwargs):
        # Ensure resourceType is always set for Parameters
        kwargs['resourceType'] = 'Parameters'
        super().__init__(**kwargs)

class ParametersParameter(FHIRBase):
    pass

class OperationOutcome(DomainResource):
    def __init__(self, **kwargs):
        # Ensure resourceType is always set for OperationOutcome
        kwargs['resourceType'] = 'OperationOutcome'
        super().__init__(**kwargs)

class OperationOutcomeIssue(FHIRBase):
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

class TaskRestriction(FHIRBase):
    pass

class MedicationDispense(DomainResource):
    pass

class Communication(DomainResource):
    pass

class BundleEntry(FHIRBase):
    pass

class BundleEntryRequest(FHIRBase):
    pass

class BundleEntryResponse(FHIRBase):
    pass

class CodeableConcept(FHIRBase):
    pass

class Coding(FHIRBase):
    pass

class Identifier(FHIRBase):
    pass

class Reference(FHIRBase):
    pass

class Attachment(FHIRBase):
    pass

class Extension(FHIRBase):
    pass

class Annotation(FHIRBase):
    pass

class Id(FHIRBase):
    pass

class Period(FHIRBase):
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

# Provide construct_fhir_element function for compatibility
def construct_fhir_element(name, data):
    """
    Compatibility function that mimics fhir.resources construct_fhir_element.
    Creates an instance of the appropriate class with dict support.
    """
    # If data is already a dict, wrap it in the appropriate class
    if isinstance(data, dict):
        # Map resource names to classes
        resource_map = {
            'Bundle': Bundle,
            'BundleEntry': BundleEntry,
            'BundleEntryRequest': BundleEntryRequest,
            'BundleEntryResponse': BundleEntryResponse,
            'Parameters': Parameters,
            'ParametersParameter': ParametersParameter,
            'OperationOutcome': OperationOutcome,
            'OperationOutcomeIssue': OperationOutcomeIssue,
            'DocumentReference': DocumentReference,
            # Add more mappings as needed
        }
        
        # Get the class or use FHIRBase as default
        resource_class = resource_map.get(name, FHIRBase)
        return resource_class(**data)
    
    # If it's already an object with dict method, return as is
    if hasattr(data, 'dict'):
        return data
    
    # Otherwise, wrap in FHIRBase
    return FHIRBase(**{'data': data})