#!/usr/bin/env python3
"""run_pipeline.py — the whole terminology chain as one job, inside the backend.

    download_umls.py  →  extract_vocabularies.py  →  build_terminology_index.py  →  load_terminology.py
    (UMLS MRCONSO)        (per-vocabulary JSON)       (SQLite the catalogs read)      (CodeSystems/ValueSets into HAPI)

Written for the Command Center job runner (api/command_center/jobs_registry.py:
`terminology_load`), but it is a plain script: `deploy.sh` and operators can
call it the same way. Progress lines are `STEP i/N: ...` so the runner can
show a bar; everything else is the underlying scripts' own output.

The search index is built to a temp file and renamed into place, and the
backend's terminology service re-opens the index when the file changes, so
catalog search switches over without a restart.

Needs: UMLS_API_KEY in the environment (the job runner injects it from the
`system.umls_api_key` setting) unless --skip-download with an existing
MRCONSO; ~12 GB free under --work-dir for the download + extract.

Exit codes: 0 ok; 2 preflight failed (nothing started); otherwise the failing
step's exit code.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

HERE = Path(__file__).resolve().parent
INDEX_BUILDER = HERE.parent / "active" / "build_terminology_index.py"
REQUIRED_FREE_GB = 12


def _print(msg: str) -> None:
    print(msg, flush=True)


def plan(args: argparse.Namespace) -> List[dict]:
    """The steps this invocation will run, as {label, argv, skip_reason}."""
    work = Path(args.work_dir)
    umls = work / "umls_source"
    vocab = work / "fhir_vocabularies"
    steps: List[dict] = []

    download_skip = None
    if args.skip_download:
        download_skip = "skipped (--skip-download)" if (umls / "MRCONSO.RRF").exists() else None
        if download_skip is None:
            download_skip = "ERROR: --skip-download but no MRCONSO.RRF under " + str(umls)
    download = [sys.executable, "-u", str(HERE / "download_umls.py"), str(umls)]
    if args.release:
        download += ["--release", args.release]
    steps.append({"label": "Download UMLS MRCONSO (~2 GB)", "argv": download, "skip_reason": download_skip})

    extract = [sys.executable, "-u", str(HERE / "extract_vocabularies.py"), str(umls), str(vocab)]
    if args.include_snomed:
        extract.append("--include-snomed")
    if args.max_per_vocab:
        extract += ["--max-per-vocab", str(args.max_per_vocab)]
    steps.append({"label": "Extract vocabularies to JSON", "argv": extract, "skip_reason": None})

    tmp_index = Path(str(args.index_output) + ".building")
    steps.append({
        "label": "Build catalog search index",
        "argv": [sys.executable, "-u", str(INDEX_BUILDER), "--json-dir", str(vocab / "terminology"),
                 "--ucum-json", str(HERE / "ucum.json"), "--output", str(tmp_index)],
        "skip_reason": None,
        "finalize": (tmp_index, Path(args.index_output)),
    })

    load = [sys.executable, "-u", str(HERE / "load_terminology.py"), str(vocab),
            "--hapi-url", args.hapi_url, "--timeout", str(args.timeout)]
    steps.append({"label": "Load CodeSystems and ValueSets into HAPI FHIR", "argv": load,
                  "skip_reason": "skipped (--skip-hapi-load)" if args.skip_hapi_load else None})
    return steps


def preflight(args: argparse.Namespace, steps: List[dict]) -> Optional[str]:
    """A reason not to start, or None."""
    for step in steps:
        if step["skip_reason"] and step["skip_reason"].startswith("ERROR"):
            return step["skip_reason"]
    if not INDEX_BUILDER.exists():
        return f"index builder missing: {INDEX_BUILDER}"
    downloading = steps[0]["skip_reason"] is None
    if downloading and not os.getenv("UMLS_API_KEY"):
        return ("UMLS_API_KEY is not set. Save the key as the Command Center setting "
                "'UMLS API key' (system.umls_api_key) or export UMLS_API_KEY.")
    work = Path(args.work_dir)
    work.mkdir(parents=True, exist_ok=True)
    if downloading:
        free_gb = shutil.disk_usage(work).free / 1e9
        if free_gb < REQUIRED_FREE_GB:
            return f"only {free_gb:.1f} GB free under {work}; the UMLS download + extract needs ~{REQUIRED_FREE_GB} GB"
    return None


def run(args: argparse.Namespace) -> int:
    steps = plan(args)
    problem = preflight(args, steps)
    if problem:
        _print(f"✗ Preflight failed: {problem}")
        return 2
    total = len(steps)
    for i, step in enumerate(steps, 1):
        _print(f"STEP {i}/{total}: {step['label']}")
        if step["skip_reason"]:
            _print(f"  {step['skip_reason']}")
            continue
        _print("  $ " + " ".join(step["argv"]))
        result = subprocess.run(step["argv"], env={**os.environ, "PYTHONUNBUFFERED": "1"})
        if result.returncode != 0:
            _print(f"✗ Step {i} failed with exit code {result.returncode}")
            return result.returncode
        finalize = step.get("finalize")
        if finalize:
            tmp, final = finalize
            os.replace(tmp, final)
            _print(f"  index installed at {final} ({final.stat().st_size / 1e6:.1f} MB); "
                   "catalog search picks it up on the next request")
    _print("DONE: terminology pipeline complete")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--work-dir", default=os.getenv("TERMINOLOGY_WORK_DIR", "/app/data/terminology_work"))
    parser.add_argument("--index-output", default=os.getenv("TERMINOLOGY_DB_PATH", "/app/data/terminology.db"))
    parser.add_argument("--hapi-url", default=os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir"))
    parser.add_argument("--timeout", type=int, default=600, help="HAPI upload timeout per request (s)")
    parser.add_argument("--release", default=None, help="Pin a UMLS release, e.g. 2024AA")
    parser.add_argument("--skip-download", action="store_true", help="Reuse an existing MRCONSO.RRF")
    parser.add_argument("--include-snomed", action="store_true", help="Licensed deployments only")
    parser.add_argument("--skip-hapi-load", action="store_true", help="Build the search index only")
    parser.add_argument("--max-per-vocab", type=int, default=0, help="Subset for testing (0 = all)")
    return run(parser.parse_args())


if __name__ == "__main__":
    sys.exit(main())
