"""
Tests for cql_dev_helper — content-hash naming bypassing HAPI's ELM cache.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from api.cds_hooks.cql_dev_helper import (
    DEV_LIBRARY_PREFIX,
    build_dev_library_resource,
    derive_dev_library_name,
    hash_cql,
    rewrite_cql_library_directive,
    upload_dev_library,
)


SAMPLE_CQL = """library MyRule version '0.1.0'

using FHIR version '4.0.1'

context Patient

define HasPatient: exists [Patient]
"""


class TestHashing:

    def test_hash_is_deterministic(self):
        assert hash_cql(SAMPLE_CQL) == hash_cql(SAMPLE_CQL)

    def test_different_content_yields_different_hash(self):
        assert hash_cql(SAMPLE_CQL) != hash_cql(SAMPLE_CQL + "\ndefine X: 1")

    def test_hash_is_12_hex_chars(self):
        h = hash_cql(SAMPLE_CQL)
        assert len(h) == 12
        assert all(c in "0123456789abcdef" for c in h)


class TestNameDerivation:

    def test_uses_default_prefix(self):
        name = derive_dev_library_name(SAMPLE_CQL)
        assert name.startswith(DEV_LIBRARY_PREFIX)

    def test_respects_custom_prefix(self):
        name = derive_dev_library_name(SAMPLE_CQL, base_name="DraftFoo")
        assert name.startswith("DraftFoo")

    def test_name_is_cql_identifier_compatible(self):
        # CQL identifiers: letters/digits/underscores, start with letter; no hyphens.
        name = derive_dev_library_name(SAMPLE_CQL)
        assert name[0].isalpha()
        assert name.isalnum()  # alphanumeric only


class TestRewrite:

    def test_replaces_library_directive(self):
        rewritten = rewrite_cql_library_directive(SAMPLE_CQL, "NewName")
        first_line = rewritten.splitlines()[0]
        assert first_line.startswith("library NewName version")

    def test_preserves_remaining_content(self):
        rewritten = rewrite_cql_library_directive(SAMPLE_CQL, "NewName")
        # All non-first lines unchanged
        original_rest = "\n".join(SAMPLE_CQL.splitlines()[1:])
        rewritten_rest = "\n".join(rewritten.splitlines()[1:])
        assert original_rest == rewritten_rest

    def test_only_replaces_first_directive(self):
        cql_two_directives = "library A version '1.0'\nlibrary B version '1.0'\n"
        rewritten = rewrite_cql_library_directive(cql_two_directives, "Z")
        # Both should be unchanged in the second line
        assert rewritten.splitlines()[1] == "library B version '1.0'"

    def test_raises_when_directive_missing(self):
        with pytest.raises(ValueError, match="library"):
            rewrite_cql_library_directive("define Foo: 1", "X")


class TestBuildResource:

    def test_resource_shape(self):
        resource = build_dev_library_resource(SAMPLE_CQL)
        assert resource["resourceType"] == "Library"
        # id, name, and url all reference the same hashed identifier
        assert resource["id"] == resource["name"]
        assert resource["id"] in resource["url"]
        assert resource["status"] == "active"
        assert resource["experimental"] is True
        assert resource["content"][0]["contentType"] == "text/cql"
        assert resource["content"][0]["data"]  # base64 not empty

    def test_idempotent_for_same_input(self):
        a = build_dev_library_resource(SAMPLE_CQL)
        b = build_dev_library_resource(SAMPLE_CQL)
        assert a["id"] == b["id"]
        assert a["url"] == b["url"]
        assert a["content"][0]["data"] == b["content"][0]["data"]

    def test_different_content_yields_different_id(self):
        a = build_dev_library_resource(SAMPLE_CQL)
        b = build_dev_library_resource(SAMPLE_CQL + "\ndefine X: 1\n")
        assert a["id"] != b["id"]

    def test_embedded_cql_uses_hashed_name(self):
        import base64
        resource = build_dev_library_resource(SAMPLE_CQL)
        decoded = base64.b64decode(resource["content"][0]["data"]).decode()
        # The CQL's `library` directive should be rewritten to the hashed name
        first_line = decoded.splitlines()[0]
        assert resource["name"] in first_line
        assert "MyRule" not in first_line  # original name replaced


class TestUploadDevLibrary:

    @pytest.mark.asyncio
    async def test_puts_to_correct_url_and_returns_canonical(self):
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None

        with patch("httpx.AsyncClient") as ClientCls:
            client_instance = AsyncMock()
            client_instance.put.return_value = mock_response
            ClientCls.return_value.__aenter__.return_value = client_instance

            lib_id, canonical_url = await upload_dev_library(
                SAMPLE_CQL, hapi_base_url="http://hapi.test/fhir",
            )

        assert lib_id.startswith("DevLibrary")
        assert canonical_url.endswith(f"/Library/{lib_id}")
        # PUT was called against the right URL
        called_url = client_instance.put.call_args[0][0]
        assert called_url == f"http://hapi.test/fhir/Library/{lib_id}"

    @pytest.mark.asyncio
    async def test_raises_on_http_error(self):
        # raise_for_status is a sync method on httpx.Response — use MagicMock not AsyncMock
        bad_response = MagicMock(spec=httpx.Response)
        bad_response.status_code = 422
        bad_response.text = "Unprocessable"
        bad_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "422", request=MagicMock(), response=bad_response,
        )

        with patch("httpx.AsyncClient") as ClientCls:
            client_instance = AsyncMock()
            client_instance.put.return_value = bad_response
            ClientCls.return_value.__aenter__.return_value = client_instance

            with pytest.raises(httpx.HTTPStatusError):
                await upload_dev_library(SAMPLE_CQL, hapi_base_url="http://hapi.test/fhir")
