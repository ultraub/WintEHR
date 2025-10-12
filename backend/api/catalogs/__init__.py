"""
Unified Clinical Catalogs Module

Provides access to clinical catalogs for CPOE (Computerized Provider Order Entry).
Supports multiple data sources:
- Dynamic FHIR-based catalogs (primary)
- Database catalogs (secondary)
- Static JSON catalogs (fallback)
"""

from .router import router
from .models import (
    MedicationCatalogItem,
    LabTestCatalogItem,
    ImagingStudyCatalogItem,
    OrderSetItem
)

__all__ = [
    "router",
    "MedicationCatalogItem",
    "LabTestCatalogItem",
    "ImagingStudyCatalogItem",
    "OrderSetItem"
]