/**
 * Workflow Validation Panel
 * Displays medication workflow validation results and data consistency checks
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Badge,
  Collapse,
  Divider,
  LinearProgress,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Assessment as ValidationIcon,
  Security as IntegrityIcon,
  AccountTree as WorkflowIcon,
  Autorenew as AutoFixIcon,
  Autorenew as AutorenewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Build as FixIcon,
  Timeline as ProcessIcon,
  DataUsage as DataIcon,
  Medication as MedicationIcon,
  Insights as InsightsIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { medicationWorkflowValidator } from '../../../services/medicationWorkflowValidator';

const WorkflowValidationPanel = ({ patientId, medications = [], onRefresh }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [lastValidation, setLastValidation] = useState(null);

  // Memoize medication IDs to prevent unnecessary re-validation when array reference changes
  const medicationIds = useMemo(() => {
    return medications?.filter(med => med?.id).map(med => med.id).sort().join(',') || '';
  }, [medications]);

  // Add validation cache and request tracking to prevent repeated requests - using useRef to persist across React StrictMode
  const validationCache = useRef(new Map());
  const activeRequests = useRef(new Set());

  useEffect(() => {
    if (patientId && medications.length > 0) {
      // Create cache key based on patient and medication IDs
      const cacheKey = `${patientId}-${medicationIds}`;
      
      // Check if we already have recent validation for this combination
      const cached = validationCache.current.get(cacheKey);
      const now = Date.now();
      const cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
      
      if (cached && (now - cached.timestamp < cacheTimeout)) {
        setValidationReport(cached.report);
        setLastValidation(cached.date);
        return;
      }
      
      // Check if we already have an active request for this cache key
      if (activeRequests.current.has(cacheKey)) {
        return;
      }
      
      // Mark request as active IMMEDIATELY before calling runValidation
      activeRequests.current.add(cacheKey);
      runValidation(cacheKey);
    }
  }, [patientId, medicationIds]); // Only depend on patientId and medicationIds, not the full medications array

  const runValidation = useCallback(async (cacheKey = null) => {
    setLoading(true);
    try {
      const report = await medicationWorkflowValidator.validatePatientMedicationWorkflow(patientId);
      const validationDate = new Date();
      
      setValidationReport(report);
      setLastValidation(validationDate);
      
      // Cache the result if cache key provided
      if (cacheKey) {
        validationCache.current.set(cacheKey, {
          report,
          date: validationDate,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      // Error running workflow validation - handle gracefully
    } finally {
      setLoading(false);
      // Remove from active requests
      if (cacheKey) {
        activeRequests.current.delete(cacheKey);
      }
    }
  }, [patientId]);

  const handleAutoFix = async () => {
    if (!validationReport) return;
    
    setAutoFixing(true);
    try {
      const fixResults = await medicationWorkflowValidator.autoFixConsistencyIssues(validationReport);
      
      // Show fix results and re-run validation
      await runValidation();
      
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      // Error auto-fixing issues - handle gracefully
    } finally {
      setAutoFixing(false);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'info': return <InfoIcon color="info" />;
      default: return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'info';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const getWorkflowIcon = (workflowType) => {
    switch (workflowType) {
      case 'prescribing': return <MedicationIcon />;
      case 'dispensing': return <ProcessIcon />;
      case 'refills': return <AutorenewIcon />;
      case 'discontinuation': return <ProcessIcon />;
      case 'monitoring': return <InsightsIcon />;
      default: return <WorkflowIcon />;
    }
  };

  if (loading && !validationReport) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <ValidationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Workflow Validation
          </Typography>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Validating medication workflows and data consistency...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!validationReport) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <ValidationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Workflow Validation
          </Typography>
          <Alert severity="info">
            Run validation to check medication workflow integrity and data consistency.
          </Alert>
        </CardContent>
        <CardActions>
          <Button
            startIcon={<ValidationIcon />}
            onClick={runValidation}
            variant="contained"
          >
            Run Validation
          </Button>
        </CardActions>
      </Card>
    );
  }

  const hasErrors = validationReport.criticalIssues.length > 0;
  const hasWarnings = validationReport.warnings.length > 0;
  const score = validationReport.overall.score;

  return (
    <Box>
      {/* Summary Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">
                <ValidationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Workflow Validation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Medication workflow integrity and data consistency
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              {/* Validation Score */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color={`${getScoreColor(score)}.main`}>
                  {score}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Score
                </Typography>
              </Box>
              
              {/* Issue Counts */}
              <Stack spacing={1}>
                {hasErrors && (
                  <Badge badgeContent={validationReport.criticalIssues.length} color="error">
                    <Chip 
                      icon={<ErrorIcon />}
                      label="Errors"
                      color="error"
                      size="small"
                    />
                  </Badge>
                )}
                {hasWarnings && (
                  <Badge badgeContent={validationReport.warnings.length} color="warning">
                    <Chip 
                      icon={<WarningIcon />}
                      label="Warnings"
                      color="warning"
                      size="small"
                    />
                  </Badge>
                )}
                {!hasErrors && !hasWarnings && (
                  <Chip 
                    icon={<ValidIcon />}
                    label="All Valid"
                    color="success"
                    size="small"
                  />
                )}
              </Stack>

              <IconButton
                onClick={() => setExpanded(!expanded)}
                size="small"
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>
          </Stack>

          {lastValidation && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Last validated: {format(lastValidation, 'MMM d, yyyy h:mm a')}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Collapse in={expanded}>
        {/* Critical Issues Alert */}
        {hasErrors && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Critical Issues Found ({validationReport.criticalIssues.length})
            </Typography>
            <List dense>
              {validationReport.criticalIssues.slice(0, 3).map((issue, index) => (
                <ListItem key={index} sx={{ pl: 0 }}>
                  <ListItemText
                    primary={issue.message}
                    secondary={issue.medicationName && `Medication: ${issue.medicationName}`}
                  />
                </ListItem>
              ))}
              {validationReport.criticalIssues.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {validationReport.criticalIssues.length - 3} more
                </Typography>
              )}
            </List>
          </Alert>
        )}

        {/* Medication-Specific Validation */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              <MedicationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Medication Workflow Validation
            </Typography>
            
            {validationReport.medications.map((medValidation) => (
              <Accordion key={medValidation.medicationId}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                    <Box>
                      {medValidation.valid ? 
                        <ValidIcon color="success" /> : 
                        <ErrorIcon color="error" />
                      }
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1">
                        {medValidation.medicationName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Status: {medValidation.status}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {Object.entries(medValidation.workflows).map(([workflowType, workflow]) => (
                        <Tooltip key={workflowType} title={`${workflowType}: ${workflow.valid ? 'Valid' : 'Issues'}`}>
                          <Chip
                            icon={getWorkflowIcon(workflowType)}
                            label={workflowType}
                            color={workflow.valid ? 'success' : 'error'}
                            size="small"
                            variant={workflow.valid ? 'outlined' : 'filled'}
                          />
                        </Tooltip>
                      ))}
                    </Stack>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {Object.entries(medValidation.workflows).map(([workflowType, workflow]) => (
                      <Grid item xs={12} sm={6} md={4} key={workflowType}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                          <CardContent>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              {getWorkflowIcon(workflowType)}
                              <Typography variant="subtitle2">
                                {workflowType.charAt(0).toUpperCase() + workflowType.slice(1)}
                              </Typography>
                              <Chip 
                                label={workflow.valid ? 'Valid' : 'Issues'}
                                color={workflow.valid ? 'success' : 'error'}
                                size="small"
                              />
                            </Stack>
                            
                            {workflow.issues.length === 0 ? (
                              <Typography variant="body2" color="success.main">
                                No issues found
                              </Typography>
                            ) : (
                              <List dense>
                                {workflow.issues.map((issue, index) => (
                                  <ListItem key={index} sx={{ pl: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 24 }}>
                                      {getSeverityIcon(issue.severity)}
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={
                                        <Typography variant="body2" color={`${getSeverityColor(issue.severity)}.main`}>
                                          {issue.message}
                                        </Typography>
                                      }
                                      secondary={issue.type}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>

        {/* Cross-Workflow Issues */}
        {validationReport.crossWorkflow.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                <DataIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Cross-Workflow Data Consistency
              </Typography>
              <List>
                {validationReport.crossWorkflow.map((issue, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {getSeverityIcon(issue.severity)}
                    </ListItemIcon>
                    <ListItemText
                      primary={issue.message}
                      secondary={`Type: ${issue.type}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip 
                        label={issue.severity.toUpperCase()}
                        color={getSeverityColor(issue.severity)}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {validationReport.recommendations.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                <InsightsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Recommendations
              </Typography>
              <List>
                {validationReport.recommendations.map((recommendation, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <InfoIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary={recommendation.message}
                      secondary={recommendation.action}
                    />
                    <ListItemSecondaryAction>
                      <Chip 
                        label={recommendation.priority.toUpperCase()}
                        color={recommendation.priority === 'high' ? 'error' : 
                               recommendation.priority === 'medium' ? 'warning' : 'info'}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
            <Stack direction="row" spacing={1}>
              <Button
                startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={runValidation}
                disabled={loading}
              >
                Re-validate
              </Button>
              
              {(hasErrors || hasWarnings) && (
                <Button
                  startIcon={autoFixing ? <CircularProgress size={16} /> : <AutoFixIcon />}
                  onClick={handleAutoFix}
                  disabled={autoFixing}
                  variant="outlined"
                  color="warning"
                >
                  Auto-Fix Issues
                </Button>
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              {validationReport.medications.length} medications validated
            </Typography>
          </CardActions>
        </Card>
      </Collapse>
    </Box>
  );
};

export default WorkflowValidationPanel;