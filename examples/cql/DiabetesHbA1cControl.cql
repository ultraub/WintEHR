library DiabetesHbA1cControl version '1.0.0'

using FHIR version '4.0.1'

// Value sets - using OIDs that would need to be loaded
valueset "Diabetes": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.103.12.1001'
valueset "HbA1c Laboratory Test": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1013'

// Parameters
parameter "Measurement Period" Interval<DateTime>
  default Interval[@2024-01-01T00:00:00.0, @2024-12-31T23:59:59.999]

// Context
context Patient

// Initial Population: Patients 18-75 with diabetes
define "Initial Population":
  "In Demographic" and "Has Diabetes Diagnosis"

define "In Demographic":
  AgeInYearsAt(start of "Measurement Period") >= 18
    and AgeInYearsAt(start of "Measurement Period") <= 75

define "Has Diabetes Diagnosis":
  exists (
    [Condition: "Diabetes"] Diabetes
      where Diabetes.clinicalStatus ~ 'active'
        and Diabetes.onset before end of "Measurement Period"
  )

// Denominator: Same as initial population
define "Denominator":
  "Initial Population"

// Denominator Exclusions: Patients with advanced illness, hospice, etc.
define "Denominator Exclusions":
  false // Simplified for this example

// Numerator: Patients with HbA1c < 8%
define "Numerator":
  "Has Diabetes Control"

define "Has Diabetes Control":
  "Most Recent HbA1c" is not null
    and "Most Recent HbA1c".value < 8 '%'

define "Most Recent HbA1c":
  Last(
    [Observation: "HbA1c Laboratory Test"] HbA1c
      where HbA1c.status in {'final', 'amended', 'corrected'}
        and HbA1c.effective during "Measurement Period"
      sort by effective
  )

// Stratification by age groups
define "Stratification 1":
  AgeInYearsAt(start of "Measurement Period") >= 18
    and AgeInYearsAt(start of "Measurement Period") < 40

define "Stratification 2":
  AgeInYearsAt(start of "Measurement Period") >= 40
    and AgeInYearsAt(start of "Measurement Period") < 65

define "Stratification 3":
  AgeInYearsAt(start of "Measurement Period") >= 65
    and AgeInYearsAt(start of "Measurement Period") <= 75

// Supplemental Data Elements
define "SDE Ethnicity":
  Patient.extension[url='http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity'].value

define "SDE Payer":
  [Coverage] Payer
    return Payer.type

define "SDE Race":
  Patient.extension[url='http://hl7.org/fhir/us/core/StructureDefinition/us-core-race'].value

define "SDE Sex":
  Patient.gender