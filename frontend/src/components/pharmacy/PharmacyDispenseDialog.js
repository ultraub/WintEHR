/**
 * Pharmacy Dispense Dialog Component
 * Dialog for dispensing medications
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Alert,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  LocalPharmacy as PharmacyIcon,
  Inventory as InventoryIcon,
  Print as PrintIcon,
  Person as PersonIcon,
  DateRange as DateIcon
} from '@mui/icons-material';
import { medicationDispenseService } from '../../services/medicationDispenseService';
import { pharmacyService } from '../../services/pharmacyService';
import { format } from 'date-fns';

const steps = ['Verify Prescription', 'Check Inventory', 'Dispense Medication', 'Complete'];

const PharmacyDispenseDialog = ({ 
  open, 
  onClose, 
  prescription, 
  onDispenseComplete 
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [dispenseData, setDispenseData] = useState({
    quantity: '',
    lotNumber: '',
    expirationDate: '',
    notes: '',
    pharmacistId: 'current-pharmacist' // In production, get from auth context
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open && prescription) {
      setActiveStep(0);
      setError(null);
      setValidation(null);
      setInventory(null);
      setDispenseData(prev => ({
        ...prev,
        quantity: prescription.quantity || '',
        notes: ''
      }));
    }
  }, [open, prescription]);

  // Step 1: Verify Prescription
  const handleVerifyPrescription = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate dispensing prerequisites
      const validationResult = await medicationDispenseService.validateDispensingPrerequisites(
        prescription.medication_request_id,
        prescription.patient_id
      );
      
      setValidation(validationResult);
      
      if (validationResult.valid) {
        // Update pharmacy status to verified
        await pharmacyService.updatePharmacyStatus(
          prescription.medication_request_id,
          {
            status: 'verified',
            notes: 'Prescription verified for dispensing',
            updated_by: dispenseData.pharmacistId
          }
        );
        
        setActiveStep(1);
      } else {
        setError(validationResult.issues.join(', '));
      }
    } catch (err) {
      console.error('Error verifying prescription:', err);
      setError(err.message || 'Failed to verify prescription');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Check Inventory
  const handleCheckInventory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get medication code if available
      const medicationCode = prescription.medication_code || 
        prescription.medication_name || 
        'unknown';
      
      const inventoryResult = await pharmacyService.checkMedicationInventory(medicationCode);
      setInventory(inventoryResult);
      
      if (inventoryResult.status === 'in_stock') {
        setActiveStep(2);
      } else {
        setError(`Inventory issue: ${inventoryResult.status}`);
      }
    } catch (err) {
      console.error('Error checking inventory:', err);
      // Continue anyway - inventory check is informational
      setInventory({ 
        status: 'unknown', 
        message: 'Unable to verify inventory' 
      });
      setActiveStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Dispense Medication
  const handleDispense = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate required fields
      if (!dispenseData.quantity) {
        throw new Error('Quantity is required');
      }
      if (!dispenseData.lotNumber) {
        throw new Error('Lot number is required');
      }
      if (!dispenseData.expirationDate) {
        throw new Error('Expiration date is required');
      }
      
      // Complete the dispensing workflow
      const result = await medicationDispenseService.completePharmacyDispensing(
        prescription.medication_request_id,
        {
          patientId: prescription.patient_id,
          quantity: parseFloat(dispenseData.quantity),
          lotNumber: dispenseData.lotNumber,
          expirationDate: dispenseData.expirationDate,
          notes: dispenseData.notes,
          pharmacistId: dispenseData.pharmacistId
        }
      );
      
      if (result.success) {
        setActiveStep(3);
        
        // Notify parent component
        if (onDispenseComplete) {
          onDispenseComplete(result);
        }
      } else {
        throw new Error(result.message || 'Dispensing failed');
      }
    } catch (err) {
      console.error('Error dispensing medication:', err);
      setError(err.message || 'Failed to dispense medication');
    } finally {
      setLoading(false);
    }
  };

  // Handle next step
  const handleNext = () => {
    switch (activeStep) {
      case 0:
        handleVerifyPrescription();
        break;
      case 1:
        handleCheckInventory();
        break;
      case 2:
        handleDispense();
        break;
      case 3:
        onClose();
        break;
    }
  };

  // Handle back
  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError(null);
  };

  // Update dispense data
  const updateDispenseData = (field, value) => {
    setDispenseData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  if (!prescription) {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={activeStep > 0 && activeStep < 3}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PharmacyIcon color="primary" />
          Dispense Medication
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Prescription Summary */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Prescription Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="h6">
                {prescription.medication_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Quantity: {prescription.quantity} {prescription.unit}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <PersonIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                Patient: {prescription.patient_id}
              </Typography>
              <Typography variant="body2">
                <DateIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                Prescribed: {prescription.prescribed_date ? 
                  format(new Date(prescription.prescribed_date), 'MMM d, yyyy') : 
                  'N/A'
                }
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Stepper */}
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Verify */}
          <Step>
            <StepLabel>
              {steps[0]}
            </StepLabel>
            <StepContent>
              <Typography paragraph>
                Verify prescription details and check for any warnings or issues.
              </Typography>
              
              {validation && (
                <Box sx={{ mb: 2 }}>
                  {validation.issues.length > 0 && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Issues:
                      </Typography>
                      <List dense>
                        {validation.issues.map((issue, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <WarningIcon color="error" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={issue} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}
                  
                  {validation.warnings.length > 0 && (
                    <Alert severity="warning">
                      <Typography variant="subtitle2" gutterBottom>
                        Warnings:
                      </Typography>
                      <List dense>
                        {validation.warnings.map((warning, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <WarningIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={warning} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}
                  
                  {validation.valid && validation.issues.length === 0 && validation.warnings.length === 0 && (
                    <Alert severity="success">
                      <CheckIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Prescription verified successfully
                    </Alert>
                  )}
                </Box>
              )}
            </StepContent>
          </Step>

          {/* Step 2: Inventory */}
          <Step>
            <StepLabel>
              {steps[1]}
            </StepLabel>
            <StepContent>
              <Typography paragraph>
                Check medication inventory and availability.
              </Typography>
              
              {inventory && (
                <Alert 
                  severity={inventory.status === 'in_stock' ? 'success' : 'warning'}
                  icon={<InventoryIcon />}
                >
                  <Typography variant="subtitle2">
                    {inventory.medication_name || prescription.medication_name}
                  </Typography>
                  <Typography variant="body2">
                    Status: {inventory.status}
                  </Typography>
                  {inventory.current_stock !== undefined && (
                    <Typography variant="body2">
                      Current Stock: {inventory.current_stock} {inventory.unit}
                    </Typography>
                  )}
                  {inventory.lot_numbers && inventory.lot_numbers.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" gutterBottom>
                        Available Lots:
                      </Typography>
                      {inventory.lot_numbers.map((lot, index) => (
                        <Chip
                          key={index}
                          label={`Lot: ${lot.lot} (Exp: ${lot.expiration})`}
                          size="small"
                          sx={{ mr: 1, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  )}
                </Alert>
              )}
            </StepContent>
          </Step>

          {/* Step 3: Dispense */}
          <Step>
            <StepLabel>
              {steps[2]}
            </StepLabel>
            <StepContent>
              <Typography paragraph>
                Enter dispensing information.
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Quantity Dispensed"
                    type="number"
                    value={dispenseData.quantity}
                    onChange={(e) => updateDispenseData('quantity', e.target.value)}
                    required
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Lot Number"
                    value={dispenseData.lotNumber}
                    onChange={(e) => updateDispenseData('lotNumber', e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Expiration Date"
                    type="date"
                    value={dispenseData.expirationDate}
                    onChange={(e) => updateDispenseData('expirationDate', e.target.value)}
                    required
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ 
                      min: format(new Date(), 'yyyy-MM-dd')
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Pharmacist Notes"
                    multiline
                    rows={2}
                    value={dispenseData.notes}
                    onChange={(e) => updateDispenseData('notes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </StepContent>
          </Step>

          {/* Step 4: Complete */}
          <Step>
            <StepLabel>
              {steps[3]}
            </StepLabel>
            <StepContent>
              <Alert severity="success" icon={<CheckIcon />}>
                Medication dispensed successfully!
              </Alert>
              <Typography paragraph sx={{ mt: 2 }}>
                The medication has been dispensed and the prescription has been marked as completed.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                sx={{ mt: 1 }}
              >
                Print Label
              </Button>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {activeStep === 3 ? 'Close' : 'Cancel'}
        </Button>
        
        {activeStep > 0 && activeStep < 3 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        
        {activeStep < 3 && (
          <Button 
            onClick={handleNext} 
            variant="contained"
            disabled={loading || (activeStep === 0 && validation && !validation.valid)}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              activeStep === 2 ? 'Dispense' : 'Next'
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PharmacyDispenseDialog;