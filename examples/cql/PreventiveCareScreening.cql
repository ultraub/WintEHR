library PreventiveCareScreening version '1.0.0'

using FHIR version '4.0.1'

// Breast Cancer Screening Measure
// Based on CMS125v11

// Value sets
valueset "Mammography": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1018'
valueset "Bilateral Mastectomy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1005'
valueset "Unilateral Mastectomy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1133'
valueset "History of Bilateral Mastectomy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1068'

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2024-01-01T00:00:00.0, @2024-12-31T23:59:59.999]

context Patient

// Initial Population: Women 51-74 years of age
define "Initial Population":
  Patient.gender = 'female'
    and AgeInYearsAt(end of "Measurement Period") >= 51
    and AgeInYearsAt(end of "Measurement Period") <= 74

// Denominator
define "Denominator":
  "Initial Population"

// Denominator Exclusions: Women with bilateral mastectomy or two unilateral mastectomies
define "Denominator Exclusions":
  "Has Bilateral Mastectomy"
    or "Has Two Unilateral Mastectomies"

define "Has Bilateral Mastectomy":
  exists (
    [Procedure: "Bilateral Mastectomy"] BilateralMastectomy
      where BilateralMastectomy.performed before end of "Measurement Period"
        and BilateralMastectomy.status = 'completed'
  )
  or exists (
    [Condition: "History of Bilateral Mastectomy"] History
      where History.onset before end of "Measurement Period"
  )

define "Has Two Unilateral Mastectomies":
  Count(
    [Procedure: "Unilateral Mastectomy"] UnilateralMastectomy
      where UnilateralMastectomy.performed before end of "Measurement Period"
        and UnilateralMastectomy.status = 'completed'
  ) >= 2

// Numerator: Women with mammography in the past 2 years
define "Numerator":
  exists "Mammogram In Past Two Years"

define "Mammogram In Past Two Years":
  [Procedure: "Mammography"] Mammogram
    where Mammogram.performed during Interval[start of "Measurement Period" - 2 years, end of "Measurement Period"]
      and Mammogram.status = 'completed'

// Cervical Cancer Screening
define "Cervical Cancer Screening Population":
  Patient.gender = 'female'
    and AgeInYearsAt(end of "Measurement Period") >= 21
    and AgeInYearsAt(end of "Measurement Period") <= 64

// Colorectal Cancer Screening
define "Colorectal Cancer Screening Population":
  AgeInYearsAt(end of "Measurement Period") >= 45
    and AgeInYearsAt(end of "Measurement Period") <= 75

// Tobacco Use Screening
define "Tobacco Use Screening Population":
  AgeInYearsAt(end of "Measurement Period") >= 18

define "Has Tobacco Screening":
  exists (
    [Observation: code in "Tobacco Use Screening"] Screening
      where Screening.effective during "Measurement Period"
        and Screening.status in {'final', 'amended', 'corrected'}
  )