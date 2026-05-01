#!/usr/bin/env python3
"""CQL bridge POC — drives HAPI's PlanDefinition/$apply end-to-end.

Authors a trivial Library + PlanDefinition with a CQL applicability check,
posts them to HAPI (idempotent PUT), calls $apply against a real patient,
translates the response to a CDS Hooks Card, and prints the existing
FastAPI patient-greeter response side-by-side for comparison.

Run from anywhere with network access to the deployed instance:

    python3 backend/scripts/cql_bridge_poc.py [PATIENT_ID]
"""
from __future__ import annotations

import base64
import json
import sys
import urllib.error
import urllib.request
import uuid

HAPI_BASE = "https://wintehr.eastus2.cloudapp.azure.com/fhir/R4"
FASTAPI_BASE = "https://wintehr.eastus2.cloudapp.azure.com/api"
DEFAULT_PATIENT = "fa009f18-7c8f-27e3-8a1d-88c4ef376759"  # Melvin857 Paul232 Homenick806

# The CQL library directive, the Library resource id, and Library.name all
# must agree — cqf-fhir-cr-hapi resolves CQL libraries by Library.id when
# dereferencing a PlanDefinition.library[] canonical, and the compiled CQL
# expects to find a library by its declared identifier.
LIB_ID = "PatientGreeterV2"
PD_ID = "patient-greeter-cql"
LIB_URL = f"http://wintehr.example.org/Library/{LIB_ID}"
PD_URL = f"http://wintehr.example.org/PlanDefinition/{PD_ID}"

# CQL: a one-line applicability gate plus three string-producing defines
# that get bound to action fields via PlanDefinition.action.dynamicValue.
# FHIRHelpers ships with cqf-fhir-cr-hapi's embedded libraries
# (cr.cql.use_embedded_libraries=true is the default), so no IG load needed
# for primitive-type conversions like FHIR.code → String.
CQL_VERSION = "0.3.0"
CQL_SOURCE = f"""library PatientGreeterV2 version '{CQL_VERSION}'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

context Patient

define ChartIsOpen:
  exists [Patient]

define FirstName:
  Coalesce(First(First(Patient.name).given), '')

define LastName:
  Coalesce(First(Patient.name).family, '')

// Avoids Trim() — not implemented in this engine. Conditional concatenation
// is good enough since real Patient.name values from Synthea always have
// both parts.
define FullName:
  if FirstName = '' and LastName = '' then 'Unknown Patient'
  else if FirstName = '' then LastName
  else if LastName = '' then FirstName
  else FirstName + ' ' + LastName

define AgeYears:
  CalculateAgeInYears(Patient.birthDate)

define GenderText:
  Coalesce(Patient.gender, 'unknown')

define BirthDateStr:
  Coalesce(ToString(Patient.birthDate), 'not recorded')

define GreetingTitle:
  'Viewing chart for ' + FullName

define DemographicsDetail:
  '**Patient**: ' + FullName +
  (if AgeYears is not null then ', ' + ToString(AgeYears) + ' years old' else '') +
  '\\n\\n**Gender**: ' + GenderText +
  '\\n\\n**DOB**: ' + BirthDateStr
"""


def _http(method: str, url: str, body=None, headers=None):
    h = {"Accept": "application/fhir+json"}
    if body is not None:
        h["Content-Type"] = "application/fhir+json"
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw}


def upsert_artifacts() -> None:
    cql_b64 = base64.b64encode(CQL_SOURCE.encode()).decode()
    library = {
        "resourceType": "Library",
        "id": LIB_ID,
        "url": LIB_URL,
        "version": CQL_VERSION,
        "name": "PatientGreeterV2",
        "title": "Patient Greeter (CQL POC)",
        "status": "active",
        "experimental": True,
        "type": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/library-type",
                "code": "logic-library",
            }]
        },
        "content": [{"contentType": "text/cql", "data": cql_b64}],
    }
    plan_def = {
        "resourceType": "PlanDefinition",
        "id": PD_ID,
        "url": PD_URL,
        "version": CQL_VERSION,
        "name": "PatientGreeterCQL",
        "title": "Patient Greeter (CQL POC)",
        "status": "active",
        "experimental": True,
        # Canonical reference to the Library by URL — version-pinned so a
        # newer library doesn't silently change rule behavior.
        "library": [f"{LIB_URL}|{CQL_VERSION}"],
        "action": [{
            # Static fallbacks. dynamicValue overrides these at $apply time.
            "title": "Viewing chart for patient",
            "description": "Demographic summary card.",
            "trigger": [{"type": "named-event", "name": "patient-view"}],
            "condition": [{
                "kind": "applicability",
                "expression": {
                    "language": "text/cql-identifier",
                    "expression": "ChartIsOpen",
                },
            }],
            "dynamicValue": [
                {
                    "path": "title",
                    "expression": {
                        "language": "text/cql-identifier",
                        "expression": "GreetingTitle",
                    },
                },
                {
                    "path": "description",
                    "expression": {
                        "language": "text/cql-identifier",
                        "expression": "DemographicsDetail",
                    },
                },
            ],
        }],
    }
    print(f"PUT  {HAPI_BASE}/Library/{LIB_ID}")
    s, body = _http("PUT", f"{HAPI_BASE}/Library/{LIB_ID}", library)
    print(f"  → HTTP {s}")
    if s >= 400:
        _print_outcome(body)
    print(f"PUT  {HAPI_BASE}/PlanDefinition/{PD_ID}")
    s, body = _http("PUT", f"{HAPI_BASE}/PlanDefinition/{PD_ID}", plan_def)
    print(f"  → HTTP {s}")
    if s >= 400:
        _print_outcome(body)


def _print_outcome(body):
    """Pretty-print an OperationOutcome or fall back to raw JSON."""
    if isinstance(body, dict) and body.get("resourceType") == "OperationOutcome":
        for issue in body.get("issue", []) or []:
            sev = issue.get("severity", "?")
            diag = issue.get("diagnostics") or (issue.get("details") or {}).get("text")
            print(f"     [{sev}] {diag}")
    else:
        print(json.dumps(body, indent=2)[:800])


def call_apply(patient_id: str):
    params = {
        "resourceType": "Parameters",
        "parameter": [{"name": "subject", "valueString": f"Patient/{patient_id}"}],
    }
    url = f"{HAPI_BASE}/PlanDefinition/{PD_ID}/$apply"
    print(f"POST {url} (subject=Patient/{patient_id})")
    s, body = _http("POST", url, params)
    print(f"  → HTTP {s}  resourceType={body.get('resourceType') if isinstance(body, dict) else '?'}")
    return s, body


def _find_actions(resource: dict):
    """Yield action dicts found anywhere in the $apply response shape.

    cqf-fhir-cr-hapi's R4 PlanDefinition/$apply returns a CarePlan that
    contains a RequestGroup (in `contained[]`) whose `action[]` mirrors the
    PlanDefinition's actions whose applicability conditions matched. Older
    shapes also exist (top-level RequestGroup, Bundle entries), so handle
    them for forward-compatibility.
    """
    if not isinstance(resource, dict):
        return
    rt = resource.get("resourceType")
    if rt == "RequestGroup":
        for a in resource.get("action", []) or []:
            yield a
    elif rt == "CarePlan":
        # The actual recommendations live in a contained RequestGroup.
        for c in resource.get("contained", []) or []:
            yield from _find_actions(c)
        # Fallback: some servers put actions directly on the CarePlan.
        for a in resource.get("action", []) or []:
            yield a
    elif rt == "Bundle":
        for entry in resource.get("entry", []) or []:
            yield from _find_actions((entry or {}).get("resource") or {})


def apply_response_to_card(response: dict):
    """Translate $apply output to a single CDS Hooks Card."""
    for action in _find_actions(response):
        title = action.get("title") or action.get("description")
        if not title:
            continue
        priority = action.get("priority") or "routine"
        # Map FHIR action.priority → CDS Hooks indicator.
        indicator = {"routine": "info", "urgent": "warning", "stat": "critical"}.get(priority, "info")
        return {
            "summary": action.get("title") or "CDS recommendation",
            "indicator": indicator,
            "detail": action.get("description") or "",
            "source": {"label": "CQL via HAPI $apply"},
        }
    return None


def call_fastapi_patient_greeter(patient_id: str):
    body = {
        "hook": "patient-view",
        "hookInstance": str(uuid.uuid4()),
        "context": {"patientId": patient_id, "userId": "Practitioner/demo"},
    }
    url = f"{FASTAPI_BASE}/cds-services/patient-greeter"
    print(f"POST {url}")
    s, payload = _http("POST", url, body)
    print(f"  → HTTP {s}")
    return s, payload


def main(argv):
    patient_id = argv[1] if len(argv) > 1 else DEFAULT_PATIENT
    print("=" * 72)
    print(f"CQL bridge POC — patient {patient_id}")
    print("=" * 72)
    print()

    upsert_artifacts()
    print()

    apply_status, apply_body = call_apply(patient_id)
    print()
    print("─ $apply response (truncated) " + "─" * 40)
    print(json.dumps(apply_body, indent=2)[:1200])
    print()

    print("─ Translated CDS Hooks Card " + "─" * 42)
    card = apply_response_to_card(apply_body)
    print(json.dumps(card, indent=2) if card else "(no card produced)")
    print()

    print("─ Existing FastAPI patient-greeter " + "─" * 35)
    fa_status, fa_body = call_fastapi_patient_greeter(patient_id)
    print(json.dumps(fa_body, indent=2)[:1500])
    print()

    print("=" * 72)
    print("Summary")
    print("=" * 72)
    print(f"  $apply HTTP status: {apply_status}")
    print(f"  $apply produced card: {'yes' if card else 'NO'}")
    print(f"  FastAPI HTTP status: {fa_status}")
    fa_cards = (fa_body.get("cards") if isinstance(fa_body, dict) else None) or []
    print(f"  FastAPI produced cards: {len(fa_cards)}")


if __name__ == "__main__":
    main(sys.argv)
