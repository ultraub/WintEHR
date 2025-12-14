/**
 * Clinical Domain Type Definitions for WintEHR
 *
 * Types for clinical workflows, medical data, and healthcare-specific entities.
 * These types align with FHIR R4 resources but provide additional convenience
 * properties for frontend use.
 */

import type { FHIRResource, Reference, CodeableConcept, Period, Identifier } from './fhir';

// =============================================================================
// Patient Types
// =============================================================================

/**
 * Patient name structure (simplified from FHIR HumanName)
 */
export interface PatientName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  family: string;
  given: string[];
  prefix?: string[];
  suffix?: string[];
}

/**
 * Patient contact information
 */
export interface PatientContact {
  system: 'phone' | 'email' | 'fax' | 'pager' | 'url' | 'sms' | 'other';
  value: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
}

/**
 * Patient address
 */
export interface PatientAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Patient resource (frontend-friendly version of FHIR Patient)
 */
export interface Patient extends FHIRResource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  active?: boolean;
  name: PatientName[];
  telecom?: PatientContact[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: PatientAddress[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  communication?: {
    language: CodeableConcept;
    preferred?: boolean;
  }[];
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
}

/**
 * Patient summary for display in lists and headers
 */
export interface PatientSummary {
  id: string;
  mrn?: string;
  fullName: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  age: number;
  primaryPhone?: string;
  primaryEmail?: string;
  photoUrl?: string;
}

// =============================================================================
// Condition/Problem Types
// =============================================================================

/**
 * Clinical status of a condition
 */
export type ConditionClinicalStatus =
  | 'active'
  | 'recurrence'
  | 'relapse'
  | 'inactive'
  | 'remission'
  | 'resolved';

/**
 * Verification status of a condition
 */
export type ConditionVerificationStatus =
  | 'unconfirmed'
  | 'provisional'
  | 'differential'
  | 'confirmed'
  | 'refuted'
  | 'entered-in-error';

/**
 * Condition/Problem resource
 */
export interface Condition extends FHIRResource {
  resourceType: 'Condition';
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: { value: number; unit: string };
  onsetPeriod?: Period;
  onsetRange?: { low?: { value: number }; high?: { value: number } };
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: { value: number; unit: string };
  abatementPeriod?: Period;
  abatementRange?: { low?: { value: number }; high?: { value: number } };
  abatementString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  note?: { text: string; time?: string; authorReference?: Reference }[];
}

/**
 * Condition summary for display
 */
export interface ConditionSummary {
  id: string;
  code: string;
  display: string;
  clinicalStatus: ConditionClinicalStatus;
  verificationStatus: ConditionVerificationStatus;
  onsetDate?: string;
  severity?: string;
  category?: string;
}

// =============================================================================
// Medication Types
// =============================================================================

/**
 * Medication request status
 */
export type MedicationRequestStatus =
  | 'active'
  | 'on-hold'
  | 'cancelled'
  | 'completed'
  | 'entered-in-error'
  | 'stopped'
  | 'draft'
  | 'unknown';

/**
 * Medication request intent
 */
export type MedicationRequestIntent =
  | 'proposal'
  | 'plan'
  | 'order'
  | 'original-order'
  | 'reflex-order'
  | 'filler-order'
  | 'instance-order'
  | 'option';

/**
 * Dosage instruction
 */
export interface DosageInstruction {
  sequence?: number;
  text?: string;
  timing?: {
    repeat?: {
      frequency?: number;
      period?: number;
      periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
      when?: string[];
    };
    code?: CodeableConcept;
  };
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  doseAndRate?: {
    type?: CodeableConcept;
    doseQuantity?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
    doseRange?: {
      low?: { value: number; unit: string };
      high?: { value: number; unit: string };
    };
  }[];
  maxDosePerPeriod?: {
    numerator?: { value: number; unit: string };
    denominator?: { value: number; unit: string };
  };
}

/**
 * Medication request resource
 */
export interface MedicationRequest extends FHIRResource {
  resourceType: 'MedicationRequest';
  identifier?: Identifier[];
  status: MedicationRequestStatus;
  statusReason?: CodeableConcept;
  intent: MedicationRequestIntent;
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  reportedBoolean?: boolean;
  reportedReference?: Reference;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  encounter?: Reference;
  supportingInformation?: Reference[];
  authoredOn?: string;
  requester?: Reference;
  performer?: Reference;
  performerType?: CodeableConcept;
  recorder?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  groupIdentifier?: Identifier;
  courseOfTherapyType?: CodeableConcept;
  insurance?: Reference[];
  note?: { text: string }[];
  dosageInstruction?: DosageInstruction[];
  dispenseRequest?: {
    initialFill?: { quantity?: { value: number; unit: string }; duration?: { value: number; unit: string } };
    dispenseInterval?: { value: number; unit: string };
    validityPeriod?: Period;
    numberOfRepeatsAllowed?: number;
    quantity?: { value: number; unit: string };
    expectedSupplyDuration?: { value: number; unit: string };
    performer?: Reference;
  };
  substitution?: {
    allowedBoolean?: boolean;
    allowedCodeableConcept?: CodeableConcept;
    reason?: CodeableConcept;
  };
  priorPrescription?: Reference;
  detectedIssue?: Reference[];
  eventHistory?: Reference[];
}

/**
 * Medication summary for display
 */
export interface MedicationSummary {
  id: string;
  name: string;
  code?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  status: MedicationRequestStatus;
  startDate?: string;
  endDate?: string;
  prescriber?: string;
  instructions?: string;
}

// =============================================================================
// Allergy Types
// =============================================================================

/**
 * Allergy clinical status
 */
export type AllergyClinicalStatus = 'active' | 'inactive' | 'resolved';

/**
 * Allergy verification status
 */
export type AllergyVerificationStatus = 'unconfirmed' | 'confirmed' | 'refuted' | 'entered-in-error';

/**
 * Allergy criticality
 */
export type AllergyCriticality = 'low' | 'high' | 'unable-to-assess';

/**
 * Allergy category
 */
export type AllergyCategory = 'food' | 'medication' | 'environment' | 'biologic';

/**
 * Allergy reaction
 */
export interface AllergyReaction {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  description?: string;
  onset?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: CodeableConcept;
  note?: { text: string }[];
}

/**
 * AllergyIntolerance resource
 */
export interface AllergyIntolerance extends FHIRResource {
  resourceType: 'AllergyIntolerance';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: AllergyCategory[];
  criticality?: AllergyCriticality;
  code?: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: { value: number; unit: string };
  onsetPeriod?: Period;
  onsetRange?: { low?: { value: number }; high?: { value: number } };
  onsetString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  lastOccurrence?: string;
  note?: { text: string }[];
  reaction?: AllergyReaction[];
}

/**
 * Allergy summary for display
 */
export interface AllergySummary {
  id: string;
  substance: string;
  code?: string;
  category: AllergyCategory;
  criticality?: AllergyCriticality;
  clinicalStatus: AllergyClinicalStatus;
  reactions?: string[];
  recordedDate?: string;
}

// =============================================================================
// Order Types
// =============================================================================

/**
 * Service request status
 */
export type ServiceRequestStatus =
  | 'draft'
  | 'active'
  | 'on-hold'
  | 'revoked'
  | 'completed'
  | 'entered-in-error'
  | 'unknown';

/**
 * Service request intent
 */
export type ServiceRequestIntent =
  | 'proposal'
  | 'plan'
  | 'directive'
  | 'order'
  | 'original-order'
  | 'reflex-order'
  | 'filler-order'
  | 'instance-order'
  | 'option';

/**
 * Service request priority
 */
export type ServiceRequestPriority = 'routine' | 'urgent' | 'asap' | 'stat';

/**
 * ServiceRequest resource (orders)
 */
export interface ServiceRequest extends FHIRResource {
  resourceType: 'ServiceRequest';
  identifier?: Identifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  replaces?: Reference[];
  requisition?: Identifier;
  status: ServiceRequestStatus;
  intent: ServiceRequestIntent;
  category?: CodeableConcept[];
  priority?: ServiceRequestPriority;
  doNotPerform?: boolean;
  code?: CodeableConcept;
  orderDetail?: CodeableConcept[];
  quantityQuantity?: { value: number; unit: string };
  quantityRatio?: { numerator?: { value: number }; denominator?: { value: number } };
  quantityRange?: { low?: { value: number }; high?: { value: number } };
  subject: Reference;
  encounter?: Reference;
  occurrenceDateTime?: string;
  occurrencePeriod?: Period;
  occurrenceTiming?: { code?: CodeableConcept };
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  authoredOn?: string;
  requester?: Reference;
  performerType?: CodeableConcept;
  performer?: Reference[];
  locationCode?: CodeableConcept[];
  locationReference?: Reference[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  insurance?: Reference[];
  supportingInfo?: Reference[];
  specimen?: Reference[];
  bodySite?: CodeableConcept[];
  note?: { text: string }[];
  patientInstruction?: string;
  relevantHistory?: Reference[];
}

/**
 * Order summary for display
 */
export interface OrderSummary {
  id: string;
  code: string;
  display: string;
  category: string;
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  orderedDate: string;
  requester?: string;
  performer?: string;
}

// =============================================================================
// Observation/Result Types
// =============================================================================

/**
 * Observation status
 */
export type ObservationStatus =
  | 'registered'
  | 'preliminary'
  | 'final'
  | 'amended'
  | 'corrected'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/**
 * Observation resource
 */
export interface Observation extends FHIRResource {
  resourceType: 'Observation';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: ObservationStatus;
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  focus?: Reference[];
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  effectiveTiming?: { code?: CodeableConcept };
  effectiveInstant?: string;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: { value: number; unit: string; system?: string; code?: string };
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: { low?: { value: number; unit: string }; high?: { value: number; unit: string } };
  valueRatio?: { numerator?: { value: number }; denominator?: { value: number } };
  valueSampledData?: { origin: { value: number }; period: number; dimensions: number; data?: string };
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: { text: string }[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: {
    low?: { value: number; unit: string };
    high?: { value: number; unit: string };
    type?: CodeableConcept;
    appliesTo?: CodeableConcept[];
    age?: { low?: { value: number }; high?: { value: number } };
    text?: string;
  }[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: {
    code: CodeableConcept;
    valueQuantity?: { value: number; unit: string };
    valueCodeableConcept?: CodeableConcept;
    valueString?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueRange?: { low?: { value: number }; high?: { value: number } };
    dataAbsentReason?: CodeableConcept;
    interpretation?: CodeableConcept[];
    referenceRange?: { low?: { value: number }; high?: { value: number }; text?: string }[];
  }[];
}

/**
 * Lab result summary for display
 */
export interface LabResultSummary {
  id: string;
  code: string;
  display: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  status: ObservationStatus;
  interpretation?: 'normal' | 'abnormal' | 'critical' | 'unknown';
  effectiveDate: string;
  category?: string;
}

/**
 * Vital sign summary for display
 */
export interface VitalSignSummary {
  id: string;
  type: 'blood-pressure' | 'heart-rate' | 'respiratory-rate' | 'temperature' | 'oxygen-saturation' | 'weight' | 'height' | 'bmi';
  value: string;
  unit: string;
  effectiveDate: string;
  interpretation?: 'normal' | 'abnormal' | 'critical';
}

// =============================================================================
// Encounter Types
// =============================================================================

/**
 * Encounter status
 */
export type EncounterStatus =
  | 'planned'
  | 'arrived'
  | 'triaged'
  | 'in-progress'
  | 'onleave'
  | 'finished'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/**
 * Encounter class
 */
export type EncounterClass =
  | 'ambulatory'
  | 'emergency'
  | 'field'
  | 'home'
  | 'inpatient'
  | 'observation'
  | 'preanmission'
  | 'short-stay'
  | 'virtual';

/**
 * Encounter resource
 */
export interface Encounter extends FHIRResource {
  resourceType: 'Encounter';
  identifier?: Identifier[];
  status: EncounterStatus;
  statusHistory?: { status: EncounterStatus; period: Period }[];
  class: { system?: string; code: string; display?: string };
  classHistory?: { class: { code: string }; period: Period }[];
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  priority?: CodeableConcept;
  subject?: Reference;
  episodeOfCare?: Reference[];
  basedOn?: Reference[];
  participant?: {
    type?: CodeableConcept[];
    period?: Period;
    individual?: Reference;
  }[];
  appointment?: Reference[];
  period?: Period;
  length?: { value: number; unit: string };
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  diagnosis?: {
    condition: Reference;
    use?: CodeableConcept;
    rank?: number;
  }[];
  account?: Reference[];
  hospitalization?: {
    preAdmissionIdentifier?: Identifier;
    origin?: Reference;
    admitSource?: CodeableConcept;
    reAdmission?: CodeableConcept;
    dietPreference?: CodeableConcept[];
    specialCourtesy?: CodeableConcept[];
    specialArrangement?: CodeableConcept[];
    destination?: Reference;
    dischargeDisposition?: CodeableConcept;
  };
  location?: {
    location: Reference;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    physicalType?: CodeableConcept;
    period?: Period;
  }[];
  serviceProvider?: Reference;
  partOf?: Reference;
}

/**
 * Encounter summary for display
 */
export interface EncounterSummary {
  id: string;
  type: string;
  class: EncounterClass;
  status: EncounterStatus;
  startDate: string;
  endDate?: string;
  provider?: string;
  location?: string;
  reasonForVisit?: string;
}

// =============================================================================
// Clinical Notes Types
// =============================================================================

/**
 * Document reference status
 */
export type DocumentStatus = 'current' | 'superseded' | 'entered-in-error';

/**
 * Document type
 */
export type ClinicalNoteType =
  | 'progress-note'
  | 'discharge-summary'
  | 'consultation-note'
  | 'history-physical'
  | 'operative-note'
  | 'procedure-note'
  | 'nursing-note'
  | 'other';

/**
 * Clinical note
 */
export interface ClinicalNote {
  id: string;
  type: ClinicalNoteType;
  title: string;
  status: DocumentStatus;
  date: string;
  author?: string;
  encounter?: string;
  content: string;
  signed: boolean;
  signedDate?: string;
  signedBy?: string;
}

// =============================================================================
// Pharmacy Types
// =============================================================================

/**
 * Dispense status
 */
export type DispenseStatus =
  | 'preparation'
  | 'in-progress'
  | 'cancelled'
  | 'on-hold'
  | 'completed'
  | 'entered-in-error'
  | 'stopped'
  | 'declined'
  | 'unknown';

/**
 * Pharmacy queue item
 */
export interface PharmacyQueueItem {
  id: string;
  prescriptionId: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  dose: string;
  quantity: number;
  status: DispenseStatus;
  priority: 'routine' | 'urgent' | 'stat';
  orderedDate: string;
  dueDate?: string;
  pharmacist?: string;
  notes?: string;
}

// =============================================================================
// Imaging Types
// =============================================================================

/**
 * Imaging study status
 */
export type ImagingStudyStatus =
  | 'registered'
  | 'available'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/**
 * Imaging modality
 */
export type ImagingModality =
  | 'CR'  // Computed Radiography
  | 'CT'  // Computed Tomography
  | 'MR'  // Magnetic Resonance
  | 'US'  // Ultrasound
  | 'XA'  // X-Ray Angiography
  | 'NM'  // Nuclear Medicine
  | 'PT'  // PET
  | 'DX'  // Digital Radiography
  | 'MG'  // Mammography
  | 'OT'; // Other

/**
 * Imaging study summary
 */
export interface ImagingStudySummary {
  id: string;
  accessionNumber?: string;
  modality: ImagingModality;
  description: string;
  status: ImagingStudyStatus;
  date: string;
  numberOfSeries: number;
  numberOfInstances: number;
  referrer?: string;
  bodyPart?: string;
}
