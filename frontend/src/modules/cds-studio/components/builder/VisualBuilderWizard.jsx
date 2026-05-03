/**
 * Visual Builder Wizard
 *
 * Step-by-step wizard for creating CDS services visually.
 * Guides users through:
 * 1. Service Configuration (type, name, description)
 * 2. Build Logic (visual condition tree OR CQL)
 * 3. Card Design (WYSIWYG editor + suggestion action templates)
 * 4. Prefetch (auto-derived for CQL)
 * 5. Test & Deploy (run against synthetic patients, then deploy)
 *
 * The earlier "Configure Display" step was removed: its data path was broken
 * (prop-name mismatch + no runtime that consumed `display_config`), so it
 * stored values that never affected behavior. The Test and Review steps
 * were also merged — they share the same saved-draft service and the
 * review summary fits naturally above the deploy button.
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
  CheckCircle as DeployIcon
} from '@mui/icons-material';

import ConditionBuilder from '../builders/ConditionBuilder';
import CardDesigner from '../builders/CardDesigner';
import CQLEditor from '../builders/CQLEditor';
import PrefetchEditor from '../builders/PrefetchEditor';
import CardPreviewPanel from '../preview/CardPreviewPanel';
import ServiceTester from '../testing/ServiceTester';
import { SERVICE_TYPES } from '../../types/serviceTypes';
import cdsStudioApi from '../../services/cdsStudioApi';
import { useAuth } from '../../../../contexts/AuthContext';
import axios from 'axios';

const CQL_SERVICE_TYPE = 'cql-based';

// Step 1 label varies by service type — `renderConditionBuilder` renders
// either ConditionBuilder (visual) or CQLEditor (CQL). The step list itself
// uses a single neutral label so the stepper looks the same for both paths.
const steps = [
  'Service Configuration',
  'Build Logic',
  'Design Card',
  'Prefetch',
  'Test & Deploy'
];

// Step indices — referenced by validateCurrentStep, renderStepContent, and
// the auto-save trigger in handleNext.
const STEP_PREFETCH = 3;
const STEP_TEST_DEPLOY = 4;

/**
 * Visual Builder Wizard Component
 */
const VisualBuilderWizard = ({ open, onClose, onSuccess }) => {
  const { user } = useAuth();
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
    // CQL services store their logic here instead of in `conditions`. The
    // backend dispatcher reads `service_type` to decide which path runs.
    cql_source: '',
    card: {
      summary: '',
      detail: '',
      indicator: 'info',
      source: { label: '' },
      suggestions: [],
      links: []
    },
    // Backend Pydantic model (`DisplayConfiguration`) requires
    // `presentationMode`. We send the spec-default `'inline'` so saves
    // succeed; the wizard no longer surfaces display behavior because the
    // EMR runtime reads `card.displayBehavior` / `card.overrideReasons`,
    // not `service.display_config`. If someone wires per-service display
    // behavior into the runtime later, re-add the panel.
    display_config: { presentationMode: 'inline' },
    prefetch: {},
    created_by: user?.username || 'unknown'
  });

  const [savedServiceId, setSavedServiceId] = useState(null);
  const isCQLService = serviceConfig.service_type === CQL_SERVICE_TYPE;

  /**
   * Format error messages for display
   * Handles Pydantic validation errors (arrays of objects) and string errors
   */
  const formatError = (errorDetail) => {
    // Handle Pydantic validation errors (array of {type, loc, msg, input})
    if (Array.isArray(errorDetail)) {
      return errorDetail.map(err => {
        const location = err.loc ? err.loc.join('.') : 'unknown field';
        return `${location}: ${err.msg}`;
      }).join('; ');
    }

    // Handle string errors
    if (typeof errorDetail === 'string') {
      return errorDetail;
    }

    // Handle object errors
    if (errorDetail && typeof errorDetail === 'object') {
      return errorDetail.message || JSON.stringify(errorDetail);
    }

    // Fallback
    return 'An unknown error occurred';
  };

  const handleNext = async () => {
    // Validate current step before proceeding
    const validation = validateCurrentStep();
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);

    // Save draft before moving into Test & Deploy. The testing UI needs a
    // real backend service to invoke, and the FHIR-preview tab in the CQL
    // editor needs to fetch the generated Library + PlanDefinition.
    if (activeStep === STEP_PREFETCH && !savedServiceId) {
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

      case 1: // Build Logic — fork on service type
        if (isCQLService) {
          if (!serviceConfig.cql_source || !serviceConfig.cql_source.trim()) {
            return { valid: false, error: 'CQL is required for cql-based services' };
          }
          if (!/define\s+Applicability\s*:/m.test(serviceConfig.cql_source)) {
            return {
              valid: false,
              error: 'Your CQL must define Applicability — a Boolean expression that decides when the card fires.',
            };
          }
        } else if (serviceConfig.conditions.length === 0) {
          return { valid: false, error: 'At least one condition is required' };
        }
        break;

      case 2: // Card Design
        if (!serviceConfig.card.summary) {
          return { valid: false, error: 'Card summary is required' };
        }
        break;

      case 3: // Prefetch
        // Optional — empty prefetch is valid (services that only need patient context)
        break;

      case 4: // Test & Deploy
        // Test panel is optional but recommended; final validation happens at deploy time
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
      const errorMessage = formatError(err.response?.data?.detail) || 'Failed to save service';
      setError(errorMessage);
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

      // Deploy the service (send empty object for ServiceDeploymentRequest)
      await axios.post(
        `/api/cds-visual-builder/services/${serviceId}/deploy`,
        {}  // Required: ServiceDeploymentRequest body (deployed_by and notes are optional)
      );

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Error deploying service:', err);
      const errorMessage = formatError(err.response?.data?.detail) || 'Failed to deploy service';
      setError(errorMessage);
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
      cql_source: '',
      card: {
        summary: '',
        detail: '',
        indicator: 'info',
        source: { label: '' },
        suggestions: [],
        links: []
      },
      display_config: { presentationMode: 'inline' },
      prefetch: {},
      created_by: user?.username || 'unknown'
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
      case STEP_PREFETCH:
        return renderPrefetch();
      case STEP_TEST_DEPLOY:
        return renderTestAndDeploy();
      default:
        return null;
    }
  };

  const renderPrefetch = () => (
    <PrefetchEditor
      value={serviceConfig.prefetch || {}}
      onChange={(prefetch) => setServiceConfig({ ...serviceConfig, prefetch })}
      // Pass cqlSource only for CQL services so the "Re-derive" button
      // appears; visual services don't have it.
      cqlSource={isCQLService ? serviceConfig.cql_source : undefined}
    />
  );

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
              {/* Use the service type's `id` (kebab-case) as the value so it
                  matches what the backend expects. The previous code used the
                  JS object key (UPPER_SNAKE_CASE), which the backend silently
                  accepted but mis-routed dispatch. */}
              {Object.keys(SERVICE_TYPES).map(typeKey => (
                <MenuItem key={typeKey} value={SERVICE_TYPES[typeKey].id}>
                  {SERVICE_TYPES[typeKey].icon ? `${SERVICE_TYPES[typeKey].icon} ` : ''}
                  {SERVICE_TYPES[typeKey].label}
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

  const renderConditionBuilder = () => {
    if (isCQLService) {
      return (
        <Box>
          <Typography variant="h6" gutterBottom>
            Write CQL
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Author your rule in Clinical Quality Language. The bridge generates
            a FHIR Library and PlanDefinition behind the scenes; HAPI evaluates
            them via the <code>$apply</code> operation when the hook fires.
          </Typography>

          <CQLEditor
            value={serviceConfig.cql_source}
            onChange={(cql) => setServiceConfig({ ...serviceConfig, cql_source: cql })}
            // The editor renders its own ValueSet Composer modal when
            // `onOpenValueSetComposer` isn't provided. Override here only
            // if a different host wants to control the modal externally.
            onLoadFHIRPreview={async () => {
              if (!savedServiceId) return null;
              return cdsStudioApi.getServiceFHIRPreview(serviceConfig.service_id);
            }}
          />
        </Box>
      );
    }

    return (
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
  };

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
            card={serviceConfig.card}
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

  const renderTestAndDeploy = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Test & Deploy
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Run the saved draft against synthetic patients, then deploy when ready.
      </Typography>

      {savedServiceId ? (
        <Box sx={{ mb: 3 }}>
          <ServiceTester
            serviceId={savedServiceId}
            serviceName={serviceConfig.name}
            serviceConfig={serviceConfig}
          />
        </Box>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          Service will be saved as draft before testing.
        </Alert>
      )}

      {testResults && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Service tested successfully with {testResults.cards?.length || 0} card(s) generated
        </Alert>
      )}

      {/* Review summary — combines what used to be a separate Review step */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary">
              Service Summary
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
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Service Type</Typography>
            {/* SERVICE_TYPES is keyed by UPPER_SNAKE_CASE; serviceConfig.service_type
                is kebab-case ids — find the matching entry by id. */}
            <Typography variant="body2">
              {Object.values(SERVICE_TYPES).find((t) => t.id === serviceConfig.service_type)?.label
                || serviceConfig.service_type}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Hook Type</Typography>
            <Typography variant="body2">{serviceConfig.hook_type}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Logic</Typography>
            <Typography variant="body2">
              {isCQLService
                ? `CQL (${(serviceConfig.cql_source || '').split('\n').length} lines)`
                : `${serviceConfig.conditions.length} condition(s)`}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Prefetch</Typography>
            <Typography variant="body2">
              {Object.keys(serviceConfig.prefetch || {}).length} template(s)
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">Suggestions</Typography>
            <Typography variant="body2">
              {(serviceConfig.card.suggestions || []).length}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Card Preview
        </Typography>
        <CardPreviewPanel
          card={serviceConfig.card}
          serviceId={serviceConfig.service_id}
        />
      </Paper>

      <Alert severity="warning">
        <Typography variant="body2">
          <strong>Ready to deploy?</strong> Click <em>Deploy Service</em> to activate this service.
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
