/**
 * Tests for Query Studio Enhanced Component
 * 
 * Validates all major improvements:
 * - Distinct values API integration
 * - Smart parameter suggestions
 * - Live preview functionality
 * - Query comprehension features
 * - Result field selection
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import QueryStudioEnhanced from '../QueryStudioEnhanced';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { cdsClinicalDataService } from '../../../../services/cdsClinicalDataService';
import api from '../../../../services/api';

// Mock dependencies
vi.mock('../../../../core/fhir/services/fhirClient');
vi.mock('../../../../services/cdsClinicalDataService');
vi.mock('../../../../services/api', () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));


describe('QueryStudioEnhanced', () => {
  const theme = createTheme();
  
  const renderComponent = (props = {}) => {
    return render(
      <ThemeProvider theme={theme}>
        <QueryStudioEnhanced {...props} />
      </ThemeProvider>
    );
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock FHIR client search
    fhirClient.search.mockResolvedValue({
      total: 10,
      resources: [
        { resourceType: 'Patient', id: '1', name: [{ family: 'Smith' }] },
        { resourceType: 'Patient', id: '2', name: [{ family: 'Jones' }] }
      ]
    });
    
    // Mock catalog services
    cdsClinicalDataService.getLabCatalog.mockResolvedValue([
      { loinc_code: '1234-5', test_name: 'Test Lab', test_description: 'Description' }
    ]);
    
    cdsClinicalDataService.getDynamicMedicationCatalog.mockResolvedValue([
      { rxnorm_code: '12345', generic_name: 'Aspirin', brand_name: 'Bayer' }
    ]);
    
    cdsClinicalDataService.getDynamicConditionCatalog.mockResolvedValue([
      { snomed_code: '12345', display_name: 'Hypertension' }
    ]);
  });
  
  describe('Core Functionality', () => {
    test('renders with all major sections', () => {
      renderComponent();
      
      expect(screen.getByText('Query Studio')).toBeInTheDocument();
      expect(screen.getByText('Execute')).toBeInTheDocument();
      expect(screen.getByText('Resource Type')).toBeInTheDocument();
    });
    
    test('switches between visual and code modes', async () => {
      renderComponent();
      
      // Start in visual mode
      expect(screen.getByText('Resource Type')).toBeInTheDocument();
      
      // Switch to code mode
      const codeButton = screen.getByRole('button', { name: /code editor/i });
      fireEvent.click(codeButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      });
    });
    
    test('resource selection works correctly', async () => {
      renderComponent();
      
      // Open resource selector
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      
      // Select Patient resource
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      await waitFor(() => {
        expect(screen.getByText('Search Parameters')).toBeInTheDocument();
      });
    });
  });
  
  describe('Distinct Values Integration', () => {
    test('fetches distinct values when parameter is selected', async () => {
      // Mock distinct values API response
      api.get.mockResolvedValueOnce({
        data: {
          values: [
            { value: 'male', display: 'Male', usage_count: 100 },
            { value: 'female', display: 'Female', usage_count: 120 }
          ]
        }
      });
      
      renderComponent();
      
      // Select Patient resource
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      // Add parameter
      const addButton = await screen.findByText('Add Parameter');
      fireEvent.click(addButton);
      
      // Select gender parameter — a real MUI Autocomplete selection:
      // typing alone never fires onChange; the option must be picked.
      const parameterInputs = screen.getAllByLabelText('Parameter');
      const firstParamInput = parameterInputs[0];
      fireEvent.change(firstParamInput, { target: { value: 'gender' } });
      const genderOption = await screen.findByRole('option', { name: /^gender/ });
      fireEvent.click(genderOption);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/fhir/search-values/Patient/gender')
        );
      });
    });
    
    test('falls back to catalog when distinct values API fails', async () => {
      api.get.mockRejectedValueOnce(new Error('API Error'));
      
      renderComponent();
      
      // Select Observation resource
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const observationOption = await screen.findByText('Observation');
      fireEvent.click(observationOption);
      
      // Add parameter
      const addButton = await screen.findByText('Add Parameter');
      fireEvent.click(addButton);
      
      // Select code parameter (should trigger lab catalog fallback)
      const parameterInputs = screen.getAllByLabelText('Parameter');
      fireEvent.change(parameterInputs[0], { target: { value: 'code' } });
      const codeOption = await screen.findByRole('option', { name: /^code/ });
      fireEvent.click(codeOption);

      await waitFor(() => {
        expect(cdsClinicalDataService.getLabCatalog).toHaveBeenCalled();
      });
    });
  });
  
  describe('Smart Parameter Suggestions', () => {
    test('shows critical suggestions for required parameters', async () => {
      renderComponent();
      
      // Select Observation resource
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const observationOption = await screen.findByText('Observation');
      fireEvent.click(observationOption);
      
      // Should show patient as critical suggestion
      await waitFor(() => {
        expect(screen.getByText('Suggested Parameters')).toBeInTheDocument();
        const patientChip = screen.getByText('patient');
        // .closest('[class*="MuiChip"]') matched the label SPAN itself
        // (MuiChip-label) — the color class is on the chip root.
        expect(patientChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');
      });
    });
    
    test('adds suggested parameter when clicked', async () => {
      renderComponent();
      
      // Select Patient resource
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      // Click on suggested parameter
      await waitFor(() => {
        expect(screen.getByText('Suggested Parameters')).toBeInTheDocument();
      });
      
      const nameChip = screen.getByText('name');
      fireEvent.click(nameChip);
      
      // Should add the parameter
      await waitFor(() => {
        const parameterInputs = screen.getAllByLabelText('Parameter');
        expect(parameterInputs.length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('Live Preview', () => {
    test('shows live preview when enabled', async () => {
      renderComponent();

      // Select Observation, then add a parameter WITH a value in one step by
      // clicking the 'category' suggestion chip (it carries value
      // 'vital-signs'). Preview only fires once some param has key AND value.
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const observationOption = await screen.findByText('Observation');
      fireEvent.click(observationOption);

      const categoryChip = await screen.findByText('category');
      fireEvent.click(categoryChip);

      // Preview is debounced by QUERY_STUDIO_CONFIG.previewDelay (500ms), and
      // 'Estimated <strong>10</strong> results' is split across elements —
      // match on the container's full text.
      await waitFor(() => {
        expect(screen.getByText('Live Preview')).toBeInTheDocument();
        expect(screen.getByText((_, el) =>
          el?.tagName === 'P' && /Estimated\s*10\s*results/.test(el.textContent)
        )).toBeInTheDocument();
      });
    });
    
    test('can disable live preview in settings', async () => {
      renderComponent();
      
      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
      
      // Uncheck live preview
      const livePreviewCheckbox = screen.getByLabelText('Enable Live Preview');
      fireEvent.click(livePreviewCheckbox);
      
      // Select resource and add parameter
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      // Should not show live preview
      expect(screen.queryByText('Live Preview')).not.toBeInTheDocument();
    });
  });
  
  describe('Query Comprehension', () => {
    test('shows visual flow diagram', async () => {
      renderComponent();
      
      // Select Patient resource
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      // Should show flow diagram
      await waitFor(() => {
        expect(screen.getByText('Query Comprehension')).toBeInTheDocument();
        // Flow diagram shows resource chip
        const chips = screen.getAllByText('Patient');
        expect(chips.length).toBeGreaterThan(0);
      });
    });
    
    test('shows natural language description', async () => {
      renderComponent();
      
      // Select Patient resource
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      // Should show natural language
      await waitFor(() => {
        expect(screen.getByText(/Find all Patient resources/)).toBeInTheDocument();
      });
    });
  });
  
  describe('Query Optimization', () => {
    test('shows optimization suggestions for slow queries', async () => {
      renderComponent();
      
      // Mock slow query
      fhirClient.search.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          total: 1000,
          resources: []
        }), 1500))
      );
      
      // Select resource and execute
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      const executeButton = screen.getByText('Execute');
      fireEvent.click(executeButton);
      
      // Should show optimization suggestions
      await waitFor(() => {
        expect(screen.getByText(/Query Optimization Suggestions/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
  
  describe('Enhanced Results', () => {
    test('allows field selection in results', async () => {
      renderComponent();
      
      // Execute a query
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      const executeButton = screen.getByText('Execute');
      fireEvent.click(executeButton);
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/found/)).toBeInTheDocument();
      });
      
      // Open field selector
      const fieldButton = screen.getByText(/Select Fields/);
      fireEvent.click(fieldButton);
      
      // Should show field checkboxes
      expect(screen.getByLabelText('id')).toBeInTheDocument();
      expect(screen.getByLabelText('resourceType')).toBeInTheDocument();
    });
    
    test('can expand rows to see full JSON', async () => {
      renderComponent();
      
      // Execute a query
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      const executeButton = screen.getByText('Execute');
      fireEvent.click(executeButton);
      
      // Wait for results rows to render
      await waitFor(() => {
        expect(screen.getByText(/Smith/)).toBeInTheDocument();
      });
      
      // Expand first row (row expanders carry an accessible name now)
      const expandButtons = screen.getAllByRole('button', { name: /expand row/i });
      if (expandButtons.length > 0) {
        fireEvent.click(expandButtons[0]);
        
        // Should show JSON
        await waitFor(() => {
          expect(screen.getByText(/Full Resource JSON/)).toBeInTheDocument();
        });
      }
    });
  });
  
  describe('Collapsible Sections', () => {
    test('can collapse and expand sections', async () => {
      renderComponent();
      
      // Select resource to show all sections
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      // Sections start expanded, so the toggle's accessible name is
      // 'collapse section'. MUI Collapse keeps children MOUNTED when closed,
      // so assert visibility, not absence from the document.
      // .closest('[class*="MuiCard"]') stops at MuiCardHeader-content, which
      // does NOT contain the header's action button — anchor on the card root.
      const searchParamsSection = screen.getByText('Search Parameters').closest('.MuiCard-root');
      const collapseButton = within(searchParamsSection).getByRole('button', { name: /collapse section/i });

      fireEvent.click(collapseButton);

      await waitFor(() => {
        expect(screen.getByText('Add Parameter')).not.toBeVisible();
      });

      // ...and expanding brings it back
      fireEvent.click(within(searchParamsSection).getByRole('button', { name: /expand section/i }));
      await waitFor(() => {
        expect(screen.getByText('Add Parameter')).toBeVisible();
      });
      
      // Click again to expand
      fireEvent.click(collapseButton);
      
      // Content should be visible again
      await waitFor(() => {
        expect(screen.getByText('Add Parameter')).toBeInTheDocument();
      });
    });
    
    test('shows badge counts on collapsed sections', async () => {
      renderComponent();
      
      // Select resource
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      // Add a parameter — the section badge tracks the parameter count.
      // (Adding a second empty row is guarded, so drive one row only.)
      const addButton = await screen.findByText('Add Parameter');
      fireEvent.click(addButton);

      await waitFor(() => {
        const badges = [...document.querySelectorAll('.MuiBadge-badge')]
          .map(b => b.textContent);
        expect(badges).toContain('1');
      });
    });
  });
  
  describe('Query Execution', () => {
    test('executes query and displays results', async () => {
      renderComponent();
      
      // Build and execute query
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      const executeButton = screen.getByText('Execute');
      fireEvent.click(executeButton);
      
      // Should show results. Regex matchers: the family names render inside
      // composed cell text, so exact-string getByText never matches.
      await waitFor(() => {
        expect(screen.getByText(/Smith/)).toBeInTheDocument();
        expect(screen.getByText(/Jones/)).toBeInTheDocument();
      });
    });
    
    test('shows execution time', async () => {
      renderComponent();
      
      // Execute query
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      const executeButton = screen.getByText('Execute');
      fireEvent.click(executeButton);
      
      // Should show execution time
      await waitFor(() => {
        expect(screen.getByText(/\d+ms/)).toBeInTheDocument();
      });
    });
    
    test('handles query errors gracefully', async () => {
      fhirClient.search.mockRejectedValueOnce(new Error('Query failed'));
      
      renderComponent();
      
      // Execute query
      const resourceSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(resourceSelect);
      const patientOption = await screen.findByText('Patient');
      fireEvent.click(patientOption);
      
      const executeButton = screen.getByText('Execute');
      fireEvent.click(executeButton);
      
      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Query failed/)).toBeInTheDocument();
      });
    });
  });
});