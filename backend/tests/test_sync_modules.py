"""
scripts/sync-modules.py tests (module platform Phase 3, docs/MODULES.md).

Runs the real script (subprocess, --root against a temp tree skeleton) and
pins the composition contract: an external standalone module vendors into
the right places, both generated registries derive from the composition
file, key mismatches fail loudly, and --reset restores the defaults.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "sync-modules.py"


def make_tree(tmp: Path) -> Path:
    root = tmp / "tree"
    (root / "frontend/src/modules").mkdir(parents=True)
    (root / "backend/api/routers").mkdir(parents=True)
    (root / "frontend/src/modules/registry.generated.js").write_text("placeholder")
    (root / "backend/api/routers/modules_generated.py").write_text("placeholder")
    # a builtin module dir so "builtin" entries can be verified
    (root / "frontend/src/modules/flowsheets").mkdir()
    return root


def make_external(tmp: Path, key: str = "referrals") -> Path:
    src = tmp / f"wintehr-module-{key}"
    (src / "frontend").mkdir(parents=True)
    (src / "backend").mkdir()
    (src / "module.json").write_text(json.dumps({
        "key": key,
        "label": "Referrals",
        "backendTarget": "api/referrals",
        "routers": [{"name": "Referrals", "module": "router",
                     "attr": "router", "tags": ["Referrals"]}],
    }))
    (src / "frontend/index.js").write_text("export default { id: 'referrals' };\n")
    (src / "backend/router.py").write_text("router = None\n")
    return src


def run_sync(root: Path, config: Path | None = None, reset: bool = False):
    cmd = [sys.executable, str(SCRIPT), "--root", str(root)]
    if config:
        cmd += ["--config", str(config)]
    if reset:
        cmd += ["--reset"]
    return subprocess.run(cmd, capture_output=True, text=True)


def test_compose_vendors_and_regenerates_registries(tmp_path):
    root = make_tree(tmp_path)
    src = make_external(tmp_path)
    config = tmp_path / "wintehr.modules.json"
    config.write_text(json.dumps({"modules": [
        {"key": "flowsheets", "source": "builtin"},
        {"key": "referrals", "source": str(src)},
    ]}))

    result = run_sync(root, config)
    assert result.returncode == 0, result.stderr

    # Vendored into the composition targets
    assert (root / "frontend/src/modules/referrals/index.js").is_file()
    assert (root / "backend/api/referrals/router.py").is_file()

    # Registries derive from the composition
    fe = (root / "frontend/src/modules/registry.generated.js").read_text()
    assert "import referrals from './referrals';" in fe
    assert "referrals," in fe
    be = (root / "backend/api/routers/modules_generated.py").read_text()
    assert "'referrals':" in be
    assert "'api.referrals.router'" in be
    assert "GENERATED" in fe and "GENERATED" in be


def test_key_mismatch_between_entry_and_module_json_fails_loudly(tmp_path):
    root = make_tree(tmp_path)
    src = make_external(tmp_path, key="referrals")
    config = tmp_path / "wintehr.modules.json"
    config.write_text(json.dumps({"modules": [
        {"key": "not-referrals", "source": str(src)},
    ]}))
    result = run_sync(root, config)
    assert result.returncode != 0
    assert "must agree" in result.stderr


def test_missing_builtin_fails_loudly(tmp_path):
    root = make_tree(tmp_path)
    config = tmp_path / "wintehr.modules.json"
    config.write_text(json.dumps({"modules": [
        {"key": "nonexistent", "source": "builtin"},
    ]}))
    result = run_sync(root, config)
    assert result.returncode != 0
    assert "not found" in result.stderr


def test_reset_restores_empty_defaults(tmp_path):
    root = make_tree(tmp_path)
    result = run_sync(root, reset=True)
    assert result.returncode == 0, result.stderr
    fe = (root / "frontend/src/modules/registry.generated.js").read_text()
    assert "EXTERNAL_MODULES = []" in fe
    be = (root / "backend/api/routers/modules_generated.py").read_text()
    assert "EXTERNAL_MODULE_ROUTERS: dict = {}" in be


def test_illegal_backend_target_is_rejected(tmp_path):
    root = make_tree(tmp_path)
    src = make_external(tmp_path)
    meta = json.loads((src / "module.json").read_text())
    meta["backendTarget"] = "../outside"
    (src / "module.json").write_text(json.dumps(meta))
    config = tmp_path / "wintehr.modules.json"
    config.write_text(json.dumps({"modules": [{"key": "referrals", "source": str(src)}]}))
    result = run_sync(root, config)
    assert result.returncode != 0
    assert "illegal backendTarget" in result.stderr
