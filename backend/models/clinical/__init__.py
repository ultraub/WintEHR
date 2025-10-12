"""
Clinical models package

⚠️ NOTE: All clinical workflow models removed in v4.2 (Phase 5 cleanup)

All clinical data now stored in HAPI FHIR as standard FHIR R4 resources:
- Clinical Notes → FHIR DocumentReference
- Orders → FHIR MedicationRequest / ServiceRequest
- Tasks → FHIR Task / Communication (Phase 4)
- Appointments → FHIR Appointment
- Catalogs → Dynamic from HAPI FHIR data

This directory is kept for potential future non-FHIR clinical models.
Currently empty after Phase 3 pure FHIR migration (2025-10-12).
"""

__all__ = []
