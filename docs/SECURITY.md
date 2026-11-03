# Security Posture

**Audience**: InfoSec teams reviewing WintEHR for client-VPC deployment, plus
operators responsible for hardening their installation. Distinguishes what
the project hardens by default from what each deployment must do for itself.

**Last verified against code**: 2026-11-03 (master `a99ec81a`). Every claim
below was checked against the file named in its row; if a path moves, treat
the row as suspect and re-verify.

**Critical reminder**: WintEHR is an **educational platform**. The shipped
authentication and authorization is sufficient for learning, demos, and
non-production environments. It is NOT production-grade and is NOT
HIPAA-compliant. Do not deploy with real Protected Health Information.

---

## What's hardened by default

These mitigations ship as part of the codebase and apply to every
deployment using the prod profile (`./deploy.sh --environment prod`).

### Container & runtime

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| Non-root backend container | `backend/Dockerfile` creates `emruser` UID/GID 1000, `USER emruser` | Limits blast radius if the backend is exploited |
| Python 3.12 base image | `python:3.12-slim` (`backend/Dockerfile`; CI pins the same) | Python 3.9 reached EOL October 2025 |
| Synthea JAR integrity check | SHA256 of Synthea v3.3.0 verified at build time (`backend/Dockerfile`) and again on the entrypoint's download fallback (`backend/docker-entrypoint.sh`) | Prevents supply-chain tampering of the synthetic patient generator |
| `apt-get --no-install-recommends` | `backend/Dockerfile` | Smaller image, less attack surface |
| No `Server:` header from uvicorn | `--no-server-header` in the backend `CMD` and compose `command` | Doesn't advertise the server version |
| Bounded `curl --retry` on fetches | `backend/Dockerfile`, `docker-entrypoint.sh` | Avoids hung deploys on flaky networks |
| dcm4chee VNA uses named volumes | `docker-compose.yml` `dicom` profile | No root-owned host bind mounts left behind (PR #215) |

### Network

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| PostgreSQL not exposed externally | `postgres-prod` in `docker-compose.yml` has no `ports:` | Prevents direct DB access from outside the Docker network |
| Redis not exposed externally | `redis-prod`, same | Prevents Redis CVE-2022-0543-style attacks |
| HAPI FHIR not exposed externally | `hapi-fhir-prod`, same | All FHIR access goes through nginx → backend SMART middleware |
| Backend API not exposed on host | `backend-prod`, same | Forces all client traffic through nginx |
| dcm4chee ports loopback-only | `ldap`/`db`/`arc` publish `127.0.0.1:389`, `:5433`, `:8080`, `:8443`, `:9990` | WildFly admin console and DIMSE ports are reachable from the host only, never from the network (PR #215). Omit the stack entirely with `--skip-dicom`. |
| Only nginx 80/443 published | `nginx` service `ports:` (`HTTP_PORT`/`HTTPS_PORT`) | Single ingress |
| HTTP → HTTPS redirect | `deploy/nginx-prod.conf.template` port-80 server: ACME challenge path, else `301` to HTTPS | Plain HTTP is never served |
| TLS 1.2 + 1.3 only | `ssl_protocols TLSv1.2 TLSv1.3; ssl_ciphers HIGH:!aNULL:!MD5` | Disables SSLv3, TLS 1.0/1.1, weak ciphers |
| HSTS with includeSubDomains | nginx `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always` | Forces HTTPS in browser memory |
| Browser hardening headers | nginx: `X-Frame-Options SAMEORIGIN`, `X-Content-Type-Options nosniff`, `X-XSS-Protection`. Backend `SecurityHeadersMiddleware` adds `X-Frame-Options DENY`, a CSP, and `Cache-Control: no-store` on `/api/*` | Clickjacking / MIME-sniffing defence |
| nginx rate limits | `limit_req_zone` per IP: `api_limit` 100 r/s, `cds_limit` 100 r/s, `general_limit` 200 r/s, with bursts | Limits brute-force and burst abuse |
| nginx config rendered, not edited | `deploy.sh` renders `deploy/nginx-prod.conf.template` → `deploy/rendered/nginx.conf` (gitignored) | No hard-coded hostnames in tracked config (root rule 4) |
| No CORS at the nginx layer | nginx template comments | CORS is set once, by the backend, so responses never carry duplicate headers |

### Authentication & authorization

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| SMART on FHIR auth gate | `backend/api/smart/middleware.py` `SMARTTokenMiddleware` on `/fhir/*` (except `metadata`) | Bearer-token validation on FHIR **writes** (POST/PUT/PATCH/DELETE) when enabled |
| Auto-enabled with JWT | `setup_smart_middleware`: `SMART_ENABLED` defaults to the value of `JWT_ENABLED` | Training mode keeps working; JWT mode gets enforcement without a second flag |
| Unauthenticated reads are optional | `SMART_ALLOW_UNPROTECTED` (default `true`) lets GETs through without a token; set `false` to require a token for reads too | Demo mode by design — see "What you own" |
| Open-redirect protection in OAuth | `backend/api/smart/router.py` only redirects errors to a `redirect_uri` registered for the `client_id` | Prevents phishing via crafted error redirects |
| `redirect_uri` allowlist per registered SMART client | `backend/api/smart/authorization_server.py` | OAuth2 best practice |
| Login rate limiting | `AuthService._check_rate_limit`: 5 failed attempts per IP per 15 min, in-memory | Slows credential guessing (lost on restart; not distributed) |
| Auth events audited | `AuditEventService` writes FHIR `AuditEvent` resources to HAPI | Login success/failure is queryable |
| HAPI admin surface token-guarded | `deploy/hapi-overlay` `CrCacheAdminController` requires `Authorization: Bearer $HAPI_ADMIN_TOKEN`; HAPI itself is not published | Cache-flush endpoint can't be hit anonymously |

### Secrets & input handling

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| JWT secret: one canonical name | `JWT_SECRET_KEY` is read first; `JWT_SECRET` is accepted as a fallback in both `backend/api/auth/config.py` and `docker-compose.yml` (PR #215) | The two names used to diverge silently, so a configured secret was ignored |
| `.env` gitignored | `.gitignore` | Prevents accidental commit of secrets |
| UMLS-derived terminology data gitignored | `.gitignore`: `fhir_vocabularies/`, `athena_vocab/`, `CONCEPT*.csv`, `VOCABULARY.csv`, … | UMLS / SNOMED licences forbid redistribution via public git |
| Rendered nginx config gitignored | `.gitignore`: `deploy/rendered/` | Per-host config never lands in the repo |
| Path-injection guard on FHIR schema endpoint | `backend/api/fhir/routers/schema.py` validates `resource_type` against a closed allowlist | Prevents arbitrary file reads via the URL path |
| Path-traversal guard on UI-composer sessions | `backend/api/ui_composer/session_manager.py` `_session_file()`: charset regex + resolved-path containment + basename (PR #233, 17 regression tests) | Session IDs from request bodies can no longer escape the sessions directory (read or delete) |
| DICOM endpoints take no filesystem paths | `backend/api/dicom/router.py` keys every route on DICOM UIDs and proxies to dcm4chee DICOMweb (`DICOM_QIDO_URL`/`DICOM_WADO_URL`) | The 2025 `study_dir` traversal class is gone with the parameter (PRs #179, #203) |
| SSRF guard on external-service registration | `backend/api/external_services/url_policy.py`: registered CDS/webhook/CQL-library URLs must match `EXTERNAL_SERVICES_URL_ALLOWLIST` host suffixes (PR #215) | The CDS engine fetches those URLs server-side. **Unset = accept-all + warning** (educational default) |
| Stack traces hidden outside development | `backend/api/middleware/exception_handler.py` includes `stack_trace` only when `ENVIRONMENT=development` | Doesn't leak internal paths/types |
| DocumentReference validated before write | HAPI `$validate` is called before persisting (PR #245) | Malformed notes are rejected rather than stored |
| HTML sanitization in DocumentReference display | `frontend/src/core/fhir/converters/DocumentReferenceConverter.js` uses DOMPurify 3.4.x | Hardens against nested-tag XSS bypass |

### Dependencies & supply chain

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| `python-jose[cryptography]` 3.5.0 | `backend/requirements.txt` | Patches ECDSA algorithm-confusion CVE (CRITICAL) |
| `PyJWT` 2.13.0 | requirements.txt | Patches `crit` header bypass |
| `python-multipart` 0.0.32 | requirements.txt | Patches arbitrary-file-write (CVSS 8.6) |
| `aiohttp` 3.14.3 | requirements.txt | Patches UNC SSRF + a long tail of lower-severity issues |
| `pydicom` 3.0.2 | requirements.txt | Patches path traversal via DICOM ReferencedFileID |
| `requests` removed | PR #203 — all HTTP is `httpx` 0.28 | One async client; the `verify=False` contagion class of bug is gone with the library |
| `bcrypt` 5.0 used directly | PR #267 dropped `passlib` | Unblocked the bcrypt 5 security line |
| Dependabot, weekly, grouped | `.github/dependabot.yml` (npm, pip, GitHub Actions) | Security advisories still open PRs immediately; routine bumps are batched |
| CodeQL default setup | GitHub repo setting (not a workflow file); findings drove PR #233 and the CI permissions change | Static analysis on every push |
| CI runs with `contents: read` only | `.github/workflows/ci.yml` `permissions:` | Least-privilege `GITHUB_TOKEN` |

---

## What you (the deployer) own

These are NOT defaults — every deployment configures them based on its
target environment.

### Required for any non-trivial deployment

1. **Strong PostgreSQL password.** Default `emr_password` is fine for laptop
   dev but unacceptable anywhere else. Generate with `openssl rand -base64 32`,
   set `POSTGRES_PASSWORD` in `.env`. Internal-only port exposure makes this
   less critical than it would otherwise be, but defense-in-depth is the rule.

2. **Strong JWT secret.** Compose defaults to `change-this-in-production`.
   Set `JWT_SECRET_KEY` in `.env` to `openssl rand -hex 32` (`JWT_SECRET`
   still works as a fallback name). Rotate annually.

3. **JWT enabled.** Default is `JWT_ENABLED=false` (training mode). For
   any deployment beyond a closed dev environment, set `JWT_ENABLED=true`.
   This also turns on the SMART write gate. Decide separately whether
   unauthenticated FHIR *reads* are acceptable (`SMART_ALLOW_UNPROTECTED`,
   default `true`; set `false` in `.env` to require a token for reads).
   See [CLIENT_DEPLOYMENT.md § Post-Deployment Hardening](CLIENT_DEPLOYMENT.md#post-deployment-hardening).

4. **TLS certificate.** Either Let's Encrypt via the bundled certbot
   container (`deploy/init-ssl.sh`; requires public DNS + inbound 80 from
   anywhere for HTTP-01) or your CA-issued cert placed in
   `./certbot/conf/live/<DOMAIN>/`. The nginx template already points at
   that path, so no config edit is needed.

5. **CORS origins set explicitly.** Two layers, both open by default:
   - Backend `CORSSecurityMiddleware` defaults to `*`; set `CORS_ORIGINS`
     to a comma-separated allow-list.
   - HAPI `hapi.fhir.cors.allowed_origin: "*"` in `docker-compose.yml` —
     only matters if you publish HAPI directly (prod does not).

6. **External-service URL allow-list.** Set `EXTERNAL_SERVICES_URL_ALLOWLIST`
   (comma-separated host suffixes) on any internet-exposed host; without it
   anyone who can register a CDS service can make the backend fetch
   arbitrary URLs.

7. **`HAPI_ADMIN_TOKEN` set.** Without it the overlay's `/admin/cr/*`
   endpoints refuse every call (safe) and CDS Studio cannot flush CQL caches
   after ValueSet edits (annoying). Generate with `openssl rand -hex 32`.

8. **`.env` not world-readable.** Run `chmod 600 .env` after creating.

9. **Demo user passwords changed.** All four demo users (`demo`, `nurse`,
   `pharmacist`, `admin`) ship with password `password`. The only lever is
   `TRAINING_PASSWORD` in `backend/api/auth/config.py` followed by an image
   rebuild — there is no runtime credential store (see Known limitations).

### Operational

10. **Backups.** PostgreSQL is the source of truth. Set up scheduled
    `pg_dump` (see CLIENT_DEPLOYMENT.md § Day-2 Operations), store off-host,
    test restores quarterly.

11. **OS patching.** WintEHR doesn't manage your host OS. Apply distro
    security updates on your normal cadence.

12. **Docker engine patching.** Likewise.

13. **Log retention & shipping.** Container logs are local to the host by
    default. If your environment requires central log aggregation, ship
    `docker compose logs` output to your SIEM/syslog.

14. **Firewall / security group.** Inbound 80/443/22; outbound only what's
    listed in [CLIENT_DEPLOYMENT.md § Network & Firewall Requirements](CLIENT_DEPLOYMENT.md#network--firewall-requirements).
    On Azure, `deploy/configure-azure-nsg.sh` applies these and honours
    `WINTEHR_SECURITY_ALLOWED_IPS` (from `config.yaml` `security.allowed_ips`)
    as the source prefix.

15. **Host hardening.** SSH key-only auth, fail2ban, unattended-upgrades,
    auditd if your environment requires it. WintEHR doesn't dictate your
    host policy.

16. **Secret rotation.** See CLIENT_DEPLOYMENT.md for the rotation matrix.

### License and data governance

17. **UMLS license re-acceptance.** UMLS LA requires annual re-acceptance.
    If you're using terminology, set a yearly calendar reminder.

18. **SNOMED CT licensing in client deployments.** Most US hospitals hold
    institutional UMLS/SNOMED licenses; verify this with your client before
    enabling `--include-snomed` in `scripts/extract_vocabularies.py`.

19. **Non-Synthea datasets.** `notebooks/01_import_mimic_on_fhir.ipynb`
    loads the MIMIC-IV-on-FHIR demo. That data is de-identified but
    real-derived and PhysioNet-licensed; importing it changes the
    governance of the box. Do that only on an instance whose access policy
    allows it.

---

## Known limitations

These are explicit gaps — operators should be aware:

### Authentication is not production-grade

`backend/api/auth/CLAUDE.md` flags this directly. Even with `JWT_ENABLED=true`:

- **Hardcoded demo users** with shared password `password` (the four
  practitioner accounts in `TRAINING_USERS`).
- **No user database.** `TRAINING_USERS` is a Python dict.
- **No password hashing on the login path.** `AuthService.authenticate_user`
  compares against the literal `TRAINING_PASSWORD` whether JWT is on or off;
  JWT only changes the token format. (`bcrypt` is present and tested in
  `jwt_handler.py`, but nothing calls it at login.)
- **Practitioner login has no password at all.** `PractitionerAuthService`
  (`POST /api/auth/practitioners/login`) logs in as any active FHIR
  `Practitioner` by name, NPI, or ID.
- **No token revocation.** JWTs are stateless; logout is client-side only.
- **No systematic RBAC.** `User.permissions` exists; a handful of endpoints
  check it with an explicit `in` test, most do not.

The DB-backed `SecureAuthService` referenced by older docs was **removed in
PR #158** (it queried tables that never existed). There is no partial
"Phase 2" path to finish — production use needs a real identity provider.

### Compose forwards an explicit env list

`docker-compose.yml` passes an explicit `environment:` list to the backend
containers; there is no `env_file:`. `CORS_ORIGINS`,
`EXTERNAL_SERVICES_URL_ALLOWLIST`, `SMART_ENABLED` and
`SMART_ALLOW_UNPROTECTED` are forwarded (since 2026-11-03, with defaults
that mirror the backend's). `FORCE_HTTPS` and `DISABLE_SECURITY_MIDDLEWARE`
are not; if you add a new security-relevant variable to the backend, add it
to both `backend-dev` and `backend-prod` in compose or it never reaches the
container.

### `ENVIRONMENT=prod` is not `production`

`deploy.sh` writes `ENVIRONMENT=prod` to `.env`; the backend's
`HTTPSRedirectMiddleware` and HSTS branch of `SecurityHeadersMiddleware`
check for the string `production`. In practice nginx performs both the
redirect and HSTS, so the user-facing behaviour is correct — but the
backend-level copies are inert under the stock deploy. The stack-trace
suppression is unaffected (it checks for `development`).

### Unauthenticated FHIR reads in JWT mode

With `JWT_ENABLED=true` the SMART middleware gates writes only.
`SMART_ALLOW_UNPROTECTED=true` (the default) lets any client read every
FHIR resource through `/fhir/R4/*` without a token. Set it to `false` in
`.env` for any instance that is not a public demo.

### No data encryption at rest

PostgreSQL data is unencrypted. Disk encryption at the host level (LUKS,
Azure SSE, etc.) is your responsibility.

### CORS wildcard, by intent

The backend's `CORSSecurityMiddleware` defaults to `*` so that student-built
external apps work without configuration. HAPI's own CORS is also `*`.
Tighten with `CORS_ORIGINS` and the compose value when the instance stops
being a classroom.

### `allow_external_references: true` on HAPI

Lets FHIR resources reference arbitrary external URLs. HAPI's reference
validator will fetch those URLs — built-in SSRF if a malicious resource
is POSTed. Acceptable for educational data; revisit before any real
deployment.

### dcm4chee ships with vendor defaults

The `dicom` profile runs dcm4chee with its stock credentials (WildFly admin
console, `pacs`/`pacs` Postgres). They are reachable only on `127.0.0.1`
from the host, never from the network, and the app talks to `arc:8080` over
the compose network. Anyone with a shell on the host has full VNA access.

### Swagger `/docs` exposed in production

nginx proxies `/docs` and `/openapi.json` to the backend's auto-generated
Swagger UI. This enumerates every API endpoint to anyone who hits the URL.
Remove those two `location` blocks from
`deploy/nginx-prod.conf.template` if you want to hide it.

### `ANTHROPIC_API_KEY` env passthrough

If you set `ANTHROPIC_API_KEY` in `.env`, compose forwards it into the
backend container. Any successful RCE on the backend exfiltrates it.
Consider whether your client deployment should bring its own key or
disable the `ai-tools` module (`WINTEHR_DISABLED_MODULES=ai-tools`).

### HTTP-only production is not a supported path

`deploy.sh -e prod` requires a domain and renders an HTTPS-only nginx
config. Running prod behind plain HTTP (e.g. an Azure cloudapp name whose
NSG blocks ACME) means hand-maintaining an HTTP-only
`deploy/rendered/nginx.conf` and a compose override; every stock redeploy
re-renders the HTTPS template over it.

---

## Auditing checklist

For an InfoSec review of a specific deployment, walk through:

- [ ] `git log --oneline -20` — what's the deployed commit, are there CVE-fix commits since?
- [ ] `grep -E "PASSWORD|SECRET|KEY|TOKEN" .env` — are all defaults overridden (`POSTGRES_PASSWORD`, `JWT_SECRET_KEY`, `HAPI_ADMIN_TOKEN`)?
- [ ] `stat .env` — `0600` permissions?
- [ ] `docker ps --format '{{.Names}}\t{{.Status}}'` — all healthy?
- [ ] `docker inspect emr-backend --format '{{.Config.User}}'` — should be `emruser` not blank
- [ ] `sudo ss -tlnp | grep -E ':(5432|6379|8080|8888|3000|8000)'` — only `127.0.0.1:8080` (dcm4chee) may appear; nothing on `0.0.0.0`/`*`
- [ ] `sudo ss -tlnp | grep -E ':(389|5433|8443|9990)'` — dcm4chee ports bound to `127.0.0.1` only (or absent with `--skip-dicom`)
- [ ] `curl -sI https://<domain>/` — HSTS, X-Frame-Options, X-Content-Type-Options, Content-Security-Policy present?
- [ ] `curl -sI http://<domain>/` — returns 301 redirect to HTTPS?
- [ ] `curl -s https://<domain>/fhir/R4/Patient?_count=1` with no token — do you *want* that to succeed? If not, `SMART_ALLOW_UNPROTECTED=false`
- [ ] `docker exec emr-backend env | grep -E "CORS_ORIGINS|EXTERNAL_SERVICES_URL_ALLOWLIST|SMART_"` — do the values inside the container match `.env`?
- [ ] `docker compose --profile prod logs backend-prod | grep -i "EXTERNAL_SERVICES_URL_ALLOWLIST is not set"` — should be absent on an exposed host
- [ ] Open Dependabot alerts in GitHub: how many, what severity?
- [ ] Open CodeQL alerts: how many, all triaged?
- [ ] `grep -E "JWT_ENABLED|SMART_ENABLED" .env` — `JWT_ENABLED=true` for anything beyond a closed dev box?
- [ ] Backup runs successfully? Last backup timestamp acceptable?
- [ ] Last UMLS license re-acceptance date (if applicable)?
- [ ] TLS cert expiry: `echo | openssl s_client -connect <domain>:443 2>/dev/null | openssl x509 -noout -enddate`
- [ ] Demo user passwords changed from `password`?
- [ ] Any non-Synthea dataset (MIMIC etc.) loaded? Is that covered by the instance's access policy?

---

## Security-relevant change log

Kept so an auditor can see what landed after their last review.

| Date | PR | Change |
|---|---|---|
| 2026-11-03 | — | `CORS_ORIGINS`, `EXTERNAL_SERVICES_URL_ALLOWLIST`, `SMART_ENABLED`, `SMART_ALLOW_UNPROTECTED` forwarded into the backend containers by compose (previously silently ignored from `.env`) |
| 2026-07-10 | #215 | dcm4chee behind `dicom` profile with loopback-only ports and named volumes; nginx config → template; `JWT_SECRET_KEY` canonical with `JWT_SECRET` fallback; `EXTERNAL_SERVICES_URL_ALLOWLIST` SSRF guard; minimal CI |
| 2026-07-07 | #203 | `requests` removed; DICOM service on async `httpx` |
| 2026-07-25 | — | CI `GITHUB_TOKEN` restricted to `contents: read` (CodeQL finding) |
| 2026-07-25 | #233 | UI-composer session path traversal fixed (three independent barriers, 17 tests); `uuid` patched; MD5 → SHA256 cache key |
| 2026-07-26 | #245 | DocumentReference validated against HAPI `$validate` before write |
| 2026-07-26 | #267 | `passlib` dropped; `bcrypt` 5 used directly |
| 2026-07-26 | #276 | nginx exact-match `/fhir` and `/fhir/R4` so `POST [base]` is never turned into a redirected GET |
| 2026-05-19 | #158 | Broken `SecureAuthService` / `USE_SECURE_AUTH` removed |

---

## Reporting security issues

For non-public issues, email the project maintainers directly rather than
filing a public GitHub issue. For dependency CVEs, GitHub Dependabot raises
alerts automatically; review them quarterly.

Educational-platform context: a "vulnerability" that requires real PHI to
be exploitable is not a real-world security issue against WintEHR's intended
use, but it's still worth tracking if you anticipate evolving toward a
production posture.

---

## Related Documentation

- [CLIENT_DEPLOYMENT.md](CLIENT_DEPLOYMENT.md) — Operator playbook
- [TERMINOLOGY_SETUP.md](TERMINOLOGY_SETUP.md) — UMLS license & loading
- [../backend/api/auth/CLAUDE.md](../backend/api/auth/CLAUDE.md) — Detailed auth limitations
- [../backend/api/smart/CLAUDE.md](../backend/api/smart/CLAUDE.md) — SMART enforcement flags
- [DEPLOYMENT.md](DEPLOYMENT.md) — Generic deployment reference
