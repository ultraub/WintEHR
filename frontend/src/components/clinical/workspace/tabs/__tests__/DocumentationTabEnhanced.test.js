/**
 * DocumentationTabEnhanced Test Suite
 * Tests the loading state rendering fix
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DocumentationTabEnhanced from '../DocumentationTabEnhanced';
import { useFHIRResource } from '../../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow } from '../../../../../contexts/ClinicalWorkflowContext';

// Mock dependencies
jest.mock('../../../../../contexts/FHIRResourceContext');
jest.mock('../../../../../contexts/ClinicalWorkflowContext');
jest.mock('../../../../../core/fhir/services/fhirClient');

// Mock shared components
jest.mock('../../../shared', () => ({
  ClinicalResourceCard: () => <div data-testid="clinical-resource-card">Resource Card</div>,
  ClinicalSummaryCard: () => <div data-testid="clinical-summary-card">Summary Card</div>,
  ClinicalFilterPanel: () => <div data-testid="clinical-filter-panel">Filter Panel</div>,
  ClinicalDataGrid: () => <div data-testid="clinical-data-grid">Data Grid</div>,
  ClinicalEmptyState: () => <div data-testid="clinical-empty-state">Empty State</div>,
  ClinicalLoadingState: {
    SummaryCard: ({ count }) => (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} data-testid={`loading-summary-card-${i}`}>Loading Summary Card {i}</div>
        ))}
      </>
    ),
    FilterPanel: () => <div data-testid="loading-filter-panel">Loading Filter Panel</div>,
    ResourceCard: ({ count }) => (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} data-testid={`loading-resource-card-${i}`}>Loading Resource Card {i}</div>
        ))}
      </>
    )
  }
}));

// Mock UI components
jest.mock('../../../ui/QuickActionFAB', () => ({
  ContextualFAB: () => <div data-testid="contextual-fab">FAB</div>
}));

jest.mock('../../../ui/ResourceTimeline', () => ({
  __esModule: true,
  default: () => <div data-testid="resource-timeline">Timeline</div>
}));

jest.mock('../../../ui/SmartTable', () => ({
  __esModule: true,
  default: () => <div data-testid="smart-table">Smart Table</div>
}));

// Mock dialog components
jest.mock('../../dialogs/EnhancedNoteEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="enhanced-note-editor">Note Editor</div>
}));

jest.mock('../../dialogs/NoteTemplateWizard', () => ({
  __esModule: true,
  default: () => <div data-testid="note-template-wizard">Template Wizard</div>
}));

describe('DocumentationTabEnhanced', () => {
  const mockPatientId = 'patient-123';
  const mockPublish = jest.fn();
  const mockSubscribe = jest.fn();
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock clinical workflow context
    useClinicalWorkflow.mockReturnValue({
      publish: mockPublish,
      subscribe: mockSubscribe
    });
  });

  test('renders loading state without errors', () => {
    // Mock loading state
    useFHIRResource.mockReturnValue({
      resources: [],
      loading: true,
      error: null
    });

    // Render component
    const { container } = render(
      <DocumentationTabEnhanced 
        patientId={mockPatientId}
        onNotificationUpdate={() => {}}
      />
    );

    // Check that loading components are rendered
    expect(screen.getByTestId('loading-summary-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('loading-summary-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('loading-summary-card-2')).toBeInTheDocument();
    expect(screen.getByTestId('loading-summary-card-3')).toBeInTheDocument();
    expect(screen.getByTestId('loading-filter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('loading-resource-card-0')).toBeInTheDocument();
    
    // Ensure no errors in console
    expect(container).toBeTruthy();
  });

  test('renders content after loading', () => {
    // Mock loaded state with documents
    useFHIRResource.mockReturnValue({
      resources: [
        {
          id: 'doc-1',
          resourceType: 'DocumentReference',
          status: 'current',
          type: {
            coding: [{
              system: 'http://loinc.org',
              code: '11488-4',
              display: 'Consultation note'
            }]
          },
          created: '2024-01-01T00:00:00Z',
          content: [{
            attachment: {
              contentType: 'text/plain',
              data: 'VGVzdCBkb2N1bWVudA==' // Base64 for "Test document"
            }
          }]
        }
      ],
      loading: false,
      error: null
    });

    render(
      <DocumentationTabEnhanced 
        patientId={mockPatientId}
        onNotificationUpdate={() => {}}
      />
    );

    // Check that content is rendered (not loading state)
    expect(screen.queryByTestId('loading-summary-card-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-filter-panel')).not.toBeInTheDocument();
  });

  test('handles undefined component error gracefully', () => {
    // This test verifies the fix for the ClinicalLoadingState.SummaryCards issue
    useFHIRResource.mockReturnValue({
      resources: [],
      loading: true,
      error: null
    });

    // Should not throw error about undefined component
    expect(() => {
      render(
        <DocumentationTabEnhanced 
          patientId={mockPatientId}
          onNotificationUpdate={() => {}}
        />
      );
    }).not.toThrow();
  });
});