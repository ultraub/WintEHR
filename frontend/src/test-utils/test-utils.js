import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createMedicalTheme } from '../themes/medicalTheme';
import { AppProviders } from '../providers/AppProviders';
import ErrorBoundary from '../components/ErrorBoundary';

// Create a custom render function that includes all providers
const AllTheProviders = ({ children }) => {
  const theme = createMedicalTheme('professional', 'light');
  
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <AppProviders>
            <BrowserRouter>
              {children}
            </BrowserRouter>
          </AppProviders>
        </LocalizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Mock data generators
export const generateMockPatient = (overrides = {}) => ({
  resourceType: 'Patient',
  id: 'test-patient-1',
  name: [{
    use: 'official',
    family: 'Smith',
    given: ['John']
  }],
  gender: 'male',
  birthDate: '1980-01-01',
  address: [{
    use: 'home',
    line: ['123 Main St'],
    city: 'Boston',
    state: 'MA',
    postalCode: '02101'
  }],
  ...overrides
});

export const generateMockCondition = (patientId = 'test-patient-1', overrides = {}) => ({
  resourceType: 'Condition',
  id: `condition-${Math.random().toString(36).substr(2, 9)}`,
  subject: {
    reference: `Patient/${patientId}`
  },
  code: {
    coding: [{
      system: 'http://snomed.info/sct',
      code: '38341003',
      display: 'Hypertension'
    }],
    text: 'Hypertension'
  },
  clinicalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
      code: 'active'
    }]
  },
  ...overrides
});

export const generateMockMedicationRequest = (patientId = 'test-patient-1', overrides = {}) => ({
  resourceType: 'MedicationRequest',
  id: `med-${Math.random().toString(36).substr(2, 9)}`,
  status: 'active',
  intent: 'order',
  subject: {
    reference: `Patient/${patientId}`
  },
  medicationCodeableConcept: {
    coding: [{
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: '316672',
      display: 'Simvastatin 20 MG Oral Tablet'
    }],
    text: 'Simvastatin 20mg'
  },
  ...overrides
});

// Wait utilities
export const waitForLoadingToFinish = () => 
  screen.findByText((content, element) => {
    return !element?.className?.includes('loading');
  });