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

### "Could not resolve call to operator ToString with signature (FHIR.id)" (or any FHIR.X)

CQL needs `FHIRHelpers` to call operators (`ToString`, `ToDecimal`, `ToConcept`,
etc.) on FHIR-typed values like `Patient.id`, `Observation.value`, or any
`code`/`Coding` field. Without it, the compiler can't find a matching
signature for "operator + FHIR type" and the error fingerprint always
includes `signature (FHIR.something)`.

**Fix**: add this line near the top of your library, just below
`using FHIR version '4.0.1'`:

```cql
include FHIRHelpers version '4.0.001'
```

The test panel will now also append a hint with the same advice whenever
it sees this fingerprint — so if you see "Tip: Add `include FHIRHelpers
version '4.0.001'`" in the validation panel, the fix is exactly that one
line. (Same hint fires if you wrote `include FHIRHelpers version '4.0.000'`
or some other version HAPI doesn't have — use `'4.0.001'`.)

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

## Reacting to the order being composed (order-select hooks)

For hooks that fire during order composition (`order-select`, sometimes
`medication-prescribe`), the CDS Hooks request carries the in-progress
draft order in `context.draftOrders` — a Bundle of resources the clinician
is currently selecting but hasn't yet signed/saved.

The platform's CQL bridge forwards this Bundle to HAPI's `$apply` operation
as the `data` parameter. cqf-fhir-cr-hapi merges those entries into the
data the CQL Data Provider consults, so a retrieve like `[Immunization]`
returns **both** persisted resources from the patient's record AND the
draft from the hook payload — automatically. You don't declare any special
parameters; the standard CQL retrieve syntax just works.

### Worked example: live-vaccine contraindication for immunocompromised patients

Fires when an immunocompromised adult is selecting a live attenuated vaccine.
Targets `order-select`. The draft Immunization being composed appears in
`[Immunization]` retrievals alongside the patient's persisted vaccine
history.

```cql
library LiveVaccineContraindication version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

context Patient

// Patient phenotype: severe immunocompromise per CDC ACIP definition.
// CD4 < 200 cells/mm³ measured in the last 6 months.

define IsAdult: AgeInYears() >= 18

define MostRecentCD4:
  First([Observation] O
    where exists (O.code.coding C where C.system = 'http://loinc.org'
                                     and C.code = '24467-3')
      and O.status in {'final', 'amended', 'corrected'}
      and (O.effective as FHIR.dateTime).value after Now() - 6 months
    sort by (effective as FHIR.dateTime).value desc)

define MostRecentCD4Value: (MostRecentCD4.value as Quantity).value

define HasSevereImmunocompromise:
  MostRecentCD4 is not null and MostRecentCD4Value < 200

// The draft Immunization the clinician is selecting lands in
// [Immunization] retrievals automatically (via context-binding from
// CDS Hooks 2.0 draftOrders to the $apply data parameter). We match
// it using a where-clause on the coding rather than a
// [Resource: "VS"] retrieve — see "ValueSet retrievals" caveat below.

define IsLiveVaccineBeingSelected:
  exists ([Immunization] I
    where exists (I.vaccineCode.coding C
      where C.system = 'http://hl7.org/fhir/sid/cvx'
        and C.code in {'03', '21', '37', '94', '111', '25', '75'}))
      // 03=MMR, 21=varicella, 37=Yellow Fever, 94=MMRV,
      // 111=influenza live, 25=typhoid, 75=Smallpox

define Applicability:
  IsAdult and HasSevereImmunocompromise and IsLiveVaccineBeingSelected

define CardSummary:
  'Live vaccine contraindicated: CD4 ' + ToString(MostRecentCD4Value) + ' cells/mm³'

define CardDetail:
  'Patient has CD4 ' + ToString(MostRecentCD4Value)
    + ' cells/mm³ — severe immunocompromise per CDC ACIP. Live, '
    + 'replicating vaccines are contraindicated due to risk of '
    + 'disseminated infection from the attenuated organism. '
    + 'Cancel and consider an inactivated alternative if available, '
    + 'or defer pending infectious disease consultation.'
```

This rule fires only when **all three** are true — the patient is an
adult, has severe immunocompromise (CD4 < 200), AND is selecting a live
vaccine. None of the three predicates needs special hook-context plumbing;
standard CQL syntax sees both persisted and draft data.

### What's available where

The platform forwards `context.draftOrders` for `order-select` firings on:

- `CPOEDialog` (lab / imaging / procedure orders → `ServiceRequest` drafts)
- `MedicationDialogEnhanced` (medication picks → `MedicationRequest` drafts;
  also fires the existing `medication-prescribe` hook for compatibility)
- `ImmunizationDialogEnhanced` (vaccine picks → `Immunization` drafts)
- `EnhancedOrdersTab` (existing-orders checkbox path → whatever resource
  type the order is)

When the bridge receives a hook request with `context.draftOrders` set, it
attaches the bundle as the `data` parameter on `$apply`. When `draftOrders`
is missing or empty, the parameter is omitted (so patient-view hooks and
other non-composition flows are unchanged).

### Trade-offs and constraints

**Subject filtering is strict.** If `draftOrders` includes resources
referencing a different patient than the hook's `subject`, the engine
filters them out. Drafts always need to align with the patient context to
be visible to CQL. This is good — it keeps cross-patient leakage
impossible at the engine level.

**ValueSet retrievals can fail.** A retrieve like
`[Immunization: "Live Replicating Vaccines"]` against a freshly-uploaded
ValueSet can cause the entire library to fail compilation in this HAPI
deployment — an orthogonal issue with HAPI's terminology cache (HSearch
disabled). Workaround: use `where`-clause matching against known coding
values, as in the worked example above. Both produce equivalent semantics;
the where-clause version sidesteps the VS-expansion path entirely.

**The `data` parameter is additive, not a replacement.** CQL retrieves
still consult patient-compartment data (the persisted resources HAPI has
stored). Drafts appear *alongside* the persisted set, not instead of it.
Don't try to use this mechanism to override patient data; use it to react
to the draft in flight.

**Multi-resource composition (future).** When CPOE evolves to multi-order
drafting (issue #116), all drafted resources land in `context.draftOrders`
together. CQL retrieves like `[Immunization]` already handle this case
without changes — each draft Immunization in the bundle becomes an
independent entry in the retrieve result.

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
