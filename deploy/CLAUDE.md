# deploy/ — deployment configuration

Configuration loading, SSL setup, Azure networking, and the HAPI FHIR Docker
overlay. **Inherits** root `CLAUDE.md`.

The deployment *entry points* — `deploy.sh` and `docker-compose.yml` — live at the
repo root. This directory holds the supporting config tooling they call.

---

## How deployment works

`./deploy.sh` drives everything via a single root `docker-compose.yml` with
`dev` / `prod` profiles plus a `dicom` profile (dcm4chee VNA) that the script
adds unless `--skip-dicom` is passed:

```bash
./deploy.sh                      # dev profile (default)
./deploy.sh --environment prod --domain host.example.com   # prod (-e also works)
./deploy.sh --skip-build         # reuse existing images
./deploy.sh --skip-dicom         # no VNA stack
./deploy.sh status | stop | clean | logs [service]
```

Prod with `--domain` rewrites `DOMAIN`/`ENVIRONMENT`/`REACT_APP_*` in `.env`
and renders `nginx-prod.conf.template` → `rendered/nginx.conf` (gitignored),
then runs `init-ssl.sh` after the stack is up.

Profile is also read from a root `config.yaml` (`environment:` key) if present.
Patient data volume comes from the `PATIENT_COUNT` env var (default 20; forced to
100 for prod) — `deploy.sh` runs `backend/scripts/synthea_to_hapi_pipeline.py`
positionally as `<count> <state>`.

Services started: `hapi-fhir`, `postgres`, `redis`, `backend-dev|prod`,
`frontend-dev|prod`, `nginx` + `certbot` (prod), `ldap`/`db`/`arc` (dicom,
host ports bound to `127.0.0.1`). All FHIR resources land in HAPI's `hfj_*`
tables; custom Postgres schemas come from `postgres-init/*.sql` on first boot.

---

## Files here

| File | Role |
|---|---|
| `hapi-overlay/` | Docker build context for HAPI FHIR — a custom overlay on the base `hapiproject/hapi` image (adds the CR cache-flush admin controller; see `backend/api/cds_hooks/CLAUDE.md`). Referenced by `docker-compose.yml` `build.context`. |
| `config_loader.py` | Loads / resolves deployment config |
| `validate_config.py` | Validates a config before deploy |
| `export_config.py` | Exports resolved config |
| `load_config.sh` | Shell entry to config loading |
| `nginx-prod.conf.template` | Tracked nginx config with `${DOMAIN}` placeholders; `rendered/` holds the output and is gitignored |
| `init-ssl.sh` | Placeholder cert → Let's Encrypt cert → renewal (there is no `setup-ssl.sh`) |
| `configure-azure-nsg.sh` | Azure NSG rules 22/80/443; honours `WINTEHR_SECURITY_ALLOWED_IPS` |

---

## Key environment variables

Beyond the root-level vars, deployment uses:

```
PATIENT_COUNT=20                 # synthetic patients to load
JWT_SECRET_KEY=                  # canonical; JWT_SECRET accepted as fallback
HAPI_ADMIN_TOKEN=                # bearer token for HAPI overlay admin endpoints
WINTEHR_SSL_DOMAIN_NAME=         # set to localhost to skip Let's Encrypt
```

`CORS_ORIGINS`, `EXTERNAL_SERVICES_URL_ALLOWLIST`, `SMART_ENABLED` and
`SMART_ALLOW_UNPROTECTED` are read by the backend but are **not** in the
compose `environment:` list — forward them via `docker-compose.override.yml`.
See `docs/SECURITY.md`.

All external URLs must stay env-driven — see root rule 4. Do not hardcode a
deployment host anywhere in this directory or in compose files.

---

## Debugging — symptom → where to look

| Symptom | Look at |
|---|---|
| A service won't come up | `docker-compose ps`; `docker-compose logs <service>` |
| HAPI image changes not taking effect | rebuild — `hapi-overlay/` is a build context, not a pulled image; `./deploy.sh` without `--skip-build` |
| Wrong profile deployed | root `config.yaml` `environment:` key overrides the default |
| CDS cache-flush admin calls failing | `HAPI_ADMIN_TOKEN` unset, or the `hapi-overlay/` controller not built in |
| Patient data missing after deploy | `PATIENT_COUNT`; the `synthea_to_hapi_pipeline.py` step in `deploy.sh` logs |
| SSL / cert errors in prod | `init-ssl.sh`; nginx logs; port 80 must be open to Any for HTTP-01 |
| nginx can't start after upgrade | Container still mounts the deleted `nginx-prod.conf` — recreate `emr-nginx` |

---

## Out of scope here

- `deploy.sh` and `docker-compose.yml` themselves — repo root.
- Custom schema DDL — `postgres-init/*.sql`.
- Configuration *reference* (what each setting means) — `docs/CONFIGURATION.md`,
  `docs/DEPLOYMENT.md`.
