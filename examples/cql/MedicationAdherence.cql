library MedicationAdherence version '1.0.0'

using FHIR version '4.0.1'

// Medication Adherence for Chronic Conditions
// Simplified version focusing on diabetes medications

// Value sets
valueset "Diabetes Medications": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.196.12.1001'
valueset "Diabetes": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.103.12.1001'

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2024-01-01T00:00:00.0, @2024-12-31T23:59:59.999]

context Patient

// Patients with diabetes on medications
define "Initial Population":
  exists "Active Diabetes Diagnosis"
    and exists "Active Diabetes Medications"

define "Active Diabetes Diagnosis":
  [Condition: "Diabetes"] Diabetes
    where Diabetes.clinicalStatus ~ 'active'

define "Active Diabetes Medications":
  [MedicationRequest: "Diabetes Medications"] Medication
    where Medication.status = 'active'
      and Medication.authoredOn during "Measurement Period"

// Calculate Proportion of Days Covered (PDC)
define "Proportion of Days Covered":
  "Days Covered" / "Days in Treatment Period"

define "Days in Treatment Period":
  days between start of "Measurement Period" and end of "Measurement Period"

define "Days Covered":
  Sum(
    "Medication Dispensing Events" Dispense
      return days between Dispense.whenHandedOver and 
        (Dispense.whenHandedOver + Dispense.daysSupply days)
  )

define "Medication Dispensing Events":
  [MedicationDispense: "Diabetes Medications"] Dispense
    where Dispense.status = 'completed'
      and Dispense.whenHandedOver during "Measurement Period"

// Numerator: Patients with PDC >= 80%
define "Numerator":
  "Proportion of Days Covered" >= 0.80

// Gap in therapy
define "Has Gap in Therapy":
  exists (
    "Gaps in Coverage" Gap
      where Gap > 30 days
  )

define "Gaps in Coverage":
  // This would calculate gaps between dispensing events
  // Simplified for example
  {} as List<System.Quantity>

// Stratification by medication class
define "On Metformin":
  exists (
    [MedicationRequest] Med
      where Med.medication.coding.code = '6809' // Metformin RxNorm code
        and Med.status = 'active'
  )

define "On Insulin":
  exists (
    [MedicationRequest] Med
      where Med.medication.coding.display contains 'insulin'
        and Med.status = 'active'
  )