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

KINDS: Dict[str, JobKind] = {k.key: k for k in [SYNTHEA_LOAD]}


def get_kind(key: str) -> JobKind:
    try:
        return KINDS[key]
    except KeyError:
        raise KeyError(f"Unknown job kind '{key}'") from None
