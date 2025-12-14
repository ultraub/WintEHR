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
from .default_hooks import (
    create_default_hooks,
    get_default_hooks,
    get_sample_hooks,
)

__all__ = [
    # Persistence
    "HookPersistenceManager",
    "get_persistence_manager",
    "load_hooks_from_database",
    "save_sample_hooks_to_database",
    # Built-in hooks
    "MedicationPrescribeHooks",
    "medication_prescribe_hooks",
    # Default hooks
    "create_default_hooks",
    "get_default_hooks",
    "get_sample_hooks",
]
