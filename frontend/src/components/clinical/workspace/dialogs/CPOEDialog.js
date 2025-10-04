/**
 * CPOE (Computerized Physician Order Entry) Dialog - Migrated to BaseResourceDialog
 * Modern order entry system using the new BaseResourceDialog pattern
 */
import React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import BaseResourceDialog from '../../../base/BaseResourceDialog';
import ServiceRequestFormFields from './components/ServiceRequestFormFields';
import {
  initialValues,
  validationRules,
  parseServiceRequestResource,
  createServiceRequestResource,
  updateServiceRequestResource,
  ORDER_CATEGORIES
} from './config/serviceRequestDialogConfig';
import { useAuth } from '../../../../contexts/AuthContext';

const CPOEDialog = ({ 
  open, 
  onClose, 
  onSave, 
  serviceRequest = null, 
  patientId, 
  mode = 'add',
  patientConditions = [],
  recentOrders = []
}) => {
  const { user } = useAuth();
  
  // Parse existing resource for edit mode
  const parsedInitialValues = serviceRequest && mode === 'edit' 
    ? parseServiceRequestResource(serviceRequest)
    : initialValues;

  // Custom validation function
  const handleValidate = (formData) => {
    const errors = {};
    
    // Check test/procedure requirement
    if (!formData.selectedTest && !formData.customTest) {
      errors.selectedTest = 'Please specify a test/procedure or select from the list';
    }
    
    // Check indication requirement
    if (!formData.indication || formData.indication.trim() === '') {
      errors.indication = 'Clinical indication is required';
    } else if (formData.indication.length < 5) {
      errors.indication = 'Please provide a more detailed clinical indication';
    }
    
    // Check provider PIN for active orders
    if (formData.status === 'active') {
      if (!formData.providerPin || formData.providerPin.trim() === '') {
        errors.providerPin = 'Provider PIN is required to authorize active orders';
      } else if (formData.providerPin.length < 4) {
        errors.providerPin = 'Provider PIN must be at least 4 characters';
      }
    }
    
    // Check scheduled date logic
    if (formData.scheduledDate && formData.scheduledDate <= new Date()) {
      errors.scheduledDate = 'Scheduled date must be in the future';
    }
    
    // Check custom test format
    if (formData.customTest && formData.customTest.length < 3) {
      errors.customTest = 'Custom test description must be at least 3 characters';
    }
    
    return errors;
  };

  // Handle save operation
  const handleSave = async (formData, currentMode) => {
    try {
      let savedResource;
      
      if (currentMode === 'edit' && serviceRequest) {
        // Update existing ServiceRequest
        savedResource = updateServiceRequestResource(
          formData, 
          serviceRequest, 
          user?.id || user?.username || `Practitioner/${Date.now()}`,
          user?.display_name || user?.name || 'Unknown Provider'
        );
      } else {
        // Create new ServiceRequest
        savedResource = createServiceRequestResource(
          formData, 
          patientId,
          user?.id || user?.username || `Practitioner/${Date.now()}`,
          user?.display_name || user?.name || 'Unknown Provider'
        );
      }
      
      // Call the parent save callback
      await onSave(savedResource, currentMode);
    } catch (error) {
      throw new Error(error.message || 'Failed to save service request');
    }
  };

  // Dialog title based on mode
  const getDialogTitle = () => {
    if (mode === 'edit') {
      return 'Edit Service Request';
    }
    return 'New Service Request / Order';
  };

  // Preview content for the stepper
  const renderPreview = (formData) => {
    const categoryData = ORDER_CATEGORIES.find(c => c.value === formData.category);
    const testDisplay = formData.selectedTest?.display || formData.customTest || 'No test selected';
    
    return (
      <div>
        <h4>Order Summary</h4>
        <p><strong>Category:</strong> {categoryData?.display || formData.category}</p>
        <p><strong>Test/Procedure:</strong> {testDisplay}</p>
        <p><strong>Priority:</strong> {formData.priority}</p>
        <p><strong>Status:</strong> {formData.status}</p>
        <p><strong>Indication:</strong> {formData.indication}</p>
        {formData.scheduledDate && (
          <p><strong>Scheduled:</strong> {formData.scheduledDate.toLocaleDateString()}</p>
        )}
        {formData.notes && (
          <p><strong>Notes:</strong> {formData.notes}</p>
        )}
      </div>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <BaseResourceDialog
        // Dialog props
        open={open}
        onClose={onClose}
        title={getDialogTitle()}
        maxWidth="lg"
        fullWidth
        
        // Resource props
        resourceType="ServiceRequest"
        resource={serviceRequest}
        mode={mode}
        
        // Form configuration
        initialValues={parsedInitialValues}
        validationRules={validationRules}
        
        // Callbacks
        onSave={handleSave}
        onValidate={handleValidate}
        
        // UI customization
        showPreview={true}
        showCancel={true}
        renderPreview={renderPreview}
        
        // Form steps configuration
        steps={[
          { 
            label: 'Order Details', 
            description: 'Select test/procedure and basic order information' 
          },
          { 
            label: 'Clinical Context', 
            description: 'Provide clinical indication and special requirements' 
          },
          { 
            label: 'Review & Submit', 
            description: 'Review order details and authorize if needed' 
          }
        ]}
      >
        <ServiceRequestFormFields 
          patientConditions={patientConditions}
          recentOrders={recentOrders}
        />
      </BaseResourceDialog>
    </LocalizationProvider>
  );
};

export default CPOEDialog;