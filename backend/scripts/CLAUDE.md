# Backend Scripts — module reference

Operational scripts for data load, imaging/DICOM generation, CDS service
loading, terminology indexing, and HAPI cleanup. Run by `deploy.sh` and by
hand — they are not imported by the FastAPI app.

**Inherits** root + `backend/CLAUDE.md` patterns (HAPI-FHIR-is-the-store,
backend-as-proxy, async everywhere, env-driven URLs, educational / no-PHI).
Only module-specific deltas are below.

---

## Critical: there is NO database-init script here

The prior doc described a `setup/` directory with `init_database_definitive.py`
"creating all 6 FHIR tables". **None of that exists.** Verified:

- No `setup/`, `testing/`, or `analysis/` subdirectory.
- No `init_database_definitive.py`, `init_search_tables.py`,
  `comprehensive_setup.py`, `validate_fhir_data.py`, `import_synthea_to_hapi.py`,
  `consolidated_catalog_setup.py`, `master_build.py` — anywhere in the repo.

Schema reality:

- **HAPI FHIR JPA** creates and owns its own `hfj_*` tables on first boot.
  Nothing in this repo creates FHIR tables. There is no `fhir.resources` table.
- The backend's **custom schemas** (`auth`, `cds_hooks`, `dicom`, `audit`,
  `smart_auth`, `cds_visual_builder`, …) are created by SQL in
  **`postgres-init/*.sql`**, run automatically by the Postgres container on a
  fresh volume — not by any Python script.

So: if you need to change the backend schema, edit `postgres-init/`. Do not
add a DB-init script to this directory.

---

## Path gotcha: container WORKDIR vs repo layout

`deploy.sh` runs these via `docker exec emr-backend python scripts/...`.
The backend image sets `WORKDIR /app` and copies the `backend/` tree in, so
**inside the container `scripts/` == repo `backend/scripts/`**. A path like
`scripts/active/load_cds_services_to_hapi.py` in `deploy.sh` resolves to
`backend/scripts/active/load_cds_services_to_hapi.py` in the repo.

Exception — terminology load: `download_umls.py`, `extract_vocabularies.py`,
`load_terminology.py`, and `ucum.json` live in the **repo-root `scripts/`**
(not here) and are `docker cp`'d into `/tmp` at deploy time. Only
`active/build_terminology_index.py` is in this directory.

---

## Layout and what each script is for

### `scripts/` (top level)

| Script | Purpose |
|---|---|
| `synthea_to_hapi_pipeline.py` | Primary data load. Generates Synthea FHIR, rewrites `collection` bundles to `transaction`, POSTs to HAPI. Called by `deploy.sh`. |
| `cql_bridge_poc.py` | POC — drives HAPI `PlanDefinition/$apply` end-to-end. Has a **hard-coded** Azure `HAPI_BASE`; not used by deploy. |

### `active/` — used by `deploy.sh` or run on demand

| Script | Purpose | In `deploy.sh`? |
|---|---|---|
| `load_cds_services_to_hapi.py` | Converts built-in CDS services to FHIR `PlanDefinition`s, posts to HAPI | yes |
| `generate_dicom_from_hapi.py` | Fetches `ImagingStudy` from HAPI (paginated), generates multi-slice DICOM into `/app/data/generated_dicoms/` | yes |
| `stow_dicom_to_dcm4chee.py` | STOWs generated DICOM into the dcm4chee VNA (normalizes `urn:oid:` study UID); the viewer proxies to dcm4chee, so without this the Imaging tab shows no images | yes |
| `create_dicom_endpoints.py` | Scans generated DICOM dirs, creates FHIR `Endpoint`s, links `ImagingStudy` | yes |
| `create_demo_practitioners.py` | Creates `Practitioner` resources for demo/nurse/pharmacist/admin | yes |
| `build_terminology_index.py` | Builds local SQLite terminology index for `/api/catalogs/*` autocomplete | yes (terminology phase) |
| `imaging_tools.py` / `imaging_workflow.py` | Older imaging/DICOM utilities; on-demand only | no |
| `seed_smart_apps.py` | Seeds `smart_auth.registered_apps` with sample SMART apps | no |
| `expunge_dev_libraries.py` | Reclaims orphan draft CQL `Library`s + smoke-test `PlanDefinition`s from HAPI | no |
| `expunge_orphan_visual_plan_definitions.py` | Reclaims duplicate visual-builder `PlanDefinition`s (pre-stable-id deploys) | no |
| `retire_deleted_cql_artifacts.py` | Sets HAPI `status` for soft-deleted CQL visual services (pre-PR #97 fix) | no |

### `migrations/` — one-time, already applied

`init_builtin_cds_services.py`, `migrate_builtin_to_hapi.py`,
`migrate_cds_to_plandefinitions.py` — all migrate built-in CDS services to HAPI
`PlanDefinition`s. Historical; do not re-run against a populated instance.

### Data dirs

`data/enhanced_resources.json` (static), `synthea/output/` (Synthea scratch),
`patient_exports/` (single-patient export/import tooling + README).

---

## Working with these scripts

- **Argument style is positional, not `argparse`.** `synthea_to_hapi_pipeline.py`
  takes `<count> <state>` by `sys.argv` index (`deploy.sh` passes
  `${PATIENT_COUNT} "${SYNTHEA_STATE}"`). Don't assume `--count`-style flags;
  check the `__main__` block of each script.
- **All FHIR writes go to HAPI over REST.** Scripts POST bundles / resources
  to HAPI; HAPI does storage, search indexing (`hfj_spidx_*`), version history,
  and reference links. No script touches `hfj_*` directly.
- **DICOM ordering dependency:** `generate_dicom_from_hapi.py` needs
  `ImagingStudy` resources to already exist (loaded by the Synthea pipeline);
  `stow_dicom_to_dcm4chee.py` and `create_dicom_endpoints.py` need the DICOM
  files to already exist. Pipeline order: generate → STOW → endpoints. The
  viewer (`api/dicom/dicom_service.py`) is a read-only proxy to dcm4chee, so the
  STOW step is what makes images actually render.
- **`cql_bridge_poc.py` has a hard-coded host** — the one place in this tree
  that violates env-driven URLs. It is a POC, not deploy code; leave it or pass
  a patient id, but do not copy its URL pattern.

## Start here

- `synthea_to_hapi_pipeline.py` — the canonical "generate → transaction-bundle
  → POST to HAPI" pattern; read its `__main__` block first.
- `deploy.sh` lines ~535–705 — the authoritative order in which these scripts
  run during a fresh deploy.
- `postgres-init/*.sql` — where the backend's non-FHIR schemas actually come
  from (not this directory).

## Out of scope here

- FHIR table creation / schema → HAPI owns `hfj_*`; custom schemas →
  `postgres-init/`.
- Terminology source extraction → repo-root `scripts/` (`download_umls.py`,
  `extract_vocabularies.py`, `load_terminology.py`).
- Runtime API / business logic → `backend/api/`.

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| Patient load fails | `docker compose logs emr-backend`; re-run `synthea_to_hapi_pipeline.py <count> <state>` manually |
| Synthea bundle rejected by HAPI | Pipeline rewrites `collection`→`transaction` and fixes `ifNoneExist`; check that conversion step |
| Imaging tab shows no images | DICOM not in dcm4chee — run `generate_dicom_from_hapi.py` → `stow_dicom_to_dcm4chee.py` → `create_dicom_endpoints.py`. The viewer proxies to dcm4chee; local files alone don't render. |
| CDS service missing from CDS Studio | `load_cds_services_to_hapi.py` did not run / failed (non-critical in `deploy.sh`) |
| Catalog autocomplete falls back / sparse | Terminology index not built — `build_terminology_index.py` needs vocab files in `/tmp`; restart `emr-backend` after build |
| Same CDS card appears N times | Orphan visual-builder `PlanDefinition`s — `expunge_orphan_visual_plan_definitions.py` |
| Resource counts look wrong | `SELECT res_type, COUNT(*) FROM hfj_resource WHERE res_deleted_at IS NULL GROUP BY res_type;` — there is no `fhir.resources` table |
