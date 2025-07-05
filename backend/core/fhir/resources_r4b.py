"""
FHIR R4B Resource Imports

This module centralizes all FHIR resource imports to use R4B versions
which are compatible with Synthea's R4 output.
"""

# Import all R4B resources that we use in the system
from fhir.resources.R4B.patient import Patient
from fhir.resources.R4B.encounter import Encounter
from fhir.resources.R4B.observation import Observation
from fhir.resources.R4B.condition import Condition
from fhir.resources.R4B.procedure import Procedure
from fhir.resources.R4B.medicationrequest import MedicationRequest
from fhir.resources.R4B.medicationadministration import MedicationAdministration
from fhir.resources.R4B.diagnosticreport import DiagnosticReport
from fhir.resources.R4B.documentreference import DocumentReference
from fhir.resources.R4B.immunization import Immunization
from fhir.resources.R4B.allergyintolerance import AllergyIntolerance
from fhir.resources.R4B.careteam import CareTeam
from fhir.resources.R4B.careplan import CarePlan
from fhir.resources.R4B.goal import Goal
from fhir.resources.R4B.organization import Organization
from fhir.resources.R4B.practitioner import Practitioner
from fhir.resources.R4B.practitionerrole import PractitionerRole
from fhir.resources.R4B.location import Location
from fhir.resources.R4B.device import Device
from fhir.resources.R4B.claim import Claim
from fhir.resources.R4B.explanationofbenefit import ExplanationOfBenefit
from fhir.resources.R4B.coverage import Coverage
from fhir.resources.R4B.imagingstudy import ImagingStudy
from fhir.resources.R4B.media import Media
from fhir.resources.R4B.provenance import Provenance
from fhir.resources.R4B.supplydelivery import SupplyDelivery
from fhir.resources.R4B.bundle import Bundle
from fhir.resources.R4B.operationoutcome import OperationOutcome
from fhir.resources.R4B.resource import Resource
from fhir.resources.R4B.domainresource import DomainResource
from fhir.resources.R4B.fhirtypes import Id
from fhir.resources.R4B import construct_fhir_element

# Export all resources
__all__ = [
    'Patient', 'Encounter', 'Observation', 'Condition', 'Procedure',
    'MedicationRequest', 'MedicationAdministration', 'DiagnosticReport',
    'DocumentReference', 'Immunization', 'AllergyIntolerance', 'CareTeam',
    'CarePlan', 'Goal', 'Organization', 'Practitioner', 'PractitionerRole',
    'Location', 'Device', 'Claim', 'ExplanationOfBenefit', 'Coverage',
    'ImagingStudy', 'Media', 'Provenance', 'SupplyDelivery', 'Bundle',
    'OperationOutcome', 'Resource', 'DomainResource', 'Id', 'construct_fhir_element'
]