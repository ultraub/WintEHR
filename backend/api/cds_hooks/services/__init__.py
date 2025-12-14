"""
CDS Hooks Services Module (v3.0 Architecture)

Unified service layer for all CDS Hook service implementations.
All services inherit from CDSService base class with async execution.

Educational Focus:
- CDSService: Abstract base class for all CDS services
- SimpleCDSService: Simplified base for always-execute services
- HookType: Enum of CDS Hooks 2.0 hook types
- Builtin services: Pre-built clinical decision support services

Module Structure:
    services/
    ├── __init__.py          # This file - exports all service classes
    ├── base_service.py      # CDSService and SimpleCDSService base classes
    └── builtin/             # Built-in service implementations
        └── __init__.py      # Screening, medication, lab services
"""

from .base_service import CDSService, SimpleCDSService
from ..models import HookType  # Canonical source for HookType

# Import builtin services for convenience
from .builtin import (
    ColonoscopyScreeningService,
    MammographyScreeningService,
    MedicationInteractionService,
    PotassiumMonitorService,
    DiabetesCareService,
    PatientGreeterService,
    get_builtin_services,
    register_builtin_services,
)

__all__ = [
    # Base classes
    "CDSService",
    "SimpleCDSService",
    "HookType",
    # Builtin service classes
    "ColonoscopyScreeningService",
    "MammographyScreeningService",
    "MedicationInteractionService",
    "PotassiumMonitorService",
    "DiabetesCareService",
    "PatientGreeterService",
    # Helper functions
    "get_builtin_services",
    "register_builtin_services",
]
