/**
 * Test utilities and custom render function
 * Provides all necessary providers for testing components
 */

import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthProvider } from '../contexts/AuthContext';
import { FHIRResourceProvider } from '../contexts/FHIRResourceContext';
import { ClinicalWorkflowProvider } from '../contexts/ClinicalWorkflowContext';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ErrorBoundary from '../components/ErrorBoundary';

// Create a default theme for testing
const theme = createTheme();


// All providers wrapper
export const AppProviders = ({ children }) => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <AuthProvider>
              <FHIRResourceProvider>
                  <ClinicalWorkflowProvider>
                    {children}
                  </ClinicalWorkflowProvider>
              </FHIRResourceProvider>
            </AuthProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

// Custom render function that includes all providers
const customRender = (ui, options) =>
  render(ui, { wrapper: AppProviders, ...options });

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Mock data generators
export const generateMockPatient = (overrides = {}) => ({
  id: 'test-patient-123',
  resourceType: 'Patient',
  active: true,
  name: [{
    use: 'official',
    family: 'Test',
    given: ['Patient']
  }],
  gender: 'male',
  birthDate: '1980-01-01',
  identifier: [{
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
        code: 'MR',
        display: 'Medical Record Number'
      }]
    },
    value: 'MRN123456'
  }],
  ...overrides
});

export const generateMockEncounter = (patientId, overrides = {}) => ({
  id: 'test-encounter-123',
  resourceType: 'Encounter',
  status: 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory'
  },
  type: [{
    coding: [{
      system: 'http://snomed.info/sct',
      code: '308335008',
      display: 'Patient encounter procedure'
    }],
    text: 'Office Visit'
  }],
  subject: {
    reference: `Patient/${patientId}`
  },
  period: {
    start: new Date().toISOString()
  },
  ...overrides
});

export const generateMockObservation = (patientId, overrides = {}) => ({
  id: 'test-observation-123',
  resourceType: 'Observation',
  status: 'final',
  code: {
    coding: [{
      system: 'http://loinc.org',
      code: '2951-2',
      display: 'Sodium [Moles/volume] in Serum or Plasma'
    }],
    text: 'Sodium'
  },
  subject: {
    reference: `Patient/${patientId}`
  },
  effectiveDateTime: new Date().toISOString(),
  valueQuantity: {
    value: 140,
    unit: 'mmol/L',
    system: 'http://unitsofmeasure.org',
    code: 'mmol/L'
  },
  referenceRange: [{
    low: {
      value: 136,
      unit: 'mmol/L'
    },
    high: {
      value: 145,
      unit: 'mmol/L'
    }
  }],
  ...overrides
});

export const generateMockMedicationRequest = (patientId, overrides = {}) => ({
  id: 'test-medication-request-123',
  resourceType: 'MedicationRequest',
  status: 'active',
  intent: 'order',
  medicationCodeableConcept: {
    coding: [{
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: '314076',
      display: 'lisinopril 10 MG Oral Tablet'
    }],
    text: 'Lisinopril 10mg'
  },
  subject: {
    reference: `Patient/${patientId}`
  },
  authoredOn: new Date().toISOString(),
  dosageInstruction: [{
    text: 'Take 1 tablet by mouth daily',
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        periodUnit: 'd'
      }
    }
  }],
  dispenseRequest: {
    quantity: {
      value: 30,
      unit: 'tablet'
    },
    numberOfRepeatsAllowed: 3
  },
  ...overrides
});

// Mock fetch for FHIR operations
export const mockFetch = (responseData, status = 200) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(responseData),
      headers: {
        get: (header) => {
          if (header === 'content-type') return 'application/fhir+json';
          return null;
        }
      }
    })
  );
};