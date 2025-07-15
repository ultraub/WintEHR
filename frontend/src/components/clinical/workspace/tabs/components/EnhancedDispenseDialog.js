/**
 * Enhanced Dispense Dialog Component
 * Comprehensive medication dispensing interface with FHIR R4 MedicationDispense creation
 * Part of Phase 1 Implementation: MedicationDispense Integration
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  AlertTitle,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Collapse,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress
} from '@mui/material';
import {
  LocalPharmacy as DispenseIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Inventory as InventoryIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { getMedicationName } from '../../../../../utils/medicationDisplayUtils';
import { medicationDispenseService } from '../../../../../services/medicationDispenseService';

const DISPENSING_STEPS = [
  { id: 'verification', label: 'Prescription Verification', required: true },
  { id: 'safety', label: 'Safety Checks', required: true },
  { id: 'preparation', label: 'Medication Preparation', required: true },
  { id: 'documentation', label: 'Documentation & Labeling', required: true }
];

const DISPENSING_LOCATIONS = [
  { id: 'Location/pharmacy-main', name: 'Main Pharmacy' },
  { id: 'Location/pharmacy-oncology', name: 'Oncology Pharmacy' },
  { id: 'Location/pharmacy-pediatric', name: 'Pediatric Pharmacy' },
  { id: 'Location/pharmacy-emergency', name: 'Emergency Pharmacy' }
];

const EnhancedDispenseDialog = ({ 
  open, 
  onClose, 
  medicationRequest, 
  onDispense,
  currentUser = null 
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [dispensing, setDispensing] = useState(false);
  const [dispenseData, setDispenseData] = useState({
    quantity: '',
    quantityUnit: '',
    daysSupply: '',
    lotNumber: '',
    expirationDate: '',
    location: 'Location/pharmacy-main',
    pharmacistNotes: '',
    substitution: {
      wasSubstituted: false,
      type: null,
      reason: [],
      responsibleParty: null
    },
    performer: null
  });
  
  const [safetyChecks, setSafetyChecks] = useState({
    prescriptionValidation: { completed: false, passed: false, issues: [] },
    drugInteractions: { completed: false, passed: false, issues: [] },
    allergies: { completed: false, passed: false, issues: [] },
    dosageValidation: { completed: false, passed: false, issues: [] },
    inventoryCheck: { completed: false, passed: false, issues: [] }
  });
  
  const [validationResults, setValidationResults] = useState({
    valid: true,
    issues: [],
    warnings: []
  });
  
  useEffect(() => {
    if (medicationRequest && open) {
      initializeDispenseData();
      validateDispensingPrerequisites();
    }
  }, [medicationRequest, open]);
  
  const initializeDispenseData = () => {
    const requestedQuantity = medicationRequest.dispenseRequest?.quantity?.value || '';
    const requestedUnit = medicationRequest.dispenseRequest?.quantity?.unit || 'units';
    const requestedDaysSupply = medicationRequest.dispenseRequest?.expectedSupplyDuration?.value || '';
    
    setDispenseData(prev => ({
      ...prev,
      quantity: requestedQuantity.toString(),
      quantityUnit: requestedUnit,
      daysSupply: requestedDaysSupply.toString(),
      performer: currentUser ? {
        actor: {
          reference: `Practitioner/${currentUser.id}`,
          display: currentUser.name || 'Current Pharmacist'
        }
      } : null
    }));
  };
  
  const validateDispensingPrerequisites = async () => {
    if (!medicationRequest?.id) return;
    
    try {
      const validation = await medicationDispenseService.validateDispensingPrerequisites(
        medicationRequest.id,
        medicationRequest.subject?.reference?.split('/')[1]
      );
      setValidationResults(validation);
    } catch (error) {
      setValidationResults({
        valid: false,
        issues: [`Validation error: ${error.message}`],
        warnings: []
      });
    }
  };
  
  const performSafetyChecks = useCallback(async () => {
    setSafetyChecks(prev => ({
      ...prev,
      prescriptionValidation: { completed: false, passed: false, issues: [] },
      drugInteractions: { completed: false, passed: false, issues: [] },
      allergies: { completed: false, passed: false, issues: [] },
      dosageValidation: { completed: false, passed: false, issues: [] },
      inventoryCheck: { completed: false, passed: false, issues: [] }
    }));
    
    // Prescription validation
    const prescriptionCheck = await validatePrescription();
    setSafetyChecks(prev => ({
      ...prev,
      prescriptionValidation: prescriptionCheck
    }));
    
    // Drug interaction checking
    const interactionCheck = await checkDrugInteractions();
    setSafetyChecks(prev => ({
      ...prev,
      drugInteractions: interactionCheck
    }));
    
    // Allergy checking
    const allergyCheck = await checkAllergies();
    setSafetyChecks(prev => ({
      ...prev,
      allergies: allergyCheck
    }));
    
    // Dosage validation
    const dosageCheck = await validateDosage();
    setSafetyChecks(prev => ({
      ...prev,
      dosageValidation: dosageCheck
    }));
    
    // Inventory checking
    const inventoryCheck = await checkInventory();
    setSafetyChecks(prev => ({
      ...prev,
      inventoryCheck: inventoryCheck
    }));
  }, [medicationRequest, dispenseData]);
  
  const validatePrescription = async () => {
    const issues = [];
    let passed = true;
    
    // Check prescription status
    if (medicationRequest.status !== 'active') {
      issues.push(`Prescription status is ${medicationRequest.status}, expected 'active'`);
      passed = false;
    }
    
    // Check prescription dates
    const authoredDate = new Date(medicationRequest.authoredOn);
    const daysSinceAuthored = (new Date() - authoredDate) / (1000 * 60 * 60 * 24);
    if (daysSinceAuthored > 30) {
      issues.push(`Prescription is ${Math.round(daysSinceAuthored)} days old`);
    }
    
    // Check for required fields
    if (!medicationRequest.medicationCodeableConcept && !medicationRequest.medicationReference) {
      issues.push('No medication specified');
      passed = false;
    }
    
    if (!medicationRequest.dosageInstruction || medicationRequest.dosageInstruction.length === 0) {
      issues.push('No dosage instructions specified');
    }
    
    return {
      completed: true,
      passed: passed && issues.length === 0,
      issues
    };
  };
  
  const checkDrugInteractions = async () => {
    // Placeholder for drug interaction checking
    // In a real implementation, this would call an interaction checking service
    const issues = [];
    
    // Simulate interaction checking
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock interaction found
    if (getMedicationName(medicationRequest).toLowerCase().includes('warfarin')) {
      issues.push('Moderate interaction with aspirin - monitor INR closely');
    }
    
    return {
      completed: true,
      passed: issues.length === 0,
      issues
    };
  };
  
  const checkAllergies = async () => {
    // Placeholder for allergy checking
    // In a real implementation, this would call an allergy checking service
    const issues = [];
    
    // Simulate allergy checking
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      completed: true,
      passed: true,
      issues
    };
  };
  
  const validateDosage = async () => {
    const issues = [];
    let passed = true;
    
    // Check if quantity matches prescription
    const prescribedQuantity = medicationRequest.dispenseRequest?.quantity?.value;
    const requestedQuantity = parseFloat(dispenseData.quantity);
    
    if (prescribedQuantity && requestedQuantity !== prescribedQuantity) {
      if (requestedQuantity > prescribedQuantity * 1.1) {
        issues.push(`Requested quantity (${requestedQuantity}) exceeds prescribed quantity (${prescribedQuantity}) by more than 10%`);
        passed = false;
      } else if (requestedQuantity < prescribedQuantity * 0.9) {
        issues.push(`Requested quantity (${requestedQuantity}) is significantly less than prescribed quantity (${prescribedQuantity})`);
      }
    }
    
    // Check days supply
    if (dispenseData.daysSupply) {
      const daysSupply = parseFloat(dispenseData.daysSupply);
      if (daysSupply > 90) {
        issues.push(`Days supply (${daysSupply}) exceeds typical maximum of 90 days`);
      }
    }
    
    return {
      completed: true,
      passed,
      issues
    };
  };
  
  const checkInventory = async () => {
    // Placeholder for inventory checking
    // In a real implementation, this would call an inventory service
    const issues = [];
    
    // Simulate inventory checking
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const requestedQuantity = parseFloat(dispenseData.quantity);
    const availableQuantity = 100; // Mock available quantity
    
    if (requestedQuantity > availableQuantity) {
      issues.push(`Insufficient inventory: ${availableQuantity} available, ${requestedQuantity} requested`);
    }
    
    return {
      completed: true,
      passed: issues.length === 0,
      issues
    };
  };
  
  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };
  
  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };
  
  const canProceedToNextStep = () => {
    switch (activeStep) {
      case 0: // Verification
        return validationResults.valid && validationResults.issues.length === 0;
      case 1: // Safety Checks
        return Object.values(safetyChecks).every(check => 
          check.completed && (check.passed || check.issues.length === 0)
        );
      case 2: // Preparation
        return dispenseData.quantity && dispenseData.lotNumber && dispenseData.expirationDate;
      case 3: // Documentation
        return true;
      default:
        return true;
    }
  };
  
  const allSafetyChecksPassed = () => {
    return Object.values(safetyChecks).every(check => 
      check.completed && check.passed
    ) || Object.values(safetyChecks).every(check => 
      check.completed && check.issues.length === 0
    );
  };
  
  const handleDispense = async () => {
    if (!canCompleteDispensing()) return;
    
    setDispensing(true);
    
    try {
      // Prepare MedicationDispense data
      const medicationDispenseData = {
        status: 'completed',
        medicationCodeableConcept: medicationRequest.medicationCodeableConcept,
        medicationReference: medicationRequest.medicationReference,
        subject: medicationRequest.subject,
        authorizingPrescription: [{
          reference: `MedicationRequest/${medicationRequest.id}`
        }],
        quantity: {
          value: parseFloat(dispenseData.quantity),
          unit: dispenseData.quantityUnit,
          system: 'http://unitsofmeasure.org'
        },
        daysSupply: dispenseData.daysSupply ? {
          value: parseInt(dispenseData.daysSupply),
          unit: 'days',
          system: 'http://unitsofmeasure.org'
        } : undefined,
        whenPrepared: new Date().toISOString(),
        whenHandedOver: new Date().toISOString(),
        performer: dispenseData.performer ? [dispenseData.performer] : [],
        location: {
          reference: dispenseData.location
        },
        note: dispenseData.pharmacistNotes ? [{
          text: dispenseData.pharmacistNotes
        }] : [],
        substitution: dispenseData.substitution.wasSubstituted ? {
          wasSubstituted: true,
          type: dispenseData.substitution.type,
          reason: dispenseData.substitution.reason,
          responsibleParty: dispenseData.substitution.responsibleParty
        } : {
          wasSubstituted: false
        },
        dosageInstruction: medicationRequest.dosageInstruction || []
      };
      
      // Add lot number and expiration as extensions (not standard FHIR fields)
      if (dispenseData.lotNumber || dispenseData.expirationDate) {
        medicationDispenseData.extension = [];
        
        if (dispenseData.lotNumber) {
          medicationDispenseData.extension.push({
            url: 'http://wintehr.com/fhir/StructureDefinition/lot-number',
            valueString: dispenseData.lotNumber
          });
        }
        
        if (dispenseData.expirationDate) {
          medicationDispenseData.extension.push({
            url: 'http://wintehr.com/fhir/StructureDefinition/expiration-date',
            valueDate: dispenseData.expirationDate
          });
        }
      }
      
      await onDispense(medicationDispenseData);
      onClose();
    } catch (error) {
      // Error handled by parent component
    } finally {
      setDispensing(false);
    }
  };
  
  const canCompleteDispensing = () => {
    return allSafetyChecksPassed() && 
           dispenseData.quantity && 
           dispenseData.lotNumber && 
           dispenseData.expirationDate;
  };
  
  const renderVerificationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Prescription Verification
      </Typography>
      
      {/* Prescription Information */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              {getMedicationName(medicationRequest)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Prescribed by
            </Typography>
            <Typography variant="body2">
              {medicationRequest.requester?.display || 'Unknown Provider'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Date Prescribed
            </Typography>
            <Typography variant="body2">
              {medicationRequest.authoredOn ? 
                format(new Date(medicationRequest.authoredOn), 'MMM d, yyyy h:mm a') : 
                'Unknown'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Chip 
              label={medicationRequest.status} 
              size="small"
              color={medicationRequest.status === 'active' ? 'success' : 'default'}
            />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Priority
            </Typography>
            <Typography variant="body2">
              {medicationRequest.priority || 'routine'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Validation Results */}
      {validationResults.issues.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Validation Issues</AlertTitle>
          <List dense>
            {validationResults.issues.map((issue, index) => (
              <ListItem key={index}>
                <ListItemText primary={issue} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
      
      {validationResults.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Warnings</AlertTitle>
          <List dense>
            {validationResults.warnings.map((warning, index) => (
              <ListItem key={index}>
                <ListItemText primary={warning} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
      
      {validationResults.valid && validationResults.issues.length === 0 && (
        <Alert severity="success">
          <AlertTitle>Prescription Verified</AlertTitle>
          Prescription is valid and ready for processing.
        </Alert>
      )}
    </Box>
  );
  
  const renderSafetyChecksStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Safety Checks
      </Typography>
      
      <Button 
        variant="contained" 
        onClick={performSafetyChecks}
        startIcon={<SecurityIcon />}
        sx={{ mb: 2 }}
        disabled={Object.values(safetyChecks).some(check => !check.completed) && 
                  Object.values(safetyChecks).some(check => check.completed)}
      >
        Run Safety Checks
      </Button>
      
      <List>
        {Object.entries(safetyChecks).map(([key, check]) => (
          <ListItem key={key}>
            <ListItemIcon>
              {!check.completed ? (
                <ScheduleIcon color="disabled" />
              ) : check.passed ? (
                <CheckIcon color="success" />
              ) : check.issues.length === 0 ? (
                <CheckIcon color="success" />
              ) : (
                <WarningIcon color="warning" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              secondary={
                check.completed ? (
                  check.issues.length > 0 ? (
                    <Box>
                      {check.issues.map((issue, index) => (
                        <Typography key={index} variant="caption" color="warning.main" display="block">
                          • {issue}
                        </Typography>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="success.main">
                      ✓ Passed
                    </Typography>
                  )
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Waiting...
                  </Typography>
                )
              }
            />
          </ListItem>
        ))}
      </List>
      
      {Object.values(safetyChecks).every(check => check.completed) && (
        <Alert severity={allSafetyChecksPassed() ? "success" : "warning"} sx={{ mt: 2 }}>
          <AlertTitle>
            {allSafetyChecksPassed() ? "All Safety Checks Passed" : "Safety Issues Detected"}
          </AlertTitle>
          {allSafetyChecksPassed() ? 
            "Medication is safe to dispense." :
            "Review safety issues before proceeding. Pharmacist override may be required."
          }
        </Alert>
      )}
    </Box>
  );
  
  const renderPreparationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Medication Preparation
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            label="Quantity to Dispense"
            type="number"
            value={dispenseData.quantity}
            onChange={(e) => setDispenseData(prev => ({
              ...prev,
              quantity: e.target.value
            }))}
            fullWidth
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Select
                    value={dispenseData.quantityUnit}
                    onChange={(e) => setDispenseData(prev => ({
                      ...prev,
                      quantityUnit: e.target.value
                    }))}
                    size="small"
                    variant="standard"
                  >
                    <MenuItem value="tablets">tablets</MenuItem>
                    <MenuItem value="capsules">capsules</MenuItem>
                    <MenuItem value="ml">ml</MenuItem>
                    <MenuItem value="mg">mg</MenuItem>
                    <MenuItem value="units">units</MenuItem>
                  </Select>
                </InputAdornment>
              )
            }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            label="Days Supply"
            type="number"
            value={dispenseData.daysSupply}
            onChange={(e) => setDispenseData(prev => ({
              ...prev,
              daysSupply: e.target.value
            }))}
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">days</InputAdornment>
            }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            label="Lot Number"
            value={dispenseData.lotNumber}
            onChange={(e) => setDispenseData(prev => ({
              ...prev,
              lotNumber: e.target.value
            }))}
            fullWidth
            required
            placeholder="Enter lot number"
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            label="Expiration Date"
            type="date"
            value={dispenseData.expirationDate}
            onChange={(e) => setDispenseData(prev => ({
              ...prev,
              expirationDate: e.target.value
            }))}
            fullWidth
            required
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Grid>
        
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Dispensing Location</InputLabel>
            <Select
              value={dispenseData.location}
              onChange={(e) => setDispenseData(prev => ({
                ...prev,
                location: e.target.value
              }))}
              label="Dispensing Location"
            >
              {DISPENSING_LOCATIONS.map(location => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Substitution Information</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={dispenseData.substitution.wasSubstituted}
                    onChange={(e) => setDispenseData(prev => ({
                      ...prev,
                      substitution: {
                        ...prev.substitution,
                        wasSubstituted: e.target.checked
                      }
                    }))}
                  />
                }
                label="Medication was substituted"
              />
              
              {dispenseData.substitution.wasSubstituted && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    label="Substitution Reason"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Reason for substitution..."
                  />
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    </Box>
  );
  
  const renderDocumentationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Documentation & Final Review
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Dispensing Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Medication
                </Typography>
                <Typography variant="body2">
                  {getMedicationName(medicationRequest)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Quantity
                </Typography>
                <Typography variant="body2">
                  {dispenseData.quantity} {dispenseData.quantityUnit}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Days Supply
                </Typography>
                <Typography variant="body2">
                  {dispenseData.daysSupply} days
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Lot Number
                </Typography>
                <Typography variant="body2">
                  {dispenseData.lotNumber}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            label="Pharmacist Notes"
            value={dispenseData.pharmacistNotes}
            onChange={(e) => setDispenseData(prev => ({
              ...prev,
              pharmacistNotes: e.target.value
            }))}
            fullWidth
            multiline
            rows={4}
            placeholder="Patient counseling provided, special instructions, etc."
          />
        </Grid>
      </Grid>
    </Box>
  );
  
  if (!medicationRequest) return null;
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <DispenseIcon color="primary" />
          <Typography variant="h6">
            Dispense Medication
          </Typography>
          <Chip 
            label={`Rx ${medicationRequest.id}`} 
            size="small" 
            variant="outlined"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {DISPENSING_STEPS.map((step, index) => (
              <Step key={step.id}>
                <StepLabel>
                  {step.label}
                  {step.required && <Typography component="span" color="error"> *</Typography>}
                </StepLabel>
                <StepContent>
                  {index === 0 && renderVerificationStep()}
                  {index === 1 && renderSafetyChecksStep()}
                  {index === 2 && renderPreparationStep()}
                  {index === 3 && renderDocumentationStep()}
                  
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={index === DISPENSING_STEPS.length - 1 ? handleDispense : handleNext}
                      disabled={!canProceedToNextStep() || dispensing}
                      sx={{ mr: 1 }}
                      startIcon={index === DISPENSING_STEPS.length - 1 ? <DispenseIcon /> : null}
                    >
                      {dispensing ? (
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress size={20} />
                          Dispensing...
                        </Box>
                      ) : (
                        index === DISPENSING_STEPS.length - 1 ? 'Complete Dispensing' : 'Continue'
                      )}
                    </Button>
                    <Button
                      disabled={index === 0 || dispensing}
                      onClick={handleBack}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={dispensing}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedDispenseDialog;