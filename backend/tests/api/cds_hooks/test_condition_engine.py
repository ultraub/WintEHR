"""
Tests for the CDS Hooks Condition Engine

Tests the declarative condition evaluation system including:
- Individual condition types (Age, Gender, Diagnosis, Medication, LabValue, HookType)
- Composite conditions (AND, OR, NOT)
- ConditionEngine factory methods and evaluation
- Edge cases with missing/malformed data
"""

import pytest
from datetime import datetime, date
from unittest.mock import AsyncMock

from api.cds_hooks.conditions.engine import (
    ConditionEngine,
    ConditionResult,
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


# ---- Fixtures ----

@pytest.fixture
def patient_prefetch():
    """Patient prefetch data for a 55-year-old male"""
    return {
        "patient": {
            "resourceType": "Patient",
            "id": "123",
            "birthDate": "1970-06-15",
            "gender": "male",
            "name": [{"family": "Smith", "given": ["John"]}]
        }
    }


@pytest.fixture
def female_patient_prefetch():
    """Patient prefetch data for a 30-year-old female"""
    return {
        "patient": {
            "resourceType": "Patient",
            "id": "456",
            "birthDate": "1995-03-20",
            "gender": "female",
            "name": [{"family": "Doe", "given": ["Jane"]}]
        }
    }


@pytest.fixture
def conditions_prefetch():
    """Prefetch with condition/diagnosis data"""
    return {
        "patient": {
            "resourceType": "Patient",
            "id": "123",
            "birthDate": "1970-06-15",
            "gender": "male"
        },
        "conditions": {
            "resourceType": "Bundle",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Condition",
                        "code": {
                            "coding": [
                                {"system": "http://hl7.org/fhir/sid/icd-10", "code": "E11.9"}
                            ],
                            "text": "Type 2 diabetes mellitus"
                        }
                    }
                },
                {
                    "resource": {
                        "resourceType": "Condition",
                        "code": {
                            "coding": [
                                {"system": "http://hl7.org/fhir/sid/icd-10", "code": "I10"}
                            ],
                            "text": "Essential hypertension"
                        }
                    }
                }
            ]
        }
    }


@pytest.fixture
def medications_prefetch():
    """Prefetch with medication data"""
    return {
        "patient": {
            "resourceType": "Patient",
            "id": "123",
            "birthDate": "1970-06-15",
            "gender": "male"
        },
        "medications": {
            "resourceType": "Bundle",
            "entry": [
                {
                    "resource": {
                        "resourceType": "MedicationRequest",
                        "medicationCodeableConcept": {
                            "coding": [
                                {"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "855332"}
                            ],
                            "text": "Warfarin 5 MG"
                        }
                    }
                },
                {
                    "resource": {
                        "resourceType": "MedicationRequest",
                        "medicationCodeableConcept": {
                            "coding": [
                                {"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "197361"}
                            ],
                            "text": "Metformin 500 MG"
                        }
                    }
                },
                {
                    "resource": {
                        "resourceType": "MedicationRequest",
                        "medicationCodeableConcept": {
                            "text": "Lisinopril 10 MG"
                        }
                    }
                }
            ]
        }
    }


@pytest.fixture
def labs_prefetch():
    """Prefetch with lab observation data"""
    return {
        "patient": {
            "resourceType": "Patient",
            "id": "123",
            "birthDate": "1970-06-15",
            "gender": "male"
        },
        "recentLabs": {
            "resourceType": "Bundle",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Observation",
                        "code": {
                            "coding": [
                                {"system": "http://loinc.org", "code": "2823-3"}
                            ],
                            "text": "Potassium"
                        },
                        "valueQuantity": {
                            "value": 5.8,
                            "unit": "mEq/L"
                        },
                        "effectiveDateTime": datetime.now().isoformat()
                    }
                },
                {
                    "resource": {
                        "resourceType": "Observation",
                        "code": {
                            "coding": [
                                {"system": "http://loinc.org", "code": "4548-4"}
                            ],
                            "text": "Hemoglobin A1c"
                        },
                        "valueQuantity": {
                            "value": 7.2,
                            "unit": "%"
                        },
                        "effectiveDateTime": datetime.now().isoformat()
                    }
                }
            ]
        }
    }


@pytest.fixture
def default_context():
    """Default hook context"""
    return {
        "patientId": "Patient/123",
        "userId": "Practitioner/456",
        "hook": "patient-view"
    }


# ---- AgeCondition Tests ----

class TestAgeCondition:

    @pytest.mark.asyncio
    async def test_age_at_least_satisfied(self, patient_prefetch, default_context):
        condition = AgeCondition(min_age=50)
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_age_at_least_not_satisfied(self, female_patient_prefetch, default_context):
        condition = AgeCondition(min_age=50)
        result = await condition.evaluate(default_context, female_patient_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_age_between_satisfied(self, patient_prefetch, default_context):
        condition = AgeCondition(min_age=40, max_age=65)
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_age_between_not_satisfied(self, female_patient_prefetch, default_context):
        condition = AgeCondition(min_age=40, max_age=50)
        result = await condition.evaluate(default_context, female_patient_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_age_missing_birthdate(self, default_context):
        prefetch = {"patient": {"resourceType": "Patient", "id": "123"}}
        condition = AgeCondition(min_age=18)
        result = await condition.evaluate(default_context, prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_age_missing_patient(self, default_context):
        prefetch = {}
        condition = AgeCondition(min_age=18)
        result = await condition.evaluate(default_context, prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_age_factory_method(self, patient_prefetch, default_context):
        condition = ConditionEngine.age_at_least(50)
        assert isinstance(condition, AgeCondition)
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_age_between_factory_method(self, patient_prefetch, default_context):
        condition = ConditionEngine.age_between(40, 65)
        assert isinstance(condition, AgeCondition)
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True


# ---- GenderCondition Tests ----

class TestGenderCondition:

    @pytest.mark.asyncio
    async def test_gender_male_match(self, patient_prefetch, default_context):
        condition = GenderCondition(gender="male")
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_gender_female_no_match(self, patient_prefetch, default_context):
        condition = GenderCondition(gender="female")
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_gender_list_match(self, patient_prefetch, default_context):
        condition = GenderCondition(gender=["male", "other"])
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_gender_missing_patient(self, default_context):
        prefetch = {}
        condition = GenderCondition(gender="male")
        result = await condition.evaluate(default_context, prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_gender_factory_method(self, female_patient_prefetch, default_context):
        condition = ConditionEngine.gender_is("female")
        assert isinstance(condition, GenderCondition)
        result = await condition.evaluate(default_context, female_patient_prefetch)
        assert result.satisfied is True


# ---- DiagnosisCondition Tests ----

class TestDiagnosisCondition:

    @pytest.mark.asyncio
    async def test_diagnosis_by_code(self, conditions_prefetch, default_context):
        condition = DiagnosisCondition(codes=["E11.9"])
        result = await condition.evaluate(default_context, conditions_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_diagnosis_by_text(self, conditions_prefetch, default_context):
        condition = DiagnosisCondition(text_contains=["diabetes"])
        result = await condition.evaluate(default_context, conditions_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_diagnosis_not_found(self, conditions_prefetch, default_context):
        condition = DiagnosisCondition(text_contains=["cancer"])
        result = await condition.evaluate(default_context, conditions_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_diagnosis_missing_conditions(self, default_context):
        prefetch = {"patient": {"resourceType": "Patient"}}
        condition = DiagnosisCondition(text_contains=["diabetes"])
        result = await condition.evaluate(default_context, prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_diagnosis_empty_bundle(self, default_context):
        prefetch = {
            "conditions": {"resourceType": "Bundle", "entry": []}
        }
        condition = DiagnosisCondition(text_contains=["diabetes"])
        result = await condition.evaluate(default_context, prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_diagnosis_factory_method(self, conditions_prefetch, default_context):
        condition = ConditionEngine.has_diagnosis(text_contains=["hypertension"])
        assert isinstance(condition, DiagnosisCondition)
        result = await condition.evaluate(default_context, conditions_prefetch)
        assert result.satisfied is True


# ---- MedicationCondition Tests ----

class TestMedicationCondition:

    @pytest.mark.asyncio
    async def test_medication_by_text(self, medications_prefetch, default_context):
        condition = MedicationCondition(text_contains=["warfarin"])
        result = await condition.evaluate(default_context, medications_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_medication_by_code(self, medications_prefetch, default_context):
        condition = MedicationCondition(codes=["855332"])
        result = await condition.evaluate(default_context, medications_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_medication_not_found(self, medications_prefetch, default_context):
        condition = MedicationCondition(text_contains=["aspirin"])
        result = await condition.evaluate(default_context, medications_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_medication_count_with_match(self, medications_prefetch, default_context):
        # Count requires text_contains or codes to actually match medications
        condition = MedicationCondition(text_contains=["mg"], min_count=2)
        result = await condition.evaluate(default_context, medications_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_medication_count_too_high(self, medications_prefetch, default_context):
        condition = MedicationCondition(text_contains=["mg"], min_count=10)
        result = await condition.evaluate(default_context, medications_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_medication_factory_method(self, medications_prefetch, default_context):
        condition = ConditionEngine.on_medication(text_contains=["metformin"])
        assert isinstance(condition, MedicationCondition)
        result = await condition.evaluate(default_context, medications_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_medication_count_factory(self, medications_prefetch, default_context):
        # medication_count factory requires text_contains or codes to match
        condition = ConditionEngine.on_medication(text_contains=["mg"])
        assert isinstance(condition, MedicationCondition)
        result = await condition.evaluate(default_context, medications_prefetch)
        assert result.satisfied is True


# ---- LabValueCondition Tests ----

class TestLabValueCondition:

    @pytest.mark.asyncio
    async def test_lab_above_threshold(self, labs_prefetch, default_context):
        condition = LabValueCondition(
            loinc_code="2823-3",
            operator=ConditionOperator.GREATER_THAN,
            value=5.5
        )
        result = await condition.evaluate(default_context, labs_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_lab_below_threshold(self, labs_prefetch, default_context):
        condition = LabValueCondition(
            loinc_code="2823-3",
            operator=ConditionOperator.LESS_THAN,
            value=4.0
        )
        result = await condition.evaluate(default_context, labs_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_lab_exists(self, labs_prefetch, default_context):
        condition = LabValueCondition(
            loinc_code="4548-4",
            operator=ConditionOperator.EXISTS
        )
        result = await condition.evaluate(default_context, labs_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_lab_not_exists(self, labs_prefetch, default_context):
        condition = LabValueCondition(
            loinc_code="99999-9",
            operator=ConditionOperator.EXISTS
        )
        result = await condition.evaluate(default_context, labs_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_lab_missing_prefetch(self, default_context):
        prefetch = {"patient": {"resourceType": "Patient"}}
        condition = LabValueCondition(
            loinc_code="2823-3",
            operator=ConditionOperator.EXISTS
        )
        result = await condition.evaluate(default_context, prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_lab_above_factory(self, labs_prefetch, default_context):
        condition = ConditionEngine.lab_above("2823-3", 5.0)
        assert isinstance(condition, LabValueCondition)
        result = await condition.evaluate(default_context, labs_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_lab_below_factory(self, labs_prefetch, default_context):
        condition = ConditionEngine.lab_below("2823-3", 6.0)
        assert isinstance(condition, LabValueCondition)
        result = await condition.evaluate(default_context, labs_prefetch)
        # 5.8 < 6.0 should be satisfied
        assert result.satisfied is True


# ---- HookTypeCondition Tests ----

class TestHookTypeCondition:

    @pytest.mark.asyncio
    async def test_hook_type_match(self, patient_prefetch, default_context):
        condition = HookTypeCondition(hook_types="patient-view")
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_hook_type_no_match(self, patient_prefetch, default_context):
        condition = HookTypeCondition(hook_types="medication-prescribe")
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_hook_type_list_match(self, patient_prefetch, default_context):
        condition = HookTypeCondition(hook_types=["patient-view", "encounter-start"])
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_hook_type_factory(self, patient_prefetch, default_context):
        condition = ConditionEngine.hook_is("patient-view")
        assert isinstance(condition, HookTypeCondition)
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True


# ---- CompositeCondition Tests ----

class TestCompositeCondition:

    @pytest.mark.asyncio
    async def test_all_of_satisfied(self, patient_prefetch, default_context):
        composite = ConditionEngine.all_of(
            ConditionEngine.age_at_least(50),
            ConditionEngine.gender_is("male")
        )
        result = await composite.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_all_of_one_fails(self, patient_prefetch, default_context):
        composite = ConditionEngine.all_of(
            ConditionEngine.age_at_least(50),
            ConditionEngine.gender_is("female")
        )
        result = await composite.evaluate(default_context, patient_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_any_of_one_passes(self, patient_prefetch, default_context):
        composite = ConditionEngine.any_of(
            ConditionEngine.age_at_least(80),
            ConditionEngine.gender_is("male")
        )
        result = await composite.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_any_of_none_pass(self, patient_prefetch, default_context):
        composite = ConditionEngine.any_of(
            ConditionEngine.age_at_least(80),
            ConditionEngine.gender_is("female")
        )
        result = await composite.evaluate(default_context, patient_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_none_of_satisfied(self, patient_prefetch, default_context):
        composite = ConditionEngine.none_of(
            ConditionEngine.age_at_least(80),
            ConditionEngine.gender_is("female")
        )
        result = await composite.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_none_of_one_matches(self, patient_prefetch, default_context):
        composite = ConditionEngine.none_of(
            ConditionEngine.age_at_least(50),
            ConditionEngine.gender_is("female")
        )
        result = await composite.evaluate(default_context, patient_prefetch)
        assert result.satisfied is False


# ---- CustomCondition Tests ----

class TestCustomCondition:

    @pytest.mark.asyncio
    async def test_custom_condition_true(self, patient_prefetch, default_context):
        def always_true(context, prefetch):
            return True

        condition = CustomCondition(evaluator=always_true, name="always_true")
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_custom_condition_false(self, patient_prefetch, default_context):
        def always_false(context, prefetch):
            return False

        condition = CustomCondition(evaluator=always_false, name="always_false")
        result = await condition.evaluate(default_context, patient_prefetch)
        assert result.satisfied is False


# ---- ConditionEngine Tests ----

class TestConditionEngine:

    @pytest.mark.asyncio
    async def test_evaluate_all_satisfied(self, patient_prefetch, default_context):
        engine = ConditionEngine()
        conditions = [
            ConditionEngine.age_at_least(50),
            ConditionEngine.gender_is("male")
        ]
        result = await engine.evaluate(conditions, default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_evaluate_one_fails(self, patient_prefetch, default_context):
        engine = ConditionEngine()
        conditions = [
            ConditionEngine.age_at_least(50),
            ConditionEngine.gender_is("female")
        ]
        result = await engine.evaluate(conditions, default_context, patient_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_evaluate_empty_conditions(self, patient_prefetch, default_context):
        engine = ConditionEngine()
        result = await engine.evaluate([], default_context, patient_prefetch)
        assert result.satisfied is True

    @pytest.mark.asyncio
    async def test_evaluate_early_exit(self, patient_prefetch, default_context):
        engine = ConditionEngine(early_exit=True)
        conditions = [
            ConditionEngine.gender_is("female"),  # Fails first
            ConditionEngine.age_at_least(50),
        ]
        result = await engine.evaluate(conditions, default_context, patient_prefetch)
        assert result.satisfied is False

    @pytest.mark.asyncio
    async def test_condition_result_bool(self):
        result_true = ConditionResult(satisfied=True, condition_name="test")
        result_false = ConditionResult(satisfied=False, condition_name="test")
        assert bool(result_true) is True
        assert bool(result_false) is False
