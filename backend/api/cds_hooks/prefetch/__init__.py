"""
CDS Hooks Prefetch Module

FHIR prefetch handling and template resolution.

Educational Focus:
- PrefetchEngine: Main engine for executing prefetch queries
- PrefetchTemplates: Common prefetch patterns for different hooks
- PrefetchResolver: Template variable resolution
"""

from .engine import (
    PrefetchEngine,
    PrefetchTemplates,
    PrefetchResolver,
    FHIRClientWrapper,
    HAPIFHIRPrefetchClient,
    get_prefetch_engine,
    execute_prefetch,
)

__all__ = [
    "PrefetchEngine",
    "PrefetchTemplates",
    "PrefetchResolver",
    "FHIRClientWrapper",
    "HAPIFHIRPrefetchClient",
    "get_prefetch_engine",
    "execute_prefetch",
]
