import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  CloudDownload as DiscoveryIcon,
  ExpandMore as ExpandIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  VpnKey as CredentialsIcon
} from '@mui/icons-material';
import cdsStudioApi from '../services/cdsStudioApi';

const DiscoveryImportDialog = ({ open, onClose, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Discovery state
  const [discoveryUrl, setDiscoveryUrl] = useState('');
  const [discoveredServices, setDiscoveredServices] = useState([]);
  const [discoveryResult, setDiscoveryResult] = useState(null);

  // Selection state
  const [selectedServices, setSelectedServices] = useState(new Set());

  // Import state
  const [credentialsId, setCredentialsId] = useState('');
  const [importStatus, setImportStatus] = useState('draft');
  const [importResults, setImportResults] = useState([]);

  const steps = ['Discovery Endpoint', 'Service Selection', 'Import'];

  const handleDiscovery = async () => {
    if (!discoveryUrl) {
      setError('Please enter a discovery endpoint URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch CDS Hooks discovery endpoint
      const response = await fetch(discoveryUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.services || !Array.isArray(data.services)) {
        throw new Error('Invalid discovery response: missing services array');
      }

      setDiscoveredServices(data.services);
      setDiscoveryResult({
        success: true,
        serviceCount: data.services.length,
        url: discoveryUrl
      });

      // Auto-advance to next step if services found
      if (data.services.length > 0) {
        setActiveStep(1);
      }
    } catch (err) {
      console.error('Discovery failed:', err);
      setDiscoveryResult({
        success: false,
        error: err.message
      });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (serviceId) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedServices.size === discoveredServices.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(discoveredServices.map(s => s.id)));
    }
  };

  const handleImport = async () => {
    if (selectedServices.size === 0) {
      setError('Please select at least one service to import');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setImportResults([]);

      const results = [];

      // Import each selected service
      for (const serviceId of selectedServices) {
        const service = discoveredServices.find(s => s.id === serviceId);

        try {
          // Prepare service data for import
          const serviceData = {
            service_id: service.id,
            title: service.title,
            description: service.description || '',
            hook_type: service.hook,
            url: `${discoveryUrl.replace(/\/cds-services$/, '')}/${service.id}`,
            prefetch_template: service.prefetch || null,
            credentials_id: credentialsId || null,
            status: importStatus,
            version_notes: `Imported from ${discoveryUrl}`
          };

          await cdsStudioApi.createExternalService(serviceData);

          results.push({
            serviceId: service.id,
            success: true,
            message: 'Imported successfully'
          });
        } catch (err) {
          results.push({
            serviceId: service.id,
            success: false,
            message: err.message
          });
        }
      }

      setImportResults(results);

      // Check if all imports succeeded
      const allSucceeded = results.every(r => r.success);

      if (allSucceeded) {
        setTimeout(() => {
          onSuccess?.();
          handleClose();
        }, 2000);
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      handleDiscovery();
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleClose = () => {
    // Reset state
    setActiveStep(0);
    setDiscoveryUrl('');
    setDiscoveredServices([]);
    setDiscoveryResult(null);
    setSelectedServices(new Set());
    setCredentialsId('');
    setImportStatus('draft');
    setImportResults([]);
    setError(null);
    onClose();
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <DiscoveryIcon />
              <Typography variant="h6">CDS Hooks Discovery</Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              Enter the URL of a CDS Hooks discovery endpoint (e.g., https://example.com/cds-services).
              The discovery endpoint will return a list of available CDS services that can be imported.
            </Alert>

            <TextField
              fullWidth
              required
              label="Discovery Endpoint URL"
              value={discoveryUrl}
              onChange={(e) => setDiscoveryUrl(e.target.value)}
              placeholder="https://example.com/cds-services"
              helperText="Complete URL to the CDS Hooks discovery endpoint"
              sx={{ mb: 2 }}
            />

            {discoveryResult && (
              <Alert
                severity={discoveryResult.success ? 'success' : 'error'}
                icon={discoveryResult.success ? <SuccessIcon /> : <ErrorIcon />}
              >
                {discoveryResult.success ? (
                  <>
                    Successfully discovered {discoveryResult.serviceCount} service(s) from{' '}
                    <strong>{discoveryResult.url}</strong>
                  </>
                ) : (
                  <>Discovery failed: {discoveryResult.error}</>
                )}
              </Alert>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">
                Select Services to Import ({selectedServices.size} of {discoveredServices.length} selected)
              </Typography>
              <Button size="small" onClick={handleSelectAll}>
                {selectedServices.size === discoveredServices.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>

            {discoveredServices.length === 0 ? (
              <Alert severity="warning">
                No services discovered. Please go back and enter a valid discovery endpoint.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedServices.size === discoveredServices.length && discoveredServices.length > 0}
                          indeterminate={selectedServices.size > 0 && selectedServices.size < discoveredServices.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>Service ID</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Hook</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {discoveredServices.map((service) => (
                      <TableRow
                        key={service.id}
                        hover
                        onClick={() => handleServiceToggle(service.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedServices.has(service.id)} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {service.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{service.title}</TableCell>
                        <TableCell>
                          <Chip label={service.hook} size="small" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {service.description || 'No description'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Import Configuration
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              Configure import settings for the {selectedServices.size} selected service(s).
            </Alert>

            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Credentials ID (Optional)"
                value={credentialsId}
                onChange={(e) => setCredentialsId(e.target.value)}
                placeholder="credential-123"
                helperText="Reference to stored credentials for authentication (configure in Credentials Manager)"
                InputProps={{
                  startAdornment: <CredentialsIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Initial Status
              </Typography>
              <Box display="flex" gap={1}>
                <Chip
                  label="Draft"
                  onClick={() => setImportStatus('draft')}
                  color={importStatus === 'draft' ? 'primary' : 'default'}
                  variant={importStatus === 'draft' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Active"
                  onClick={() => setImportStatus('active')}
                  color={importStatus === 'active' ? 'success' : 'default'}
                  variant={importStatus === 'active' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Inactive"
                  onClick={() => setImportStatus('inactive')}
                  color={importStatus === 'inactive' ? 'default' : 'default'}
                  variant={importStatus === 'inactive' ? 'filled' : 'outlined'}
                />
              </Box>
            </Box>

            {importResults.length > 0 && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Typography>Import Results</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    {importResults.map((result, index) => (
                      <Alert
                        key={index}
                        severity={result.success ? 'success' : 'error'}
                        icon={result.success ? <SuccessIcon /> : <ErrorIcon />}
                        sx={{ mb: 1 }}
                      >
                        <strong>{result.serviceId}</strong>: {result.message}
                      </Alert>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}

            {importResults.length === 0 && (
              <Alert severity="warning">
                Ready to import {selectedServices.size} service(s). Click "Import Services" to proceed.
              </Alert>
            )}
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
          <DiscoveryIcon />
          Import Services from Discovery Endpoint
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
          {importResults.length > 0 && importResults.every(r => r.success) ? 'Close' : 'Cancel'}
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading || (activeStep === 0 && !discoveryUrl)}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Discovering...' : activeStep === 0 ? 'Discover Services' : 'Next'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={loading || selectedServices.size === 0 || importResults.length > 0}
            startIcon={loading ? <CircularProgress size={20} /> : <DiscoveryIcon />}
          >
            {loading ? 'Importing...' : 'Import Services'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DiscoveryImportDialog;
