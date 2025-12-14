"""
CDS Hooks Condition Engine

Declarative condition evaluation for CDS services.
Consolidates common patterns: age, gender, diagnosis, medication, lab value checks.

Educational Focus:
- Demonstrates strategy pattern for condition evaluation
- Shows how to build composable, declarative rules
- Illustrates FHIR resource extraction patterns
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union
from dateutil import parser as date_parser
import logging
import re

logger = logging.getLogger(__name__)


class ConditionOperator(str, Enum):
    """Operators for condition evaluation."""
    EQUALS = "eq"
    NOT_EQUALS = "ne"
    GREATER_THAN = "gt"
    GREATER_THAN_OR_EQUALS = "gte"
    LESS_THAN = "lt"
    LESS_THAN_OR_EQUALS = "lte"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    IN = "in"
    NOT_IN = "not_in"
    EXISTS = "exists"
    NOT_EXISTS = "not_exists"
    MATCHES = "matches"  # Regex match


class LogicalOperator(str, Enum):
    """Logical operators for combining conditions."""
    AND = "and"
    OR = "or"
    NOT = "not"


@dataclass
class ConditionResult:
    """Result of condition evaluation."""
    satisfied: bool
    condition_name: str
    details: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    def __bool__(self) -> bool:
        return self.satisfied


class Condition(ABC):
    """
    Abstract base class for all conditions.

    Conditions evaluate context and prefetch data to determine
    if a CDS service should execute.
    """

    name: str = "condition"

    @abstractmethod
    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """
        Evaluate the condition against context and prefetch data.

        Args:
            context: CDS Hooks context object
            prefetch: Pre-fetched FHIR resources

        Returns:
            ConditionResult indicating if condition is satisfied
        """
        pass


class AgeCondition(Condition):
    """
    Evaluate patient age against a threshold.

    Educational Notes:
        - Extracts birthDate from Patient resource in prefetch
        - Calculates age in years
        - Supports min_age, max_age, or exact_age comparisons
    """

    name = "age_condition"

    def __init__(
        self,
        min_age: Optional[int] = None,
        max_age: Optional[int] = None,
        prefetch_key: str = "patient"
    ):
        self.min_age = min_age
        self.max_age = max_age
        self.prefetch_key = prefetch_key

    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """Evaluate patient age condition."""
        patient = prefetch.get(self.prefetch_key)
        if not patient:
            return ConditionResult(
                satisfied=False,
                condition_name=self.name,
                error=f"Patient data not found in prefetch['{self.prefetch_key}']"
            )

        birth_date = patient.get("birthDate")
        if not birth_date:
            return ConditionResult(
                satisfied=False,
                condition_name=self.name,
                error="Patient birthDate not available"
            )

        try:
            birth = date_parser.parse(birth_date)
            today = datetime.now()
            age = today.year - birth.year - (
                (today.month, today.day) < (birth.month, birth.day)
            )

            satisfied = True
            if self.min_age is not None and age < self.min_age:
                satisfied = False
            if self.max_age is not None and age > self.max_age:
                satisfied = False

            return ConditionResult(
                satisfied=satisfied,
                condition_name=self.name,
                details={
                    "patient_age": age,
                    "min_age": self.min_age,
                    "max_age": self.max_age
                }
            )
        except Exception as e:
            logger.warning(f"Error parsing birthDate '{birth_date}': {e}")
            return ConditionResult(
                satisfied=False,
                condition_name=self.name,
                error=f"Failed to parse birthDate: {e}"
            )


class GenderCondition(Condition):
    """
    Evaluate patient gender.

    Educational Notes:
        - FHIR uses 'gender' field with values: male, female, other, unknown
        - Case-insensitive comparison
    """

    name = "gender_condition"

    def __init__(
        self,
        gender: Union[str, List[str]],
        prefetch_key: str = "patient"
    ):
        self.gender = [gender.lower()] if isinstance(gender, str) else [g.lower() for g in gender]
        self.prefetch_key = prefetch_key

    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """Evaluate patient gender condition."""
        patient = prefetch.get(self.prefetch_key)
        if not patient:
            return ConditionResult(
                satisfied=False,
                condition_name=self.name,
                error=f"Patient data not found in prefetch['{self.prefetch_key}']"
            )

        patient_gender = patient.get("gender", "").lower()
        satisfied = patient_gender in self.gender

        return ConditionResult(
            satisfied=satisfied,
            condition_name=self.name,
            details={
                "patient_gender": patient_gender,
                "required_gender": self.gender
            }
        )


class DiagnosisCondition(Condition):
    """
    Check if patient has specific diagnoses/conditions.

    Educational Notes:
        - Searches Condition resources in prefetch
        - Matches against ICD-10, SNOMED CT, or other coding systems
        - Supports partial text matching
    """

    name = "diagnosis_condition"

    def __init__(
        self,
        codes: Optional[List[str]] = None,
        text_contains: Optional[List[str]] = None,
        coding_system: Optional[str] = None,
        prefetch_key: str = "conditions",
        require_all: bool = False
    ):
        self.codes = codes or []
        self.text_contains = [t.lower() for t in (text_contains or [])]
        self.coding_system = coding_system
        self.prefetch_key = prefetch_key
        self.require_all = require_all

    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """Evaluate diagnosis condition."""
        conditions_bundle = prefetch.get(self.prefetch_key, {})
        entries = conditions_bundle.get("entry", [])

        if not entries:
            return ConditionResult(
                satisfied=False,
                condition_name=self.name,
                details={"reason": "No conditions found in prefetch"}
            )

        matched_codes = set()
        matched_texts = set()

        for entry in entries:
            resource = entry.get("resource", {})
            code_obj = resource.get("code", {})

            # Check coding matches
            for coding in code_obj.get("coding", []):
                if self.coding_system and coding.get("system") != self.coding_system:
                    continue
                if coding.get("code") in self.codes:
                    matched_codes.add(coding.get("code"))

            # Check text matches
            text = code_obj.get("text", "").lower()
            display_texts = [
                c.get("display", "").lower() for c in code_obj.get("coding", [])
            ]

            for search_text in self.text_contains:
                if search_text in text:
                    matched_texts.add(search_text)
                for display in display_texts:
                    if search_text in display:
                        matched_texts.add(search_text)

        # Determine satisfaction
        if self.require_all:
            codes_satisfied = all(c in matched_codes for c in self.codes)
            texts_satisfied = all(t in matched_texts for t in self.text_contains)
            satisfied = codes_satisfied and texts_satisfied
        else:
            satisfied = bool(matched_codes) or bool(matched_texts)

        return ConditionResult(
            satisfied=satisfied,
            condition_name=self.name,
            details={
                "matched_codes": list(matched_codes),
                "matched_texts": list(matched_texts),
                "required_codes": self.codes,
                "required_texts": self.text_contains
            }
        )


class MedicationCondition(Condition):
    """
    Check patient medications.

    Educational Notes:
        - Searches MedicationRequest/MedicationStatement resources
        - Matches by code, text, or drug class
    """

    name = "medication_condition"

    def __init__(
        self,
        codes: Optional[List[str]] = None,
        text_contains: Optional[List[str]] = None,
        min_count: int = 1,
        max_count: Optional[int] = None,
        prefetch_key: str = "medications"
    ):
        self.codes = codes or []
        self.text_contains = [t.lower() for t in (text_contains or [])]
        self.min_count = min_count
        self.max_count = max_count
        self.prefetch_key = prefetch_key

    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """Evaluate medication condition."""
        meds_bundle = prefetch.get(self.prefetch_key, {})
        entries = meds_bundle.get("entry", [])

        matching_meds = []

        for entry in entries:
            resource = entry.get("resource", {})

            # Get medication code
            med_code = resource.get("medicationCodeableConcept", {})
            if not med_code:
                med_code = resource.get("medication", {}).get("codeableConcept", {})

            # Check code matches
            for coding in med_code.get("coding", []):
                if coding.get("code") in self.codes:
                    matching_meds.append(resource)
                    break
            else:
                # Check text matches
                text = med_code.get("text", "").lower()
                display_texts = [
                    c.get("display", "").lower() for c in med_code.get("coding", [])
                ]

                for search_text in self.text_contains:
                    if search_text in text or any(search_text in d for d in display_texts):
                        matching_meds.append(resource)
                        break

        count = len(matching_meds)
        satisfied = count >= self.min_count
        if self.max_count is not None:
            satisfied = satisfied and count <= self.max_count

        return ConditionResult(
            satisfied=satisfied,
            condition_name=self.name,
            details={
                "matching_count": count,
                "min_required": self.min_count,
                "max_allowed": self.max_count,
                "matching_medications": [
                    m.get("medicationCodeableConcept", {}).get("text", "Unknown")
                    for m in matching_meds[:5]  # Limit to first 5
                ]
            }
        )


class LabValueCondition(Condition):
    """
    Evaluate lab values against thresholds.

    Educational Notes:
        - Searches Observation resources
        - Supports LOINC codes for lab identification
        - Can check for critical high/low values
    """

    name = "lab_value_condition"

    def __init__(
        self,
        loinc_code: str,
        operator: ConditionOperator = ConditionOperator.EXISTS,
        value: Optional[float] = None,
        critical_high: Optional[float] = None,
        critical_low: Optional[float] = None,
        within_days: int = 30,
        prefetch_key: str = "recentLabs"
    ):
        self.loinc_code = loinc_code
        self.operator = operator
        self.value = value
        self.critical_high = critical_high
        self.critical_low = critical_low
        self.within_days = within_days
        self.prefetch_key = prefetch_key

    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """Evaluate lab value condition."""
        labs_bundle = prefetch.get(self.prefetch_key, {})
        entries = labs_bundle.get("entry", [])

        matching_labs = []
        cutoff_date = datetime.now() - timedelta(days=self.within_days)

        for entry in entries:
            resource = entry.get("resource", {})

            # Check if this is the lab we're looking for
            code_obj = resource.get("code", {})
            has_matching_code = any(
                c.get("code") == self.loinc_code
                for c in code_obj.get("coding", [])
            )

            if not has_matching_code:
                continue

            # Check date if available
            effective = resource.get("effectiveDateTime")
            if effective:
                try:
                    lab_date = date_parser.parse(effective)
                    if lab_date.replace(tzinfo=None) < cutoff_date:
                        continue
                except Exception:
                    pass

            matching_labs.append(resource)

        if not matching_labs:
            return ConditionResult(
                satisfied=self.operator == ConditionOperator.NOT_EXISTS,
                condition_name=self.name,
                details={"reason": f"No labs found for LOINC {self.loinc_code}"}
            )

        # Get the most recent lab value
        latest_lab = matching_labs[0]
        lab_value = latest_lab.get("valueQuantity", {}).get("value")

        if lab_value is None:
            return ConditionResult(
                satisfied=False,
                condition_name=self.name,
                details={"reason": "Lab found but no numeric value"}
            )

        # Evaluate based on operator or critical thresholds
        satisfied = True
        details = {
            "lab_value": lab_value,
            "loinc_code": self.loinc_code
        }

        if self.critical_high is not None and lab_value > self.critical_high:
            details["critical"] = "high"
            details["threshold"] = self.critical_high
            satisfied = True  # Condition met - critical high found

        elif self.critical_low is not None and lab_value < self.critical_low:
            details["critical"] = "low"
            details["threshold"] = self.critical_low
            satisfied = True  # Condition met - critical low found

        elif self.value is not None:
            # Standard comparison
            if self.operator == ConditionOperator.EQUALS:
                satisfied = lab_value == self.value
            elif self.operator == ConditionOperator.NOT_EQUALS:
                satisfied = lab_value != self.value
            elif self.operator == ConditionOperator.GREATER_THAN:
                satisfied = lab_value > self.value
            elif self.operator == ConditionOperator.GREATER_THAN_OR_EQUALS:
                satisfied = lab_value >= self.value
            elif self.operator == ConditionOperator.LESS_THAN:
                satisfied = lab_value < self.value
            elif self.operator == ConditionOperator.LESS_THAN_OR_EQUALS:
                satisfied = lab_value <= self.value

            details["comparison_value"] = self.value
            details["operator"] = self.operator.value

        else:
            # Just checking existence
            satisfied = True

        return ConditionResult(
            satisfied=satisfied,
            condition_name=self.name,
            details=details
        )


class HookTypeCondition(Condition):
    """
    Check if the request matches specific hook types.

    Educational Notes:
        - Useful for services that only run on certain hooks
        - E.g., medication-prescribe vs patient-view
    """

    name = "hook_type_condition"

    def __init__(self, hook_types: Union[str, List[str]]):
        self.hook_types = [hook_types] if isinstance(hook_types, str) else hook_types

    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """Check if context hook matches required types."""
        current_hook = context.get("hook", "")
        satisfied = current_hook in self.hook_types

        return ConditionResult(
            satisfied=satisfied,
            condition_name=self.name,
            details={
                "current_hook": current_hook,
                "required_hooks": self.hook_types
            }
        )


class CompositeCondition(Condition):
    """
    Combine multiple conditions with logical operators.

    Educational Notes:
        - Supports AND, OR, NOT operations
        - Enables complex rule building from simple conditions
    """

    name = "composite_condition"

    def __init__(
        self,
        conditions: List[Condition],
        operator: LogicalOperator = LogicalOperator.AND
    ):
        self.conditions = conditions
        self.operator = operator

    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """Evaluate composite condition."""
        results = []

        for condition in self.conditions:
            result = await condition.evaluate(context, prefetch)
            results.append(result)

        if self.operator == LogicalOperator.AND:
            satisfied = all(r.satisfied for r in results)
        elif self.operator == LogicalOperator.OR:
            satisfied = any(r.satisfied for r in results)
        elif self.operator == LogicalOperator.NOT:
            # NOT applies to first condition only
            satisfied = not results[0].satisfied if results else True

        return ConditionResult(
            satisfied=satisfied,
            condition_name=self.name,
            details={
                "operator": self.operator.value,
                "sub_results": [
                    {
                        "condition": r.condition_name,
                        "satisfied": r.satisfied,
                        "details": r.details
                    }
                    for r in results
                ]
            }
        )


class CustomCondition(Condition):
    """
    Create a condition from a custom function.

    Educational Notes:
        - Allows arbitrary condition logic
        - Useful for complex, one-off conditions
    """

    name = "custom_condition"

    def __init__(
        self,
        evaluator: Callable[[Dict[str, Any], Dict[str, Any]], bool],
        name: str = "custom_condition"
    ):
        self.evaluator = evaluator
        self.name = name

    async def evaluate(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """Evaluate custom condition function."""
        try:
            # Support both sync and async evaluators
            import asyncio
            if asyncio.iscoroutinefunction(self.evaluator):
                satisfied = await self.evaluator(context, prefetch)
            else:
                satisfied = self.evaluator(context, prefetch)

            return ConditionResult(
                satisfied=bool(satisfied),
                condition_name=self.name
            )
        except Exception as e:
            logger.error(f"Error in custom condition '{self.name}': {e}")
            return ConditionResult(
                satisfied=False,
                condition_name=self.name,
                error=str(e)
            )


class ConditionEngine:
    """
    Engine for evaluating CDS service conditions.

    Provides a centralized way to evaluate conditions and
    determine if a service should execute.

    Educational Notes:
        - Services can define conditions declaratively
        - Engine handles evaluation and result aggregation
        - Supports early exit on first failure for efficiency
    """

    def __init__(self, early_exit: bool = True):
        """
        Initialize the condition engine.

        Args:
            early_exit: If True, stop evaluating on first failed condition
        """
        self.early_exit = early_exit

    async def evaluate(
        self,
        conditions: List[Condition],
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> ConditionResult:
        """
        Evaluate a list of conditions.

        All conditions must pass for the overall result to be satisfied.

        Args:
            conditions: List of conditions to evaluate
            context: CDS Hooks context object
            prefetch: Pre-fetched FHIR resources

        Returns:
            ConditionResult with overall satisfaction status
        """
        if not conditions:
            return ConditionResult(
                satisfied=True,
                condition_name="no_conditions",
                details={"reason": "No conditions to evaluate"}
            )

        results = []

        for condition in conditions:
            try:
                result = await condition.evaluate(context, prefetch)
                results.append(result)

                if not result.satisfied and self.early_exit:
                    return ConditionResult(
                        satisfied=False,
                        condition_name="condition_engine",
                        details={
                            "failed_condition": result.condition_name,
                            "failure_details": result.details,
                            "evaluated_count": len(results),
                            "total_conditions": len(conditions)
                        }
                    )
            except Exception as e:
                logger.error(f"Error evaluating condition {condition.name}: {e}")
                return ConditionResult(
                    satisfied=False,
                    condition_name="condition_engine",
                    error=f"Evaluation error in {condition.name}: {e}"
                )

        # All conditions passed
        return ConditionResult(
            satisfied=True,
            condition_name="condition_engine",
            details={
                "all_passed": True,
                "condition_count": len(results),
                "condition_details": [
                    {"name": r.condition_name, "satisfied": r.satisfied}
                    for r in results
                ]
            }
        )

    @staticmethod
    def age_at_least(min_age: int) -> AgeCondition:
        """Convenience factory: patient age >= min_age."""
        return AgeCondition(min_age=min_age)

    @staticmethod
    def age_between(min_age: int, max_age: int) -> AgeCondition:
        """Convenience factory: min_age <= patient age <= max_age."""
        return AgeCondition(min_age=min_age, max_age=max_age)

    @staticmethod
    def gender_is(gender: Union[str, List[str]]) -> GenderCondition:
        """Convenience factory: patient gender matches."""
        return GenderCondition(gender=gender)

    @staticmethod
    def has_diagnosis(
        codes: Optional[List[str]] = None,
        text_contains: Optional[List[str]] = None
    ) -> DiagnosisCondition:
        """Convenience factory: patient has diagnosis."""
        return DiagnosisCondition(codes=codes, text_contains=text_contains)

    @staticmethod
    def on_medication(
        codes: Optional[List[str]] = None,
        text_contains: Optional[List[str]] = None
    ) -> MedicationCondition:
        """Convenience factory: patient is on medication."""
        return MedicationCondition(codes=codes, text_contains=text_contains)

    @staticmethod
    def medication_count(min_count: int, max_count: Optional[int] = None) -> MedicationCondition:
        """Convenience factory: patient medication count in range."""
        return MedicationCondition(min_count=min_count, max_count=max_count)

    @staticmethod
    def lab_above(loinc_code: str, threshold: float) -> LabValueCondition:
        """Convenience factory: lab value above threshold."""
        return LabValueCondition(
            loinc_code=loinc_code,
            operator=ConditionOperator.GREATER_THAN,
            value=threshold
        )

    @staticmethod
    def lab_below(loinc_code: str, threshold: float) -> LabValueCondition:
        """Convenience factory: lab value below threshold."""
        return LabValueCondition(
            loinc_code=loinc_code,
            operator=ConditionOperator.LESS_THAN,
            value=threshold
        )

    @staticmethod
    def lab_critical(
        loinc_code: str,
        critical_high: Optional[float] = None,
        critical_low: Optional[float] = None
    ) -> LabValueCondition:
        """Convenience factory: lab value in critical range."""
        return LabValueCondition(
            loinc_code=loinc_code,
            critical_high=critical_high,
            critical_low=critical_low
        )

    @staticmethod
    def hook_is(hook_types: Union[str, List[str]]) -> HookTypeCondition:
        """Convenience factory: check hook type."""
        return HookTypeCondition(hook_types=hook_types)

    @staticmethod
    def all_of(*conditions: Condition) -> CompositeCondition:
        """Convenience factory: all conditions must pass."""
        return CompositeCondition(list(conditions), LogicalOperator.AND)

    @staticmethod
    def any_of(*conditions: Condition) -> CompositeCondition:
        """Convenience factory: any condition passes."""
        return CompositeCondition(list(conditions), LogicalOperator.OR)

    @staticmethod
    def none_of(*conditions: Condition) -> CompositeCondition:
        """Convenience factory: no condition passes."""
        inner = CompositeCondition(list(conditions), LogicalOperator.OR)
        return CompositeCondition([inner], LogicalOperator.NOT)
