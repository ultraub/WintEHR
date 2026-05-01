"""
Tests for cql_artifact_builder — generates Library + PlanDefinition from a
stored CQL service config and PUTs them to HAPI.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from api.cds_studio.cql_artifact_builder import (
    APPLICABILITY_DEFINE,
    CARD_DETAIL_DEFINE,
    CARD_SUMMARY_DEFINE,
    HOOK_SERVICE_ID_EXT,
    HOOK_TYPE_EXT,
    INDICATOR_TO_PRIORITY,
    SERVICE_ORIGIN_EXT,
    VISUAL_SERVICE_ID_EXT,
    build_plan_definition,
    detect_cql_defines,
    has_define,
    materialize_cql_service,
)


SAMPLE_CQL = """library MyRule version '0.1.0'

using FHIR version '4.0.1'

context Patient

define Applicability: exists [Patient]
define CardSummary: 'Hello ' + 'world'
"""


class TestDetectDefines:

    def test_finds_all_defines(self):
        defines = detect_cql_defines(SAMPLE_CQL)
        assert "Applicability" in defines
        assert "CardSummary" in defines
        assert len(defines) == 2

    def test_handles_empty_input(self):
        assert detect_cql_defines("") == []
        assert detect_cql_defines(None) == []

    def test_only_top_level_directives(self):
        # define inside a comment shouldn't count if the parser were strict;
        # our regex is line-anchored but tolerant — we don't worry about
        # comments, since comments stripping CQL here would be over-engineering.
        cql = "library X version '1.0'\ndefine Top: 1\n  define Indented: 2"
        defines = detect_cql_defines(cql)
        assert "Top" in defines
        # Indented define is also picked up; this is fine — the regex matches
        # any `define Name:` regardless of indentation.

    def test_has_define_predicate(self):
        assert has_define(SAMPLE_CQL, "Applicability") is True
        assert has_define(SAMPLE_CQL, "Missing") is False


class TestBuildPlanDefinition:

    def test_basic_shape(self):
        pd = build_plan_definition(
            service_id="my-svc",
            name="My Service",
            description="What it does",
            hook_type="patient-view",
            library_canonical_url="http://x/Library/L",
            card_config={"summary": "Hi", "detail": "Body", "indicator": "info"},
            prefetch_config=None,
            detected_defines=["Applicability"],
            visual_service_db_id=7,
        )

        assert pd["resourceType"] == "PlanDefinition"
        assert pd["id"] == "my-svc"
        assert pd["title"] == "My Service"
        assert pd["library"] == ["http://x/Library/L"]
        assert pd["status"] == "active"
        assert pd["experimental"] is True

    def test_action_priority_from_indicator(self):
        for indicator, expected_priority in INDICATOR_TO_PRIORITY.items():
            pd = build_plan_definition(
                service_id="x",
                name="X",
                description=None,
                hook_type="patient-view",
                library_canonical_url="http://x/Library/L",
                card_config={"summary": "x", "indicator": indicator},
                prefetch_config=None,
                detected_defines=["Applicability"],
                visual_service_db_id=None,
            )
            assert pd["action"][0]["priority"] == expected_priority

    def test_condition_references_applicability(self):
        pd = build_plan_definition(
            service_id="x",
            name="X",
            description=None,
            hook_type="patient-view",
            library_canonical_url="http://x/Library/L",
            card_config={"summary": "x", "indicator": "info"},
            prefetch_config=None,
            detected_defines=["Applicability"],
            visual_service_db_id=None,
        )
        cond = pd["action"][0]["condition"][0]
        assert cond["kind"] == "applicability"
        assert cond["expression"]["expression"] == APPLICABILITY_DEFINE
        assert cond["expression"]["language"] == "text/cql-identifier"

    def test_dynamic_value_only_for_detected_defines(self):
        # Only CardSummary detected → only one dynamicValue entry
        pd = build_plan_definition(
            service_id="x",
            name="X",
            description=None,
            hook_type="patient-view",
            library_canonical_url="http://x/Library/L",
            card_config={"summary": "Static summary", "indicator": "info"},
            prefetch_config=None,
            detected_defines=["Applicability", "CardSummary"],
            visual_service_db_id=None,
        )
        dyn = pd["action"][0].get("dynamicValue", [])
        paths = [d["path"] for d in dyn]
        assert paths == ["title"]
        assert dyn[0]["expression"]["expression"] == CARD_SUMMARY_DEFINE

    def test_dynamic_value_includes_both_when_both_defined(self):
        pd = build_plan_definition(
            service_id="x",
            name="X",
            description=None,
            hook_type="patient-view",
            library_canonical_url="http://x/Library/L",
            card_config={"summary": "x", "detail": "y", "indicator": "info"},
            prefetch_config=None,
            detected_defines=["Applicability", "CardSummary", "CardDetail"],
            visual_service_db_id=None,
        )
        dyn = pd["action"][0]["dynamicValue"]
        paths = sorted(d["path"] for d in dyn)
        assert paths == ["description", "title"]

    def test_dynamic_value_omitted_when_no_optional_defines(self):
        pd = build_plan_definition(
            service_id="x",
            name="X",
            description=None,
            hook_type="patient-view",
            library_canonical_url="http://x/Library/L",
            card_config={"summary": "x", "indicator": "info"},
            prefetch_config=None,
            detected_defines=["Applicability"],
            visual_service_db_id=None,
        )
        # action.dynamicValue should NOT be present when no optional defines exist
        assert "dynamicValue" not in pd["action"][0]

    def test_extensions_present(self):
        pd = build_plan_definition(
            service_id="my-svc",
            name="X",
            description=None,
            hook_type="medication-prescribe",
            library_canonical_url="http://x/Library/L",
            card_config={"summary": "x", "indicator": "info"},
            prefetch_config=None,
            detected_defines=["Applicability"],
            visual_service_db_id=42,
        )
        urls = {e["url"]: e for e in pd["extension"]}
        assert urls[HOOK_TYPE_EXT]["valueString"] == "medication-prescribe"
        assert urls[HOOK_SERVICE_ID_EXT]["valueString"] == "my-svc"
        assert urls[SERVICE_ORIGIN_EXT]["valueString"] == "visual-builder"
        assert urls[VISUAL_SERVICE_ID_EXT]["valueString"] == "42"

    def test_visual_service_id_omitted_when_none(self):
        pd = build_plan_definition(
            service_id="x",
            name="X",
            description=None,
            hook_type="patient-view",
            library_canonical_url="http://x/Library/L",
            card_config={"summary": "x", "indicator": "info"},
            prefetch_config=None,
            detected_defines=["Applicability"],
            visual_service_db_id=None,
        )
        urls = {e["url"] for e in pd["extension"]}
        assert VISUAL_SERVICE_ID_EXT not in urls

    def test_prefetch_extension(self):
        prefetch = {
            "patient": "Patient/{{context.patientId}}",
            "conditions": "Condition?patient={{context.patientId}}",
        }
        pd = build_plan_definition(
            service_id="x",
            name="X",
            description=None,
            hook_type="patient-view",
            library_canonical_url="http://x/Library/L",
            card_config={"summary": "x", "indicator": "info"},
            prefetch_config=prefetch,
            detected_defines=["Applicability"],
            visual_service_db_id=None,
        )
        prefetch_ext = next(
            (e for e in pd["extension"] if e["url"].endswith("prefetch-templates")), None
        )
        assert prefetch_ext is not None
        # FHIR-compliant nested grouping: parent → template[] → {key, query}
        templates = [
            {child["url"]: child["valueString"] for child in t.get("extension", [])}
            for t in prefetch_ext["extension"]
            if t.get("url") == "template"
        ]
        keys = [t["key"] for t in templates]
        assert "patient" in keys
        assert "conditions" in keys
        # Spot-check the query is paired with the key
        patient_template = next(t for t in templates if t["key"] == "patient")
        assert patient_template["query"] == "Patient/{{context.patientId}}"


class TestMaterializeCQLService:

    @pytest.mark.asyncio
    async def test_happy_path(self):
        with patch(
            "api.cds_studio.cql_artifact_builder.upload_dev_library",
            new=AsyncMock(return_value=("LibAbc123", "http://x/Library/LibAbc123")),
        ) as mock_upload:
            mock_response = MagicMock(spec=httpx.Response)
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            with patch("httpx.AsyncClient") as ClientCls:
                client_inst = AsyncMock()
                client_inst.put.return_value = mock_response
                ClientCls.return_value.__aenter__.return_value = client_inst

                artifacts = await materialize_cql_service(
                    service_id="diabetes-care",
                    name="Diabetes Care",
                    description="Reminds about A1C",
                    hook_type="patient-view",
                    cql_source=SAMPLE_CQL,
                    card_config={"summary": "Diabetes care reminder", "indicator": "warning"},
                    prefetch_config={"patient": "Patient/{{context.patientId}}"},
                    visual_service_db_id=99,
                    hapi_base_url="http://hapi.test/fhir",
                )

        # Library uploaded with the right service-prefixed name
        assert mock_upload.call_args.kwargs["base_name"] == "DraftDiabetesCare"
        # PlanDefinition put to the right URL
        called_url = client_inst.put.call_args[0][0]
        assert called_url == "http://hapi.test/fhir/PlanDefinition/diabetes-care"
        # Artifacts returned
        assert artifacts.library_canonical_url == "http://x/Library/LibAbc123"
        assert artifacts.plan_definition_id == "diabetes-care"
        assert "Applicability" in artifacts.detected_defines

    @pytest.mark.asyncio
    async def test_rejects_missing_applicability(self):
        bad_cql = "library X version '1.0'\nusing FHIR version '4.0.1'\ndefine Other: 1"
        with pytest.raises(ValueError, match="Applicability"):
            await materialize_cql_service(
                service_id="bad",
                name="Bad",
                description=None,
                hook_type="patient-view",
                cql_source=bad_cql,
                card_config={"summary": "x", "indicator": "info"},
            )

    @pytest.mark.asyncio
    async def test_rejects_empty_cql(self):
        with pytest.raises(ValueError, match="cql_source is required"):
            await materialize_cql_service(
                service_id="x",
                name="X",
                description=None,
                hook_type="patient-view",
                cql_source="",
                card_config={},
            )

    @pytest.mark.asyncio
    async def test_stable_mode_uses_versioned_pascal_library_name(self):
        """Stable mode names the Library `{PascalCase}_v_{version}` so each
        deploy creates a fresh identifier that bypasses HAPI's name-keyed
        compile cache (we confirmed in Phase 5 that bumping Library.version
        alone is NOT enough to invalidate the cache)."""
        ok_response = MagicMock(spec=httpx.Response)
        ok_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as ClientCls:
            client_inst = AsyncMock()
            client_inst.put.return_value = ok_response
            ClientCls.return_value.__aenter__.return_value = client_inst

            artifacts = await materialize_cql_service(
                service_id="diabetes-care",
                name="Diabetes Care",
                description=None,
                hook_type="patient-view",
                cql_source=SAMPLE_CQL,
                card_config={"summary": "x", "indicator": "info"},
                stable=True,
                library_version="1.2.3",
                hapi_base_url="http://hapi.test/fhir",
            )

        # Library URL incorporates the version: DiabetesCareV123 (dots stripped
        # because FHIR ids reject underscores AND CQL identifiers reject dots).
        assert artifacts.library_canonical_url.endswith("/Library/DiabetesCareV123")
        # Both the Library and PlanDefinition were PUT.
        called_urls = [c.args[0] for c in client_inst.put.call_args_list]
        assert any("/Library/DiabetesCareV123" in u for u in called_urls)
        assert any("/PlanDefinition/diabetes-care" in u for u in called_urls)

    @pytest.mark.asyncio
    async def test_stable_mode_different_versions_produce_different_urls(self):
        """Bumping the version must yield a fresh Library URL — that's the
        whole point of incorporating version into the name."""
        ok_response = MagicMock(spec=httpx.Response)
        ok_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as ClientCls:
            client_inst = AsyncMock()
            client_inst.put.return_value = ok_response
            ClientCls.return_value.__aenter__.return_value = client_inst

            v1 = await materialize_cql_service(
                service_id="x", name="X", description=None, hook_type="patient-view",
                cql_source=SAMPLE_CQL, card_config={"summary": "x", "indicator": "info"},
                stable=True, library_version="1.0.0", hapi_base_url="http://hapi.test/fhir",
            )
            v2 = await materialize_cql_service(
                service_id="x", name="X", description=None, hook_type="patient-view",
                cql_source=SAMPLE_CQL, card_config={"summary": "x", "indicator": "info"},
                stable=True, library_version="1.1.0", hapi_base_url="http://hapi.test/fhir",
            )

        assert v1.library_canonical_url != v2.library_canonical_url
        assert v1.library_canonical_url.endswith("V100")
        assert v2.library_canonical_url.endswith("V110")

    @pytest.mark.asyncio
    async def test_stable_mode_rewrites_cql_directive_to_match_library_name(self):
        """The CQL `library X version 'V'` directive must match Library.name
        for HAPI's CR engine to resolve the library."""
        ok_response = MagicMock(spec=httpx.Response)
        ok_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as ClientCls:
            client_inst = AsyncMock()
            client_inst.put.return_value = ok_response
            ClientCls.return_value.__aenter__.return_value = client_inst

            await materialize_cql_service(
                service_id="my-svc",
                name="My",
                description=None,
                hook_type="patient-view",
                cql_source="library OldName version '0.1.0'\nusing FHIR version '4.0.1'\ncontext Patient\ndefine Applicability: true",
                card_config={"summary": "x", "indicator": "info"},
                stable=True,
                library_version="1.0.0",
                hapi_base_url="http://hapi.test/fhir",
            )

        # Inspect the Library PUT body — the embedded base64 CQL should declare
        # the NEW versioned name, not the original `OldName`.
        import base64
        library_put = next(
            c for c in client_inst.put.call_args_list
            if "/Library/MySvcV100" in c.args[0]
        )
        sent_resource = library_put.kwargs["json"]
        decoded = base64.b64decode(sent_resource["content"][0]["data"]).decode()
        assert "library MySvcV100 version '1.0.0'" in decoded
        assert "library OldName" not in decoded
