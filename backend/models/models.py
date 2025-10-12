"""
Unified models module - exports models from session and dicom modules

Note: After HAPI FHIR migration (2025-10), FHIR resources (Patient, Encounter, Observation, etc.)
are managed by HAPI FHIR JPA Server (hfj_* tables). The old synthea_models.py with SQLAlchemy
models for fhir.resources table is no longer used.

This module now only exports non-FHIR workflow models:
- Session management (PatientProviderAssignment, UserSession)
- DICOM imaging models (DICOMStudy, DICOMSeries, DICOMInstance, ImagingResult)

Clinical workflow models (orders, notes, tasks, catalogs) are in models/clinical/* and imported separately.
"""

# Import models from other modules
from .session import PatientProviderAssignment, UserSession
from .dicom_models import (
    DICOMStudy, DICOMSeries, DICOMInstance, ImagingResult
)  # Import DICOM models

# Note: synthea_models.py removed - HAPI FHIR now manages Patient, Encounter, Observation, etc.