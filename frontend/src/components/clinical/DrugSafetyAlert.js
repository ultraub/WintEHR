/**
 * Drug Safety Alert Component
 * Displays comprehensive drug safety information with severity indicators
 */

import React from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  LocalPharmacy as PharmacyIcon,
  Healing as AllergyIcon,
  Block as ContraindicationIcon,
  ContentCopy as DuplicateIcon,
  Speed as DosageIcon,
  Security as SafetyIcon
} from '@mui/icons-material';

// Severity configuration
const SEVERITY_CONFIG = {
  critical: {
    color: 'error',
    icon: <ErrorIcon />,
    label: 'Critical',
    alertSeverity: 'error'
  },
  high: {
    color: 'error',
    icon: <ErrorIcon />,
    label: 'High',
    alertSeverity: 'error'
  },
  moderate: {
    color: 'warning',
    icon: <WarningIcon />,
    label: 'Moderate',
    alertSeverity: 'warning'
  },
  low: {
    color: 'info',
    icon: <InfoIcon />,
    label: 'Low',
    alertSeverity: 'info'
  },
  info: {
    color: 'info',
    icon: <InfoIcon />,
    label: 'Info',
    alertSeverity: 'info'
  }
};

// Alert type icons
const ALERT_TYPE_ICONS = {
  interaction: <PharmacyIcon />,
  allergy: <AllergyIcon />,
  contraindication: <ContraindicationIcon />,
  duplicate: <DuplicateIcon />,
  dosage: <DosageIcon />,
  overall: <SafetyIcon />
};

const DrugSafetyAlert = ({ 
  safetyData, 
  onAccept, 
  onOverride,
  showDetails = true,
  collapsible = true
}) => {
  if (!safetyData) return null;

  const {
    overall_risk_score,
    total_alerts,
    critical_alerts,
    interactions = [],
    allergy_alerts = [],
    contraindications = [],
    duplicate_therapy = [],
    dosage_alerts = [],
    recommendations = []
  } = safetyData;

  // Determine overall severity
  const getOverallSeverity = () => {
    if (overall_risk_score >= 7) return 'critical';
    if (overall_risk_score >= 5) return 'high';
    if (overall_risk_score >= 3) return 'moderate';
    return 'low';
  };

  const overallSeverity = getOverallSeverity();
  const severityConfig = SEVERITY_CONFIG[overallSeverity];

  // Render alert section
  const renderAlertSection = (title, alerts, type, getSeverity) => {
    if (!alerts || alerts.length === 0) return null;

    const content = (
      <List dense>
        {alerts.map((alert, index) => {
          const alertSeverity = getSeverity(alert);
          const alertConfig = SEVERITY_CONFIG[alertSeverity] || SEVERITY_CONFIG.info;
          
          return (
            <ListItem key={index} sx={{ alignItems: 'flex-start' }}>
              <ListItemIcon>
                {alertConfig.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2">
                      {alert.summary || alert.description || 'Alert'}
                    </Typography>
                    <Chip 
                      label={alertConfig.label} 
                      size="small" 
                      color={alertConfig.color}
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    {alert.detail || alert.clinical_consequence || alert.rationale || ''}
                    {alert.management && (
                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                        Recommendation: {alert.management}
                      </Typography>
                    )}
                    {alert.recommendation && (
                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                        {alert.recommendation}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          );
        })}
      </List>
    );

    if (collapsible) {
      return (
        <Accordion key={type} defaultExpanded={alerts.some(a => getSeverity(a) === 'critical')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              {ALERT_TYPE_ICONS[type]}
              <Typography sx={{ flexGrow: 1 }}>{title}</Typography>
              <Chip label={alerts.length} size="small" color={alerts.length > 0 ? 'error' : 'default'} />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {content}
          </AccordionDetails>
        </Accordion>
      );
    }

    return (
      <Box key={type} sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {ALERT_TYPE_ICONS[type]}
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
          <Chip label={alerts.length} size="small" />
        </Box>
        {content}
      </Box>
    );
  };

  return (
    <Box>
      {/* Overall Risk Alert */}
      {overall_risk_score >= 5 && (
        <Alert 
          severity={severityConfig.alertSeverity}
          icon={ALERT_TYPE_ICONS.overall}
          sx={{ mb: 2 }}
        >
          <AlertTitle>
            Drug Safety Risk Score: {overall_risk_score.toFixed(1)}/10
          </AlertTitle>
          <Typography variant="body2">
            {critical_alerts} critical alerts found across {total_alerts} total safety concerns.
          </Typography>
          {recommendations.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {recommendations.map((rec, index) => (
                <Typography key={index} variant="body2" sx={{ fontWeight: rec.includes('HIGH RISK') ? 'bold' : 'normal' }}>
                  • {rec}
                </Typography>
              ))}
            </Box>
          )}
        </Alert>
      )}

      {/* Detailed Alerts */}
      {showDetails && (
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Stack spacing={1}>
            {renderAlertSection(
              'Drug Interactions',
              interactions,
              'interaction',
              (alert) => alert.severity === 'contraindicated' || alert.severity === 'major' ? 'critical' : 
                       alert.severity === 'moderate' ? 'moderate' : 'low'
            )}
            
            {renderAlertSection(
              'Allergy Alerts',
              allergy_alerts,
              'allergy',
              (alert) => alert.reaction_type === 'direct' ? 'critical' : 'high'
            )}
            
            {renderAlertSection(
              'Contraindications',
              contraindications,
              'contraindication',
              (alert) => alert.contraindication_type === 'absolute' ? 'critical' : 'moderate'
            )}
            
            {renderAlertSection(
              'Duplicate Therapy',
              duplicate_therapy,
              'duplicate',
              () => 'moderate'
            )}
            
            {renderAlertSection(
              'Dosage Alerts',
              dosage_alerts,
              'dosage',
              (alert) => alert.issue_type === 'overdose' ? 'critical' : 'moderate'
            )}
          </Stack>
        </Paper>
      )}

      {/* Action Buttons */}
      {(onAccept || onOverride) && overall_risk_score >= 5 && (
        <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          {onOverride && (
            <Button
              variant="outlined"
              color="warning"
              onClick={onOverride}
            >
              Override with Reason
            </Button>
          )}
          {onAccept && overall_risk_score < 7 && (
            <Button
              variant="contained"
              color="primary"
              onClick={onAccept}
            >
              Accept Recommendations
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default DrugSafetyAlert;