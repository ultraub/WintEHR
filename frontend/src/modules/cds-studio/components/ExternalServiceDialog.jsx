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
  AccordionDetails,
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Cloud as CloudIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
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

const ExternalServiceDialog = ({ open, onClose, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    service_id: '',
    title: '',
    description: '',
    hook_type: 'patient-view',
    url: '',
    credentials_id: '',
    status: 'draft',
    version_notes: 'Initial registration'
  });

  // Prefetch template state
  const [prefetchTemplates, setPrefetchTemplates] = useState([
    { key: 'patient', value: 'Patient/{{context.patientId}}' }
  ]);

  const steps = ['Service Information', 'Endpoint Configuration', 'Prefetch Templates', 'Review'];

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value
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

  const handleTestConnection = async () => {
    if (!formData.url) {
      setError('Please enter service URL');
      return;
    }

    try {
      setTestingConnection(true);
      setConnectionTestResult(null);
      setError(null);

      // Test connection to external service
      const response = await fetch(formData.url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionTestResult({
          success: true,
          status: response.status,
          message: 'Connection successful'
        });
      } else {
        setConnectionTestResult({
          success: false,
          status: response.status,
          message: `Connection failed: ${response.statusText}`
        });
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionTestResult({
        success: false,
        message: `Connection failed: ${err.message}`
      });
    } finally {
      setTestingConnection(false);
    }
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
        prefetch_template: Object.keys(prefetch_template).length > 0 ? prefetch_template : null,
        credentials_id: formData.credentials_id || null
      };

      await cdsStudioApi.createExternalService(serviceData);

      // Success
      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Failed to register service:', err);
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
      url: '',
      credentials_id: '',
      status: 'draft',
      version_notes: 'Initial registration'
    });
    setPrefetchTemplates([
      { key: 'patient', value: 'Patient/{{context.patientId}}' }
    ]);
    setConnectionTestResult(null);
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
                placeholder="external-cds-service"
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
                placeholder="External CDS Service"
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
                placeholder="Describe what this external service does..."
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
              <CloudIcon />
              <Typography variant="h6">External Endpoint</Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter the HTTP endpoint for your external CDS Hooks service. The service must implement the CDS Hooks 1.0 specification.
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Service URL"
                  value={formData.url}
                  onChange={handleChange('url')}
                  placeholder="https://external-service.example.com/cds-services/my-service"
                  helperText="Complete URL to the CDS service endpoint"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Credentials ID (Optional)"
                  value={formData.credentials_id}
                  onChange={handleChange('credentials_id')}
                  placeholder="credential-123"
                  helperText="Reference to stored credentials for authentication (configure in Credentials Manager)"
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  onClick={handleTestConnection}
                  disabled={!formData.url || testingConnection}
                  startIcon={testingConnection ? <CircularProgress size={20} /> : <CloudIcon />}
                >
                  {testingConnection ? 'Testing Connection...' : 'Test Connection'}
                </Button>
              </Grid>

              {connectionTestResult && (
                <Grid item xs={12}>
                  <Alert
                    severity={connectionTestResult.success ? 'success' : 'error'}
                    icon={connectionTestResult.success ? <CheckIcon /> : undefined}
                  >
                    {connectionTestResult.message}
                    {connectionTestResult.status && ` (HTTP ${connectionTestResult.status})`}
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Prefetch Templates
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Define FHIR resources to pre-fetch before calling the external service. Use template variables like{' '}
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
              Review External Service Registration
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
                <Typography>Endpoint Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Service URL</Typography>
                    <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                      {formData.url}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Credentials</Typography>
                    <Typography variant="body2">
                      {formData.credentials_id || 'None (public endpoint)'}
                    </Typography>
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
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CloudIcon />
          Register External CDS Service
        </Box>
      </DialogTitle>

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
            {loading ? 'Registering...' : 'Register Service'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ExternalServiceDialog;
