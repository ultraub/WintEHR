/**
 * Medication Discontinuation Dialog Component
 * Comprehensive workflow for discontinuing medications with proper FHIR tracking
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  TextField,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Autocomplete,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  Collapse,
  CircularProgress
} from '@mui/material';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Medication as MedicationIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  EventNote as EventIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, addDays, parseISO } from 'date-fns';
import { useMedicationResolver } from '../../../hooks/useMedicationResolver';

// Discontinuation reason categories based on clinical guidelines
const DISCONTINUATION_REASONS = {
  'clinical': {
    label: 'Clinical Reasons',
    reasons: [
      { code: 'ineffective', display: 'Medication not effective' },
      { code: 'adverse-reaction', display: 'Adverse drug reaction' },
      { code: 'allergy', display: 'Allergic reaction' },
      { code: 'contraindication', display: 'Contraindication discovered' },
      { code: 'drug-interaction', display: 'Drug interaction concern' },
      { code: 'toxicity', display: 'Signs of toxicity' },
      { code: 'condition-resolved', display: 'Medical condition resolved' },
      { code: 'alternative-therapy', display: 'Switched to alternative therapy' }
    ]
  },
  'patient': {
    label: 'Patient-Related',
    reasons: [
      { code: 'patient-request', display: 'Patient requested discontinuation' },
      { code: 'non-adherence', display: 'Patient non-adherence' },
      { code: 'cost-concern', display: 'Cost/insurance issues' },
      { code: 'lifestyle-change', display: 'Lifestyle or preference change' },
      { code: 'intolerance', display: 'Patient intolerance' }
    ]
  },
  'administrative': {
    label: 'Administrative',
    reasons: [
      { code: 'prescriber-error', display: 'Prescribing error correction' },
      { code: 'duplicate-therapy', display: 'Duplicate therapy identified' },
      { code: 'formulary-change', display: 'Formulary restriction' },
      { code: 'protocol-change', display: 'Treatment protocol change' },
      { code: 'trial-completed', display: 'Medication trial completed' }
    ]
  },
  'safety': {
    label: 'Safety Concerns',
    reasons: [
      { code: 'black-box-warning', display: 'Black box warning consideration' },
      { code: 'pregnancy', display: 'Pregnancy/pregnancy planning' },
      { code: 'age-related', display: 'Age-related safety concern' },
      { code: 'renal-impairment', display: 'Renal function decline' },
      { code: 'hepatic-impairment', display: 'Hepatic function decline' },
      { code: 'cardiac-concern', display: 'Cardiac safety concern' }
    ]
  }
};

// Tapering schedule templates
const TAPERING_SCHEDULES = [
  {
    id: 'gradual-2week',
    name: '2-Week Gradual Taper',
    description: 'Reduce dose by 25% every 3-4 days',
    duration: 14,
    steps: [
      { day: 0, percentage: 100, note: 'Continue current dose' },
      { day: 3, percentage: 75, note: 'Reduce to 75% of original dose' },
      { day: 7, percentage: 50, note: 'Reduce to 50% of original dose' },
      { day: 10, percentage: 25, note: 'Reduce to 25% of original dose' },
      { day: 14, percentage: 0, note: 'Discontinue completely' }
    ]
  },
  {
    id: 'conservative-4week',
    name: '4-Week Conservative Taper',
    description: 'Slow reduction over 4 weeks',
    duration: 28,
    steps: [
      { day: 0, percentage: 100, note: 'Continue current dose' },
      { day: 7, percentage: 75, note: 'Reduce to 75% of original dose' },
      { day: 14, percentage: 50, note: 'Reduce to 50% of original dose' },
      { day: 21, percentage: 25, note: 'Reduce to 25% of original dose' },
      { day: 28, percentage: 0, note: 'Discontinue completely' }
    ]
  },
  {
    id: 'immediate',
    name: 'Immediate Discontinuation',
    description: 'Stop medication immediately',
    duration: 0,
    steps: [
      { day: 0, percentage: 0, note: 'Discontinue immediately' }
    ]
  }
];

const MedicationDiscontinuationDialog = ({ 
  open, 
  onClose, 
  medicationRequest, 
  onDiscontinue 
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Multi-step wizard: 1=reason, 2=schedule, 3=confirmation
  
  // Form state
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [discontinueType, setDiscontinueType] = useState('immediate'); // 'immediate' or 'tapered'
  const [selectedTaperingSchedule, setSelectedTaperingSchedule] = useState('');
  const [customTaperingSchedule, setCustomTaperingSchedule] = useState([]);
  const [effectiveDate, setEffectiveDate] = useState(new Date());
  const [notifyPatient, setNotifyPatient] = useState(true);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(null);
  const [alternativeTherapy, setAlternativeTherapy] = useState('');
  const [monitoringRequired, setMonitoringRequired] = useState(false);
  const [monitoringInstructions, setMonitoringInstructions] = useState('');
  
  // UI state
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [errors, setErrors] = useState({});

  const { getMedicationDisplay } = useMedicationResolver(medicationRequest ? [medicationRequest] : []);

  useEffect(() => {
    if (reasonCode) {
      // Auto-populate follow-up requirements based on reason
      const needsFollowUp = [
        'adverse-reaction', 'allergy', 'toxicity', 'drug-interaction',
        'ineffective', 'contraindication'
      ].includes(reasonCode);
      
      setFollowUpRequired(needsFollowUp);
      if (needsFollowUp && !followUpDate) {
        setFollowUpDate(addDays(effectiveDate, 7)); // Default 1 week follow-up
      }

      // Auto-populate monitoring requirements
      const needsMonitoring = [
        'adverse-reaction', 'toxicity', 'renal-impairment', 
        'hepatic-impairment', 'cardiac-concern'
      ].includes(reasonCode);
      
      setMonitoringRequired(needsMonitoring);
    }
  }, [reasonCode, effectiveDate]);

  const validateStep = (stepNumber) => {
    const newErrors = {};

    if (stepNumber === 1) {
      if (!reasonCategory) newErrors.reasonCategory = 'Please select a reason category';
      if (!reasonCode) newErrors.reasonCode = 'Please select a specific reason';
      if (reasonCode === 'custom' && !customReason.trim()) {
        newErrors.customReason = 'Please provide a custom reason';
      }
    }

    if (stepNumber === 2) {
      if (discontinueType === 'tapered' && !selectedTaperingSchedule) {
        newErrors.taperingSchedule = 'Please select a tapering schedule';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;

    setLoading(true);
    try {
      const discontinuationData = {
        medicationRequestId: medicationRequest.id,
        reason: {
          category: reasonCategory,
          code: reasonCode,
          display: reasonCode === 'custom' ? customReason : 
            DISCONTINUATION_REASONS[reasonCategory]?.reasons.find(r => r.code === reasonCode)?.display,
          text: clinicalNotes
        },
        discontinuationType: discontinueType,
        effectiveDate: effectiveDate.toISOString(),
        taperingSchedule: discontinueType === 'tapered' ? {
          scheduleId: selectedTaperingSchedule,
          customSchedule: customTaperingSchedule
        } : null,
        notifications: {
          notifyPatient,
          followUpRequired,
          followUpDate: followUpDate?.toISOString()
        },
        alternativeTherapy,
        monitoring: {
          required: monitoringRequired,
          instructions: monitoringInstructions
        },
        discontinuedBy: 'Current Provider', // In real app, get from auth context
        timestamp: new Date().toISOString()
      };

      await onDiscontinue(discontinuationData);
      onClose();
    } catch (error) {
      console.error('Error discontinuing medication:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedReason = () => {
    if (!reasonCategory || !reasonCode) return null;
    if (reasonCode === 'custom') return { code: 'custom', display: customReason };
    return DISCONTINUATION_REASONS[reasonCategory]?.reasons.find(r => r.code === reasonCode);
  };

  const getSelectedTaperingSchedule = () => {
    return TAPERING_SCHEDULES.find(s => s.id === selectedTaperingSchedule);
  };

  // Step 1: Reason Selection
  const renderReasonStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Reason for Discontinuation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please select the primary reason for discontinuing this medication.
      </Typography>

      <Stack spacing={3}>
        <FormControl error={!!errors.reasonCategory} fullWidth>
          <InputLabel>Reason Category</InputLabel>
          <Select
            value={reasonCategory}
            onChange={(e) => {
              setReasonCategory(e.target.value);
              setReasonCode(''); // Reset specific reason when category changes
            }}
            label="Reason Category"
          >
            {Object.entries(DISCONTINUATION_REASONS).map(([key, category]) => (
              <MenuItem key={key} value={key}>
                {category.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {reasonCategory && (
          <FormControl error={!!errors.reasonCode} fullWidth>
            <InputLabel>Specific Reason</InputLabel>
            <Select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              label="Specific Reason"
            >
              {DISCONTINUATION_REASONS[reasonCategory]?.reasons.map((reason) => (
                <MenuItem key={reason.code} value={reason.code}>
                  {reason.display}
                </MenuItem>
              ))}
              <MenuItem value="custom">Other (specify below)</MenuItem>
            </Select>
          </FormControl>
        )}

        {reasonCode === 'custom' && (
          <TextField
            label="Custom Reason"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            error={!!errors.customReason}
            helperText={errors.customReason}
            multiline
            rows={2}
            fullWidth
          />
        )}

        <TextField
          label="Clinical Notes"
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.target.value)}
          multiline
          rows={3}
          fullWidth
          placeholder="Additional clinical details, patient response, or relevant information..."
        />

        {/* Safety warnings based on reason */}
        {['adverse-reaction', 'allergy', 'toxicity'].includes(reasonCode) && (
          <Alert severity="warning" icon={<WarningIcon />}>
            <Typography variant="subtitle2">Safety Alert</Typography>
            This discontinuation reason may require immediate action and close monitoring. 
            Consider documenting this as an allergy or adverse reaction in the patient's record.
          </Alert>
        )}
      </Stack>
    </Box>
  );

  // Step 2: Discontinuation Schedule
  const renderScheduleStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Discontinuation Schedule
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose how to discontinue this medication based on clinical requirements.
      </Typography>

      <Stack spacing={3}>
        <FormControl component="fieldset">
          <RadioGroup
            value={discontinueType}
            onChange={(e) => setDiscontinueType(e.target.value)}
          >
            <FormControlLabel
              value="immediate"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">Immediate Discontinuation</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Stop medication effective immediately
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="tapered"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">Gradual Tapering</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Reduce dose gradually to minimize withdrawal effects
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        <DatePicker
          label="Effective Date"
          value={effectiveDate}
          onChange={(newDate) => setEffectiveDate(newDate)}
          slotProps={{
            textField: { fullWidth: true }
          }}
        />

        {discontinueType === 'tapered' && (
          <Box>
            <FormControl error={!!errors.taperingSchedule} fullWidth sx={{ mb: 2 }}>
              <InputLabel>Tapering Schedule</InputLabel>
              <Select
                value={selectedTaperingSchedule}
                onChange={(e) => setSelectedTaperingSchedule(e.target.value)}
                label="Tapering Schedule"
              >
                {TAPERING_SCHEDULES.map((schedule) => (
                  <MenuItem key={schedule.id} value={schedule.id}>
                    <Box>
                      <Typography variant="body2">{schedule.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {schedule.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedTaperingSchedule && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Tapering Schedule Preview
                </Typography>
                <List dense>
                  {getSelectedTaperingSchedule()?.steps.map((step, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ScheduleIcon color={step.percentage === 0 ? 'error' : 'primary'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Day ${step.day}: ${step.percentage}% of original dose`}
                        secondary={step.note}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        )}

        {/* Advanced Options */}
        <Box>
          <Button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            endIcon={showAdvancedOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Advanced Options
          </Button>
          
          <Collapse in={showAdvancedOptions}>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField
                label="Alternative Therapy"
                value={alternativeTherapy}
                onChange={(e) => setAlternativeTherapy(e.target.value)}
                placeholder="Replacement medication or therapy..."
                fullWidth
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={monitoringRequired}
                    onChange={(e) => setMonitoringRequired(e.target.checked)}
                  />
                }
                label="Post-discontinuation monitoring required"
              />

              {monitoringRequired && (
                <TextField
                  label="Monitoring Instructions"
                  value={monitoringInstructions}
                  onChange={(e) => setMonitoringInstructions(e.target.value)}
                  multiline
                  rows={2}
                  placeholder="Specific monitoring requirements or laboratory tests..."
                  fullWidth
                />
              )}
            </Stack>
          </Collapse>
        </Box>
      </Stack>
    </Box>
  );

  // Step 3: Confirmation
  const renderConfirmationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Confirm Discontinuation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review the discontinuation details before proceeding.
      </Typography>

      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Medication to Discontinue
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <MedicationIcon color="primary" />
              <Typography variant="body1">
                {getMedicationDisplay(medicationRequest)}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {medicationRequest?.dosageInstruction?.[0]?.text || 'See instructions'}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Discontinuation Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Reason</Typography>
                <Typography variant="body2">
                  {getSelectedReason()?.display}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Effective Date</Typography>
                <Typography variant="body2">
                  {format(effectiveDate, 'MMM d, yyyy')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Method</Typography>
                <Typography variant="body2">
                  {discontinueType === 'immediate' ? 'Immediate' : 
                   `Gradual tapering (${getSelectedTaperingSchedule()?.name})`}
                </Typography>
              </Grid>
              {alternativeTherapy && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Alternative Therapy</Typography>
                  <Typography variant="body2">{alternativeTherapy}</Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={notifyPatient}
                onChange={(e) => setNotifyPatient(e.target.checked)}
              />
            }
            label="Notify patient of medication discontinuation"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={followUpRequired}
                onChange={(e) => setFollowUpRequired(e.target.checked)}
              />
            }
            label="Schedule follow-up appointment"
          />

          {followUpRequired && (
            <Box sx={{ ml: 4 }}>
              <DatePicker
                label="Follow-up Date"
                value={followUpDate}
                onChange={(newDate) => setFollowUpDate(newDate)}
                slotProps={{
                  textField: { size: 'small' }
                }}
              />
            </Box>
          )}
        </Stack>

        {clinicalNotes && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Clinical Notes</Typography>
              <Typography variant="body2">{clinicalNotes}</Typography>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Discontinue Medication
          </Typography>
          <Chip 
            label={`Step ${step} of 3`} 
            variant="outlined" 
            size="small"
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        {step === 1 && renderReasonStep()}
        {step === 2 && renderScheduleStep()}
        {step === 3 && renderConfirmationStep()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        {step > 1 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button 
            onClick={handleNext} 
            variant="contained"
            disabled={loading}
          >
            Next
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            color="error"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <CancelIcon />}
          >
            {loading ? 'Discontinuing...' : 'Discontinue Medication'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MedicationDiscontinuationDialog;