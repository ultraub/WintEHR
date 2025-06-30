"""Pydantic schemas for application API"""

from __future__ import annotations

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

# Enums
class GenderEnum(str, Enum):
    male = "male"
    female = "female"
    other = "other"

class EncounterStatusEnum(str, Enum):
    scheduled = "scheduled"
    in_progress = "in-progress"
    finished = "finished"
    cancelled = "cancelled"

class ClinicalStatusEnum(str, Enum):
    active = "active"
    resolved = "resolved"
    inactive = "inactive"

class MedicationStatusEnum(str, Enum):
    active = "active"
    completed = "completed"
    stopped = "stopped"
    on_hold = "on-hold"

# Patient schemas
class PatientBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: GenderEnum
    race: Optional[str] = None
    ethnicity: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    insurance_name: Optional[str] = None
    insurance_id: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    insurance_name: Optional[str] = None
    insurance_id: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class PatientResponse(PatientBase):
    id: str
    mrn: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Clinical relationships - included as optional to avoid circular imports
    allergies: Optional[List['AllergyResponse']] = []
    conditions: Optional[List['ConditionResponse']] = []
    medications: Optional[List['MedicationResponse']] = []
    
    class Config:
        from_attributes = True

# Encounter schemas
class EncounterBase(BaseModel):
    patient_id: str
    provider_id: Optional[str] = None
    location_id: Optional[str] = None
    encounter_date: datetime
    encounter_type: str
    status: EncounterStatusEnum
    chief_complaint: Optional[str] = None
    notes: Optional[str] = None

class EncounterCreate(EncounterBase):
    pass

class EncounterResponse(EncounterBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Observation schemas
class ObservationBase(BaseModel):
    patient_id: str
    encounter_id: Optional[str] = None
    observation_type: Optional[str] = None
    loinc_code: Optional[str] = None
    display: str
    value: Optional[str] = None
    value_quantity: Optional[float] = None
    value_unit: Optional[str] = None
    reference_range_low: Optional[float] = None
    reference_range_high: Optional[float] = None
    observation_date: datetime

class ObservationCreate(ObservationBase):
    pass

class ObservationResponse(ObservationBase):
    id: str
    interpretation: Optional[str] = None
    
    class Config:
        from_attributes = True

# Condition schemas
class ConditionBase(BaseModel):
    patient_id: str
    icd10_code: Optional[str] = None
    snomed_code: Optional[str] = None
    description: str
    clinical_status: ClinicalStatusEnum
    verification_status: str = "confirmed"
    onset_date: Optional[datetime] = None

class ConditionCreate(ConditionBase):
    pass

class ConditionResponse(ConditionBase):
    id: str
    recorded_date: datetime
    
    class Config:
        from_attributes = True

# Medication schemas
class MedicationBase(BaseModel):
    patient_id: str
    encounter_id: Optional[str] = None
    medication_name: str
    rxnorm_code: Optional[str] = None
    dosage: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    status: MedicationStatusEnum
    prescriber_id: Optional[str] = None

class MedicationCreate(MedicationBase):
    pass

class MedicationResponse(MedicationBase):
    id: str
    
    class Config:
        from_attributes = True

# Provider schemas
class ProviderBase(BaseModel):
    first_name: str
    last_name: str
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    specialty: str
    organization_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    active: bool = True

class ProviderResponse(ProviderBase):
    id: str
    npi: Optional[str] = None
    
    class Config:
        from_attributes = True

# Location schemas
class LocationBase(BaseModel):
    name: str
    type: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None

class LocationResponse(LocationBase):
    id: str
    
    class Config:
        from_attributes = True

# Vital signs batch create schema
class VitalSignsBatch(BaseModel):
    patient_id: str
    encounter_id: str
    observation_date: datetime
    systolic_bp: Optional[float] = Field(None, ge=60, le=250)
    diastolic_bp: Optional[float] = Field(None, ge=40, le=150)
    heart_rate: Optional[float] = Field(None, ge=30, le=250)
    temperature: Optional[float] = Field(None, ge=35, le=42)
    respiratory_rate: Optional[float] = Field(None, ge=8, le=60)
    oxygen_saturation: Optional[float] = Field(None, ge=50, le=100)
    weight: Optional[float] = Field(None, ge=0.5, le=500)
    height: Optional[float] = Field(None, ge=20, le=300)
    
    @validator('systolic_bp', 'diastolic_bp')
    def validate_blood_pressure(cls, v, values):
        if 'systolic_bp' in values and 'diastolic_bp' in values:
            if values.get('systolic_bp') and v and values['systolic_bp'] <= v:
                raise ValueError('Systolic BP must be greater than diastolic BP')
        return v

# Allergy schemas
class AllergyBase(BaseModel):
    patient_id: str
    description: str
    severity: str = "mild"
    reaction: Optional[str] = None

class AllergyCreate(AllergyBase):
    pass

class AllergyResponse(AllergyBase):
    id: str
    
    class Config:
        from_attributes = True

# Rebuild models to resolve forward references
PatientResponse.model_rebuild()