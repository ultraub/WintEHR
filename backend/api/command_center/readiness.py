"""Deployment readiness checklist (Command Center slice 11).

The Status tab's probes say whether each part is up; this says whether the
deployment is ready to hand to a class. Pure: takes the probed components,
an env mapping and one fact about the secret store, returns a list of
ReadinessItem. Nothing here talks to the network.

The secret checks mirror deploy/secrets_policy.py (the pre-deploy gate),
which the backend image does not ship; tests/api/command_center/
test_readiness.py pins the example-value lists to the same set so the two
cannot drift apart silently.
"""

from __future__ import annotations

from typing import Dict, List, Mapping, Optional, Set

from .models import ComponentStatus, ReadinessItem

# Keep equal to deploy/secrets_policy.py EXAMPLE_VALUES (asserted by test_readiness.py).
EXAMPLE_VALUES: Dict[str, Set[str]] = {
    "POSTGRES_PASSWORD": {"emr_password", "CHANGE_ME_TO_SECURE_PASSWORD"},
    "JWT": {
        "dev-jwt-secret-change-for-production",
        "CHANGE_ME_TO_RANDOM_JWT_SECRET",
        "change-this-in-production",
        "dev-secret-key",
        "training-secret-key-change-in-production",
    },
}
MIN_PASSWORD_LEN = 16
MIN_JWT_LEN = 32

UMLS_KEY_SETTING = "system.umls_api_key"


def is_production(environment: Optional[str]) -> bool:
    return (environment or "").strip().lower().startswith("prod")


def _item(id: str, label: str, status: str, detail: str, fix: Optional[str] = None) -> ReadinessItem:
    return ReadinessItem(id=id, label=label, status=status, detail=detail, fix=fix)


def readiness_checks(
    components: List[ComponentStatus],
    env: Mapping[str, str],
    umls_key_set: bool = False,
) -> List[ReadinessItem]:
    by_name = {c.name: c for c in components}
    prod = is_production(env.get("ENVIRONMENT"))
    bad = "fail" if prod else "warn"   # a default secret is fatal in prod, a nudge in dev
    items: List[ReadinessItem] = []

    # --- profile and secrets -------------------------------------------------
    items.append(_item("environment", "Deployment profile", "ok" if prod else "info",
                       f"ENVIRONMENT={env.get('ENVIRONMENT') or 'unset'}" + ("" if prod else " (dev profile: no nginx, every port published)"),
                       None if prod else "./deploy.sh --environment prod --domain <host>"))

    pg = env.get("POSTGRES_PASSWORD", "")
    if not pg:
        items.append(_item("postgres_password", "PostgreSQL password", "fail", "POSTGRES_PASSWORD is not set", "openssl rand -base64 32 → POSTGRES_PASSWORD in .env"))
    elif pg in EXAMPLE_VALUES["POSTGRES_PASSWORD"]:
        items.append(_item("postgres_password", "PostgreSQL password", bad, "POSTGRES_PASSWORD is the example value", "openssl rand -base64 32 → POSTGRES_PASSWORD in .env (then recreate the postgres volume or ALTER ROLE)"))
    elif len(pg) < MIN_PASSWORD_LEN:
        items.append(_item("postgres_password", "PostgreSQL password", "warn", f"POSTGRES_PASSWORD is short ({len(pg)} chars; {MIN_PASSWORD_LEN}+ recommended)"))
    else:
        items.append(_item("postgres_password", "PostgreSQL password", "ok", "Set and not an example value"))

    jwt = env.get("JWT_SECRET_KEY") or env.get("JWT_SECRET") or ""
    if not jwt:
        items.append(_item("jwt_secret", "JWT signing key", bad, "JWT_SECRET_KEY is not set; tokens are signed with the built-in default", "openssl rand -hex 32 → JWT_SECRET_KEY in .env, restart backend"))
    elif jwt in EXAMPLE_VALUES["JWT"]:
        items.append(_item("jwt_secret", "JWT signing key", bad, "JWT_SECRET_KEY is the example value", "openssl rand -hex 32 → JWT_SECRET_KEY in .env, restart backend"))
    elif len(jwt) < MIN_JWT_LEN:
        items.append(_item("jwt_secret", "JWT signing key", "warn", f"JWT_SECRET_KEY is short ({len(jwt)} chars; {MIN_JWT_LEN}+ recommended)"))
    else:
        items.append(_item("jwt_secret", "JWT signing key", "ok", "Set and not an example value"))

    if env.get("HAPI_ADMIN_TOKEN"):
        items.append(_item("hapi_admin_token", "HAPI admin token", "ok", "Set; CDS Studio can flush CQL caches"))
    else:
        items.append(_item("hapi_admin_token", "HAPI admin token", "warn", "HAPI_ADMIN_TOKEN unset: the HAPI overlay's /admin endpoints refuse every call, so ValueSet edits do not reach running CQL", "openssl rand -hex 32 → HAPI_ADMIN_TOKEN in .env, restart hapi-fhir and backend"))

    if env.get("WINTEHR_SETTINGS_KEY"):
        items.append(_item("settings_key", "Secret settings", "ok", "WINTEHR_SETTINGS_KEY set; secrets such as the UMLS key can be saved"))
    else:
        items.append(_item("settings_key", "Secret settings", "warn", "WINTEHR_SETTINGS_KEY unset: secret settings cannot be saved from the Settings tab", "any long passphrase → WINTEHR_SETTINGS_KEY in .env, restart backend"))

    if (env.get("JWT_ENABLED") or "").strip().lower() == "true":
        items.append(_item("auth_mode", "Authentication", "ok", "JWT mode: real accounts and signed tokens"))
    else:
        items.append(_item("auth_mode", "Authentication", "info", "Training mode: demo users (demo / nurse / pharmacist / admin) share the password 'password'", "JWT_ENABLED=true for real accounts (docs/SECURITY.md)"))

    # --- content ---------------------------------------------------------------------
    fhir = by_name.get("fhir")
    patients = (fhir.data or {}).get("patient_count") if fhir else None
    if fhir is None or fhir.status == "down":
        items.append(_item("patients", "Patient data", "fail", "FHIR store unreachable; cannot tell"))
    elif not patients:
        items.append(_item("patients", "Patient data", "fail", "No patients loaded", "Jobs → Synthea load"))
    else:
        items.append(_item("patients", "Patient data", "ok", f"{patients} synthetic patients"))

    term = by_name.get("terminology")
    if term is not None and term.status == "ok":
        items.append(_item("terminology", "Terminology index", "ok", term.detail or "Index present"))
    else:
        items.append(_item("terminology", "Terminology index", "warn", "Catalog search falls back to short static lists", "Jobs → Terminology load (needs the UMLS key below)"))

    if umls_key_set:
        items.append(_item("umls_key", "UMLS API key", "ok", "Stored (encrypted) in settings"))
    else:
        items.append(_item("umls_key", "UMLS API key", "warn", "Not set; the terminology job cannot download UMLS", f"Settings → {UMLS_KEY_SETTING} (free key from uts.nlm.nih.gov)"))

    # --- infrastructure ------------------------------------------------------------
    redis = by_name.get("redis")
    if redis is not None and redis.status == "ok":
        items.append(_item("redis", "Redis", "ok", "Sessions and settings shared across backend workers"))
    elif redis is not None and redis.status == "absent":
        items.append(_item("redis", "Redis", "warn", "No REDIS_URL: sessions live in each worker, so a login on one worker is unknown to the others", "Start the redis service and set REDIS_URL"))
    else:
        items.append(_item("redis", "Redis", "fail", (redis.detail if redis else None) or "Redis unreachable", "docker compose logs redis"))

    host = by_name.get("host")
    if host is None or host.status == "absent":
        items.append(_item("control_plane", "Control plane", "warn", "Sidecar not configured: no container logs, restarts, host or certificate checks", "CONTROL_PLANE_TOKEN in .env, start the control-plane service"))
    elif host.status == "down":
        items.append(_item("control_plane", "Control plane", "fail", host.detail or "Sidecar unreachable", "docker compose logs control-plane"))
    else:
        items.append(_item("control_plane", "Control plane", "ok", "Sidecar reachable"))
        free = (host.data or {}).get("disk_free_percent")
        free_gb = (host.data or {}).get("disk_free_gb")
        if free is not None:
            where = f"{free_gb:.1f} GB ({free:.0f}%) free" if free_gb is not None else f"{free:.0f}% free"
            if free < 10:
                items.append(_item("disk", "Disk space", "fail", where, "Prune old DICOM / terminology_work / docker image prune"))
            elif free < 20:
                items.append(_item("disk", "Disk space", "warn", where, "Watch it: DICOM and terminology downloads need several GB"))
            else:
                items.append(_item("disk", "Disk space", "ok", where))

    tls = by_name.get("tls")
    if not prod:
        items.append(_item("tls", "HTTPS", "skip", "Dev profile serves plain HTTP on purpose"))
    elif tls is None or tls.status == "absent":
        items.append(_item("tls", "HTTPS", "warn", "No certificate: the site is served over plain HTTP", "deploy/init-ssl.sh with a public DNS name (docs/DEPLOYMENT.md)"))
    elif tls.status == "ok":
        items.append(_item("tls", "HTTPS", "ok", tls.detail or "Certificate valid"))
    elif tls.status == "degraded":
        items.append(_item("tls", "HTTPS", "warn", tls.detail or "Certificate needs attention", "docker compose logs certbot"))
    else:
        items.append(_item("tls", "HTTPS", "fail", tls.detail or "Certificate problem", "docker compose logs certbot; deploy/init-ssl.sh"))

    vna = by_name.get("vna")
    if vna is None or vna.status == "absent":
        items.append(_item("vna", "Imaging", "info", "No VNA: the Imaging tab has no studies to show", "Enable the dicom profile, then Jobs → DICOM generate"))
    elif vna.status == "ok":
        items.append(_item("vna", "Imaging", "ok", "VNA reachable"))
    else:
        items.append(_item("vna", "Imaging", "warn", vna.detail or "VNA not reachable", "docker compose logs arc"))

    return items
