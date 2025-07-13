/**
 * EncounterCreationDialog Component
 * Comprehensive encounter creation with templates and documentation
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
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Autocomplete,
  FormControlLabel,
  Checkbox,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  EventNote as EncounterIcon,
  Person as PatientIcon,
  Schedule as ScheduleIcon,
  MedicalServices as ServiceIcon,
  Assignment as TemplateIcon,
  Add as AddIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { format, addMinutes } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import api from '../../../../services/api';

// Encounter Templates
const ENCOUNTER_TEMPLATES = {
  'annual-physical': {
    name: 'Annual Physical Exam',
    type: 'AMB',
    duration: 60,
    reasonForVisit: 'Annual preventive care examination',
    chiefComplaint: 'Routine annual physical examination',
    checklist: [
      'Review of systems',
      'Vital signs',
      'Physical examination',
      'Health maintenance screening',
      'Immunization review',
      'Medication reconciliation'
    ],
    expectedOrders: [
      'Complete Blood Count',
      'Comprehensive Metabolic Panel',
      'Lipid Panel',
      'Mammogram (if indicated)',
      'Colonoscopy screening (if due)'
    ]
  },
  'follow-up-diabetes': {
    name: 'Diabetes Follow-up',
    type: 'AMB',
    duration: 30,
    reasonForVisit: 'Diabetes mellitus follow-up',
    chiefComplaint: 'Routine diabetes management',
    checklist: [
      'Blood glucose log review',
      'Medication adherence',
      'Diabetic foot exam',
      'Blood pressure check',
      'Weight monitoring'
    ],
    expectedOrders: [
      'Hemoglobin A1C',
      'Urine microalbumin',
      'Diabetic eye exam referral'
    ]
  },
  'hypertension-followup': {
    name: 'Hypertension Follow-up',
    type: 'AMB',
    duration: 20,
    reasonForVisit: 'Hypertension management',
    chiefComplaint: 'Blood pressure follow-up',
    checklist: [
      'Blood pressure monitoring',
      'Medication compliance',
      'Side effects assessment',
      'Lifestyle counseling'
    ],
    expectedOrders: [
      'Basic Metabolic Panel',
      'Urine analysis'
    ]
  },
  'acute-visit': {
    name: 'Acute Care Visit',
    type: 'AMB',
    duration: 30,
    reasonForVisit: 'Acute illness',
    chiefComplaint: '',
    checklist: [
      'History of present illness',
      'Focused physical exam',
      'Assessment and plan',
      'Patient education'
    ],
    expectedOrders: []
  },
  'medication-review': {
    name: 'Medication Review',
    type: 'AMB',
    duration: 15,
    reasonForVisit: 'Medication management',
    chiefComplaint: 'Medication review and adjustment',
    checklist: [
      'Current medication list',
      'Side effects review',
      'Drug interactions check',
      'Adherence assessment'
    ],
    expectedOrders: []
  }
};

// Provider templates
const PROVIDER_TEMPLATES = [
  'Dr. Sarah Johnson, MD',
  'Dr. Michael Chen, MD',
  'Dr. Emily Rodriguez, MD',
  'Dr. James Wilson, MD',
  'Dr. Lisa Thompson, NP',
  'Dr. Robert Kim, PA-C'
];

const STEPS = [
  { id: 'basic', label: 'Basic Information', description: 'Set encounter type and timing' },
  { id: 'clinical', label: 'Clinical Details', description: 'Chief complaint and reason for visit' },
  { id: 'provider', label: 'Provider & Location', description: 'Assign provider and location' },
  { id: 'review', label: 'Review & Create', description: 'Review all details before creation' }
];

const EncounterCreationDialog = ({ 
  open, 
  onClose, 
  patientId, 
  onEncounterCreated 
}) => {
  const { currentUser } = useAuth();
  const { currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();

  // State management
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

  const [encounterData, setEncounterData] = useState({
    type: 'AMB',
    reasonForVisit: '',
    chiefComplaint: '',
    provider: '',
    location: 'Main Clinic',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
    duration: 30,
    priority: 'routine',
    status: 'planned',
    checklist: [],
    expectedOrders: [],
    notes: ''
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setSelectedTemplate('');
      setValidationErrors([]);
      setEncounterData({
        type: 'AMB',
        reasonForVisit: '',
        chiefComplaint: '',
        provider: currentUser?.name || '',
        location: 'Main Clinic',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
        duration: 30,
        priority: 'routine',
        status: 'planned',
        checklist: [],
        expectedOrders: [],
        notes: ''
      });
    }
  }, [open, currentUser]);

  const applyTemplate = (templateKey) => {
    const template = ENCOUNTER_TEMPLATES[templateKey];
    if (!template) return;

    setEncounterData(prev => ({
      ...prev,
      type: template.type,
      reasonForVisit: template.reasonForVisit,
      chiefComplaint: template.chiefComplaint,
      duration: template.duration,
      checklist: [...template.checklist],
      expectedOrders: [...template.expectedOrders]
    }));
    setSelectedTemplate(templateKey);
  };

  const validateStep = (step) => {
    const errors = [];
    
    switch (step) {
      case 0: // Basic
        if (!encounterData.type) errors.push('Encounter type is required');
        if (!encounterData.scheduledDate) errors.push('Date is required');
        if (!encounterData.scheduledTime) errors.push('Time is required');
        break;
      case 1: // Clinical
        if (!encounterData.reasonForVisit.trim()) errors.push('Reason for visit is required');
        if (!encounterData.chiefComplaint.trim()) errors.push('Chief complaint is required');
        break;
      case 2: // Provider
        if (!encounterData.provider.trim()) errors.push('Provider is required');
        if (!encounterData.location.trim()) errors.push('Location is required');
        break;
      case 3: // Review
        // Final validation
        break;
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setValidationErrors([]);
  };

  const handleCreateEncounter = async () => {
    if (!validateStep(activeStep)) return;

    setLoading(true);

    try {
      // Calculate end time
      const startDateTime = new Date(`${encounterData.scheduledDate}T${encounterData.scheduledTime}:00`);
      const endDateTime = addMinutes(startDateTime, encounterData.duration);

      // Create FHIR Encounter resource
      const encounter = {
        resourceType: 'Encounter',
        status: encounterData.status,
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: encounterData.type,
          display: encounterData.type === 'AMB' ? 'ambulatory' : 
                  encounterData.type === 'IMP' ? 'inpatient' : 
                  encounterData.type === 'EMER' ? 'emergency' : 'ambulatory'
        },
        type: [{
          text: selectedTemplate ? ENCOUNTER_TEMPLATES[selectedTemplate].name : 'Clinical Encounter'
        }],
        priority: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
            code: encounterData.priority
          }]
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        period: {
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString()
        },
        reasonCode: [{
          text: encounterData.reasonForVisit
        }],
        participant: [{
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ATND',
              display: 'attender'
            }]
          }],
          individual: {
            display: encounterData.provider
          }
        }],
        location: [{
          location: {
            display: encounterData.location
          }
        }],
        meta: {
          tag: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/common-tags',
              code: 'template',
              display: selectedTemplate || 'custom'
            }
          ]
        }
      };

      // Add notes if provided
      if (encounterData.notes.trim()) {
        encounter.note = [{ text: encounterData.notes }];
      }

      // Add chief complaint as extension
      if (encounterData.chiefComplaint.trim()) {
        encounter.extension = [{
          url: 'http://hl7.org/fhir/StructureDefinition/encounter-chiefComplaint',
          valueString: encounterData.chiefComplaint
        }];
      }

      // Save encounter
      const response = await api.post('/fhir/R4/Encounter', encounter);
      const savedEncounter = response.data;

      // Publish encounter created event
      await publish(CLINICAL_EVENTS.ENCOUNTER_CREATED, {
        encounterId: savedEncounter.id,
        patientId,
        type: encounterData.type,
        provider: encounterData.provider,
        reasonForVisit: encounterData.reasonForVisit,
        chiefComplaint: encounterData.chiefComplaint,
        template: selectedTemplate,
        expectedOrders: encounterData.expectedOrders,
        checklist: encounterData.checklist,
        timestamp: new Date().toISOString()
      });

      // Refresh patient resources
      window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
        detail: { patientId } 
      }));

      // Notify parent component
      if (onEncounterCreated) {
        onEncounterCreated(savedEncounter);
      }

      onClose();

    } catch (error) {
      setValidationErrors([`Failed to create encounter: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0: // Basic Information
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Choose Encounter Template (Optional)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {Object.entries(ENCOUNTER_TEMPLATES).map(([key, template]) => (
                <Grid item xs={12} md={6} key={key}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      border: selectedTemplate === key ? 2 : 1,
                      borderColor: selectedTemplate === key ? 'primary.main' : 'divider'
                    }}
                    onClick={() => applyTemplate(key)}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {template.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Duration: {template.duration} minutes
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {template.reasonForVisit}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Typography variant="h6" gutterBottom>
              Basic Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Encounter Type</InputLabel>
                  <Select
                    value={encounterData.type}
                    onChange={(e) => setEncounterData({ ...encounterData, type: e.target.value })}
                    label="Encounter Type"
                  >
                    <MenuItem value="AMB">Ambulatory (Office Visit)</MenuItem>
                    <MenuItem value="IMP">Inpatient</MenuItem>
                    <MenuItem value="EMER">Emergency</MenuItem>
                    <MenuItem value="HH">Home Health</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Duration (minutes)"
                  type="number"
                  value={encounterData.duration}
                  onChange={(e) => setEncounterData({ ...encounterData, duration: parseInt(e.target.value) || 30 })}
                  inputProps={{ min: 15, max: 120, step: 15 }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={encounterData.priority}
                    onChange={(e) => setEncounterData({ ...encounterData, priority: e.target.value })}
                    label="Priority"
                  >
                    <MenuItem value="routine">Routine</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                    <MenuItem value="asap">ASAP</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={encounterData.scheduledDate}
                  onChange={(e) => setEncounterData({ ...encounterData, scheduledDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Time"
                  type="time"
                  value={encounterData.scheduledTime}
                  onChange={(e) => setEncounterData({ ...encounterData, scheduledTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 1: // Clinical Details
        return (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reason for Visit"
                  value={encounterData.reasonForVisit}
                  onChange={(e) => setEncounterData({ ...encounterData, reasonForVisit: e.target.value })}
                  placeholder="e.g., Annual physical exam, Diabetes follow-up"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Chief Complaint"
                  value={encounterData.chiefComplaint}
                  onChange={(e) => setEncounterData({ ...encounterData, chiefComplaint: e.target.value })}
                  placeholder="Patient's main concern or complaint"
                  multiline
                  rows={2}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Additional Notes"
                  value={encounterData.notes}
                  onChange={(e) => setEncounterData({ ...encounterData, notes: e.target.value })}
                  placeholder="Any additional preparation notes or instructions"
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>

            {encounterData.checklist.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Planned Activities:
                </Typography>
                <List dense>
                  {encounterData.checklist.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={item} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        );

      case 2: // Provider & Location
        return (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Autocomplete
                  value={encounterData.provider}
                  onChange={(event, newValue) => {
                    setEncounterData({ ...encounterData, provider: newValue || '' });
                  }}
                  options={PROVIDER_TEMPLATES}
                  freeSolo
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Provider"
                      placeholder="Select or type provider name"
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Location"
                  value={encounterData.location}
                  onChange={(e) => setEncounterData({ ...encounterData, location: e.target.value })}
                  placeholder="e.g., Main Clinic, Room 101"
                  required
                />
              </Grid>
            </Grid>

            {encounterData.expectedOrders.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Expected Orders/Tests:
                </Typography>
                <List dense>
                  {encounterData.expectedOrders.map((order, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <InfoIcon color="info" />
                      </ListItemIcon>
                      <ListItemText primary={order} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        );

      case 3: // Review
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Encounter Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Patient</Typography>
                <Typography variant="body1">
                  {currentPatient ? 
                    `${currentPatient.name?.[0]?.given?.join(' ')} ${currentPatient.name?.[0]?.family}` : 
                    'Unknown Patient'
                  }
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Provider</Typography>
                <Typography variant="body1">{encounterData.provider}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Date & Time</Typography>
                <Typography variant="body1">
                  {format(new Date(`${encounterData.scheduledDate}T${encounterData.scheduledTime}`), 'PPP p')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Duration</Typography>
                <Typography variant="body1">{encounterData.duration} minutes</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Reason for Visit</Typography>
                <Typography variant="body1">{encounterData.reasonForVisit}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Chief Complaint</Typography>
                <Typography variant="body1">{encounterData.chiefComplaint}</Typography>
              </Grid>
              {encounterData.notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                  <Typography variant="body1">{encounterData.notes}</Typography>
                </Grid>
              )}
            </Grid>

            {selectedTemplate && (
              <Alert severity="info" sx={{ mt: 2 }}>
                This encounter is based on the "{ENCOUNTER_TEMPLATES[selectedTemplate].name}" template.
              </Alert>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  if (!currentPatient) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EncounterIcon />
          <Typography variant="h6">
            Create New Encounter
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Patient: {currentPatient.name?.[0]?.given?.join(' ')} {currentPatient.name?.[0]?.family}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {STEPS.map((step, index) => (
            <Step key={step.id}>
              <StepLabel>
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {step.description}
                </Typography>
                {renderStepContent(index)}
                
                {validationErrors.length > 0 && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    <ul>
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
                
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                  {index === STEPS.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleCreateEncounter}
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                    >
                      {loading ? 'Creating...' : 'Create Encounter'}
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                    >
                      Continue
                    </Button>
                  )}
                </Stack>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EncounterCreationDialog;