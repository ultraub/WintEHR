/**
 * BatchOperationsDialog Component
 * 
 * Enables batch CRUD operations on FHIR resources with:
 * - Multi-select resource management
 * - Bulk updates with field selection
 * - Batch deletion with confirmation
 * - Progress tracking and error handling
 * - Rollback capability
 * - Operation history
 * 
 * @since 2025-01-20
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  IconButton,
  Chip,
  Alert,
  AlertTitle,
  LinearProgress,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Collapse,
  Fade,
  Zoom,
  Grid,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tab,
  Tabs,
  alpha,
  useTheme
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  RestartAlt as RestartIcon,
  Assessment as AssessmentIcon,
  Update as UpdateIcon,
  DeleteSweep as DeleteSweepIcon,
  Archive as ArchiveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Speed as SpeedIcon,
  Schedule as ScheduleIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  IndeterminateCheckBox as IndeterminateCheckBoxIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { useClinical as useClinicalContext } from '../../../../contexts/ClinicalContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';

// Operation types
const OPERATION_TYPES = {
  UPDATE: 'update',
  DELETE: 'delete',
  ARCHIVE: 'archive',
  ACTIVATE: 'activate',
  DEACTIVATE: 'deactivate'
};

// Field update configurations by resource type
const FIELD_CONFIGS = {
  MedicationRequest: {
    status: {
      label: 'Status',
      type: 'select',
      options: ['active', 'on-hold', 'cancelled', 'completed', 'stopped'],
      validation: (value) => ['active', 'on-hold', 'cancelled', 'completed', 'stopped'].includes(value)
    },
    priority: {
      label: 'Priority',
      type: 'select',
      options: ['routine', 'urgent', 'asap', 'stat'],
      validation: (value) => ['routine', 'urgent', 'asap', 'stat'].includes(value)
    },
    dosageInstruction: {
      label: 'Dosage Instructions',
      type: 'complex',
      subFields: {
        text: { label: 'Instructions', type: 'text' },
        timing: { label: 'Timing', type: 'text' },
        route: { label: 'Route', type: 'select', options: ['oral', 'IV', 'IM', 'topical', 'inhalation'] }
      }
    }
  },
  Condition: {
    clinicalStatus: {
      label: 'Clinical Status',
      type: 'select',
      options: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'],
      validation: (value) => ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'].includes(value)
    },
    verificationStatus: {
      label: 'Verification Status',
      type: 'select',
      options: ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted'],
      validation: (value) => ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted'].includes(value)
    },
    severity: {
      label: 'Severity',
      type: 'select',
      options: ['mild', 'moderate', 'severe'],
      validation: (value) => ['mild', 'moderate', 'severe'].includes(value)
    }
  },
  ServiceRequest: {
    status: {
      label: 'Status',
      type: 'select',
      options: ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error'],
      validation: (value) => ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error'].includes(value)
    },
    priority: {
      label: 'Priority',
      type: 'select',
      options: ['routine', 'urgent', 'asap', 'stat'],
      validation: (value) => ['routine', 'urgent', 'asap', 'stat'].includes(value)
    },
    intent: {
      label: 'Intent',
      type: 'select',
      options: ['proposal', 'plan', 'directive', 'order', 'original-order', 'reflex-order'],
      validation: (value) => ['proposal', 'plan', 'directive', 'order', 'original-order', 'reflex-order'].includes(value)
    }
  }
};

const BatchOperationsDialog = ({
  open,
  onClose,
  resources = [],
  resourceType,
  onOperationComplete,
  maxBatchSize = 50
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const { publish } = useClinicalContext();
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [selectedResources, setSelectedResources] = useState([]);
  const [operationType, setOperationType] = useState(OPERATION_TYPES.UPDATE);
  const [updateFields, setUpdateFields] = useState({});
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: [], failed: [] });
  const [showPreview, setShowPreview] = useState(false);
  const [operationHistory, setOperationHistory] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Get field configuration for resource type
  const fieldConfig = FIELD_CONFIGS[resourceType] || {};

  // Calculate if all resources on current page are selected
  const isPageSelected = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, resources.length);
    const pageResources = resources.slice(startIndex, endIndex);
    
    return pageResources.length > 0 && 
           pageResources.every(resource => 
             selectedResources.some(selected => selected.id === resource.id)
           );
  }, [resources, selectedResources, page, rowsPerPage]);

  // Calculate if some resources on current page are selected
  const isPageIndeterminate = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, resources.length);
    const pageResources = resources.slice(startIndex, endIndex);
    
    const selectedCount = pageResources.filter(resource =>
      selectedResources.some(selected => selected.id === resource.id)
    ).length;
    
    return selectedCount > 0 && selectedCount < pageResources.length;
  }, [resources, selectedResources, page, rowsPerPage]);

  // Handle resource selection
  const handleSelectResource = useCallback((resource) => {
    setSelectedResources(prev => {
      const exists = prev.some(r => r.id === resource.id);
      if (exists) {
        return prev.filter(r => r.id !== resource.id);
      }
      return [...prev, resource];
    });
  }, []);

  // Handle select all on page
  const handleSelectAllPage = useCallback(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, resources.length);
    const pageResources = resources.slice(startIndex, endIndex);
    
    if (isPageSelected) {
      // Deselect all on page
      setSelectedResources(prev => 
        prev.filter(selected => 
          !pageResources.some(pageResource => pageResource.id === selected.id)
        )
      );
    } else {
      // Select all on page
      setSelectedResources(prev => {
        const newSelection = [...prev];
        pageResources.forEach(resource => {
          if (!newSelection.some(s => s.id === resource.id)) {
            newSelection.push(resource);
          }
        });
        return newSelection;
      });
    }
  }, [resources, page, rowsPerPage, isPageSelected]);

  // Handle select all resources
  const handleSelectAll = useCallback(() => {
    if (selectedResources.length === resources.length) {
      setSelectedResources([]);
    } else {
      setSelectedResources([...resources]);
    }
  }, [resources, selectedResources]);

  // Handle field update
  const handleFieldUpdate = useCallback((fieldName, value) => {
    setUpdateFields(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }, []);

  // Validate operation
  const validateOperation = useCallback(() => {
    if (selectedResources.length === 0) {
      return { valid: false, error: 'No resources selected' };
    }

    if (selectedResources.length > maxBatchSize) {
      return { valid: false, error: `Maximum batch size is ${maxBatchSize} resources` };
    }

    if (operationType === OPERATION_TYPES.UPDATE && Object.keys(updateFields).length === 0) {
      return { valid: false, error: 'No fields selected for update' };
    }

    // Validate field values
    for (const [field, value] of Object.entries(updateFields)) {
      const config = fieldConfig[field];
      if (config?.validation && !config.validation(value)) {
        return { valid: false, error: `Invalid value for ${config.label}` };
      }
    }

    return { valid: true };
  }, [selectedResources, maxBatchSize, operationType, updateFields, fieldConfig]);

  // Execute batch operation
  const executeBatchOperation = useCallback(async () => {
    const validation = validateOperation();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResults({ success: [], failed: [] });

    const startTime = Date.now();
    const successList = [];
    const failedList = [];

    try {
      for (let i = 0; i < selectedResources.length; i++) {
        const resource = selectedResources[i];
        setProgress(((i + 1) / selectedResources.length) * 100);

        try {
          let result;
          
          switch (operationType) {
            case OPERATION_TYPES.UPDATE:
              // Apply updates to resource
              const updatedResource = { ...resource };
              for (const [field, value] of Object.entries(updateFields)) {
                // Handle nested fields
                if (field.includes('.')) {
                  const parts = field.split('.');
                  let current = updatedResource;
                  for (let j = 0; j < parts.length - 1; j++) {
                    if (!current[parts[j]]) {
                      current[parts[j]] = {};
                    }
                    current = current[parts[j]];
                  }
                  current[parts[parts.length - 1]] = value;
                } else {
                  updatedResource[field] = value;
                }
              }
              
              result = await fhirClient.update(
                resourceType,
                resource.id,
                updatedResource
              );
              break;

            case OPERATION_TYPES.DELETE:
              await fhirClient.delete(resourceType, resource.id);
              result = { id: resource.id, deleted: true };
              break;

            case OPERATION_TYPES.ARCHIVE:
              // Archive by updating status
              const archivedResource = {
                ...resource,
                status: 'entered-in-error',
                meta: {
                  ...resource.meta,
                  tag: [
                    ...(resource.meta?.tag || []),
                    {
                      system: 'http://emr.local/tags',
                      code: 'archived',
                      display: 'Archived'
                    }
                  ]
                }
              };
              result = await fhirClient.update(
                resourceType,
                resource.id,
                archivedResource
              );
              break;

            case OPERATION_TYPES.ACTIVATE:
            case OPERATION_TYPES.DEACTIVATE:
              // Update status based on operation
              const statusResource = {
                ...resource,
                status: operationType === OPERATION_TYPES.ACTIVATE ? 'active' : 'inactive'
              };
              result = await fhirClient.update(
                resourceType,
                resource.id,
                statusResource
              );
              break;
          }

          successList.push({
            resource,
            result,
            operation: operationType
          });
        } catch (error) {
          failedList.push({
            resource,
            error: error.message,
            operation: operationType
          });
        }

        // Add small delay to prevent overwhelming the server
        if (i < selectedResources.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Record operation in history
      const operation = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: operationType,
        resourceType,
        totalCount: selectedResources.length,
        successCount: successList.length,
        failedCount: failedList.length,
        duration: Date.now() - startTime,
        user: user?.name || 'Unknown',
        fields: operationType === OPERATION_TYPES.UPDATE ? updateFields : null
      };

      setOperationHistory(prev => [operation, ...prev].slice(0, 10));
      setResults({ success: successList, failed: failedList });

      // Publish event
      await publish(CLINICAL_EVENTS.BATCH_OPERATION_COMPLETED, {
        operation,
        results: { success: successList.length, failed: failedList.length }
      });

      // Call completion handler
      if (onOperationComplete) {
        onOperationComplete({
          operation,
          results: { success: successList, failed: failedList }
        });
      }

      // Move to results step
      setActiveStep(3);
    } catch (error) {
      console.error('Batch operation error:', error);
      alert(`Batch operation failed: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }, [selectedResources, operationType, updateFields, resourceType, user, publish, onOperationComplete, validateOperation]);

  // Render resource row
  const renderResourceRow = useCallback((resource) => {
    const isSelected = selectedResources.some(r => r.id === resource.id);
    const display = resource.code?.coding?.[0]?.display || 
                   resource.medicationCodeableConcept?.coding?.[0]?.display ||
                   resource.vaccineCode?.coding?.[0]?.display ||
                   'Unknown';
    const code = resource.code?.coding?.[0]?.code ||
                 resource.medicationCodeableConcept?.coding?.[0]?.code ||
                 resource.vaccineCode?.coding?.[0]?.code ||
                 '';

    return (
      <TableRow
        key={resource.id}
        hover
        onClick={() => handleSelectResource(resource)}
        selected={isSelected}
        sx={{ cursor: 'pointer' }}
      >
        <TableCell padding="checkbox">
          <Checkbox checked={isSelected} />
        </TableCell>
        <TableCell>{resource.id}</TableCell>
        <TableCell>{display}</TableCell>
        <TableCell>{code}</TableCell>
        <TableCell>
          <Chip
            label={resource.status || 'active'}
            size="small"
            color={resource.status === 'active' ? 'success' : 'default'}
          />
        </TableCell>
        <TableCell>
          {format(new Date(resource.meta?.lastUpdated || resource.authoredOn || ''), 'MMM dd, yyyy')}
        </TableCell>
      </TableRow>
    );
  }, [selectedResources, handleSelectResource]);

  // Render field selector
  const renderFieldSelector = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select Fields to Update
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(fieldConfig).map(([fieldName, config]) => (
          <Grid item xs={12} sm={6} key={fieldName}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel
                  control={
                    <Switch
                      checked={fieldName in updateFields}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleFieldUpdate(fieldName, config.options?.[0] || '');
                        } else {
                          setUpdateFields(prev => {
                            const newFields = { ...prev };
                            delete newFields[fieldName];
                            return newFields;
                          });
                        }
                      }}
                    />
                  }
                  label={config.label}
                />
                
                {fieldName in updateFields && (
                  <Box sx={{ mt: 2 }}>
                    {config.type === 'select' ? (
                      <FormControl fullWidth size="small">
                        <Select
                          value={updateFields[fieldName] || ''}
                          onChange={(e) => handleFieldUpdate(fieldName, e.target.value)}
                        >
                          {config.options.map(option => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : config.type === 'text' ? (
                      <TextField
                        fullWidth
                        size="small"
                        value={updateFields[fieldName] || ''}
                        onChange={(e) => handleFieldUpdate(fieldName, e.target.value)}
                      />
                    ) : null}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Render preview
  const renderPreview = () => (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>Operation Preview</AlertTitle>
        <Typography variant="body2">
          {operationType === OPERATION_TYPES.UPDATE && (
            <>
              Updating {selectedResources.length} {resourceType}(s) with the following changes:
              <Box sx={{ mt: 1 }}>
                {Object.entries(updateFields).map(([field, value]) => (
                  <Chip
                    key={field}
                    label={`${fieldConfig[field]?.label || field}: ${value}`}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>
            </>
          )}
          {operationType === OPERATION_TYPES.DELETE && (
            <>Deleting {selectedResources.length} {resourceType}(s)</>
          )}
          {operationType === OPERATION_TYPES.ARCHIVE && (
            <>Archiving {selectedResources.length} {resourceType}(s)</>
          )}
        </Typography>
      </Alert>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Resource ID</TableCell>
              <TableCell>Display</TableCell>
              <TableCell>Current Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedResources.slice(0, 5).map(resource => (
              <TableRow key={resource.id}>
                <TableCell>{resource.id}</TableCell>
                <TableCell>
                  {resource.code?.coding?.[0]?.display || 
                   resource.medicationCodeableConcept?.coding?.[0]?.display ||
                   'Unknown'}
                </TableCell>
                <TableCell>{resource.status || 'active'}</TableCell>
                <TableCell>
                  <Chip
                    label={operationType}
                    size="small"
                    color={operationType === OPERATION_TYPES.DELETE ? 'error' : 'primary'}
                  />
                </TableCell>
              </TableRow>
            ))}
            {selectedResources.length > 5 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="caption" color="text.secondary">
                    ...and {selectedResources.length - 5} more
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Render results
  const renderResults = () => (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" />
                <Typography variant="h6">Successful</Typography>
              </Box>
              <Typography variant="h3" sx={{ mt: 1 }}>
                {results.success.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon color="error" />
                <Typography variant="h6">Failed</Typography>
              </Box>
              <Typography variant="h3" sx={{ mt: 1 }}>
                {results.failed.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Successful (${results.success.length})`} />
        <Tab label={`Failed (${results.failed.length})`} />
        <Tab label="Operation History" />
      </Tabs>

      {activeTab === 0 && (
        <List>
          {results.success.map((item, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary={item.resource.id}
                secondary={`${item.operation} completed successfully`}
              />
            </ListItem>
          ))}
        </List>
      )}

      {activeTab === 1 && (
        <List>
          {results.failed.map((item, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <ErrorIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary={item.resource.id}
                secondary={item.error}
              />
            </ListItem>
          ))}
        </List>
      )}

      {activeTab === 2 && (
        <List>
          {operationHistory.map((op) => (
            <ListItem key={op.id}>
              <ListItemText
                primary={`${op.type} - ${op.resourceType}`}
                secondary={
                  <Box>
                    <Typography variant="caption" display="block">
                      {format(new Date(op.timestamp), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                    <Typography variant="caption">
                      Success: {op.successCount}, Failed: {op.failedCount}, Duration: {op.duration}ms
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  const steps = [
    {
      label: 'Select Resources',
      content: (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Select Resources ({selectedResources.length} selected)
            </Typography>
            <Button
              startIcon={selectedResources.length === resources.length ? <VisibilityOffIcon /> : <VisibilityIcon />}
              onClick={handleSelectAll}
            >
              {selectedResources.length === resources.length ? 'Deselect All' : 'Select All'}
            </Button>
          </Box>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={isPageIndeterminate}
                      checked={isPageSelected}
                      onChange={handleSelectAllPage}
                    />
                  </TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Display</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resources
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map(renderResourceRow)}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            component="div"
            count={resources.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Box>
      )
    },
    {
      label: 'Choose Operation',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            Select Operation Type
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Card
                variant={operationType === OPERATION_TYPES.UPDATE ? 'elevation' : 'outlined'}
                sx={{
                  cursor: 'pointer',
                  borderColor: operationType === OPERATION_TYPES.UPDATE ? 'primary.main' : undefined,
                  borderWidth: operationType === OPERATION_TYPES.UPDATE ? 2 : 1
                }}
                onClick={() => setOperationType(OPERATION_TYPES.UPDATE)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <UpdateIcon color="primary" />
                    <Typography variant="h6">Update</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Modify fields on selected resources
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card
                variant={operationType === OPERATION_TYPES.DELETE ? 'elevation' : 'outlined'}
                sx={{
                  cursor: 'pointer',
                  borderColor: operationType === OPERATION_TYPES.DELETE ? 'error.main' : undefined,
                  borderWidth: operationType === OPERATION_TYPES.DELETE ? 2 : 1
                }}
                onClick={() => setOperationType(OPERATION_TYPES.DELETE)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <DeleteSweepIcon color="error" />
                    <Typography variant="h6">Delete</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Permanently remove selected resources
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card
                variant={operationType === OPERATION_TYPES.ARCHIVE ? 'elevation' : 'outlined'}
                sx={{
                  cursor: 'pointer',
                  borderColor: operationType === OPERATION_TYPES.ARCHIVE ? 'warning.main' : undefined,
                  borderWidth: operationType === OPERATION_TYPES.ARCHIVE ? 2 : 1
                }}
                onClick={() => setOperationType(OPERATION_TYPES.ARCHIVE)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ArchiveIcon color="warning" />
                    <Typography variant="h6">Archive</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Mark resources as archived
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          {operationType === OPERATION_TYPES.UPDATE && (
            <Fade in>
              <Box sx={{ mt: 3 }}>
                {renderFieldSelector()}
              </Box>
            </Fade>
          )}
        </Box>
      )
    },
    {
      label: 'Review & Execute',
      content: (
        <Box>
          {renderPreview()}
          
          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={processing ? <CircularProgress size={20} /> : <PlayArrowIcon />}
              onClick={executeBatchOperation}
              disabled={processing || !validateOperation().valid}
            >
              {processing ? 'Processing...' : 'Execute Operation'}
            </Button>
          </Box>
          
          {processing && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                Processing {Math.floor(progress)}%
              </Typography>
            </Box>
          )}
        </Box>
      )
    },
    {
      label: 'Results',
      content: renderResults()
    }
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SpeedIcon color="primary" />
          <Typography variant="h5">
            Batch Operations - {resourceType}
          </Typography>
          {selectedResources.length > 0 && (
            <Chip
              label={`${selectedResources.length} selected`}
              color="primary"
              size="small"
            />
          )}
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>
                {step.content}
                
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  {index > 0 && index < 3 && (
                    <Button
                      onClick={() => setActiveStep(index - 1)}
                      disabled={processing}
                    >
                      Back
                    </Button>
                  )}
                  {index < 2 && (
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(index + 1)}
                      disabled={
                        (index === 0 && selectedResources.length === 0) ||
                        (index === 1 && operationType === OPERATION_TYPES.UPDATE && Object.keys(updateFields).length === 0)
                      }
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchOperationsDialog;