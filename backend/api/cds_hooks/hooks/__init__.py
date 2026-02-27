"""
CDS Hooks Configuration Module

Hook configuration and persistence management.
"""

from .persistence import (
    HookPersistenceManager,
    get_persistence_manager,
    load_hooks_from_database,
    save_sample_hooks_to_database,
)
from .builtin import (
    MedicationPrescribeHooks,
    medication_prescribe_hooks,
)


def get_default_hooks():
    """Return empty hooks dict. Default hooks have been consolidated into built-in CDSService implementations."""
    return {}


def get_sample_hooks():
    """Return empty hooks dict. Alias for get_default_hooks()."""
    return {}


__all__ = [
    # Persistence
    "HookPersistenceManager",
    "get_persistence_manager",
    "load_hooks_from_database",
    "save_sample_hooks_to_database",
    # Built-in hooks
    "MedicationPrescribeHooks",
    "medication_prescribe_hooks",
    # Default hooks (returns empty dict - functionality consolidated into built-in services)
    "get_default_hooks",
    "get_sample_hooks",
]
