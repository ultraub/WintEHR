#!/usr/bin/env python3
"""run_imaging_pipeline.py — generate → STOW → endpoints as one job.

    generate_dicom_from_hapi.py   DICOM series for each ImagingStudy in HAPI → /app/data/generated_dicoms/
    stow_dicom_to_dcm4chee.py     STOW-RS them into the dcm4chee VNA (what makes images render)
    create_dicom_endpoints.py     FHIR Endpoints linking ImagingStudy → viewer

The same three steps `deploy.sh` runs, with `STEP i/3: ...` progress lines
for the Command Center job runner (`dicom_generate`). Exit codes: 0 ok;
2 preflight failed (nothing started); otherwise the failing step's code.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

HERE = Path(__file__).resolve().parent


def _print(msg: str) -> None:
    print(msg, flush=True)


def plan(args: argparse.Namespace) -> List[dict]:
    py = sys.executable
    limit = ["--max-studies", str(args.max_studies)] if args.max_studies else []
    return [
        {"label": "Generate DICOM files from ImagingStudy resources",
         "argv": [py, "-u", str(HERE / "generate_dicom_from_hapi.py"), "--dicom-dir", args.dicom_dir, *limit]},
        {"label": "Store DICOM in the dcm4chee VNA (STOW-RS)",
         "argv": [py, "-u", str(HERE / "stow_dicom_to_dcm4chee.py"), "--dicom-dir", args.dicom_dir, *limit]},
        {"label": "Create FHIR Endpoints for the viewer",
         "argv": [py, "-u", str(HERE / "create_dicom_endpoints.py"), "--dicom-dir", args.dicom_dir]},
    ]


def preflight(args: argparse.Namespace) -> Optional[str]:
    if not os.getenv("DICOM_QIDO_URL"):
        return ("DICOM_QIDO_URL is not set: this deployment has no dcm4chee VNA (dicom compose "
                "profile). Generated files would never render, so nothing was started.")
    try:
        import pydicom  # noqa: F401
    except ImportError:
        return "pydicom is not installed in the backend image"
    return None


def run(args: argparse.Namespace) -> int:
    problem = preflight(args)
    if problem:
        _print(f"✗ Preflight failed: {problem}")
        return 2
    steps = plan(args)
    for i, step in enumerate(steps, 1):
        _print(f"STEP {i}/{len(steps)}: {step['label']}")
        _print("  $ " + " ".join(step["argv"]))
        result = subprocess.run(step["argv"], env={**os.environ, "PYTHONUNBUFFERED": "1"})
        if result.returncode != 0:
            _print(f"✗ Step {i} failed with exit code {result.returncode}")
            return result.returncode
    _print("DONE: imaging pipeline complete")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--max-studies", type=int, default=0, help="Limit studies (0 = all)")
    parser.add_argument("--dicom-dir", default="/app/data/generated_dicoms")
    return run(parser.parse_args())


if __name__ == "__main__":
    sys.exit(main())
