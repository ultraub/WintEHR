# WintEHR — Claude Code Context

Educational EHR platform for learning healthcare IT. React frontend, FastAPI
backend, HAPI FHIR JPA server, PostgreSQL.

> **NEVER use with real PHI.** Synthetic Synthea data only. No HIPAA compliance,
> insecure demo auth. Built for learning FHIR R4, EHR workflows, and CDS Hooks —
> not for production or real patient data.

This is the root context file. It owns the **project-wide rules** below; module
`CLAUDE.md` files (see the map) carry only their own deltas and never restate these.

---

## Quick reference

```bash
./deploy.sh                  # full dev deployment (dev profile)
./deploy.sh --skip-build     # skip Docker image rebuild
./deploy.sh --environment prod   # prod profile
./deploy.sh status           # health check
```

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:3000 | login `demo` / `password` |
| Backend API | http://localhost:8000 | Swagger at `/docs` |
| HAPI FHIR | http://localhost:8888/fhir | FHIR R4 server |
| PostgreSQL | localhost:5432 | user `emr_user`, db `emr_db` |

Demo users — all password `password`: `demo` (physician), `nurse`, `pharmacist`, `admin`.

Patient data volume is set by the `PATIENT_COUNT` env var (default 20; prod 100),
loaded by `backend/scripts/synthea_to_hapi_pipeline.py` during deploy.

---

## Architecture

Frontend (React 18 + MUI) → Backend (FastAPI) → HAPI FHIR JPA → PostgreSQL 15.
Backend and HAPI both run against the same Postgres; Redis caches sessions.
A single `docker-compose.yml` (profiles `dev` / `prod`) orchestrates `hapi-fhir`,
`postgres`, `redis`, `backend-dev|prod`, `frontend-dev|prod`, `nginx`.

- **HAPI FHIR** (`hapiproject/hapi:v8.6.0-1`, built with a local overlay in
  `deploy/hapi-overlay/`) stores all FHIR resources in `hfj_*` tables.
- **Backend** adds business logic, then delegates storage to HAPI.
- **PostgreSQL** holds HAPI's `hfj_*` tables plus custom schemas for auth, CDS
  Hooks, audit, SMART auth, and the CDS visual builder.

---

## Project-wide rules — NEVER break these

### 1. HAPI FHIR is the FHIR store
All FHIR resources live in HAPI, never in custom tables. Use the client:
```python
from services.hapi_fhir_client import HAPIFHIRClient
patient = await HAPIFHIRClient().read("Patient", patient_id)
```
There is no `fhir.resources` table. Never write FHIR data into Postgres directly.

### 2. Backend is an intelligent proxy
The backend adds value — validation, CDS evaluation, events — then delegates
storage to HAPI. Business logic belongs in services, not routers.

### 3. Async everywhere
All I/O is `async`. Use `httpx.AsyncClient`, never `requests` — a blocking call
stalls the event loop.

### 4. Environment-agnostic URLs
Never hardcode hostnames. The same build must run on local, Docker, Azure, AWS,
and GCP without edits.
- **Backend**: read every external URL from an env var (`os.getenv(...)` with a
  localhost dev default).
- **Frontend**: all URL resolution goes through `src/config/apiConfig.js`. Default
  to empty/relative URLs (the CRA proxy / nginx route them). `REACT_APP_*` vars are
  baked at build time — a hardcoded `localhost` breaks every non-local deployment.

### 5. Educational platform — no PHI
Synthetic data only. Do not add real-PHI handling, HIPAA controls, or
encryption-at-rest code — they misrepresent what this system is.

---

## CLAUDE.md map

These files are agent context, auto-loaded by path proximity. Each is the
authority for its subtree — read the one nearest your work; it carries only that
module's deltas on top of this file.

| File | Covers |
|---|---|
| `CLAUDE.md` (this) | project-wide rules, architecture |
| `backend/CLAUDE.md` | backend layout, router/service pattern |
| `backend/api/CLAUDE.md` | API layer, router registration |
| `backend/api/clinical/CLAUDE.md` | CPOE, pharmacy, MAR, drug safety, results |
| `backend/api/auth/CLAUDE.md` | auth (training/JWT modes), security caveats |
| `backend/api/cds_hooks/CLAUDE.md` | CDS Hooks 2.0 engine + CQL bridge |
| `backend/api/smart/CLAUDE.md` | SMART-on-FHIR OAuth2 |
| `backend/scripts/CLAUDE.md` | data / deployment scripts |
| `frontend/CLAUDE.md` | frontend architecture, contexts |
| `frontend/src/CLAUDE.md` | component / service layout detail |
| `frontend/src/services/CLAUDE.md` | frontend service layer |
| `frontend/src/pages/CLAUDE.md` | route / page components |
| `frontend/src/hooks/cds/CLAUDE.md` | CDS Hooks frontend plumbing |
| `frontend/src/components/fhir-explorer-v4/CLAUDE.md` | FHIR Explorer |
| `frontend/src/components/clinical/workspace/AdministrationRecord/CLAUDE.md` | MAR grid |
| `docs/CLAUDE.md` | documentation directory |
| `deploy/CLAUDE.md` | deployment configs |

---

## Tech stack

- **Backend**: FastAPI (Python 3.9+), HAPI FHIR JPA v8.6.0-1, PostgreSQL 15 with
  async SQLAlchemy, Redis 7, Pydantic V2, pytest.
- **Frontend**: React 18, MUI v5, React Router v6, Context API, CRA + CRACO.

---

## Common tasks

**Add a backend endpoint** — router in `backend/api/{module}/`, logic in a service,
register in `backend/api/routers/__init__.py`. See `backend/api/CLAUDE.md`.

**Add a frontend component** — under `frontend/src/components/{area}/`; use the FHIR
client at `core/fhir/services/fhirClient` and the React contexts. See `frontend/CLAUDE.md`.

**Inspect FHIR data**:
```bash
curl 'http://localhost:8888/fhir/Patient?_summary=count'
docker exec -it emr-postgres psql -U emr_user -d emr_db \
  -c "SELECT res_type, COUNT(*) FROM hfj_resource WHERE res_deleted_at IS NULL GROUP BY res_type;"
```

---

## Before committing

```bash
cd backend  && pytest tests/ -v
cd frontend && npm test -- --watchAll=false && npm run lint
```

---

## Environment variables

```
DATABASE_URL=postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db
HAPI_FHIR_URL=http://hapi-fhir:8080/fhir
REDIS_URL=redis://redis:6379/0
JWT_ENABLED=false        # true enables JWT auth mode
ENVIRONMENT=development
```

---

## Quick troubleshooting

| Symptom | Check |
|---|---|
| Services won't start | `docker-compose ps`; `docker-compose logs hapi-fhir backend-dev` |
| FHIR queries fail | `curl http://localhost:8888/fhir/metadata` |
| Frontend won't load | `docker-compose logs frontend-dev`; `curl http://localhost:8000/health` |

---

## Maintaining CLAUDE.md files

These files are agent context, not tutorials or learner material. When a pattern
changes, update the nearest file in the same change. Keep them:

- **Project-specific** — cut anything the model already knows about the framework.
- **Verified** — every path, table, route, and import checked against code.
- **Concise** — module files ~150–250 lines; favor decision/debug tables over prose.
- **Layered** — state a rule once at the highest level it is true; child files link
  up rather than restate.
- **Anchored** — tie non-obvious claims to real paths and PR numbers so drift shows.
