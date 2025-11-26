"""
CDS Hooks Built-in Hook Implementations

Built-in hook implementations for common clinical scenarios.
"""

from .medication_prescribe import (
    MedicationPrescribeHooks,
    medication_prescribe_hooks,
)

__all__ = [
    "MedicationPrescribeHooks",
    "medication_prescribe_hooks",
]
