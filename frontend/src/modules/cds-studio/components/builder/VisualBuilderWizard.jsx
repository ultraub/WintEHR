/**
 * Visual Builder Wizard
 *
 * Step-by-step wizard for creating CDS services visually.
 * Guides users through:
 * 1. Service Configuration (type, name, description)
 * 2. Condition Building (visual drag-and-drop)
 * 3. Card Design (WYSIWYG editor)
 * 4. Display Configuration (presentation modes)
 * 5. Testing (with synthetic patients)
 * 6. Review & Deploy
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Divider
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as ForwardIcon,
  Save as SaveIcon,
  PlayArrow as TestIcon,
  CheckCircle as DeployIcon
} from '@mui/icons-material';

import ConditionBuilder from '../builders/ConditionBuilder';
import CardDesigner from '../builders/CardDesigner';
import DisplayConfigPanel from '../builders/DisplayConfigPanel';
import CardPreviewPanel from '../preview/CardPreviewPanel';
import ServiceTester from '../testing/ServiceTester';
import { SERVICE_TYPES } from '../../types/serviceTypes';
import axios from 'axios';

const steps = [
  'Service Configuration',
  'Build Conditions',
  'Design Card',
  'Configure Display',
  'Test Service',
  'Review & Deploy'
];

/**
 * Visual Builder Wizard Component
 */
const VisualBuilderWizard = ({ open, onClose, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testResults, setTestResults] = useState(null);

  // Service configuration state
  const [serviceConfig, setServiceConfig] = useState({
    service_id: '',
    name: '',
    description: '',
    service_type: 'condition-based',
    category: 'preventive-care',
    hook_type: 'patient-view',
    conditions: [
      {
        type: 'group',
        operator: 'AND',
        conditions: []
      }
    ],
    card: {
      summary: '',
      detail: '',
      indicator: 'info',
      source: { label: '' },
      suggestions: [],
      links: []
    },
    display_config: {
      presentationMode: 'inline',
      priority: 'medium',
      autoShow: true,
      dismissible: true,
      persistent: false
    },
    prefetch: {},
    created_by: 'current-user' // TODO: Get from auth context
  });

  const [savedServiceId, setSavedServiceId] = useState(null);

  const handleNext = async () => {
    // Validate current step before proceeding
    const validation = validateCurrentStep();
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);

    // Save draft before moving to testing/review steps
    if (activeStep === 3 && !savedServiceId) {
      await handleSaveDraft();
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const validateCurrentStep = () => {
    switch (activeStep) {
      case 0: // Service Configuration
        if (!serviceConfig.service_id) {
          return { valid: false, error: 'Service ID is required' };
        }
        if (!serviceConfig.name) {
          return { valid: false, error: 'Service name is required' };
        }
        break;

      case 1: // Conditions
        if (serviceConfig.conditions.length === 0) {
          return { valid: false, error: 'At least one condition is required' };
        }
        break;

      case 2: // Card Design
        if (!serviceConfig.card.summary) {
          return { valid: false, error: 'Card summary is required' };
        }
        break;

      case 3: // Display Config
        // Display config has defaults, always valid
        break;

      case 4: // Testing
        // Testing is optional but recommended
        break;

      case 5: // Review
        // Final validation before deployment
        break;

      default:
        break;
    }

    return { valid: true };
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        '/api/cds-visual-builder/services',
        serviceConfig
      );

      setSavedServiceId(response.data.id);
      return response.data;
    } catch (err) {
      console.error('Error saving draft:', err);
      setError(err.response?.data?.detail || 'Failed to save service');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);

    try {
      // Save or update service first
      let serviceId = savedServiceId;
      if (!serviceId) {
        const savedService = await handleSaveDraft();
        serviceId = savedService.id;
      }

      // Deploy the service
      await axios.post(
        `/api/cds-visual-builder/services/${serviceId}/deploy`
      );

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Error deploying service:', err);
      setError(err.response?.data?.detail || 'Failed to deploy service');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset wizard state
    setActiveStep(0);
    setServiceConfig({
      service_id: '',
      name: '',
      description: '',
      service_type: 'condition-based',
      category: 'preventive-care',
      hook_type: 'patient-view',
      conditions: [],
      card: {
        summary: '',
        detail: '',
        indicator: 'info',
        source: { label: '' },
        suggestions: [],
        links: []
      },
      display_config: {
        presentationMode: 'inline',
        priority: 'medium',
        autoShow: true,
        dismissible: true,
        persistent: false
      },
      prefetch: {},
      created_by: 'current-user'
    });
    setSavedServiceId(null);
    setTestResults(null);
    setError(null);

    onClose();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderServiceConfiguration();
      case 1:
        return renderConditionBuilder();
      case 2:
        return renderCardDesigner();
      case 3:
        return renderDisplayConfiguration();
      case 4:
        return renderServiceTesting();
      case 5:
        return renderReviewAndDeploy();
      default:
        return null;
    }
  };

  const renderServiceConfiguration = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Service Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Configure basic service information
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Service ID"
            value={serviceConfig.service_id}
            onChange={(e) => setServiceConfig({ ...serviceConfig, service_id: e.target.value })}
            placeholder="my-preventive-care-service"
            helperText="Unique identifier for this service (lowercase, hyphens allowed)"
            required
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Service Name"
            value={serviceConfig.name}
            onChange={(e) => setServiceConfig({ ...serviceConfig, name: e.target.value })}
            placeholder="Preventive Care Reminder"
            required
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={serviceConfig.description}
            onChange={(e) => setServiceConfig({ ...serviceConfig, description: e.target.value })}
            placeholder="Reminds clinicians about overdue preventive care screenings"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Service Type</InputLabel>
            <Select
              value={serviceConfig.service_type}
              onChange={(e) => setServiceConfig({ ...serviceConfig, service_type: e.target.value })}
              label="Service Type"
            >
              {Object.keys(SERVICE_TYPES).map(type => (
                <MenuItem key={type} value={type}>
                  {SERVICE_TYPES[type].label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Hook Type</InputLabel>
            <Select
              value={serviceConfig.hook_type}
              onChange={(e) => setServiceConfig({ ...serviceConfig, hook_type: e.target.value })}
              label="Hook Type"
            >
              <MenuItem value="patient-view">Patient View</MenuItem>
              <MenuItem value="order-select">Order Select</MenuItem>
              <MenuItem value="order-sign">Order Sign</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={serviceConfig.category}
              onChange={(e) => setServiceConfig({ ...serviceConfig, category: e.target.value })}
              label="Category"
            >
              <MenuItem value="preventive-care">Preventive Care</MenuItem>
              <MenuItem value="medication-safety">Medication Safety</MenuItem>
              <MenuItem value="diagnosis-support">Diagnosis Support</MenuItem>
              <MenuItem value="quality-improvement">Quality Improvement</MenuItem>
              <MenuItem value="cost-reduction">Cost Reduction</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  const renderConditionBuilder = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Build Conditions
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Define when this CDS service should trigger
      </Typography>

      <ConditionBuilder
        serviceType={serviceConfig.service_type}
        conditions={serviceConfig.conditions}
        onChange={(conditions) => setServiceConfig({ ...serviceConfig, conditions })}
      />
    </Box>
  );

  const renderCardDesigner = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Design CDS Card
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Design how the alert will appear to clinicians
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <CardDesigner
            value={serviceConfig.card}
            onChange={(card) => setServiceConfig({ ...serviceConfig, card })}
          />
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper elevation={2} sx={{ p: 2, position: 'sticky', top: 16 }}>
            <Typography variant="subtitle2" gutterBottom>
              Live Preview
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <CardPreviewPanel
              card={serviceConfig.card}
              displayConfig={serviceConfig.display_config}
              serviceId={serviceConfig.service_id || 'preview'}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const renderDisplayConfiguration = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure Display Behavior
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Control how the card is presented in the EMR
      </Typography>

      <DisplayConfigPanel
        value={serviceConfig.display_config}
        onChange={(display_config) => setServiceConfig({ ...serviceConfig, display_config })}
      />
    </Box>
  );

  const renderServiceTesting = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Test Your Service
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Test with synthetic patient data before deploying
      </Typography>

      {savedServiceId ? (
        <ServiceTester
          serviceId={savedServiceId}
          serviceName={serviceConfig.name}
          serviceConfig={serviceConfig}
        />
      ) : (
        <Alert severity="info">
          Service will be saved as draft before testing
        </Alert>
      )}
    </Box>
  );

  const renderReviewAndDeploy = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review & Deploy
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Review your service configuration and deploy
      </Typography>

      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary">
              Service Information
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Service ID</Typography>
            <Typography variant="body2">{serviceConfig.service_id}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Name</Typography>
            <Typography variant="body2">{serviceConfig.name}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">Description</Typography>
            <Typography variant="body2">{serviceConfig.description || 'N/A'}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary">
              Configuration
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Service Type</Typography>
            <Typography variant="body2">{SERVICE_TYPES[serviceConfig.service_type]?.label}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Hook Type</Typography>
            <Typography variant="body2">{serviceConfig.hook_type}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Conditions</Typography>
            <Typography variant="body2">{serviceConfig.conditions.length} condition(s)</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Card Preview
        </Typography>
        <CardPreviewPanel
          card={serviceConfig.card}
          displayConfig={serviceConfig.display_config}
          serviceId={serviceConfig.service_id}
        />
      </Paper>

      {testResults && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Service tested successfully with {testResults.cards?.length || 0} card(s) generated
        </Alert>
      )}

      <Alert severity="warning">
        <Typography variant="body2">
          <strong>Ready to deploy?</strong> This will activate the service and make it available in production.
        </Typography>
      </Alert>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        Visual Service Builder
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Step Content */}
        <Box sx={{ minHeight: 400 }}>
          {renderStepContent()}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>

        <Box sx={{ flex: 1 }} />

        {activeStep > 0 && (
          <Button
            startIcon={<BackIcon />}
            onClick={handleBack}
            disabled={loading}
          >
            Back
          </Button>
        )}

        {activeStep < steps.length - 1 && (
          <Button
            variant="contained"
            endIcon={<ForwardIcon />}
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Next'}
          </Button>
        )}

        {activeStep === steps.length - 1 && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<DeployIcon />}
            onClick={handleDeploy}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Deploy Service'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VisualBuilderWizard;
