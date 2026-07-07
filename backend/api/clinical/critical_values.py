"""Single source of truth for lab critical-value thresholds (R33).

This module owns THE critical-value threshold table. It is:
- served to the frontend as JSON via ``critical_values_router.py``
  (``GET /api/clinical/critical-values``), consumed by
  ``frontend/src/services/criticalValueService.js``;
- used by the backend notification path (``notifications_helper.py``) and the
  results router (``results/results_router.py``).

Do not add another threshold table anywhere — extend this one.

The content merges the three tables that previously lived in
``notifications_helper.py`` (backend), ``resultsManagementService.js`` and
``criticalValueDetectionService.js`` (frontend). Where the sources conflicted,
the ``notifications_helper.py`` values won (PT critical-high 40s not 30s;
glucose critical-high 500 not 400; hemoglobin critical-low 7.0 not 6.0;
WBC critical-high 30 not 50; sodium critical 120/160 not 125/155).

Entry shape (per LOINC code):
    label            display name of the test
    unit             expected unit (UCUM-ish, as reported by Synthea)
    critical_low     value below this is a critical low   (optional)
    critical_high    value above this is a critical high  (optional)
    low              value below this is abnormal-low, not critical (optional)
    high             value above this is abnormal-high, not critical (optional)
    note             extra clinical context appended to alert messages (optional)

Invariants: critical_low < low <= high < critical_high (where present).

Educational platform — thresholds are illustrative reference data for learning
EHR workflows, not a substitute for a lab's own critical-value policy.
"""

from typing import Any, Dict, List, Optional

CRITICAL_VALUE_TABLE: Dict[str, Dict[str, Any]] = {
    # --- Electrolytes ---
    "2951-2": {  # Sodium [Moles/volume] in Serum or Plasma
        "label": "Sodium", "unit": "mmol/L",
        "critical_low": 120, "critical_high": 160, "low": 130, "high": 150,
    },
    "2947-0": {  # Sodium [Moles/volume] in Blood
        "label": "Sodium", "unit": "mmol/L",
        "critical_low": 120, "critical_high": 160, "low": 130, "high": 150,
    },
    "2823-3": {  # Potassium [Moles/volume] in Serum or Plasma
        "label": "Potassium", "unit": "mmol/L",
        "critical_low": 2.5, "critical_high": 6.5, "low": 3.0, "high": 5.5,
    },
    "6298-4": {  # Potassium [Moles/volume] in Blood
        "label": "Potassium", "unit": "mmol/L",
        "critical_low": 2.5, "critical_high": 6.5, "low": 3.0, "high": 5.5,
    },
    "2075-0": {  # Chloride [Moles/volume] in Serum or Plasma
        "label": "Chloride", "unit": "mmol/L",
        "critical_low": 80, "critical_high": 120,
    },

    # --- Renal function ---
    "2160-0": {  # Creatinine [Mass/volume] in Serum or Plasma
        "label": "Creatinine", "unit": "mg/dL",
        "critical_high": 4.0, "high": 2.0,
    },
    "38483-4": {  # Creatinine [Mass/volume] in Blood
        "label": "Creatinine", "unit": "mg/dL",
        "critical_high": 4.0, "high": 2.0,
    },
    "14682-9": {  # Creatinine — pediatric threshold carried over as-is
        "label": "Creatinine (pediatric)", "unit": "mg/dL",
        "critical_high": 2.0,
    },

    # --- Glucose ---
    "2345-7": {  # Glucose [Mass/volume] in Serum or Plasma
        "label": "Glucose", "unit": "mg/dL",
        "critical_low": 40, "critical_high": 500, "low": 70, "high": 250,
    },
    "2339-0": {  # Glucose [Mass/volume] in Blood
        "label": "Glucose", "unit": "mg/dL",
        "critical_low": 40, "critical_high": 500, "low": 70, "high": 250,
    },

    # --- Cardiac markers ---
    "2157-6": {  # Troponin I.cardiac [Mass/volume] in Serum or Plasma (legacy code kept)
        "label": "Troponin I", "unit": "ng/mL",
        "critical_high": 0.04, "high": 0.01,
        "note": "possible myocardial injury",
    },
    "6598-7": {  # Troponin T.cardiac [Mass/volume] in Serum or Plasma
        "label": "Troponin", "unit": "ng/mL",
        "critical_high": 0.04, "high": 0.01,
        "note": "possible myocardial injury",
    },
    "33762-6": {  # NT-proBNP [Mass/volume] in Serum or Plasma
        "label": "NT-proBNP", "unit": "pg/mL",
        "critical_high": 900,
    },

    # --- Hematology ---
    "718-7": {  # Hemoglobin [Mass/volume] in Blood
        "label": "Hemoglobin", "unit": "g/dL",
        "critical_low": 7.0, "critical_high": 20.0, "low": 8.0, "high": 18.0,
    },
    "777-3": {  # Platelets [#/volume] in Blood
        "label": "Platelet count", "unit": "10*3/uL",
        "critical_low": 20, "critical_high": 1000, "low": 50, "high": 750,
    },
    "6690-2": {  # Leukocytes [#/volume] in Blood
        "label": "WBC count", "unit": "10*3/uL",
        "critical_low": 1.0, "critical_high": 30.0, "low": 3.0, "high": 20.0,
    },

    # --- Coagulation ---
    "5902-2": {  # Prothrombin time
        "label": "Prothrombin time", "unit": "s",
        "critical_high": 40,
    },
    "5964-2": {  # INR in Platelet poor plasma by coagulation assay
        "label": "INR", "unit": "",
        "critical_high": 5.0,
        "note": "bleeding risk",
    },
    "6301-6": {  # INR in Blood by coagulation assay
        "label": "INR", "unit": "",
        "critical_high": 5.0,
        "note": "bleeding risk",
    },

    # --- Blood gas ---
    "2703-7": {  # pH of Arterial blood
        "label": "pH", "unit": "",
        "critical_low": 7.20, "critical_high": 7.60,
    },
    "2019-8": {  # pCO2 in Arterial blood
        "label": "pCO2", "unit": "mmHg",
        "critical_low": 20, "critical_high": 70,
    },
    "2704-5": {  # pO2 in Arterial blood
        "label": "pO2", "unit": "mmHg",
        "critical_low": 50,
    },

    # --- Therapeutic drug levels ---
    "10535-3": {  # Digoxin [Mass/volume] in Serum or Plasma
        "label": "Digoxin", "unit": "ng/mL",
        "critical_high": 2.0,
    },
    "4049-3": {  # Theophylline [Mass/volume] in Serum or Plasma
        "label": "Theophylline", "unit": "ug/mL",
        "critical_high": 20,
    },
}


def get_critical_value_table() -> List[Dict[str, Any]]:
    """Return the threshold table as a JSON-ready list of camelCase entries.

    This is the exact shape served by ``GET /api/clinical/critical-values``
    and consumed by the frontend ``criticalValueService``.
    """
    return [
        {
            "loinc": loinc,
            "label": entry["label"],
            "unit": entry["unit"],
            "criticalLow": entry.get("critical_low"),
            "criticalHigh": entry.get("critical_high"),
            "low": entry.get("low"),
            "high": entry.get("high"),
        }
        for loinc, entry in CRITICAL_VALUE_TABLE.items()
    ]


def evaluate_critical(
    loinc_code: Optional[str],
    value: Optional[float],
    unit: str = "",
) -> Optional[Dict[str, Any]]:
    """Check a numeric lab value against the critical thresholds for a code.

    Returns ``None`` when the code is unknown, the value is missing, or the
    value is not critical (fail-safe: absence of a table entry never invents
    criticality). Otherwise returns::

        {
            "type": "low" | "high",
            "threshold": <the crossed bound>,
            "label": <test display name>,
            "unit": <unit used in the message>,
            "message": <human-readable alert text>,
        }
    """
    if not loinc_code or value is None:
        return None

    entry = CRITICAL_VALUE_TABLE.get(loinc_code)
    if not entry:
        return None

    display_unit = unit or entry["unit"]
    critical_low = entry.get("critical_low")
    critical_high = entry.get("critical_high")

    critical_type: Optional[str] = None
    threshold: Optional[float] = None
    if critical_low is not None and value < critical_low:
        critical_type, threshold = "low", critical_low
    elif critical_high is not None and value > critical_high:
        critical_type, threshold = "high", critical_high

    if critical_type is None:
        return None

    message = f"Critical {critical_type} {entry['label']} level: {value} {display_unit}".rstrip()
    if entry.get("note"):
        message += f" - {entry['note']}"

    return {
        "type": critical_type,
        "threshold": threshold,
        "label": entry["label"],
        "unit": display_unit,
        "message": message,
    }
