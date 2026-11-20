"""SMART app registration (Command Center slice 8b): persistence, cross-worker
reload, secrets hashed and verified, demo apps untouched."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from api.auth.jwt_handler import get_password_hash
from api.auth.models import User
import importlib

# api/smart/__init__.py re-exports the APIRouter as `router`, which shadows the
# submodule on attribute access; go through sys.modules for the module itself.
smart_router = importlib.import_module("api.smart.router")
from api.smart.app_store import ClientIdTaken, MemorySmartAppStore, StoredApp, new_client_id
from api.smart.authorization_server import RegisteredApp, SMARTAuthorizationServer
from api.smart.models import GrantType, SMARTAppRegistration, SMARTAppUpdate, TokenRequest
from api.smart.token_service import create_token_service


def _server():
    return SMARTAuthorizationServer(base_url="http://b", fhir_url="http://f", token_service=create_token_service("http://b", "http://f", "k"))


def _sysadmin():
    return User(id="demo-admin", username="admin", name="A", email="a@example.com", role="admin", permissions=["admin", "system"])


@pytest.fixture
def store():
    s = MemorySmartAppStore()
    smart_router.use_app_store(s)
    smart_router._auth_server = None
    yield s
    smart_router.use_app_store(None)
    smart_router._auth_server = None


# --- secret verification --------------------------------------------------------


def test_public_clients_never_need_a_secret_and_confidential_ones_always_do():
    public = RegisteredApp(client_id="p", name="P", redirect_uris=["http://x"], scopes=["openid"])
    assert public.verify_client_secret(None) and public.verify_client_secret("anything")
    hashed = RegisteredApp(client_id="c", name="C", redirect_uris=["http://x"], scopes=["openid"],
                           client_type="confidential", client_secret_hash=get_password_hash("s3cret"))
    assert hashed.verify_client_secret("s3cret") is True
    assert hashed.verify_client_secret("wrong") is False
    assert hashed.verify_client_secret(None) is False
    demo = RegisteredApp(client_id="d", name="D", redirect_uris=["http://x"], scopes=["openid"], client_type="confidential", client_secret="plain")
    assert demo.verify_client_secret("plain") and not demo.verify_client_secret("nope")
    nothing = RegisteredApp(client_id="n", name="N", redirect_uris=["http://x"], scopes=["openid"], client_type="confidential")
    assert nothing.verify_client_secret("x") is False


def test_token_endpoint_rejects_a_confidential_client_with_the_wrong_secret():
    server = _server()
    server.register_app(RegisteredApp(client_id="conf", name="C", redirect_uris=["http://x"], scopes=["openid"],
                                      client_type="confidential", client_secret_hash=get_password_hash("right")))
    bad = TokenRequest(grant_type=GrantType.AUTHORIZATION_CODE, code="nope", redirect_uri="http://x", client_id="conf", client_secret="wrong")
    response, error = server.exchange_code_for_tokens(bad)
    assert response is None and error.error == "invalid_client"
    # With the right secret the request gets past client auth to the code check.
    good = TokenRequest(grant_type=GrantType.AUTHORIZATION_CODE, code="nope", redirect_uri="http://x", client_id="conf", client_secret="right")
    response, error = server.exchange_code_for_tokens(good)
    assert response is None and error.error != "invalid_client"


def test_load_persisted_apps_keeps_demo_apps_and_replaces_registered_ones():
    server = _server()
    demo_ids = {a.client_id for a in server.get_all_apps()}
    assert demo_ids, "demo apps are registered at startup"
    server.load_persisted_apps([RegisteredApp(client_id="r1", name="R1", redirect_uris=["http://x"], scopes=["openid"])])
    assert {a.client_id for a in server.get_all_apps()} == demo_ids | {"r1"}
    assert server.get_app("r1").source == "registered"
    server.load_persisted_apps([RegisteredApp(client_id="r2", name="R2", redirect_uris=["http://x"], scopes=["openid"])])
    assert {a.client_id for a in server.get_all_apps()} == demo_ids | {"r2"}, "r1 was removed from the store, so it is gone"


# --- store ------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_memory_store_rejects_duplicate_client_ids_and_unknown_fields():
    s = MemorySmartAppStore()
    await s.create(StoredApp(client_id="a", name="A", client_type="public", redirect_uris=["http://x"], scopes=["openid"]))
    with pytest.raises(ClientIdTaken):
        await s.create(StoredApp(client_id="a", name="A2", client_type="public", redirect_uris=["http://x"], scopes=["openid"]))
    with pytest.raises(ValueError):
        await s.update("a", bogus="b")
    assert (await s.update("a", name="Renamed")).name == "Renamed"
    assert await s.update("missing", name="x") is None


def test_new_client_id_is_a_safe_slug_with_a_suffix():
    cid = new_client_id("My Cool App!!")
    assert cid.startswith("my-cool-app-") and len(cid) == len("my-cool-app-") + 6


# --- endpoints (called directly with the memory store) --------------------------------


@pytest.mark.asyncio
async def test_register_returns_the_secret_once_and_every_worker_sees_the_app(store):
    server = await smart_router.get_auth_server()
    created = await smart_router.register_app(
        SMARTAppRegistration(name="Risk Calc", client_type="confidential", redirect_uris=["https://app.example/cb"], scopes=["openid", "patient/*.read"]),
        user=_sysadmin(), auth_server=server,
    )
    assert created.client_secret and len(created.client_secret) > 30
    assert created.client_id.startswith("risk-calc-") and created.source == "registered" and created.has_secret
    assert store.rows[created.client_id].client_secret_hash != created.client_secret, "only the hash is stored"

    # The server's memory now has it and verifies the issued secret.
    app = server.get_app(created.client_id)
    assert app.verify_client_secret(created.client_secret) is True

    # Listing never carries the secret.
    listed = await smart_router.list_apps(auth_server=server)
    mine = next(a for a in listed if a.client_id == created.client_id)
    assert not hasattr(mine, "client_secret") and mine.has_secret is True

    # "Another worker": a fresh server instance loads it from the shared store.
    smart_router._auth_server = None
    smart_router._apps_loaded_at = -1.0
    other = await smart_router.get_auth_server()
    assert other.get_app(created.client_id) is not None


@pytest.mark.asyncio
async def test_public_apps_get_no_secret_and_duplicates_are_409(store):
    server = await smart_router.get_auth_server()
    created = await smart_router.register_app(
        SMARTAppRegistration(name="Viewer", client_id="viewer-1", redirect_uris=["https://v/cb"], scopes=["openid"]),
        user=_sysadmin(), auth_server=server,
    )
    assert created.client_secret is None and created.has_secret is False and created.client_id == "viewer-1"
    with pytest.raises(HTTPException) as exc:
        await smart_router.register_app(
            SMARTAppRegistration(name="Viewer again", client_id="viewer-1", redirect_uris=["https://v/cb"], scopes=["openid"]),
            user=_sysadmin(), auth_server=server,
        )
    assert exc.value.status_code == 409
    demo_id = next(a.client_id for a in server.get_all_apps() if a.source == "demo")
    with pytest.raises(HTTPException) as exc:
        await smart_router.register_app(
            SMARTAppRegistration(name="Clash", client_id=demo_id, redirect_uris=["https://v/cb"], scopes=["openid"]),
            user=_sysadmin(), auth_server=server,
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_update_rotate_and_deactivate_apply_to_registered_apps_only(store):
    server = await smart_router.get_auth_server()
    created = await smart_router.register_app(
        SMARTAppRegistration(name="Conf", client_type="confidential", redirect_uris=["https://c/cb"], scopes=["openid"]),
        user=_sysadmin(), auth_server=server,
    )
    cid, first_secret = created.client_id, created.client_secret

    updated = await smart_router.update_app(cid, SMARTAppUpdate(name="Conf 2", is_active=False), user=_sysadmin(), auth_server=server)
    assert updated.name == "Conf 2" and updated.is_active is False
    assert server.get_app(cid).is_active is False

    rotated = await smart_router.rotate_secret(cid, user=_sysadmin(), auth_server=server)
    assert rotated.client_secret and rotated.client_secret != first_secret
    assert server.get_app(cid).verify_client_secret(first_secret) is False
    assert server.get_app(cid).verify_client_secret(rotated.client_secret) is True

    demo_id = next(a.client_id for a in server.get_all_apps() if a.source == "demo")
    with pytest.raises(HTTPException) as exc:
        await smart_router.update_app(demo_id, SMARTAppUpdate(name="x"), user=_sysadmin(), auth_server=server)
    assert exc.value.status_code == 404

    public = await smart_router.register_app(
        SMARTAppRegistration(name="Pub", redirect_uris=["https://p/cb"], scopes=["openid"]), user=_sysadmin(), auth_server=server)
    with pytest.raises(HTTPException) as exc:
        await smart_router.rotate_secret(public.client_id, user=_sysadmin(), auth_server=server)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_store_failure_keeps_the_current_apps(store):
    server = await smart_router.get_auth_server()
    before = {a.client_id for a in server.get_all_apps()}

    class Broken:
        async def list(self):
            raise ConnectionError("postgres gone")

    smart_router.use_app_store(Broken())
    again = await smart_router.get_auth_server()
    assert {a.client_id for a in again.get_all_apps()} == before
