"""
Tests for CQLBridge — the production translator and HAPI client wrapper.

Coverage:
- request_orchestration_to_cards: every supported response shape
- _action_to_card: title/description/priority handling
- _collect_outcome_issues: warnings extracted from any depth
- validate_cql, apply, derive_data_requirements: HAPI interaction (mocked)
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from api.cds_hooks.cql_bridge import (
    CQLBridge,
    PRIORITY_TO_INDICATOR,
    SUMMARY_MAX_LENGTH,
    ValidationIssue,
    _looks_like_full_library,
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


class TestLooksLikeFullLibrary:

    def test_simple_library_directive(self):
        assert _looks_like_full_library("library MyRule version '0.1.0'\ndefine X: 1")

    def test_library_with_leading_comments(self):
        cql = "// banner comment\n/* multiline */\nlibrary MyRule version '0.1.0'\ndefine X: 1"
        assert _looks_like_full_library(cql) is True

    def test_library_with_leading_whitespace(self):
        assert _looks_like_full_library("\n\n  library MyRule version '0.1.0'") is True

    def test_pure_expression_not_a_library(self):
        assert _looks_like_full_library("exists [Patient]") is False
        assert _looks_like_full_library("Patient.gender") is False

    def test_define_only_not_a_library(self):
        # No `library X version 'V'` directive — must be an expression for $cql
        assert _looks_like_full_library("define X: 1") is False

    def test_empty_or_none(self):
        assert _looks_like_full_library("") is False
        assert _looks_like_full_library(None) is False


class TestValidateCQLAutoRouting:
    """validate_cql should detect library vs expression and route accordingly."""

    @pytest.mark.asyncio
    async def test_full_library_routes_through_data_requirements(self):
        """Library form should NOT hit /$cql — it should upload + call $data-requirements."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        cql = "library MyRule version '0.1.0'\nusing FHIR version '4.0.1'\ncontext Patient\ndefine Applicability: true"

        with patch("api.cds_hooks.cql_dev_helper.upload_dev_library", new=AsyncMock()) as mock_upload:
            mock_upload.return_value = ("ValidateProbeABC", "http://x/Library/ValidateProbeABC")
            with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked_post:
                # $data-requirements returns a Library wrapper with no errors
                mocked_post.return_value = {"resourceType": "Library", "dataRequirement": []}
                result = await bridge.validate_cql(cql)

        assert result.ok is True
        # Assert we hit $data-requirements, NOT /$cql
        called_path = mocked_post.call_args[0][0]
        assert called_path == "/Library/ValidateProbeABC/$data-requirements"
        # Upload was called with the full library text
        assert mock_upload.call_args.kwargs["base_name"] == "ValidateProbe"

    @pytest.mark.asyncio
    async def test_compile_error_in_library_surfaces(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        cql = "library Bad version '0.1.0'\nusing FHIR version '4.0.1'\ncontext Patient\ndefine X: NoSuchIdentifier"

        with patch("api.cds_hooks.cql_dev_helper.upload_dev_library", new=AsyncMock()) as mock_upload:
            mock_upload.return_value = ("ValidateProbeXYZ", "http://x/Library/ValidateProbeXYZ")
            with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked_post:
                mocked_post.return_value = {
                    "resourceType": "Library",
                    "contained": [{
                        "resourceType": "OperationOutcome",
                        "issue": [{
                            "severity": "error",
                            "diagnostics": "Could not resolve identifier NoSuchIdentifier",
                        }],
                    }],
                }
                result = await bridge.validate_cql(cql)

        assert result.ok is False
        assert any("NoSuchIdentifier" in (i.diagnostics or "") for i in result.issues)

    @pytest.mark.asyncio
    async def test_expression_input_still_uses_inline_cql_path(self):
        """A bare expression must NOT trigger an upload."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")

        with patch("api.cds_hooks.cql_dev_helper.upload_dev_library", new=AsyncMock()) as mock_upload:
            with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked_post:
                mocked_post.return_value = {"resourceType": "Parameters", "parameter": []}
                await bridge.validate_cql("exists [Patient]")

        # No upload happened — pure expression goes straight to /$cql
        mock_upload.assert_not_called()
        called_path = mocked_post.call_args[0][0]
        assert called_path == "/$cql"

    @pytest.mark.asyncio
    async def test_upload_failure_returns_validation_failure(self):
        """If the dev-helper upload itself fails, surface that as a validation error."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        cql = "library Broken version '0.1.0'\ngarbage that won't parse"

        bad_response = MagicMock(spec=httpx.Response)
        bad_response.status_code = 400
        bad_response.text = "{}"
        bad_response.json.return_value = {
            "resourceType": "OperationOutcome",
            "issue": [{"severity": "error", "diagnostics": "Syntax error at line 2"}],
        }

        with patch("api.cds_hooks.cql_dev_helper.upload_dev_library", new=AsyncMock()) as mock_upload:
            mock_upload.side_effect = httpx.HTTPStatusError(
                "400", request=MagicMock(), response=bad_response,
            )
            result = await bridge.validate_cql(cql)

        assert result.ok is False
        assert any("Syntax error" in (i.diagnostics or "") for i in result.issues)


# ---------------------------------------------------------------------------
# FHIRHelpers hint detection (#122)
# ---------------------------------------------------------------------------


class TestFHIRHelpersHint:
    """validate_cql should surface a friendly tip when the underlying CQL
    compiler error fingerprints to a missing-FHIRHelpers situation."""

    HINT_FRAGMENT = "include FHIRHelpers version '4.0.001'"

    @pytest.mark.asyncio
    async def test_expression_path_emits_hint_for_fhir_type_signature_error(self):
        """`ToString(Patient.id)` without FHIRHelpers triggers a 'signature (FHIR.id)' error.

        The bridge should append an info-severity hint pointing the student
        at the FHIRHelpers include line.
        """
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "diagnostics": (
                        "Could not resolve call to operator ToString "
                        "with signature (FHIR.id)"
                    ),
                }],
            }
            result = await bridge.validate_cql("ToString(Patient.id)")

        assert result.ok is False
        hints = [i for i in result.issues if i.severity == "information"]
        assert len(hints) == 1
        assert self.HINT_FRAGMENT in (hints[0].diagnostics or "")
        # The original error must remain — the hint is additive, not a replacement.
        assert any(i.severity == "error" for i in result.issues)

    @pytest.mark.asyncio
    async def test_library_path_emits_hint_for_unresolved_fhirhelpers(self):
        """`include FHIRHelpers version 'X.Y.Z'` where X.Y.Z isn't in HAPI
        produces `Could not resolve library name FHIRHelpers`. Same hint applies."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        cql = (
            "library Bad version '0.1.0'\n"
            "using FHIR version '4.0.1'\n"
            "include FHIRHelpers version '9.9.999'\n"
            "context Patient\n"
            "define X: ToString(Patient.id)"
        )

        with patch("api.cds_hooks.cql_dev_helper.upload_dev_library", new=AsyncMock()) as mock_upload:
            mock_upload.return_value = ("ValidateProbeFH", "http://x/Library/ValidateProbeFH")
            with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked_post:
                mocked_post.return_value = {
                    "resourceType": "Library",
                    "contained": [{
                        "resourceType": "OperationOutcome",
                        "issue": [{
                            "severity": "error",
                            "diagnostics": "Could not resolve library name FHIRHelpers",
                        }],
                    }],
                }
                result = await bridge.validate_cql(cql)

        assert result.ok is False
        hints = [i for i in result.issues if i.severity == "information"]
        assert len(hints) == 1
        assert self.HINT_FRAGMENT in (hints[0].diagnostics or "")

    @pytest.mark.asyncio
    async def test_no_hint_when_unrelated_error(self):
        """An error that doesn't match either fingerprint should NOT trigger the hint —
        we don't want to spam students with FHIRHelpers advice for, say, a typo."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "diagnostics": "Could not resolve identifier NoSuchIdentifier",
                }],
            }
            result = await bridge.validate_cql("NoSuchIdentifier")

        assert result.ok is False
        assert not any(i.severity == "information" for i in result.issues)

    @pytest.mark.asyncio
    async def test_hint_is_deduplicated(self):
        """Multiple matching errors must produce only ONE hint — repeated tips are noise."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = {
                "resourceType": "OperationOutcome",
                "issue": [
                    {
                        "severity": "error",
                        "diagnostics": (
                            "Could not resolve call to operator ToString "
                            "with signature (FHIR.id)"
                        ),
                    },
                    {
                        "severity": "error",
                        "diagnostics": (
                            "Could not resolve call to operator ToString "
                            "with signature (FHIR.code)"
                        ),
                    },
                ],
            }
            result = await bridge.validate_cql("ToString(Patient.id) | ToString(Observation.code)")

        hints = [i for i in result.issues if i.severity == "information"]
        assert len(hints) == 1

    @pytest.mark.asyncio
    async def test_hint_appended_on_http_error_path_when_outcome_matches(self):
        """A 4xx with an OperationOutcome containing the fingerprint should still
        get the hint — the issue body originated from HAPI, not from the bridge."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        bad_response = MagicMock(spec=httpx.Response)
        bad_response.status_code = 400
        bad_response.json.return_value = {
            "resourceType": "OperationOutcome",
            "issue": [{
                "severity": "error",
                "diagnostics": (
                    "Could not resolve call to operator ToDecimal "
                    "with signature (FHIR.decimal)"
                ),
            }],
        }
        bad_response.text = "..."

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.side_effect = httpx.HTTPStatusError(
                "400", request=MagicMock(), response=bad_response,
            )
            result = await bridge.validate_cql("ToDecimal(Observation.value)")

        assert result.ok is False
        hints = [i for i in result.issues if i.severity == "information"]
        assert len(hints) == 1
        assert self.HINT_FRAGMENT in (hints[0].diagnostics or "")


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
# execute_for_hook + draftOrders → $apply data parameter (issue #127)
#
# CDS Hooks 2.0 carries the in-progress order(s) being composed in
# context.draftOrders. The bridge surfaces this to CQL via the $apply `data`
# parameter — cqf-fhir-cr-hapi merges those entries into the CQL Data
# Provider's view, so a `[Immunization]` retrieve sees both persisted
# resources and the draft. Verified end-to-end by spike #126.
# ---------------------------------------------------------------------------


def _make_request_with_context(hook_type, ctx):
    import uuid
    return CDSHookRequest(
        hook=hook_type,
        hookInstance=str(uuid.uuid4()),
        context=ctx,
    )


def _make_immunization_bundle(*coding_codes):
    """Build a draftOrders Bundle with one Immunization per CVX code."""
    return {
        "resourceType": "Bundle",
        "id": "cds-draft-test",
        "type": "collection",
        "entry": [
            {"resource": {
                "resourceType": "Immunization",
                "id": f"draft-{i + 1}",
                "status": "completed",
                "vaccineCode": {
                    "coding": [{
                        "system": "http://hl7.org/fhir/sid/cvx",
                        "code": code,
                    }],
                },
                "patient": {"reference": "Patient/p1"},
            }}
            for i, code in enumerate(coding_codes)
        ],
    }


class TestExecuteForHookDraftOrders:
    """draftOrders flows through to $apply as the `data` parameter."""

    @pytest.mark.asyncio
    async def test_draft_orders_forwarded_as_data_parameter(self):
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        bundle = _make_immunization_bundle("03")
        request = _make_request_with_context(
            HookType.ORDER_SELECT,
            {
                "patientId": "p1",
                "userId": "Practitioner/demo",
                "selections": ["Bundle/cds-draft-test#Immunization/draft-1"],
                "draftOrders": bundle,
            },
        )
        cp = make_careplan([{"title": "x"}])

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            await bridge.execute_for_hook("pd1", request)

        _, body = mocked.call_args[0]
        params_by_name = {p["name"]: p for p in body["parameter"]}
        assert "data" in params_by_name, "draftOrders should be forwarded as `data` parameter"
        # Pass-through: the bundle reaches $apply byte-equal to context.draftOrders.
        assert params_by_name["data"]["resource"] == bundle

    @pytest.mark.asyncio
    async def test_no_draft_orders_skips_data_parameter(self):
        """patient-view and other hooks without draftOrders should not send `data`."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        request = _make_request_with_context(
            HookType.PATIENT_VIEW,
            {"patientId": "p1", "userId": "Practitioner/demo"},
        )
        cp = make_careplan([{"title": "x"}])

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            await bridge.execute_for_hook("pd1", request)

        _, body = mocked.call_args[0]
        param_names = [p["name"] for p in body["parameter"]]
        assert "data" not in param_names

    @pytest.mark.asyncio
    async def test_empty_draft_orders_bundle_skips_data_parameter(self):
        """Bundle with entry=[] — legal FHIR but no value sending it on."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        request = _make_request_with_context(
            HookType.ORDER_SELECT,
            {
                "patientId": "p1",
                "draftOrders": {
                    "resourceType": "Bundle",
                    "type": "collection",
                    "entry": [],
                },
            },
        )
        cp = make_careplan([{"title": "x"}])

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            await bridge.execute_for_hook("pd1", request)

        _, body = mocked.call_args[0]
        param_names = [p["name"] for p in body["parameter"]]
        assert "data" not in param_names

    @pytest.mark.asyncio
    async def test_malformed_draft_orders_skipped_gracefully(self):
        """Bridge tolerates non-Bundle / null / wrong-shape draftOrders."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        cp = make_careplan([{"title": "x"}])

        for bad in [
            None,
            "not a bundle",
            42,
            {"resourceType": "Patient", "id": "p1"},   # wrong resourceType
            {"resourceType": "Bundle"},                  # missing entry
        ]:
            request = _make_request_with_context(
                HookType.ORDER_SELECT,
                {"patientId": "p1", "draftOrders": bad},
            )
            with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
                mocked.return_value = cp
                await bridge.execute_for_hook("pd1", request)
            _, body = mocked.call_args[0]
            param_names = [p["name"] for p in body["parameter"]]
            assert "data" not in param_names, f"data param leaked for malformed bundle: {bad!r}"

    @pytest.mark.asyncio
    async def test_draft_orders_passed_through_unchanged(self):
        """Bridge should not mutate or filter the bundle — it goes to $apply as-is."""
        bridge = CQLBridge(hapi_base_url="http://hapi.test/fhir")
        bundle = _make_immunization_bundle("03", "21", "37")
        original_snapshot = json.dumps(bundle, sort_keys=True)
        request = _make_request_with_context(
            HookType.ORDER_SELECT,
            {"patientId": "p1", "draftOrders": bundle},
        )
        cp = make_careplan([{"title": "x"}])

        with patch.object(bridge, "_post_operation", new=AsyncMock()) as mocked:
            mocked.return_value = cp
            await bridge.execute_for_hook("pd1", request)

        # Bundle is byte-equal both in the call AND in the original (no mutation).
        _, body = mocked.call_args[0]
        forwarded = next(p for p in body["parameter"] if p["name"] == "data")["resource"]
        assert forwarded == bundle
        assert json.dumps(bundle, sort_keys=True) == original_snapshot


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
