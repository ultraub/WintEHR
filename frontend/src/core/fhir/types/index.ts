/**
 * FHIR R4 TypeScript Type Definitions
 * 
 * Core type definitions for FHIR resources used in WintEHR.
 * Based on FHIR R4 specification.
 * 
 * @since 2025-01-21
 */

// Base types
export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: Period;
}

export interface Address {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: Period;
}

export interface Coding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface Quantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface Range {
  low?: Quantity;
  high?: Quantity;
}

export interface Ratio {
  numerator?: Quantity;
  denominator?: Quantity;
}

export interface Annotation {
  authorReference?: Reference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface Dosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: CodeableConcept[];
  patientInstruction?: string;
  timing?: Timing;
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  site?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  doseAndRate?: DoseAndRate[];
  maxDosePerPeriod?: Ratio;
  maxDosePerAdministration?: Quantity;
  maxDosePerLifetime?: Quantity;
}

export interface DoseAndRate {
  type?: CodeableConcept;
  doseRange?: Range;
  doseQuantity?: Quantity;
  rateRatio?: Ratio;
  rateRange?: Range;
  rateQuantity?: Quantity;
}

export interface Timing {
  event?: string[];
  repeat?: TimingRepeat;
  code?: CodeableConcept;
}

export interface TimingRepeat {
  boundsDuration?: Duration;
  boundsRange?: Range;
  boundsPeriod?: Period;
  count?: number;
  countMax?: number;
  duration?: number;
  durationMax?: number;
  durationUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  frequency?: number;
  frequencyMax?: number;
  period?: number;
  periodMax?: number;
  periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  dayOfWeek?: string[];
  timeOfDay?: string[];
  when?: string[];
  offset?: number;
}

export interface Duration extends Quantity {
  // Duration is a Quantity with specific constraints
}

export interface Meta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: Coding[];
  tag?: Coding[];
}

// Base Resource
export interface Resource {
  resourceType: string;
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
}

export interface DomainResource extends Resource {
  text?: Narrative;
  contained?: Resource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
}

export interface Narrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string;
}

export interface Extension {
  url: string;
  valueString?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
  valueDateTime?: string;
  valueCodeableConcept?: CodeableConcept;
  valueReference?: Reference;
  // ... other value types as needed
}

// Clinical Resources

export interface Patient extends DomainResource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: Attachment[];
  contact?: PatientContact[];
  communication?: PatientCommunication[];
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
  link?: PatientLink[];
}

export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: Reference;
  period?: Period;
}

export interface PatientCommunication {
  language: CodeableConcept;
  preferred?: boolean;
}

export interface PatientLink {
  other: Reference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface Condition extends DomainResource {
  resourceType: 'Condition';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: Quantity;
  abatementPeriod?: Period;
  abatementRange?: Range;
  abatementString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  stage?: ConditionStage[];
  evidence?: ConditionEvidence[];
  note?: Annotation[];
}

export interface ConditionStage {
  summary?: CodeableConcept;
  assessment?: Reference[];
  type?: CodeableConcept;
}

export interface ConditionEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

export interface MedicationRequest extends DomainResource {
  resourceType: 'MedicationRequest';
  identifier?: Identifier[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  statusReason?: CodeableConcept;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
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
  note?: Annotation[];
  dosageInstruction?: Dosage[];
  dispenseRequest?: MedicationRequestDispenseRequest;
  substitution?: MedicationRequestSubstitution;
  priorPrescription?: Reference;
  detectedIssue?: Reference[];
  eventHistory?: Reference[];
}

export interface MedicationRequestDispenseRequest {
  initialFill?: MedicationRequestDispenseRequestInitialFill;
  dispenseInterval?: Duration;
  validityPeriod?: Period;
  numberOfRepeatsAllowed?: number;
  quantity?: Quantity;
  expectedSupplyDuration?: Duration;
  performer?: Reference;
}

export interface MedicationRequestDispenseRequestInitialFill {
  quantity?: Quantity;
  duration?: Duration;
}

export interface MedicationRequestSubstitution {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: CodeableConcept;
  reason?: CodeableConcept;
}

export interface AllergyIntolerance extends DomainResource {
  resourceType: 'AllergyIntolerance';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  lastOccurrence?: string;
  note?: Annotation[];
  reaction?: AllergyIntoleranceReaction[];
}

export interface AllergyIntoleranceReaction {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  description?: string;
  onset?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: CodeableConcept;
  note?: Annotation[];
}

export interface Observation extends DomainResource {
  resourceType: 'Observation';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  focus?: Reference[];
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  effectiveTiming?: Timing;
  effectiveInstant?: string;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: Annotation[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: ObservationReferenceRange[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: ObservationComponent[];
}

export interface SampledData {
  origin: Quantity;
  period: number;
  factor?: number;
  lowerLimit?: number;
  upperLimit?: number;
  dimensions: number;
  data?: string;
}

export interface ObservationReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: Range;
  text?: string;
}

export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

export interface Encounter extends DomainResource {
  resourceType: 'Encounter';
  identifier?: Identifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  statusHistory?: EncounterStatusHistory[];
  class: Coding;
  classHistory?: EncounterClassHistory[];
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  priority?: CodeableConcept;
  subject?: Reference;
  episodeOfCare?: Reference[];
  basedOn?: Reference[];
  participant?: EncounterParticipant[];
  appointment?: Reference[];
  period?: Period;
  length?: Duration;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  diagnosis?: EncounterDiagnosis[];
  account?: Reference[];
  hospitalization?: EncounterHospitalization;
  location?: EncounterLocation[];
  serviceProvider?: Reference;
  partOf?: Reference;
}

export interface EncounterStatusHistory {
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  period: Period;
}

export interface EncounterClassHistory {
  class: Coding;
  period: Period;
}

export interface EncounterParticipant {
  type?: CodeableConcept[];
  period?: Period;
  individual?: Reference;
}

export interface EncounterDiagnosis {
  condition: Reference;
  use?: CodeableConcept;
  rank?: number;
}

export interface EncounterHospitalization {
  preAdmissionIdentifier?: Identifier;
  origin?: Reference;
  admitSource?: CodeableConcept;
  reAdmission?: CodeableConcept;
  dietPreference?: CodeableConcept[];
  specialCourtesy?: CodeableConcept[];
  specialArrangement?: CodeableConcept[];
  destination?: Reference;
  dischargeDisposition?: CodeableConcept;
}

export interface EncounterLocation {
  location: Reference;
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  physicalType?: CodeableConcept;
  period?: Period;
}

export interface Procedure extends DomainResource {
  resourceType: 'Procedure';
  identifier?: Identifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  statusReason?: CodeableConcept;
  category?: CodeableConcept;
  code?: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  performedDateTime?: string;
  performedPeriod?: Period;
  performedString?: string;
  performedAge?: Quantity;
  performedRange?: Range;
  recorder?: Reference;
  asserter?: Reference;
  performer?: ProcedurePerformer[];
  location?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  bodySite?: CodeableConcept[];
  outcome?: CodeableConcept;
  report?: Reference[];
  complication?: CodeableConcept[];
  complicationDetail?: Reference[];
  followUp?: CodeableConcept[];
  note?: Annotation[];
  focalDevice?: ProcedureFocalDevice[];
  usedReference?: Reference[];
  usedCode?: CodeableConcept[];
}

export interface ProcedurePerformer {
  function?: CodeableConcept;
  actor: Reference;
  onBehalfOf?: Reference;
}

export interface ProcedureFocalDevice {
  action?: CodeableConcept;
  manipulated: Reference;
}

export interface Immunization extends DomainResource {
  resourceType: 'Immunization';
  identifier?: Identifier[];
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: CodeableConcept;
  vaccineCode: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  occurrenceDateTime?: string;
  occurrenceString?: string;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: CodeableConcept;
  location?: Reference;
  manufacturer?: Reference;
  lotNumber?: string;
  expirationDate?: string;
  site?: CodeableConcept;
  route?: CodeableConcept;
  doseQuantity?: Quantity;
  performer?: ImmunizationPerformer[];
  note?: Annotation[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  isSubpotent?: boolean;
  subpotentReason?: CodeableConcept[];
  education?: ImmunizationEducation[];
  programEligibility?: CodeableConcept[];
  fundingSource?: CodeableConcept;
  reaction?: ImmunizationReaction[];
  protocolApplied?: ImmunizationProtocolApplied[];
}

export interface ImmunizationPerformer {
  function?: CodeableConcept;
  actor: Reference;
}

export interface ImmunizationEducation {
  documentType?: string;
  publicationDate?: string;
  presentationDate?: string;
}

export interface ImmunizationReaction {
  date?: string;
  detail?: Reference;
  reported?: boolean;
}

export interface ImmunizationProtocolApplied {
  series?: string;
  authority?: Reference;
  targetDisease?: CodeableConcept[];
  doseNumberPositiveInt?: number;
  doseNumberString?: string;
  seriesDosesPositiveInt?: number;
  seriesDosesString?: string;
}

// Bundle types
export interface Bundle extends Resource {
  resourceType: 'Bundle';
  identifier?: Identifier;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  link?: BundleLink[];
  entry?: BundleEntry[];
  signature?: Signature;
}

export interface BundleLink {
  relation: string;
  url: string;
}

export interface BundleEntry {
  link?: BundleLink[];
  fullUrl?: string;
  resource?: Resource;
  search?: BundleEntrySearch;
  request?: BundleEntryRequest;
  response?: BundleEntryResponse;
}

export interface BundleEntrySearch {
  mode?: 'match' | 'include' | 'outcome';
  score?: number;
}

export interface BundleEntryRequest {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  ifMatch?: string;
  ifNoneExist?: string;
}

export interface BundleEntryResponse {
  status: string;
  location?: string;
  etag?: string;
  lastModified?: string;
  outcome?: Resource;
}

export interface Signature {
  type: Coding[];
  when: string;
  who: Reference;
  onBehalfOf?: Reference;
  targetFormat?: string;
  sigFormat?: string;
  data?: string;
}

// Pagination info extracted from bundle links
export interface PaginationInfo {
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextUrl: string | null;
  prevUrl: string | null;
  selfUrl: string | null;
  firstUrl: string | null;
  lastUrl: string | null;
}

// Search result types with pagination support
export interface SearchResult<T extends Resource = Resource> {
  resources: T[];
  total: number;
  bundle: Bundle;
  pagination: PaginationInfo;
}

// Operation outcome for errors
export interface OperationOutcome extends DomainResource {
  resourceType: 'OperationOutcome';
  issue: OperationOutcomeIssue[];
}

export interface OperationOutcomeIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  details?: CodeableConcept;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

// Practitioner types
export interface Practitioner extends DomainResource {
  resourceType: 'Practitioner';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  address?: Address[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  photo?: Attachment[];
  qualification?: PractitionerQualification[];
  communication?: CodeableConcept[];
}

export interface PractitionerQualification {
  identifier?: Identifier[];
  code: CodeableConcept;
  period?: Period;
  issuer?: Reference;
}

export interface Organization extends DomainResource {
  resourceType: 'Organization';
  identifier?: Identifier[];
  active?: boolean;
  type?: CodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: ContactPoint[];
  address?: Address[];
  partOf?: Reference;
  contact?: OrganizationContact[];
  endpoint?: Reference[];
}

export interface OrganizationContact {
  purpose?: CodeableConcept;
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
}

// Service Request
export interface ServiceRequest extends DomainResource {
  resourceType: 'ServiceRequest';
  identifier?: Identifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  replaces?: Reference[];
  requisition?: Identifier;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  code?: CodeableConcept;
  orderDetail?: CodeableConcept[];
  quantityQuantity?: Quantity;
  quantityRatio?: Ratio;
  quantityRange?: Range;
  subject: Reference;
  encounter?: Reference;
  occurrenceDateTime?: string;
  occurrencePeriod?: Period;
  occurrenceTiming?: Timing;
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
  note?: Annotation[];
  patientInstruction?: string;
  relevantHistory?: Reference[];
}

// Diagnostic Report
export interface DiagnosticReport extends DomainResource {
  resourceType: 'DiagnosticReport';
  identifier?: Identifier[];
  basedOn?: Reference[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  resultsInterpreter?: Reference[];
  specimen?: Reference[];
  result?: Reference[];
  imagingStudy?: Reference[];
  media?: DiagnosticReportMedia[];
  conclusion?: string;
  conclusionCode?: CodeableConcept[];
  presentedForm?: Attachment[];
}

export interface DiagnosticReportMedia {
  comment?: string;
  link: Reference;
}

// Coverage
export interface Coverage extends DomainResource {
  resourceType: 'Coverage';
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type?: CodeableConcept;
  policyHolder?: Reference;
  subscriber?: Reference;
  subscriberId?: string;
  beneficiary: Reference;
  dependent?: string;
  relationship?: CodeableConcept;
  period?: Period;
  payor: Reference[];
  class?: CoverageClass[];
  order?: number;
  network?: string;
  costToBeneficiary?: CoverageCostToBeneficiary[];
  subrogation?: boolean;
  contract?: Reference[];
}

export interface CoverageClass {
  type: CodeableConcept;
  value: string;
  name?: string;
}

export interface CoverageCostToBeneficiary {
  type?: CodeableConcept;
  valueQuantity?: Quantity;
  valueMoney?: Money;
  exception?: CoverageCostToBeneficiaryException[];
}

export interface CoverageCostToBeneficiaryException {
  type: CodeableConcept;
  period?: Period;
}

export interface Money {
  value?: number;
  currency?: string;
}

// Location
export interface Location extends DomainResource {
  resourceType: 'Location';
  identifier?: Identifier[];
  status?: 'active' | 'suspended' | 'inactive';
  operationalStatus?: Coding;
  name?: string;
  alias?: string[];
  description?: string;
  mode?: 'instance' | 'kind';
  type?: CodeableConcept[];
  telecom?: ContactPoint[];
  address?: Address;
  physicalType?: CodeableConcept;
  position?: LocationPosition;
  managingOrganization?: Reference;
  partOf?: Reference;
  hoursOfOperation?: LocationHoursOfOperation[];
  availabilityExceptions?: string;
  endpoint?: Reference[];
}

export interface LocationPosition {
  longitude: number;
  latitude: number;
  altitude?: number;
}

export interface LocationHoursOfOperation {
  daysOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  allDay?: boolean;
  openingTime?: string;
  closingTime?: string;
}

// Export utility types
export type FHIRResource = 
  | Patient 
  | Condition 
  | MedicationRequest 
  | AllergyIntolerance 
  | Observation 
  | Encounter 
  | Procedure 
  | Immunization
  | Practitioner
  | Organization
  | ServiceRequest
  | DiagnosticReport
  | Coverage
  | Location;

export type ResourceType = FHIRResource['resourceType'];