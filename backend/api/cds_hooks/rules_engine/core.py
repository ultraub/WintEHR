"""
CDS Rules Engine Core

A comprehensive clinical decision support rules engine that evaluates
clinical rules against patient data and generates actionable recommendations.
"""

import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, Set, Tuple, Union
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import re

logger = logging.getLogger(__name__)


class RulePriority(Enum):
    """Priority levels for CDS rules"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class RuleCategory(Enum):
    """Categories for organizing CDS rules"""
    MEDICATION_SAFETY = "medication_safety"
    DRUG_INTERACTIONS = "drug_interactions"
    ALLERGIES = "allergies"
    CLINICAL_GUIDELINES = "clinical_guidelines"
    PREVENTIVE_CARE = "preventive_care"
    LAB_MONITORING = "lab_monitoring"
    VITAL_SIGNS = "vital_signs"
    CHRONIC_DISEASE = "chronic_disease"
    QUALITY_MEASURES = "quality_measures"
    ALERTS = "alerts"


@dataclass
class RuleCondition:
    """Represents a condition that must be met for a rule to trigger"""
    field: str  # Path to field in patient data (e.g., "conditions[].code")
    operator: str  # eq, ne, gt, lt, gte, lte, contains, exists, regex
    value: Any  # Value to compare against
    data_type: str = "string"  # string, number, date, boolean
    
    def evaluate(self, data: Any) -> bool:
        """Evaluate this condition against data"""
        try:
            field_value = self._extract_field_value(data, self.field)
            return self._compare(field_value, self.value)
        except Exception as e:
            logger.debug(f"Condition evaluation error: {e}")
            return False
    
    def _extract_field_value(self, data: Any, field_path: str) -> Any:
        """Extract value from nested data structure using path notation"""
        parts = field_path.replace('][', '.').replace('[', '.').replace(']', '').split('.')
        current = data
        
        for part in parts:
            if part == '':  # Handle array notation
                continue
            elif isinstance(current, list):
                # Handle array access
                results = []
                for item in current:
                    if isinstance(item, dict) and part in item:
                        results.append(item[part])
                return results if results else None
            elif isinstance(current, dict):
                current = current.get(part)
            else:
                return None
                
        return current
    
    def _compare(self, field_value: Any, expected_value: Any) -> bool:
        """Compare values based on operator"""
        if self.operator == "exists":
            return field_value is not None
        
        if field_value is None:
            return False
        
        # Handle list values (from array fields)
        if isinstance(field_value, list):
            return any(self._compare_single(v, expected_value) for v in field_value)
        
        return self._compare_single(field_value, expected_value)
    
    def _compare_single(self, value: Any, expected: Any) -> bool:
        """Compare a single value"""
        try:
            if self.operator == "eq":
                return str(value) == str(expected)
            elif self.operator == "ne":
                return str(value) != str(expected)
            elif self.operator == "contains":
                return str(expected).lower() in str(value).lower()
            elif self.operator == "regex":
                return bool(re.search(expected, str(value)))
            elif self.operator in ["gt", "lt", "gte", "lte"]:
                return self._numeric_compare(value, expected)
            else:
                return False
        except Exception:
            return False
    
    def _numeric_compare(self, value: Any, expected: Any) -> bool:
        """Handle numeric comparisons"""
        try:
            if self.data_type == "date":
                val = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
                exp = datetime.fromisoformat(str(expected).replace('Z', '+00:00'))
            else:
                val = float(value)
                exp = float(expected)
            
            if self.operator == "gt":
                return val > exp
            elif self.operator == "lt":
                return val < exp
            elif self.operator == "gte":
                return val >= exp
            elif self.operator == "lte":
                return val <= exp
        except Exception:
            return False


@dataclass
class RuleAction:
    """Action to take when a rule triggers"""
    type: str  # "card", "suggestion", "alert", "order", "reminder"
    summary: str
    detail: str
    indicator: str = "info"  # info, warning, critical
    suggestions: List[Dict[str, Any]] = field(default_factory=list)
    links: List[Dict[str, str]] = field(default_factory=list)
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Rule:
    """A clinical decision support rule"""
    id: str
    name: str
    description: str
    category: RuleCategory
    priority: RulePriority
    conditions: List[RuleCondition]
    actions: List[RuleAction]
    enabled: bool = True
    tags: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def evaluate(self, context: Dict[str, Any]) -> Tuple[bool, List[RuleAction]]:
        """
        Evaluate rule against context data
        Returns (triggered, actions) tuple
        """
        if not self.enabled:
            return False, []
        
        # All conditions must be met (AND logic)
        for condition in self.conditions:
            if not condition.evaluate(context):
                return False, []
        
        return True, self.actions


class RuleSet:
    """Collection of rules that can be evaluated together"""
    
    def __init__(self, name: str):
        self.name = name
        self.rules: List[Rule] = []
        self.metadata: Dict[str, Any] = {}
    
    def add_rule(self, rule: Rule):
        """Add a rule to the set"""
        self.rules.append(rule)
    
    def remove_rule(self, rule_id: str):
        """Remove a rule by ID"""
        self.rules = [r for r in self.rules if r.id != rule_id]
    
    def get_rule(self, rule_id: str) -> Optional[Rule]:
        """Get a rule by ID"""
        for rule in self.rules:
            if rule.id == rule_id:
                return rule
        return None
    
    async def evaluate(
        self,
        context: Dict[str, Any],
        categories: Optional[List[RuleCategory]] = None,
        priorities: Optional[List[RulePriority]] = None
    ) -> List[Tuple[Rule, List[RuleAction]]]:
        """
        Evaluate all rules in the set against context
        
        Args:
            context: Patient and clinical context data
            categories: Filter rules by category
            priorities: Filter rules by priority
            
        Returns:
            List of (rule, actions) tuples for triggered rules
        """
        results = []
        
        # Filter rules
        rules_to_evaluate = self.rules
        if categories:
            rules_to_evaluate = [r for r in rules_to_evaluate if r.category in categories]
        if priorities:
            rules_to_evaluate = [r for r in rules_to_evaluate if r.priority in priorities]
        
        # Evaluate rules in parallel for performance
        tasks = []
        for rule in rules_to_evaluate:
            tasks.append(self._evaluate_rule_async(rule, context))
        
        evaluations = await asyncio.gather(*tasks)
        
        # Collect triggered rules
        for rule, (triggered, actions) in zip(rules_to_evaluate, evaluations):
            if triggered:
                results.append((rule, actions))
        
        # Sort by priority
        priority_order = {
            RulePriority.CRITICAL: 0,
            RulePriority.HIGH: 1,
            RulePriority.MEDIUM: 2,
            RulePriority.LOW: 3,
            RulePriority.INFO: 4
        }
        results.sort(key=lambda x: priority_order.get(x[0].priority, 5))
        
        return results
    
    async def _evaluate_rule_async(self, rule: Rule, context: Dict[str, Any]) -> Tuple[bool, List[RuleAction]]:
        """Evaluate a single rule asynchronously"""
        return rule.evaluate(context)


class RulesEngine:
    """Main CDS Rules Engine"""
    
    def __init__(self):
        self.rule_sets: Dict[str, RuleSet] = {}
        self.global_context: Dict[str, Any] = {}
        self._load_default_rules()
    
    def add_rule_set(self, rule_set: RuleSet):
        """Add a rule set to the engine"""
        self.rule_sets[rule_set.name] = rule_set
    
    def get_rule_set(self, name: str) -> Optional[RuleSet]:
        """Get a rule set by name"""
        return self.rule_sets.get(name)
    
    async def evaluate(
        self,
        context: Dict[str, Any],
        rule_sets: Optional[List[str]] = None,
        categories: Optional[List[RuleCategory]] = None,
        priorities: Optional[List[RulePriority]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate rules against context
        
        Args:
            context: Clinical context including patient data
            rule_sets: Specific rule sets to evaluate (None = all)
            categories: Filter by categories
            priorities: Filter by priorities
            
        Returns:
            Dictionary with cards and other CDS Hook responses
        """
        # Merge with global context
        full_context = {**self.global_context, **context}
        
        # Determine which rule sets to evaluate
        sets_to_evaluate = []
        if rule_sets:
            sets_to_evaluate = [self.rule_sets[name] for name in rule_sets if name in self.rule_sets]
        else:
            sets_to_evaluate = list(self.rule_sets.values())
        
        # Evaluate all rule sets
        all_results = []
        for rule_set in sets_to_evaluate:
            results = await rule_set.evaluate(full_context, categories, priorities)
            all_results.extend(results)
        
        # Convert to CDS Hooks format
        return self._format_cds_response(all_results)
    
    def _format_cds_response(self, results: List[Tuple[Rule, List[RuleAction]]]) -> Dict[str, Any]:
        """Format results as CDS Hooks response"""
        cards = []
        suggestions = []
        
        for rule, actions in results:
            for action in actions:
                if action.type == "card":
                    card = {
                        "summary": action.summary,
                        "detail": action.detail,
                        "indicator": action.indicator,
                        "source": {
                            "label": f"CDS Rules Engine - {rule.name}",
                            "topic": {
                                "code": rule.category.value,
                                "display": rule.category.value.replace("_", " ").title()
                            }
                        }
                    }
                    
                    if action.suggestions:
                        card["suggestions"] = action.suggestions
                    if action.links:
                        card["links"] = action.links
                    
                    cards.append(card)
                    
                elif action.type == "suggestion":
                    suggestions.extend(action.suggestions)
        
        response = {"cards": cards}
        if suggestions:
            response["suggestions"] = suggestions
            
        return response
    
    def _load_default_rules(self):
        """Load default clinical rules"""
        # Create default rule sets
        medication_safety = RuleSet("medication_safety")
        chronic_disease = RuleSet("chronic_disease_management")
        preventive_care = RuleSet("preventive_care")
        
        # Add to engine
        self.add_rule_set(medication_safety)
        self.add_rule_set(chronic_disease)
        self.add_rule_set(preventive_care)
        
        logger.info(f"Loaded {len(self.rule_sets)} default rule sets")


# Global rules engine instance
rules_engine = RulesEngine()