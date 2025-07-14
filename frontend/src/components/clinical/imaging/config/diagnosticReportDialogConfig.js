/**
 * DiagnosticReport Dialog Configuration
 * Configuration for BaseResourceDialog to handle imaging report creation/editing
 */

// FHIR Value Sets for DiagnosticReport
export const DIAGNOSTIC_REPORT_STATUS_OPTIONS = [
  { value: 'preliminary', display: 'Preliminary' },
  { value: 'final', display: 'Final' },
  { value: 'amended', display: 'Amended' },
  { value: 'corrected', display: 'Corrected' },
  { value: 'appended', display: 'Appended' },
  { value: 'cancelled', display: 'Cancelled' },
  { value: 'entered-in-error', display: 'Entered in Error' }
];

// Common LOINC codes for imaging reports
export const IMAGING_REPORT_CODES = [
  {
    code: '18748-4',
    display: 'Diagnostic Imaging Report',
    system: 'http://loinc.org'
  },
  {
    code: '18755-9',
    display: 'MRI Report',
    system: 'http://loinc.org'
  },
  {
    code: '18752-6',
    display: 'CT Report',
    system: 'http://loinc.org'
  },
  {
    code: '18756-7',
    display: 'Ultrasound Report',
    system: 'http://loinc.org'
  },
  {
    code: '18754-2',
    display: 'X-ray Report',
    system: 'http://loinc.org'
  }
];

// Default initial values for new diagnostic report
export const initialValues = {
  status: 'preliminary',
  findings: '',
  impression: '',
  recommendations: '',
  reportCode: '18748-4' // Default to generic imaging report
};

// Validation rules for form fields
export const validationRules = {
  status: {
    required: true,
    label: 'Report Status'
  },
  findings: {
    required: true,
    label: 'Findings',
    minLength: 10
  },
  impression: {
    required: true,
    label: 'Impression',
    minLength: 5
  },
  recommendations: {
    required: false,
    label: 'Recommendations'
  }
};

// Helper function to get status color
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'final':
    case 'corrected':
    case 'appended':
      return 'success';
    case 'preliminary':
      return 'warning';
    case 'amended':
      return 'info';
    case 'cancelled':
    case 'entered-in-error':
      return 'error';
    default:
      return 'default';
  }
};

// Helper function to determine report code based on study modality
export const getReportCodeFromStudy = (study) => {
  if (!study?.modality?.[0]?.code) {
    return IMAGING_REPORT_CODES[0]; // Default to generic
  }
  
  const modalityCode = study.modality[0].code.toLowerCase();
  
  switch (modalityCode) {
    case 'mr':
      return IMAGING_REPORT_CODES.find(c => c.code === '18755-9') || IMAGING_REPORT_CODES[0];
    case 'ct':
      return IMAGING_REPORT_CODES.find(c => c.code === '18752-6') || IMAGING_REPORT_CODES[0];
    case 'us':
      return IMAGING_REPORT_CODES.find(c => c.code === '18756-7') || IMAGING_REPORT_CODES[0];
    case 'dx':
    case 'cr':
    case 'dr':
      return IMAGING_REPORT_CODES.find(c => c.code === '18754-2') || IMAGING_REPORT_CODES[0];
    default:
      return IMAGING_REPORT_CODES[0];
  }
};

// Parse existing FHIR DiagnosticReport resource into form data
export const parseDiagnosticReportResource = (report) => {
  if (!report) return initialValues;

  // Extract findings from presentedForm data
  let findings = '';
  if (report.presentedForm?.[0]?.data) {
    const data = report.presentedForm[0].data;
    try {
      // Try base64 decode first
      findings = atob(data);
    } catch (e) {
      // If base64 fails, try hex decode
      try {
        findings = data.match(/.{1,2}/g).map(byte => 
          String.fromCharCode(parseInt(byte, 16))
        ).join('');
      } catch (hexError) {
        // If both fail, use as-is
        findings = data;
      }
    }
  } else if (report.text?.div) {
    findings = report.text.div;
  }

  const impression = report.conclusion || '';
  const recommendations = report.conclusionCode?.[0]?.text || '';
  const status = report.status || 'preliminary';
  const reportCode = report.code?.coding?.[0]?.code || '18748-4';

  return {
    status,
    findings,
    impression,
    recommendations,
    reportCode
  };
};

// Helper functions for FHIR resource creation
export const createDiagnosticReportResource = (formData, patientId, study, userId, userDisplay) => {
  const reportCodeInfo = IMAGING_REPORT_CODES.find(c => c.code === formData.reportCode) || IMAGING_REPORT_CODES[0];
  
  return {
    resourceType: 'DiagnosticReport',
    id: `diagnostic-report-${Date.now()}`,
    status: formData.status,
    code: {
      coding: [{
        system: reportCodeInfo.system,
        code: reportCodeInfo.code,
        display: reportCodeInfo.display
      }],
      text: `${study.modality?.[0]?.display || 'Imaging'} Report - ${study.description || 'Unknown Study'}`
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: new Date().toISOString(),
    issued: new Date().toISOString(),
    performer: [{
      reference: `Practitioner/${userId}`,
      display: userDisplay
    }],
    basedOn: [{
      reference: `ImagingStudy/${study.id}`,
      display: study.description
    }],
    conclusion: formData.impression,
    ...(formData.recommendations && {
      conclusionCode: [{
        text: formData.recommendations
      }]
    }),
    presentedForm: [{
      contentType: 'text/plain',
      data: btoa(formData.findings), // Base64 encode the findings
      title: 'Detailed Findings'
    }]
  };
};

// Create updated FHIR DiagnosticReport resource for editing
export const updateDiagnosticReportResource = (formData, existingResource, userId, userDisplay) => {
  if (!existingResource.id) {
    throw new Error('Cannot update diagnostic report: missing resource ID');
  }

  const reportCodeInfo = IMAGING_REPORT_CODES.find(c => c.code === formData.reportCode) || IMAGING_REPORT_CODES[0];

  return {
    ...existingResource, // Preserve existing fields
    resourceType: 'DiagnosticReport',
    id: existingResource.id,
    status: formData.status,
    code: {
      coding: [{
        system: reportCodeInfo.system,
        code: reportCodeInfo.code,
        display: reportCodeInfo.display
      }],
      text: existingResource.code?.text || `${reportCodeInfo.display}`
    },
    subject: existingResource.subject,
    effectiveDateTime: existingResource.effectiveDateTime || new Date().toISOString(),
    issued: new Date().toISOString(),
    performer: [{
      reference: `Practitioner/${userId}`,
      display: userDisplay
    }],
    basedOn: existingResource.basedOn,
    conclusion: formData.impression,
    ...(formData.recommendations && {
      conclusionCode: [{
        text: formData.recommendations
      }]
    }),
    presentedForm: [{
      contentType: 'text/plain',
      data: btoa(formData.findings), // Base64 encode the findings
      title: 'Detailed Findings'
    }]
  };
};

// Helper function to extract study details for display
export const getStudyDetails = (study) => {
  if (!study) return {};
  
  return {
    modality: study.modality?.[0]?.display || study.modality?.[0]?.code || 'Unknown',
    description: study.description || 'Imaging Study',
    date: study.started || study.performedDateTime,
    bodySite: study.bodySite?.[0]?.display || study.bodySite?.[0]?.coding?.[0]?.display || '',
    accession: study.identifier?.[0]?.value || '',
    series: study.numberOfSeries || 0,
    instances: study.numberOfInstances || 0
  };
};