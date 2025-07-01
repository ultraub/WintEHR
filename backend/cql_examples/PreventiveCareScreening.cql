library PreventiveCareScreening version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

codesystem "LOINC": 'http://loinc.org'

// Mammography codes
valueset "Mammography": 'http://example.org/ValueSet/mammography'
code "Mammography LOINC": '24606-6' from "LOINC" display 'MG Breast Screening'

// Colonoscopy codes  
valueset "Colonoscopy": 'http://example.org/ValueSet/colonoscopy'
code "Colonoscopy LOINC": '34120-2' from "LOINC" display 'Colonoscopy Study observation'

context Patient

define "Measurement Period":
  Interval[@2023-01-01, @2023-12-31]

// Mammography Screening Measure
define "Female 50 to 74":
  Patient.gender = 'female'
    and AgeInYearsAt(start of "Measurement Period") between 50 and 74

define "Mammography Initial Population":
  "Female 50 to 74"

define "Mammography Denominator":
  "Mammography Initial Population"

define "Had Mammography":
  exists(
    [Observation: code in "Mammography"] Mammo
      where Mammo.effective 2 years or less before end of "Measurement Period"
        and Mammo.status ~ 'final'
  )

define "Mammography Numerator":
  "Had Mammography"

// Colonoscopy Screening Measure  
define "Age 50 to 75":
  AgeInYearsAt(start of "Measurement Period") between 50 and 75

define "Colonoscopy Initial Population":
  "Age 50 to 75"

define "Colonoscopy Denominator":
  "Colonoscopy Initial Population"

define "Had Colonoscopy":
  exists(
    [Observation: code in "Colonoscopy"] Colo
      where Colo.effective 10 years or less before end of "Measurement Period"
        and Colo.status ~ 'final'
  )

define "Colonoscopy Numerator":
  "Had Colonoscopy"