library SimplifiedDiabetesControl version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

codesystem "ICD10": 'http://hl7.org/fhir/sid/icd-10'
codesystem "LOINC": 'http://loinc.org'

valueset "Diabetes Conditions": 'http://example.org/ValueSet/diabetes-conditions'
valueset "HbA1c Lab Tests": 'http://example.org/ValueSet/hba1c-tests'

// Define codes that will work with our current schema
code "HbA1c LOINC": '4548-4' from "LOINC" display 'Hemoglobin A1c'
code "Diabetes Type 2": 'E11' from "ICD10" display 'Type 2 diabetes mellitus'

context Patient

define "Measurement Period":
  Interval[@2023-01-01, @2023-12-31]

define "Initial Population":
  exists(
    [Condition: code in "Diabetes Conditions"] Diabetes
      where Diabetes.clinicalStatus ~ 'active'
        and Diabetes.onset before end of "Measurement Period"
  )

define "Denominator":
  "Initial Population"

define "Most Recent HbA1c":
  Last(
    [Observation: code in "HbA1c Lab Tests"] HbA1c
      where HbA1c.effective during "Measurement Period"
        and HbA1c.status ~ 'final'
      sort by effective
  )

define "Numerator":
  "Most Recent HbA1c" is not null
    and "Most Recent HbA1c".value < 9 '%'

define "Measure Score":
  if "Denominator" then
    if "Numerator" then 100
    else 0
  else null