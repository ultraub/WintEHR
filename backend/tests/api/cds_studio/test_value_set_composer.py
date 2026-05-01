"""
Tests for value_set_composer — student ValueSet CRUD and FHIR generation.

Focus on the pure helpers (no DB / HAPI mocking needed):
- vs_id derivation handles edge cases
- Codes group by system correctly
- FHIR ValueSet resource shape is spec-compliant
- Pydantic validation rejects bad input
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from api.cds_studio.value_set_composer import (
    CodeEntry,
    ValueSetCreateRequest,
    build_value_set_resource,
    codes_to_compose_include,
    delete_value_set_from_hapi,
    derive_vs_id,
    put_value_set_to_hapi,
)


class TestDeriveVsId:

    def test_basic_lowercasing_and_hyphenating(self):
        assert derive_vs_id("Diabetes Conditions") == "diabetes-conditions"

    def test_strips_special_chars(self):
        assert derive_vs_id("Diabetes (Type 2)!") == "diabetes-type-2"

    def test_collapses_multiple_separators(self):
        assert derive_vs_id("Foo___Bar---Baz") == "foo-bar-baz"

    def test_camel_case_lowercased(self):
        assert derive_vs_id("MyDiabetesVS") == "mydiabetesvs"

    def test_leading_digit_gets_prefix(self):
        # FHIR ids can start with digit but vs ids should start with letter
        # for predictable URL routing.
        assert derive_vs_id("123abc") == "vs-123abc"

    def test_empty_input_uses_fallback(self):
        assert derive_vs_id("") == "value-set"
        assert derive_vs_id(None) == "value-set"

    def test_truncates_at_64_chars(self):
        long_name = "a" * 100
        assert len(derive_vs_id(long_name)) <= 64


class TestCodesToComposeInclude:

    def test_groups_codes_by_system(self):
        codes = [
            CodeEntry(system="http://snomed.info/sct", code="A1", display="A"),
            CodeEntry(system="http://loinc.org", code="L1", display="L"),
            CodeEntry(system="http://snomed.info/sct", code="A2", display="B"),
        ]
        include = codes_to_compose_include(codes)
        # Two systems, sorted alphabetically by URL
        assert len(include) == 2
        loinc, snomed = include[0], include[1]
        assert loinc["system"] == "http://loinc.org"
        assert len(loinc["concept"]) == 1
        assert snomed["system"] == "http://snomed.info/sct"
        assert len(snomed["concept"]) == 2

    def test_omits_display_when_missing(self):
        codes = [CodeEntry(system="http://x", code="1")]
        include = codes_to_compose_include(codes)
        assert "display" not in include[0]["concept"][0]

    def test_includes_display_when_present(self):
        codes = [CodeEntry(system="http://x", code="1", display="Hello")]
        include = codes_to_compose_include(codes)
        assert include[0]["concept"][0]["display"] == "Hello"


class TestBuildValueSetResource:

    def test_basic_shape(self):
        resource = build_value_set_resource(
            vs_id="diabetes",
            name="Diabetes",
            title="Diabetes Conditions",
            description="What diabetes looks like",
            codes=[CodeEntry(system="http://snomed.info/sct", code="44054006", display="DM")],
        )
        assert resource["resourceType"] == "ValueSet"
        assert resource["id"] == "diabetes"
        assert resource["url"].endswith("/ValueSet/diabetes")
        assert resource["status"] == "active"
        assert resource["experimental"] is True
        assert resource["name"] == "Diabetes"
        assert resource["title"] == "Diabetes Conditions"
        assert resource["description"] == "What diabetes looks like"

    def test_omits_optional_fields_when_none(self):
        resource = build_value_set_resource(
            vs_id="x", name="X", title=None, description=None,
            codes=[CodeEntry(system="http://x", code="1")],
        )
        assert "title" not in resource
        assert "description" not in resource

    def test_compose_include_present(self):
        resource = build_value_set_resource(
            vs_id="x", name="X", title=None, description=None,
            codes=[
                CodeEntry(system="http://snomed.info/sct", code="1"),
                CodeEntry(system="http://loinc.org", code="2"),
            ],
        )
        assert "compose" in resource
        assert len(resource["compose"]["include"]) == 2


class TestCreateRequestValidation:

    def test_rejects_invalid_name(self):
        # FHIR Name must be valid CQL identifier — must start with letter.
        with pytest.raises(ValueError):
            ValueSetCreateRequest(
                name="123Bad",
                codes=[CodeEntry(system="http://x", code="1")],
            )

    def test_rejects_name_with_hyphens(self):
        with pytest.raises(ValueError):
            ValueSetCreateRequest(
                name="diabetes-conditions",  # hyphens not allowed in CQL identifiers
                codes=[CodeEntry(system="http://x", code="1")],
            )

    def test_accepts_valid_name(self):
        req = ValueSetCreateRequest(
            name="DiabetesConditions",
            codes=[CodeEntry(system="http://x", code="1")],
        )
        assert req.name == "DiabetesConditions"

    def test_requires_at_least_one_code(self):
        with pytest.raises(ValueError):
            ValueSetCreateRequest(name="X", codes=[])


class TestHAPIIntegration:

    @pytest.mark.asyncio
    async def test_put_sends_to_correct_url(self):
        resource = {"resourceType": "ValueSet", "id": "test-vs", "url": "http://x/ValueSet/test-vs"}
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as ClientCls:
            client_inst = AsyncMock()
            client_inst.put.return_value = mock_response
            ClientCls.return_value.__aenter__.return_value = client_inst

            url = await put_value_set_to_hapi(resource, hapi_base_url="http://hapi.test/fhir")

        assert url == "http://x/ValueSet/test-vs"
        called_url = client_inst.put.call_args[0][0]
        assert called_url == "http://hapi.test/fhir/ValueSet/test-vs"

    @pytest.mark.asyncio
    async def test_put_raises_on_http_error(self):
        bad_response = MagicMock(spec=httpx.Response)
        bad_response.status_code = 422
        bad_response.text = "Invalid"
        bad_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "422", request=MagicMock(), response=bad_response,
        )

        with patch("httpx.AsyncClient") as ClientCls:
            client_inst = AsyncMock()
            client_inst.put.return_value = bad_response
            ClientCls.return_value.__aenter__.return_value = client_inst

            with pytest.raises(httpx.HTTPStatusError):
                await put_value_set_to_hapi(
                    {"resourceType": "ValueSet", "id": "x", "url": "http://x"},
                    hapi_base_url="http://hapi.test/fhir",
                )

    @pytest.mark.asyncio
    async def test_delete_treats_404_as_success(self):
        not_found = MagicMock(spec=httpx.Response)
        not_found.status_code = 404

        with patch("httpx.AsyncClient") as ClientCls:
            client_inst = AsyncMock()
            client_inst.delete.return_value = not_found
            ClientCls.return_value.__aenter__.return_value = client_inst

            # Should not raise
            await delete_value_set_from_hapi("missing", hapi_base_url="http://hapi.test/fhir")
