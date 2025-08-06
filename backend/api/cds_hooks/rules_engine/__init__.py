"""
CDS Rules Engine Module

A comprehensive clinical decision support rules engine that evaluates
clinical rules against patient data and generates actionable recommendations.
"""

from .core import (
    RulePriority,
    RuleCategory,
    RuleCondition,
    RuleAction,
    Rule,
    RuleSet,
    RulesEngine,
    rules_engine
)

from .clinical_rules import ClinicalRulesLibrary
from .data_adapters import FHIRDataAdapter
from .integration import CDSRulesIntegration, cds_integration

__all__ = [
    # Core classes
    'RulePriority',
    'RuleCategory',
    'RuleCondition',
    'RuleAction',
    'Rule',
    'RuleSet',
    'RulesEngine',
    'rules_engine',
    
    # Clinical rules
    'ClinicalRulesLibrary',
    
    # Adapters
    'FHIRDataAdapter',
    
    # Integration
    'CDSRulesIntegration',
    'cds_integration'
]