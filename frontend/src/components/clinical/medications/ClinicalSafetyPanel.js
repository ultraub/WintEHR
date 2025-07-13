/**
 * Clinical Safety Panel
 * Displays comprehensive clinical safety verification results
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
  Paper,
  Avatar,
  useTheme,
  alpha
} from '@mui/material';
import {
  Shield as SafetyIcon,
  Error as CriticalIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SafeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Assignment as TaskIcon,
  Schedule as ScheduleIcon,
  Medication as MedicationIcon,
  Psychology as CognitionIcon,
  Accessibility as AccessibilityIcon,
  LocalHospital as ClinicalIcon,
  Verified as VerifiedIcon,
  ReportProblem as RiskIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { clinicalSafetyVerifier } from '../../../services/clinicalSafetyVerifier';

const ClinicalSafetyPanel = ({ patientId, medications = [], onRefresh }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [safetyReport, setSafetyReport] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [lastVerification, setLastVerification] = useState(null);

  // Memoize medication IDs to prevent unnecessary re-verification when array reference changes
  const medicationIds = useMemo(() => {
    return medications?.map(med => med.id).sort().join(',') || '';
  }, [medications]);

  // Add verification cache to prevent repeated requests - using useRef to persist across React StrictMode
  const verificationCache = useRef(new Map());

  useEffect(() => {
    if (patientId && medications.length > 0) {
      // Create cache key based on patient and medication IDs
      const cacheKey = `${patientId}-${medicationIds}`;
      
      // Check if we already have recent verification for this combination
      const cached = verificationCache.current.get(cacheKey);
      const now = Date.now();
      const cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
      
      if (cached && (now - cached.timestamp < cacheTimeout)) {
        setSafetyReport(cached.report);
        setLastVerification(cached.date);
        return;
      }
      
      runSafetyVerification(cacheKey);
    }
  }, [patientId, medicationIds]); // Only depend on patientId and medicationIds, not the full medications array

  const runSafetyVerification = useCallback(async (cacheKey = null) => {
    setLoading(true);
    try {
      const report = await clinicalSafetyVerifier.performSafetyVerification(patientId);
      const verificationDate = new Date();
      
      setSafetyReport(report);
      setLastVerification(verificationDate);
      
      // Cache the result if cache key provided
      if (cacheKey) {
        verificationCache.current.set(cacheKey, {
          report,
          date: verificationDate,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error running safety verification:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const getRiskLevelColor = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'success';
    }
  };

  const getRiskLevelIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return <CriticalIcon color="error" />;
      case 'high': return <WarningIcon color="error" />;
      case 'medium': return <WarningIcon color="warning" />;
      case 'low': return <InfoIcon color="info" />;
      default: return <SafeIcon color="success" />;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'info';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const getCategoryIcon = (categoryName) => {
    switch (categoryName) {
      case 'criticalSafety': return <SecurityIcon />;
      case 'workflowSafety': return <ClinicalIcon />;
      case 'processSafety': return <VerifiedIcon />;
      default: return <SafetyIcon />;
    }
  };

  const getCategoryTitle = (categoryName) => {
    switch (categoryName) {
      case 'criticalSafety': return 'Critical Safety';
      case 'workflowSafety': return 'Workflow Safety';
      case 'processSafety': return 'Process Safety';
      default: return 'Safety';
    }
  };

  if (loading && !safetyReport) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <SafetyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Clinical Safety Verification
          </Typography>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Performing comprehensive safety verification...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!safetyReport) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <SafetyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Clinical Safety Verification
          </Typography>
          <Alert severity="info">
            Run safety verification to ensure medication management meets clinical safety standards.
          </Alert>
        </CardContent>
        <CardActions>
          <Button
            startIcon={<SafetyIcon />}
            onClick={runSafetyVerification}
            variant="contained"
          >
            Run Safety Verification
          </Button>
        </CardActions>
      </Card>
    );
  }

  const { overall } = safetyReport;
  const hasCriticalIssues = overall.criticalIssues > 0;
  const hasHighRiskIssues = overall.highRiskIssues > 0;
  const totalIssues = overall.criticalIssues + overall.highRiskIssues + overall.mediumRiskIssues + overall.lowRiskIssues;

  return (
    <Box>
      {/* Summary Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">
                <SafetyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Clinical Safety Verification
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Comprehensive medication safety assessment
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              {/* Safety Score */}
              <Box sx={{ textAlign: 'center' }}>
                <Avatar 
                  sx={{ 
                    bgcolor: `${getScoreColor(overall.score)}.main`,
                    width: 56,
                    height: 56,
                    fontSize: '1.2rem',
                    fontWeight: 'bold'
                  }}
                >
                  {overall.score}
                </Avatar>
                <Typography variant="caption" color="text.secondary">
                  Safety Score
                </Typography>
              </Box>
              
              {/* Risk Level */}
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ mb: 1 }}>
                  {getRiskLevelIcon(overall.riskLevel)}
                </Box>
                <Chip 
                  label={overall.riskLevel.toUpperCase()}
                  color={getRiskLevelColor(overall.riskLevel)}
                  size="small"
                />
              </Box>

              {/* Issue Counts */}
              <Stack spacing={1}>
                {hasCriticalIssues && (
                  <Badge badgeContent={overall.criticalIssues} color="error">
                    <Chip 
                      icon={<CriticalIcon />}
                      label="Critical"
                      color="error"
                      size="small"
                    />
                  </Badge>
                )}
                {hasHighRiskIssues && (
                  <Badge badgeContent={overall.highRiskIssues} color="error">
                    <Chip 
                      icon={<WarningIcon />}
                      label="High Risk"
                      color="error"
                      size="small"
                    />
                  </Badge>
                )}
                {!hasCriticalIssues && !hasHighRiskIssues && overall.safe && (
                  <Chip 
                    icon={<SafeIcon />}
                    label="All Safe"
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

          {lastVerification && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Last verified: {format(lastVerification, 'MMM d, yyyy h:mm a')}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Collapse in={expanded}>
        {/* Critical Alert */}
        {hasCriticalIssues && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              ⚠️ CRITICAL SAFETY ISSUES DETECTED
            </Typography>
            <Typography variant="body2">
              Immediate attention required. Review all critical safety issues before continuing patient care.
            </Typography>
          </Alert>
        )}

        {/* Patient Risk Factors */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Patient Risk Profile
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <AccessibilityIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h6">
                    {safetyReport.patientSpecific.age || 'Unknown'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Age (years)
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <WarningIcon color="warning" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h6">
                    {safetyReport.patientSpecific.allergies}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active Allergies
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <ClinicalIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h6">
                    {safetyReport.patientSpecific.conditions}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active Conditions
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <RiskIcon color="error" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h6">
                    {safetyReport.patientSpecific.riskFactors.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Risk Factors
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Risk Factors Detail */}
            {safetyReport.patientSpecific.riskFactors.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Risk Factors</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {safetyReport.patientSpecific.riskFactors.map((factor, index) => (
                    <Chip 
                      key={index}
                      label={factor.description}
                      color={getRiskLevelColor(factor.risk)}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Safety Categories */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Safety Assessment by Category
            </Typography>
            
            {Object.entries(safetyReport.categories).map(([categoryName, category]) => (
              <Accordion key={categoryName}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                    <Box>{getCategoryIcon(categoryName)}</Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1">
                        {getCategoryTitle(categoryName)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {category.issues.length} issues found
                      </Typography>
                    </Box>
                    <Chip
                      label={category.safe ? 'Safe' : 'Issues'}
                      color={category.safe ? 'success' : 'error'}
                      size="small"
                    />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  {category.issues.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <SafeIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                      <Typography variant="body2" color="success.main">
                        No safety issues found in this category
                      </Typography>
                    </Box>
                  ) : (
                    <List>
                      {category.issues.map((issue, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            {getRiskLevelIcon(issue.risk)}
                          </ListItemIcon>
                          <ListItemText
                            primary={issue.message}
                            secondary={
                              <span>
                                <span style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                                  Type: {issue.type}
                                </span>
                                {issue.medicationName && (
                                  <span style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)', marginLeft: '16px' }}>
                                    • Medication: {issue.medicationName}
                                  </span>
                                )}
                              </span>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Chip 
                              label={issue.risk.toUpperCase()}
                              color={getRiskLevelColor(issue.risk)}
                              size="small"
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>

        {/* Recommendations */}
        {safetyReport.recommendations.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                <CognitionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Safety Recommendations
              </Typography>
              <List>
                {safetyReport.recommendations.map((recommendation, index) => (
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
                        color={recommendation.priority === 'urgent' ? 'error' : 
                               recommendation.priority === 'high' ? 'warning' : 'info'}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Required Actions */}
        {safetyReport.actions.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                <TaskIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Required Actions
              </Typography>
              <List>
                {safetyReport.actions.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <ScheduleIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary={action.description}
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            Due: {format(parseISO(action.dueDate), 'MMM d, yyyy')}
                          </Typography>
                          <Chip 
                            label={action.type.toUpperCase()}
                            color="info"
                            size="small"
                            variant="outlined"
                          />
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip 
                        label={action.priority.toUpperCase()}
                        color={action.priority === 'critical' ? 'error' : 
                               action.priority === 'high' ? 'warning' : 'info'}
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
            <Button
              startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={runSafetyVerification}
              disabled={loading}
            >
              Re-verify Safety
            </Button>

            <Typography variant="caption" color="text.secondary">
              {totalIssues} total safety issues • {medications.length} medications assessed
            </Typography>
          </CardActions>
        </Card>
      </Collapse>
    </Box>
  );
};

export default ClinicalSafetyPanel;