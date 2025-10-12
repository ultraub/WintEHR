"""
Unified models module - exports models from session and dicom modules

FHIR resources (Patient, Encounter, Observation, etc.) are managed by the
HAPI FHIR JPA Server (hfj_* tables).

This module exports non-FHIR workflow models:
- Session management (PatientProviderAssignment, UserSession)
- DICOM imaging models (DICOMStudy, DICOMSeries, DICOMInstance, ImagingResult)

Clinical workflow models (orders, notes, tasks, catalogs) are in models/clinical/*
and imported separately.
"""

# Import models from other modules
from .session import PatientProviderAssignment, UserSession
from .dicom_models import (
    DICOMStudy, DICOMSeries, DICOMInstance, ImagingResult
)