"""
Centralized Router Registration

Single source of truth for the app's HTTP surface: every router is listed in
ROUTERS below and registered by register_all_routers(), one try/except per
router.

Why per-router isolation: this file used to wrap whole *groups* in one
try/except with all the imports at the top of the block — one bad import in
any of 12 clinical routers silently 404'd all 12 (the imports ran before any
include_router call). Now a failure disables exactly one router and is
recorded in FAILED_ROUTERS, which /api/health reports (main.py).

ORDER MATTERS and is preserved from the original group layout: FastAPI
matches routes in registration order, and several routers share namespaces
(e.g. two routers own bare `/api/clinical` paths above 8 nested
`/api/clinical/*` routers). Do not reorder entries without checking
docs/ARCHITECTURE_DEBT.md §F4 for the known shadowing hazards.
"""

import importlib
import logging
import os

from fastapi import FastAPI

logger = logging.getLogger(__name__)

# Routers whose registration failed at startup. Each entry is
# {"router": <human name>, "module": <dotted path>, "error": <message>}.
# Surfaced by GET /api/health (main.py). Reset on each register_all_routers
# call.
FAILED_ROUTERS = []

# (name, module path, attribute, include_router kwargs)
#
# Every router carries its FULL public prefix in its own APIRouter(prefix=...)
# — no prefix kwargs are passed here, so the router file alone tells the
# truth about its URLs. Exceptions that predate the convention and
# deliberately live outside /api: the FHIR proxy (/fhir/...) and SMART
# (/oauth, /.well-known). See backend/CLAUDE.md §Routing.
ROUTERS = [
    # -- Core FHIR APIs --------------------------------------------------
    ("HAPI FHIR proxy", "api.fhir.proxy", "router",
     {"tags": ["FHIR R4 (HAPI Proxy)"]}),
    ("FHIR relationships", "api.fhir.routers.relationships", "relationships_router",
     {"tags": ["FHIR Relationships"]}),
    ("FHIR search values", "api.fhir.search_values", "router",
     {"tags": ["FHIR Search Values"]}),

    # -- Authentication & Authorization ----------------------------------
    ("Authentication", "api.auth", "router", {"tags": ["Authentication"]}),
    ("SMART on FHIR", "api.smart.router", "router", {"tags": ["SMART on FHIR"]}),

    # -- Clinical Workflows ----------------------------------------------
    ("Clinical catalogs", "api.catalogs", "router", {"tags": ["Clinical Catalogs"]}),
    ("Clinical orders (CPOE)", "api.clinical.orders.orders_router", "router",
     {"tags": ["Clinical Orders (CPOE)"]}),
    ("Pharmacy", "api.clinical.pharmacy.pharmacy_router", "router",
     {"tags": ["Pharmacy Workflows"]}),
    ("Clinical results", "api.clinical.results.results_router", "router",
     {"tags": ["Clinical Results"]}),
    ("Critical values", "api.clinical.critical_values_router", "router",
     {"tags": ["Clinical Reference"]}),
    ("Medication lists", "api.clinical.medication_lists_router", "router",
     {"tags": ["Medication Lists"]}),
    ("Drug safety", "api.clinical.drug_safety_router", "router",
     {"tags": ["Drug Safety"]}),
    ("Clinical notes", "api.clinical.documentation.notes_router", "router",
     {"tags": ["Clinical Documentation"]}),
    ("Clinical tasks", "api.clinical.tasks.router", "router",
     {"tags": ["Clinical Tasks"]}),
    ("Clinical inbox", "api.clinical.inbox.router", "router",
     {"tags": ["Clinical Inbox"]}),
    ("CDS clinical data", "api.clinical.cds_clinical_data", "router",
     {"tags": ["CDS Clinical Data"]}),
    ("Clinical administration (MAR)", "api.clinical.administration.router", "router", {}),

    # -- Clinical Canvas ---------------------------------------------------
    ("Clinical Canvas", "clinical_canvas.router", "router",
     {"tags": ["Clinical Canvas"]}),

    # -- Integration Services ---------------------------------------------
    ("CDS Hooks", "api.cds_hooks.cds_hooks_router", "router",
     {"tags": ["CDS Hooks"]}),
    ("CDS visual builder", "api.cds_studio.visual_builder_router", "router",
     {"tags": ["CDS Visual Builder"]}),
    ("CDS value sets", "api.cds_studio.value_set_composer", "router",
     {"tags": ["CDS Studio — ValueSets"]}),
    ("UI Composer", "api.ui_composer", "router", {"tags": ["UI Composer"]}),
    ("WebSocket", "api.websocket.websocket_router", "router",
     {"tags": ["WebSocket"]}),
    ("WebSocket monitoring", "api.websocket.monitoring", "router",
     {"tags": ["WebSocket Monitoring"]}),
    ("FHIR schemas", "api.fhir.routers.schema", "router", {"tags": ["FHIR Schemas"]}),
    ("FHIR schemas v2", "api.fhir.routers.capability", "router",
     {"tags": ["FHIR Schemas V2"]}),
    ("External CDS services", "api.external_services.router", "router",
     {"tags": ["External Services"]}),
    ("CDS Studio", "api.cds_studio.router", "router",
     {"tags": ["CDS Management Studio"]}),

    # -- Quality & Analytics ----------------------------------------------
    ("Quality measures", "api.quality.router", "router", {"tags": ["Quality Measures"]}),
    ("Analytics", "api.analytics.router", "router", {"tags": ["Analytics"]}),

    # -- Scheduling / Questionnaires ---------------------------------------
    ("Scheduling", "api.scheduling.router", "router", {"tags": ["Scheduling"]}),
    ("Questionnaires", "api.questionnaires.router", "router",
     {"tags": ["Questionnaires"]}),

    # -- Imaging & DICOM ----------------------------------------------------
    ("DICOM", "api.dicom.router", "router", {"tags": ["DICOM Services"]}),
    ("Imaging studies", "api.imaging.router", "router", {"tags": ["Imaging Studies"]}),

    # -- Provider Directory --------------------------------------------------
    ("Provider directory", "api.clinical.provider_directory_router", "router",
     {"tags": ["Provider Directory"]}),

    # -- Monitoring -----------------------------------------------------------
    ("System monitoring", "api.system.monitoring", "monitoring_router",
     {"tags": ["Monitoring"]}),
]

# -- Pluggable clinical modules (docs/MODULES.md) --------------------------
#
# Same entry shape as ROUTERS, grouped under a module key. A key listed in
# the WINTEHR_DISABLED_MODULES env var (comma-separated) is skipped at
# registration — the deployment runs without that module, and /api/health
# reports it under routers.disabled_modules so a missing feature reads as
# "switched off", never as silent breakage. The frontend loader honors the
# same module keys via REACT_APP_DISABLED_MODULES.
MODULE_ROUTERS = {
    "flowsheets": [
        ("Flowsheets", "api.clinical.flowsheets.router", "router",
         {"tags": ["Flowsheets"]}),
    ],
}

# Module keys disabled by the current deployment. Reset on each
# register_all_routers call; surfaced by GET /api/health (main.py).
DISABLED_MODULES = []


def _disabled_module_keys() -> set:
    raw = os.getenv("WINTEHR_DISABLED_MODULES", "")
    return {key.strip() for key in raw.split(",") if key.strip()}


def register_all_routers(app: FastAPI) -> None:
    """Register every router in ROUTERS, isolating failures per router."""
    FAILED_ROUTERS.clear()
    DISABLED_MODULES.clear()

    def _register(name, module_path, attr, kwargs):
        try:
            module = importlib.import_module(module_path)
            router = getattr(module, attr)
            app.include_router(router, **kwargs)
            logger.info(f"✓ {name} router registered")
        except Exception as e:
            logger.error(f"Failed to register {name} router ({module_path}): {e}")
            FAILED_ROUTERS.append({
                "router": name,
                "module": module_path,
                "error": str(e),
            })

    for name, module_path, attr, kwargs in ROUTERS:
        _register(name, module_path, attr, kwargs)

    disabled = _disabled_module_keys()
    unknown = disabled - set(MODULE_ROUTERS)
    if unknown:
        # A typo'd module key would otherwise disable nothing and look like
        # it worked — name it loudly instead.
        logger.warning(
            "WINTEHR_DISABLED_MODULES names unknown module key(s): %s "
            "(known: %s)", sorted(unknown), sorted(MODULE_ROUTERS),
        )
    for module_key, entries in MODULE_ROUTERS.items():
        if module_key in disabled:
            DISABLED_MODULES.append(module_key)
            logger.info(f"○ Module '{module_key}' disabled by WINTEHR_DISABLED_MODULES")
            continue
        for name, module_path, attr, kwargs in entries:
            _register(name, module_path, attr, kwargs)

    # Debug tools — development only, opt-in via DEBUG=true
    if os.getenv("DEBUG", "false").lower() == "true":
        try:
            from api.system.debug_router import debug_router
            app.include_router(debug_router, tags=["Debug"])
            logger.info("✓ Debug router registered (DEBUG mode)")
        except Exception as e:
            logger.error(f"Failed to register debug router: {e}")
            FAILED_ROUTERS.append({
                "router": "Debug tools",
                "module": "api.system.debug_router",
                "error": str(e),
            })

    if FAILED_ROUTERS:
        logger.error(
            f"Router registration complete with {len(FAILED_ROUTERS)} FAILURE(S): "
            + ", ".join(f["router"] for f in FAILED_ROUTERS)
        )
    else:
        logger.info(f"Router registration complete: all {len(ROUTERS)} routers registered")
