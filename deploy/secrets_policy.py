"""Secret and security-setting checks for a WintEHR deployment.

Shared by ``deploy/validate_config.py`` (the pre-deploy gate) and
``deploy/config_loader.py`` (the YAML loader). Deliberately free of
third-party imports so it can be unit-tested from the backend suite and
imported before any dependencies are installed.

What "production" means here: the ``prod`` compose profile that
``deploy.sh`` uses, or ``production`` from ``config.yaml``. Errors block a
prod deploy; warnings never do. In dev everything is a warning except a
missing database password.
"""

from __future__ import annotations

import os
from typing import Dict, List, Mapping, Optional, Tuple

PROD_ENVIRONMENTS = {"prod", "production"}

# Values that ship in .env.example / docker-compose.yml defaults / older docs.
# Any of these in a prod .env means the operator never set a real secret.
EXAMPLE_VALUES: Dict[str, set] = {
    "POSTGRES_PASSWORD": {
        "emr_password",
        "CHANGE_ME_TO_SECURE_PASSWORD",
    },
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


def is_production(environment: Optional[str]) -> bool:
    return (environment or "").strip().lower() in PROD_ENVIRONMENTS


def jwt_secret(env: Optional[Mapping[str, str]] = None) -> str:
    """The JWT signing key as the backend resolves it.

    ``JWT_SECRET_KEY`` is canonical; ``JWT_SECRET`` is the historical name
    that ``backend/api/auth/config.py`` and ``docker-compose.yml`` still
    accept as a fallback.
    """
    env = os.environ if env is None else env
    return env.get("JWT_SECRET_KEY") or env.get("JWT_SECRET") or ""


def _truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() == "true"


def check_secrets(
    environment: Optional[str],
    env: Optional[Mapping[str, str]] = None,
) -> Tuple[List[str], List[str]]:
    """Return ``(errors, warnings)`` for the secrets and security switches.

    ``environment`` is the deploy profile (``dev`` / ``prod`` / ...).
    ``env`` defaults to ``os.environ``; tests pass a dict.
    """
    env = os.environ if env is None else env
    prod = is_production(environment)
    errors: List[str] = []
    warnings: List[str] = []

    def problem(msg: str, fatal_in_prod: bool = True) -> None:
        (errors if (prod and fatal_in_prod) else warnings).append(msg)

    # --- PostgreSQL --------------------------------------------------------
    pg = env.get("POSTGRES_PASSWORD", "")
    if not pg:
        errors.append("POSTGRES_PASSWORD is not set")
    elif pg in EXAMPLE_VALUES["POSTGRES_PASSWORD"]:
        problem(
            f"POSTGRES_PASSWORD is the example value ({pg!r}) — "
            "generate one with: openssl rand -base64 32"
        )
    elif len(pg) < MIN_PASSWORD_LEN:
        warnings.append(
            f"POSTGRES_PASSWORD is weak (length: {len(pg)}, recommended: {MIN_PASSWORD_LEN}+)"
        )

    # --- JWT signing key ---------------------------------------------------
    key_a = env.get("JWT_SECRET_KEY", "")
    key_b = env.get("JWT_SECRET", "")
    if key_a and key_b and key_a != key_b:
        warnings.append(
            "JWT_SECRET_KEY and JWT_SECRET are both set with different values; "
            "the backend uses JWT_SECRET_KEY — drop JWT_SECRET to avoid confusion"
        )
    jwt = jwt_secret(env)
    if not jwt:
        problem(
            "JWT_SECRET_KEY is not set (JWT_SECRET also accepted) — the backend "
            "will sign tokens with its hard-coded default; generate one with: "
            "openssl rand -hex 32"
        )
    elif jwt in EXAMPLE_VALUES["JWT"]:
        problem(
            f"JWT_SECRET_KEY is the example value ({jwt!r}) — "
            "generate one with: openssl rand -hex 32"
        )
    elif len(jwt) < MIN_JWT_LEN:
        warnings.append(
            f"JWT_SECRET_KEY is weak (length: {len(jwt)}, recommended: {MIN_JWT_LEN}+)"
        )

    # --- HAPI overlay admin token -----------------------------------------
    if not env.get("HAPI_ADMIN_TOKEN"):
        warnings.append(
            "HAPI_ADMIN_TOKEN is not set — the HAPI overlay's /admin/cr/* endpoints "
            "refuse every call, so CDS Studio cannot flush CQL caches after "
            "ValueSet edits; generate one with: openssl rand -hex 32"
        )

    # --- Production-only posture warnings ---------------------------------
    # Never fatal: a public classroom demo legitimately runs this way.
    if prod:
        if not _truthy(env.get("JWT_ENABLED")):
            warnings.append(
                "JWT_ENABLED is not true — prod profile is running training-mode "
                "auth (shared demo password, no SMART write gate)"
            )
        if not env.get("CORS_ORIGINS"):
            warnings.append(
                "CORS_ORIGINS is empty — backend CORS allows every origin (*)"
            )
        if not env.get("EXTERNAL_SERVICES_URL_ALLOWLIST"):
            warnings.append(
                "EXTERNAL_SERVICES_URL_ALLOWLIST is empty — external CDS/webhook "
                "registration accepts any URL (server-side fetch; SSRF exposure)"
            )
        if _truthy(env.get("JWT_ENABLED")) and (
            env.get("SMART_ALLOW_UNPROTECTED", "true").strip().lower() != "false"
        ):
            warnings.append(
                "SMART_ALLOW_UNPROTECTED is not false — FHIR reads need no token "
                "even though JWT is enabled"
            )

    return errors, warnings
