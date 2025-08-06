/**
 * Medication Safety Dialog
 * Comprehensive drug safety review dialog for medication workflows
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  TextField,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Security as SafetyIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import DrugSafetyAlert from '../DrugSafetyAlert';
import { useDrugSafety } from '../../../hooks/useDrugSafety';

const steps = ['Safety Analysis', 'Review Alerts', 'Override Reason', 'Confirmation'];

const MedicationSafetyDialog = ({
  open,
  onClose,
  medication,
  patientId,
  onProceed,
  onCancel,
  requireOverrideReason = true
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedReasonCode, setSelectedReasonCode] = useState('');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(new Set());
  
  const {
    loading,
    error,
    safetyData,
    checkSingleMedication,
    getSeverityLevel,
    isSafeToProceed,
    getFormattedRecommendations
  } = useDrugSafety(patientId);

  // Load safety data when dialog opens
  useEffect(() => {
    if (open && medication && patientId) {
      checkSingleMedication(medication);
    }
  }, [open, medication, patientId, checkSingleMedication]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setOverrideReason('');
      setSelectedReasonCode('');
      setAcknowledgedAlerts(new Set());
    }
  }, [open]);

  // Override reason codes
  const overrideReasons = [
    { code: 'benefit_outweighs_risk', label: 'Benefit outweighs risk' },
    { code: 'patient_monitored', label: 'Patient will be closely monitored' },
    { code: 'no_alternatives', label: 'No suitable alternatives available' },
    { code: 'specialist_recommendation', label: 'Specialist recommendation' },
    { code: 'patient_previously_tolerated', label: 'Patient previously tolerated' },
    { code: 'other', label: 'Other (specify)' }
  ];

  const handleNext = () => {
    if (activeStep === 0 && safetyData) {
      // Move to review if safety check complete
      setActiveStep(1);
    } else if (activeStep === 1) {
      // Check if override is needed
      if (!isSafeToProceed() && requireOverrideReason) {
        setActiveStep(2); // Go to override reason
      } else {
        setActiveStep(3); // Go to confirmation
      }
    } else if (activeStep === 2) {
      if (selectedReasonCode && (selectedReasonCode !== 'other' || overrideReason)) {
        setActiveStep(3); // Go to confirmation
      }
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleProceed = () => {
    const result = {
      medication,
      safetyData,
      proceeded: true,
      overrideReason: selectedReasonCode === 'other' ? overrideReason : selectedReasonCode,
      overrideReasonText: overrideReason,
      acknowledgedAlerts: Array.from(acknowledgedAlerts),
      severityLevel: getSeverityLevel()
    };
    
    if (onProceed) {
      onProceed(result);
    }
    onClose();
  };

  const handleCancel = () => {
    const result = {
      medication,
      safetyData,
      proceeded: false,
      reason: 'user_cancelled'
    };
    
    if (onCancel) {
      onCancel(result);
    }
    onClose();
  };

  const handleRefresh = () => {
    checkSingleMedication(medication);
  };

  const getSeverityIcon = () => {
    const severity = getSeverityLevel();
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'high':
      case 'moderate':
        return <WarningIcon color="warning" />;
      case 'low':
        return <CheckIcon color="success" />;
      default:
        return <SafetyIcon color="primary" />;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={activeStep > 0}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getSeverityIcon()}
            <Typography variant="h6">
              Medication Safety Review
            </Typography>
          </Box>
          <IconButton onClick={handleCancel} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {medication && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">
              Reviewing: <strong>{medication.name || medication.display || 'Medication'}</strong>
            </Typography>
            {medication.dose && (
              <Typography variant="body2">
                Dose: {medication.dose} {medication.route && `- ${medication.route}`}
              </Typography>
            )}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Safety Analysis */}
          <Step>
            <StepLabel>Safety Analysis</StepLabel>
            <StepContent>
              {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }}>Analyzing medication safety...</Typography>
                </Box>
              ) : error ? (
                <Alert severity="error" action={
                  <Button color="inherit" size="small" onClick={handleRefresh}>
                    Retry
                  </Button>
                }>
                  {error}
                </Alert>
              ) : safetyData ? (
                <Box>
                  <Alert severity={getSeverityLevel() === 'critical' ? 'error' : 'success'} sx={{ mb: 2 }}>
                    Safety analysis complete. Risk score: {safetyData.overall_risk_score?.toFixed(1) || 0}/10
                  </Alert>
                  {safetyData.total_alerts > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Found {safetyData.total_alerts} safety alerts ({safetyData.critical_alerts} critical)
                    </Typography>
                  )}
                </Box>
              ) : null}
            </StepContent>
          </Step>

          {/* Step 2: Review Alerts */}
          <Step>
            <StepLabel>Review Safety Alerts</StepLabel>
            <StepContent>
              {safetyData ? (
                <Box>
                  <DrugSafetyAlert
                    safetyData={safetyData}
                    showDetails={true}
                    collapsible={true}
                  />
                  
                  {!isSafeToProceed() && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="subtitle2">
                        Critical safety concerns identified. Override reason will be required.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              ) : (
                <Typography>No safety data available</Typography>
              )}
            </StepContent>
          </Step>

          {/* Step 3: Override Reason (if needed) */}
          {!isSafeToProceed() && requireOverrideReason && (
            <Step>
              <StepLabel>Override Reason</StepLabel>
              <StepContent>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  You are overriding critical safety alerts. Please provide a reason.
                </Alert>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Select reason for override:
                  </Typography>
                  {overrideReasons.map((reason) => (
                    <Box key={reason.code} sx={{ mb: 1 }}>
                      <Button
                        variant={selectedReasonCode === reason.code ? 'contained' : 'outlined'}
                        fullWidth
                        sx={{ justifyContent: 'flex-start' }}
                        onClick={() => setSelectedReasonCode(reason.code)}
                      >
                        {reason.label}
                      </Button>
                    </Box>
                  ))}
                </Box>
                
                {selectedReasonCode === 'other' && (
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Please specify reason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    required
                  />
                )}
              </StepContent>
            </Step>
          )}

          {/* Step 4: Confirmation */}
          <Step>
            <StepLabel>Confirmation</StepLabel>
            <StepContent>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Ready to proceed with medication order
                </Typography>
                
                {safetyData && safetyData.total_alerts > 0 && (
                  <Alert 
                    severity={getSeverityLevel() === 'critical' ? 'error' : 'warning'}
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="body2">
                      You are proceeding with {safetyData.total_alerts} safety alerts.
                      {selectedReasonCode && (
                        <Box sx={{ mt: 1 }}>
                          <strong>Override reason:</strong> {
                            selectedReasonCode === 'other' 
                              ? overrideReason 
                              : overrideReasons.find(r => r.code === selectedReasonCode)?.label
                          }
                        </Box>
                      )}
                    </Typography>
                  </Alert>
                )}
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel}>
          Cancel
        </Button>
        
        {activeStep > 0 && (
          <Button onClick={handleBack}>
            Back
          </Button>
        )}
        
        {activeStep < steps.length - 1 ? (
          <Button 
            variant="contained" 
            onClick={handleNext}
            disabled={
              (activeStep === 0 && (!safetyData || loading)) ||
              (activeStep === 2 && !selectedReasonCode) ||
              (activeStep === 2 && selectedReasonCode === 'other' && !overrideReason)
            }
          >
            Next
          </Button>
        ) : (
          <Button 
            variant="contained" 
            color={getSeverityLevel() === 'critical' ? 'error' : 'primary'}
            onClick={handleProceed}
          >
            {!isSafeToProceed() ? 'Override and Proceed' : 'Proceed'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MedicationSafetyDialog;