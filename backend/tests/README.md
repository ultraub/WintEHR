# WintEHR Backend Tests

Unit and integration tests for the FastAPI backend. The suite runs **without
Docker or live services** — HAPI is mocked (`AsyncMock`) and the DB fixture is
in-memory SQLite; the one live-service test self-skips unless configured (see
below).

## Test structure

```
tests/
├── conftest.py                      # Shared fixtures (in-memory SQLite, mock HAPI client)
├── api/
│   ├── cds_hooks/                   # 14 files — the most-covered module
│   │   ├── test_cds_hooks_router.py         # Discovery + execution endpoints
│   │   ├── test_condition_engine.py         # Declarative condition evaluation
│   │   ├── test_cql_backed_provider.py      # CQL service provider
│   │   ├── test_cql_bridge.py               # $apply bridge + card translation
│   │   ├── test_cql_dev_helper.py           # Content-hashed Library upload
│   │   ├── test_cross_order_services.py
│   │   ├── test_failure_tracking.py         # Remote-service auto-disable
│   │   ├── test_local_provider.py
│   │   ├── test_ops_reliability.py
│   │   ├── test_order_composition_context.py
│   │   ├── test_prefetch_engine.py
│   │   ├── test_registration.py             # External service registration
│   │   ├── test_remote_provider.py
│   │   └── test_service_orchestrator.py     # Parallel dispatch
│   ├── cds_studio/
│   │   ├── test_cql_artifact_builder.py     # Library + PlanDefinition generation
│   │   └── test_value_set_composer.py
│   └── clinical/
│       ├── administration/                  # MAR backend
│       │   ├── test_admin_router.py
│       │   ├── test_dose_scheduler.py       # Pure-logic scheduling tests
│       │   └── test_tasks_router.py
│       └── pharmacy/
│           └── test_dispense_signing_gate.py
├── integration/
│   └── test_cr_cache_flush.py       # Live-service test — env-gated, self-skips
└── services/
    └── test_local_terminology_index.py
```

## Running tests

```bash
# From the backend directory
pytest tests/ -v

# Skip service-dependent tests
pytest tests/ -m "not integration"

# One file / class / method
pytest tests/api/cds_hooks/test_local_provider.py -v
pytest tests/api/cds_hooks/test_local_provider.py::TestLocalServiceProvider::test_execute_with_valid_service -v

# With coverage
pytest tests/ --cov=api --cov=services --cov-report=html
```

Markers (registered in `pytest.ini`): `asyncio`, `integration`, `unit`, `slow`,
`external`.

### The integration test

`tests/integration/test_cr_cache_flush.py` exercises the real HAPI overlay's
`POST /admin/cr/flush-caches` endpoint. It **skips itself** unless these env
vars are set:

```
INTEGRATION_HAPI_URL, INTEGRATION_BACKEND_URL, HAPI_ADMIN_TOKEN
```

## Fixtures (`conftest.py`)

- `test_db` — in-memory SQLite (`sqlite+aiosqlite:///:memory:`)
- `mock_hapi_client` — `AsyncMock`ed HAPI FHIR client
- Sample data fixtures: `sample_plan_definition`, `external_plan_definition`,
  `sample_cds_request`, `external_service_metadata`

## Conventions

1. Tests must not require live services (except the env-gated `integration/`).
2. Mock external dependencies — HAPI, HTTP clients, database.
3. Router tests build a minimal FastAPI app + `TestClient` and
   `patch(...HAPIFHIRClient)`; see `test_cds_hooks_router.py` or
   `test_dispense_signing_gate.py` as the pattern.
4. Async tests use `--asyncio-mode=auto` (no decorator needed).
5. Add tests next to the module path they cover (`tests/api/<module>/...`),
   and update the structure listing above when adding a new directory.

## Known coverage gaps

Coverage is concentrated on CDS Hooks. The largest untested modules are
`api/clinical/orders/`, most of `api/clinical/pharmacy/`, `api/auth/` +
`api/smart/`, and `api/dicom/` — prefer adding tests there when touching that
code.
