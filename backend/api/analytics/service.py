"""
Population analytics service.

Builds one consistent snapshot of the patient population from HAPI FHIR:
who the patients are, which conditions they have, and how many medications
they take. Every figure counts PATIENTS (not resources) and is a share of the
living population, so the numbers on the page can be compared with each
other.

`build_population_snapshot` is a pure function over plain FHIR dicts so it
can be tested without a FHIR server; `PopulationAnalyticsService` only does
the fetching.
"""

from __future__ import annotations

import logging
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from statistics import median
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlsplit

import httpx

from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)

# Ten-year bands; the last is open-ended.
AGE_BANDS: List[Tuple[str, int, Optional[int]]] = [
    ("0-9", 0, 9),
    ("10-19", 10, 19),
    ("20-29", 20, 29),
    ("30-39", 30, 39),
    ("40-49", 40, 49),
    ("50-59", 50, 59),
    ("60-69", 60, 69),
    ("70-79", 70, 79),
    ("80+", 80, None),
]
BAND_LABELS = [band[0] for band in AGE_BANDS]

# Active-medication buckets. Five or more is the usual polypharmacy line.
POLYPHARMACY_THRESHOLD = 5
BURDEN_BUCKETS: List[Tuple[str, int, Optional[int]]] = [
    ("0", 0, 0),
    ("1-2", 1, 2),
    ("3-4", 3, 4),
    ("5-9", 5, 9),
    ("10+", 10, None),
]

# SNOMED display names end with a semantic tag: "Stress (finding)".
_SEMANTIC_TAG = re.compile(r"\s*\(([a-z /]+)\)\s*$")
# Tags that describe circumstances rather than a diagnosis. Synthea records
# employment, education and housing as Conditions; they are worth showing,
# but not mixed into a list of diseases.
_CONTEXT_TAGS = {"finding", "situation", "person", "social concept", "event", "observable entity"}

PAGE_SIZE = 500
MAX_PAGES = 200  # 100,000 resources; far beyond a teaching dataset


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def age_on(birth: date, today: date) -> int:
    years = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        years -= 1
    return max(0, years)


def age_band(age: int) -> str:
    for label, low, high in AGE_BANDS:
        if high is None or age <= high:
            if age >= low:
                return label
    return AGE_BANDS[-1][0]


def burden_bucket(count: int) -> str:
    for label, low, high in BURDEN_BUCKETS:
        if count >= low and (high is None or count <= high):
            return label
    return BURDEN_BUCKETS[-1][0]


def split_condition_name(display: str) -> Tuple[str, str]:
    """'Essential hypertension (disorder)' -> ('Essential hypertension', 'diagnosis')."""
    match = _SEMANTIC_TAG.search(display or "")
    if not match:
        return (display or "Unknown").strip(), "diagnosis"
    name = display[: match.start()].strip()
    kind = "context" if match.group(1) in _CONTEXT_TAGS else "diagnosis"
    return name or display, kind


def _us_core_category(patient: Dict[str, Any], url_suffix: str) -> Optional[str]:
    """Read us-core-race / us-core-ethnicity: a nested extension, not a value."""
    for ext in patient.get("extension") or []:
        if not (ext.get("url") or "").endswith(url_suffix):
            continue
        text = None
        for inner in ext.get("extension") or []:
            if inner.get("url") == "ombCategory":
                display = (inner.get("valueCoding") or {}).get("display")
                if display:
                    return display
            elif inner.get("url") == "text":
                text = inner.get("valueString")
        return text
    return None


def _patient_id(reference: Optional[str]) -> Optional[str]:
    if not reference:
        return None
    return reference.replace("urn:uuid:", "").split("/")[-1] or None


def _is_deceased(patient: Dict[str, Any]) -> bool:
    return bool(patient.get("deceasedDateTime")) or patient.get("deceasedBoolean") is True


def _coding(concept: Optional[Dict[str, Any]]) -> Tuple[Optional[str], Optional[str]]:
    concept = concept or {}
    for coding in concept.get("coding") or []:
        if coding.get("code") or coding.get("display"):
            return coding.get("code"), coding.get("display") or concept.get("text")
    return None, concept.get("text")


def _ranked(counter: Counter, total: int, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    rows = sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    if limit is not None:
        rows = rows[:limit]
    return [
        {"label": label, "patients": count, "share": _share(count, total)}
        for label, count in rows
    ]


def _share(count: int, total: int) -> float:
    return round((count / total) * 100, 1) if total > 0 else 0.0


def build_population_snapshot(
    patients: Iterable[Dict[str, Any]],
    conditions: Iterable[Dict[str, Any]],
    medication_requests: Iterable[Dict[str, Any]],
    today: Optional[date] = None,
    condition_limit: int = 40,
    medication_limit: int = 15,
) -> Dict[str, Any]:
    today = today or datetime.now(timezone.utc).date()

    # ---- patients -------------------------------------------------------
    all_patients = list(patients)
    living: Dict[str, Dict[str, Any]] = {}
    deceased = 0
    for patient in all_patients:
        if _is_deceased(patient):
            deceased += 1
            continue
        pid = patient.get("id")
        if not pid:
            continue
        birth = _parse_date(patient.get("birthDate"))
        age = age_on(birth, today) if birth else None
        living[pid] = {
            "gender": (patient.get("gender") or "unknown").lower(),
            "age": age,
            "band": age_band(age) if age is not None else None,
            "race": _us_core_category(patient, "us-core-race") or "Not recorded",
            "ethnicity": _us_core_category(patient, "us-core-ethnicity") or "Not recorded",
        }
    total = len(living)

    gender_counts = Counter(p["gender"] for p in living.values())
    pyramid = {label: Counter() for label in BAND_LABELS}
    for person in living.values():
        if person["band"]:
            pyramid[person["band"]][person["gender"]] += 1
    ages = [p["age"] for p in living.values() if p["age"] is not None]

    # ---- conditions -----------------------------------------------------
    # code -> set of living patients; a patient with two records of the same
    # condition counts once.
    condition_patients: Dict[str, set] = defaultdict(set)
    condition_meta: Dict[str, Tuple[str, str]] = {}
    patient_diagnoses: Dict[str, set] = defaultdict(set)
    for condition in conditions:
        pid = _patient_id((condition.get("subject") or {}).get("reference"))
        if pid not in living:
            continue
        code, display = _coding(condition.get("code"))
        if not display:
            continue
        key = code or display
        name, kind = split_condition_name(display)
        condition_meta.setdefault(key, (name, kind))
        condition_patients[key].add(pid)
        if kind == "diagnosis":
            patient_diagnoses[pid].add(key)

    # ---- medications ----------------------------------------------------
    patient_meds: Dict[str, set] = defaultdict(set)
    med_patients: Dict[str, set] = defaultdict(set)
    active_orders = 0
    for request in medication_requests:
        pid = _patient_id((request.get("subject") or {}).get("reference"))
        if pid not in living:
            continue
        active_orders += 1
        code, display = _coding(request.get("medicationCodeableConcept"))
        if not display:
            display = (request.get("medicationReference") or {}).get("display")
        if not display:
            continue
        patient_meds[pid].add(code or display)
        med_patients[display].add(pid)

    med_count = {pid: len(patient_meds.get(pid, ())) for pid in living}
    burden = Counter(burden_bucket(count) for count in med_count.values())
    poly_patients = {pid for pid, count in med_count.items() if count >= POLYPHARMACY_THRESHOLD}
    band_totals = Counter(p["band"] for p in living.values() if p["band"])
    band_poly = Counter(living[pid]["band"] for pid in poly_patients if living[pid]["band"])

    # ---- per-condition cohorts -----------------------------------------
    ranked_conditions = sorted(
        condition_patients.items(),
        key=lambda item: (-len(item[1]), condition_meta[item[0]][0]),
    )
    # Keep the most common of each kind so neither crowds out the other.
    kept: List[Tuple[str, set]] = []
    per_kind = Counter()
    for key, members in ranked_conditions:
        kind = condition_meta[key][1]
        if per_kind[kind] < condition_limit:
            kept.append((key, members))
            per_kind[kind] += 1

    condition_items = []
    for key, members in kept:
        name, kind = condition_meta[key]
        size = len(members)
        bands = Counter(living[pid]["band"] for pid in members if living[pid]["band"])
        genders = Counter(living[pid]["gender"] for pid in members)
        member_ages = [living[pid]["age"] for pid in members if living[pid]["age"] is not None]

        together = Counter()
        for pid in members:
            for other in patient_diagnoses.get(pid, ()):
                if other != key:
                    together[condition_meta[other][0]] += 1
        cohort_meds = Counter()
        for display, takers in med_patients.items():
            overlap = len(takers & members)
            if overlap:
                cohort_meds[display] = overlap

        condition_items.append({
            "code": key,
            "name": name,
            "kind": kind,
            "patients": size,
            "share": _share(size, total),
            "median_age": round(median(member_ages)) if member_ages else None,
            "by_band": [
                {
                    "band": label,
                    "patients": bands.get(label, 0),
                    # share of everyone in that age band who has the condition
                    "share_of_band": _share(bands.get(label, 0), band_totals.get(label, 0)),
                }
                for label in BAND_LABELS
            ],
            "by_gender": [
                {"gender": gender, "patients": count, "share": _share(count, gender_counts.get(gender, 0))}
                for gender, count in sorted(genders.items())
            ],
            "seen_with": _ranked(together, size, 5),
            "medications": _ranked(cohort_meds, size, 5),
            "on_polypharmacy": len(members & poly_patients),
        })

    diagnosis_counts = [len(patient_diagnoses.get(pid, ())) for pid in living]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "patients": {
            "total": total,
            "deceased_excluded": deceased,
            "median_age": round(median(ages)) if ages else None,
            "oldest": max(ages) if ages else None,
            "by_gender": [
                {"gender": gender, "patients": count, "share": _share(count, total)}
                for gender, count in sorted(gender_counts.items(), key=lambda item: -item[1])
            ],
            "pyramid": [
                {
                    "band": label,
                    "female": pyramid[label].get("female", 0),
                    "male": pyramid[label].get("male", 0),
                    "other": sum(
                        count for gender, count in pyramid[label].items()
                        if gender not in ("female", "male")
                    ),
                }
                for label in BAND_LABELS
            ],
            "race": _ranked(Counter(p["race"] for p in living.values()), total),
            "ethnicity": _ranked(Counter(p["ethnicity"] for p in living.values()), total),
        },
        "conditions": {
            "patients_with_diagnosis": sum(1 for count in diagnosis_counts if count > 0),
            "median_diagnoses_per_patient": round(median(diagnosis_counts), 1) if diagnosis_counts else 0,
            "distinct": len(condition_patients),
            "items": condition_items,
        },
        "medications": {
            "active_orders": active_orders,
            "patients_on_any": sum(1 for count in med_count.values() if count > 0),
            "threshold": POLYPHARMACY_THRESHOLD,
            "polypharmacy": {
                "patients": len(poly_patients),
                "share": _share(len(poly_patients), total),
            },
            "burden": [
                {"bucket": label, "patients": burden.get(label, 0), "share": _share(burden.get(label, 0), total)}
                for label, _low, _high in BURDEN_BUCKETS
            ],
            "polypharmacy_by_band": [
                {
                    "band": label,
                    "patients": band_poly.get(label, 0),
                    "of": band_totals.get(label, 0),
                    "share": _share(band_poly.get(label, 0), band_totals.get(label, 0)),
                }
                for label in BAND_LABELS
            ],
            "top": _ranked(Counter({name: len(takers) for name, takers in med_patients.items()}), total, medication_limit),
        },
    }


class PopulationAnalyticsService:
    """Fetches the resources the snapshot needs, following every page."""

    def __init__(self, client: Optional[HAPIFHIRClient] = None):
        self.client = client or HAPIFHIRClient()

    async def _search_all(self, resource_type: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """All matches for a search. HAPI caps a page (500 here) whatever
        `_count` asks for, so one request silently truncates."""
        bundle = await self.client.search(resource_type, {**params, "_count": PAGE_SIZE})
        resources: List[Dict[str, Any]] = []
        for _ in range(MAX_PAGES):
            for entry in bundle.get("entry") or []:
                resource = entry.get("resource")
                if resource and resource.get("resourceType") == resource_type:
                    resources.append(resource)
            next_url = next(
                (link.get("url") for link in bundle.get("link") or [] if link.get("relation") == "next"),
                None,
            )
            if not next_url:
                return resources
            # The link carries HAPI's own advertised host; keep only its
            # query and send it to the base URL we are configured with.
            query = urlsplit(next_url).query
            async with httpx.AsyncClient(timeout=self.client.timeout) as http:
                response = await http.get(f"{self.client.base_url}?{query}")
                response.raise_for_status()
                bundle = response.json()
        logger.warning("Stopped paging %s after %d pages", resource_type, MAX_PAGES)
        return resources

    async def get_population_snapshot(self) -> Dict[str, Any]:
        patients = await self._search_all(
            "Patient", {"_elements": "gender,birthDate,deceasedDateTime,deceasedBoolean,extension"}
        )
        conditions = await self._search_all(
            "Condition", {"clinical-status": "active", "_elements": "code,subject"}
        )
        medication_requests = await self._search_all(
            "MedicationRequest",
            {"status": "active", "_elements": "medicationCodeableConcept,medicationReference,subject"},
        )
        return build_population_snapshot(patients, conditions, medication_requests)
