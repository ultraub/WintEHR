/**
 * Effectiveness Monitoring Panel
 * Displays medication effectiveness alerts and assessment prompts
 */
import React, { useState, useEffect } from 'react';
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

  const { getMedicationDisplay } = useMedicationResolver(medications);

  useEffect(() => {
    if (patientId && medications.length > 0) {
      loadEffectivenessData();
    }
  }, [patientId, medications]);

  const loadEffectivenessData = async () => {
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
              console.error(`Error loading prompts for medication ${medication.id}:`, error);
            }
          })
      );
      setEffectivenessPrompts(promptsMap);

    } catch (error) {
      console.error('Error loading effectiveness data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAssessment = async (medication) => {
    try {
      setSelectedMedication(medication);
      const prompts = effectivenessPrompts.get(medication.id);
      setSelectedPrompts(prompts);
      setAssessmentDialogOpen(true);
    } catch (error) {
      console.error('Error starting assessment:', error);
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
      console.error('Error submitting assessment:', error);
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
                  <ListItem key={index}>
                    <ListItemIcon>
                      {alert.severity === 'high' ? 
                        <WarningIcon color="error" /> : 
                        <InfoIcon color="warning" />
                      }
                    </ListItemIcon>
                    <ListItemText
                      primary={alert.message}
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {alert.type === 'effectiveness-assessment-overdue' && 
                              `${alert.daysOverdue} days overdue • ${alert.overdueActivities} activities`}
                            {alert.type === 'effectiveness-assessment-stale' && 
                              `${alert.daysSinceLastAssessment} days since last assessment`}
                          </Typography>
                        </Box>
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
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {prompts.daysSinceStart} days since start • 
                                {nextAssessment && (
                                  isOverdue ? 
                                    ` ${Math.abs(daysUntilDue)} days overdue` :
                                    ` Due in ${daysUntilDue} days (${format(nextAssessment, 'MMM d')})`
                                )}
                              </Typography>
                              {prompts.targetConditions && (
                                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                  {prompts.targetConditions.map((condition, index) => (
                                    <Chip 
                                      key={index}
                                      label={condition}
                                      variant="outlined"
                                      size="small"
                                      sx={{ fontSize: '0.7rem', height: 20 }}
                                    />
                                  ))}
                                </Stack>
                              )}
                            </Box>
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
                              <List dense>
                                {prompts.recommendations.map((rec, index) => (
                                  <ListItem key={index} sx={{ pl: 0, py: 0 }}>
                                    <ListItemText
                                      primary={
                                        <Typography variant="caption">
                                          • {rec}
                                        </Typography>
                                      }
                                    />
                                  </ListItem>
                                ))}
                              </List>
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