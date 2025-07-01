library SimplifiedDiabetesControl version '1.0.0'

using FHIR version '4.0.1'

// A simplified CQL measure that maps directly to the current EMR schema
// This version uses specific codes that exist in the Synthea data

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2024-01-01T00:00:00.0, @2024-12-31T23:59:59.999]

context Patient

// Initial Population: Adults with diabetes
define "Initial Population":
  AgeInYearsAt(start of "Measurement Period") >= 18
    and AgeInYearsAt(start of "Measurement Period") <= 75
    and exists "Diabetes Conditions"

// Look for diabetes using ICD-10 codes that Synthea uses
define "Diabetes Conditions":
  [Condition] C
    where C.clinicalStatus = 'active'
      and (
        C.code.coding.code starts with 'E10' // Type 1 diabetes
        or C.code.coding.code starts with 'E11' // Type 2 diabetes
      )

// Denominator is same as initial population
define "Denominator":
  "Initial Population"

// Numerator: Patients with good HbA1c control
define "Numerator":
  exists "HbA1c Under 8 Percent"

// Look for HbA1c observations
define "HbA1c Under 8 Percent":
  [Observation] O
    where O.status in {'final', 'amended'}
      and O.code.coding.code = '4548-4' // LOINC code for HbA1c
      and O.effective during "Measurement Period"
      and O.value.value < 8.0

// Get most recent HbA1c value
define "Most Recent HbA1c Value":
  Last(
    [Observation] O
      where O.status in {'final', 'amended'}
        and O.code.coding.code = '4548-4'
        and O.effective during "Measurement Period"
      sort by effective
  ).value.value

// Check if patient has any HbA1c test
define "Has HbA1c Test":
  exists (
    [Observation] O
      where O.status in {'final', 'amended'}
        and O.code.coding.code = '4548-4'
        and O.effective during "Measurement Period"
  )

// Stratification by HbA1c ranges
define "HbA1c Less Than 7":
  "Most Recent HbA1c Value" < 7.0

define "HbA1c 7 to 8":
  "Most Recent HbA1c Value" >= 7.0
    and "Most Recent HbA1c Value" < 8.0

define "HbA1c 8 to 9":
  "Most Recent HbA1c Value" >= 8.0
    and "Most Recent HbA1c Value" < 9.0

define "HbA1c Greater Than 9":
  "Most Recent HbA1c Value" >= 9.0