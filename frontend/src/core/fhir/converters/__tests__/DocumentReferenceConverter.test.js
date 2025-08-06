/**
 * Test suite for DocumentReferenceConverter
 * Tests content extraction, validation, and FHIR compliance
 */

import { DocumentReferenceConverter } from '../../core/fhir/converters/DocumentReferenceConverter';
import { DocumentContentValidator } from '../../../documents/documentContentValidator';

describe('DocumentReferenceConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new DocumentReferenceConverter();
  });

  describe('Content Extraction', () => {
    test('should extract plain text content', () => {
      const docRef = {
        id: 'test-doc-1',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa('This is plain text content')
          }
        }]
      };

      const result = converter.extractDocumentContent(docRef);

      expect(result.type).toBe('text');
      expect(result.content).toBe('This is plain text content');
      expect(result.error).toBeNull();
    });

    test('should extract SOAP content', () => {
      const soapData = {
        subjective: 'Patient complains of headache',
        objective: 'Alert and oriented, BP 120/80',
        assessment: 'Tension headache',
        plan: 'Rest and ibuprofen'
      };

      const docRef = {
        id: 'test-doc-2',
        content: [{
          attachment: {
            contentType: 'application/json',
            data: btoa(JSON.stringify(soapData))
          }
        }]
      };

      const result = converter.extractDocumentContent(docRef);

      expect(result.type).toBe('soap');
      expect(result.sections).toBeDefined();
      expect(result.sections.subjective).toBe('Patient complains of headache');
      expect(result.sections.objective).toBe('Alert and oriented, BP 120/80');
      expect(result.sections.assessment).toBe('Tension headache');
      expect(result.sections.plan).toBe('Rest and ibuprofen');
      expect(result.error).toBeNull();
    });

    test('should extract medical history content', () => {
      const historyData = {
        chiefComplaint: 'Chest pain',
        historyOfPresentIllness: 'Started 2 hours ago',
        pastMedicalHistory: 'Hypertension, diabetes'
      };

      const docRef = {
        id: 'test-doc-3',
        content: [{
          attachment: {
            contentType: 'application/json',
            data: btoa(JSON.stringify(historyData))
          }
        }]
      };

      const result = converter.extractDocumentContent(docRef);

      expect(result.type).toBe('medical-history');
      expect(result.content).toContain('Chief Complaint: Chest pain');
      expect(result.content).toContain('History of Present Illness: Started 2 hours ago');
      expect(result.content).toContain('Past Medical History: Hypertension, diabetes');
      expect(result.error).toBeNull();
    });

    test('should handle malformed base64', () => {
      const docRef = {
        id: 'test-doc-4',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: 'invalid-base64!!!'
          }
        }]
      };

      const result = converter.extractDocumentContent(docRef);

      expect(result.type).toBe('text');
      expect(result.content).toBe('invalid-base64!!!'); // Should use as-is
      expect(result.error).toBeNull();
    });

    test('should handle missing attachment data', () => {
      const docRef = {
        id: 'test-doc-5',
        content: [{
          attachment: {
            contentType: 'text/plain'
            // Missing data field
          }
        }]
      };

      const result = converter.extractDocumentContent(docRef);

      expect(result.error).toContain('No content data found');
    });

    test('should handle legacy text field', () => {
      const docRef = {
        id: 'test-doc-6',
        text: {
          div: '<div>Legacy text content</div>'
        }
      };

      const result = converter.extractDocumentContent(docRef);

      expect(result.type).toBe('text');
      expect(result.content).toBe('Legacy text content'); // HTML stripped
      expect(result.error).toBeNull();
    });

    test('should handle empty content gracefully', () => {
      const docRef = {
        id: 'test-doc-7',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa('') // Empty content
          }
        }]
      };

      const result = converter.extractDocumentContent(docRef);

      expect(result.error).toContain('Decoded content is empty');
    });
  });

  describe('Form Parsing', () => {
    test('should parse FHIR DocumentReference to form data', () => {
      const soapData = {
        subjective: 'Patient reports fatigue',
        objective: 'Appears tired, vital signs stable',
        assessment: 'Viral syndrome',
        plan: 'Rest and fluids'
      };

      const docRef = {
        id: 'test-doc-8',
        status: 'current',
        docStatus: 'final',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '11506-3',
            display: 'Progress note'
          }]
        },
        subject: {
          reference: 'Patient/patient-123'
        },
        author: [{
          reference: 'Practitioner/practitioner-456'
        }],
        date: '2024-01-15T10:30:00Z',
        content: [{
          attachment: {
            contentType: 'application/json',
            data: btoa(JSON.stringify(soapData)),
            title: 'Progress Note'
          }
        }],
        description: 'Follow-up visit'
      };

      const formData = converter._parseResourceToForm(docRef);

      expect(formData.type).toBe('progress');
      expect(formData.status).toBe('current');
      expect(formData.docStatus).toBe('final');
      expect(formData.contentType).toBe('soap');
      expect(formData.soapSections.subjective).toBe('Patient reports fatigue');
      expect(formData.soapSections.objective).toBe('Appears tired, vital signs stable');
      expect(formData.title).toBe('Progress Note');
      expect(formData.description).toBe('Follow-up visit');
      expect(formData.signNote).toBe(true); // docStatus is final
    });

    test('should handle unknown LOINC code', () => {
      const docRef = {
        id: 'test-doc-9',
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '99999-9', // Unknown code
            display: 'Unknown Note Type'
          }]
        },
        subject: {
          reference: 'Patient/patient-123'
        },
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa('Simple text content')
          }
        }]
      };

      const formData = converter._parseResourceToForm(docRef);

      expect(formData.type).toBe('progress'); // Should default to progress
    });
  });

  describe('FHIR Resource Creation', () => {
    test('should create FHIR resource from form data', () => {
      const formData = {
        type: 'soap',
        status: 'current',
        docStatus: 'preliminary',
        contentType: 'soap',
        soapSections: {
          subjective: 'Patient complains of dizziness',
          objective: 'BP 150/90, otherwise normal exam',
          assessment: 'Hypertension, uncontrolled',
          plan: 'Increase lisinopril, recheck in 2 weeks'
        },
        title: 'Hypertension Follow-up',
        description: 'Routine BP check',
        signNote: false
      };

      const context = {
        patientId: 'patient-789',
        encounterId: 'encounter-456',
        authorId: 'practitioner-123'
      };

      const fhirResource = converter._createResourceFromForm(formData, context);

      expect(fhirResource.resourceType).toBe('DocumentReference');
      expect(fhirResource.status).toBe('current');
      expect(fhirResource.docStatus).toBe('preliminary');
      expect(fhirResource.type.coding[0].code).toBe('34109-9'); // SOAP note LOINC code
      expect(fhirResource.subject.reference).toBe('Patient/patient-789');
      expect(fhirResource.author[0].reference).toBe('Practitioner/practitioner-123');
      expect(fhirResource.context.encounter[0].reference).toBe('Encounter/encounter-456');
      expect(fhirResource.content[0].attachment.contentType).toBe('application/json');
      
      // Verify content encoding
      const decodedContent = atob(fhirResource.content[0].attachment.data);
      const parsedContent = JSON.parse(decodedContent);
      expect(parsedContent.subjective).toBe('Patient complains of dizziness');
      expect(parsedContent.objective).toBe('BP 150/90, otherwise normal exam');
    });

    test('should handle plain text content', () => {
      const formData = {
        type: 'progress',
        contentType: 'text',
        content: 'Patient doing well. Continue current medications.',
        title: 'Progress Note'
      };

      const context = {
        patientId: 'patient-111'
      };

      const fhirResource = converter._createResourceFromForm(formData, context);

      expect(fhirResource.content[0].attachment.contentType).toBe('text/plain');
      
      const decodedContent = atob(fhirResource.content[0].attachment.data);
      expect(decodedContent).toBe('Patient doing well. Continue current medications.');
    });
  });

  describe('Validation Integration', () => {
    test('should validate extracted content with DocumentContentValidator', () => {
      const validSOAPDoc = {
        id: 'test-doc-10',
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '34109-9',
            display: 'Note'
          }]
        },
        subject: {
          reference: 'Patient/patient-123'
        },
        content: [{
          attachment: {
            contentType: 'application/json',
            data: btoa(JSON.stringify({
              subjective: 'Good subjective content',
              objective: 'Complete objective findings',
              assessment: 'Clear assessment',
              plan: 'Detailed plan'
            }))
          }
        }]
      };

      const extractedContent = converter.extractDocumentContent(validSOAPDoc);
      const validation = converter.validateDocumentContent(validSOAPDoc);

      expect(validation.overall.isValid).toBe(true);
      expect(validation.extraction.type).toBe('soap');
      expect(validation.extraction.hasContent).toBe(true);
      expect(validation.extraction.hasSections).toBe(true);
    });

    test('should identify validation issues', () => {
      const invalidDoc = {
        id: 'test-doc-11',
        // Missing status, type, subject
        content: [{
          attachment: {
            data: btoa('Some content')
            // Missing contentType
          }
        }]
      };

      const validation = converter.validateDocumentContent(invalidDoc);

      expect(validation.overall.isValid).toBe(false);
      expect(validation.overall.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle null document reference', () => {
      const result = converter.extractDocumentContent(null);

      expect(result.error).toContain('Invalid document reference provided');
    });

    test('should handle document without content array', () => {
      const docRef = {
        id: 'test-doc-12',
        status: 'current'
        // Missing content
      };

      const result = converter.extractDocumentContent(docRef);

      expect(result.error).toContain('No content data found');
    });

    test('should handle malformed JSON in SOAP content', () => {
      const docRef = {
        id: 'test-doc-13',
        content: [{
          attachment: {
            contentType: 'application/json',
            data: btoa('{"subjective": "incomplete json...')
          }
        }]
      };

      const result = converter.extractDocumentContent(docRef);

      // Should fallback to text processing
      expect(result.type).toBe('text');
      expect(result.content).toContain('incomplete json');
    });
  });

  describe('Development Logging', () => {
    test('should log debug information in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

      const docRef = {
        id: 'test-doc-14',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa('Test content')
          }
        }]
      };

      converter.extractDocumentContent(docRef);

      expect(consoleSpy).toHaveBeenCalledWith(
        'DocumentReferenceConverter: Processing document',
        expect.objectContaining({
          id: 'test-doc-14',
          hasContent: true,
          hasAttachment: true,
          hasData: true,
          contentType: 'text/plain'
        })
      );

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe('DocumentContentValidator', () => {
  describe('SOAP Validation', () => {
    test('should validate complete SOAP sections', () => {
      const sections = {
        subjective: 'Patient reports feeling better',
        objective: 'Vital signs stable, no acute distress',
        assessment: 'Improving condition',
        plan: 'Continue current treatment'
      };

      const result = DocumentContentValidator.validateSOAPSections(sections);

      expect(result.isValid).toBe(true);
      expect(result.completeSections).toHaveLength(4);
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about incomplete SOAP sections', () => {
      const sections = {
        subjective: 'Patient complaint',
        objective: '',
        assessment: '',
        plan: ''
      };

      const result = DocumentContentValidator.validateSOAPSections(sections);

      expect(result.isValid).toBe(true); // No errors, just warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.completeSections).toHaveLength(1);
    });

    test('should error on empty SOAP sections', () => {
      const sections = {};

      const result = DocumentContentValidator.validateSOAPSections(sections);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Medical History Validation', () => {
    test('should validate complete medical history', () => {
      const history = {
        chiefComplaint: 'Shortness of breath',
        historyOfPresentIllness: 'Started yesterday, worse with exertion',
        pastMedicalHistory: 'No significant past medical history'
      };

      const result = DocumentContentValidator.validateMedicalHistory(history);

      expect(result.isValid).toBe(true);
      expect(result.completeFields).toHaveLength(3);
    });

    test('should handle minimal medical history', () => {
      const history = {
        chiefComplaint: 'Pain'
      };

      const result = DocumentContentValidator.validateMedicalHistory(history);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0); // Warn about short chief complaint
    });
  });

  describe('Plain Text Validation', () => {
    test('should validate normal text content', () => {
      const content = 'Patient seen for routine follow-up visit. Doing well on current medications. No new complaints. Plan to continue current regimen and follow up in 3 months.';

      const result = DocumentContentValidator.validatePlainTextContent(content);

      expect(result.isValid).toBe(true);
      expect(result.wordCount).toBeGreaterThan(20);
      expect(result.characterCount).toBeGreaterThan(100);
    });

    test('should warn about short content', () => {
      const content = 'OK';

      const result = DocumentContentValidator.validatePlainTextContent(content);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should detect HTML in plain text', () => {
      const content = 'Patient doing <strong>well</strong> on medications.';

      const result = DocumentContentValidator.validatePlainTextContent(content);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('HTML'))).toBe(true);
    });
  });

  describe('Base64 Validation', () => {
    test('should validate correct base64', () => {
      const content = 'Hello, world!';
      const base64Content = btoa(content);

      const result = DocumentContentValidator.validateBase64Content(base64Content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid base64 characters', () => {
      const invalidBase64 = 'This is not base64!!!';

      const result = DocumentContentValidator.validateBase64Content(invalidBase64);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('characters'))).toBe(true);
    });

    test('should reject invalid base64 length', () => {
      const invalidLength = 'ABC'; // Not multiple of 4

      const result = DocumentContentValidator.validateBase64Content(invalidLength);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('length'))).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  test('should handle complete note creation workflow', () => {
    const converter = new DocumentReferenceConverter();
    
    // Start with form data from frontend
    const formData = {
      type: 'progress',
      contentType: 'text',
      content: 'Patient doing well. Continue current medications. Follow up in 6 months.',
      title: 'Routine Follow-up',
      description: 'Annual physical examination follow-up'
    };

    const context = {
      patientId: 'patient-456',
      authorId: 'practitioner-789'
    };

    // Convert to FHIR
    const fhirResource = converter._createResourceFromForm(formData, context);
    
    // Extract content back
    const extractedContent = converter.extractDocumentContent(fhirResource);
    
    // Validate
    const validation = converter.validateDocumentContent(fhirResource);

    expect(extractedContent.type).toBe('text');
    expect(extractedContent.content).toBe(formData.content);
    expect(validation.overall.isValid).toBe(true);
  });

  test('should handle SOAP note round-trip', () => {
    const converter = new DocumentReferenceConverter();
    
    const originalSoapData = {
      subjective: 'Patient reports improved energy levels',
      objective: 'Alert, cooperative, vital signs within normal limits',
      assessment: 'Depression improving on current medication regimen',
      plan: 'Continue sertraline 50mg daily, follow up in 4 weeks'
    };

    const formData = {
      type: 'soap',
      contentType: 'soap',
      soapSections: originalSoapData,
      title: 'Mental Health Follow-up'
    };

    const context = {
      patientId: 'patient-789'
    };

    // Convert to FHIR and back
    const fhirResource = converter._createResourceFromForm(formData, context);
    const parsedFormData = converter._parseResourceToForm(fhirResource);

    expect(parsedFormData.contentType).toBe('soap');
    expect(parsedFormData.soapSections.subjective).toBe(originalSoapData.subjective);
    expect(parsedFormData.soapSections.objective).toBe(originalSoapData.objective);
    expect(parsedFormData.soapSections.assessment).toBe(originalSoapData.assessment);
    expect(parsedFormData.soapSections.plan).toBe(originalSoapData.plan);
  });
});