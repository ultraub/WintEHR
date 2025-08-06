/**
 * CDS Hooks Validator Component
 * Visual validator for CDS Hooks services against the 1.0 specification
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  AlertTitle,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Stack,
  TextField,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Card,
  CardContent,
  Badge
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  PlayArrow as TestIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { 
  validateCompleteService, 
  validateCDSRequest,
  validateCDSResponse,
  validateCDSCard
} from '../../../utils/cdsHooksValidator';
import { cdsHooksService } from '../../../services/cdsHooksService';
import { cdsHooksClient } from '../../../services/cdsHooksClient';

const CDSHooksValidator = ({ service, onValidationComplete }) => {
  const [validationResult, setValidationResult] = useState(null);
  const [testRequest, setTestRequest] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testing, setTesting] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    definition: true,
    prefetch: false,
    request: false,
    response: false
  });

  useEffect(() => {
    if (service) {
      validateService();
    }
  }, [service]);

  const validateService = () => {
    const result = validateCompleteService(service);
    setValidationResult(result);
    
    if (onValidationComplete) {
      onValidationComplete(result);
    }

    // Generate example request
    const exampleRequest = {
      hookInstance: `validator-${Date.now()}`,
      hook: service.hook,
      context: generateExampleContext(service.hook),
      fhirServer: 'http://localhost:8000/fhir/R4'
    };
    setTestRequest(JSON.stringify(exampleRequest, null, 2));
  };

  const generateExampleContext = (hook) => {
    const baseContext = {
      userId: 'test-user',
      patientId: 'test-patient-123'
    };

    switch (hook) {
      case 'medication-prescribe':
        return {
          ...baseContext,
          medications: [{
            resourceType: 'MedicationRequest',
            id: 'test-med-1',
            status: 'draft',
            intent: 'order',
            medicationCodeableConcept: {
              text: 'Aspirin 81mg'
            }
          }]
        };
      
      case 'order-select':
      case 'order-sign':
        return {
          ...baseContext,
          draftOrders: [{
            resourceType: 'ServiceRequest',
            id: 'test-order-1',
            status: 'draft'
          }]
        };
      
      case 'encounter-start':
      case 'encounter-discharge':
        return {
          ...baseContext,
          encounterId: 'test-encounter-123'
        };
      
      default:
        return baseContext;
    }
  };

  const testService = async () => {
    setTesting(true);
    try {
      const request = JSON.parse(testRequest);
      
      // Validate request
      const requestValidation = validateCDSRequest(request);
      if (!requestValidation.isValid) {
        setTestResponse(JSON.stringify({
          error: 'Invalid request',
          validation: requestValidation
        }, null, 2));
        return;
      }

      // Test the service
      const response = await cdsHooksClient.executeHook(service.id, request);
      setTestResponse(JSON.stringify(response, null, 2));

      // Validate response
      const responseValidation = validateCDSResponse(response);
      if (!responseValidation.isValid) {
        setTestResponse(prev => prev + '\n\n// VALIDATION ERRORS:\n' + 
          JSON.stringify(responseValidation, null, 2));
      }
    } catch (error) {
      setTestResponse(JSON.stringify({
        error: error.message,
        stack: error.stack
      }, null, 2));
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const downloadReport = () => {
    const report = {
      service: service,
      validation: validationResult,
      testRequest: testRequest,
      testResponse: testResponse,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cds-hooks-validation-${service.id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSeverityIcon = (errors, warnings) => {
    if (errors > 0) return <ErrorIcon color="error" />;
    if (warnings > 0) return <WarningIcon color="warning" />;
    return <CheckIcon color="success" />;
  };

  const getSeverityColor = (errors, warnings) => {
    if (errors > 0) return 'error';
    if (warnings > 0) return 'warning';
    return 'success';
  };

  if (!service) {
    return (
      <Alert severity="info">
        Select a service to validate
      </Alert>
    );
  }

  if (!validationResult) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Overall Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" gutterBottom>
              CDS Hooks Validation Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Service: <strong>{service.id}</strong> - {service.title || 'Untitled'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Chip
              icon={getSeverityIcon(
                validationResult.overall.errors.length,
                validationResult.overall.warnings.length
              )}
              label={validationResult.overall.isValid ? 'Valid' : 'Invalid'}
              color={getSeverityColor(
                validationResult.overall.errors.length,
                validationResult.overall.warnings.length
              )}
            />
            <Tooltip title="Download Report">
              <IconButton onClick={downloadReport}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Re-validate">
              <IconButton onClick={validateService}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Badge badgeContent={validationResult.overall.errors.length} color="error">
            <Chip label="Errors" color="error" variant="outlined" />
          </Badge>
          <Badge badgeContent={validationResult.overall.warnings.length} color="warning">
            <Chip label="Warnings" color="warning" variant="outlined" />
          </Badge>
        </Stack>
      </Paper>

      {/* Service Definition Validation */}
      <Accordion 
        expanded={expandedSections.definition}
        onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, definition: expanded }))}
      >
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
            {getSeverityIcon(
              validationResult.definition.errors.length,
              validationResult.definition.warnings.length
            )}
            <Typography>Service Definition</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Chip 
              label={`${validationResult.definition.errors.length} errors`} 
              size="small" 
              color="error"
              sx={{ display: validationResult.definition.errors.length ? 'flex' : 'none' }}
            />
            <Chip 
              label={`${validationResult.definition.warnings.length} warnings`} 
              size="small" 
              color="warning"
              sx={{ display: validationResult.definition.warnings.length ? 'flex' : 'none' }}
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {validationResult.definition.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>Errors</AlertTitle>
              <List dense>
                {validationResult.definition.errors.map((error, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <ErrorIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={error} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {validationResult.definition.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Warnings</AlertTitle>
              <List dense>
                {validationResult.definition.warnings.map((warning, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <WarningIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={warning} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {validationResult.definition.errors.length === 0 && 
           validationResult.definition.warnings.length === 0 && (
            <Alert severity="success">
              Service definition is fully compliant with CDS Hooks 1.0 specification
            </Alert>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Prefetch Validation */}
      {service.prefetch && Object.keys(service.prefetch).length > 0 && (
        <Accordion
          expanded={expandedSections.prefetch}
          onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, prefetch: expanded }))}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Stack direction="row" spacing={2} alignItems="center">
              <InfoIcon color="primary" />
              <Typography>Prefetch Templates</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {Object.entries(validationResult.prefetch).map(([key, validation]) => (
                <ListItem key={key}>
                  <ListItemIcon>
                    {getSeverityIcon(validation.errors.length, validation.warnings.length)}
                  </ListItemIcon>
                  <ListItemText
                    primary={key}
                    secondary={
                      <Box>
                        <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace' }}>
                          {service.prefetch[key]}
                        </Typography>
                        {validation.placeholders && validation.placeholders.length > 0 && (
                          <Typography variant="caption" color="primary">
                            Placeholders: {validation.placeholders.join(', ')}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Request/Response Testing */}
      <Accordion
        expanded={expandedSections.request}
        onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, request: expanded }))}
      >
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TestIcon color="primary" />
            <Typography>Test Service</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Test Request</Typography>
                <IconButton size="small" onClick={() => copyToClipboard(testRequest)}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Stack>
              <TextField
                multiline
                rows={10}
                fullWidth
                value={testRequest}
                onChange={(e) => setTestRequest(e.target.value)}
                sx={{ fontFamily: 'monospace' }}
              />
            </Box>

            <Button
              variant="contained"
              startIcon={testing ? <CircularProgress size={20} /> : <TestIcon />}
              onClick={testService}
              disabled={testing}
              fullWidth
            >
              {testing ? 'Testing...' : 'Test Service'}
            </Button>

            {testResponse && (
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">Test Response</Typography>
                  <IconButton size="small" onClick={() => copyToClipboard(testResponse)}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField
                  multiline
                  rows={10}
                  fullWidth
                  value={testResponse}
                  InputProps={{ readOnly: true }}
                  sx={{ fontFamily: 'monospace' }}
                />
              </Box>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default CDSHooksValidator;