# Security Posture

**Audience**: InfoSec teams reviewing WintEHR for client-VPC deployment, plus
operators responsible for hardening their installation. Distinguishes what
the project hardens by default from what each deployment must do for itself.

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
| Non-root backend container | `Dockerfile` creates `emruser` UID 1000, `USER emruser` directive | Limits blast radius if backend is exploited (no root-on-container = no easy container escape) |
| Python 3.12 base image | `python:3.12-slim` | Python 3.9 EOL October 2025; 3.12 receives security patches |
| Synthea JAR integrity check | SHA256 verified at build time and at entrypoint fallback | Prevents supply-chain tampering of the synthetic patient generator |
| `apt-get` packages with `--no-install-recommends` | `Dockerfile` | Smaller image, less attack surface |
| `curl --retry` with bounded timeouts | All HTTP fetches in scripts | Avoids hung deploys on flaky networks |

### Network

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| PostgreSQL not exposed externally | `docker-compose.yml` prod profile binds Postgres to internal Docker network only | Prevents direct DB access from the host network or beyond |
| Redis not exposed externally | Same | Prevents Redis CVE-2022-0543-style attacks |
| HAPI FHIR not exposed externally | Same | All FHIR access goes through nginx + backend's SMART middleware |
| Backend API not exposed on host | Same | Forces all client traffic through nginx |
| Only nginx 80/443 published | `docker-compose.yml` nginx ports | Single ingress; HTTPS-only |
| HTTP → HTTPS redirect | `nginx-prod.conf` | Plain HTTP is rejected with 301 to HTTPS |
| TLS 1.2 + 1.3, modern ciphers only | `nginx-prod.conf` `ssl_protocols`/`ssl_ciphers` | Disables SSLv3, TLS 1.0/1.1, weak ciphers |
| HSTS with includeSubDomains | nginx | Forces HTTPS in browser memory |
| nginx rate limits | `limit_req_zone` per-IP (`api_limit`, `cds_limit`, `general_limit`) | Limits brute-force and burst-abuse |

### Authentication & authorization

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| SMART on FHIR auth gate | `backend/api/smart/middleware.py` | Bearer-token validation on `/fhir/R4/*` writes when JWT enabled |
| Auto-disabled in training mode | `setup_smart_middleware` in middleware.py | Avoids breaking training-mode workflow when JWT is off |
| Open-redirect protection in OAuth | `backend/api/smart/router.py` redirect_uri validation | Prevents phishing via crafted error redirects |
| `redirect_uri` allowlist per registered SMART client | `authorization_server.py` | OAuth2 best practice |

### Secrets & input handling

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| `.env` permissions check expected 600 | Documented; not enforced | Protects API keys, DB password, JWT secret from other host users |
| `.env` gitignored | `.gitignore` | Prevents accidental commit of secrets |
| UMLS-derived terminology data gitignored | `.gitignore` covers `fhir_vocabularies/`, `athena_vocab/`, `CONCEPT.csv` | License compliance — UMLS-derived data must not be redistributed via public git |
| Path-injection guards on FHIR schema endpoint | `backend/api/fhir/routers/schema.py` validates `resource_type` against allowlist | Prevents arbitrary file reads via URL path traversal |
| Stack-trace exposure removed | Multiple routers log internally; return generic messages externally | Doesn't leak internal paths/types to attackers |
| HTML sanitization in DocumentReference | `frontend/.../DocumentReferenceConverter.js` uses DOMPurify | Hardens against nested-tag XSS bypass |

### Backend dependencies

| Mitigation | Implementation | Why |
|------------|----------------|-----|
| `python-jose` 3.5 | requirements.txt | Patches ECDSA algorithm-confusion CVE (CRITICAL) |
| `PyJWT` 2.12 | requirements.txt | Patches `crit` header bypass |
| `python-multipart` 0.0.26 | requirements.txt | Patches arbitrary-file-write (CVSS 8.6) |
| `aiohttp` 3.13 | requirements.txt | Patches UNC SSRF + ~15 lower-severity issues |
| `pydicom` 3.0 | requirements.txt | Patches path traversal via DICOM ReferencedFileID |
| `requests` 2.33 | requirements.txt | Patches `verify=False` session contagion + .netrc leak |

---

## What you (the deployer) own

These are NOT defaults — every deployment configures them based on its
target environment.

### Required for any non-trivial deployment

1. **Strong PostgreSQL password.** Default `emr_password` is fine for laptop
   dev but unacceptable anywhere else. Generate with `openssl rand -base64 32`,
   set `POSTGRES_PASSWORD` in `.env`. Internal-only port exposure makes this
   less critical than it would otherwise be, but defense-in-depth is the rule.

2. **Strong JWT secret.** Default in compose is `change-this-in-production`.
   Set `JWT_SECRET` in `.env` to `openssl rand -hex 32`. Rotate annually.

3. **JWT enabled.** Default is `JWT_ENABLED=false` (training mode). For
   any deployment beyond a closed dev environment, set `JWT_ENABLED=true`.
   See [CLIENT_DEPLOYMENT.md § Post-Deployment Hardening](CLIENT_DEPLOYMENT.md#post-deployment-hardening).

4. **TLS certificate.** Either Let's Encrypt via the bundled certbot
   container (requires public DNS + outbound 443) or your CA-issued cert
   placed in `./certbot/conf/live/<domain>/`.

5. **CORS origins set explicitly.** `hapi.fhir.cors.allowed_origin: *` is
   the default for educational ease. Replace with your actual frontend
   origin(s) in `docker-compose.yml`.

6. **`.env` not world-readable.** Run `chmod 600 .env` after creating.

7. **Demo user passwords changed.** All four demo users (`demo`, `nurse`,
   `pharmacist`, `admin`) ship with password `password`. Change in
   `backend/api/auth/config.py` or implement the secure auth path.

### Operational

8. **Backups.** PostgreSQL is the source of truth. Set up scheduled
   `pg_dump` (see CLIENT_DEPLOYMENT.md § Day-2 Operations), store off-host,
   test restores quarterly.

9. **OS patching.** WintEHR doesn't manage your host OS. Apply distro
   security updates on your normal cadence.

10. **Docker engine patching.** Likewise.

11. **Log retention & shipping.** Container logs are local to the host by
    default. If your environment requires central log aggregation, ship
    `docker compose logs` output to your SIEM/syslog.

12. **Firewall / security group.** Inbound 80/443/22; outbound only what's
    listed in [CLIENT_DEPLOYMENT.md § Network & Firewall Requirements](CLIENT_DEPLOYMENT.md#network--firewall-requirements).

13. **Host hardening.** SSH key-only auth, fail2ban, unattended-upgrades,
    auditd if your environment requires it. WintEHR doesn't dictate your
    host policy.

14. **Secret rotation.** See CLIENT_DEPLOYMENT.md for the rotation matrix.

### License-related

15. **UMLS license re-acceptance.** UMLS LA requires annual re-acceptance.
    If you're using terminology, set a yearly calendar reminder.

16. **SNOMED CT licensing in client deployments.** Most US hospitals hold
    institutional UMLS/SNOMED licenses; verify this with your client before
    enabling `--include-snomed`.

---

## Known limitations

These are explicit gaps documented in the project's CLAUDE.md files —
operators should be aware:

### Authentication is not production-grade

`backend/api/auth/CLAUDE.md` flags this directly. Even with `JWT_ENABLED=true`:

- **Hardcoded demo users** with shared password `password` (the four
  practitioner accounts).
- **No proper user database** — `TRAINING_USERS` is a Python dict.
- **No password hashing** — `TRAINING_PASSWORD == "password"` plain compare.
- **No token revocation** — JWTs are stateless; no logout invalidation.
- **No proper RBAC enforcement** — permissions list exists but isn't checked
  on most endpoints.

A "Phase 2" secure-auth path exists (`secure_auth_service.py`) with
bcrypt + per-user records, but it's incomplete. Real production use requires
finishing that work first.

### No data encryption at rest

PostgreSQL data is unencrypted. Disk encryption at the host level (LUKS,
Azure SSE, etc.) is your responsibility.

### CORS wildcard on HAPI FHIR

`hapi.fhir.cors.allowed_origin: *` ships as the default. Hardening it
requires editing `docker-compose.yml` for your specific allowed origins
and restarting HAPI.

### `allow_external_references: true` on HAPI

Lets FHIR resources reference arbitrary external URLs. HAPI's reference
validator will fetch those URLs — built-in SSRF if a malicious resource
is POSTed. Acceptable for educational data; revisit before any real
deployment.

### Swagger `/docs` exposed in production

nginx proxies `/docs` to the backend's auto-generated Swagger UI. This
enumerates every API endpoint to anyone who hits the URL. Comment out the
`location /docs` block in `nginx-prod.conf` if you want to hide it.

### `ANTHROPIC_API_KEY` env passthrough

If you set `ANTHROPIC_API_KEY` in `.env`, it's available as a backend
environment variable. Any successful RCE on the backend exfiltrates it.
Consider whether your client deployment should bring its own key or skip
the AI features entirely.

---

## Auditing checklist

For an InfoSec review of a specific deployment, walk through:

- [ ] `git log --oneline -20` — what's the deployed commit, are there CVE-fix commits since?
- [ ] `cat .env | grep -E "PASSWORD|SECRET|KEY"` — are all defaults overridden?
- [ ] `stat .env` — `0600` permissions?
- [ ] `docker ps --format '{{.Names}}\t{{.Status}}'` — all healthy?
- [ ] `docker inspect emr-backend --format '{{.Config.User}}'` — should be `emruser` not blank
- [ ] `sudo ss -tlnp | grep -E ':(5432|6379|8080|8888|3000|8000)'` — should return empty (only 80/443 listen)
- [ ] `curl -sI https://<domain>/` — HSTS, X-Frame-Options, X-Content-Type-Options headers present?
- [ ] `curl -sI http://<domain>/` — returns 301 redirect to HTTPS?
- [ ] Open Dependabot alerts in GitHub: how many, what severity?
- [ ] Open CodeQL alerts: how many, all triaged?
- [ ] `grep -E "JWT_ENABLED|SMART_ENABLED" .env` — both `true` for production?
- [ ] Backup runs successfully? Last backup timestamp acceptable?
- [ ] Last UMLS license re-acceptance date (if applicable)?
- [ ] TLS cert expiry: `echo | openssl s_client -connect <domain>:443 2>/dev/null | openssl x509 -noout -enddate`
- [ ] Demo user passwords changed from `password`?

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
- [DEPLOYMENT.md](DEPLOYMENT.md) — Generic deployment reference
