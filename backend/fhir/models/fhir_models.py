"""FHIR R4 Pydantic models"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class FHIRIdentifier(BaseModel):
    use: Optional[str] = None
    type: Optional[Dict[str, Any]] = None
    system: Optional[str] = None
    value: Optional[str] = None

class FHIRName(BaseModel):
    use: Optional[str] = None
    family: Optional[str] = None
    given: Optional[List[str]] = None

class FHIRAddress(BaseModel):
    use: Optional[str] = None
    line: Optional[List[str]] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postalCode: Optional[str] = None
    country: Optional[str] = None

class FHIRTelecom(BaseModel):
    system: Optional[str] = None
    value: Optional[str] = None
    use: Optional[str] = None

class FHIRReference(BaseModel):
    reference: Optional[str] = None
    display: Optional[str] = None

class FHIRCodeableConcept(BaseModel):
    coding: Optional[List[Dict[str, Any]]] = None
    text: Optional[str] = None

class FHIRPeriod(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None

class FHIRQuantity(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = None
    system: Optional[str] = None
    code: Optional[str] = None

class FHIRPatient(BaseModel):
    resourceType: str = "Patient"
    id: str
    identifier: Optional[List[FHIRIdentifier]] = None
    active: bool = True
    name: Optional[List[FHIRName]] = None
    telecom: Optional[List[FHIRTelecom]] = None
    gender: Optional[str] = None
    birthDate: Optional[str] = None
    address: Optional[List[FHIRAddress]] = None

class FHIREncounter(BaseModel):
    resourceType: str = "Encounter"
    id: str
    identifier: Optional[List[FHIRIdentifier]] = None
    status: str
    class_field: Dict[str, str] = Field(alias="class")
    type: Optional[List[FHIRCodeableConcept]] = None
    subject: FHIRReference
    participant: Optional[List[Dict[str, Any]]] = None
    period: Optional[FHIRPeriod] = None
    location: Optional[List[Dict[str, Any]]] = None

class FHIRObservation(BaseModel):
    resourceType: str = "Observation"
    id: str
    status: str
    category: Optional[List[FHIRCodeableConcept]] = None
    code: FHIRCodeableConcept
    subject: FHIRReference
    encounter: Optional[FHIRReference] = None
    effectiveDateTime: Optional[str] = None
    valueQuantity: Optional[FHIRQuantity] = None
    interpretation: Optional[List[FHIRCodeableConcept]] = None
    referenceRange: Optional[List[Dict[str, Any]]] = None

class FHIRCondition(BaseModel):
    resourceType: str = "Condition"
    id: str
    clinicalStatus: FHIRCodeableConcept
    verificationStatus: FHIRCodeableConcept
    category: Optional[List[FHIRCodeableConcept]] = None
    severity: Optional[FHIRCodeableConcept] = None
    code: FHIRCodeableConcept
    subject: FHIRReference
    encounter: Optional[FHIRReference] = None
    onsetDateTime: Optional[str] = None
    recordedDate: Optional[str] = None

class FHIRMedicationRequest(BaseModel):
    resourceType: str = "MedicationRequest"
    id: str
    status: str
    intent: str = "order"
    medicationCodeableConcept: FHIRCodeableConcept
    subject: FHIRReference
    encounter: Optional[FHIRReference] = None
    authoredOn: Optional[str] = None
    requester: Optional[FHIRReference] = None
    dosageInstruction: Optional[List[Dict[str, Any]]] = None

class FHIRPractitioner(BaseModel):
    resourceType: str = "Practitioner"
    id: str
    identifier: Optional[List[FHIRIdentifier]] = None
    active: bool = True
    name: Optional[List[FHIRName]] = None
    telecom: Optional[List[FHIRTelecom]] = None
    qualification: Optional[List[Dict[str, Any]]] = None

class FHIRLocation(BaseModel):
    resourceType: str = "Location"
    id: str
    status: str = "active"
    name: str
    type: Optional[List[FHIRCodeableConcept]] = None
    telecom: Optional[List[FHIRTelecom]] = None
    address: Optional[FHIRAddress] = None

class FHIRBundle(BaseModel):
    resourceType: str = "Bundle"
    type: str
    total: Optional[int] = None
    entry: Optional[List[Dict[str, Any]]] = None