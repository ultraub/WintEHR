# CQL Authoring Prompt — for LLM-assisted CDS rule generation

This is the prompt to feed to an LLM (Claude, GPT-4, etc.) when a student wants
to generate a CQL service for the WintEHR Visual Builder. It encodes the
platform's specific conventions and the CQL idioms that actually compile under
HAPI's `cqf-fhir-cr` engine.

The student replaces the `<<< CLINICAL DECISION PROBLEM >>>` block at the bottom
with a description of the rule they want, then sends the whole thing to the
LLM. The LLM returns ready-to-paste CQL plus a list of ValueSets to compose.

If you're updating this prompt, see the **Changelog** at the end for the rules
that have been added in response to specific student/LLM failure modes.

---

## The prompt

Copy everything between the rules below into a fresh chat with the LLM, fill in
the clinical decision problem at the bottom, and send.

---

You are writing a Clinical Quality Language (CQL) service for the WintEHR
educational platform. The CQL will be compiled to a FHIR `Library` +
`PlanDefinition` and executed via HAPI FHIR's `PlanDefinition/$apply` operation
against synthetic Synthea patient data.

The platform has specific conventions and constraints. Follow them exactly —
CQL that ignores them will fail at save or runtime.

### Required boilerplate

Every CQL service starts with this scaffold. The order of declarations is
strict — `valueset` and `code` declarations MUST come BEFORE `context Patient`,
not after. Reordering breaks the parser.

```
library <LibraryName> version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

// ValueSet declarations (one per VS the student composes — see ValueSet section below)
valueset "<Spaced Name>": '<canonical url>'

// Code declarations for status comparisons (only if you reference Condition.clinicalStatus
// or other CodeableConcept status fields — see "Status filters" below)
codesystem "ConditionClinicalStatus": 'http://terminology.hl7.org/CodeSystem/condition-clinical'
code "active": 'active' from "ConditionClinicalStatus"

context Patient

// define expressions go here
```

`<LibraryName>` is PascalCase matching the service ID.

Do NOT add `include` lines for any library other than `FHIRHelpers`. The
platform doesn't support importing third-party CQL packages.

### Required defines

Every CQL service must define `Applicability` returning `Boolean`. It gates
whether the CDS Hooks card fires for a given patient:

```
define Applicability:
  // Boolean expression — true means show the card to the user
```

Optional defines that personalize the card at `$apply` time (recommended for
educational rules):

```
define CardSummary:
  // String — overrides the static card title at runtime, e.g.
  // 'Patient is overdue for an A1c (last drawn ' + ToString(LastA1cDate) + ')'

define CardDetail:
  // String — overrides the static card body at runtime
```

### ValueSet naming consistency (strict)

The quoted name in a `valueset "Name": '...'` declaration must match the name
used in retrieves character-for-character, including whitespace and
punctuation:

```
// CORRECT — declaration matches retrieve
valueset "Diabetes Mellitus": 'http://wintehr.example.org/ValueSet/diabetesmellitus'
define HasDiabetes: exists [Condition: "Diabetes Mellitus"]

// WRONG — different whitespace, will fail with "Could not resolve identifier ..."
valueset "DiabetesMellitus": 'http://wintehr.example.org/ValueSet/diabetesmellitus'
define HasDiabetes: exists [Condition: "Diabetes Mellitus"]
```

Use spaced names like `"Diabetes Mellitus"`, `"Hemoglobin A1c"`, etc. (CQL
quoted identifiers can contain whitespace.)

### Supported retrieve patterns

CQL retrieves with a ValueSet filter — `[Resource: "VS Name"]` — work natively
for these resource types and their primary code field:

| Resource | Primary code field used |
|---|---|
| Condition | code |
| Observation | code |
| Immunization | vaccineCode |
| Procedure | code |
| AllergyIntolerance | code |
| ServiceRequest | code |
| DiagnosticReport | code |
| MedicationRequest | medication (CodeableConcept variant only) |
| MedicationStatement | medication (CodeableConcept variant only) |
| Encounter | type |

For any other resource type, OR for filtering a non-primary field
(e.g. `Observation.category` instead of `Observation.code`), use the
membership-after-fetch pattern:

```
[Observation] O where O.category in "Vital Signs Category VS"
```

instead of `[Observation: "Vital Signs Category VS"]`.

### Status filters

**For resources with a simple `status` code field** (Immunization, Procedure,
Observation, MedicationRequest, ServiceRequest), use direct equality:

```
where I.status = 'completed'
where O.status in {'final', 'amended', 'corrected'}
```

**For Condition.clinicalStatus** (and any other CodeableConcept status field),
direct equality doesn't work — `clinicalStatus` is a `CodeableConcept`, not a
simple code. The platform pattern is:

1. Add a `codesystem` + `code` declaration at the top of the library (between
   the `valueset` declarations and `context Patient`):

   ```
   codesystem "ConditionClinicalStatus": 'http://terminology.hl7.org/CodeSystem/condition-clinical'
   code "active": 'active' from "ConditionClinicalStatus"
   ```

2. Use `~` (FHIRHelpers' coding equivalence) in the where-clause:

   ```
   define HasActiveDiabetes:
     exists ([Condition: "Diabetes Mellitus"] C
       where C.clinicalStatus ~ "active")
   ```

The bare form `where C.clinicalStatus ~ "active"` without a `code "active"`
declaration in scope will fail with `Could not resolve identifier active in
the current library`.

### Choice-type fields (`[x]` fields like `effective`, `performed`, `onset`)

FHIR fields with multiple type variants — `Observation.effective[x]`
(`effectiveDateTime` | `effectivePeriod` | …), `Procedure.performed[x]`,
`Condition.onset[x]`, `MedicationStatement.effective[x]` — must be cast to a
specific type before being compared or sorted, otherwise the translator emits
`operator Less is ambiguous` or `Type ... is not comparable`.

The safe pattern is **cast to FHIR primitive, then `.value` to extract the
System type**, and use `Now()` (returns DateTime) on the right-hand side:

```
// CORRECT
exists ([Procedure: "Diabetic Eye Exam"] P
  where P.status = 'completed'
    and (P.performed as FHIR.dateTime).value after Now() - 1 year)

// CORRECT — same cast pattern in a sort clause
First([Observation: "Hemoglobin A1c"] O
  sort by (effective as FHIR.dateTime).value desc)
```

```
// WRONG — choice type used directly in comparison
where P.performed after Today() - 1 year
```

Use `Now()` (DateTime) when comparing against a DateTime field (the common
case). Use `Today()` (Date) only when comparing against a `Date`-typed field
like `Patient.birthDate`.

If a field is reasonably likely to also appear as a `Period` in the data
(Synthea sometimes uses `performedPeriod` for procedures), prefer
`Coalesce` to handle both:

```
where Coalesce(
  (P.performed as FHIR.dateTime).value,
  start of (P.performed as FHIR.Period)
) after Now() - 1 year
```

### Constraints to obey

- The platform supports CQL membership (`exists`, `in`, `where`, `sort`,
  `return`), date math (`Today()`, `Now()`, `AgeInYears()`, interval
  arithmetic), aggregations (`First`, `Last`, `Count`, `Min`, `Max`, `Avg`),
  boolean logic, and type casts (`as CodeableConcept`, `as Quantity`,
  `as FHIR.dateTime`, `as FHIR.Period`).
- Do NOT use `:contains`, `:text`, or any text/narrative search modifier.
- Do NOT use `Trim()` from the CQL stdlib (known broken in this engine).
- For `MedicationRequest.medication`: only the inline `CodeableConcept` form is
  matched. If you need to support `medicationReference`, write a manual
  where-clause that handles both, but expect the reference variant won't
  resolve.

### ValueSet authoring guidance

For each `valueset` declaration in your CQL, the student composes a ValueSet
in the Studio's ValueSet Composer with explicit (system, code, display)
tuples. List the ValueSets needed at the bottom of your output so the student
knows what to compose. Use these system URLs:

- SNOMED CT: `http://snomed.info/sct`
- ICD-10-CM: `http://hl7.org/fhir/sid/icd-10-cm`
- LOINC: `http://loinc.org`
- RxNorm: `http://www.nlm.nih.gov/research/umls/rxnorm`
- CVX (vaccines): `http://hl7.org/fhir/sid/cvx`

Use the system that matches what the FHIR resource actually carries. Synthea
data uses SNOMED for `Condition.code`, LOINC for `Observation.code`, RxNorm
for `MedicationRequest.medication`, CVX for `Immunization.vaccineCode`.

### Idioms you should use freely

**Date math — recency check on a `[x]` choice field:**

```
exists ([Observation: "Hemoglobin A1c"] O
  where (O.effective as FHIR.dateTime).value after Now() - 1 year)
```

**Negation / "absence" rule:**

```
not exists ([Immunization: "Pneumococcal Vaccines"] I where I.status = 'completed')
```

**Latest-value pattern (with safe sort cast):**

```
define MostRecentBp:
  First([Observation: "Blood Pressure Panel"] B
    sort by (effective as FHIR.dateTime).value desc)
```

**Threshold check on a Quantity-typed value:**

```
exists ([Observation: "Potassium Tests"] O
  where (O.value as Quantity) > 5.5 'mmol/L'
    and (O.effective as FHIR.dateTime).value after Now() - 30 days)
```

**Multiple-define composition:**

```
define HasDiabetes: exists [Condition: "Diabetes Mellitus"]
define IsAdult: AgeInYears() >= 18
define Applicability: HasDiabetes and IsAdult and not HasA1cInLastYear
```

### Output format

When you produce the CQL, structure your response as:

1. **The complete CQL library** — ready to paste into the Studio's CQL editor.
2. **A list of ValueSets to compose** — for each `valueset "Name"` line in the
   CQL, give a table of the codes the student should add: system URL, code,
   display.
3. **A short clinical-rationale note** — 2–3 sentences on what the rule is
   checking and which patient profile it would fire for.

### Clinical decision problem

```
<<< STUDENT REPLACES THIS BLOCK >>>

Describe the clinical scenario you want the CDS rule to encode. Be specific:
- What patient population does it apply to (age range, gender, diagnosis,
  recent labs)?
- What action or guidance should the card recommend?
- What clinical evidence or guideline backs it (e.g., "USPSTF Grade B",
  "CDC ACIP", "ADA Standards of Care")?

Example:
"Adults aged 50–75 should be screened for colorectal cancer. The card should
fire for patients in that age range with no record of a colonoscopy in the
past 10 years or fecal occult blood test in the past year. Backed by USPSTF
Grade A recommendation."

<<< END STUDENT BLOCK >>>
```

Generate the complete CQL library, ValueSet list, and rationale following all
the rules above.

---

## Changelog

### 2026-05-04 — `dr-screening-reminder` debug session

Four bugs in the prior version of this prompt produced uncompilable CQL. All
four fixes are now baked in above:

| Prior bug | What was wrong | Fix |
|---|---|---|
| 1. Boilerplate ordering | Scaffold placed `valueset` declarations *after* `context Patient`. CQL grammar rejects that. | Reordered the scaffold so `valueset` and `code` declarations come before `context Patient`. |
| 2. ValueSet naming consistency | No rule preventing `valueset "DiabetesMellitus"` declared but `[Condition: "Diabetes Mellitus"]` referenced. The LLM drifted; CQL fails with `Could not resolve identifier`. | Added an explicit "ValueSet naming consistency (strict)" section with a positive and negative example. |
| 3. `clinicalStatus` comparison | The prompt taught `where C.clinicalStatus ~ "active"` without mentioning the `code "active"` declaration that has to be in scope for it to compile. | Replaced the one-liner status-filter rule with a full "Status filters" section that explicitly walks through the `codesystem` + `code` declarations needed for CodeableConcept comparisons. |
| 4. Choice-type comparisons | Idioms used `O.effective after Today() - 1 year` directly. Works for some Synthea Observations (where `effectiveDateTime` is always populated) but breaks for `Procedure.performed` (which mixes `performedDateTime` and `performedPeriod`) with `operator Less is ambiguous` or `Type ... is not comparable`. | Added a "Choice-type fields" section. Updated all idiom examples to use `(field as FHIR.dateTime).value` and `Now() - N` instead of the unsafe direct form. Mentioned `Coalesce` for fields that legitimately appear as both DateTime and Period in the data. |

If a future student/LLM produces CQL that fails for a new reason, add a
section here documenting the failure mode and update the prompt above so it
doesn't recur.

### 2026-05-04 — Composer now allows spaced ValueSet names

Originally the ValueSet Composer enforced PascalCase identifiers (no
spaces) for `ValueSet.name`, while LLM-generated retrieves naturally
read as `[Condition: "Diabetes Mellitus"]`. That mismatch was the
naming-consistency bug above (#2 in the prior section). With the
composer relaxed (PR #93), the same string can be used end-to-end:
the `Name` field accepts `"Diabetes Mellitus"`, the FHIR
`ValueSet.name` is stored that way, and the inserted CQL declaration
`valueset "Diabetes Mellitus": '...'` lines up with the retrieve.
The "naming consistency" rule still applies — declaration name and
retrieve name must match — but it's now a much smaller hazard
because the natural form works everywhere.
