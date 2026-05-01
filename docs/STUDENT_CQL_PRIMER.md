# Student CQL Primer

**Audience**: students learning Clinical Decision Support by authoring real
CDS Hooks services through CDS Studio.

This primer covers what you need to write a working CQL-backed CDS service
in WintEHR — the conventions, the editor, ValueSets, prefetch, and the
common mistakes that catch everyone the first time. It assumes you're
familiar with FHIR R4 resources at a basic level (Patient, Condition,
Observation) but new to CQL.

---

## What you'll build

When you create a "Custom CQL Rule" in CDS Studio, four things happen behind
the scenes:

1. Your CQL is uploaded to HAPI as a FHIR `Library` resource
2. A FHIR `PlanDefinition` is generated that wraps it — the PlanDefinition
   declares the hook trigger, the applicability gate, and the card content
3. When the EHR fires a CDS Hook (e.g. when a clinician opens a chart),
   HAPI evaluates `PlanDefinition/$apply` against your patient
4. Your CQL is compiled to ELM (HAPI does this once and caches), evaluated
   against the patient's FHIR data, and a CDS Hooks card is returned

You write CQL. The platform turns it into a real CDS service.

---

## The three CQL `define`s the platform expects

Every CQL service must follow a small naming convention:

| Define name | Required | Returns | What it does |
|---|---|---|---|
| `Applicability` | **yes** | Boolean | Decides whether the card fires for this patient |
| `CardSummary` | optional | String | Replaces the card title at runtime (personalization) |
| `CardDetail` | optional | String | Replaces the card detail at runtime |

You can declare any other `define`s you want as helpers — these three are the
ones the platform looks for.

### Minimum service

```cql
library MyFirstRule version '0.1.0'

using FHIR version '4.0.1'

context Patient

// REQUIRED: gates whether the card fires
define Applicability:
  exists [Patient]

// OPTIONAL: personalize the card text
define CardSummary: 'You have opened a patient chart'
```

That's a complete CDS service. Drop it into the editor, fill in the wizard's
metadata fields (service id, hook type, name), and click Save. The wizard
auto-saves a draft, lets you test it against a real patient, and exposes a
Deploy button when you're ready to ship.

---

## Personalizing the card

`CardSummary` and `CardDetail` are where students make rules feel intelligent.
They're regular CQL string-typed defines, evaluated against the patient at
runtime:

```cql
define PatientAge:
  CalculateAgeInYears(Patient.birthDate)

define CardSummary:
  'Patient is ' + ToString(PatientAge) + ' years old'

define CardDetail:
  'Born ' + ToString(Patient.birthDate) + '. Consider age-appropriate screening.'
```

The card a clinician sees becomes:
> **Patient is 67 years old**
> Born 1957-03-12. Consider age-appropriate screening.

Without `CardSummary` / `CardDetail`, the card uses the static text you typed
into the Card Designer step of the wizard. So you can mix: static for simple
rules, dynamic for personalized ones.

---

## ValueSets — telling CQL "what counts as diabetes"

Real clinical rules don't say "diabetes" in plain English. They reference a
**ValueSet** — a curated list of codes from one or more terminologies (SNOMED,
ICD-10, RxNorm, LOINC, etc.) that together represent a clinical concept.

You compose ValueSets through the **Compose ValueSet** button in the CQL
editor. The dialog lets you:

- Search WintEHR's existing catalogs (SNOMED conditions, RxNorm meds, LOINC
  labs, vital signs) and multi-select codes
- Manually add any `system | code | display` tuple — useful for codes that
  aren't in the catalogs

When you save, the dialog generates a FHIR `ValueSet`, posts it to HAPI, and
**inserts a `valueset` declaration into your CQL at the cursor**:

```cql
valueset "DiabetesConditions": 'http://wintehr.example.org/ValueSet/diabetes-conditions'

define ActiveDiabetes:
  [Condition: "DiabetesConditions"] C
    where C.clinicalStatus ~ 'active'

define Applicability:
  exists ActiveDiabetes
```

The valueset name in CQL (the part in quotes) is yours to choose; the URL in
single quotes is the HAPI canonical URL the dialog gives you.

---

## Prefetch — what the EHR pre-fetches

CDS Hooks lets the EHR pre-fetch FHIR resources and attach them to each hook
request. You declare what you want pre-fetched on the **Prefetch** step of
the wizard.

For CQL services, click **Re-derive from CQL** and the platform asks HAPI to
analyze your CQL's data needs and produce prefetch templates automatically.
You can then edit the result, add custom queries, or remove ones you don't
need.

A typical prefetch looks like:

```
patient    Patient/{{context.patientId}}
conditions Condition?patient={{context.patientId}}&clinical-status=active
labs       Observation?patient={{context.patientId}}&category=laboratory&_count=20
```

The `{{context.patientId}}` placeholder is filled in at hook time with the
real patient id.

You can leave prefetch empty for trivial rules (e.g., "always fire") — HAPI
will fetch what your CQL needs from its own data store.

---

## Common idioms

### Age check
```cql
include FHIRHelpers version '4.0.1' called FHIRHelpers

define PatientAge:
  CalculateAgeInYears(Patient.birthDate)

define IsScreeningAge:
  PatientAge between 50 and 74
```

### Active condition from a ValueSet
```cql
valueset "Diabetes": 'http://wintehr.example.org/ValueSet/diabetes-conditions'

define ActiveDiabetes:
  [Condition: "Diabetes"] C
    where C.clinicalStatus ~ 'active'
```

### Most recent lab value
```cql
define MostRecentA1C:
  Last(
    [Observation: code in {Code '4548-4' from "http://loinc.org" display 'HbA1c'}] O
      sort by effective.value
  )

define A1CAboveTarget:
  FHIRHelpers.ToQuantity(MostRecentA1C.value).value > 9.0
```

### Days since last screening
```cql
define LatestScreening:
  Last([Observation: "Screening Procedures"] O sort by effective.value)

define OverdueByMoreThanYear:
  LatestScreening is null
    or duration in months between FHIRHelpers.ToDateTime(LatestScreening.effective) and Now() > 12
```

### Combining conditions
```cql
define Applicability:
  IsFemale and IsScreeningAge and not (HasRecentMammogram or HasMastectomy)
```

The CQL editor ships with starter templates that demonstrate each of these —
use the **Insert template** menu to start from a working example.

---

## How to test your service

1. Hit **Validate** in the editor. This calls HAPI's `$cql` operation and
   marks any compile errors with red squigglies (and a list below the editor)
2. Save the draft (Next button auto-saves around step 4)
3. Go to the **Test Service** step → pick a real Synthea patient → click Run
4. The test panel shows the cards your service produced for that patient,
   plus any warnings from HAPI (e.g. "Could not resolve identifier X" — see
   below). If `Applicability` returned false, you'll see "$apply returned
   no cards" — that's working as intended, just pick a different patient

For diabetes rules, look for patients with diagnoses in the Conditions tab.
The Synthea data set includes plenty of common conditions.

---

## Common mistakes (saving you a few hours of debugging)

### "Could not resolve expression reference 'X'"

Means HAPI couldn't find a `define` named X. Either you mistyped it, or
you saved before adding it. Look at the warnings list in the test panel.

### "Could not resolve library 'X', version null"

The library name in your CQL `library X version 'V'` directive doesn't match
what the platform expects. **Don't manually rename the `library` line** —
the platform rewrites it for you when it uploads to HAPI. If you see this
error, something got out of sync. Save again to re-materialize.

### My ValueSet retrieves nothing

Two common causes:

1. The ValueSet you composed isn't expanded in HAPI. Click the **Compose
   ValueSet** button → re-open your ValueSet → click "Expand" to verify
   HAPI has the codes available.
2. Your patients don't actually have those codes. Synthea uses SNOMED
   primarily; if your ValueSet only has ICD-10 codes for "Diabetes", you
   might need to add the SNOMED codes too. Use the catalog autocomplete —
   it searches across systems.

### My card text shows the static fallback, not the personalized version

Your `CardSummary` or `CardDetail` define has a runtime error. HAPI falls
back to the static text from the Card Designer step. Check the test panel's
warnings — there's usually a "Could not resolve..." or "Type mismatch"
message that explains why.

### `Trim()` doesn't work / unexpected stdlib gaps

The CQL stdlib in this engine has some gaps versus the spec. We hit `Trim()`
during early testing — it accepts the call but errors at runtime, then
silently drops every define written after it from the compiled output.

Workaround: avoid `Trim()` and a few other less-common functions. Test
carefully if you see defines mysteriously missing from the test panel —
that's the signal.

### Edits aren't reflected when I re-test

The platform handles this automatically. Every ValueSet write and every
service save flushes HAPI's CQL/ValueSet caches via the overlay's
`/admin/cr/flush-caches` endpoint, so the next test sees the new content.
Drafts also use content-hashed library identifiers, so each save lands at
a fresh URL. If you ever see truly stale results, save the service or
ValueSet again — the flush will fire on save.

---

## What happens when you Deploy

1. Your CQL is re-uploaded to HAPI at a stable, versioned canonical URL
   (e.g., `http://wintehr.example.org/Library/DiabetesCareV120` for v1.2.0)
2. The PlanDefinition's `library` reference moves to that URL
3. The service status becomes `ACTIVE`
4. The service is discoverable at `GET /api/cds-services` and clinicians
   start seeing your cards on the relevant hook (patient-view,
   medication-prescribe, etc.)

The Advanced tab in the editor shows you the exact FHIR resources the
platform generates — useful if you want to learn the FHIR side of CDS Hooks.

---

## Going deeper

- HL7's [Using CQL With FHIR IG](https://hl7.org/fhir/uv/cql/) — official
  CQL operations spec
- [Clinical Reasoning — CDS on FHIR](http://www.hl7.org/fhir/clinicalreasoning-cds-on-fhir.html)
  — the mapping table that explains how `$apply` output becomes CDS Hooks
  Cards
- The CQL spec itself: https://cql.hl7.org/
- Ask the wizard's Advanced tab to show you the FHIR Library + PlanDefinition
  it generated from your CQL — that's the most direct way to understand the
  pipeline

The reference POC at `backend/scripts/cql_bridge_poc.py` is a 250-line Python
script that does the whole pipeline in one file, against the live HAPI. Read
it once and you'll understand everything in this primer.
