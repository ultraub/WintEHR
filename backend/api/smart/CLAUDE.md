# SMART on FHIR — module reference

An OAuth2 / SMART App Launch authorization server: it lets external SMART apps
obtain scoped, patient-context tokens, and a middleware that enforces those
tokens on FHIR requests. Follows SMART App Launch IG v2.1.0.

**Inherits** root + `backend/CLAUDE.md` + `backend/api/CLAUDE.md` patterns
(HAPI-FHIR-is-the-store, async, env-driven URLs, router/service split,
educational / no-PHI). Only module-specific deltas are below.

> **Educational implementation — deliberately not production-grade.** Sessions,
> codes, and tokens are in-memory (lost on restart). JWTs are HS256
> (symmetric). Consent is simplified. These are known shortcuts for a learning
> platform; do not "fix" them into a different architecture without being asked.

---

## Two halves of this module

1. **Authorization server** — issues codes and tokens. `router.py` is the HTTP
   surface; `authorization_server.py` (`SMARTAuthorizationServer`) holds the
   OAuth2 logic; `token_service.py` (`SMARTTokenService`) mints/validates JWTs;
   `scope_handler.py` parses SMART scopes.
2. **Enforcement middleware** — `middleware.py` (`SMARTTokenMiddleware`)
   intercepts FHIR requests, validates the bearer token, and enforces scopes +
   patient compartment. Registered in `main.py` via `setup_smart_middleware(app)`.

The two halves are independent: an app can be issued tokens even when the
middleware is disabled, and vice versa.

---

## Endpoints

`router.py` registers with **no prefix** (`include_router(smart_router)` in
`api/routers/__init__.py`) — every route declares its own full path.

| Path | Method | Purpose |
|---|---|---|
| `/.well-known/smart-configuration` | GET | Discovery — tells apps where endpoints are |
| `/api/smart/authorize` | GET | Start authorization flow |
| `/api/smart/consent/{session_id}` | GET | Consent screen data |
| `/api/smart/consent/{session_id}/approve` | POST | User approves |
| `/api/smart/consent/{session_id}/deny` | POST | User denies |
| `/api/smart/token` | POST | Exchange code (or refresh) for tokens |
| `/api/smart/launch` | POST | Create an EHR launch context |
| `/api/smart/flow/{session_id}` | GET | Educational step-by-step flow trace |
| `/api/smart/apps` | GET | List registered apps (demo + persisted) |
| `/api/smart/apps` | POST | Register an app (`system`); secret returned once |
| `/api/smart/apps/{client_id}` | PUT | Update a registered app (`system`) |
| `/api/smart/apps/{client_id}/rotate-secret` | POST | New secret, returned once (`system`) |
| `/api/smart/apps/{client_id}` | GET | One app's details |
| `/api/smart/token-info` | GET | Decode/inspect a token (`?token=...`) |
| `/api/smart/revoke` | POST | Revoke a token |
| `/api/smart/health` | GET | Module health check |

`SMARTAuthorizationServer` and `SMARTTokenService` are process singletons —
obtain them via the `get_auth_server()` / `get_token_service()` dependencies in
`router.py`, never construct them directly (a new instance has empty session
and app state).

---

## What the middleware protects

`SMARTTokenMiddleware` guards FHIR paths only — its `PROTECTED_PATH_PATTERN` is
`^/fhir/(?:R4/)?(?!metadata)`, i.e. `/fhir/*` and `/fhir/R4/*` **except**
`metadata` (the capability statement stays public). `/api/smart/*` is always
public (apps must reach the auth endpoints unauthenticated).

For a patient-context scope, the middleware appends a `patient=` filter to FHIR
searches so an app sees only its authorized patient's data.

### Enable / disable logic (non-obvious — verify before assuming)

The middleware's `enabled` flag does **not** default to `true` unconditionally:

```
SMART_ENABLED        default = "true" if JWT_ENABLED else "false"
SMART_ALLOW_UNPROTECTED  default = "true"  → demo mode: unauthenticated FHIR reads allowed
```

So with `JWT_ENABLED=false` (the dev default), SMART enforcement is **off**
unless `SMART_ENABLED=true` is set explicitly. When it is on, `SMART_ALLOW_UNPROTECTED=true`
still lets unauthenticated reads through — only writes (and reads, if that flag
is `false`) require a token.

---

## Scopes

`scope_handler.py` parses `[context]/[resource].[action]` —
`patient/Observation.read`, `user/*.write`, `launch/patient`. Patient-context
scopes restrict access to the authorized patient; the middleware enforces the
compartment, the scope handler decides whether an operation is permitted.

---

## Demo apps

`SMARTAuthorizationServer._register_demo_apps()` pre-registers two apps for
testing. Redirect URIs come from `SMART_APP_URL` / `FRONTEND_URL` env vars:

| Client ID | Name | Notable scopes |
|---|---|---|
| `growth-chart-app` | Growth Chart | `launch`, `launch/patient`, `patient/Patient.read`, `patient/Observation.read`, `openid`, `fhirUser` |
| `demo-patient-viewer` | Patient Summary Viewer | the above + `Condition`, `MedicationRequest`, `AllergyIntolerance` reads |

Apps registered at runtime (Command Center → Apps, or `POST /api/smart/apps`
with the `system` permission) persist in `smart_auth.registered_apps`
(`app_store.py`) and are reloaded into every worker's server by
`router.get_auth_server()` every `APP_RELOAD_SECONDS` (5). Only a bcrypt
hash of a confidential client's secret is stored; the plaintext is returned
once, at registration or `POST /api/smart/apps/{client_id}/rotate-secret`.
`RegisteredApp.source` is `demo` (code) or `registered` (store); demo apps
cannot be edited through the API (404). **The token endpoint verifies a
confidential client's secret** (`RegisteredApp.verify_client_secret`,
checked at the top of `exchange_code_for_tokens`) — before PR #366 it did
not.

Still per-worker and in-memory, by design (see the note at the top):
authorization sessions, codes and launch contexts. On a multi-worker
deployment an OAuth flow that starts on one worker can fail on another;
registrations are not affected.

---

## Configuration

| Env var | Default | Effect |
|---|---|---|
| `SMART_BASE_URL` | `BACKEND_BASE_URL` → `http://localhost:8000` | Issuer / discovery base URL |
| `HAPI_FHIR_URL` | `http://localhost:8888/fhir` | FHIR `aud` claim + proxy target |
| `JWT_SECRET` | `smart-dev-secret-key-change-in-production` | HS256 signing key |
| `SMART_ENABLED` | derived from `JWT_ENABLED` (see above) | Turns the enforcement middleware on |
| `SMART_ALLOW_UNPROTECTED` | `true` | Demo mode — allow unauthenticated FHIR reads |
| `FRONTEND_URL`, `SMART_APP_URL` | `:3000` / `:9000` | Demo-app redirect URIs |

---

## Start here

- `router.py` — every endpoint; the `get_auth_server` / `get_token_service`
  singletons.
- `authorization_server.py` — `start_authorization`, `approve_authorization`,
  `exchange_code_for_tokens`, `create_launch_context`. The OAuth2 state machine.
- `middleware.py` — `SMARTTokenMiddleware`; `setup_smart_middleware` and the
  enable/disable logic.
- `token_service.py` — `SMARTTokenService.generate_access_token` /
  `validate_access_token` / `revoke_token`.

---

## Out of scope / what NOT to do here

- **This is not the app login system.** Clinician/staff auth is `api/auth/` —
  SMART here is for *external SMART apps* obtaining FHIR access.
- **FHIR storage and the proxy** are `api/fhir/` + HAPI; this module only gates
  access to them.
- Do not move sessions/tokens to Redis or swap HS256→RS256 as an unprompted
  "improvement" — the in-memory / symmetric design is an intentional teaching
  simplification.

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| FHIR request rejected with 401 unexpectedly | `SMART_ENABLED` is on and `SMART_ALLOW_UNPROTECTED` is `false` — middleware now requires a token for reads |
| SMART enforcement seems to do nothing | `SMART_ENABLED` derives from `JWT_ENABLED`; with JWT off it defaults off — set `SMART_ENABLED=true` |
| Token valid one moment, "unknown" the next | Server restarted — sessions/codes/tokens are in-memory and do not survive a restart |
| `aud` mismatch in issued token | `HAPI_FHIR_URL` differs between issuer and the resource server |
| App can't be found at `/authorize` | `client_id` not registered — check `_register_demo_apps()` or call `register_app()` |
| Singleton state empty | Code constructed `SMARTAuthorizationServer()` directly instead of using `get_auth_server()` |

## Spec references

- [SMART App Launch IG v2.1.0](https://hl7.org/fhir/smart-app-launch/)
- [RFC 6749 (OAuth 2.0)](https://tools.ietf.org/html/rfc6749) ·
  [RFC 7636 (PKCE)](https://tools.ietf.org/html/rfc7636)
