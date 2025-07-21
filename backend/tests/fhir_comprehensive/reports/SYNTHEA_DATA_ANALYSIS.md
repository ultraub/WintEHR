# Synthea Data Analysis Report

Generated: 2025-07-20T23:57:46.763944

## Summary
- Total Resources: 5,864
- Resource Types: 24
- Indexed Parameters: 226

## Resource Counts
- Observation: 1,425
- Procedure: 1,058
- DiagnosticReport: 578
- ExplanationOfBenefit: 516
- Claim: 516
- DocumentReference: 418
- Encounter: 418
- Condition: 219
- Immunization: 142
- SupplyDelivery: 129
- MedicationRequest: 99
- Location: 38
- Practitioner: 37
- PractitionerRole: 37
- Organization: 37
- CarePlan: 31
- CareTeam: 31
- Device: 31
- AllergyIntolerance: 22
- MedicationAdministration: 20
- Medication: 20
- ImagingStudy: 18
- Patient: 13
- Provenance: 11

## Top Relationships
- AllergyIntolerance.patient → Patient: 2
- Condition.subject → Patient: 4
- MedicationRequest.subject → Patient: 1
- Observation.reasonReference[0] → Resource: 2
- Observation.subject → Patient: 6

## Search Parameters by Resource Type

### AllergyIntolerance
Parameters: _id, _lastUpdated, _profile, clinical-status, code, patient, verification-status

### Basic
Parameters: _id, _lastUpdated

### CarePlan
Parameters: _id, _lastUpdated, _profile, care-team, category, date, encounter, intent, patient, status, subject

### CareTeam
Parameters: _id, _lastUpdated, _profile, participant, patient, status, subject

### Claim
Parameters: _id, _lastUpdated, created, patient, provider, status, use

### Condition
Parameters: _id, _lastUpdated, _profile, category, clinical-status, code, encounter, onset-date, patient, recorded-date, subject, verification-status

### Device
Parameters: _id, _lastUpdated, _profile, status

### DiagnosticReport
Parameters: _id, _lastUpdated, _profile, category, code, date, encounter, issued, patient, performer, result, status, subject

### DocumentReference
Parameters: _id, _lastUpdated, _profile, author, category, date, identifier, patient, status, subject, type

### Encounter
Parameters: _id, _lastUpdated, _profile, class, location, patient, service-provider, status, subject, type

## Patient Demographics
- Genders: {'male': 5, 'female': 6}
- Deceased: 1
- Birth Year Range: {'min': '1975', 'max': '2022'}

## Temporal Ranges
- Condition: 1988-08-08 to 2025-04-24
- Observation: 1996-09-23 to 2025-04-24
- MedicationRequest: 1976-08-20 to 2025-05-16

## Code Systems Used
- Condition: http://snomed.info/sct
- MedicationRequest: http://www.nlm.nih.gov/research/umls/rxnorm
- Observation: http://loinc.org
- Procedure: http://snomed.info/sct