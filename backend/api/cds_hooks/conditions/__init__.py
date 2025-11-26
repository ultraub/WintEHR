"""
CDS Hooks Condition Evaluation Module

Centralized condition evaluation engine for all CDS services.
Provides a unified interface for evaluating clinical conditions.

Educational Focus:
- ConditionEngine: Main engine for evaluating conditions
- Condition classes: AgeCondition, GenderCondition, DiagnosisCondition, etc.
- CompositeCondition: Combine conditions with AND/OR/NOT logic
"""

from .engine import (
    ConditionEngine,
    ConditionResult,
    Condition,
    AgeCondition,
    GenderCondition,
    DiagnosisCondition,
    MedicationCondition,
    LabValueCondition,
    HookTypeCondition,
    CompositeCondition,
    CustomCondition,
    ConditionOperator,
    LogicalOperator,
)

__all__ = [
    "ConditionEngine",
    "ConditionResult",
    "Condition",
    "AgeCondition",
    "GenderCondition",
    "DiagnosisCondition",
    "MedicationCondition",
    "LabValueCondition",
    "HookTypeCondition",
    "CompositeCondition",
    "CustomCondition",
    "ConditionOperator",
    "LogicalOperator",
]
