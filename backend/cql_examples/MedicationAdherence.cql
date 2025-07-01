library MedicationAdherence version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

codesystem "RxNorm": 'http://www.nlm.nih.gov/research/umls/rxnorm'

// Chronic medication value sets
valueset "Diabetes Medications": 'http://example.org/ValueSet/diabetes-medications'
valueset "Hypertension Medications": 'http://example.org/ValueSet/hypertension-medications'
valueset "Statin Medications": 'http://example.org/ValueSet/statin-medications'

context Patient

define "Measurement Period":
  Interval[@2023-01-01, @2023-12-31]

define "Has Chronic Medications":
  exists("Active Chronic Medications")

define "Active Chronic Medications":
  (
    [MedicationRequest: medication in "Diabetes Medications"]
    union [MedicationRequest: medication in "Hypertension Medications"]
    union [MedicationRequest: medication in "Statin Medications"]
  ) Medication
    where Medication.status = 'active'
      and Medication.authoredOn before end of "Measurement Period"

define "Initial Population":
  "Has Chronic Medications"

define "Denominator":
  "Initial Population"

// Calculate medication possession ratio (simplified)
define "Days Supply":
  Sum(
    "Active Chronic Medications" M
      return M.dispenseRequest.quantity.value * 30
  )

define "Days in Period":
  duration in days of "Measurement Period"

define "Medication Possession Ratio":
  if "Days in Period" > 0 then
    Min({ "Days Supply" / "Days in Period", 1.0 })
  else 0

define "Good Adherence":
  "Medication Possession Ratio" >= 0.80

define "Numerator":
  "Good Adherence"

// Additional adherence metrics
define "Gap Days":
  Max({
    "Days in Period" - "Days Supply",
    0
  })

define "Adherence Percentage":
  Round("Medication Possession Ratio" * 100)