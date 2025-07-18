import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { WebSocketProvider } from '../contexts/WebSocketContext';
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

/**
 * AppProviders - Combines all application context providers
 * This reduces the provider pyramid and makes it easier to manage
 * 
 * Provider order matters:
 * 1. AuthProvider - Must be first as other providers may need auth
 * 2. WebSocketProvider - Needs auth for connection
 * 3. FHIRResourceProvider - Core data provider
 * 4. ProviderDirectoryProvider - Manages provider directory data centrally
 * 5. CDSProvider - Clinical Decision Support, needs FHIR data
 * 6. WorkflowProvider - General workflow state
 * 7. Domain-specific providers (Clinical, Documentation, etc.)
 * 8. ClinicalWorkflowProvider - Depends on other clinical contexts
 */
export const AppProviders = ({ children }) => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <FHIRResourceProvider>
          <ProviderDirectoryProvider>
            <CDSProvider>
              <WorkflowProvider>
                <ClinicalProvider>
                  <DocumentationProvider>
                    <OrderProvider>
                      <TaskProvider>
                        <InboxProvider>
                          <AppointmentProvider>
                            <ClinicalWorkflowProvider>
                              {children}
                            </ClinicalWorkflowProvider>
                          </AppointmentProvider>
                        </InboxProvider>
                      </TaskProvider>
                    </OrderProvider>
                  </DocumentationProvider>
                </ClinicalProvider>
              </WorkflowProvider>
            </CDSProvider>
          </ProviderDirectoryProvider>
        </FHIRResourceProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
};

/**
 * CoreProviders - Only the essential providers needed for basic functionality
 * Use this for components that don't need all clinical features
 */
export const CoreProviders = ({ children }) => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <FHIRResourceProvider>
          <WorkflowProvider>
            {children}
          </WorkflowProvider>
        </FHIRResourceProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
};

/**
 * ClinicalProviders - Providers needed for clinical workflows
 * Use this for clinical components that need domain-specific contexts
 */
export const ClinicalProviders = ({ children }) => {
  return (
    <ClinicalProvider>
      <DocumentationProvider>
        <OrderProvider>
          <TaskProvider>
            <InboxProvider>
              <AppointmentProvider>
                <ClinicalWorkflowProvider>
                  {children}
                </ClinicalWorkflowProvider>
              </AppointmentProvider>
            </InboxProvider>
          </TaskProvider>
        </OrderProvider>
      </DocumentationProvider>
    </ClinicalProvider>
  );
};