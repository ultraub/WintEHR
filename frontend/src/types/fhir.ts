/**
 * FHIR R4 Base Type Definitions for WintEHR
 *
 * Core FHIR data types and structures used throughout the application.
 * These types follow the FHIR R4 specification.
 *
 * @see https://hl7.org/fhir/R4
 */

// =============================================================================
// FHIR Primitive Types
// =============================================================================

/**
 * FHIR instant - an instant in time (xs:dateTime)
 */
export type FHIRInstant = string;

/**
 * FHIR dateTime - a date, date-time or partial date
 */
export type FHIRDateTime = string;

/**
 * FHIR date - a date or partial date
 */
export type FHIRDate = string;

/**
 * FHIR time - a time of day
 */
export type FHIRTime = string;

/**
 * FHIR uri - a Uniform Resource Identifier
 */
export type FHIRURI = string;

/**
 * FHIR url - an absolute URL
 */
export type FHIRURL = string;

/**
 * FHIR canonical - a canonical URL reference
 */
export type FHIRCanonical = string;

/**
 * FHIR id - a resource ID
 */
export type FHIRID = string;

/**
 * FHIR code - a string with restricted characters
 */
export type FHIRCode = string;

/**
 * FHIR oid - an OID represented as URI
 */
export type FHIROID = string;

/**
 * FHIR uuid - a UUID represented as URI
 */
export type FHIRUUID = string;

/**
 * FHIR markdown - a string with markdown content
 */
export type FHIRMarkdown = string;

/**
 * FHIR base64Binary - base64 encoded binary data
 */
export type FHIRBase64Binary = string;

/**
 * FHIR positiveInt - a positive integer
 */
export type FHIRPositiveInt = number;

/**
 * FHIR unsignedInt - a non-negative integer
 */
export type FHIRUnsignedInt = number;

/**
 * FHIR decimal - a decimal number
 */
export type FHIRDecimal = number;

// =============================================================================
// FHIR Complex Types
// =============================================================================

/**
 * FHIR Period - a time period
 */
export interface Period {
  start?: FHIRDateTime;
  end?: FHIRDateTime;
}

/**
 * FHIR Range - a set of ordered values
 */
export interface Range {
  low?: Quantity;
  high?: Quantity;
}

/**
 * FHIR Ratio - a ratio of two Quantity values
 */
export interface Ratio {
  numerator?: Quantity;
  denominator?: Quantity;
}

/**
 * FHIR Quantity - a measured or measurable amount
 */
export interface Quantity {
  value?: FHIRDecimal;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: FHIRURI;
  code?: FHIRCode;
}

/**
 * FHIR SimpleQuantity - quantity without comparator
 */
export type SimpleQuantity = Omit<Quantity, 'comparator'>;

/**
 * FHIR Money - an amount of money
 */
export interface Money {
  value?: FHIRDecimal;
  currency?: FHIRCode;
}

/**
 * FHIR Coding - a code in a code system
 */
export interface Coding {
  system?: FHIRURI;
  version?: string;
  code?: FHIRCode;
  display?: string;
  userSelected?: boolean;
}

/**
 * FHIR CodeableConcept - a concept with one or more codes
 */
export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

/**
 * FHIR Identifier - an identifier for a resource
 */
export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: FHIRURI;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

/**
 * FHIR Reference - a reference to another resource
 */
export interface Reference {
  reference?: string;
  type?: FHIRURI;
  identifier?: Identifier;
  display?: string;
}

/**
 * FHIR Annotation - a text note with attribution
 */
export interface Annotation {
  authorReference?: Reference;
  authorString?: string;
  time?: FHIRDateTime;
  text: FHIRMarkdown;
}

/**
 * FHIR Attachment - content in a format
 */
export interface Attachment {
  contentType?: FHIRCode;
  language?: FHIRCode;
  data?: FHIRBase64Binary;
  url?: FHIRURL;
  size?: FHIRUnsignedInt;
  hash?: FHIRBase64Binary;
  title?: string;
  creation?: FHIRDateTime;
}

/**
 * FHIR ContactPoint - contact details
 */
export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: FHIRPositiveInt;
  period?: Period;
}

/**
 * FHIR HumanName - a human name
 */
export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

/**
 * FHIR Address - an address
 */
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

// =============================================================================
// FHIR Resource Types
// =============================================================================

/**
 * FHIR Meta - metadata about a resource
 */
export interface Meta {
  versionId?: FHIRID;
  lastUpdated?: FHIRInstant;
  source?: FHIRURI;
  profile?: FHIRCanonical[];
  security?: Coding[];
  tag?: Coding[];
}

/**
 * FHIR Narrative - text summary of resource
 */
export interface Narrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string;
}

/**
 * FHIR Extension - additional content
 */
export interface Extension {
  url: FHIRURI;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: FHIRDecimal;
  valueString?: string;
  valueUri?: FHIRURI;
  valueUrl?: FHIRURL;
  valueCode?: FHIRCode;
  valueDateTime?: FHIRDateTime;
  valueDate?: FHIRDate;
  valueTime?: FHIRTime;
  valueCoding?: Coding;
  valueCodeableConcept?: CodeableConcept;
  valueQuantity?: Quantity;
  valueReference?: Reference;
  valuePeriod?: Period;
  valueIdentifier?: Identifier;
  valueAttachment?: Attachment;
  extension?: Extension[];
}

/**
 * Base FHIR Resource
 */
export interface FHIRResource {
  resourceType: string;
  id?: FHIRID;
  meta?: Meta;
  implicitRules?: FHIRURI;
  language?: FHIRCode;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
}

/**
 * FHIR DomainResource - resource with narrative and extensions
 */
export interface DomainResource extends FHIRResource {
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
}

// =============================================================================
// FHIR Bundle Types
// =============================================================================

/**
 * Bundle type codes
 */
export type BundleType =
  | 'document'
  | 'message'
  | 'transaction'
  | 'transaction-response'
  | 'batch'
  | 'batch-response'
  | 'history'
  | 'searchset'
  | 'collection';

/**
 * Bundle entry search mode
 */
export type BundleEntrySearchMode = 'match' | 'include' | 'outcome';

/**
 * Bundle entry request method
 */
export type BundleEntryRequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * FHIR Bundle link
 */
export interface BundleLink {
  relation: string;
  url: FHIRURL;
}

/**
 * FHIR Bundle entry search
 */
export interface BundleEntrySearch {
  mode?: BundleEntrySearchMode;
  score?: FHIRDecimal;
}

/**
 * FHIR Bundle entry request
 */
export interface BundleEntryRequest {
  method: BundleEntryRequestMethod;
  url: FHIRURI;
  ifNoneMatch?: string;
  ifModifiedSince?: FHIRInstant;
  ifMatch?: string;
  ifNoneExist?: string;
}

/**
 * FHIR Bundle entry response
 */
export interface BundleEntryResponse {
  status: string;
  location?: FHIRURI;
  etag?: string;
  lastModified?: FHIRInstant;
  outcome?: FHIRResource;
}

/**
 * FHIR Bundle entry
 */
export interface BundleEntry<T extends FHIRResource = FHIRResource> {
  link?: BundleLink[];
  fullUrl?: FHIRURI;
  resource?: T;
  search?: BundleEntrySearch;
  request?: BundleEntryRequest;
  response?: BundleEntryResponse;
}

/**
 * FHIR Bundle resource
 */
export interface Bundle<T extends FHIRResource = FHIRResource> extends FHIRResource {
  resourceType: 'Bundle';
  identifier?: Identifier;
  type: BundleType;
  timestamp?: FHIRInstant;
  total?: FHIRUnsignedInt;
  link?: BundleLink[];
  entry?: BundleEntry<T>[];
  signature?: {
    type: Coding[];
    when: FHIRInstant;
    who: Reference;
    onBehalfOf?: Reference;
    targetFormat?: FHIRCode;
    sigFormat?: FHIRCode;
    data?: FHIRBase64Binary;
  };
}

// =============================================================================
// FHIR OperationOutcome
// =============================================================================

/**
 * OperationOutcome issue severity
 */
export type OperationOutcomeSeverity = 'fatal' | 'error' | 'warning' | 'information';

/**
 * OperationOutcome issue code
 */
export type OperationOutcomeCode =
  | 'invalid'
  | 'structure'
  | 'required'
  | 'value'
  | 'invariant'
  | 'security'
  | 'login'
  | 'unknown'
  | 'expired'
  | 'forbidden'
  | 'suppressed'
  | 'processing'
  | 'not-supported'
  | 'duplicate'
  | 'multiple-matches'
  | 'not-found'
  | 'deleted'
  | 'too-long'
  | 'code-invalid'
  | 'extension'
  | 'too-costly'
  | 'business-rule'
  | 'conflict'
  | 'transient'
  | 'lock-error'
  | 'no-store'
  | 'exception'
  | 'timeout'
  | 'incomplete'
  | 'throttled'
  | 'informational';

/**
 * FHIR OperationOutcome issue
 */
export interface OperationOutcomeIssue {
  severity: OperationOutcomeSeverity;
  code: OperationOutcomeCode;
  details?: CodeableConcept;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

/**
 * FHIR OperationOutcome resource
 */
export interface OperationOutcome extends FHIRResource {
  resourceType: 'OperationOutcome';
  issue: OperationOutcomeIssue[];
}

// =============================================================================
// FHIR Resource Type Names
// =============================================================================

/**
 * All FHIR R4 resource type names
 */
export type FHIRResourceType =
  | 'Account'
  | 'ActivityDefinition'
  | 'AdverseEvent'
  | 'AllergyIntolerance'
  | 'Appointment'
  | 'AppointmentResponse'
  | 'AuditEvent'
  | 'Basic'
  | 'Binary'
  | 'BiologicallyDerivedProduct'
  | 'BodyStructure'
  | 'Bundle'
  | 'CapabilityStatement'
  | 'CarePlan'
  | 'CareTeam'
  | 'CatalogEntry'
  | 'ChargeItem'
  | 'ChargeItemDefinition'
  | 'Claim'
  | 'ClaimResponse'
  | 'ClinicalImpression'
  | 'CodeSystem'
  | 'Communication'
  | 'CommunicationRequest'
  | 'CompartmentDefinition'
  | 'Composition'
  | 'ConceptMap'
  | 'Condition'
  | 'Consent'
  | 'Contract'
  | 'Coverage'
  | 'CoverageEligibilityRequest'
  | 'CoverageEligibilityResponse'
  | 'DetectedIssue'
  | 'Device'
  | 'DeviceDefinition'
  | 'DeviceMetric'
  | 'DeviceRequest'
  | 'DeviceUseStatement'
  | 'DiagnosticReport'
  | 'DocumentManifest'
  | 'DocumentReference'
  | 'EffectEvidenceSynthesis'
  | 'Encounter'
  | 'Endpoint'
  | 'EnrollmentRequest'
  | 'EnrollmentResponse'
  | 'EpisodeOfCare'
  | 'EventDefinition'
  | 'Evidence'
  | 'EvidenceVariable'
  | 'ExampleScenario'
  | 'ExplanationOfBenefit'
  | 'FamilyMemberHistory'
  | 'Flag'
  | 'Goal'
  | 'GraphDefinition'
  | 'Group'
  | 'GuidanceResponse'
  | 'HealthcareService'
  | 'ImagingStudy'
  | 'Immunization'
  | 'ImmunizationEvaluation'
  | 'ImmunizationRecommendation'
  | 'ImplementationGuide'
  | 'InsurancePlan'
  | 'Invoice'
  | 'Library'
  | 'Linkage'
  | 'List'
  | 'Location'
  | 'Measure'
  | 'MeasureReport'
  | 'Media'
  | 'Medication'
  | 'MedicationAdministration'
  | 'MedicationDispense'
  | 'MedicationKnowledge'
  | 'MedicationRequest'
  | 'MedicationStatement'
  | 'MedicinalProduct'
  | 'MedicinalProductAuthorization'
  | 'MedicinalProductContraindication'
  | 'MedicinalProductIndication'
  | 'MedicinalProductIngredient'
  | 'MedicinalProductInteraction'
  | 'MedicinalProductManufactured'
  | 'MedicinalProductPackaged'
  | 'MedicinalProductPharmaceutical'
  | 'MedicinalProductUndesirableEffect'
  | 'MessageDefinition'
  | 'MessageHeader'
  | 'MolecularSequence'
  | 'NamingSystem'
  | 'NutritionOrder'
  | 'Observation'
  | 'ObservationDefinition'
  | 'OperationDefinition'
  | 'OperationOutcome'
  | 'Organization'
  | 'OrganizationAffiliation'
  | 'Parameters'
  | 'Patient'
  | 'PaymentNotice'
  | 'PaymentReconciliation'
  | 'Person'
  | 'PlanDefinition'
  | 'Practitioner'
  | 'PractitionerRole'
  | 'Procedure'
  | 'Provenance'
  | 'Questionnaire'
  | 'QuestionnaireResponse'
  | 'RelatedPerson'
  | 'RequestGroup'
  | 'ResearchDefinition'
  | 'ResearchElementDefinition'
  | 'ResearchStudy'
  | 'ResearchSubject'
  | 'RiskAssessment'
  | 'RiskEvidenceSynthesis'
  | 'Schedule'
  | 'SearchParameter'
  | 'ServiceRequest'
  | 'Slot'
  | 'Specimen'
  | 'SpecimenDefinition'
  | 'StructureDefinition'
  | 'StructureMap'
  | 'Subscription'
  | 'Substance'
  | 'SubstanceNucleicAcid'
  | 'SubstancePolymer'
  | 'SubstanceProtein'
  | 'SubstanceReferenceInformation'
  | 'SubstanceSourceMaterial'
  | 'SubstanceSpecification'
  | 'SupplyDelivery'
  | 'SupplyRequest'
  | 'Task'
  | 'TerminologyCapabilities'
  | 'TestReport'
  | 'TestScript'
  | 'ValueSet'
  | 'VerificationResult'
  | 'VisionPrescription';

// =============================================================================
// FHIR Client Types
// =============================================================================

/**
 * FHIR search parameters
 */
export interface FHIRSearchParams {
  [key: string]: string | string[] | number | boolean | undefined;
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string | string[];
  _revinclude?: string | string[];
  _summary?: 'true' | 'false' | 'text' | 'data' | 'count';
  _elements?: string;
  _total?: 'none' | 'estimate' | 'accurate';
}

/**
 * FHIR client response
 */
export interface FHIRResponse<T extends FHIRResource = FHIRResource> {
  resource?: T;
  resources?: T[];
  bundle?: Bundle<T>;
  outcome?: OperationOutcome;
  total?: number;
  link?: BundleLink[];
}

/**
 * FHIR operation parameters
 */
export interface FHIROperationParams {
  [key: string]: unknown;
}
