/**
 * Effectiveness Monitoring Panel
 * Displays medication effectiveness alerts and assessment prompts
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
  useTheme,
  alpha
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CompletedIcon,
  TrendingUp as EffectiveIcon,
  Timeline as MonitoringIcon,
  Medication as MedicationIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Notifications as AlertIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { medicationEffectivenessService } from '../../../services/medicationEffectivenessService';
import MedicationEffectivenessDialog from './MedicationEffectivenessDialog';
import { useMedicationResolver } from '../../../hooks/useMedicationResolver';

const EffectivenessMonitoringPanel = ({ patientId, medications = [], onRefresh }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [effectivenessPrompts, setEffectivenessPrompts] = useState(new Map());
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [selectedPrompts, setSelectedPrompts] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const { getMedicationDisplay } = useMedicationResolver(medications?.filter(med => med != null) || []);

  // Memoize medication IDs to prevent unnecessary re-loading when array reference changes
  const medicationIds = useMemo(() => {
    return medications?.filter(med => med?.id).map(med => med.id).sort().join(',') || '';
  }, [medications]);

  // Add effectiveness data cache and request tracking to prevent repeated requests - using useRef to persist across React StrictMode
  const effectivenessCache = useRef(new Map());
  const activeRequests = useRef(new Set());

  useEffect(() => {
    if (patientId && medications.length > 0) {
      // Create cache key based on patient and medication IDs
      const cacheKey = `${patientId}-${medicationIds}`;
      
      // Check if we already have recent effectiveness data for this combination
      const cached = effectivenessCache.current.get(cacheKey);
      const now = Date.now();
      const cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
      
      if (cached && (now - cached.timestamp < cacheTimeout)) {
        setAlerts(cached.alerts);
        setEffectivenessPrompts(cached.prompts);
        return;
      }
      
      // Check if we already have an active request for this cache key
      if (activeRequests.current.has(cacheKey)) {
        return;
      }
      
      loadEffectivenessData(cacheKey);
    }
  }, [patientId, medicationIds]); // Only depend on patientId and medicationIds, not the full medications array

  const loadEffectivenessData = useCallback(async (cacheKey = null) => {
    // Mark this request as active to prevent duplicates
    if (cacheKey) {
      activeRequests.current.add(cacheKey);
    }
    
    setLoading(true);
    try {
      // Load effectiveness alerts
      const effectivenessAlerts = await medicationEffectivenessService.getEffectivenessAlerts(patientId);
      setAlerts(effectivenessAlerts);

      // Load assessment prompts for active medications
      const promptsMap = new Map();
      await Promise.all(
        medications
          .filter(med => med.status === 'active')
          .map(async (medication) => {
            try {
              const prompts = await medicationEffectivenessService.generateAssessmentPrompts(medication.id);
              promptsMap.set(medication.id, prompts);
            } catch (error) {
              // Skip failed medication prompt loading
            }
          })
      );
      setEffectivenessPrompts(promptsMap);

      // Cache the result if cache key provided
      if (cacheKey) {
        effectivenessCache.current.set(cacheKey, {
          alerts: effectivenessAlerts,
          prompts: promptsMap,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      // Failed to load effectiveness data
    } finally {
      setLoading(false);
      // Remove from active requests
      if (cacheKey) {
        activeRequests.current.delete(cacheKey);
      }
    }
  }, [patientId, medications]);

  const handleStartAssessment = async (medication) => {
    try {
      setSelectedMedication(medication);
      const prompts = effectivenessPrompts.get(medication.id);
      setSelectedPrompts(prompts);
      setAssessmentDialogOpen(true);
    } catch (error) {
      // Failed to start assessment
    }
  };

  const handleSubmitAssessment = async (assessmentData) => {
    try {
      await medicationEffectivenessService.recordAssessmentResults(assessmentData);
      
      // Refresh data after assessment
      await loadEffectivenessData();
      if (onRefresh) {
        await onRefresh();
      }
      
      setAssessmentDialogOpen(false);
      setSelectedMedication(null);
      setSelectedPrompts(null);
    } catch (error) {
      throw error;
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'overdue': return 'error';
      case 'urgent': return 'warning';
      case 'soon': return 'info';
      default: return 'default';
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'overdue': return <WarningIcon color="error" />;
      case 'urgent': return <ScheduleIcon color="warning" />;
      case 'soon': return <InfoIcon color="info" />;
      default: return <AssessmentIcon />;
    }
  };

  // Count medications needing assessment
  const medicationsNeedingAssessment = Array.from(effectivenessPrompts.values())
    .filter(prompts => prompts.urgencyLevel === 'overdue' || prompts.urgencyLevel === 'urgent').length;

  const overdueAlerts = alerts.filter(alert => alert.type === 'effectiveness-assessment-overdue').length;

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <MonitoringIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Effectiveness Monitoring
          </Typography>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Loading effectiveness monitoring data...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Summary Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">
                <MonitoringIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Effectiveness Monitoring
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Medication therapeutic response tracking
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {medicationsNeedingAssessment > 0 && (
                <Badge badgeContent={medicationsNeedingAssessment} color="warning">
                  <Chip 
                    icon={<AlertIcon />}
                    label="Assessments Due"
                    color="warning"
                    size="small"
                  />
                </Badge>
              )}
              <IconButton
                onClick={() => setExpanded(!expanded)}
                size="small"
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Collapse in={expanded}>
        {/* Alerts Section */}
        {alerts.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} color="warning" />
                Monitoring Alerts
              </Typography>
              <List dense>
                {alerts.map((alert, index) => (
                  <ListItem key={`alert-${alert.type}-${alert.message.substring(0, 20)}-${index}`}>
                    <ListItemIcon>
                      {alert.severity === 'high' ? 
                        <WarningIcon color="error" /> : 
                        <InfoIcon color="warning" />
                      }
                    </ListItemIcon>
                    <ListItemText
                      primary={alert.message}
                      secondary={
                        <span>
                          <span style={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                            {alert.type === 'effectiveness-assessment-overdue' && 
                              `${alert.daysOverdue} days overdue • ${alert.overdueActivities} activities`}
                            {alert.type === 'effectiveness-assessment-stale' && 
                              `${alert.daysSinceLastAssessment} days since last assessment`}
                          </span>
                        </span>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip 
                        label={alert.severity.toUpperCase()} 
                        color={alert.severity === 'high' ? 'error' : 'warning'}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Assessment Prompts */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Assessment Prompts
            </Typography>
            {Array.from(effectivenessPrompts.entries()).length === 0 ? (
              <Alert severity="info">
                No active medications requiring effectiveness assessment at this time.
              </Alert>
            ) : (
              <List>
                {Array.from(effectivenessPrompts.entries()).map(([medicationId, prompts]) => {
                  const medication = medications.find(med => med.id === medicationId);
                  if (!medication) return null;

                  const nextAssessment = prompts.nextAssessmentDue ? 
                    parseISO(prompts.nextAssessmentDue) : null;
                  const isOverdue = nextAssessment && isAfter(new Date(), nextAssessment);
                  const daysUntilDue = nextAssessment ? 
                    differenceInDays(nextAssessment, new Date()) : null;

                  return (
                    <React.Fragment key={medicationId}>
                      <ListItem>
                        <ListItemIcon>
                          <MedicationIcon color={medication.status === 'active' ? 'primary' : 'disabled'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body1">
                                {getMedicationDisplay(medication)}
                              </Typography>
                              <Chip 
                                label={prompts.urgencyLevel.toUpperCase()}
                                color={getUrgencyColor(prompts.urgencyLevel)}
                                size="small"
                              />
                              {prompts.assessmentPhase === 'initial' && (
                                <Chip 
                                  label="INITIAL"
                                  color="info"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          }
                          secondary={
                            <span>
                              <span style={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
                                {prompts.daysSinceStart} days since start • 
                                {nextAssessment && (
                                  isOverdue ? 
                                    ` ${Math.abs(daysUntilDue)} days overdue` :
                                    ` Due in ${daysUntilDue} days (${format(nextAssessment, 'MMM d')})`
                                )}
                              </span>
                              {prompts.targetConditions && (
                                <span style={{ display: 'block', marginTop: '4px' }}>
                                  {prompts.targetConditions.map((condition, index) => (
                                    <span 
                                      key={`condition-${condition}-${index}`}
                                      style={{
                                        display: 'inline-block',
                                        fontSize: '0.7rem',
                                        padding: '2px 6px',
                                        margin: '0 2px',
                                        border: `1px solid ${theme.palette.divider}`,
                                        borderRadius: '12px',
                                        backgroundColor: 'transparent',
                                        color: theme.palette.text.secondary
                                      }}
                                    >
                                      {condition}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {getUrgencyIcon(prompts.urgencyLevel)}
                            <Button
                              variant={prompts.urgencyLevel === 'overdue' ? 'contained' : 'outlined'}
                              color={prompts.urgencyLevel === 'overdue' ? 'error' : 'primary'}
                              size="small"
                              onClick={() => handleStartAssessment(medication)}
                            >
                              Assess
                            </Button>
                          </Stack>
                        </ListItemSecondaryAction>
                      </ListItem>
                      
                      {/* Show recommendations for urgent/overdue assessments */}
                      {(prompts.urgencyLevel === 'urgent' || prompts.urgencyLevel === 'overdue') && 
                       prompts.recommendations && (
                        <ListItem sx={{ pl: 7, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
                          <ListItemText
                            primary={
                              <Typography variant="caption" color="warning.main" fontWeight="medium">
                                RECOMMENDATIONS
                              </Typography>
                            }
                            secondary={
                              <span>
                                {prompts.recommendations.map((rec, index) => (
                                  <span key={`rec-${rec.substring(0, 20)}-${index}`} style={{ display: 'block', fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                                    • {rec}
                                  </span>
                                ))}
                              </span>
                            }
                          />
                        </ListItem>
                      )}
                      
                      <Divider />
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </CardContent>
          
          <CardActions>
            <Button
              startIcon={<EffectiveIcon />}
              onClick={loadEffectivenessData}
              disabled={loading}
            >
              Refresh Monitoring Data
            </Button>
          </CardActions>
        </Card>
      </Collapse>

      {/* Assessment Dialog */}
      <MedicationEffectivenessDialog
        open={assessmentDialogOpen}
        onClose={() => {
          setAssessmentDialogOpen(false);
          setSelectedMedication(null);
          setSelectedPrompts(null);
        }}
        medicationRequest={selectedMedication}
        assessmentPrompts={selectedPrompts}
        onSubmitAssessment={handleSubmitAssessment}
      />
    </Box>
  );
};

export default EffectivenessMonitoringPanel;