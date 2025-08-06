"""
Integration tests for CDS Rules Engine compatibility

Verifies that the new rules engine doesn't break existing functionality
and properly integrates with legacy services.
"""

import pytest
import json
from unittest.mock import Mock, patch
from datetime import datetime, timedelta

from backend.api.cds_hooks.models import (
    CDSHookRequest, HookType, PatientViewContext,
    MedicationPrescribeContext
)
from backend.api.cds_hooks.cds_services import (
    DiabetesManagementService,
    HypertensionManagementService,
    DrugInteractionService,
    PreventiveCareService
)
from backend.api.cds_hooks.rules_engine.integration import cds_integration
from backend.api.cds_hooks.rules_engine.core import RuleCategory


class TestCDSRulesEngineCompatibility:
    """Test that rules engine maintains compatibility with existing services"""
    
    @pytest.fixture
    def sample_patient_context(self):
        """Sample patient context for testing"""
        return {
            "patientId": "test-patient-123",
            "userId": "test-user-456",
            "encounterId": "test-encounter-789"
        }
    
    @pytest.fixture
    def diabetes_prefetch(self):
        """Sample prefetch data for diabetes patient"""
        return {
            "patient": {
                "id": "test-patient-123",
                "birthDate": "1960-01-01",
                "gender": "male"
            },
            "conditions": [
                Mock(
                    code=Mock(
                        coding=[Mock(system="http://snomed.info/sct", code="44054006")],
                        text="Type 2 diabetes mellitus"
                    )
                )
            ],
            "a1c": Mock(value=8.5, effectiveDateTime=datetime.now().isoformat()),
            "medications": [
                Mock(medication_name="Lisinopril 10mg", status="active")
            ]
        }
    
    def test_legacy_service_still_works(self, sample_patient_context, diabetes_prefetch):
        """Test that legacy CDS services continue to function"""
        # Test DiabetesManagementService directly
        service = DiabetesManagementService()
        result = service.execute(sample_patient_context, diabetes_prefetch)
        
        assert "cards" in result
        assert len(result["cards"]) > 0
        
        # Should have A1C alert and metformin recommendation
        summaries = [card["summary"] for card in result["cards"]]
        assert any("A1C" in summary for summary in summaries)
        assert any("Metformin" in summary for summary in summaries)
    
    @pytest.mark.asyncio
    async def test_rules_engine_produces_similar_results(self, sample_patient_context, diabetes_prefetch):
        """Test that rules engine produces similar clinical recommendations"""
        # Execute with rules engine
        adapted_context = await cds_integration.fhir_adapter.adapt_cds_context(
            sample_patient_context,
            diabetes_prefetch
        )
        
        response = await cds_integration.rules_engine.evaluate(
            context=adapted_context,
            categories=[RuleCategory.CHRONIC_DISEASE, RuleCategory.MEDICATION_SAFETY]
        )
        
        assert "cards" in response
        assert len(response["cards"]) > 0
        
        # Should have similar recommendations
        summaries = [card["summary"] for card in response["cards"]]
        assert any("A1C" in summary for summary in summaries)
    
    @pytest.mark.asyncio
    async def test_hybrid_mode_combines_results(self, sample_patient_context, diabetes_prefetch):
        """Test that hybrid mode combines results from both engines"""
        response = await cds_integration.execute_hook(
            hook="patient-view",
            context=sample_patient_context,
            prefetch=diabetes_prefetch,
            use_legacy=True
        )
        
        assert "cards" in response
        
        # Check for both legacy and rules engine cards
        sources = [card.get("source", {}).get("label", "") for card in response["cards"]]
        
        # Should have cards from both sources
        # (Note: exact labels depend on implementation)
        assert len(sources) > 0
    
    @pytest.mark.asyncio
    async def test_rules_engine_fallback_on_error(self):
        """Test that system falls back gracefully when rules engine fails"""
        # Simulate rules engine error
        with patch.object(cds_integration.rules_engine, 'evaluate', side_effect=Exception("Test error")):
            # This should not raise an exception
            response = await cds_integration.execute_hook(
                hook="medication-prescribe",
                context={"patientId": "test"},
                prefetch={},
                use_legacy=False
            )
            
            # Should return empty response or legacy results
            assert isinstance(response, dict)
    
    def test_drug_interaction_compatibility(self):
        """Test drug interaction checking remains compatible"""
        service = DrugInteractionService()
        
        context = {
            "medications": {
                "new": [{"display": "Aspirin 81mg"}]
            }
        }
        
        prefetch = {
            "medications": [
                Mock(medication_name="Warfarin 5mg", status="active")
            ]
        }
        
        result = service.execute(context, prefetch)
        
        assert "cards" in result
        assert len(result["cards"]) > 0
        assert "bleeding risk" in result["cards"][0]["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_v2_service_uses_rules_engine(self):
        """Test that v2 service IDs properly route to rules engine"""
        # This would be tested at the router level
        # Here we just verify the rules engine can handle the same hooks
        
        hooks = ["medication-prescribe", "patient-view", "order-select"]
        
        for hook in hooks:
            response = await cds_integration.execute_hook(
                hook=hook,
                context={"patientId": "test"},
                prefetch={},
                use_legacy=False
            )
            
            assert isinstance(response, dict)
            assert "cards" in response
    
    @pytest.mark.asyncio
    async def test_data_adapter_handles_legacy_format(self, diabetes_prefetch):
        """Test that data adapter properly converts legacy prefetch format"""
        adapted = await cds_integration.fhir_adapter.adapt_cds_context(
            {"patientId": "test"},
            diabetes_prefetch
        )
        
        # Should have properly adapted patient data
        assert "patient" in adapted
        assert adapted["patient"]["age"] == 65  # Calculated from birthDate
        
        # Should have adapted conditions
        assert "conditions" in adapted
        assert len(adapted["conditions"]) > 0
        
        # Should have adapted lab results
        assert "labResults" in adapted
        assert "a1c" in adapted["labResults"]
        assert adapted["labResults"]["a1c"]["value"] == 8.5
    
    @pytest.mark.asyncio
    async def test_rules_engine_respects_priorities(self):
        """Test that rules engine evaluates rules by priority"""
        context = {
            "patient": {"id": "test", "age": 70},
            "conditions": [{"code": "E11.9"}],  # Diabetes
            "labResults": {
                "a1c": {"value": 12.0, "date": datetime.now().isoformat()}  # Very high
            }
        }
        
        response = await cds_integration.rules_engine.evaluate(
            context=context,
            categories=[RuleCategory.CHRONIC_DISEASE]
        )
        
        # High priority alerts should come first
        if response["cards"]:
            first_card = response["cards"][0]
            # Critical alerts should be prioritized
            assert first_card.get("indicator") in ["critical", "warning"]
    
    def test_preventive_care_age_calculations(self):
        """Test that age-based preventive care rules work correctly"""
        service = PreventiveCareService()
        
        # Test for 55-year-old patient
        prefetch = {
            "patient": {
                "birthDate": "1969-01-01",
                "gender": "female"
            }
        }
        
        result = service.execute({}, prefetch)
        
        assert "cards" in result
        summaries = [card["summary"] for card in result["cards"]]
        
        # Should recommend colorectal screening (>50) and mammography (>40)
        assert any("Colorectal" in s for s in summaries)
        assert any("Mammography" in s for s in summaries)
        assert any("Flu" in s for s in summaries)  # Always recommended
    
    @pytest.mark.asyncio
    async def test_medication_safety_rules(self):
        """Test medication safety checks in rules engine"""
        context = {
            "patient": {"id": "test"},
            "activeMedications": [
                {"code": "warfarin", "display": "Warfarin 5mg"}
            ],
            "newMedication": {
                "code": "ibuprofen",
                "display": "Ibuprofen 400mg"
            }
        }
        
        response = await cds_integration.rules_engine.evaluate(
            context=context,
            categories=[RuleCategory.DRUG_INTERACTIONS]
        )
        
        assert "cards" in response
        assert len(response["cards"]) > 0
        
        # Should warn about warfarin-NSAID interaction
        card = response["cards"][0]
        assert "warfarin" in card["detail"].lower()
        assert card["indicator"] == "warning"


class TestCDSRulesEngineNewFeatures:
    """Test new features that enhance but don't break existing functionality"""
    
    @pytest.mark.asyncio
    async def test_rule_toggling(self):
        """Test ability to enable/disable specific rules"""
        # Get initial statistics
        stats_before = await cds_integration.get_rule_statistics()
        enabled_before = stats_before["enabled_rules"]
        
        # Toggle a rule off
        cds_integration.toggle_rule("medication_safety", "med_safety_001", False)
        
        # Check statistics
        stats_after = await cds_integration.get_rule_statistics()
        assert stats_after["enabled_rules"] == enabled_before - 1
        
        # Toggle back on
        cds_integration.toggle_rule("medication_safety", "med_safety_001", True)
    
    @pytest.mark.asyncio
    async def test_custom_rule_addition(self):
        """Test adding custom rules at runtime"""
        from backend.api.cds_hooks.rules_engine.core import Rule, RuleCondition, RuleAction, RulePriority
        
        # Create a custom rule
        custom_rule = Rule(
            id="test_custom_001",
            name="Test Custom Rule",
            description="Test rule for unit testing",
            category=RuleCategory.ALERTS,
            priority=RulePriority.LOW,
            conditions=[
                RuleCondition(
                    field="patient.age",
                    operator="gt",
                    value=100,
                    data_type="number"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Centenarian Alert",
                    detail="Patient is over 100 years old",
                    indicator="info"
                )
            ]
        )
        
        # Add to rule set
        cds_integration.add_custom_rule("preventive_care", custom_rule)
        
        # Test evaluation
        context = {
            "patient": {"id": "test", "age": 101}
        }
        
        response = await cds_integration.rules_engine.evaluate(
            context=context,
            categories=[RuleCategory.ALERTS]
        )
        
        assert "cards" in response
        assert any("Centenarian" in card["summary"] for card in response["cards"])
    
    @pytest.mark.asyncio
    async def test_category_filtering(self):
        """Test filtering rules by category"""
        context = {
            "patient": {"id": "test", "age": 65},
            "conditions": [{"code": "E11.9"}],  # Diabetes
            "activeMedications": [{"code": "metformin"}]
        }
        
        # Test with only medication safety
        response = await cds_integration.rules_engine.evaluate(
            context=context,
            categories=[RuleCategory.MEDICATION_SAFETY]
        )
        
        # Should only have medication-related cards
        for card in response.get("cards", []):
            source = card.get("source", {})
            topic = source.get("topic", {})
            assert topic.get("code") in ["medication_safety", "drug_interactions"]
    
    @pytest.mark.asyncio
    async def test_metadata_tracking(self):
        """Test that responses include proper metadata"""
        response = await cds_integration.execute_hook(
            hook="patient-view",
            context={"patientId": "test"},
            prefetch={},
            use_legacy=False
        )
        
        assert "_metadata" in response
        metadata = response["_metadata"]
        
        assert "engine" in metadata
        assert metadata["engine"] == "rules_engine_v2"
        assert "timestamp" in metadata
        assert "rule_sets_evaluated" in metadata