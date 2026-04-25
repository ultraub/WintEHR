# Client Deployment Guide

**Audience**: Operators deploying WintEHR into a client's infrastructure (VPC,
self-hosted, on-prem). Assumes access to a Linux host and Docker. Distinct
from the developer/demo setup in [DEPLOYMENT.md](DEPLOYMENT.md) — this guide
covers security, networking, and operational practices for real deployments.

**Educational platform reminder**: WintEHR is designed for learning and
demonstration with synthetic data. It is **not HIPAA-compliant** out of the
box and should not be used with real Protected Health Information (PHI).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Network & Firewall Requirements](#network--firewall-requirements)
3. [Initial Deployment](#initial-deployment)
4. [Configuration](#configuration)
5. [Terminology Setup (Optional)](#terminology-setup-optional)
6. [Post-Deployment Hardening](#post-deployment-hardening)
7. [Day-2 Operations](#day-2-operations)
8. [Upgrade Path](#upgrade-path)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 8 GB | 16 GB (24 GB with terminology load) |
| Disk | 30 GB | 100 GB (300 GB with SNOMED terminology) |
| OS | Ubuntu 22.04+, Debian 12+, RHEL 9+ | Ubuntu 24.04 LTS |
| Docker | 24.0+ | Latest stable |
| Docker Compose | v2.20+ (built into modern Docker) | Latest |
| Python | 3.10+ (for admin scripts) | 3.12 |

### Software to install on the host

```bash
# Docker (via get.docker.com script, adjust for your distro)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group membership to take effect

# Python venv (for optional terminology setup)
sudo apt-get install -y python3-venv python3-pip
```

### Accounts you'll need

- **A UMLS API key** (free) — only if you want clinical terminology beyond what's
  in the synthetic patient data. See [TERMINOLOGY_SETUP.md](TERMINOLOGY_SETUP.md).
- **A TLS certificate** for HTTPS — either Let's Encrypt (automated via bundled
  certbot container) or a certificate from your organization's CA.
- **Outbound internet** to your DNS, NTP, and (if using Let's Encrypt) ACME
  challenge responders. Optional: NLM UTS download service for terminology.

---

## Network & Firewall Requirements

### Inbound ports to the WintEHR host

| Port | Purpose | Exposed by | Required? |
|------|---------|-----------|-----------|
| 80/tcp | HTTP → auto-redirects to HTTPS; Let's Encrypt challenge | nginx container | Yes |
| 443/tcp | HTTPS — all user traffic | nginx container | Yes |
| 22/tcp | SSH administration | host sshd | Yes (admin only, consider restricting source IPs) |

No other ports need to be exposed. Internal services (PostgreSQL 5432,
Redis 6379, HAPI FHIR 8080) run inside the Docker network only and are NOT
published to the host in the `prod` profile. This is deliberate — the prod
compose file was written to keep these internal.

### Outbound access from the WintEHR host

| Destination | Purpose | Required? |
|-------------|---------|-----------|
| `registry-1.docker.io`, `ghcr.io`, `github.com` | Docker image pulls, git clone/pull | Yes |
| `pypi.org`, `files.pythonhosted.org` | Python packages during image build | Yes |
| `npmjs.org`, `registry.npmjs.org` | NPM packages during frontend build | Yes |
| `letsencrypt.org`, `acme-v02.api.letsencrypt.org` | ACME TLS certificate issuance | Yes, if using bundled certbot |
| `github.com/synthetichealth/...` | Synthea JAR download during image build | Yes (first build only) |
| `uts-ws.nlm.nih.gov`, `download.nlm.nih.gov` | UMLS terminology download | Only if UMLS terminology is desired |

If your organization blocks outbound by default, allowlist the above. Pay
particular attention to letting the frontend build reach npmjs — that's where
most "stuck build" issues come from in restricted environments.

### DNS

- Your chosen domain (e.g., `wintehr.internal.example.com`) must resolve to
  the WintEHR host's public IP.
- If using Let's Encrypt, the domain must be resolvable from the public
  internet for ACME's HTTP-01 challenge.

---

## Initial Deployment

### 1. Clone the repository

```bash
cd /opt   # or wherever you keep server software
sudo git clone https://github.com/ultraub/WintEHR.git
cd WintEHR
sudo chown -R $USER:$USER .
```

Pin to a specific commit/tag for production stability:

```bash
git log --oneline | head -5   # Find a recent tag or commit
git checkout <commit-or-tag>
```

### 2. Create and configure `.env`

```bash
cp .env.example .env
chmod 600 .env   # Prevent other users from reading secrets
```

Edit `.env` — the settings that **must change** for a real deployment:

```bash
# Required changes
ENVIRONMENT=prod
DOMAIN=your-deployment-domain.example.com
POSTGRES_PASSWORD=<generate a strong password: openssl rand -base64 32>
JWT_SECRET=<generate: openssl rand -hex 32>
RESTART_POLICY=unless-stopped

# Recommended changes for production auth (see "Post-Deployment Hardening")
JWT_ENABLED=true

# Optional for terminology
UMLS_API_KEY=<your-umls-key>

# Optional for AI features  
ANTHROPIC_API_KEY=<your-key>
```

**Do not commit `.env` to version control.** It's in `.gitignore` already; keep
it that way.

### 3. Configure TLS certificate

**Option A — Let's Encrypt via bundled certbot (simplest)**:
The `certbot` container in `docker-compose.yml` automatically requests and
renews certs if your domain resolves publicly. After `deploy.sh`, the cert
will land in `./certbot/conf/live/<domain>/` on the host.

**Option B — organization CA**:
Place your cert and key:
```
./certbot/conf/live/<domain>/fullchain.pem  (cert chain)
./certbot/conf/live/<domain>/privkey.pem    (private key)
```
Update `nginx-prod.conf` if your domain doesn't match the hardcoded reference.

### 4. Run the deployment script

```bash
./deploy.sh --environment prod
```

What happens:

| Phase | Duration | What happens |
|-------|----------|--------------|
| 1. Build images | 5–10 min (first time) | Pulls base images, builds backend + frontend |
| 2. Start services | 1 min | Postgres, Redis, HAPI, backend, frontend, nginx |
| 3. Wait for HAPI | 5–6 min first boot | HAPI initializes JPA schema |
| 4. Load patient data | 3–5 min | 100 Synthea patients + related FHIR resources |
| 5. Generate DICOM files | 2–3 min | Synthetic imaging for studies |
| 6. Create DICOM endpoints | 30 sec | Link ImagingStudy → DICOM URL |
| 7. Load CDS services | 30 sec | Pre-built decision support rules |
| 8. Create demo practitioners | 10 sec | demo/nurse/pharmacist/admin users |
| 9. Terminology load (optional) | 1–3 hours | Only if UMLS_API_KEY is set |

**Total**: ~20 minutes to a functional system. If terminology load triggers,
it runs in the background — `deploy.sh` returns at step 8.

### 5. Verify

```bash
# Health check
curl -sf https://your-domain.example.com/api/health
# Expected: {"status":"healthy","service":"WintEHR Backend"}

# FHIR capability statement
curl -sf https://your-domain.example.com/fhir/R4/metadata | head -20

# Frontend
# Open https://your-domain.example.com in a browser
# Log in with demo/password
```

---

## Configuration

### What's in `.env`

The comment-annotated `.env.example` is the canonical reference. Key
categories:

- **Deployment profile** (`ENVIRONMENT`, `RESTART_POLICY`)
- **Domain + TLS** (`DOMAIN`)
- **Database credentials** (`POSTGRES_*`) — must change from defaults
- **Redis** (`REDIS_*`) — defaults are fine
- **HAPI FHIR** — defaults are fine
- **Authentication** (`JWT_ENABLED`, `JWT_SECRET`) — must set both for prod
- **CORS origins** (`CORS_ORIGINS`) — restrict to your actual domains
- **Data paths** — leave defaults unless you have a specific reason

### Profile selection

```bash
./deploy.sh                     # dev profile (training auth, hot reload, ports published)
./deploy.sh --environment prod  # prod profile (JWT, nginx, internal ports)
```

The prod profile:
- Publishes only nginx 80/443; all backend services are internal
- Uses non-root containers (UID 1000 emruser for backend)
- Runs with `restart: unless-stopped`
- Routes all traffic through nginx with TLS termination

---

## Terminology Setup (Optional)

If you want the CDS visual builder to have full clinical vocabularies
(RxNorm, ICD-10-CM, LOINC, CVX, HCPCS, ATC, optionally SNOMED CT) instead
of just codes from the Synthea patients:

1. Get a UMLS API key (free; ~1 business day for NLM verification) at
   https://uts.nlm.nih.gov/uts/edit-profile
2. Add `UMLS_API_KEY=<key>` to `.env`
3. Re-run `./deploy.sh --environment prod`, or run manually:

```bash
docker exec emr-backend python3 /tmp/download_umls.py ~/umls_source
```

See [TERMINOLOGY_SETUP.md](TERMINOLOGY_SETUP.md) for the full walkthrough,
license implications of SNOMED, and server resource sizing.

---

## Post-Deployment Hardening

### 1. Enable JWT authentication

The default configuration uses a training-mode auth where all users are
hardcoded with password `password`. Before any real deployment:

```bash
# Edit .env
JWT_ENABLED=true
JWT_SECRET=<strong random string; generate with: openssl rand -hex 32>
```

Restart the backend:

```bash
docker compose --profile prod up -d backend-prod
```

**Important caveat**: the current auth system, even with JWT enabled, uses
hardcoded demo users (demo/password, nurse/password, etc.). Real user
provisioning with hashed credentials is documented as "Phase 2" in
`backend/api/auth/CLAUDE.md` but not yet implemented. Do not put WintEHR
in front of real users without completing that work.

### 2. Change demo user credentials

The demo users (`demo`, `nurse`, `pharmacist`, `admin`) all share password
`password`. For a non-public deployment:

- Edit `backend/api/auth/config.py`, replace `TRAINING_PASSWORD`, and rebuild
  the backend image, OR
- Implement the secure auth path (see `backend/api/auth/secure_auth_service.py`)
  and set `USE_SECURE_AUTH=true` in `.env`.

### 3. Restrict CORS

By default HAPI FHIR's CORS is `*` for educational ease. In `.env`:

```bash
CORS_ORIGINS=https://your-deployment-domain.example.com,https://your-smart-app.example.com
```

And review `hapi.fhir.cors.allowed_origin` in `docker-compose.yml` if you
host external SMART apps.

### 4. Rotate secrets

Create a calendar recurrence to rotate these at least annually:

| Secret | Where | How to rotate |
|--------|-------|---------------|
| `JWT_SECRET` | `.env` | Generate new, update `.env`, restart backend; all existing tokens invalidate |
| `POSTGRES_PASSWORD` | `.env` | Update `.env`, `docker compose exec postgres psql -c "ALTER USER emr_user PASSWORD '...';"`, restart services |
| `UMLS_API_KEY` | `.env` | Regenerate at NLM UTS, update `.env` |
| `ANTHROPIC_API_KEY` | `.env` | Regenerate at Anthropic console, update `.env`, restart backend |
| TLS certificate | `certbot/conf/` | Let's Encrypt auto-renews every 60 days via bundled certbot; manual CA certs need your own cadence |

### 5. Review exposed ports on the host

```bash
sudo ss -tlnp | grep -E "(:80|:443|:5432|:6379|:8080|:8888|:3000|:8000)"
```

Prod should show **only** 80 and 443. If you see 5432/6379/8080/8888, check
your docker-compose file and ensure you're running the `prod` profile —
those ports come from the `dev` profile.

See [SECURITY.md](SECURITY.md) for the full security posture.

---

## Day-2 Operations

### Logs

```bash
# Live tail across all services
docker compose --profile prod logs -f

# Individual service
docker logs emr-backend -f
docker logs emr-hapi-fhir -f
docker logs emr-nginx -f
```

Nginx access log for request-level visibility:

```bash
docker exec emr-nginx tail -f /var/log/nginx/access.log
```

### Database backup

Use the bundled Makefile target:

```bash
make db-backup
# Produces backup_<timestamp>.sql.gz in the current directory
```

Or run directly:

```bash
docker exec emr-postgres pg_dump -U emr_user emr_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

Store backups off-host. A simple rotating cron:

```bash
# /etc/cron.d/wintehr-backup
0 2 * * * azureuser cd /opt/WintEHR && docker exec emr-postgres pg_dump -U emr_user emr_db | gzip > /backup/wintehr-$(date +\%Y\%m\%d).sql.gz && find /backup -name 'wintehr-*.sql.gz' -mtime +14 -delete
```

### Database restore

```bash
make db-restore FILE=backup_20260101_020000.sql.gz
```

### Health monitoring

Useful probes:

```bash
curl -sf https://your-domain/api/health                  # Backend health
curl -sf https://your-domain/fhir/R4/metadata           # HAPI up
curl -sf https://your-domain/                            # Frontend up
docker compose --profile prod ps                         # Container state
docker exec emr-postgres pg_isready -U emr_user -d emr_db  # DB up
```

### Resource usage

```bash
docker stats --no-stream                     # CPU/memory per container
df -h                                        # Host disk
docker system df                             # Docker-specific disk usage
```

---

## Upgrade Path

WintEHR is versioned by git commit. To upgrade:

```bash
cd /opt/WintEHR
git fetch origin
git log --oneline HEAD..origin/master       # Review changes

# Back up first
make db-backup

# Pull and restart
git reset --hard origin/master              # Or a specific tag
./deploy.sh --environment prod              # Rebuilds images if needed
```

`deploy.sh` is idempotent:
- Images are rebuilt only if source changed
- Patient data is not reloaded unless you explicitly `--skip-data=false`
- Terminology is not reloaded unless HAPI has no CodeSystems

### Upgrading across breaking changes

Review the commit log and associated `CLAUDE.md` updates for anything
marked breaking. Recent notable changes:

- **Python 3.9 → 3.12** (commit `aaf3b24`): requires a full image rebuild
- **Non-root backend container** (commit `a81a4c0`): requires host
  `./data`, `./logs`, and `./backend/data/generated_dicoms` to be owned by
  UID 1000. `deploy.sh` handles this automatically now.
- **Internal-only ports** (commit `a81a4c0`): 5432/6379/8888 no longer
  published in prod profile; host-side tools like `psql -h localhost` no
  longer work. Use `docker exec` instead.
- **Auto-terminology** (commit `18f69db`): if `UMLS_API_KEY` is in `.env`,
  deploys now auto-download/load terminology. Opt out by leaving the var
  unset.

### Rolling back

```bash
git log --oneline | head -20              # Find the commit to roll back to
git reset --hard <commit>
./deploy.sh --environment prod
```

If a rollback needs to revert database state, restore from the backup you
took before upgrade.

---

## Troubleshooting

### `./deploy.sh` fails at "Waiting for HAPI FHIR"

HAPI takes 5–6 minutes on first boot. If it times out (9 min):
```bash
docker logs emr-hapi-fhir -f
```
Common causes:
- Out of memory: bump `JAVA_TOOL_OPTIONS` in docker-compose.yml
- Postgres not ready: check `docker logs emr-postgres`
- Postgres password mismatch: delete `postgres_data` volume, redeploy

### Frontend loads but API calls fail

Check nginx config is serving the right origin:
```bash
docker exec emr-nginx cat /etc/nginx/nginx.conf | grep -A 5 "server_name"
```
Verify backend is reachable from nginx:
```bash
docker exec emr-nginx curl -sf http://backend:8000/api/health
```

### "Bearer token required" on FHIR writes

The SMART middleware gates `/fhir/R4/*` writes when `JWT_ENABLED=true`. For
training-mode deploys, `SMART_ENABLED` defaults to the opposite of
`JWT_ENABLED`. If writes fail in training mode, check `.env`:
```bash
grep -E "JWT_ENABLED|SMART_ENABLED" .env
```
See `backend/api/smart/CLAUDE.md` for the full auth interaction matrix.

### Containers keep restarting

```bash
docker compose --profile prod logs <service> 2>&1 | tail -100
```
Look for `ImportError`, `OperationalError`, `Permission denied`. The last
one usually means `./data` or `./logs` aren't owned by UID 1000; `deploy.sh`
chowns these automatically but you can force it:
```bash
sudo chown -R 1000:1000 ./data ./logs ./backend/data/generated_dicoms
docker compose --profile prod up -d
```

### Clock skew / TLS cert errors

Host clock drift can break TLS, JWT `nbf`/`exp` validation, and HAPI's
healthcheck. Ensure NTP is enabled:
```bash
timedatectl status
# Look for: "System clock synchronized: yes"
```

### Out of disk

Most likely culprits:
- Docker image layers (after many rebuilds): `docker system prune -af --volumes`
- Postgres data (after terminology load): expect +30 GB (+60 GB with SNOMED)
- Generated DICOM files: `./backend/data/generated_dicoms/` (can delete and regenerate)
- Container logs: `docker system df -v` shows per-container log sizes; rotate with logrotate or docker's `max-size` option

---

## Related Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Generic deployment reference (dev + prod)
- [TERMINOLOGY_SETUP.md](TERMINOLOGY_SETUP.md) — UMLS terminology ingestion
- [SECURITY.md](SECURITY.md) — Security posture and responsibilities
- [CONFIGURATION.md](CONFIGURATION.md) — Complete `.env` reference
- [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md) — Azure-specific setup
- [../CLAUDE.md](../CLAUDE.md) — Architecture overview
