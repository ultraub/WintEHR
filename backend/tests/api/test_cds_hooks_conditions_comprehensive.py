"""
Comprehensive Test Suite for CDS Hooks Condition Evaluation
Tests all condition types with all operators and edge cases

Created: 2025-10-05
Purpose: Validate all CDS condition evaluation logic after parameter fixes
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
from api.cds_hooks.cds_hooks_router import CDSHooksRouter


class TestAgeConditions:
    """Test age condition evaluation with all operators"""

    @pytest.fixture
    def router(self):
        """Create CDSHooksRouter instance"""
        return CDSHooksRouter()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("operator,patient_age,threshold,expected", [
        # Greater than tests
        ('gt', 65, 60, True),   # 65 > 60 = True
        ('gt', 60, 65, False),  # 60 > 65 = False
        ('gt', 65, 65, False),  # 65 > 65 = False

        # Greater than or equal tests
        ('ge', 65, 60, True),   # 65 >= 60 = True
        ('ge', 65, 65, True),   # 65 >= 65 = True
        ('ge', 60, 65, False),  # 60 >= 65 = False

        # Less than tests
        ('lt', 55, 60, True),   # 55 < 60 = True
        ('lt', 65, 60, False),  # 65 < 60 = False
        ('lt', 60, 60, False),  # 60 < 60 = False

        # Less than or equal tests
        ('le', 55, 60, True),   # 55 <= 60 = True
        ('le', 60, 60, True),   # 60 <= 60 = True
        ('le', 65, 60, False),  # 65 <= 60 = False

        # Equals tests (within 1 year tolerance)
        ('eq', 65, 65, True),   # Exact match
        ('eq', 65, 65.5, True), # Within 1 year
        ('eq', 65, 67, False),  # More than 1 year difference
    ])
    async def test_age_operators(self, router, operator, patient_age, threshold, expected):
        """Test all age operators with various values"""

        # Mock patient with specific birth date
        birth_date = datetime.now() - timedelta(days=int(patient_age * 365.25))
        mock_patient = Mock()
        mock_patient.birthDate = birth_date.strftime('%Y-%m-%d')

        with patch('api.cds_hooks.cds_hooks_router.get_resource', return_value=mock_patient):
            result = await router._check_patient_age(
                patient_id='test-patient',
                parameters={'operator': operator, 'value': threshold}
            )
            assert result == expected, \
                f"Age check failed: {patient_age} {operator} {threshold} should be {expected}"

    @pytest.mark.asyncio
    async def test_age_missing_patient(self, router):
        """Test age condition with missing patient"""
        with patch('api.cds_hooks.cds_hooks_router.get_resource', return_value=None):
            result = await router._check_patient_age(
                patient_id='missing-patient',
                parameters={'operator': 'gt', 'value': 65}
            )
            assert result is False

    @pytest.mark.asyncio
    async def test_age_invalid_birth_date(self, router):
        """Test age condition with invalid birth date"""
        mock_patient = Mock()
        mock_patient.birthDate = 'invalid-date'

        with patch('api.cds_hooks.cds_hooks_router.get_resource', return_value=mock_patient):
            result = await router._check_patient_age(
                patient_id='test-patient',
                parameters={'operator': 'gt', 'value': 65}
            )
            assert result is False


class TestGenderConditions:
    """Test gender condition evaluation"""

    @pytest.fixture
    def router(self):
        return CDSHooksRouter()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("patient_gender,target_gender,expected", [
        ('male', 'male', True),
        ('female', 'female', True),
        ('male', 'female', False),
        ('MALE', 'male', True),  # Case insensitive
        ('Male', 'MALE', True),  # Case insensitive
    ])
    async def test_gender_matching(self, router, patient_gender, target_gender, expected):
        """Test gender condition matching"""
        mock_patient = Mock()
        mock_patient.gender = patient_gender

        with patch('api.cds_hooks.cds_hooks_router.get_resource', return_value=mock_patient):
            result = await router._check_patient_gender(
                patient_id='test-patient',
                parameters={'value': target_gender}
            )
            assert result == expected


class TestDiagnosisCodeConditions:
    """Test diagnosis code (condition) evaluation"""

    @pytest.fixture
    def router(self):
        return CDSHooksRouter()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("operator,has_condition,expected", [
        ('in', True, True),      # Has condition, operator 'in' = True
        ('in', False, False),    # No condition, operator 'in' = False
        ('equals', True, True),  # Has condition, operator 'equals' = True
        ('equals', False, False),# No condition, operator 'equals' = False
        ('not-in', True, False), # Has condition, operator 'not-in' = False
        ('not-in', False, True), # No condition, operator 'not-in' = True
    ])
    async def test_diagnosis_operators(self, router, operator, has_condition, expected):
        """Test diagnosis code operators"""

        # Create mock condition if needed
        if has_condition:
            mock_condition = Mock()
            mock_condition.code = Mock()
            mock_condition.code.coding = [Mock(code='73211009')]  # Diabetes code
            conditions = [mock_condition]
        else:
            conditions = []

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=conditions):
            result = await router._check_diagnosis_code(
                patient_id='test-patient',
                parameters={'codes': ['73211009'], 'operator': operator}
            )
            assert result == expected

    @pytest.mark.asyncio
    async def test_diagnosis_multiple_codes(self, router):
        """Test diagnosis with multiple codes (any match)"""
        mock_condition = Mock()
        mock_condition.code = Mock()
        mock_condition.code.coding = [Mock(code='73211009')]

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[mock_condition]):
            result = await router._check_diagnosis_code(
                patient_id='test-patient',
                parameters={'codes': ['38341003', '73211009', '44054006'], 'operator': 'in'}
            )
            assert result is True  # Should match second code


class TestMedicationConditions:
    """Test medication condition evaluation with all parameter formats"""

    @pytest.fixture
    def router(self):
        return CDSHooksRouter()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("param_format,param_value", [
        ('codes', ['312961']),           # Legacy format
        ('medication', '312961'),        # Catalog format - single string
        ('medications', ['312961']),     # Catalog format - array
        ('drugClass', '312961'),         # Catalog format - drug class
        ('medication', '312961,197361'), # Comma-separated string
    ])
    async def test_medication_parameter_formats(self, router, param_format, param_value):
        """Test all medication parameter formats"""

        # Mock medication with Simvastatin code
        mock_med = Mock()
        mock_med.medicationCodeableConcept = Mock()
        mock_med.medicationCodeableConcept.coding = [Mock(code='312961')]

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[mock_med]):
            result = await router._check_active_medication(
                patient_id='test-patient',
                parameters={param_format: param_value, 'operator': 'in'}
            )
            assert result is True

    @pytest.mark.asyncio
    @pytest.mark.parametrize("operator,has_medication,expected", [
        ('in', True, True),       # Has medication, check if in list
        ('equals', True, True),   # Same as 'in'
        ('not-in', False, True),  # No medication, check if not in list
        ('contains', True, True), # Has medication, check if contains
        ('any', True, True),      # Has any active medication
        ('any', False, False),    # No active medications
    ])
    async def test_medication_operators(self, router, operator, has_medication, expected):
        """Test all medication operators"""

        if has_medication:
            mock_med = Mock()
            mock_med.medicationCodeableConcept = Mock()
            mock_med.medicationCodeableConcept.coding = [Mock(code='312961')]
            medications = [mock_med]
        else:
            medications = []

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=medications):
            # For 'any' operator, use special value
            codes = ['any'] if operator == 'any' else ['312961']
            result = await router._check_active_medication(
                patient_id='test-patient',
                parameters={'medication': codes[0] if len(codes) == 1 else codes, 'operator': operator}
            )
            assert result == expected


class TestLabValueConditions:
    """Test lab value condition evaluation"""

    @pytest.fixture
    def router(self):
        return CDSHooksRouter()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("operator,lab_value,threshold,expected", [
        ('gt', 150, 140, True),   # 150 > 140 = True
        ('gt', 130, 140, False),  # 130 > 140 = False
        ('ge', 140, 140, True),   # 140 >= 140 = True
        ('ge', 130, 140, False),  # 130 >= 140 = False
        ('lt', 130, 140, True),   # 130 < 140 = True
        ('lt', 150, 140, False),  # 150 < 140 = False
        ('le', 140, 140, True),   # 140 <= 140 = True
        ('le', 150, 140, False),  # 150 <= 140 = False
        ('eq', 140, 140, True),   # 140 == 140 = True (within 0.01)
        ('eq', 140, 140.005, True),  # Close enough
        ('eq', 140, 145, False),  # Too different
    ])
    async def test_lab_value_operators(self, router, operator, lab_value, threshold, expected):
        """Test all lab value operators"""

        # Mock observation with specific value
        mock_obs = Mock()
        mock_obs.valueQuantity = Mock()
        mock_obs.valueQuantity.value = lab_value

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[mock_obs]):
            result = await router._check_lab_value(
                patient_id='test-patient',
                parameters={'code': '2339-0', 'operator': operator, 'value': threshold}
            )
            assert result == expected

    @pytest.mark.asyncio
    async def test_lab_value_legacy_parameter(self, router):
        """Test lab value with legacy 'labTest' parameter"""
        mock_obs = Mock()
        mock_obs.valueQuantity = Mock()
        mock_obs.valueQuantity.value = 150

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[mock_obs]):
            # Use 'labTest' instead of 'code'
            result = await router._check_lab_value(
                patient_id='test-patient',
                parameters={'labTest': '2339-0', 'operator': 'gt', 'value': 140}
            )
            assert result is True

    @pytest.mark.asyncio
    async def test_lab_value_missing_observation(self, router):
        """Test lab value with no observations found"""
        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[]):
            result = await router._check_lab_value(
                patient_id='test-patient',
                parameters={'code': '2339-0', 'operator': 'gt', 'value': 140}
            )
            assert result is False


class TestVitalSignConditions:
    """Test vital sign condition evaluation"""

    @pytest.fixture
    def router(self):
        return CDSHooksRouter()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("operator,vital_value,threshold,expected", [
        ('gt', 140, 120, True),   # Systolic BP 140 > 120
        ('ge', 120, 120, True),   # Systolic BP 120 >= 120
        ('lt', 110, 120, True),   # Systolic BP 110 < 120
        ('le', 120, 120, True),   # Systolic BP 120 <= 120
    ])
    async def test_vital_sign_operators(self, router, operator, vital_value, threshold, expected):
        """Test all vital sign operators"""

        # Mock observation with vital sign value
        mock_obs = Mock()
        mock_obs.valueQuantity = Mock()
        mock_obs.valueQuantity.value = vital_value

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[mock_obs]):
            result = await router._check_vital_sign(
                patient_id='test-patient',
                parameters={'type': '8480-6', 'operator': operator, 'value': threshold}
            )
            assert result == expected

    @pytest.mark.asyncio
    async def test_vital_sign_blood_pressure_components(self, router):
        """Test blood pressure with systolic/diastolic components"""

        # Mock blood pressure observation with components
        mock_obs = Mock()
        mock_obs.component = [
            Mock(
                code=Mock(coding=[Mock(code='8480-6')]),  # Systolic
                valueQuantity=Mock(value=140)
            ),
            Mock(
                code=Mock(coding=[Mock(code='8462-4')]),  # Diastolic
                valueQuantity=Mock(value=90)
            )
        ]

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[mock_obs]):
            # Test systolic component
            result_systolic = await router._check_vital_sign(
                patient_id='test-patient',
                parameters={
                    'type': '85354-9',  # Blood pressure code
                    'component': 'systolic',
                    'operator': 'gt',
                    'value': 120
                }
            )
            assert result_systolic is True

            # Test diastolic component
            result_diastolic = await router._check_vital_sign(
                patient_id='test-patient',
                parameters={
                    'type': '85354-9',
                    'component': 'diastolic',
                    'operator': 'gt',
                    'value': 80
                }
            )
            assert result_diastolic is True


class TestEdgeCases:
    """Test edge cases and error handling"""

    @pytest.fixture
    def router(self):
        return CDSHooksRouter()

    @pytest.mark.asyncio
    async def test_empty_parameters(self, router):
        """Test conditions with empty parameters"""

        # Age with no value
        result = await router._check_patient_age('test-patient', {})
        assert result is False

        # Diagnosis with no codes
        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[]):
            result = await router._check_diagnosis_code('test-patient', {'codes': []})
            assert result is False

    @pytest.mark.asyncio
    async def test_malformed_data(self, router):
        """Test handling of malformed FHIR data"""

        # Condition without code
        mock_condition = Mock()
        mock_condition.code = None

        with patch('api.cds_hooks.cds_hooks_router.search_resources', return_value=[mock_condition]):
            result = await router._check_diagnosis_code(
                'test-patient',
                {'codes': ['73211009'], 'operator': 'in'}
            )
            assert result is False

    @pytest.mark.asyncio
    async def test_network_errors(self, router):
        """Test handling of network/API errors"""

        with patch('api.cds_hooks.cds_hooks_router.search_resources', side_effect=Exception("Network error")):
            result = await router._check_active_medication(
                'test-patient',
                {'medication': '312961', 'operator': 'in'}
            )
            assert result is False  # Should gracefully return False on error


# Integration test markers
pytestmark = [
    pytest.mark.unit,
    pytest.mark.cds_hooks,
]
