"""The jobs the Command Center can run — defined in code, like settings.

A JobKind says how to validate its parameters, which command to run, and
how to read progress out of the command's output. The runner
(jobs_service.py) is generic: it knows nothing about Synthea.

Commands are argv lists, never shell strings, and parameters are validated
before they reach argv — a job kind is an allow-list, not a shell.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
    "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
    "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
]


class JobParamError(ValueError):
    """Parameters do not fit the kind."""


@dataclass
class ProgressUpdate:
    progress: Optional[float] = None  # 0..1
    message: Optional[str] = None


class ProgressParser:
    """Stateful line reader; subclasses turn output lines into progress."""

    def feed(self, line: str) -> Optional[ProgressUpdate]:  # pragma: no cover - interface
        return None


class SyntheaProgress(ProgressParser):
    """Reads synthea_to_hapi_pipeline.py output.

    Phase 1 (java generation) is silent until it finishes, so it is a fixed
    slice; phase 2 prints one '  ✓'/'  ✗' line per bundle after
    'Found N bundle files', which gives real per-bundle progress.
    """

    _FOUND = re.compile(r"Found (\d+) bundle files")
    _BUNDLE = re.compile(r"^\s+[✓✗] ")

    def __init__(self):
        self.total = 0
        self.done = 0

    def feed(self, line: str) -> Optional[ProgressUpdate]:
        if "STEP 1" in line:
            return ProgressUpdate(0.02, "Generating patients with Synthea")
        if "Synthea data generated" in line:
            return ProgressUpdate(0.30, "Patients generated; loading bundles into HAPI")
        m = self._FOUND.search(line)
        if m:
            self.total = int(m.group(1))
            return ProgressUpdate(0.30, f"Loading {self.total} bundles")
        if self._BUNDLE.match(line) and self.total:
            self.done += 1
            return ProgressUpdate(0.30 + 0.65 * min(self.done, self.total) / self.total,
                                  f"Loaded {self.done}/{self.total} bundles")
        if "STEP 3" in line:
            return ProgressUpdate(0.96, "Verifying resource counts")
        if "PIPELINE COMPLETE" in line:
            return ProgressUpdate(1.0, "Complete")
        if line.startswith("✗ Pipeline failed"):
            return ProgressUpdate(None, line.strip())
        return None


class StepProgress(ProgressParser):
    """Reads `STEP i/N: label` lines (the orchestrator scripts' convention).

    Progress is (i-1)/N when a step starts; `DONE` is 1.0; a line starting
    with ✗ becomes the message so a failed job says why.
    """

    _STEP = re.compile(r"^STEP (\d+)/(\d+): (.+)$")

    def feed(self, line: str) -> Optional[ProgressUpdate]:
        m = self._STEP.match(line.strip())
        if m:
            i, n, label = int(m.group(1)), int(m.group(2)), m.group(3)
            return ProgressUpdate((i - 1) / n if n else None, f"Step {i}/{n}: {label}")
        if line.startswith("DONE"):
            return ProgressUpdate(1.0, line.partition(":")[2].strip() or "Complete")
        if line.startswith("✗"):
            return ProgressUpdate(None, line.strip())
        return None


@dataclass(frozen=True)
class JobKind:
    key: str
    label: str
    description: str
    validate: Callable[[Dict[str, Any]], Dict[str, Any]]  # raw params → clean params (raises JobParamError)
    command: Callable[[Dict[str, Any]], List[str]]        # clean params → argv
    progress: Callable[[], ProgressParser]
    cwd: str = "/app"
    # Set when the job adds patients: (clean params) → number of patients it adds,
    # checked against system.patient_count_cap before starting.
    patients_added: Optional[Callable[[Dict[str, Any]], int]] = None
    param_schema: Dict[str, Any] = field(default_factory=dict)
    # Environment variables the subprocess gets from settings: {ENV_VAR: setting key}.
    # Secrets are decrypted by the settings service and never written to the job log.
    secret_env: Dict[str, str] = field(default_factory=dict)
    # Shown to the admin before starting (prerequisites, duration, licensing).
    notes: str = ""


def _validate_synthea(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        count = int(params.get("count", 10))
    except (TypeError, ValueError):
        raise JobParamError("count must be an integer") from None
    if not 1 <= count <= 1000:
        raise JobParamError("count must be between 1 and 1000 per job")
    state = str(params.get("state", "Massachusetts")).strip()
    if state not in US_STATES:
        raise JobParamError(f"state must be one of the US states Synthea knows (got {state!r})")
    return {"count": count, "state": state}


SYNTHEA_LOAD = JobKind(
    key="synthea_load",
    label="Load Synthea patients",
    description="Generate synthetic patients with Synthea and load them into HAPI FHIR "
                "(the same pipeline deploy.sh runs).",
    validate=_validate_synthea,
    command=lambda p: ["python", "-u", "/app/scripts/synthea_to_hapi_pipeline.py", str(p["count"]), p["state"]],
    progress=SyntheaProgress,
    patients_added=lambda p: p["count"],
    param_schema={
        "count": {"type": "int", "label": "Patients to add", "default": 10, "min": 1, "max": 1000},
        "state": {"type": "enum", "label": "US state", "default": "Massachusetts", "options": US_STATES},
    },
)

def _bool(params: Dict[str, Any], key: str, default: bool) -> bool:
    raw = params.get(key, default)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str) and raw.strip().lower() in ("true", "false", "1", "0", "yes", "no", "on", "off"):
        return raw.strip().lower() in ("true", "1", "yes", "on")
    raise JobParamError(f"{key} must be true or false")


def _int(params: Dict[str, Any], key: str, default: int, lo: int, hi: int) -> int:
    raw = params.get(key, default)
    if raw in ("", None):
        raw = default
    try:
        if isinstance(raw, bool):
            raise ValueError
        value = int(raw)
    except (TypeError, ValueError):
        raise JobParamError(f"{key} must be an integer") from None
    if not lo <= value <= hi:
        raise JobParamError(f"{key} must be between {lo} and {hi}")
    return value


def _validate_terminology(params: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "skip_download": _bool(params, "skip_download", False),
        "include_snomed": _bool(params, "include_snomed", False),
        "load_into_hapi": _bool(params, "load_into_hapi", True),
        "max_per_vocab": _int(params, "max_per_vocab", 0, 0, 1_000_000),
    }


def _terminology_command(p: Dict[str, Any]) -> List[str]:
    argv = ["python", "-u", "/app/scripts/terminology/run_pipeline.py"]
    if p["skip_download"]:
        argv.append("--skip-download")
    if p["include_snomed"]:
        argv.append("--include-snomed")
    if not p["load_into_hapi"]:
        argv.append("--skip-hapi-load")
    if p["max_per_vocab"]:
        argv += ["--max-per-vocab", str(p["max_per_vocab"])]
    return argv


TERMINOLOGY_LOAD = JobKind(
    key="terminology_load",
    label="Load terminology (UMLS)",
    description="Download UMLS MRCONSO, extract RxNorm / ICD-10-CM / LOINC / CVX / HCPCS / ATC, "
                "build the catalog search index, and load CodeSystems and ValueSets into HAPI.",
    validate=_validate_terminology,
    command=_terminology_command,
    progress=StepProgress,
    secret_env={"UMLS_API_KEY": "system.umls_api_key"},
    notes="Needs the UMLS API key setting and about 12 GB free disk; a full run takes 1–3 hours. "
          "Catalog search switches to the new index as soon as it is built, with no restart. "
          "SNOMED is opt-in and requires a licence for redistribution (docs/TERMINOLOGY_SETUP.md).",
    param_schema={
        "skip_download": {"type": "bool", "label": "Reuse an already downloaded MRCONSO", "default": False},
        "include_snomed": {"type": "bool", "label": "Include SNOMED CT (licensed deployments only)", "default": False},
        "load_into_hapi": {"type": "bool", "label": "Also load CodeSystems/ValueSets into HAPI", "default": True},
        "max_per_vocab": {"type": "int", "label": "Limit concepts per vocabulary (0 = all; for testing)", "default": 0, "min": 0, "max": 1000000},
    },
)


def _validate_dicom(params: Dict[str, Any]) -> Dict[str, Any]:
    return {"max_studies": _int(params, "max_studies", 0, 0, 100000)}


def _dicom_command(p: Dict[str, Any]) -> List[str]:
    argv = ["python", "-u", "/app/scripts/active/run_imaging_pipeline.py"]
    if p["max_studies"]:
        argv += ["--max-studies", str(p["max_studies"])]
    return argv


DICOM_GENERATE = JobKind(
    key="dicom_generate",
    label="Generate and store DICOM images",
    description="Generate DICOM series for the ImagingStudy resources in HAPI, store them in the "
                "dcm4chee VNA (STOW-RS), and link FHIR Endpoints so the Imaging tab renders them.",
    validate=_validate_dicom,
    command=_dicom_command,
    progress=StepProgress,
    notes="Needs the dicom compose profile (DICOM_QIDO_URL set) and ImagingStudy resources already "
          "loaded. Studies that are already in the VNA are skipped.",
    param_schema={
        "max_studies": {"type": "int", "label": "Limit number of studies (0 = all)", "default": 0, "min": 0, "max": 100000},
    },
)

KINDS: Dict[str, JobKind] = {k.key: k for k in [SYNTHEA_LOAD, TERMINOLOGY_LOAD, DICOM_GENERATE]}


def get_kind(key: str) -> JobKind:
    try:
        return KINDS[key]
    except KeyError:
        raise KeyError(f"Unknown job kind '{key}'") from None
