"""
FHIR R4 Schemas
Pydantic models for FHIR resources
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum

class FHIRResourceType(str, Enum):
    """FHIR Resource Types"""
    Patient = "Patient"
    Encounter = "Encounter"
    Observation = "Observation"
    Condition = "Condition"
    MedicationRequest = "MedicationRequest"
    Practitioner = "Practitioner"
    Location = "Location"
    Organization = "Organization"

class FHIRBase(BaseModel):
    """Base FHIR Resource"""
    resourceType: str
    id: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None

class HumanName(BaseModel):
    """FHIR HumanName"""
    use: Optional[str] = None
    family: Optional[str] = None
    given: Optional[List[str]] = None
    prefix: Optional[List[str]] = None
    suffix: Optional[List[str]] = None

class Identifier(BaseModel):
    """FHIR Identifier"""
    use: Optional[str] = None
    type: Optional[Dict[str, Any]] = None
    system: Optional[str] = None
    value: Optional[str] = None

class ContactPoint(BaseModel):
    """FHIR ContactPoint"""
    system: Optional[str] = None
    value: Optional[str] = None
    use: Optional[str] = None

class Address(BaseModel):
    """FHIR Address"""
    use: Optional[str] = None
    line: Optional[List[str]] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postalCode: Optional[str] = None
    country: Optional[str] = None

class Reference(BaseModel):
    """FHIR Reference"""
    reference: Optional[str] = None
    display: Optional[str] = None

class CodeableConcept(BaseModel):
    """FHIR CodeableConcept"""
    coding: Optional[List[Dict[str, Any]]] = None
    text: Optional[str] = None

class Period(BaseModel):
    """FHIR Period"""
    start: Optional[datetime] = None
    end: Optional[datetime] = None

# Patient Resource
class PatientResource(FHIRBase):
    """FHIR Patient Resource"""
    resourceType: str = "Patient"
    identifier: Optional[List[Identifier]] = None
    active: Optional[bool] = True
    name: Optional[List[HumanName]] = None
    telecom: Optional[List[ContactPoint]] = None
    gender: Optional[str] = None
    birthDate: Optional[date] = None
    address: Optional[List[Address]] = None

# Encounter Resource
class EncounterResource(FHIRBase):
    """FHIR Encounter Resource"""
    resourceType: str = "Encounter"
    identifier: Optional[List[Identifier]] = None
    status: str
    class_: Optional[Dict[str, Any]] = Field(None, alias="class")
    type: Optional[List[CodeableConcept]] = None
    subject: Reference
    participant: Optional[List[Dict[str, Any]]] = None
    period: Optional[Period] = None
    location: Optional[List[Dict[str, Any]]] = None

    class Config:
        populate_by_name = True

# Observation Resource
class ObservationResource(FHIRBase):
    """FHIR Observation Resource"""
    resourceType: str = "Observation"
    identifier: Optional[List[Identifier]] = None
    status: str
    category: Optional[List[CodeableConcept]] = None
    code: CodeableConcept
    subject: Reference
    encounter: Optional[Reference] = None
    effectiveDateTime: Optional[datetime] = None
    valueQuantity: Optional[Dict[str, Any]] = None
    valueString: Optional[str] = None
    valueCodeableConcept: Optional[CodeableConcept] = None
    interpretation: Optional[List[CodeableConcept]] = None
    referenceRange: Optional[List[Dict[str, Any]]] = None

# Condition Resource
class ConditionResource(FHIRBase):
    """FHIR Condition Resource"""
    resourceType: str = "Condition"
    identifier: Optional[List[Identifier]] = None
    clinicalStatus: Optional[CodeableConcept] = None
    verificationStatus: Optional[CodeableConcept] = None
    category: Optional[List[CodeableConcept]] = None
    severity: Optional[CodeableConcept] = None
    code: CodeableConcept
    subject: Reference
    encounter: Optional[Reference] = None
    onsetDateTime: Optional[datetime] = None
    recordedDate: Optional[datetime] = None

# MedicationRequest Resource
class MedicationRequestResource(FHIRBase):
    """FHIR MedicationRequest Resource"""
    resourceType: str = "MedicationRequest"
    identifier: Optional[List[Identifier]] = None
    status: str
    intent: str
    medicationCodeableConcept: Optional[CodeableConcept] = None
    subject: Reference
    encounter: Optional[Reference] = None
    authoredOn: Optional[datetime] = None
    requester: Optional[Reference] = None
    dosageInstruction: Optional[List[Dict[str, Any]]] = None

# Practitioner Resource
class PractitionerResource(FHIRBase):
    """FHIR Practitioner Resource"""
    resourceType: str = "Practitioner"
    identifier: Optional[List[Identifier]] = None
    active: Optional[bool] = True
    name: Optional[List[HumanName]] = None
    telecom: Optional[List[ContactPoint]] = None
    gender: Optional[str] = None
    qualification: Optional[List[Dict[str, Any]]] = None

# Location Resource
class LocationResource(FHIRBase):
    """FHIR Location Resource"""
    resourceType: str = "Location"
    identifier: Optional[List[Identifier]] = None
    status: Optional[str] = None
    name: Optional[str] = None
    type: Optional[List[CodeableConcept]] = None
    telecom: Optional[List[ContactPoint]] = None
    address: Optional[Address] = None

# Bundle Resource
class BundleEntry(BaseModel):
    """FHIR Bundle Entry"""
    fullUrl: Optional[str] = None
    resource: Optional[Dict[str, Any]] = None
    search: Optional[Dict[str, Any]] = None
    request: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None

class Bundle(FHIRBase):
    """FHIR Bundle Resource"""
    resourceType: str = "Bundle"
    type: str
    total: Optional[int] = None
    link: Optional[List[Dict[str, Any]]] = None
    entry: Optional[List[BundleEntry]] = None

# Operation Outcome
class OperationOutcome(FHIRBase):
    """FHIR OperationOutcome Resource"""
    resourceType: str = "OperationOutcome"
    issue: List[Dict[str, Any]]

# Parameters Resource for bulk export
class Parameters(FHIRBase):
    """FHIR Parameters Resource"""
    resourceType: str = "Parameters"
    parameter: Optional[List[Dict[str, Any]]] = None