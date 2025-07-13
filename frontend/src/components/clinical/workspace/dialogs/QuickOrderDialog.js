/**
 * Quick Order Dialog - Migrated to BaseResourceDialog
 * Simplified order entry for common order types
 */
import React, { useState } from 'react';
import { 
  TextField, 
  Grid, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  Stack,
  Typography,
  Alert
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import BaseResourceDialog from '../../../base/BaseResourceDialog';
import {
  createServiceRequestResource,
  createMedicationRequestResource,
  SERVICE_REQUEST_PRIORITY_OPTIONS,
  ORDER_CATEGORIES
} from './config/serviceRequestDialogConfig';

// Simplified initial values for quick orders
const getInitialValues = (orderType) => ({
  orderType: orderType || 'laboratory',
  testOrMedication: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: '',
  refills: 0,
  priority: 'routine',
  notes: '',
  indication: ''
});

// Quick validation rules
const validationRules = {
  testOrMedication: {
    required: true,
    label: 'Test/Medication',
    minLength: 2
  },
  indication: {
    required: true,
    label: 'Clinical Indication',
    minLength: 5
  },
  priority: {
    required: true,
    label: 'Priority'
  }
};

// Quick Order Form Fields Component
const QuickOrderFormFields = ({ formData = {}, errors = {}, onChange, disabled }) => {
  // Provide safe defaults
  const safeFormData = {
    orderType: formData.orderType || 'laboratory',
    testOrMedication: formData.testOrMedication || '',
    dosage: formData.dosage || '',
    frequency: formData.frequency || '',
    duration: formData.duration || '',
    quantity: formData.quantity || '',
    refills: formData.refills || 0,
    priority: formData.priority || 'routine',
    notes: formData.notes || '',
    indication: formData.indication || ''
  };

  const isMenudicationOrder = safeFormData.orderType === 'medication';

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Quick Order Entry - For complex orders, use the full CPOE system
      </Alert>

      <Grid container spacing={2}>
        {/* Order Type */}
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Order Type</InputLabel>
            <Select
              value={safeFormData.orderType}
              label="Order Type"
              disabled={disabled}
              onChange={(e) => onChange('orderType', e.target.value)}
            >
              <MenuItem value="laboratory">Laboratory Test</MenuItem>
              <MenuItem value="imaging">Imaging Study</MenuItem>
              <MenuItem value="medication">Medication</MenuItem>
              <MenuItem value="procedure">Procedure</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Test/Medication Name */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={isMenudicationOrder ? 'Medication Name' : 'Test/Procedure Name'}
            value={safeFormData.testOrMedication}
            onChange={(e) => onChange('testOrMedication', e.target.value)}
            disabled={disabled}
            error={!!errors.testOrMedication}
            helperText={errors.testOrMedication}
            placeholder={
              isMenudicationOrder 
                ? "e.g., Metformin 500mg, Lisinopril 10mg..."
                : "e.g., Complete Blood Count, Chest X-ray..."
            }
            required
          />
        </Grid>

        {/* Medication-specific fields */}
        {isMenudicationOrder && (
          <>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Dosage"
                value={safeFormData.dosage}
                onChange={(e) => onChange('dosage', e.target.value)}
                disabled={disabled}
                placeholder="e.g., 500mg, 10mg, 1 tablet..."
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Frequency"
                value={safeFormData.frequency}
                onChange={(e) => onChange('frequency', e.target.value)}
                disabled={disabled}
                placeholder="e.g., twice daily, once daily..."
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Duration"
                value={safeFormData.duration}
                onChange={(e) => onChange('duration', e.target.value)}
                disabled={disabled}
                placeholder="e.g., 30 days, 90 days..."
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Quantity"
                value={safeFormData.quantity}
                onChange={(e) => onChange('quantity', e.target.value)}
                disabled={disabled}
                placeholder="e.g., 30, 60, 90..."
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Refills"
                type="number"
                value={safeFormData.refills}
                onChange={(e) => onChange('refills', parseInt(e.target.value) || 0)}
                disabled={disabled}
                inputProps={{ min: 0, max: 12 }}
              />
            </Grid>
          </>
        )}

        {/* Priority */}
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={safeFormData.priority}
              label="Priority"
              disabled={disabled}
              onChange={(e) => onChange('priority', e.target.value)}
              required
            >
              {SERVICE_REQUEST_PRIORITY_OPTIONS.map(priority => (
                <MenuItem key={priority.value} value={priority.value}>
                  {priority.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Clinical Indication */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Clinical Indication"
            value={safeFormData.indication}
            onChange={(e) => onChange('indication', e.target.value)}
            disabled={disabled}
            error={!!errors.indication}
            helperText={errors.indication || "Why is this order needed?"}
            placeholder="e.g., Annual screening, Follow-up diabetes, Rule out pneumonia..."
            required
            multiline
            rows={2}
          />
        </Grid>

        {/* Clinical Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Additional Notes"
            value={safeFormData.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            disabled={disabled}
            multiline
            rows={3}
            placeholder="Special instructions, patient preparation, urgency..."
          />
        </Grid>
      </Grid>

      {/* Order Preview */}
      {safeFormData.testOrMedication && safeFormData.indication && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="subtitle2">
            Quick Order Preview:
          </Typography>
          <Typography variant="body2">
            <strong>{ORDER_CATEGORIES.find(c => c.value === safeFormData.orderType)?.display}:</strong> {safeFormData.testOrMedication}
            {isMenudicationOrder && safeFormData.dosage && ` (${safeFormData.dosage})`}
            {isMenudicationOrder && safeFormData.frequency && ` - ${safeFormData.frequency}`}
          </Typography>
          <Typography variant="body2">
            <strong>Priority:</strong> {safeFormData.priority} • <strong>Indication:</strong> {safeFormData.indication}
          </Typography>
        </Alert>
      )}
    </Stack>
  );
};

const QuickOrderDialog = ({ 
  open, 
  onClose, 
  patientId, 
  orderType = 'laboratory',
  onOrderCreated 
}) => {
  
  // Custom validation
  const handleValidate = (formData) => {
    const errors = {};
    
    if (!formData.testOrMedication || formData.testOrMedication.trim() === '') {
      errors.testOrMedication = 'Please specify the test/medication name';
    } else if (formData.testOrMedication.length < 2) {
      errors.testOrMedication = 'Name must be at least 2 characters';
    }
    
    if (!formData.indication || formData.indication.trim() === '') {
      errors.indication = 'Clinical indication is required';
    } else if (formData.indication.length < 5) {
      errors.indication = 'Please provide more detail about the clinical indication';
    }
    
    return errors;
  };

  // Handle save operation
  const handleSave = async (formData) => {
    try {
      let savedResource;
      
      if (formData.orderType === 'medication') {
        // Create MedicationRequest
        const medicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          priority: formData.priority,
          subject: { reference: `Patient/${patientId}` },
          authoredOn: new Date().toISOString(),
          medicationCodeableConcept: {
            text: formData.testOrMedication
          },
          dosageInstruction: formData.dosage || formData.frequency ? [{
            text: [formData.dosage, formData.frequency, formData.duration].filter(Boolean).join(' ')
          }] : [],
          dispenseRequest: {
            quantity: { value: parseFloat(formData.quantity) || 30 },
            numberOfRepeatsAllowed: parseInt(formData.refills) || 0
          },
          reasonCode: [{
            text: formData.indication
          }],
          note: formData.notes ? [{ text: formData.notes }] : []
        };
        savedResource = medicationRequest;
      } else {
        // Create ServiceRequest for other order types
        const categoryData = ORDER_CATEGORIES.find(c => c.value === formData.orderType);
        const serviceRequest = {
          resourceType: 'ServiceRequest',
          status: 'active',
          intent: 'order',
          priority: formData.priority,
          subject: { reference: `Patient/${patientId}` },
          authoredOn: new Date().toISOString(),
          category: [{
            coding: [{
              system: categoryData?.system || 'http://snomed.info/sct',
              code: categoryData?.code || '',
              display: categoryData?.display || formData.orderType
            }]
          }],
          code: {
            text: formData.testOrMedication
          },
          reasonCode: [{
            text: formData.indication
          }],
          note: formData.notes ? [{ text: formData.notes }] : []
        };
        savedResource = serviceRequest;
      }
      
      // Call the parent callback
      if (onOrderCreated) {
        await onOrderCreated(savedResource, formData.orderType);
      }
    } catch (error) {
      throw new Error(error.message || 'Failed to create quick order');
    }
  };

  // Dialog title
  const getDialogTitle = () => {
    const typeMap = {
      'laboratory': 'Quick Lab Order',
      'imaging': 'Quick Imaging Order', 
      'medication': 'Quick Medication Order',
      'procedure': 'Quick Procedure Order'
    };
    return typeMap[orderType] || 'Quick Order Entry';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <BaseResourceDialog
        // Dialog props
        open={open}
        onClose={onClose}
        title={getDialogTitle()}
        maxWidth="md"
        fullWidth
        
        // Resource props
        resourceType={orderType === 'medication' ? 'MedicationRequest' : 'ServiceRequest'}
        mode="add"
        
        // Form configuration
        initialValues={getInitialValues(orderType)}
        validationRules={validationRules}
        
        // Callbacks
        onSave={handleSave}
        onValidate={handleValidate}
        
        // UI customization
        showPreview={false} // Keep it simple for quick orders
        showCancel={true}
        saveButtonText="Submit Order"
      >
        <QuickOrderFormFields />
      </BaseResourceDialog>
    </LocalizationProvider>
  );
};

export default QuickOrderDialog;