/**
 * FHIR R4 Resource Definitions
 * 
 * Comprehensive definitions for all 48 supported FHIR resource types
 * Including search parameters, categories, and relationships
 */

// Resource categories for organization
export const RESOURCE_CATEGORIES = {
  CLINICAL: {
    name: 'Clinical',
    color: '#4caf50',
    description: 'Clinical observations, conditions, and treatments'
  },
  ADMINISTRATIVE: {
    name: 'Administrative', 
    color: '#ff9800',
    description: 'Administrative and scheduling resources'
  },
  FINANCIAL: {
    name: 'Financial',
    color: '#f44336', 
    description: 'Financial and billing resources'
  },
  FOUNDATION: {
    name: 'Foundation',
    color: '#9c27b0',
    description: 'Foundational resources and terminology'
  },
  WORKFLOW: {
    name: 'Workflow',
    color: '#3f51b5',
    description: 'Workflow and task management'
  },
  INFRASTRUCTURE: {
    name: 'Infrastructure',
    color: '#607d8b',
    description: 'Infrastructure and support resources'
  }
};

// Comprehensive FHIR resource definitions
export const FHIR_RESOURCES = {
  // Clinical Resources
  Patient: {
    name: 'Patient',
    category: 'CLINICAL',
    description: 'Demographics and other administrative information about an individual',
    icon: '👤',
    searchParams: {
      identifier: { type: 'token', description: 'A patient identifier' },
      name: { type: 'string', description: 'A server defined search that may match any of the string fields' },
      family: { type: 'string', description: 'A portion of the family name of the patient' },
      given: { type: 'string', description: 'A portion of the given name of the patient' },
      birthdate: { type: 'date', description: 'The patient\'s date of birth' },
      gender: { type: 'token', description: 'Gender of the patient' },
      address: { type: 'string', description: 'A server defined search that may match any of the address fields' },
      'address-city': { type: 'string', description: 'A city specified in an address' },
      'address-state': { type: 'string', description: 'A state specified in an address' },
      'address-postalcode': { type: 'string', description: 'A postal code specified in an address' },
      phone: { type: 'token', description: 'A value in a phone contact' },
      email: { type: 'token', description: 'A value in an email contact' },
      'general-practitioner': { type: 'reference', description: 'Patient\'s nominated primary care provider' },
      organization: { type: 'reference', description: 'The organization that is the custodian of the patient record' },
      deceased: { type: 'token', description: 'This patient has been marked as deceased' }
    },
    includes: ['Patient:general-practitioner', 'Patient:organization'],
    revIncludes: ['Observation:patient', 'Condition:patient', 'MedicationRequest:patient', 'Encounter:patient']
  },

  Observation: {
    name: 'Observation',
    category: 'CLINICAL',
    description: 'Measurements and simple assertions made about a patient',
    icon: '📊',
    searchParams: {
      patient: { type: 'reference', description: 'The subject that the observation is about' },
      subject: { type: 'reference', description: 'The subject that the observation is about' },
      code: { type: 'token', description: 'The code of the observation type' },
      category: { type: 'token', description: 'The classification of the type of observation' },
      date: { type: 'date', description: 'Obtained date/time' },
      'value-quantity': { type: 'quantity', description: 'The value of the observation, if numeric' },
      'value-string': { type: 'string', description: 'The value of the observation, if string' },
      'value-concept': { type: 'token', description: 'The value of the observation, if a CodeableConcept' },
      status: { type: 'token', description: 'The status of the observation' },
      encounter: { type: 'reference', description: 'Encounter related to the observation' },
      performer: { type: 'reference', description: 'Who performed the observation' },
      'based-on': { type: 'reference', description: 'Reference to the service request' },
      'component-code': { type: 'token', description: 'Component code' },
      'component-value-quantity': { type: 'quantity', description: 'Component value, if numeric' }
    },
    includes: ['Observation:patient', 'Observation:performer', 'Observation:encounter', 'Observation:based-on'],
    revIncludes: ['DiagnosticReport:result'],
    compositeParams: {
      'code-value-quantity': ['code', 'value-quantity'],
      'code-value-string': ['code', 'value-string'],
      'code-value-concept': ['code', 'value-concept'],
      'component-code-value-quantity': ['component-code', 'component-value-quantity']
    }
  },

  Condition: {
    name: 'Condition',
    category: 'CLINICAL',
    description: 'Clinical conditions, problems, or diagnoses',
    icon: '🏥',
    searchParams: {
      patient: { type: 'reference', description: 'Who has the condition?' },
      subject: { type: 'reference', description: 'Who has the condition?' },
      code: { type: 'token', description: 'Code for the condition' },
      category: { type: 'token', description: 'The category of the condition' },
      'clinical-status': { type: 'token', description: 'The clinical status of the condition' },
      'verification-status': { type: 'token', description: 'unconfirmed | provisional | differential | confirmed | refuted' },
      severity: { type: 'token', description: 'The severity of the condition' },
      'onset-date': { type: 'date', description: 'Date when condition first manifested' },
      'recorded-date': { type: 'date', description: 'Date record was created' },
      asserter: { type: 'reference', description: 'Person who asserts this condition' },
      encounter: { type: 'reference', description: 'Encounter when condition first asserted' }
    },
    includes: ['Condition:patient', 'Condition:asserter', 'Condition:encounter'],
    revIncludes: ['Observation:focus', 'CarePlan:condition'],
    compositeParams: {
      'code-severity': ['code', 'severity'],
      'category-status': ['category', 'clinical-status']
    }
  },

  Procedure: {
    name: 'Procedure',
    category: 'CLINICAL',
    description: 'An action that was or is currently being performed on a patient',
    icon: '⚕️',
    searchParams: {
      patient: { type: 'reference', description: 'Search by subject - a patient' },
      subject: { type: 'reference', description: 'Search by subject' },
      code: { type: 'token', description: 'A code to identify a procedure' },
      date: { type: 'date', description: 'When the procedure was performed' },
      status: { type: 'token', description: 'preparation | in-progress | not-done | on-hold | stopped | completed' },
      performer: { type: 'reference', description: 'The reference to the practitioner' },
      location: { type: 'reference', description: 'Where the procedure happened' },
      encounter: { type: 'reference', description: 'Encounter created as part of' },
      'based-on': { type: 'reference', description: 'A request for this procedure' },
      category: { type: 'token', description: 'Classification of the procedure' },
      outcome: { type: 'token', description: 'The result of procedure' }
    },
    includes: ['Procedure:patient', 'Procedure:performer', 'Procedure:location', 'Procedure:encounter'],
    revIncludes: ['Observation:part-of']
  },

  Medication: {
    name: 'Medication',
    category: 'CLINICAL',
    description: 'Definition of a medication',
    icon: '💊',
    searchParams: {
      code: { type: 'token', description: 'Codes that identify this medication' },
      'ingredient-code': { type: 'token', description: 'Reference to a concept' },
      manufacturer: { type: 'reference', description: 'Manufacturer of the item' },
      form: { type: 'token', description: 'powder | tablets | capsule +' },
      status: { type: 'token', description: 'active | inactive | entered-in-error' },
      'lot-number': { type: 'token', description: 'Identifier assigned to batch' },
      'expiration-date': { type: 'date', description: 'When batch will expire' }
    },
    includes: ['Medication:manufacturer'],
    revIncludes: ['MedicationRequest:medication', 'MedicationDispense:medication']
  },

  MedicationRequest: {
    name: 'MedicationRequest',
    category: 'CLINICAL',
    description: 'Prescription or medication order',
    icon: '📝',
    searchParams: {
      patient: { type: 'reference', description: 'Returns prescriptions for a specific patient' },
      subject: { type: 'reference', description: 'The identity of a patient to list orders for' },
      medication: { type: 'reference', description: 'Return prescriptions for this medication reference' },
      code: { type: 'token', description: 'Return prescriptions for this medication code' },
      status: { type: 'token', description: 'active | on-hold | cancelled | completed | entered-in-error | stopped | draft | unknown' },
      intent: { type: 'token', description: 'proposal | plan | order | original-order | instance-order | option' },
      authoredon: { type: 'date', description: 'Return prescriptions written on this date' },
      requester: { type: 'reference', description: 'Returns prescriptions prescribed by this prescriber' },
      encounter: { type: 'reference', description: 'Return prescriptions with this encounter' },
      priority: { type: 'token', description: 'routine | urgent | asap | stat' },
      category: { type: 'token', description: 'Type of medication usage' }
    },
    includes: ['MedicationRequest:patient', 'MedicationRequest:medication', 'MedicationRequest:requester'],
    revIncludes: ['MedicationDispense:prescription'],
    compositeParams: {
      'medication-strength': ['medication', 'dosage-instruction']
    }
  },

  MedicationDispense: {
    name: 'MedicationDispense',
    category: 'CLINICAL',
    description: 'Dispensing a medication to a patient',
    icon: '🏪',
    searchParams: {
      patient: { type: 'reference', description: 'The identity of a patient to list dispenses for' },
      subject: { type: 'reference', description: 'The identity of a patient to list dispenses for' },
      medication: { type: 'reference', description: 'Returns dispenses of this medicine resource' },
      code: { type: 'token', description: 'Returns dispenses of this medicine code' },
      prescription: { type: 'reference', description: 'The identity of a prescription to list dispenses from' },
      status: { type: 'token', description: 'Returns dispenses with a specified dispense status' },
      performer: { type: 'reference', description: 'Returns dispenses performed by a specific individual' },
      whenhandedover: { type: 'date', description: 'Returns dispenses handed over on this date' },
      destination: { type: 'reference', description: 'Returns dispenses that should be sent to a specific destination' },
      receiver: { type: 'reference', description: 'The identity of a receiver to list dispenses for' }
    },
    includes: ['MedicationDispense:patient', 'MedicationDispense:medication', 'MedicationDispense:prescription'],
    revIncludes: []
  },

  MedicationAdministration: {
    name: 'MedicationAdministration',
    category: 'CLINICAL',
    description: 'Administration of medication to a patient',
    icon: '💉',
    searchParams: {
      patient: { type: 'reference', description: 'The identity of a patient to list administrations for' },
      subject: { type: 'reference', description: 'The identity of the individual to list administrations for' },
      medication: { type: 'reference', description: 'Return administrations of this medication resource' },
      code: { type: 'token', description: 'Return administrations of this medication code' },
      status: { type: 'token', description: 'MedicationAdministration event status' },
      performer: { type: 'reference', description: 'The identity of the individual who administered the medication' },
      'effective-time': { type: 'date', description: 'Date administration happened' },
      request: { type: 'reference', description: 'The identity of a request to list administrations from' },
      device: { type: 'reference', description: 'Return administrations with this administration device identity' },
      'reason-given': { type: 'token', description: 'Reasons for administering the medication' }
    },
    includes: ['MedicationAdministration:patient', 'MedicationAdministration:medication', 'MedicationAdministration:performer'],
    revIncludes: []
  },

  MedicationStatement: {
    name: 'MedicationStatement',
    category: 'CLINICAL',
    description: 'Record of medication being taken by a patient',
    icon: '📋',
    searchParams: {
      patient: { type: 'reference', description: 'Returns statements for a specific patient' },
      subject: { type: 'reference', description: 'The identity of a patient to list statements for' },
      medication: { type: 'reference', description: 'Return statements of this medication reference' },
      code: { type: 'token', description: 'Return statements of this medication code' },
      status: { type: 'token', description: 'Return statements that match the given status' },
      effective: { type: 'date', description: 'Date when patient was taking the medication' },
      source: { type: 'reference', description: 'Who or where the information in the statement came from' },
      category: { type: 'token', description: 'Returns statements of this category of medicationstatement' },
      'part-of': { type: 'reference', description: 'Returns statements that are part of another event' }
    },
    includes: ['MedicationStatement:patient', 'MedicationStatement:medication', 'MedicationStatement:source'],
    revIncludes: []
  },

  Immunization: {
    name: 'Immunization',
    category: 'CLINICAL',
    description: 'Immunization event information',
    icon: '💉',
    searchParams: {
      patient: { type: 'reference', description: 'The patient for the vaccination record' },
      date: { type: 'date', description: 'Vaccination administration date' },
      'vaccine-code': { type: 'token', description: 'Vaccine product administered' },
      status: { type: 'token', description: 'Immunization event status' },
      'status-reason': { type: 'token', description: 'Reason why the vaccine was not administered' },
      location: { type: 'reference', description: 'The service delivery location' },
      performer: { type: 'reference', description: 'The practitioner who administered the vaccine' },
      reaction: { type: 'reference', description: 'Additional information on reaction' },
      'lot-number': { type: 'string', description: 'Vaccine lot number' }
    },
    includes: ['Immunization:patient', 'Immunization:location', 'Immunization:performer'],
    revIncludes: []
  },

  AllergyIntolerance: {
    name: 'AllergyIntolerance',
    category: 'CLINICAL',
    description: 'Allergies and intolerances',
    icon: '⚠️',
    searchParams: {
      patient: { type: 'reference', description: 'Who the sensitivity is for' },
      code: { type: 'token', description: 'Code that identifies the allergy or intolerance' },
      'clinical-status': { type: 'token', description: 'active | inactive | resolved' },
      'verification-status': { type: 'token', description: 'unconfirmed | confirmed | refuted' },
      type: { type: 'token', description: 'allergy | intolerance' },
      category: { type: 'token', description: 'food | medication | environment | biologic' },
      criticality: { type: 'token', description: 'low | high | unable-to-assess' },
      date: { type: 'date', description: 'Date record was believed accurate' },
      recorder: { type: 'reference', description: 'Who recorded the sensitivity' },
      asserter: { type: 'reference', description: 'Source of the information about the allergy' }
    },
    includes: ['AllergyIntolerance:patient', 'AllergyIntolerance:recorder', 'AllergyIntolerance:asserter'],
    revIncludes: []
  },

  DiagnosticReport: {
    name: 'DiagnosticReport',
    category: 'CLINICAL',
    description: 'Diagnostic test results',
    icon: '🔬',
    searchParams: {
      patient: { type: 'reference', description: 'The subject of the report if a patient' },
      subject: { type: 'reference', description: 'The subject of the report' },
      code: { type: 'token', description: 'The code for the report, as opposed to codes for the atomic results' },
      category: { type: 'token', description: 'Which diagnostic discipline/department created the report' },
      date: { type: 'date', description: 'The clinically relevant time of the report' },
      issued: { type: 'date', description: 'When the report was issued' },
      status: { type: 'token', description: 'The status of the report' },
      performer: { type: 'reference', description: 'Who is responsible for the report' },
      result: { type: 'reference', description: 'Link to an atomic result' },
      encounter: { type: 'reference', description: 'The Encounter when the report was made' },
      'based-on': { type: 'reference', description: 'Reference to the service request' }
    },
    includes: ['DiagnosticReport:patient', 'DiagnosticReport:performer', 'DiagnosticReport:result'],
    revIncludes: [],
    compositeParams: {
      'code-result': ['code', 'result-value']
    }
  },

  ImagingStudy: {
    name: 'ImagingStudy',
    category: 'CLINICAL',
    description: 'Medical imaging study record',
    icon: '🏥',
    searchParams: {
      patient: { type: 'reference', description: 'Who the study is about' },
      subject: { type: 'reference', description: 'Who the study is about' },
      identifier: { type: 'token', description: 'Identifiers for the Study' },
      'dicom-class': { type: 'uri', description: 'The type of the instance' },
      modality: { type: 'token', description: 'The modality of the series' },
      bodysite: { type: 'token', description: 'The body site studied' },
      started: { type: 'date', description: 'When the study was started' },
      status: { type: 'token', description: 'The status of the study' },
      series: { type: 'uri', description: 'DICOM Series Instance UID for a series' },
      endpoint: { type: 'reference', description: 'The endpoint for the study' }
    },
    includes: ['ImagingStudy:patient', 'ImagingStudy:endpoint'],
    revIncludes: []
  },

  CarePlan: {
    name: 'CarePlan',
    category: 'CLINICAL',
    description: 'Healthcare plan for patient',
    icon: '📑',
    searchParams: {
      patient: { type: 'reference', description: 'Who the care plan is for' },
      subject: { type: 'reference', description: 'Who the care plan is for' },
      date: { type: 'date', description: 'Time period plan covers' },
      status: { type: 'token', description: 'draft | active | on-hold | revoked | completed | entered-in-error | unknown' },
      intent: { type: 'token', description: 'proposal | plan | order | option' },
      category: { type: 'token', description: 'Type of plan' },
      condition: { type: 'reference', description: 'Health issues this plan addresses' },
      'care-team': { type: 'reference', description: 'Who\'s involved in plan?' },
      encounter: { type: 'reference', description: 'Encounter created as part of' },
      goal: { type: 'reference', description: 'Desired outcome of plan' }
    },
    includes: ['CarePlan:patient', 'CarePlan:condition', 'CarePlan:care-team'],
    revIncludes: []
  },

  Goal: {
    name: 'Goal',
    category: 'CLINICAL',
    description: 'Clinical goals for a patient',
    icon: '🎯',
    searchParams: {
      patient: { type: 'reference', description: 'Who this goal is intended for' },
      subject: { type: 'reference', description: 'Who this goal is intended for' },
      'target-date': { type: 'date', description: 'Reach goal on or before' },
      category: { type: 'token', description: 'E.g. Treatment, dietary, behavioral, etc' },
      'lifecycle-status': { type: 'token', description: 'proposed | planned | accepted | active | on-hold | completed | cancelled | entered-in-error | rejected' },
      'achievement-status': { type: 'token', description: 'in-progress | improving | worsening | no-change | achieved | sustaining | not-achieved | no-progress | not-attainable' },
      'start-date': { type: 'date', description: 'When goal pursuit begins' }
    },
    includes: ['Goal:patient'],
    revIncludes: ['CarePlan:goal']
  },

  // Administrative Resources
  Practitioner: {
    name: 'Practitioner',
    category: 'ADMINISTRATIVE',
    description: 'Healthcare professional',
    icon: '👨‍⚕️',
    searchParams: {
      identifier: { type: 'token', description: 'A practitioner\'s Identifier' },
      name: { type: 'string', description: 'A server defined search that may match any of the string fields' },
      family: { type: 'string', description: 'A portion of the family name' },
      given: { type: 'string', description: 'A portion of the given name' },
      gender: { type: 'token', description: 'Gender of the practitioner' },
      communication: { type: 'token', description: 'One of the languages that the practitioner can communicate with' },
      active: { type: 'token', description: 'Whether the practitioner record is active' },
      'address-city': { type: 'string', description: 'A city specified in an address' },
      'address-state': { type: 'string', description: 'A state specified in an address' },
      email: { type: 'token', description: 'A value in an email contact' },
      phone: { type: 'token', description: 'A value in a phone contact' }
    },
    includes: [],
    revIncludes: ['PractitionerRole:practitioner', 'Observation:performer']
  },

  PractitionerRole: {
    name: 'PractitionerRole',
    category: 'ADMINISTRATIVE',
    description: 'Roles and organizations for a practitioner',
    icon: '👥',
    searchParams: {
      practitioner: { type: 'reference', description: 'Practitioner that is able to provide the defined services' },
      organization: { type: 'reference', description: 'The identity of the organization' },
      location: { type: 'reference', description: 'One of the locations at which this practitioner provides care' },
      service: { type: 'reference', description: 'The list of healthcare services that this worker provides' },
      role: { type: 'token', description: 'The practitioner can perform this role at for the organization' },
      specialty: { type: 'token', description: 'The practitioner has this specialty at an organization' },
      active: { type: 'token', description: 'Whether this practitioner role record is in active use' },
      date: { type: 'date', description: 'The period during which the practitioner is authorized to perform' }
    },
    includes: ['PractitionerRole:practitioner', 'PractitionerRole:organization', 'PractitionerRole:location'],
    revIncludes: []
  },

  Organization: {
    name: 'Organization',
    category: 'ADMINISTRATIVE',
    description: 'Healthcare organization',
    icon: '🏢',
    searchParams: {
      identifier: { type: 'token', description: 'Any identifier for the organization' },
      name: { type: 'string', description: 'A portion of the organization\'s name' },
      type: { type: 'token', description: 'A code for the type of organization' },
      active: { type: 'token', description: 'Is the Organization record active' },
      address: { type: 'string', description: 'A server defined search' },
      'address-city': { type: 'string', description: 'A city specified in an address' },
      'address-state': { type: 'string', description: 'A state specified in an address' },
      'address-postalcode': { type: 'string', description: 'A postal code specified in an address' },
      'partof': { type: 'reference', description: 'An organization of which this organization forms a part' }
    },
    includes: ['Organization:partof'],
    revIncludes: ['Patient:organization', 'PractitionerRole:organization']
  },

  Location: {
    name: 'Location',
    category: 'ADMINISTRATIVE',
    description: 'Physical location',
    icon: '📍',
    searchParams: {
      identifier: { type: 'token', description: 'An identifier for the location' },
      name: { type: 'string', description: 'A portion of the location\'s name' },
      address: { type: 'string', description: 'A (part of the) address of the location' },
      'address-city': { type: 'string', description: 'A city specified in an address' },
      'address-state': { type: 'string', description: 'A state specified in an address' },
      'address-postalcode': { type: 'string', description: 'A postal code specified in an address' },
      type: { type: 'token', description: 'A code for the type of location' },
      status: { type: 'token', description: 'active | suspended | inactive' },
      operational: { type: 'token', description: 'Searches for locations with a specific kind of status' },
      organization: { type: 'reference', description: 'Searches for locations that are managed by the provided organization' }
    },
    includes: ['Location:organization'],
    revIncludes: ['Encounter:location', 'PractitionerRole:location']
  },

  Encounter: {
    name: 'Encounter',
    category: 'ADMINISTRATIVE',
    description: 'Healthcare visit or interaction',
    icon: '🏥',
    searchParams: {
      patient: { type: 'reference', description: 'The patient present at the encounter' },
      subject: { type: 'reference', description: 'The patient or group present at the encounter' },
      class: { type: 'token', description: 'Classification of patient encounter' },
      type: { type: 'token', description: 'Specific type of encounter' },
      status: { type: 'token', description: 'planned | arrived | triaged | in-progress | onleave | finished | cancelled' },
      date: { type: 'date', description: 'A date within the period the Encounter lasted' },
      location: { type: 'reference', description: 'Location the encounter takes place' },
      participant: { type: 'reference', description: 'Persons involved in the encounter' },
      'service-provider': { type: 'reference', description: 'The organization that is primarily responsible' },
      'reason-code': { type: 'token', description: 'Coded reason the encounter takes place' },
      'reason-reference': { type: 'reference', description: 'Reason the encounter takes place (reference)' }
    },
    includes: ['Encounter:patient', 'Encounter:location', 'Encounter:participant'],
    revIncludes: ['Observation:encounter', 'Condition:encounter', 'Procedure:encounter']
  },

  Appointment: {
    name: 'Appointment',
    category: 'ADMINISTRATIVE',
    description: 'Scheduled healthcare appointment',
    icon: '📅',
    searchParams: {
      patient: { type: 'reference', description: 'One of the individuals of the appointment' },
      practitioner: { type: 'reference', description: 'One of the individuals of the appointment' },
      location: { type: 'reference', description: 'This location is listed in the participants of the appointment' },
      date: { type: 'date', description: 'Appointment date/time' },
      status: { type: 'token', description: 'The overall status of the appointment' },
      'service-type': { type: 'token', description: 'The specific service that is to be performed' },
      'appointment-type': { type: 'token', description: 'The style of appointment' },
      identifier: { type: 'token', description: 'An Identifier of the Appointment' },
      specialty: { type: 'token', description: 'The specialty of a practitioner that would be required' }
    },
    includes: ['Appointment:patient', 'Appointment:practitioner', 'Appointment:location'],
    revIncludes: []
  },

  Schedule: {
    name: 'Schedule',
    category: 'ADMINISTRATIVE',
    description: 'Container for time slots',
    icon: '📆',
    searchParams: {
      actor: { type: 'reference', description: 'The individual(s) or device(s) for the schedule' },
      date: { type: 'date', description: 'Search for Schedule resources that have a period that contains this date' },
      identifier: { type: 'token', description: 'A Schedule Identifier' },
      'service-type': { type: 'token', description: 'The type of appointments that can be booked' },
      specialty: { type: 'token', description: 'Type of specialty needed' },
      active: { type: 'token', description: 'Is the schedule in active use' }
    },
    includes: ['Schedule:actor'],
    revIncludes: ['Slot:schedule']
  },

  Slot: {
    name: 'Slot',
    category: 'ADMINISTRATIVE',
    description: 'Time slot in a schedule',
    icon: '⏰',
    searchParams: {
      schedule: { type: 'reference', description: 'The Schedule Resource that we are seeking a slot within' },
      identifier: { type: 'token', description: 'A Slot Identifier' },
      'service-type': { type: 'token', description: 'The type of appointments that can be booked' },
      specialty: { type: 'token', description: 'The specialty of a practitioner that would be required' },
      'appointment-type': { type: 'token', description: 'The style of appointment that may be booked' },
      status: { type: 'token', description: 'busy | free | busy-unavailable | busy-tentative | entered-in-error' },
      start: { type: 'date', description: 'Appointment date/time' }
    },
    includes: ['Slot:schedule'],
    revIncludes: []
  },

  CareTeam: {
    name: 'CareTeam',
    category: 'ADMINISTRATIVE',
    description: 'Healthcare team',
    icon: '👥',
    searchParams: {
      patient: { type: 'reference', description: 'Who care team is for' },
      subject: { type: 'reference', description: 'Who care team is for' },
      date: { type: 'date', description: 'Time period team covers' },
      participant: { type: 'reference', description: 'Who is involved' },
      encounter: { type: 'reference', description: 'Encounter created as part of' },
      category: { type: 'token', description: 'Type of team' },
      status: { type: 'token', description: 'proposed | active | suspended | inactive | entered-in-error' }
    },
    includes: ['CareTeam:patient', 'CareTeam:participant'],
    revIncludes: ['CarePlan:care-team']
  },

  Device: {
    name: 'Device',
    category: 'ADMINISTRATIVE',
    description: 'Medical device',
    icon: '🔧',
    searchParams: {
      identifier: { type: 'token', description: 'Instance id from manufacturer' },
      'device-name': { type: 'string', description: 'A server defined search that may match the device name' },
      patient: { type: 'reference', description: 'Patient information' },
      organization: { type: 'reference', description: 'The organization that is responsible for device' },
      model: { type: 'string', description: 'The model of the device' },
      type: { type: 'token', description: 'The type of the device' },
      status: { type: 'token', description: 'active | inactive | entered-in-error | unknown' },
      manufacturer: { type: 'string', description: 'The manufacturer of the device' },
      location: { type: 'reference', description: 'A location, where the resource is found' }
    },
    includes: ['Device:patient', 'Device:organization', 'Device:location'],
    revIncludes: []
  },

  Specimen: {
    name: 'Specimen',
    category: 'ADMINISTRATIVE', 
    description: 'Sample for analysis',
    icon: '🧪',
    searchParams: {
      identifier: { type: 'token', description: 'The unique identifier associated with the specimen' },
      accession: { type: 'token', description: 'The accession number associated with the specimen' },
      patient: { type: 'reference', description: 'The patient the specimen comes from' },
      subject: { type: 'reference', description: 'The patient or group the specimen comes from' },
      type: { type: 'token', description: 'The specimen type' },
      collected: { type: 'date', description: 'The date the specimen was collected' },
      collector: { type: 'reference', description: 'Who collected the specimen' },
      status: { type: 'token', description: 'available | unavailable | unsatisfactory | entered-in-error' },
      bodysite: { type: 'token', description: 'The code for the body site from where the specimen originated' }
    },
    includes: ['Specimen:patient', 'Specimen:collector'],
    revIncludes: ['Observation:specimen']
  },

  // Workflow Resources
  Task: {
    name: 'Task',
    category: 'WORKFLOW',
    description: 'A task to be performed',
    icon: '✅',
    searchParams: {
      patient: { type: 'reference', description: 'Search by patient' },
      subject: { type: 'reference', description: 'Search by subject' },
      focus: { type: 'reference', description: 'What task is acting on' },
      owner: { type: 'reference', description: 'Search by task owner' },
      performer: { type: 'reference', description: 'Search by recommended type of performer' },
      requester: { type: 'reference', description: 'Search by task requester' },
      status: { type: 'token', description: 'Search by task status' },
      code: { type: 'token', description: 'Search by task code' },
      'business-status': { type: 'token', description: 'Search by business status' },
      priority: { type: 'token', description: 'Search by task priority' },
      intent: { type: 'token', description: 'Search by task intent' },
      period: { type: 'date', description: 'Search by period task is/was underway' },
      'authored-on': { type: 'date', description: 'Search by creation date' }
    },
    includes: ['Task:patient', 'Task:focus', 'Task:owner'],
    revIncludes: []
  },

  ServiceRequest: {
    name: 'ServiceRequest',
    category: 'WORKFLOW',
    description: 'Request for a service',
    icon: '📋',
    searchParams: {
      patient: { type: 'reference', description: 'Search by subject - a patient' },
      subject: { type: 'reference', description: 'Search by subject' },
      code: { type: 'token', description: 'What is requested' },
      category: { type: 'token', description: 'Classification of service' },
      status: { type: 'token', description: 'draft | active | on-hold | revoked | completed | entered-in-error | unknown' },
      intent: { type: 'token', description: 'proposal | plan | directive | order | original-order | reflex-order | filler-order | instance-order | option' },
      priority: { type: 'token', description: 'routine | urgent | asap | stat' },
      requester: { type: 'reference', description: 'Who/what is requesting service' },
      performer: { type: 'reference', description: 'Requested performer' },
      authored: { type: 'date', description: 'Date request signed' },
      occurrence: { type: 'date', description: 'When service should occur' }
    },
    includes: ['ServiceRequest:patient', 'ServiceRequest:requester', 'ServiceRequest:performer'],
    revIncludes: ['Observation:based-on']
  },

  Communication: {
    name: 'Communication',
    category: 'WORKFLOW',
    description: 'Record of communication',
    icon: '💬',
    searchParams: {
      patient: { type: 'reference', description: 'Focus of the communication' },
      subject: { type: 'reference', description: 'Focus of the communication' },
      category: { type: 'token', description: 'Message category' },
      sender: { type: 'reference', description: 'Message sender' },
      recipient: { type: 'reference', description: 'Message recipient' },
      sent: { type: 'date', description: 'When sent' },
      received: { type: 'date', description: 'When received' },
      status: { type: 'token', description: 'preparation | in-progress | not-done | on-hold | stopped | completed | entered-in-error | unknown' },
      encounter: { type: 'reference', description: 'Encounter created as part of' },
      medium: { type: 'token', description: 'A channel of communication' }
    },
    includes: ['Communication:patient', 'Communication:sender', 'Communication:recipient'],
    revIncludes: []
  },

  CommunicationRequest: {
    name: 'CommunicationRequest',
    category: 'WORKFLOW',
    description: 'Request for communication',
    icon: '📨',
    searchParams: {
      patient: { type: 'reference', description: 'Focus of the communication request' },
      subject: { type: 'reference', description: 'Focus of the communication request' },
      category: { type: 'token', description: 'Message category' },
      sender: { type: 'reference', description: 'Message sender' },
      recipient: { type: 'reference', description: 'Message recipient' },
      status: { type: 'token', description: 'draft | active | on-hold | revoked | completed | entered-in-error | unknown' },
      encounter: { type: 'reference', description: 'Encounter created as part of' },
      requester: { type: 'reference', description: 'Who asks for the information to be shared' },
      authored: { type: 'date', description: 'When request transitioned to being actionable' },
      priority: { type: 'token', description: 'routine | urgent | asap | stat' }
    },
    includes: ['CommunicationRequest:patient', 'CommunicationRequest:sender', 'CommunicationRequest:recipient'],
    revIncludes: []
  },

  // Financial Resources
  Claim: {
    name: 'Claim',
    category: 'FINANCIAL',
    description: 'Insurance claim',
    icon: '💰',
    searchParams: {
      patient: { type: 'reference', description: 'Patient receiving the products or services' },
      insurer: { type: 'reference', description: 'The target payor/insurer' },
      provider: { type: 'reference', description: 'Provider responsible for the claim' },
      created: { type: 'date', description: 'The creation date' },
      identifier: { type: 'token', description: 'The primary identifier of the financial resource' },
      status: { type: 'token', description: 'The status of the claim' },
      use: { type: 'token', description: 'The kind of financial resource' },
      priority: { type: 'token', description: 'Processing priority requested' },
      payee: { type: 'reference', description: 'The party receiving payment' }
    },
    includes: ['Claim:patient', 'Claim:insurer', 'Claim:provider'],
    revIncludes: ['ExplanationOfBenefit:claim']
  },

  Coverage: {
    name: 'Coverage',
    category: 'FINANCIAL',
    description: 'Insurance coverage',
    icon: '🛡️',
    searchParams: {
      patient: { type: 'reference', description: 'Covered party' },
      subscriber: { type: 'reference', description: 'Reference to the subscriber' },
      beneficiary: { type: 'reference', description: 'Covered party' },
      payor: { type: 'reference', description: 'The identity of the insurer' },
      identifier: { type: 'token', description: 'The primary identifier of the insured and the coverage' },
      status: { type: 'token', description: 'The status of the Coverage' },
      type: { type: 'token', description: 'The kind of coverage' },
      'class-type': { type: 'token', description: 'Coverage class' },
      'class-value': { type: 'string', description: 'Value of the coverage class' },
      'policy-holder': { type: 'reference', description: 'Reference to the policyholder' }
    },
    includes: ['Coverage:patient', 'Coverage:payor', 'Coverage:subscriber'],
    revIncludes: []
  },

  ExplanationOfBenefit: {
    name: 'ExplanationOfBenefit',
    category: 'FINANCIAL',
    description: 'Explanation of insurance benefits',
    icon: '📄',
    searchParams: {
      patient: { type: 'reference', description: 'The reference to the patient' },
      provider: { type: 'reference', description: 'The reference to the provider' },
      created: { type: 'date', description: 'The creation date' },
      identifier: { type: 'token', description: 'The business identifier of the Explanation of Benefit' },
      status: { type: 'token', description: 'Status of the instance' },
      claim: { type: 'reference', description: 'The reference to the claim' },
      coverage: { type: 'reference', description: 'The plan under which the claim was adjudicated' },
      disposition: { type: 'string', description: 'The contents of the disposition message' },
      facility: { type: 'reference', description: 'Facility responsible for the goods and services' }
    },
    includes: ['ExplanationOfBenefit:patient', 'ExplanationOfBenefit:provider', 'ExplanationOfBenefit:claim'],
    revIncludes: []
  },

  // Foundation Resources
  DocumentReference: {
    name: 'DocumentReference',
    category: 'FOUNDATION',
    description: 'Reference to a document',
    icon: '📄',
    searchParams: {
      patient: { type: 'reference', description: 'Who/what is the subject of the document' },
      subject: { type: 'reference', description: 'Who/what is the subject of the document' },
      type: { type: 'token', description: 'Kind of document' },
      category: { type: 'token', description: 'Categorization of document' },
      date: { type: 'date', description: 'When this document reference was created' },
      author: { type: 'reference', description: 'Who and/or what authored the document' },
      custodian: { type: 'reference', description: 'Organization which maintains the document' },
      status: { type: 'token', description: 'current | superseded | entered-in-error' },
      identifier: { type: 'token', description: 'Master Version Specific Identifier' },
      authenticator: { type: 'reference', description: 'Who/what authenticated the document' },
      period: { type: 'date', description: 'Time of service that is being documented' }
    },
    includes: ['DocumentReference:patient', 'DocumentReference:author', 'DocumentReference:custodian'],
    revIncludes: []
  },

  Questionnaire: {
    name: 'Questionnaire',
    category: 'FOUNDATION',
    description: 'Structured set of questions',
    icon: '📝',
    searchParams: {
      identifier: { type: 'token', description: 'External identifier for the questionnaire' },
      code: { type: 'token', description: 'A code that corresponds to one of its items' },
      date: { type: 'date', description: 'The questionnaire publication date' },
      name: { type: 'string', description: 'Computationally friendly name of the questionnaire' },
      publisher: { type: 'string', description: 'Name of the publisher' },
      status: { type: 'token', description: 'draft | active | retired | unknown' },
      title: { type: 'string', description: 'The human-friendly name of the questionnaire' },
      url: { type: 'uri', description: 'The uri that identifies the questionnaire' },
      version: { type: 'token', description: 'The business version of the questionnaire' }
    },
    includes: [],
    revIncludes: ['QuestionnaireResponse:questionnaire']
  },

  QuestionnaireResponse: {
    name: 'QuestionnaireResponse',
    category: 'FOUNDATION',
    description: 'Response to a questionnaire',
    icon: '✍️',
    searchParams: {
      patient: { type: 'reference', description: 'The patient that is the subject of the questionnaire response' },
      subject: { type: 'reference', description: 'The subject of the questionnaire response' },
      author: { type: 'reference', description: 'The author of the questionnaire response' },
      authored: { type: 'date', description: 'When the questionnaire response was last changed' },
      identifier: { type: 'token', description: 'The unique identifier for the questionnaire response' },
      questionnaire: { type: 'reference', description: 'The questionnaire the answers are provided for' },
      status: { type: 'token', description: 'in-progress | completed | amended | entered-in-error | stopped' },
      encounter: { type: 'reference', description: 'Encounter associated with the questionnaire response' },
      source: { type: 'reference', description: 'The individual providing the information' }
    },
    includes: ['QuestionnaireResponse:patient', 'QuestionnaireResponse:questionnaire', 'QuestionnaireResponse:author'],
    revIncludes: []
  },

  ValueSet: {
    name: 'ValueSet',
    category: 'FOUNDATION',
    description: 'Set of codes for use',
    icon: '📚',
    searchParams: {
      code: { type: 'token', description: 'This special parameter searches for codes in the value set' },
      date: { type: 'date', description: 'The value set publication date' },
      name: { type: 'string', description: 'Computationally friendly name of the value set' },
      publisher: { type: 'string', description: 'Name of the publisher' },
      status: { type: 'token', description: 'draft | active | retired | unknown' },
      title: { type: 'string', description: 'The human-friendly name of the value set' },
      url: { type: 'uri', description: 'The uri that identifies the value set' },
      version: { type: 'token', description: 'The business version of the value set' },
      identifier: { type: 'token', description: 'External identifier for the value set' }
    },
    includes: [],
    revIncludes: []
  },

  CodeSystem: {
    name: 'CodeSystem',
    category: 'FOUNDATION',
    description: 'Declares a set of codes',
    icon: '🔤',
    searchParams: {
      code: { type: 'token', description: 'A code defined in the code system' },
      date: { type: 'date', description: 'The code system publication date' },
      name: { type: 'string', description: 'Computationally friendly name of the code system' },
      publisher: { type: 'string', description: 'Name of the publisher' },
      status: { type: 'token', description: 'draft | active | retired | unknown' },
      title: { type: 'string', description: 'The human-friendly name of the code system' },
      url: { type: 'uri', description: 'The uri that identifies the code system' },
      version: { type: 'token', description: 'The business version of the code system' },
      identifier: { type: 'token', description: 'External identifier for the code system' },
      'content-mode': { type: 'token', description: 'not-present | example | fragment | complete | supplement' }
    },
    includes: [],
    revIncludes: []
  },

  ConceptMap: {
    name: 'ConceptMap',
    category: 'FOUNDATION',
    description: 'Mapping between code systems',
    icon: '🔗',
    searchParams: {
      date: { type: 'date', description: 'The concept map publication date' },
      name: { type: 'string', description: 'Computationally friendly name of the concept map' },
      publisher: { type: 'string', description: 'Name of the publisher' },
      status: { type: 'token', description: 'draft | active | retired | unknown' },
      title: { type: 'string', description: 'The human-friendly name of the concept map' },
      url: { type: 'uri', description: 'The uri that identifies the concept map' },
      version: { type: 'token', description: 'The business version of the concept map' },
      identifier: { type: 'token', description: 'External identifier for the concept map' },
      'source-uri': { type: 'uri', description: 'The source value set that contains the concepts' },
      'target-uri': { type: 'uri', description: 'The target value set which provides context' }
    },
    includes: [],
    revIncludes: []
  },

  StructureDefinition: {
    name: 'StructureDefinition',
    category: 'FOUNDATION',
    description: 'Structural definition of resources',
    icon: '🏗️',
    searchParams: {
      date: { type: 'date', description: 'The structure definition publication date' },
      name: { type: 'string', description: 'Computationally friendly name of the structure definition' },
      publisher: { type: 'string', description: 'Name of the publisher' },
      status: { type: 'token', description: 'draft | active | retired | unknown' },
      title: { type: 'string', description: 'The human-friendly name of the structure definition' },
      url: { type: 'uri', description: 'The uri that identifies the structure definition' },
      version: { type: 'token', description: 'The business version of the structure definition' },
      identifier: { type: 'token', description: 'External identifier for the structure definition' },
      kind: { type: 'token', description: 'primitive-type | complex-type | resource | logical' },
      type: { type: 'uri', description: 'Type defined or constrained by this structure' }
    },
    includes: [],
    revIncludes: []
  },

  // Infrastructure Resources
  SupplyDelivery: {
    name: 'SupplyDelivery',
    category: 'INFRASTRUCTURE',
    description: 'Delivery of supply',
    icon: '📦',
    searchParams: {
      patient: { type: 'reference', description: 'Patient for whom the item is supplied' },
      identifier: { type: 'token', description: 'External identifier' },
      receiver: { type: 'reference', description: 'Who collected the Supply' },
      status: { type: 'token', description: 'in-progress | completed | abandoned | entered-in-error' },
      supplier: { type: 'reference', description: 'Dispenser' }
    },
    includes: ['SupplyDelivery:patient', 'SupplyDelivery:receiver', 'SupplyDelivery:supplier'],
    revIncludes: []
  },

  Provenance: {
    name: 'Provenance',
    category: 'INFRASTRUCTURE',
    description: 'Resource origin and history',
    icon: '📜',
    searchParams: {
      target: { type: 'reference', description: 'Target Reference(s)' },
      patient: { type: 'reference', description: 'Target Reference(s)' },
      recorded: { type: 'date', description: 'When the activity was recorded' },
      agent: { type: 'reference', description: 'Who participated' },
      'agent-type': { type: 'token', description: 'How the agent participated' },
      'agent-role': { type: 'token', description: 'What the agents role was' },
      signature: { type: 'token', description: 'Indication of the reason for the change' },
      location: { type: 'reference', description: 'Where the activity occurred' }
    },
    includes: ['Provenance:target', 'Provenance:agent', 'Provenance:location'],
    revIncludes: []
  },

  List: {
    name: 'List',
    category: 'INFRASTRUCTURE',
    description: 'Collection of resources',
    icon: '📋',
    searchParams: {
      patient: { type: 'reference', description: 'If all resources have the same subject' },
      subject: { type: 'reference', description: 'If all resources have the same subject' },
      source: { type: 'reference', description: 'Who and/or what defined the list contents' },
      status: { type: 'token', description: 'current | retired | entered-in-error' },
      title: { type: 'string', description: 'Descriptive name for the list' },
      code: { type: 'token', description: 'What the purpose of this list is' },
      date: { type: 'date', description: 'When the list was prepared' },
      'empty-reason': { type: 'token', description: 'Why list is empty' },
      item: { type: 'reference', description: 'Actual entry' },
      notes: { type: 'string', description: 'The annotation - text content' }
    },
    includes: ['List:subject', 'List:source', 'List:item'],
    revIncludes: []
  },

  Basic: {
    name: 'Basic',
    category: 'INFRASTRUCTURE',
    description: 'Generic resource for custom content',
    icon: '📦',
    searchParams: {
      patient: { type: 'reference', description: 'Identifies the focus of this resource' },
      subject: { type: 'reference', description: 'Identifies the focus of this resource' },
      created: { type: 'date', description: 'When created' },
      identifier: { type: 'token', description: 'Business identifier' },
      code: { type: 'token', description: 'Kind of Resource' },
      author: { type: 'reference', description: 'Who created' }
    },
    includes: ['Basic:subject', 'Basic:author'],
    revIncludes: []
  },

  Composition: {
    name: 'Composition',
    category: 'INFRASTRUCTURE',
    description: 'Clinical document',
    icon: '📄',
    searchParams: {
      patient: { type: 'reference', description: 'Who and/or what the composition is about' },
      subject: { type: 'reference', description: 'Who and/or what the composition is about' },
      author: { type: 'reference', description: 'Who and/or what authored the composition' },
      date: { type: 'date', description: 'Composition editing time' },
      type: { type: 'token', description: 'Kind of composition' },
      title: { type: 'string', description: 'Human-readable label' },
      status: { type: 'token', description: 'preliminary | final | amended | entered-in-error' },
      identifier: { type: 'token', description: 'Version-independent identifier' },
      encounter: { type: 'reference', description: 'Context of the composition' },
      section: { type: 'token', description: 'Classification of section' }
    },
    includes: ['Composition:subject', 'Composition:author', 'Composition:encounter'],
    revIncludes: []
  },

  Media: {
    name: 'Media',
    category: 'INFRASTRUCTURE',
    description: 'Photo, video, or audio recording',
    icon: '📷',
    searchParams: {
      patient: { type: 'reference', description: 'Who/What this Media is a record of' },
      subject: { type: 'reference', description: 'Who/What this Media is a record of' },
      identifier: { type: 'token', description: 'Identifier(s) for the image' },
      created: { type: 'date', description: 'When Media was collected' },
      encounter: { type: 'reference', description: 'Encounter associated with media' },
      operator: { type: 'reference', description: 'The person who generated the image' },
      status: { type: 'token', description: 'preparation | in-progress | not-done | on-hold | stopped | completed | entered-in-error | unknown' },
      type: { type: 'token', description: 'The type of acquisition equipment/process' },
      'site': { type: 'token', description: 'Body part in media' },
      'view': { type: 'token', description: 'Imaging view' }
    },
    includes: ['Media:subject', 'Media:encounter', 'Media:operator'],
    revIncludes: []
  }
};

// Helper function to get resources by category
export function getResourcesByCategory(category) {
  return Object.entries(FHIR_RESOURCES)
    .filter(([_, resource]) => resource.category === category)
    .map(([key, resource]) => ({ key, ...resource }));
}

// Helper function to search resources
export function searchResources(searchTerm) {
  const term = searchTerm.toLowerCase();
  return Object.entries(FHIR_RESOURCES)
    .filter(([key, resource]) => 
      key.toLowerCase().includes(term) ||
      resource.name.toLowerCase().includes(term) ||
      resource.description.toLowerCase().includes(term)
    )
    .map(([key, resource]) => ({ key, ...resource }));
}

// Helper function to get search parameter type
export function getSearchParamType(resourceType, paramName) {
  const resource = FHIR_RESOURCES[resourceType];
  if (!resource) return null;
  
  const param = resource.searchParams[paramName];
  return param ? param.type : null;
}

// Helper function to get available search modifiers for a parameter type
export function getSearchModifiers(paramType) {
  const modifiers = {
    string: ['', ':exact', ':contains'],
    token: ['', ':not', ':text', ':in', ':not-in', ':above', ':below'],
    reference: ['', ':identifier', ':type', ':missing'],
    date: ['', 'eq', 'ne', 'gt', 'ge', 'lt', 'le', 'sa', 'eb', 'ap'],
    number: ['', 'eq', 'ne', 'gt', 'ge', 'lt', 'le', 'sa', 'eb', 'ap'],
    quantity: ['', 'eq', 'ne', 'gt', 'ge', 'lt', 'le', 'sa', 'eb', 'ap'],
    uri: ['', ':below', ':above']
  };
  
  return modifiers[paramType] || [''];
}

// Export default for convenience
export default FHIR_RESOURCES;