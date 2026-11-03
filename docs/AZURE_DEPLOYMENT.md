# Azure Deployment Guide

**Last Updated**: 2026-11-03

Azure-specific notes on top of the generic [DEPLOYMENT.md](DEPLOYMENT.md)
and the hardening playbook in [CLIENT_DEPLOYMENT.md](CLIENT_DEPLOYMENT.md).
Nothing here is Azure-only code — the same `./deploy.sh --environment prod`
path runs on any Linux VM. This page covers the VM, NSG, DNS and TLS choices
that are specific to Azure.

> Earlier versions of this page described a manual frontend tarball upload
> and an nginx `rewrite /fhir/R4/ → /fhir/` rule. Both are gone: the frontend
> is built inside `docker compose`, and `/fhir/R4/` is proxied through the
> backend for SMART validation. Don't follow old copies.

---

## 1. VM

| Setting | Recommendation |
|---|---|
| Size | `Standard_D2s_v3` (2 vCPU / 8 GB) works for 100 patients; `D4s_v3` if you load terminology |
| OS | Ubuntu 24.04 LTS |
| Disk | 64 GB+ Premium SSD (300 GB with SNOMED terminology) |
| Public IP | Static, with a DNS name label — gives you `<label>.<region>.cloudapp.azure.com` |

Install Docker and Compose v2 (`apt install docker-compose-v2` is enough on
Ubuntu 24.04, or use the get.docker.com script), add your user to the
`docker` group, clone the repo.

## 2. Network Security Group

Inbound rules the app needs:

| Port | Source | Why |
|---|---|---|
| 22 | your admin IPs | SSH |
| 80 | **Any** | Let's Encrypt HTTP-01 validation *and* the HTTP→HTTPS redirect. Restricting 80 to selected IPs breaks certificate issuance and renewal. |
| 443 | your users (or Any) | All application traffic |

`deploy/configure-azure-nsg.sh` creates these rules with the Azure CLI. It
reads the resource group / VM / NSG names and ports from `config.yaml`
(`azure.*`, `services.ports.nginx_http|nginx_https`) via
`deploy/load_config.sh`, and uses `security.allowed_ips` as the source
prefix for all three rules — so if you set `allowed_ips`, port 80 is
restricted too and Let's Encrypt will fail. Leave `allowed_ips` empty and
restrict 22/443 in the portal instead if you need source filtering.

```bash
az login
bash deploy/configure-azure-nsg.sh
```

Nothing else should be published. Postgres, Redis, HAPI and the backend are
internal to the Docker network in the prod profile; dcm4chee's ports are
bound to `127.0.0.1` on the VM.

## 3. DNS and TLS

Let's Encrypt via the bundled `certbot` container is the stock path:

```bash
cp .env.example .env     # then set POSTGRES_PASSWORD, JWT_SECRET_KEY, HAPI_ADMIN_TOKEN
./deploy.sh --environment prod --domain <label>.<region>.cloudapp.azure.com
```

`--domain` writes `DOMAIN`, `ENVIRONMENT=prod` and the `https://` /
`wss://` `REACT_APP_*` URLs into `.env`, renders
`deploy/nginx-prod.conf.template` into `deploy/rendered/nginx.conf`, and
runs `deploy/init-ssl.sh` after the stack is up. The cert lands in
`./certbot/conf/live/<domain>/`; the certbot container renews it every 12 h.

Constraints to know up front:

- **HTTP-01 only.** A `cloudapp.azure.com` name is not a zone you control,
  so DNS-01 is impossible. Port 80 must be reachable from Let's Encrypt's
  validators (i.e. from anywhere) at issuance *and* every renewal.
- **Bring your own cert** instead by placing `fullchain.pem` / `privkey.pem`
  under `./certbot/conf/live/<domain>/` before running `deploy.sh`; the
  script detects a non-Let's-Encrypt issuer and leaves it alone.
- **Plain HTTP is not a supported prod mode.** Setting
  `WINTEHR_SSL_DOMAIN_NAME=localhost` skips certificate issuance, but the
  rendered nginx config still listens on 443 with cert paths that don't
  exist. If you must run HTTP-only (e.g. the NSG can't open 80 to Any),
  keep your own HTTP-only `deploy/rendered/nginx.conf` plus a
  `docker-compose.override.yml` that pins relative `REACT_APP_*` build
  args, and re-apply them after every stock `deploy.sh` run (it re-renders
  the template and rewrites the `REACT_APP_*` lines). See
  [SECURITY.md § Known limitations](SECURITY.md#known-limitations).

## 4. Redeploys

App-only updates (the normal case):

```bash
git pull
docker compose --profile prod build backend-prod frontend-prod
docker compose --profile prod up -d backend-prod frontend-prod
```

Don't re-run `./deploy.sh --environment prod` casually on a populated box:
it re-runs the Synthea pipeline unless `--skip-data` is passed, re-renders
the nginx config, and recreates containers whose definitions changed. A
full `deploy.sh` run is for first install, or after a compose/nginx change
you intend to pick up.

nginx is a single-file bind mount; config edits need
`docker restart emr-nginx`, not just `nginx -s reload`.

## 5. Verification

```bash
curl -sI https://<domain>/ | grep -iE "strict-transport|x-frame"
curl -s  https://<domain>/api/health | jq .status
curl -s 'https://<domain>/fhir/R4/Patient?_summary=count' | jq .total
echo | openssl s_client -connect <domain>:443 2>/dev/null | openssl x509 -noout -enddate
```

If the NSG restricts port 80/443 by source IP and you are testing from
elsewhere, tunnel instead: `ssh -L 8443:localhost:443 azureuser@<ip>` and
hit `https://localhost:8443` (expect a hostname mismatch warning).

## 6. Common issues

| Symptom | Cause / fix |
|---|---|
| `init-ssl.sh` times out on the challenge | Port 80 not open to Any in the NSG, or DNS label not yet propagated. Fix the NSG, then `bash deploy/init-ssl.sh <domain>`. |
| `emr-nginx` restart loop with a mount error | A container created before PR #215 still bind-mounts the deleted `nginx-prod.conf`. `docker compose --profile prod up -d --force-recreate nginx`. |
| Browser mixed-content errors | `.env` has `http://` `REACT_APP_*` URLs. Re-run with `--domain` or fix `.env`, then rebuild `frontend-prod`. |
| `HAPI-0302: Unknown resource type 'R4'` | A hand-edited nginx config is proxying `/fhir/R4/` straight to HAPI. Use the rendered template; `/fhir/R4/` goes to the backend. |
| Imaging tab empty | `dicom` profile omitted (`--skip-dicom`) or STOW step failed — `docker logs vna-arc`, rerun `scripts/active/stow_dicom_to_dcm4chee.py` in `emr-backend`. |
| Catalog search shows only patient-derived codes | Terminology not loaded — needs `UMLS_API_KEY` or pre-extracted vocabularies; see [TERMINOLOGY_SETUP.md](TERMINOLOGY_SETUP.md). |

## 7. Cost note

An idle VPN gateway or an oversized VM costs more than the app. Deallocate
test VMs when not in use; the Synthea data regenerates on the next deploy.
