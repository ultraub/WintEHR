/**
 * ServiceRequest Dialog Configuration
 * Configuration for BaseResourceDialog to handle service request/order management
 */

// FHIR Value Sets for ServiceRequest
export const SERVICE_REQUEST_STATUS_OPTIONS = [
  { value: 'draft', display: 'Draft' },
  { value: 'active', display: 'Active' },
  { value: 'on-hold', display: 'On Hold' },
  { value: 'revoked', display: 'Revoked' },
  { value: 'completed', display: 'Completed' },
  { value: 'entered-in-error', display: 'Entered in Error' },
  { value: 'unknown', display: 'Unknown' }
];

export const SERVICE_REQUEST_INTENT_OPTIONS = [
  { value: 'proposal', display: 'Proposal' },
  { value: 'plan', display: 'Plan' },
  { value: 'directive', display: 'Directive' },
  { value: 'order', display: 'Order' },
  { value: 'original-order', display: 'Original Order' },
  { value: 'reflex-order', display: 'Reflex Order' },
  { value: 'filler-order', display: 'Filler Order' },
  { value: 'instance-order', display: 'Instance Order' },
  { value: 'option', display: 'Option' }
];

export const SERVICE_REQUEST_PRIORITY_OPTIONS = [
  { value: 'routine', display: 'Routine' },
  { value: 'urgent', display: 'Urgent' },
  { value: 'asap', display: 'ASAP' },
  { value: 'stat', display: 'STAT' }
];

export const ORDER_CATEGORIES = [
  { 
    value: 'laboratory', 
    display: 'Laboratory',
    code: '108252007',
    system: 'http://snomed.info/sct',
    description: 'Laboratory procedures and tests'
  },
  { 
    value: 'imaging', 
    display: 'Imaging',
    code: '363679005',
    system: 'http://snomed.info/sct',
    description: 'Diagnostic imaging studies'
  },
  { 
    value: 'procedure', 
    display: 'Procedure',
    code: '387713003',
    system: 'http://snomed.info/sct',
    description: 'Medical procedures'
  },
  { 
    value: 'therapy', 
    display: 'Therapy',
    code: '277132007',
    system: 'http://snomed.info/sct',
    description: 'Therapeutic interventions'
  },
  { 
    value: 'consultation', 
    display: 'Consultation',
    code: '11429006',
    system: 'http://snomed.info/sct',
    description: 'Specialist consultations'
  }
];

// Common lab tests with LOINC codes
export const COMMON_LAB_TESTS = [
  { code: '2339-0', display: 'Glucose', category: 'chemistry' },
  { code: '4548-4', display: 'Hemoglobin A1c', category: 'chemistry' },
  { code: '2093-3', display: 'Cholesterol, Total', category: 'chemistry' },
  { code: '2571-8', display: 'Triglycerides', category: 'chemistry' },
  { code: '33747-0', display: 'Basic Metabolic Panel', category: 'panel' },
  { code: '24323-8', display: 'Comprehensive Metabolic Panel', category: 'panel' },
  { code: '57698-3', display: 'Lipid Panel', category: 'panel' },
  { code: '58410-2', display: 'Complete Blood Count', category: 'panel' },
  { code: '3094-0', display: 'BUN', category: 'chemistry' },
  { code: '2160-0', display: 'Creatinine', category: 'chemistry' },
  { code: '6598-7', display: 'BUN/Creatinine ratio', category: 'chemistry' },
  { code: '2947-0', display: 'Sodium', category: 'chemistry' },
  { code: '2823-3', display: 'Potassium', category: 'chemistry' },
  { code: '2075-0', display: 'Chloride', category: 'chemistry' },
  { code: '1975-2', display: 'Bilirubin, Total', category: 'chemistry' },
  { code: '1742-6', display: 'ALT', category: 'chemistry' },
  { code: '1920-8', display: 'AST', category: 'chemistry' }
];

// Common imaging studies
export const COMMON_IMAGING_STUDIES = [
  { code: '168731009', display: 'Chest X-ray', category: 'radiography' },
  { code: '429858000', display: 'Chest CT', category: 'ct' },
  { code: '432102000', display: 'Abdominal CT', category: 'ct' },
  { code: '241615005', display: 'Brain MRI', category: 'mri' },
  { code: '241570003', display: 'Cardiac MRI', category: 'mri' },
  { code: '18726006', display: 'Echocardiogram', category: 'ultrasound' },
  { code: '268400002', display: 'Abdominal Ultrasound', category: 'ultrasound' },
  { code: '12817006', display: 'EKG', category: 'cardiac' },
  { code: '264301008', display: 'Stress Test', category: 'cardiac' }
];

// Default initial values for new service request
export const initialValues = {
  selectedTest: null,
  customTest: '',
  category: 'laboratory',
  priority: 'routine',
  status: 'active',
  intent: 'order',
  indication: '',
  notes: '',
  scheduledDate: null,
  fastingRequired: false,
  urgentContact: false,
  providerPin: ''
};

// Validation rules for form fields
export const validationRules = {
  selectedTest: {
    required: false,
    label: 'Test/Procedure',
    custom: (value, formData) => {
      if (!formData.selectedTest && !formData.customTest) {
        return 'Please specify a test/procedure or select from the list';
      }
      return null;
    }
  },
  customTest: {
    required: false,
    label: 'Custom Test/Procedure'
  },
  category: {
    required: true,
    label: 'Category'
  },
  priority: {
    required: true,
    label: 'Priority'
  },
  status: {
    required: true,
    label: 'Status'
  },
  intent: {
    required: true,
    label: 'Intent'
  },
  indication: {
    required: true,
    label: 'Clinical Indication',
    minLength: 5
  },
  providerPin: {
    required: true,
    label: 'Provider PIN',
    minLength: 4,
    custom: (value, formData) => {
      if (formData.status === 'active' && (!value || value.length < 4)) {
        return 'Provider PIN is required to authorize orders';
      }
      return null;
    }
  }
};

// Helper function to get status color
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active': 
      return 'success';
    case 'draft':
    case 'on-hold': 
      return 'warning';
    case 'revoked':
    case 'entered-in-error': 
      return 'error';
    case 'completed':
      return 'info';
    default: 
      return 'default';
  }
};

// Helper function to get priority color
export const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'stat':
      return 'error';
    case 'urgent':
    case 'asap': 
      return 'warning';
    case 'routine': 
      return 'success';
    default: 
      return 'default';
  }
};

// Helper function to get category icon
export const getCategoryIcon = (category) => {
  switch (category?.toLowerCase()) {
    case 'laboratory': return '🧪';
    case 'imaging': return '📷';
    case 'procedure': return '🏥';
    case 'therapy': return '💊';
    case 'consultation': return '👨‍⚕️';
    default: return '📋';
  }
};

// Helper function to get test/procedure display
export const getTestDisplay = (formData) => {
  if (formData.selectedTest) {
    return formData.selectedTest.display;
  }
  return formData.customTest || 'No test selected';
};

// Parse existing FHIR ServiceRequest resource into form data
export const parseServiceRequestResource = (serviceRequest) => {
  if (!serviceRequest) return initialValues;

  const status = serviceRequest.status || 'active';
  const priority = serviceRequest.priority || 'routine';
  const intent = serviceRequest.intent || 'order';
  
  // Extract category
  const category = serviceRequest.category?.[0]?.coding?.[0]?.code || 'laboratory';
  
  // Extract scheduled date
  const scheduledDate = serviceRequest.occurrenceDateTime ? 
    new Date(serviceRequest.occurrenceDateTime) : 
    serviceRequest.occurrencePeriod?.start ? 
      new Date(serviceRequest.occurrencePeriod.start) : null;

  // Extract test/procedure information
  let selectedTest = null;
  let customTest = '';
  
  if (serviceRequest.code) {
    const code = serviceRequest.code;
    if (code.coding && code.coding.length > 0) {
      const coding = code.coding[0];
      selectedTest = {
        code: coding.code,
        display: coding.display || code.text,
        system: coding.system || 'http://loinc.org',
        category: category,
        source: 'existing'
      };
    } else if (code.text) {
      customTest = code.text;
    }
  }

  // Extract clinical indication
  const indication = serviceRequest.reasonCode?.[0]?.text || 
                    serviceRequest.reasonReference?.[0]?.display || '';

  // Extract notes
  const notes = serviceRequest.note?.[0]?.text || '';

  // Extract special requirements from notes or extensions
  const allNotes = serviceRequest.note?.map(n => n.text).join(' ') || '';
  const fastingRequired = allNotes.toLowerCase().includes('fasting');
  const urgentContact = serviceRequest.priority === 'urgent' || serviceRequest.priority === 'stat';

  return {
    selectedTest,
    customTest,
    category: typeof category === 'string' ? category : 'laboratory',
    priority: typeof priority === 'string' ? priority : 'routine',
    status: typeof status === 'string' ? status : 'active',
    intent: typeof intent === 'string' ? intent : 'order',
    indication,
    notes,
    scheduledDate,
    fastingRequired,
    urgentContact,
    providerPin: '' // Never pre-populate PIN for security
  };
};

// Helper functions for FHIR resource creation
export const createServiceRequestResource = (formData, patientId, userId, userDisplay) => {
  const categoryData = ORDER_CATEGORIES.find(c => c.value === formData.category);
  
  return {
    resourceType: 'ServiceRequest',
    id: `service-request-${Date.now()}`,
    status: formData.status,
    intent: formData.intent,
    priority: formData.priority,
    category: [{
      coding: [{
        system: categoryData?.system || 'http://snomed.info/sct',
        code: categoryData?.code || '',
        display: categoryData?.display || formData.category
      }]
    }],
    code: formData.selectedTest ? {
      coding: [{
        system: formData.selectedTest.system || 'http://loinc.org',
        code: formData.selectedTest.code,
        display: formData.selectedTest.display
      }],
      text: formData.selectedTest.display
    } : {
      text: formData.customTest
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    authoredOn: new Date().toISOString(),
    requester: {
      reference: `Practitioner/${userId}`,
      display: userDisplay
    },
    ...(formData.scheduledDate && {
      occurrenceDateTime: formData.scheduledDate.toISOString()
    }),
    reasonCode: [{
      text: formData.indication
    }],
    note: [
      ...(formData.notes ? [{ text: formData.notes }] : []),
      ...(formData.fastingRequired ? [{ text: 'Fasting required' }] : []),
      ...(formData.urgentContact ? [{ text: 'Urgent - contact provider with results' }] : [])
    ].filter(note => note.text) // Remove empty notes
  };
};

// Create updated FHIR ServiceRequest resource for editing
export const updateServiceRequestResource = (formData, existingResource, userId, userDisplay) => {
  if (!existingResource.id) {
    throw new Error('Cannot update service request: missing resource ID');
  }

  const categoryData = ORDER_CATEGORIES.find(c => c.value === formData.category);

  return {
    ...existingResource, // Preserve existing fields
    resourceType: 'ServiceRequest',
    id: existingResource.id,
    status: formData.status,
    intent: formData.intent,
    priority: formData.priority,
    category: [{
      coding: [{
        system: categoryData?.system || 'http://snomed.info/sct',
        code: categoryData?.code || '',
        display: categoryData?.display || formData.category
      }]
    }],
    code: formData.selectedTest ? {
      coding: [{
        system: formData.selectedTest.system || 'http://loinc.org',
        code: formData.selectedTest.code,
        display: formData.selectedTest.display
      }],
      text: formData.selectedTest.display
    } : {
      text: formData.customTest
    },
    subject: existingResource.subject || {
      reference: `Patient/${existingResource.subject?.reference?.split('/')?.[1] || 'unknown'}`
    },
    authoredOn: existingResource.authoredOn || new Date().toISOString(),
    requester: {
      reference: `Practitioner/${userId}`,
      display: userDisplay
    },
    ...(formData.scheduledDate && {
      occurrenceDateTime: formData.scheduledDate.toISOString()
    }),
    reasonCode: [{
      text: formData.indication
    }],
    note: [
      ...(formData.notes ? [{ text: formData.notes }] : []),
      ...(formData.fastingRequired ? [{ text: 'Fasting required' }] : []),
      ...(formData.urgentContact ? [{ text: 'Urgent - contact provider with results' }] : [])
    ].filter(note => note.text) // Remove empty notes
  };
};

// Get appropriate tests/procedures based on category
export const getTestsForCategory = (category) => {
  switch (category) {
    case 'laboratory':
      return COMMON_LAB_TESTS;
    case 'imaging':
      return COMMON_IMAGING_STUDIES;
    default:
      return [];
  }
};

// Validate clinical appropriateness (placeholder for future CDS integration)
export const validateClinicalAppropriateness = (formData, patientConditions = [], recentOrders = []) => {
  const warnings = [];
  
  // Check for duplicate recent orders
  const recentSimilarOrders = recentOrders.filter(order => {
    const orderCode = order.code?.coding?.[0]?.code;
    const formCode = formData.selectedTest?.code;
    return orderCode === formCode && 
           new Date(order.authoredOn) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
  });
  
  if (recentSimilarOrders.length > 0) {
    warnings.push({
      type: 'duplicate',
      message: `Similar test ordered within the last 7 days`,
      severity: 'warning'
    });
  }
  
  // Check for fasting requirements on common tests
  if (formData.selectedTest?.code && ['2339-0', '2571-8'].includes(formData.selectedTest.code)) {
    if (!formData.fastingRequired) {
      warnings.push({
        type: 'fasting',
        message: 'This test typically requires fasting',
        severity: 'info'
      });
    }
  }
  
  return warnings;
};