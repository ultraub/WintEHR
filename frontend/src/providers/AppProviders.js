import React, { memo } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { FHIRResourceProvider } from '../contexts/FHIRResourceContext';
import { WorkflowProvider } from '../contexts/WorkflowContext';
import { ClinicalProvider } from '../contexts/ClinicalContext';
import { DocumentationProvider } from '../contexts/DocumentationContext';
import { OrderProvider } from '../contexts/OrderContext';
import { TaskProvider } from '../contexts/TaskContext';
import { InboxProvider } from '../contexts/InboxContext';
import { AppointmentProvider } from '../contexts/AppointmentContext';
import { ClinicalWorkflowProvider } from '../contexts/ClinicalWorkflowContext';
import { CDSProvider } from '../contexts/CDSContext';
import { ProviderDirectoryProvider } from '../contexts/ProviderDirectoryContext';
import { createCompoundProvider } from '../utils/providerOptimization';

// Create compound providers to reduce nesting depth
// Group related providers together to minimize re-render cascades

// Core data providers (rarely change together)
const CoreDataProvider = createCompoundProvider([
  AuthProvider,
  FHIRResourceProvider,
  ProviderDirectoryProvider,
  CDSProvider
]);

// Clinical domain providers (often update together)
const ClinicalDomainProvider = createCompoundProvider([
  ClinicalProvider,
  DocumentationProvider,
  OrderProvider,
  TaskProvider
]);

// Communication providers (notifications, appointments)
const CommunicationProvider = createCompoundProvider([
  InboxProvider,
  AppointmentProvider
]);

/**
 * AppProviders - Optimized provider composition
 * 
 * Reduced from 12 nested levels to 4 compound groups:
 * 1. CoreDataProvider - Auth, FHIR, Directory, CDS
 * 2. WorkflowProvider - Standalone workflow state
 * 3. ClinicalDomainProvider - Clinical, Documentation, Order, Task
 * 4. CommunicationProvider - Inbox, Appointment
 * 5. ClinicalWorkflowProvider - Top-level orchestration
 * 
 * This reduces re-render cascades by grouping providers that typically
 * update together, while keeping independent providers separate.
 */
export const AppProviders = memo(({ children }) => {
  return (
    <CoreDataProvider>
      <WorkflowProvider>
        <ClinicalDomainProvider>
          <CommunicationProvider>
            <ClinicalWorkflowProvider>
              {children}
            </ClinicalWorkflowProvider>
          </CommunicationProvider>
        </ClinicalDomainProvider>
      </WorkflowProvider>
    </CoreDataProvider>
  );
});

// Add display names for better debugging
AppProviders.displayName = 'AppProviders';
CoreDataProvider.displayName = 'CoreDataProvider';
ClinicalDomainProvider.displayName = 'ClinicalDomainProvider';
CommunicationProvider.displayName = 'CommunicationProvider';

/**
 * CoreProviders - Only the essential providers needed for basic functionality
 * Use this for components that don't need all clinical features
 */
export const CoreProviders = memo(({ children }) => {
  return (
    <CoreDataProvider>
      <WorkflowProvider>
        {children}
      </WorkflowProvider>
    </CoreDataProvider>
  );
});

CoreProviders.displayName = 'CoreProviders';

/**
 * ClinicalProviders - Providers needed for clinical workflows
 * Use this for clinical components that need domain-specific contexts
 * Now uses the optimized compound providers
 */
export const ClinicalProviders = memo(({ children }) => {
  return (
    <ClinicalDomainProvider>
      <CommunicationProvider>
        <ClinicalWorkflowProvider>
          {children}
        </ClinicalWorkflowProvider>
      </CommunicationProvider>
    </ClinicalDomainProvider>
  );
});

ClinicalProviders.displayName = 'ClinicalProviders';