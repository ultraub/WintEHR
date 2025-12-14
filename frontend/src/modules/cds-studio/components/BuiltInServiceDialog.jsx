import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import CodeEditor from './CodeEditor';
import cdsStudioApi from '../services/cdsStudioApi';

const HOOK_TYPES = [
  { value: 'patient-view', label: 'Patient View' },
  { value: 'medication-prescribe', label: 'Medication Prescribe' },
  { value: 'order-select', label: 'Order Select' },
  { value: 'order-sign', label: 'Order Sign' },
  { value: 'encounter-start', label: 'Encounter Start' },
  { value: 'encounter-discharge', label: 'Encounter Discharge' }
];

const SERVICE_STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

const DEFAULT_PYTHON_CODE = `"""
CDS Service Implementation

This service will be called when the hook fires.
Return CDS cards to provide clinical decision support.
"""

class CDSService:
    """Built-in CDS service implementation"""

    def evaluate(self, context, prefetch):
        """
        Evaluate the CDS logic and return cards.

        Args:
            context: Hook context (patientId, userId, etc.)
            prefetch: Pre-fetched FHIR resources

        Returns:
            dict: Response with 'cards' array
        """
        cards = []

        # Example: Check patient age from prefetch
        patient = prefetch.get('patient', {})
        if patient:
            # Add your clinical logic here
            cards.append({
                "summary": "CDS Alert",
                "indicator": "info",
                "source": {
                    "label": "My CDS Service"
                },
                "detail": "Patient information processed"
            })

        return {"cards": cards}
`;

const BuiltInServiceDialog = ({ open, onClose, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    service_id: '',
    title: '',
    description: '',
    hook_type: 'patient-view',
    source_code: DEFAULT_PYTHON_CODE,
    status: 'draft',
    version_notes: 'Initial version'
  });

  // Prefetch template state
  const [prefetchTemplates, setPrefetchTemplates] = useState([
    { key: 'patient', value: 'Patient/{{context.patientId}}' }
  ]);

  const steps = ['Service Information', 'Code Editor', 'Prefetch Templates', 'Review'];

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
  };

  const handleCodeChange = (newCode) => {
    setFormData({
      ...formData,
      source_code: newCode
    });
  };

  const handleAddPrefetch = () => {
    setPrefetchTemplates([
      ...prefetchTemplates,
      { key: '', value: '' }
    ]);
  };

  const handlePrefetchChange = (index, field) => (event) => {
    const newTemplates = [...prefetchTemplates];
    newTemplates[index][field] = event.target.value;
    setPrefetchTemplates(newTemplates);
  };

  const handleRemovePrefetch = (index) => {
    setPrefetchTemplates(prefetchTemplates.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build prefetch template object
      const prefetch_template = {};
      prefetchTemplates.forEach(({ key, value }) => {
        if (key && value) {
          prefetch_template[key] = value;
        }
      });

      // Submit to backend
      const serviceData = {
        ...formData,
        prefetch_template: Object.keys(prefetch_template).length > 0 ? prefetch_template : null
      };

      await cdsStudioApi.createBuiltInService(serviceData);

      // Success
      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Failed to create service:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setActiveStep(0);
    setFormData({
      service_id: '',
      title: '',
      description: '',
      hook_type: 'patient-view',
      source_code: DEFAULT_PYTHON_CODE,
      status: 'draft',
      version_notes: 'Initial version'
    });
    setPrefetchTemplates([
      { key: 'patient', value: 'Patient/{{context.patientId}}' }
    ]);
    setError(null);
    onClose();
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Service ID"
                value={formData.service_id}
                onChange={handleChange('service_id')}
                placeholder="my-cds-service"
                helperText="Unique identifier (lowercase, hyphens allowed)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Title"
                value={formData.title}
                onChange={handleChange('title')}
                placeholder="My CDS Service"
                helperText="Human-readable service name"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={handleChange('description')}
                placeholder="Describe what this service does..."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Hook Type</InputLabel>
                <Select
                  value={formData.hook_type}
                  onChange={handleChange('hook_type')}
                  label="Hook Type"
                >
                  {HOOK_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={handleChange('status')}
                  label="Status"
                >
                  {SERVICE_STATUS.map(status => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <CodeIcon />
              <Typography variant="h6">Python Service Code</Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Implement the <code>evaluate()</code> method to process the hook context and return CDS cards.
            </Alert>
            <CodeEditor
              value={formData.source_code}
              onChange={handleCodeChange}
              height={500}
              language="python"
            />
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Prefetch Templates
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Define FHIR resources to pre-fetch before service execution. Use template variables like{' '}
              <code>{'{{context.patientId}}'}</code>
            </Alert>

            {prefetchTemplates.map((template, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Key"
                      value={template.key}
                      onChange={handlePrefetchChange(index, 'key')}
                      placeholder="patient"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={7}>
                    <TextField
                      fullWidth
                      label="FHIR Query"
                      value={template.value}
                      onChange={handlePrefetchChange(index, 'value')}
                      placeholder="Patient/{{context.patientId}}"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <Button
                      color="error"
                      onClick={() => handleRemovePrefetch(index)}
                      disabled={prefetchTemplates.length === 1}
                      size="small"
                    >
                      Remove
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            ))}

            <Button variant="outlined" onClick={handleAddPrefetch} size="small">
              Add Prefetch Template
            </Button>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Service Configuration
            </Typography>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography>Service Information</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Service ID</Typography>
                    <Typography variant="body1" fontFamily="monospace">{formData.service_id}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Title</Typography>
                    <Typography variant="body1">{formData.title}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Hook Type</Typography>
                    <Typography variant="body1">{formData.hook_type}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Status</Typography>
                    <Typography variant="body1">{formData.status}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Description</Typography>
                    <Typography variant="body1">{formData.description || 'None'}</Typography>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography>Prefetch Templates ({prefetchTemplates.filter(t => t.key && t.value).length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {prefetchTemplates.filter(t => t.key && t.value).map((template, index) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">{template.key}</Typography>
                    <Typography variant="body2" fontFamily="monospace">{template.value}</Typography>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography>Service Code ({formData.source_code.split('\n').length} lines)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <CodeEditor
                  value={formData.source_code}
                  readOnly={true}
                  height={300}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>Create Built-in CDS Service</DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 2 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {renderStepContent(activeStep)}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || loading}
        >
          Back
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Creating...' : 'Create Service'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BuiltInServiceDialog;
