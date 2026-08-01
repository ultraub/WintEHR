#!/usr/bin/env python3
"""
Scaffold a new WintEHR clinical module (docs/MODULES.md).

    python3 scripts/new-module.py referrals "Referrals"

Generates the module skeleton on both sides of the stack:

    backend/api/<key>/            models.py, service.py, router.py, __init__.py
    backend/tests/api/<key>/      test_<key>_service.py, __init__.py
    frontend/src/modules/<key>/   index.js (manifest), <Pascal>Tab.jsx

then prints the three registration edits that wire it in. Registration is
deliberately explicit (not auto-discovered) — see docs/MODULES.md for why.

The generated code follows the platform patterns: full /api/... prefix in
the router file, service with an injected HAPI client, thin Depends()
stubs, tab manifest with a lazy chunk. Delete what a given module doesn't
need — a backend-only module has no frontend dir and vice versa.
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def pascal(key: str) -> str:
    return "".join(part.capitalize() for part in re.split(r"[-_]", key))


def write(path: Path, content: str) -> None:
    if path.exists():
        print(f"  SKIP (exists): {path.relative_to(REPO)}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"  wrote: {path.relative_to(REPO)}")


def main() -> None:
    argv = [a for a in sys.argv[1:] if a != "--standalone"]
    standalone = "--standalone" in sys.argv
    if len(argv) < 2:
        print(__doc__)
        print("\nAdd --standalone to scaffold an EXTERNAL module repo layout")
        print("(module.json + frontend/ + backend/) in ./wintehr-module-<key>/,")
        print("composable via wintehr.modules.json + scripts/sync-modules.py.")
        sys.exit(1)
    key, label = argv[0], argv[1]
    if not re.fullmatch(r"[a-z][a-z0-9-]*", key):
        sys.exit(f"module key must be kebab-case, got: {key!r}")
    pkg = key.replace("-", "_")
    cls = pascal(key)

    if standalone:
        repo_dir = Path.cwd() / f"wintehr-module-{key}"
        be = repo_dir / "backend"
        te = None  # tests ride inside backend/ for standalone modules
        fe = repo_dir / "frontend"
        print(f"Scaffolding STANDALONE module repo '{key}' ({label}) at {repo_dir}:")
        write(repo_dir / "module.json", json.dumps({
            "key": key,
            "label": label,
            "backendTarget": f"api/{pkg}",
            "routers": [{"name": label, "module": "router",
                         "attr": "router", "tags": [label]}],
        }, indent=2) + "\n")
        write(repo_dir / "README.md", f"""# wintehr-module-{key}

A WintEHR clinical module ({label}). Compose into a WintEHR deployment by
adding to its wintehr.modules.json and running scripts/sync-modules.py —
see docs/MODULES.md in the WintEHR repo.

Frontend code imports platform APIs from '../sdk' ONLY (the module SDK);
after vendoring, that path resolves to src/modules/sdk.js in the host.
""")
    else:
        be = REPO / "backend" / "api" / pkg
        te = REPO / "backend" / "tests" / "api" / pkg
        fe = REPO / "frontend" / "src" / "modules" / key
        print(f"Scaffolding module '{key}' ({label}):")

    write(be / "__init__.py", "")
    write(be / "models.py", f'''"""{label} request/response models."""

from typing import Optional

from pydantic import BaseModel


class ExampleResponse(BaseModel):
    message: str
    detail: Optional[str] = None
''')
    write(be / "service.py", f'''"""{label} business logic.

Module of the pluggable-module platform (docs/MODULES.md). Services take
an injected HAPI client; FHIR data lives in HAPI, never in custom tables.
"""

from __future__ import annotations

import logging
from typing import Optional

from services.hapi_fhir_client import HAPIFHIRClient

from .models import ExampleResponse

logger = logging.getLogger(__name__)


class {cls}Service:
    """{label} operations over HAPI FHIR (one injected client)."""

    def __init__(self, hapi_client: Optional[HAPIFHIRClient] = None):
        self.hapi = hapi_client or HAPIFHIRClient()

    async def example(self) -> ExampleResponse:
        return ExampleResponse(message="{label} module is alive")


def get_{pkg}_service() -> {cls}Service:
    """FastAPI dependency — one service per request."""
    return {cls}Service()
''')
    write(be / "router.py", f'''"""{label} HTTP surface — thin stubs over {cls}Service.

Registers via MODULE_ROUTERS in api/routers/__init__.py; disable per
deployment with WINTEHR_DISABLED_MODULES={key}.
"""

from fastapi import APIRouter, Depends

from .models import ExampleResponse
from .service import {cls}Service, get_{pkg}_service

router = APIRouter(prefix="/api/{key}", tags=["{label}"])


@router.get("/example", response_model=ExampleResponse)
async def example(service: {cls}Service = Depends(get_{pkg}_service)):
    return await service.example()
''')
    if te is None:
        te = be / "tests"
    write(te / "__init__.py", "")
    write(te / f"test_{pkg}_service.py", f'''"""{cls}Service tests — inject a fake HAPI client, no patch()."""

from unittest.mock import AsyncMock

import pytest

from api.{pkg}.service import {cls}Service


@pytest.mark.asyncio
async def test_example():
    svc = {cls}Service(hapi_client=AsyncMock())
    result = await svc.example()
    assert result.message
''')
    write(fe / "index.js", f'''/**
 * {label} module manifest (docs/MODULES.md). The module key matches the
 * backend MODULE_ROUTERS key so one name disables both halves.
 */

import {{ Extension as {cls}Icon }} from '@mui/icons-material';
import {{ categoricalAccents }} from '../../themes/categoricalAccents';

const {pkg}Module = {{
  id: '{key}',
  tabs: [
    {{
      id: '{key}',
      label: '{label}',
      icon: {cls}Icon,
      color: categoricalAccents.{pkg} || categoricalAccents.flowsheet,
      description: '{label} module',
      loader: () => import(/* webpackChunkName: "module-{key}" */ './{cls}Tab'),
    }},
  ],
}};

export default {pkg}Module;
''')
    write(fe / f"{cls}Tab.jsx", f'''/**
 * {cls}Tab — {label} workspace tab (module '{key}').
 *
 * Handle all four states: loading, error, empty, success.
 */

import React from 'react';
import {{ Alert, Box, Typography }} from '@mui/material';

const {cls}Tab = ({{ patientId, currentPatient }}) => {{
  const effectivePatientId = patientId || currentPatient?.id;

  if (!effectivePatientId) {{
    return <Alert severity="info" sx={{{{ m: 2 }}}}>Pick a patient.</Alert>;
  }}

  return (
    <Box sx={{{{ p: 2 }}}}>
      <Typography variant="h6">{label}</Typography>
      <Typography variant="body2" color="text.secondary">
        Module scaffold — build the real surface here.
      </Typography>
    </Box>
  );
}};

export default {cls}Tab;
''')

    if standalone:
        print(f"""
Standalone module scaffolded. Develop it as its own repo, then compose it
into a WintEHR deployment:

    wintehr.modules.json:
        {{ "key": "{key}", "source": "git+<your-repo-url>@<ref>" }}
        (or a local path while developing)

    python3 scripts/sync-modules.py   # vendors + regenerates registries

Frontend imports must come from '../sdk' — the lint boundary enforces
this after vendoring.""")
        return

    print(f"""
Now wire it in (three explicit edits — see docs/MODULES.md):

1. backend/api/routers/__init__.py — add to MODULE_ROUTERS:
       "{key}": [
           ("{label}", "api.{pkg}.router", "router", {{"tags": ["{label}"]}}),
       ],

2. frontend/src/modules/index.js — import and list the manifest:
       import {pkg} from './{key}';
       const ALL_MODULES = [..., {pkg}];

3. frontend/src/themes/categoricalAccents.js — give the module its own hue
   (key: {pkg}) in the pluggable-module section.

Then: backend pytest + frontend npm test, and add the module to
docs/MODULES.md's inventory table.""")


if __name__ == "__main__":
    main()
