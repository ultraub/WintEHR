"""
Tests for CQLBridge — the production translator and HAPI client wrapper.

Coverage:
- request_orchestration_to_cards: every supported response shape
- _action_to_card: title/description/priority handling
- _collect_outcome_issues: warnings extracted from any depth
- validate_cql, apply, derive_data_requirements: HAPI interaction (mocked)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from api.cds_hooks.cql_bridge import (
    CQLBridge,
    PRIORITY_TO_INDICATOR,
    SUMMARY_MAX_LENGTH,
    ValidationIssue,
)
from api.cds_hooks.models import (
    CDSHookRequest,
    HookType,
    IndicatorType,
)


# ---------------------------------------------------------------------------
# Translator fixtures — shapes returned by cqf-fhir-cr-hapi $apply
# ---------------------------------------------------------------------------


def make_careplan(action_blocks, contained_outcome_issues=None):
    """Build a CarePlan with a contained RequestGroup and optional OperationOutcome."""
    contained = [{
        "resourceType": "RequestGroup",
        "id": "rg-1",
        "status": "active",
        "intent": "proposal",
        "action": action_blocks,
    }]
    if contained_outcome_issues:
        contained.append({
            "resourceType": "OperationOutcome",
            "id": "apply-outcome",
            "issue": contained_outcome_issues,
        })
    return {
        "resourceType": "CarePlan",
        "id": "cp-1",
        "status": "active",
        "intent": "proposal",
        "subject": {"reference": "Patient/p1"},
        "contained": contained,
    }


# ---------------------------------------------------------------------------
# Translator: request_orchestration_to_cards
# ---------------------------------------------------------------------------


class TestRequestOrchestrationToCards:

    def test_single_action_with_title_and_description(self):
        bridge = CQLBridge()
        cp = make_careplan([{
            "title": "Schedule mammogram screening",
            "description": "Patient is due for screening per USPSTF guidelines.",
            "priority": "routine",
        }])

        cards = bridge.request_orchestration_to_cards(cp, source_label="Mammo Service")

        assert len(cards) == 1
        card = cards[0]
        assert card.summary == "Schedule mammogram screening"
        assert card.detail == "Patient is due for screening per USPSTF guidelines."
        assert card.indicator == IndicatorType.INFO
        assert card.source.label == "Mammo Service"
        assert card.suggestions is None

    def test_multiple_actions_each_become_a_card(self):
        bridge = CQLBridge()
        cp = make_careplan([
            {"title": "First", "priority": "routine"},
            {"title": "Second", "priority": "urgent"},
            {"title": "Third", "priority": "stat"},
        ])

        cards = bridge.request_orchestration_to_cards(cp)

        assert [c.summary for c in cards] == ["First", "Second", "Third"]
        assert cards[0].indicator == IndicatorType.INFO
        assert cards[1].indicator == IndicatorType.WARNING
        assert cards[2].indicator == IndicatorType.CRITICAL

    def test_action_with_no_title_or_description_skipped(self):
        bridge = CQLBridge()
        cp = make_careplan([
            {"priority": "routine"},  # empty action — structural only
            {"title": "Real card"},
        ])

        cards = bridge.request_orchestration_to_cards(cp)

        assert len(cards) == 1
        assert cards[0].summary == "Real card"

    def test_summary_truncated_at_140_chars(self):
        bridge = CQLBridge()
        long_title = "x" * 200
        cp = make_careplan([{"title": long_title}])

        cards = bridge.request_orchestration_to_cards(cp)

        assert len(cards[0].summary) == SUMMARY_MAX_LENGTH
        assert cards[0].summary.endswith("…")

    def test_description_only_used_as_summary_fallback(self):
        bridge = CQLBridge()
        cp = make_careplan([{"description": "Body without title"}])

        cards = bridge.request_orchestration_to_cards(cp)

        assert cards[0].summary == "Body without title"
        # When summary == detail, detail should be None to avoid duplication
        assert cards[0].detail is None

    def test_nested_actions_become_suggestions(self):
        bridge = CQLBridge()
        cp = make_careplan([{
            "title": "Order screening labs",
            "action": [
                {
                    "title": "Order HbA1c",
                    "description": "LOINC 4548-4",
                    "resource": {
                        "resourceType": "ServiceRequest",
                        "code": {"coding": [{"system": "http://loinc.org", "code": "4548-4"}]},
                    },
                },
                {"title": "Order fasting glucose"},
            ],
        }])

        cards = bridge.request_orchestration_to_cards(cp)

        assert len(cards) == 1
        card = cards[0]
        assert card.suggestions is not None
        assert len(card.suggestions) == 2
        # First suggestion has an inline resource → produces a create action
        first = card.suggestions[0]
        assert first.label == "Order HbA1c"
        assert first.actions is not None
        assert first.actions[0].resource["resourceType"] == "ServiceRequest"
        # Second suggestion has no resource → no actions
        second = card.suggestions[1]
        assert second.label == "Order fasting glucose"
        assert second.actions is None

    def test_top_level_request_group(self):
        bridge = CQLBridge()
        rg = {
            "resourceType": "RequestGroup",
            "status": "active",
            "intent": "proposal",
            "action": [{"title": "Standalone RG"}],
        }

        cards = bridge.request_orchestration_to_cards(rg)

        assert [c.summary for c in cards] == ["Standalone RG"]

    def test_bundle_wrapping_careplan(self):
        bridge = CQLBridge()
        cp = make_careplan([{"title": "Inside bundle"}])
        bundle = {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": [{"resource": cp}],
        }

        cards = bridge.request_orchestration_to_cards(bundle)

        assert [c.summary for c in cards] == ["Inside bundle"]

    def test_empty_response_yields_no_cards(self):
        bridge = CQLBridge()
        assert bridge.request_orchestration_to_cards({}) == []
        assert bridge.request_orchestration_to_cards({"resourceType": "OperationOutcome"}) == []

    def test_unknown_priority_defaults_to_info(self):
        bridge = CQLBridge()
        cp = make_careplan([{"title": "x", "priority": "weird-value"}])

        cards = bridge.request_orchestration_to_cards(cp)

        assert cards[0].indicator == IndicatorType.INFO

    def test_priority_is_case_insensitive(self):
        bridge = CQLBridge()
        cp = make_careplan([{"title": "x", "priority": "URGENT"}])

        cards = bridge.request_orchestration_to_cards(cp)

        assert cards[0].indicator == IndicatorType.WARNING

    def test_source_url_populates_source(self):
        bridge = CQLBridge()
        cp = make_careplan([{"title": "x"}])

        cards = bridge.request_orchestration_to_cards(
            cp, source_label="My Service", source_url="https://example.org/about",
        )

        assert cards[0].source.label == "My Service"
        assert cards[0].source.url == "https://example.org/about"


# ---------------------------------------------------------------------------
# OperationOutcome aggregation
# ---------------------------------------------------------------------------


class TestCollectOutcomeIssues:

    def test_finds_outcome_in_contained(self):
        bridge = CQLBridge()
        cp = make_careplan(
            [{"title": "x"}],
            contained_outcome_issues=[
                {"severity": "warning", "diagnostics": "Stale terminology"},
                {"severity": "error", "diagnostics": "Missing library"},
            ],
        )

        issues = bridge._collect_outcome_issues(cp)

        severities = [i.severity for i in issues]
        assert "warning" in severities
        assert "error" in severities

    def test_falls_back_to_details_text_when_no_diagnostics(self):
        bridge = CQLBridge()
        outcome = {
            "resourceType": "OperationOutcome",
            "issue": [{
                "severity": "warning",
                "details": {"text": "Coded fallback"},
            }],
        }
        issues = bridge._collect_outcome_issues(outcome)
        assert issues[0].diagnostics == "Coded fallback"

    def test_handles_none_response(self):
        bridge = CQLBridge()
        assert bridge._collect_outcome_issues(None) == []
        assert bridge._collect_outcome_issues("not a dict") == []


# ---------------------------------------------------------------------------
# validate_cql — HAPI $cql
# ---------------------------------------------------------------------------


class TestValidateCQL:

    @pytest.mark.asyncio
    async def test_returns_ok_when_no_error_issues(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {
                "resourceType": "Parameters",
                "parameter": [{"name": "return", "valueBoolean": True}],
            }
            result = await bridge.validate_cql("exists [Patient]")

        assert result.ok is True
        assert result.issues == []

    @pytest.mark.asyncio
    async def test_returns_not_ok_when_outcome_has_error(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {
                "resourceType": "Parameters",
                "parameter": [{
                    "name": "return",
                    "resource": {
                        "resourceType": "OperationOutcome",
                        "issue": [{
                            "severity": "error",
                            "diagnostics": "Could not resolve identifier 'foo'",
                        }],
                    },
                }],
            }
            result = await bridge.validate_cql("foo")

        assert result.ok is False
        assert len(result.issues) == 1
        assert result.issues[0].severity == "error"
        assert "foo" in result.issues[0].diagnostics

    @pytest.mark.asyncio
    async def test_handles_http_error_as_validation_failure(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        bad_response = MagicMock(spec=httpx.Response)
        bad_response.status_code = 400
        bad_response.json.return_value = {
            "resourceType": "OperationOutcome",
            "issue": [{"severity": "error", "diagnostics": "Bad CQL syntax"}],
        }
        bad_response.text = "..."

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.side_effect = httpx.HTTPStatusError(
                "400", request=MagicMock(), response=bad_response,
            )
            result = await bridge.validate_cql("garbage")

        assert result.ok is False
        assert any("Bad CQL syntax" in (i.diagnostics or "") for i in result.issues)

    @pytest.mark.asyncio
    async def test_subject_param_is_passed_when_provided(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {"resourceType": "Parameters", "parameter": []}
            await bridge.validate_cql("Patient.gender", subject_ref="Patient/123")

        # Inspect the body that was sent
        called_path, called_body = mocked.call_args[0]
        assert called_path == "/$cql"
        names = {p["name"] for p in called_body["parameter"]}
        assert names == {"expression", "subject"}


# ---------------------------------------------------------------------------
# apply — happy path & shape end-to-end
# ---------------------------------------------------------------------------


class TestApply:

    @pytest.mark.asyncio
    async def test_returns_cards_and_warnings(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        cp = make_careplan(
            [{"title": "Personalized greeting", "description": "Hi Melvin"}],
            contained_outcome_issues=[
                {"severity": "warning", "diagnostics": "Coded fallback used"},
            ],
        )

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            result = await bridge.apply(
                "patient-greeter-cql",
                subject_ref="Patient/p1",
                source_label="Greeter",
            )

        assert len(result.cards) == 1
        assert result.cards[0].summary == "Personalized greeting"
        assert result.cards[0].source.label == "Greeter"
        assert any("Coded fallback" in (w.diagnostics or "") for w in result.warnings)
        assert result.elapsed_ms >= 0
        # Verify request shape
        called_path, called_body = mocked.call_args[0]
        assert called_path == "/PlanDefinition/patient-greeter-cql/$apply"
        params = {p["name"]: p for p in called_body["parameter"]}
        assert params["subject"]["valueString"] == "Patient/p1"

    @pytest.mark.asyncio
    async def test_passes_encounter_when_provided(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        cp = make_careplan([{"title": "x"}])

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            await bridge.apply(
                "pd1", subject_ref="Patient/p1", encounter_ref="Encounter/e1",
            )

        _, body = mocked.call_args[0]
        params = {p["name"]: p for p in body["parameter"]}
        assert params["encounter"]["valueString"] == "Encounter/e1"

    @pytest.mark.asyncio
    async def test_passes_data_bundle_when_provided(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        cp = make_careplan([{"title": "x"}])
        prefetch_bundle = {"resourceType": "Bundle", "type": "collection", "entry": []}

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            await bridge.apply(
                "pd1", subject_ref="Patient/p1", data_bundle=prefetch_bundle,
            )

        _, body = mocked.call_args[0]
        params = {p["name"]: p for p in body["parameter"]}
        assert params["data"]["resource"] == prefetch_bundle


# ---------------------------------------------------------------------------
# execute_for_hook — wiring around CDSHookRequest
# ---------------------------------------------------------------------------


class TestExecuteForHook:

    @pytest.mark.asyncio
    async def test_extracts_patient_from_context(self):
        import uuid
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        request = CDSHookRequest(
            hook=HookType.PATIENT_VIEW,
            hookInstance=str(uuid.uuid4()),
            context={"patientId": "p1", "userId": "Practitioner/demo"},
        )
        cp = make_careplan([{"title": "x"}])

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            response = await bridge.execute_for_hook("pd1", request)

        assert len(response.cards) == 1
        _, body = mocked.call_args[0]
        params = {p["name"]: p for p in body["parameter"]}
        assert params["subject"]["valueString"] == "Patient/p1"

    @pytest.mark.asyncio
    async def test_normalises_already_qualified_patient_ref(self):
        import uuid
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        request = CDSHookRequest(
            hook=HookType.PATIENT_VIEW,
            hookInstance=str(uuid.uuid4()),
            context={"patientId": "Patient/p1", "userId": "Practitioner/demo"},
        )
        cp = make_careplan([{"title": "x"}])

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            await bridge.execute_for_hook("pd1", request)

        _, body = mocked.call_args[0]
        params = {p["name"]: p for p in body["parameter"]}
        assert params["subject"]["valueString"] == "Patient/p1"  # not "Patient/Patient/p1"

    @pytest.mark.asyncio
    async def test_raises_when_patient_id_missing(self):
        import uuid
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        request = CDSHookRequest(
            hook=HookType.PATIENT_VIEW,
            hookInstance=str(uuid.uuid4()),
            context={"userId": "Practitioner/demo"},
        )

        with pytest.raises(ValueError, match="patientId"):
            await bridge.execute_for_hook("pd1", request)


# ---------------------------------------------------------------------------
# derive_data_requirements
# ---------------------------------------------------------------------------


class TestDeriveDataRequirements:

    @pytest.mark.asyncio
    async def test_returns_top_level_data_requirement_array(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {
                "resourceType": "Library",
                "dataRequirement": [
                    {"type": "Patient"},
                    {"type": "Condition"},
                ],
            }
            reqs = await bridge.derive_data_requirements("LibX")

        assert [r["type"] for r in reqs] == ["Patient", "Condition"]

    @pytest.mark.asyncio
    async def test_walks_contained_when_top_level_missing(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {
                "resourceType": "Library",
                "contained": [{
                    "resourceType": "Library",
                    "dataRequirement": [{"type": "Observation"}],
                }],
            }
            reqs = await bridge.derive_data_requirements("LibX")

        assert reqs == [{"type": "Observation"}]

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_requirements(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {"resourceType": "Library"}
            reqs = await bridge.derive_data_requirements("LibX")

        assert reqs == []
