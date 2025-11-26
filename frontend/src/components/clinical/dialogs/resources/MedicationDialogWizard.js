/**
 * MedicationDialogWizard Component
 * Enhanced 3-step wizard for prescribing medications with progressive disclosure
 * Provides a simpler, more intuitive interface for medication ordering
 * 
 * @since 2025-01-21
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  TextField,
  Paper,
  Button,
  Divider,
  Autocomplete,
  FormControlLabel,
  Switch,
  useTheme,
  alpha,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Fade,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Schedule as ScheduleIcon,
  LocalPharmacy as PharmacyIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import SimplifiedClinicalDialog from '../../common/SimplifiedClinicalDialog';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { notificationService } from '../../../../services/notificationService';
import { getClinicalCatalog } from '../../../../services/cdsClinicalDataService';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { addDays, format } from 'date-fns';
import {
  getBorderRadius,
  getElevationShadow,
  getSmoothTransition
} from '../../../../themes/clinicalThemeUtils';
import { clinicalTokens } from '../../../../themes/clinicalTheme';
import type { MedicationRequest } from '../../../../core/fhir/types';

// Common frequencies with better descriptions
const FREQUENCY_OPTIONS = [
  { value: 'QD', label: 'Once daily', instructions: 'Take one tablet by mouth once daily', icon: '🌅' },
  { value: 'BID', label: 'Twice daily', instructions: 'Take one tablet by mouth twice daily (morning and evening)', icon: '🌅🌙' },
  { value: 'TID', label: 'Three times daily', instructions: 'Take one tablet by mouth three times daily (morning, afternoon, evening)', icon: '🌅☀️🌙' },
  { value: 'QID', label: 'Four times daily', instructions: 'Take one tablet by mouth four times daily', icon: '⏰' },
  { value: 'PRN', label: 'As needed', instructions: 'Take as needed for symptoms', icon: '💊' },
  { value: 'QHS', label: 'At bedtime', instructions: 'Take one tablet by mouth at bedtime', icon: '🌙' }
];

// Duration presets
const DURATION_PRESETS = [
  { value: 7, label: '1 week', color: 'info' },
  { value: 10, label: '10 days', color: 'primary' },
  { value: 14, label: '2 weeks', color: 'primary' },
  { value: 30, label: '1 month', color: 'success' },
  { value: 90, label: '3 months', color: 'success' }
];

const MedicationDialogWizard = ({
  open,
  onClose,
  mode = 'prescribe',
  medication = null,
  patient,
  onSave,
  onSendToPharmacy,
  clinicalContext = {}
}) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [medicationCatalog, setMedicationCatalog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [stepErrors, setStepErrors] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    medication: null,
    status: 'active',
    priority: 'routine',
    dosageAmount: '1',
    dosageUnit: 'tablet',
    frequency: 'BID',
    duration: 10,
    quantity: '20',
    refills: 0,
    instructions: '',
    notes: '',
    substitutionAllowed: true,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 10), 'yyyy-MM-dd')
  });

  // Load medication catalog
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setLoading(true);
        const catalog = await getClinicalCatalog('medications');
        setMedicationCatalog(catalog.items || []);
      } catch (error) {
        console.error('Failed to load medication catalog:', error);
        notificationService.error('Failed to load medication catalog');
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadCatalog();
      setActiveStep(0);
    }
  }, [open]);

  // Update instructions when frequency changes
  useEffect(() => {
    const freq = FREQUENCY_OPTIONS.find(f => f.value === formData.frequency);
    if (freq) {
      setFormData(prev => ({
        ...prev,
        instructions: freq.instructions.replace('one tablet', `${formData.dosageAmount} ${formData.dosageUnit}`)
      }));
    }
  }, [formData.frequency, formData.dosageAmount, formData.dosageUnit]);

  // Calculate quantity and end date based on dosage and duration
  useEffect(() => {
    if (formData.dosageAmount && formData.frequency && formData.duration) {
      const frequencyMap = {
        'QD': 1,
        'BID': 2,
        'TID': 3,
        'QID': 4,
        'PRN': 1, // Estimate for PRN
        'QHS': 1
      };
      
      const dailyDoses = frequencyMap[formData.frequency] || 1;
      const totalQuantity = parseFloat(formData.dosageAmount) * dailyDoses * formData.duration;
      
      setFormData(prev => ({
        ...prev,
        quantity: totalQuantity.toString(),
        endDate: format(addDays(new Date(prev.startDate), formData.duration), 'yyyy-MM-dd')
      }));
    }
  }, [formData.dosageAmount, formData.frequency, formData.duration, formData.startDate]);

  // Check for drug interactions when medication changes
  useEffect(() => {
    const checkInteractions = async () => {
      if (!formData.medication || !patient) return;

      try {
        const cdsResult = await clinicalCDSService.fireMedicationHooks({
          patient,
          medicationRequest: {
            medicationCodeableConcept: {
              coding: [{
                code: formData.medication.code,
                display: formData.medication.display
              }],
              text: formData.medication.display
            }
          }
        });

        if (cdsResult?.cards?.length > 0) {
          setCdsAlerts(cdsResult.cards);
        }
      } catch (error) {
        console.error('CDS check failed:', error);
      }
    };

    checkInteractions();
  }, [formData.medication, patient]);

  // Validate current step
  const validateStep = (step) => {
    const errors = {};
    
    switch (step) {
      case 0: // Medication selection
        if (!formData.medication) {
          errors.medication = 'Please select a medication';
        }
        break;
      case 1: // Dosage & Frequency
        if (!formData.dosageAmount || formData.dosageAmount <= 0) {
          errors.dosageAmount = 'Please enter a valid dosage amount';
        }
        if (!formData.frequency) {
          errors.frequency = 'Please select frequency';
        }
        if (!formData.duration || formData.duration <= 0) {
          errors.duration = 'Please select duration';
        }
        break;
      case 2: // Review & Confirm
        // No specific validation for review step
        break;
    }
    
    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle step navigation
  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  // Handle save
  const handleSave = async (sendToPharmacy = false) => {
    if (!validateStep(activeStep)) return;

    try {
      setSaving(true);
      
      const medicationRequest = {
        resourceType: 'MedicationRequest',
        status: formData.status,
        intent: 'order',
        priority: formData.priority,
        medicationCodeableConcept: {
          coding: [{
            code: formData.medication.code,
            display: formData.medication.display,
            system: formData.medication.system || 'http://www.nlm.nih.gov/research/umls/rxnorm'
          }],
          text: formData.medication.display
        },
        subject: {
          reference: `Patient/${patient.id}`,
          display: patient.name?.[0]?.given?.join(' ') + ' ' + patient.name?.[0]?.family
        },
        authoredOn: new Date().toISOString(),
        dosageInstruction: [{
          text: formData.instructions,
          timing: {
            code: {
              coding: [{
                code: formData.frequency,
                display: FREQUENCY_OPTIONS.find(f => f.value === formData.frequency)?.label
              }]
            }
          },
          doseAndRate: [{
            doseQuantity: {
              value: parseFloat(formData.dosageAmount),
              unit: formData.dosageUnit,
              system: 'http://unitsofmeasure.org',
              code: formData.dosageUnit === 'tablet' ? 'TAB' : formData.dosageUnit
            }
          }]
        }],
        dispenseRequest: {
          validityPeriod: {
            start: formData.startDate,
            end: formData.endDate
          },
          numberOfRepeatsAllowed: parseInt(formData.refills.toString()),
          quantity: {
            value: parseFloat(formData.quantity),
            unit: formData.dosageUnit,
            system: 'http://unitsofmeasure.org',
            code: formData.dosageUnit === 'tablet' ? 'TAB' : formData.dosageUnit
          }
        },
        substitution: {
          allowedBoolean: formData.substitutionAllowed
        }
      };

      // Add notes if provided
      if (formData.notes) {
        medicationRequest.note = [{
          text: formData.notes,
          time: new Date().toISOString()
        }];
      }

      // Save medication
      let result;
      if (mode === 'edit' && medication?.id) {
        result = await fhirClient.update('MedicationRequest', medication.id, {
          ...medicationRequest,
          id: medication.id
        } as MedicationRequest);
        notificationService.fhirSuccess('Updated', 'MedicationRequest', medication.id);
      } else {
        result = await fhirClient.create('MedicationRequest', medicationRequest);
        notificationService.fhirSuccess('Created', 'MedicationRequest', result.id);
      }

      // Send to pharmacy if requested
      if (sendToPharmacy && onSendToPharmacy) {
        await onSendToPharmacy(result);
        notificationService.success('Prescription sent to pharmacy');
      }

      // Call parent callback
      if (onSave) {
        onSave(result);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save medication:', error);
      notificationService.fhirError(error, {
        operation: mode === 'edit' ? 'UPDATE' : 'CREATE',
        resourceType: 'MedicationRequest'
      });
      setAlerts([{ 
        severity: 'error', 
        message: 'Failed to save medication. Please try again.' 
      }]);
    } finally {
      setSaving(false);
    }
  };

  // Step components
  const MedicationSelectionStep = () => (
    <Fade in={activeStep === 0}>
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Search and select the medication to prescribe. Start typing to filter the catalog.
        </Typography>
        
        <Autocomplete
          options={medicationCatalog}
          getOptionLabel={(option) => option.display || option.name || ''}
          value={formData.medication}
          onChange={(_, newValue) => {
            setFormData(prev => ({ ...prev, medication: newValue }));
            setStepErrors({});
          }}
          loading={loading}
          fullWidth
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search Medication"
              placeholder="Type medication name..."
              error={!!stepErrors.medication}
              helperText={stepErrors.medication}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: getBorderRadius('md'),
                  background: alpha(theme.palette.background.paper, 0.8)
                }
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ py: 1.5 }}>
              <Stack>
                <Typography variant="body1" fontWeight={500}>
                  {option.display || option.name}
                </Typography>
                {option.strength && (
                  <Typography variant="caption" color="text.secondary">
                    {option.strength}
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
        />

        {formData.medication && (
          <Paper 
            sx={{ 
              mt: 3, 
              p: 2, 
              borderRadius: getBorderRadius('lg'),
              background: clinicalTokens.gradients.backgroundCard,
              boxShadow: getElevationShadow(1)
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <MedicationIcon color="primary" />
              <Box flex={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {formData.medication.display}
                </Typography>
                {formData.medication.strength && (
                  <Typography variant="body2" color="text.secondary">
                    Strength: {formData.medication.strength}
                  </Typography>
                )}
              </Box>
              <CheckIcon color="success" />
            </Stack>
          </Paper>
        )}

        {cdsAlerts.length > 0 && (
          <Stack spacing={1} sx={{ mt: 3 }}>
            {cdsAlerts.map((alert, index) => (
              <Alert 
                key={index}
                severity={alert.indicator === 'critical' ? 'error' : 
                         alert.indicator === 'warning' ? 'warning' : 'info'}
                icon={alert.indicator === 'critical' ? <WarningIcon /> : <InfoIcon />}
              >
                {alert.summary}
              </Alert>
            ))}
          </Stack>
        )}
      </Box>
    </Fade>
  );

  const DosageFrequencyStep = () => (
    <Fade in={activeStep === 1}>
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure the dosage, frequency, and duration for this prescription.
        </Typography>

        <Grid container spacing={3}>
          {/* Dosage */}
          <Grid item xs={12}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2,
                borderRadius: getBorderRadius('md'),
                background: alpha(theme.palette.primary.main, 0.02)
              }}
            >
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Dosage
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={6}>
                  <TextField
                    label="Amount"
                    type="number"
                    value={formData.dosageAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, dosageAmount: e.target.value }))}
                    fullWidth
                    error={!!stepErrors.dosageAmount}
                    helperText={stepErrors.dosageAmount}
                    InputProps={{
                      inputProps: { min: 0, step: 0.5 }
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Unit</InputLabel>
                    <Select
                      value={formData.dosageUnit}
                      onChange={(e) => setFormData(prev => ({ ...prev, dosageUnit: e.target.value }))}
                      label="Unit"
                    >
                      <MenuItem value="tablet">Tablet</MenuItem>
                      <MenuItem value="capsule">Capsule</MenuItem>
                      <MenuItem value="mg">mg</MenuItem>
                      <MenuItem value="mL">mL</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Frequency */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Frequency
            </Typography>
            <Grid container spacing={1}>
              {FREQUENCY_OPTIONS.map((freq) => (
                <Grid item xs={6} sm={4} key={freq.value}>
                  <Paper
                    onClick={() => setFormData(prev => ({ ...prev, frequency: freq.value }))}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      textAlign: 'center',
                      borderRadius: getBorderRadius('md'),
                      border: `2px solid ${formData.frequency === freq.value ? theme.palette.primary.main : 'transparent'}`,
                      background: formData.frequency === freq.value 
                        ? alpha(theme.palette.primary.main, 0.08)
                        : alpha(theme.palette.background.default, 0.5),
                      ...getSmoothTransition(['all']),
                      '&:hover': {
                        borderColor: theme.palette.primary.light,
                        transform: 'translateY(-2px)',
                        boxShadow: getElevationShadow(1)
                      }
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 0.5 }}>{freq.icon}</Typography>
                    <Typography variant="body2" fontWeight={formData.frequency === freq.value ? 600 : 400}>
                      {freq.label}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Duration */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Duration
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {DURATION_PRESETS.map((preset) => (
                <Chip
                  key={preset.value}
                  label={preset.label}
                  onClick={() => setFormData(prev => ({ ...prev, duration: preset.value }))}
                  color={formData.duration === preset.value ? preset.color : 'default'}
                  variant={formData.duration === preset.value ? 'filled' : 'outlined'}
                  sx={{
                    borderRadius: getBorderRadius('md'),
                    fontWeight: formData.duration === preset.value ? 600 : 400,
                    ...getSmoothTransition(['all'])
                  }}
                />
              ))}
              <TextField
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                size="small"
                sx={{ width: 100 }}
                InputProps={{
                  endAdornment: <Typography variant="body2" color="text.secondary">days</Typography>,
                  inputProps: { min: 1 }
                }}
              />
            </Stack>
          </Grid>

          {/* Generated Instructions */}
          <Grid item xs={12}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2,
                borderRadius: getBorderRadius('md'),
                background: alpha(theme.palette.info.main, 0.02)
              }}
            >
              <Typography variant="subtitle2" color="info.main" gutterBottom>
                Generated Instructions
              </Typography>
              <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                {formData.instructions}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Fade>
  );

  const ReviewConfirmStep = () => (
    <Fade in={activeStep === 2}>
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Review the prescription details before sending to pharmacy.
        </Typography>

        <Paper 
          sx={{ 
            p: 3,
            borderRadius: getBorderRadius('lg'),
            background: clinicalTokens.gradients.backgroundCard,
            boxShadow: getElevationShadow(2)
          }}
        >
          <Stack spacing={3}>
            {/* Medication */}
            <Box>
              <Typography variant="overline" color="text.secondary">Medication</Typography>
              <Typography variant="h6" fontWeight={600}>
                {formData.medication?.display}
              </Typography>
            </Box>

            <Divider />

            {/* Dosage & Frequency */}
            <Grid container spacing={3}>
              <Grid item xs={6}>
                <Typography variant="overline" color="text.secondary">Dosage</Typography>
                <Typography variant="body1" fontWeight={500}>
                  {formData.dosageAmount} {formData.dosageUnit}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="overline" color="text.secondary">Frequency</Typography>
                <Typography variant="body1" fontWeight={500}>
                  {FREQUENCY_OPTIONS.find(f => f.value === formData.frequency)?.label}
                </Typography>
              </Grid>
            </Grid>

            {/* Duration & Quantity */}
            <Grid container spacing={3}>
              <Grid item xs={6}>
                <Typography variant="overline" color="text.secondary">Duration</Typography>
                <Typography variant="body1" fontWeight={500}>
                  {formData.duration} days
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="overline" color="text.secondary">Total Quantity</Typography>
                <Typography variant="body1" fontWeight={500}>
                  {formData.quantity} {formData.dosageUnit}s
                </Typography>
              </Grid>
            </Grid>

            <Divider />

            {/* Instructions */}
            <Box>
              <Typography variant="overline" color="text.secondary">Instructions</Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  mt: 0.5,
                  borderRadius: getBorderRadius('sm'),
                  background: alpha(theme.palette.info.main, 0.02)
                }}
              >
                <Typography variant="body1">
                  {formData.instructions}
                </Typography>
              </Paper>
            </Box>

            {/* Additional Options */}
            <Box>
              <FormControlLabel
                control={
                  <Switch 
                    checked={formData.substitutionAllowed}
                    onChange={(e) => setFormData(prev => ({ ...prev, substitutionAllowed: e.target.checked }))}
                  />
                }
                label="Allow generic substitution"
              />
            </Box>

            {/* Refills */}
            <Box>
              <Typography variant="overline" color="text.secondary">Refills</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                {[0, 1, 2, 3, 5].map((num) => (
                  <Chip
                    key={num}
                    label={num === 0 ? 'No refills' : `${num} refill${num > 1 ? 's' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, refills: num }))}
                    color={formData.refills === num ? 'primary' : 'default'}
                    variant={formData.refills === num ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Box>

            {/* Notes */}
            <TextField
              label="Additional Notes (Optional)"
              multiline
              rows={2}
              fullWidth
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: getBorderRadius('md')
                }
              }}
            />
          </Stack>
        </Paper>
      </Box>
    </Fade>
  );

  const steps = [
    { label: 'Select Medication', icon: <MedicationIcon /> },
    { label: 'Dosage & Frequency', icon: <ScheduleIcon /> },
    { label: 'Review & Confirm', icon: <PharmacyIcon /> }
  ];

  // Convert CDS alerts to dialog alerts
  const dialogAlerts = [
    ...alerts,
    ...cdsAlerts.map(alert => ({
      severity: alert.indicator === 'critical' ? 'error' : 
                alert.indicator === 'warning' ? 'warning' : 'info',
      message: alert.summary
    }))
  ];

  return (
    <SimplifiedClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Medication' : 'Prescribe Medication'}
      subtitle={`For ${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family || ''}`}
      category="medication"
      loading={loading}
      alerts={dialogAlerts}
      maxWidth="md"
      actions={[
        {
          label: activeStep === 0 ? 'Cancel' : 'Back',
          onClick: activeStep === 0 ? onClose : handleBack,
          variant: 'outlined',
          startIcon: activeStep > 0 ? <BackIcon /> : null
        },
        ...(activeStep < steps.length - 1 ? [{
          label: 'Next',
          onClick: handleNext,
          variant: 'contained',
          color: 'primary',
          endIcon: <NextIcon />,
          disabled: activeStep === 0 && !formData.medication
        }] : [
          {
            label: 'Save Draft',
            onClick: () => {
              setFormData(prev => ({ ...prev, status: 'draft' }));
              handleSave(false);
            },
            variant: 'outlined',
            color: 'primary',
            disabled: saving
          },
          {
            label: 'Send to Pharmacy',
            onClick: () => handleSave(true),
            variant: 'contained',
            color: 'primary',
            startIcon: <PharmacyIcon />,
            disabled: saving
          }
        ])
      ]}
    >
      {/* Progress Bar */}
      <LinearProgress 
        variant="determinate" 
        value={(activeStep + 1) / steps.length * 100}
        sx={{ 
          mb: 3,
          height: 6,
          borderRadius: getBorderRadius('pill'),
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
          '& .MuiLinearProgress-bar': {
            borderRadius: getBorderRadius('pill'),
            background: clinicalTokens.gradients.primary
          }
        }}
      />

      {/* Step Indicators */}
      <Stack direction="row" justifyContent="center" spacing={2} sx={{ mb: 4 }}>
        {steps.map((step, index) => (
          <Stack key={index} alignItems="center" spacing={0.5}>
            <Paper
              elevation={0}
              sx={{
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: index <= activeStep 
                  ? clinicalTokens.gradients.primary
                  : alpha(theme.palette.action.disabled, 0.1),
                color: index <= activeStep ? 'white' : 'text.disabled',
                ...getSmoothTransition(['all'])
              }}
            >
              {index < activeStep ? <CheckIcon /> : step.icon}
            </Paper>
            <Typography 
              variant="caption" 
              color={index <= activeStep ? 'primary' : 'text.disabled'}
              fontWeight={index === activeStep ? 600 : 400}
            >
              {step.label}
            </Typography>
          </Stack>
        ))}
      </Stack>

      {/* Step Content */}
      <Box sx={{ minHeight: 400 }}>
        {activeStep === 0 && <MedicationSelectionStep />}
        {activeStep === 1 && <DosageFrequencyStep />}
        {activeStep === 2 && <ReviewConfirmStep />}
      </Box>
    </SimplifiedClinicalDialog>
  );
};

export default MedicationDialogWizard;