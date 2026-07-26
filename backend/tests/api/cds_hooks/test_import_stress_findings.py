"""
Regression tests for the defects the MIMIC-on-FHIR import stress test exposed
(2026-07-26). Each test pins one production failure mode:

1. External-CDS failure counters keyed off the wrong identifier — the provider
   tracked under the HAPI PlanDefinition id ("157135") while the counter table
   keys on hook_service_id ("hfpef-cds"). Zero rows ever matched, so
   auto-disable NEVER engaged: four dead services fired 40x/hour indefinitely
   with consecutive_failures pinned at 0.

2. Built-in services crashed on null prefetch values — `prefetch.get("x", {})`
   only defaults when the KEY IS ABSENT; real clients (the WintEHR frontend
   included) send {"patient": null} when their prefetch resolver fails, and
   None.get(...) raised AttributeError in patient-greeter.

3. `POST [base]` — the FHIR-standard transaction submit — 301'd off the proxy,
   and HTTP clients convert a redirected POST to GET, silently discarding the
   transaction. Every spec-compliant FHIR client hits this.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from api.cds_hooks.providers import RemoteServiceProvider
from api.cds_hooks.models import CDSHookRequest
from api.cds_hooks.services.builtin import PatientGreeterService


class TestFailureTrackingIdentifier:
    """The counter UPDATE must receive hook_service_id, not the PD id."""

    @pytest.mark.asyncio
    async def test_failure_tracked_under_hook_service_id(
        self, external_plan_definition, sample_cds_request, external_service_metadata, test_db
    ):
        provider = RemoteServiceProvider(test_db)
        hook_request = CDSHookRequest(**sample_cds_request)

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Connection refused")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            await provider.execute(external_plan_definition, hook_request, external_service_metadata)

        assert test_db.execute.called
        params = test_db.execute.call_args[0][1]
        # The fixture's PD id is "external-diabetes-cds"; its metadata row's
        # hook_service_id is "external-diabetes-management". Only the latter
        # matches external_services.cds_hooks.
        assert params["sid"] == external_service_metadata["hook_service_id"]
        assert params["sid"] != external_plan_definition["id"]

    @pytest.mark.asyncio
    async def test_success_reset_also_uses_hook_service_id(
        self, external_plan_definition, sample_cds_request, external_service_metadata, test_db
    ):
        provider = RemoteServiceProvider(test_db)
        hook_request = CDSHookRequest(**sample_cds_request)

        mock_response = MagicMock()  # httpx.Response API is sync
        mock_response.status_code = 200
        mock_response.json.return_value = {"cards": []}

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            test_db.execute = AsyncMock()
            test_db.commit = AsyncMock()

            await provider.execute(external_plan_definition, hook_request, external_service_metadata)

        params = test_db.execute.call_args[0][1]
        assert params["sid"] == external_service_metadata["hook_service_id"]


class TestNullPrefetchValues:
    """Real clients send {"key": null} when their prefetch resolver fails."""

    @pytest.mark.asyncio
    async def test_greeter_survives_null_patient(self):
        service = PatientGreeterService()
        cards = await service.execute(
            context={"patientId": "p1", "userId": "u1"},
            prefetch={"patient": None},  # key PRESENT, value null — the crash shape
        )
        assert isinstance(cards, list)  # degraded card, not AttributeError

    @pytest.mark.asyncio
    async def test_greeter_survives_missing_patient_key(self):
        service = PatientGreeterService()
        cards = await service.execute(context={"patientId": "p1"}, prefetch={})
        assert isinstance(cards, list)


class TestFhirBasePost:
    """POST /fhir and /fhir/R4 must proxy, not redirect."""

    @pytest.fixture
    def client(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from api.fhir.proxy import router
        app = FastAPI()
        app.include_router(router)
        # Do NOT follow redirects: a 301/307 here IS the bug.
        return TestClient(app, follow_redirects=False)

    def _mock_hapi(self):
        resp = MagicMock()
        resp.status_code = 200
        resp.content = b'{"resourceType":"Bundle","type":"transaction-response","entry":[]}'
        resp.headers = {"content-type": "application/fhir+json"}
        client = AsyncMock()
        client.request.return_value = resp
        mock_cm = MagicMock()
        mock_cm.__aenter__ = AsyncMock(return_value=client)
        mock_cm.__aexit__ = AsyncMock(return_value=False)
        return mock_cm, client

    def test_post_fhir_base_does_not_redirect(self, client):
        mock_cm, hapi = self._mock_hapi()
        with patch('api.fhir.proxy.httpx.AsyncClient', return_value=mock_cm):
            r = client.post(
                "/fhir",
                json={"resourceType": "Bundle", "type": "transaction", "entry": []},
                headers={"Content-Type": "application/fhir+json"},
            )
        assert r.status_code not in (301, 302, 307, 308), (
            "POST [base] redirected — clients turn that into a GET and the "
            "transaction is silently discarded"
        )
        assert r.status_code == 200

    def test_post_fhir_r4_base_does_not_redirect(self, client):
        mock_cm, hapi = self._mock_hapi()
        with patch('api.fhir.proxy.httpx.AsyncClient', return_value=mock_cm):
            r = client.post(
                "/fhir/R4",
                json={"resourceType": "Bundle", "type": "transaction", "entry": []},
                headers={"Content-Type": "application/fhir+json"},
            )
        assert r.status_code not in (301, 302, 307, 308)
        assert r.status_code == 200
