/**
 * Template Service Builder
 *
 * Allows customization of pre-built service templates.
 * Users can modify conditions, card content, and display settings
 * while maintaining the template's core structure.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Stack,
  Alert,
  Chip,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';

import ConditionBuilder from '../builders/ConditionBuilder';
import CardDesigner from '../builders/CardDesigner';
import DisplayConfigPanel from '../builders/DisplayConfigPanel';

/**
 * Template Customization Wizard Component
 */
const TemplateServiceBuilder = ({
  template,
  onSave,
  onCancel
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [serviceConfig, setServiceConfig] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [loadingError, setLoadingError] = useState(null);

  // Initialize service config from template
  useEffect(() => {
    if (!template) {
      setLoadingError('No template provided');
      return;
    }

    try {
      // Validate template structure
      if (!template.serviceConfig) {
        throw new Error('Template is missing serviceConfig');
      }

      setServiceConfig({
        ...template.serviceConfig,
        // Add metadata
        name: template.name || '',
        description: template.description || '',
        category: template.category || 'general',
        templateId: template.id,
        // Ensure conditions array has proper structure
        conditions: template.serviceConfig.conditions || [
          {
            type: 'group',
            operator: 'AND',
            conditions: []
          }
        ]
      });
      setLoadingError(null);
    } catch (error) {
      console.error('Error initializing template:', error);
      setLoadingError(error.message);
    }
  }, [template]);

  // Show loading error if template failed to load
  if (loadingError) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load template: {loadingError}
        </Alert>
        <Button onClick={onCancel} startIcon={<BackIcon />}>
          Back to Gallery
        </Button>
      </Box>
    );
  }

  // Show loading state
  if (!serviceConfig) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
        <Alert severity="info">Loading template...</Alert>
        <Button onClick={onCancel} size="small">
          Cancel
        </Button>
      </Box>
    );
  }

  const steps = [
    {
      label: 'Service Information',
      description: 'Basic service details and configuration'
    },
    {
      label: 'Customize Conditions',
      description: 'Modify clinical logic and triggers'
    },
    {
      label: 'Design Card',
      description: 'Customize alert content and suggestions'
    },
    {
      label: 'Configure Display',
      description: 'Set EMR display behavior'
    },
    {
      label: 'Review & Save',
      description: 'Review configuration and deploy'
    }
  ];

  const handleNext = () => {
    // Validate current step
    const errors = validateStep(activeStep);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setValidationErrors([]);
  };

  const handleSave = () => {
    // Final validation
    const errors = validateAllSteps();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    onSave(serviceConfig);
  };

  const validateStep = (step) => {
    const errors = [];

    switch (step) {
      case 0: // Service Information
        if (!serviceConfig.title || serviceConfig.title.trim() === '') {
          errors.push('Service title is required');
        }
        if (!serviceConfig.description || serviceConfig.description.trim() === '') {
          errors.push('Service description is required');
        }
        break;

      case 1: // Conditions
        if (!serviceConfig.conditions || serviceConfig.conditions.length === 0) {
          errors.push('At least one condition is required');
        } else if (serviceConfig.conditions[0] && serviceConfig.conditions[0].type === 'group') {
          // Check if the root group has any actual conditions
          const rootGroup = serviceConfig.conditions[0];
          if (!rootGroup.conditions || rootGroup.conditions.length === 0) {
            errors.push('Please add at least one condition to the rule');
          }
        }
        break;

      case 2: // Card
        if (!serviceConfig.card.summary || serviceConfig.card.summary.trim() === '') {
          errors.push('Card summary is required');
        }
        break;

      case 3: // Display
        if (!serviceConfig.displayConfig.presentationMode) {
          errors.push('Presentation mode is required');
        }
        break;

      default:
        break;
    }

    return errors;
  };

  const validateAllSteps = () => {
    let allErrors = [];
    for (let i = 0; i < steps.length - 1; i++) {
      allErrors = [...allErrors, ...validateStep(i)];
    }
    return allErrors;
  };

  const updateServiceInfo = (field, value) => {
    setServiceConfig({
      ...serviceConfig,
      [field]: value
    });
  };

  const updateConditions = (conditions) => {
    setServiceConfig({
      ...serviceConfig,
      conditions
    });
  };

  const updateCard = (card) => {
    setServiceConfig({
      ...serviceConfig,
      card
    });
  };

  const updateDisplayConfig = (displayConfig) => {
    setServiceConfig({
      ...serviceConfig,
      displayConfig
    });
  };

  return (
    <Box>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Typography variant="h5">Customize Template</Typography>
          <Chip label={template.category} color="primary" />
          <Chip label={template.difficulty} size="small" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Based on: <strong>{template.name}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          You can modify any aspect of this template to fit your specific needs
        </Typography>
      </Paper>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            Please fix the following errors:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.map((error, index) => (
              <li key={index}>
                <Typography variant="caption">{error}</Typography>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Stepper */}
      <Stepper activeStep={activeStep} orientation="vertical">
        {/* Step 0: Service Information */}
        <Step>
          <StepLabel>
            {steps[0].label}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" paragraph>
              {steps[0].description}
            </Typography>

            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Service Title"
                value={serviceConfig.title}
                onChange={(e) => updateServiceInfo('title', e.target.value)}
                required
                helperText="Short, descriptive title for this CDS service"
              />

              <TextField
                fullWidth
                label="Description"
                value={serviceConfig.description}
                onChange={(e) => updateServiceInfo('description', e.target.value)}
                multiline
                rows={3}
                required
                helperText="Detailed description of what this service does"
              />

              <FormControl fullWidth>
                <InputLabel>Hook Type</InputLabel>
                <Select
                  value={serviceConfig.hook}
                  label="Hook Type"
                  onChange={(e) => updateServiceInfo('hook', e.target.value)}
                >
                  <MenuItem value="patient-view">Patient View</MenuItem>
                  <MenuItem value="medication-prescribe">Medication Prescribe</MenuItem>
                  <MenuItem value="order-select">Order Select</MenuItem>
                  <MenuItem value="order-sign">Order Sign</MenuItem>
                  <MenuItem value="encounter-start">Encounter Start</MenuItem>
                  <MenuItem value="encounter-discharge">Encounter Discharge</MenuItem>
                </Select>
              </FormControl>

              <Alert severity="info">
                <Typography variant="caption">
                  <strong>Template Base:</strong> {template.name}<br />
                  <strong>Recommended Use:</strong> {template.useCase}
                </Typography>
              </Alert>
            </Stack>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<EditIcon />}
              >
                Continue to Conditions
              </Button>
              <Button onClick={onCancel} sx={{ ml: 1 }}>
                Cancel
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 1: Customize Conditions */}
        <Step>
          <StepLabel>
            {steps[1].label}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" paragraph>
              {steps[1].description}
            </Typography>

            <ConditionBuilder
              conditions={serviceConfig.conditions}
              onChange={updateConditions}
              serviceType={serviceConfig.type}
            />

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<EditIcon />}
              >
                Continue to Card Design
              </Button>
              <Button onClick={handleBack} sx={{ ml: 1 }} startIcon={<BackIcon />}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 2: Design Card */}
        <Step>
          <StepLabel>
            {steps[2].label}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" paragraph>
              {steps[2].description}
            </Typography>

            <CardDesigner
              card={serviceConfig.card}
              onChange={updateCard}
            />

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<EditIcon />}
              >
                Continue to Display Config
              </Button>
              <Button onClick={handleBack} sx={{ ml: 1 }} startIcon={<BackIcon />}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 3: Configure Display */}
        <Step>
          <StepLabel>
            {steps[3].label}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" paragraph>
              {steps[3].description}
            </Typography>

            <DisplayConfigPanel
              config={serviceConfig.displayConfig}
              onChange={updateDisplayConfig}
              cardIndicator={serviceConfig.card.indicator}
            />

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<PreviewIcon />}
              >
                Review Configuration
              </Button>
              <Button onClick={handleBack} sx={{ ml: 1 }} startIcon={<BackIcon />}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 4: Review & Save */}
        <Step>
          <StepLabel>
            {steps[4].label}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" paragraph>
              {steps[4].description}
            </Typography>

            <Stack spacing={3}>
              {/* Service Summary */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Service Configuration Summary
                </Typography>
                <Divider sx={{ my: 1 }} />

                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Title:
                    </Typography>
                    <Typography variant="body2">{serviceConfig.title}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Hook Type:
                    </Typography>
                    <Typography variant="body2">{serviceConfig.hook}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Conditions:
                    </Typography>
                    <Typography variant="body2">
                      {serviceConfig.conditions[0]?.conditions?.length || 0} condition(s) configured
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Card Indicator:
                    </Typography>
                    <Chip label={serviceConfig.card.indicator} size="small" />
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Presentation Mode:
                    </Typography>
                    <Typography variant="body2">{serviceConfig.displayConfig.presentationMode}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Suggestions:
                    </Typography>
                    <Typography variant="body2">
                      {serviceConfig.card.suggestions?.length || 0} suggestion(s)
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Template Attribution */}
              <Alert severity="info">
                <Typography variant="caption">
                  <strong>Based on Template:</strong> {template.name}<br />
                  <strong>Category:</strong> {template.category}<br />
                  <strong>Original Use Case:</strong> {template.useCase}
                </Typography>
              </Alert>

              {/* Ready to Deploy */}
              <Alert severity="success" icon={<CheckIcon />}>
                <Typography variant="body2">
                  Configuration complete! Your service is ready to deploy.
                </Typography>
              </Alert>
            </Stack>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="success"
                onClick={handleSave}
                startIcon={<SaveIcon />}
              >
                Save & Deploy Service
              </Button>
              <Button onClick={handleBack} sx={{ ml: 1 }} startIcon={<BackIcon />}>
                Back
              </Button>
              <Button onClick={onCancel} sx={{ ml: 1 }}>
                Cancel
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>

      {/* Completion Message */}
      {activeStep === steps.length && (
        <Paper square elevation={0} sx={{ p: 3 }}>
          <Typography>All steps completed - service configuration ready!</Typography>
          <Button onClick={() => setActiveStep(0)} sx={{ mt: 1, mr: 1 }}>
            Reset
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default TemplateServiceBuilder;
