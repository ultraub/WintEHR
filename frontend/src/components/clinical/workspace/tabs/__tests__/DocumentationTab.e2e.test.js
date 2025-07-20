/**
 * End-to-end tests for Documentation Tab workflows
 * Tests the complete user journey from template selection to note signing
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import DocumentationTab from '../DocumentationTab';
import { FHIRResourceProvider } from '../../../../../contexts/FHIRResourceContext';
import { ClinicalWorkflowProvider } from '../../../../../contexts/ClinicalWorkflowContext';

// Mock dependencies
jest.mock('../../../../../services/fhirClient', () => ({
  fhirClient: {
    search: jest.fn(),
    read: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}));

jest.mock('../../../../../utils/printUtils', () => ({
  printDocument: jest.fn(),
  formatClinicalNoteForPrint: jest.fn(() => ({
    title: 'Test Note',
    content: 'Test content',
    patient: { name: 'Test Patient' }
  })),
  exportClinicalNote: jest.fn(() => Promise.resolve(new Blob(['test'], { type: 'text/plain' })))
}));

const theme = createTheme();

const mockPatient = {
  id: 'patient-123',
  name: 'John Doe',
  birthDate: '1980-01-01',
  gender: 'male'
};

const mockDocuments = [
  {
    id: 'doc-1',
    type: { coding: [{ code: '11506-3', display: 'Progress note' }] },
    status: 'current',
    docStatus: 'preliminary',
    date: '2024-01-15T10:30:00Z',
    author: [{ display: 'Dr. Smith' }],
    content: [{
      attachment: {
        contentType: 'text/plain',
        data: btoa('Patient doing well. Continue current medications.'),
        title: 'Progress Note'
      }
    }],
    subject: { reference: 'Patient/patient-123' }
  },
  {
    id: 'doc-2',
    type: { coding: [{ code: '34109-9', display: 'Note' }] },
    status: 'current',
    docStatus: 'final',
    date: '2024-01-10T14:15:00Z',
    author: [{ display: 'Dr. Johnson' }],
    content: [{
      attachment: {
        contentType: 'application/json',
        data: btoa(JSON.stringify({
          subjective: 'Patient reports feeling better',
          objective: 'Vital signs stable',
          assessment: 'Improving condition',
          plan: 'Continue treatment'
        })),
        title: 'SOAP Note'
      }
    }],
    subject: { reference: 'Patient/patient-123' }
  }
];

const TestWrapper = ({ children }) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>
      <FHIRResourceProvider>
        <ClinicalWorkflowProvider>
          {children}
        </ClinicalWorkflowProvider>
      </FHIRResourceProvider>
    </ThemeProvider>
  </MemoryRouter>
);

describe('Documentation Tab E2E Tests', () => {
  let mockFhirClient;

  beforeEach(() => {
    mockFhirClient = require('../../../../../services/fhirClient').fhirClient;
    mockFhirClient.search.mockResolvedValue({
      resources: mockDocuments,
      total: mockDocuments.length
    });
    mockFhirClient.create.mockResolvedValue({ id: 'new-doc-123' });
    mockFhirClient.update.mockResolvedValue({ id: 'doc-1' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should load and display existing documents', async () => {
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    // Check document metadata
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Dr. Johnson')).toBeInTheDocument();
    
    // Check status indicators
    expect(screen.getByText('Draft')).toBeInTheDocument(); // preliminary status
    expect(screen.getByText('Signed')).toBeInTheDocument(); // final status
  });

  test('should create new progress note via template wizard', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Click New Note button
    const newNoteButton = screen.getByRole('button', { name: /new note/i });
    await user.click(newNoteButton);

    // Template wizard should open
    await waitFor(() => {
      expect(screen.getByText('Note Template Wizard')).toBeInTheDocument();
    });

    // Select visit type
    const routineFollowUp = screen.getByText('Routine Follow-up');
    await user.click(routineFollowUp);

    // Go to next step
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Add clinical context
    const chiefComplaintField = screen.getByLabelText(/chief complaint/i);
    await user.type(chiefComplaintField, 'Routine check-up');

    await user.click(nextButton);

    // Select recommended template
    const useTemplateButton = screen.getByRole('button', { name: /use template/i });
    await user.click(useTemplateButton);

    // Enhanced Note Editor should open
    await waitFor(() => {
      expect(screen.getByText('New Clinical Note')).toBeInTheDocument();
    });

    // Template should be pre-selected with data
    expect(screen.getByDisplayValue('Routine check-up')).toBeInTheDocument();
  });

  test('should create and save SOAP note', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Click SOAP Note quick button
    const soapButton = screen.getByRole('button', { name: /soap note/i });
    await user.click(soapButton);

    // Enhanced Note Editor should open
    await waitFor(() => {
      expect(screen.getByText('New Clinical Note')).toBeInTheDocument();
    });

    // Fill in SOAP sections
    const subjectiveField = screen.getByLabelText(/subjective/i);
    await user.type(subjectiveField, 'Patient reports mild headache for 2 days');

    const objectiveField = screen.getByLabelText(/objective/i);
    await user.type(objectiveField, 'Alert, oriented, BP 125/82, no neurological deficits');

    const assessmentField = screen.getByLabelText(/assessment/i);
    await user.type(assessmentField, 'Tension headache, likely stress-related');

    const planField = screen.getByLabelText(/plan/i);
    await user.type(planField, 'Ibuprofen 400mg TID PRN, stress management counseling');

    // Save as draft
    const saveDraftButton = screen.getByRole('button', { name: /save as draft/i });
    await user.click(saveDraftButton);

    // Verify API call
    await waitFor(() => {
      expect(mockFhirClient.create).toHaveBeenCalledWith(
        'DocumentReference',
        expect.objectContaining({
          resourceType: 'DocumentReference',
          docStatus: 'draft',
          content: expect.arrayContaining([
            expect.objectContaining({
              attachment: expect.objectContaining({
                contentType: 'application/json'
              })
            })
          ])
        })
      );
    });
  });

  test('should edit existing note', async () => {
    const user = userEvent.setup();
    
    // Mock reading the specific document
    mockFhirClient.read.mockResolvedValue(mockDocuments[0]);

    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
    });

    // Find and click edit button for first document
    const progressNoteCard = screen.getByText('Progress Note').closest('[data-testid="note-card"]') || 
                            screen.getByText('Progress Note').closest('.MuiCard-root');
    
    const editButton = within(progressNoteCard).getByRole('button', { name: /edit/i });
    await user.click(editButton);

    // Enhanced Note Editor should open with existing content
    await waitFor(() => {
      expect(screen.getByText('Edit Clinical Note')).toBeInTheDocument();
    });

    // Should have existing content loaded
    expect(screen.getByDisplayValue(/patient doing well/i)).toBeInTheDocument();

    // Modify content
    const contentField = screen.getByDisplayValue(/patient doing well/i);
    await user.clear(contentField);
    await user.type(contentField, 'Patient continues to do well. No new complaints. Plan to continue current regimen.');

    // Save changes
    const saveButton = screen.getByRole('button', { name: /save for review/i });
    await user.click(saveButton);

    // Verify update API call
    await waitFor(() => {
      expect(mockFhirClient.update).toHaveBeenCalledWith(
        'DocumentReference',
        'doc-1',
        expect.objectContaining({
          resourceType: 'DocumentReference'
        })
      );
    });
  });

  test('should sign a draft note', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
    });

    // Find the draft note (doc-1 has preliminary status)
    const draftNote = screen.getByText('Draft').closest('[data-testid="note-card"]') || 
                     screen.getByText('Draft').closest('.MuiCard-root');
    
    const signButton = within(draftNote).getByRole('button', { name: /sign/i });
    await user.click(signButton);

    // Verify sign API call
    await waitFor(() => {
      expect(mockFhirClient.update).toHaveBeenCalledWith(
        'DocumentReference',
        'doc-1',
        expect.objectContaining({
          docStatus: 'final'
        })
      );
    });
  });

  test('should filter documents by type', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    // Open filter dropdown
    const filterButton = screen.getByRole('button', { name: /filter/i });
    await user.click(filterButton);

    // Select Progress Notes only
    const progressFilter = screen.getByText('Progress Notes');
    await user.click(progressFilter);

    // Should only show progress note
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.queryByText('SOAP Note')).not.toBeInTheDocument();
    });
  });

  test('should search documents', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    // Search for specific content
    const searchField = screen.getByPlaceholderText(/search documentation/i);
    await user.type(searchField, 'progress');

    // Should filter to show only progress note
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.queryByText('SOAP Note')).not.toBeInTheDocument();
    });
  });

  test('should print a document', async () => {
    const user = userEvent.setup();
    const mockPrintDocument = require('../../../../../utils/printUtils').printDocument;
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
    });

    // Find and click print button
    const progressNoteCard = screen.getByText('Progress Note').closest('[data-testid="note-card"]') || 
                            screen.getByText('Progress Note').closest('.MuiCard-root');
    
    const printButton = within(progressNoteCard).getByRole('button', { name: /print/i });
    await user.click(printButton);

    // Verify print function was called
    expect(mockPrintDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Progress Note'),
        patient: expect.objectContaining({
          name: 'John Doe'
        })
      })
    );
  });

  test('should export a document', async () => {
    const user = userEvent.setup();
    const mockExportClinicalNote = require('../../../../../utils/printUtils').exportClinicalNote;
    
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
    });

    // Find note card and access menu
    const progressNoteCard = screen.getByText('Progress Note').closest('[data-testid="note-card"]') || 
                            screen.getByText('Progress Note').closest('.MuiCard-root');
    
    const menuButton = within(progressNoteCard).getByRole('button', { name: /more/i });
    await user.click(menuButton);

    // Click export option
    const exportButton = screen.getByText(/export/i);
    await user.click(exportButton);

    // Verify export function was called
    await waitFor(() => {
      expect(mockExportClinicalNote).toHaveBeenCalled();
    });
  });

  test('should handle template wizard auto-population', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Click New Note button
    const newNoteButton = screen.getByRole('button', { name: /new note/i });
    await user.click(newNoteButton);

    // Template wizard should open
    await waitFor(() => {
      expect(screen.getByText('Note Template Wizard')).toBeInTheDocument();
    });

    // Select acute visit type
    const acuteVisit = screen.getByText('Acute Illness');
    await user.click(acuteVisit);

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Add chief complaint
    const chiefComplaintField = screen.getByLabelText(/chief complaint/i);
    await user.type(chiefComplaintField, 'Chest pain');

    await user.click(nextButton);

    // SOAP template should be recommended
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('SOAP format ideal for acute presentations')).toBeInTheDocument();

    // Enable auto-population
    const autoPopulateSwitch = screen.getByLabelText(/auto-populate/i);
    await user.click(autoPopulateSwitch);

    const useTemplateButton = screen.getByRole('button', { name: /use template/i });
    await user.click(useTemplateButton);

    // Enhanced Note Editor should open with pre-filled data
    await waitFor(() => {
      expect(screen.getByText('New Clinical Note')).toBeInTheDocument();
    });

    // Should have chief complaint pre-filled
    expect(screen.getByDisplayValue('Chest pain')).toBeInTheDocument();
  });

  test('should handle error states gracefully', async () => {
    // Mock API error
    mockFhirClient.search.mockRejectedValue(new Error('Network error'));
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Should show error state
    await waitFor(() => {
      expect(screen.getByText(/error loading documents/i)).toBeInTheDocument();
    });
  });

  test('should validate content before saving', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Click SOAP Note button
    const soapButton = screen.getByRole('button', { name: /soap note/i });
    await user.click(soapButton);

    // Enhanced Note Editor should open
    await waitFor(() => {
      expect(screen.getByText('New Clinical Note')).toBeInTheDocument();
    });

    // Try to save without filling required sections
    const saveDraftButton = screen.getByRole('button', { name: /save as draft/i });
    await user.click(saveDraftButton);

    // Should still save (validation warnings, not errors)
    await waitFor(() => {
      expect(mockFhirClient.create).toHaveBeenCalled();
    });
  });
});

describe('Content Format Specific Tests', () => {
  test('should handle legacy text format notes', async () => {
    const legacyNote = {
      id: 'legacy-doc-1',
      type: { coding: [{ code: '11506-3', display: 'Progress note' }] },
      status: 'current',
      docStatus: 'final',
      date: '2024-01-01T10:00:00Z',
      text: {
        div: '<div>Legacy text content stored in text.div field</div>'
      },
      subject: { reference: 'Patient/patient-123' }
    };

    const mockFhirClient = require('../../../../../services/fhirClient').fhirClient;
    mockFhirClient.search.mockResolvedValue({
      resources: [legacyNote],
      total: 1
    });

    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Should load and display legacy note
    await waitFor(() => {
      expect(screen.getByText('Progress note')).toBeInTheDocument();
    });

    // Content should be accessible
    const noteCard = screen.getByText('Progress note').closest('.MuiCard-root');
    expect(noteCard).toBeInTheDocument();
  });

  test('should handle malformed base64 content', async () => {
    const malformedNote = {
      id: 'malformed-doc-1',
      type: { coding: [{ code: '11506-3', display: 'Progress note' }] },
      status: 'current',
      date: '2024-01-01T10:00:00Z',
      content: [{
        attachment: {
          contentType: 'text/plain',
          data: 'invalid-base64-data!!!'
        }
      }],
      subject: { reference: 'Patient/patient-123' }
    };

    const mockFhirClient = require('../../../../../services/fhirClient').fhirClient;
    mockFhirClient.search.mockResolvedValue({
      resources: [malformedNote],
      total: 1
    });

    render(
      <TestWrapper>
        <DocumentationTab patientId="patient-123" patient={mockPatient} />
      </TestWrapper>
    );

    // Should still display the note (graceful handling)
    await waitFor(() => {
      expect(screen.getByText('Progress note')).toBeInTheDocument();
    });
  });
});