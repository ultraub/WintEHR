# Authentication & Authorization — module reference

Login, session validation, and the `get_current_user` dependency used by every
protected backend endpoint.

**Inherits** root + `backend/CLAUDE.md` + `backend/api/CLAUDE.md` patterns
(HAPI-FHIR-is-the-store, backend-as-proxy, async everywhere, env-driven URLs,
service-layer separation, educational / no-PHI). Only module-specific deltas
are below.

> **NOT a secure auth system. Do not treat it as one.** This module exists to
> let an educational EHR have role-shaped logins, not to protect data. All
> "production" paths share the same hard-coded demo passwords. There is no real
> credential store wired up. Never deploy this against real users or PHI, and
> never cite it as a security control.

---

## Two auth services — know which one runs

`get_auth_service()` (in `service.py`) always returns `AuthService`. The
DB-backed `SecureAuthService` and its `USE_SECURE_AUTH` flag were **removed in
PR #158** — that service queried `auth.*` tables/columns that never existed,
so enabling it crashed at runtime. Do not reintroduce it; if you see docs or
examples referencing `secure_auth_service.py`, they are stale.

| Service | File | When active | What it actually does |
|---|---|---|---|
| `AuthService` | `service.py` | Always, for `/api/auth/*` | Checks `TRAINING_USERS` dict; password must equal the literal `"password"`. In-memory sessions (or a JWT when `JWT_ENABLED=true`). |
| `PractitionerAuthService` | `practitioner_auth_service.py` | Always, for `/practitioners/*` routes only | Logs in as a real FHIR `Practitioner` from HAPI; **no password check at all** |

The "production" JWT path is not separate code — `AuthService.authenticate_user`
takes the same `TRAINING_USERS` / `TRAINING_PASSWORD` branch whether `JWT_ENABLED`
is true or false. The only difference JWT makes is JWT-token vs in-memory-session
in the response.

---

## `get_current_user` — the dependency every router uses

`from api.auth.service import get_current_user` — this is the canonical import
(`backend/api/CLAUDE.md` shows it). It resolves a token in this order:

1. `Bearer` token from `HTTPBearer`, else the raw `Authorization` header.
2. Token prefixed `practitioner-session-` → validated by `PractitionerAuthService`
   (in-process session dict).
3. Otherwise → `AuthService.get_current_user_from_token` (JWT verify, or the
   `training-session-*` in-memory dict).

`get_current_user` lives in `service.py` and is the only implementation —
import it from there.

Related dependencies in `service.py`:
- `get_optional_current_user` — returns `None` instead of raising 401.
- `get_current_user_or_demo` — falls back to a synthetic `demo` user.

### Permissions

`User.permissions` is a flat `List[str]` (e.g. `"prescribe"`, `"order:lab"`,
`"admin"`). Endpoints check it directly — e.g. `router.py:94` gates `/users`
with `if "admin" not in current_user.permissions`. There is no permission
decorator; for a new permission gate, do an explicit `in` check in the
endpoint.

---

## Resolved endpoint paths

`auth_router` is registered in `routers/__init__.py` with **no prefix**; the
router itself carries `prefix="/api/auth"`, so paths resolve verbatim.

| Method + path | Handler | Notes |
|---|---|---|
| `POST /api/auth/login` | `AuthService.login` | Training: any `TRAINING_USERS` name + `"password"` |
| `GET  /api/auth/config` | — | Returns mode + `available_users` (training only) |
| `GET  /api/auth/me` | `get_current_user` | |
| `POST /api/auth/logout` | — | JWT mode: client-side only (no server revocation) |
| `GET  /api/auth/users` | — | `"admin"` permission required |
| `GET  /api/auth/health` | — | |
| `GET  /api/auth/practitioners` | `PractitionerAuthService` | Lists active FHIR Practitioners |
| `POST /api/auth/practitioners/login` | `PractitionerAuthService` | Login by family name / NPI / Practitioner ID; password ignored |

---

## Configuration (`config.py`)

| Env var | Default | Effect |
|---|---|---|
| `JWT_ENABLED` | `false` | `true` → login returns a JWT instead of an in-memory session token (same demo credentials either way) |
| `JWT_SECRET_KEY` | `training-secret-key-change-in-production` | HS256 signing key. Note the deployment plumbing (`docker-compose.yml`, `.env.example`) sets `JWT_SECRET`, a **different** variable that this module never reads — see the hygiene backlog / security review. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24h) | Token lifetime |

`TRAINING_USERS` (`config.py:22`) hard-codes four users — `demo`, `nurse`,
`pharmacist`, `admin` — all with password `"password"`. Their `id` values
(`demo-physician`, `demo-nurse`, …) are deliberately the IDs of `Practitioner`
resources in HAPI created by `create_demo_practitioners.py`; keep them in sync
if you add a training user.

---

## Audit logging

Auth events go through `AuditEventService` (`api/services/audit_event_service.py`),
which writes **FHIR R4 `AuditEvent` resources into HAPI** — it explicitly
replaced the legacy `fhir.audit_logs` table, which no longer exists. Do not
query a `fhir.audit_logs` or `audit.events` table for auth events; query HAPI
`AuditEvent`. Event-type constants: `AuditEventType` (`AUTH_LOGIN_SUCCESS`,
`AUTH_LOGIN_FAILURE`, `AUTH_LOGOUT`, `SECURITY_SUSPICIOUS_ACTIVITY`, …).

Rate limiting: `AuthService._check_rate_limit` — in-memory, per-IP, 5 failed
attempts / 15 min, lost on restart. Not distributed.

---

## Start here

- `service.py` — `AuthService` (default path) + `get_current_user`. Read this
  first; it is what runs in normal dev.
- `config.py` — `TRAINING_USERS`, the mode flags.
- `practitioner_auth_service.py` — the FHIR-Practitioner login path.
- `router.py` — endpoint surface.

## Out of scope here

- FHIR storage / `Practitioner` resources → HAPI (`hfj_*`); root `CLAUDE.md`.
- Security middleware (headers, CORS, request logging) → `api/middleware/`.
- Audit-record persistence → `api/services/audit_event_service.py`.

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| `401 Not authenticated` | No/blank `Authorization` header — `get_current_user` raises before any service runs |
| `401 Invalid authentication credentials` | Token present but unresolved — wrong prefix, expired JWT, or session lost on restart (sessions are in-memory) |
| Login works but `/users` returns 403 | Caller's `User.permissions` lacks `"admin"` |
| Practitioner login "not found" | `find_practitioner` searches HAPI by ID / `family` / NPI `identifier`, `active=true` only — confirm the Practitioner exists and is active |
| Logout doesn't invalidate a JWT | By design — JWT mode has no server-side revocation; only in-memory sessions can be dropped |
| JWT verifies locally but not on the server (or vice versa) | Signing-key mismatch — this module reads `JWT_SECRET_KEY`, while compose/`.env` set `JWT_SECRET`; if only the latter is configured, tokens are signed with the hardcoded default |
