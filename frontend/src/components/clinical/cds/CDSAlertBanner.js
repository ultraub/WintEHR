/**
 * CDS Alert Banner Component
 * Displays CDS Hooks alerts in the clinical workspace
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Collapse,
  Badge,
  Tooltip,
  Stack,
  Alert,
  Button
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import CDSCard from './CDSCard';
import { useCDS } from '../../../contexts/CDSContext';
import { useClinical } from '../../../contexts/ClinicalContext';

const CDSAlertBanner = ({ hookType = 'patient-view' }) => {
  const [expanded, setExpanded] = useState(false);
  const [hiddenCards, setHiddenCards] = useState(new Set());
  const { currentPatient } = useClinical();
  const { getAlerts, executeCDSHooks } = useCDS();
  
  // Get alerts for this hook type from CDSContext
  const contextAlerts = getAlerts(hookType);
  const cards = contextAlerts || [];
  const systemActions = []; // TODO: Add system actions to CDSContext if needed
  
  console.log('[CDS Debug] CDSAlertBanner - hookType:', hookType);
  console.log('[CDS Debug] CDSAlertBanner - contextAlerts:', contextAlerts);
  console.log('[CDS Debug] CDSAlertBanner - cards:', cards);

  // Filter out hidden cards
  const visibleCards = cards.filter(card => !hiddenCards.has(card.uuid));

  // Count cards by severity
  const cardCounts = visibleCards.reduce((acc, card) => {
    acc[card.indicator] = (acc[card.indicator] || 0) + 1;
    return acc;
  }, {});

  // Auto-expand if there are critical alerts
  useEffect(() => {
    if (cardCounts.critical > 0 && !expanded) {
      setExpanded(true);
    }
  }, [cardCounts.critical]);

  // Execute hook when patient changes
  useEffect(() => {
    console.log('[CDS Debug] CDSAlertBanner useEffect - currentPatient:', currentPatient);
    console.log('[CDS Debug] CDSAlertBanner useEffect - hookType:', hookType);
    if (currentPatient?.id && hookType === 'patient-view') {
      // For patient-view hooks, let CDSContext handle the execution
      // CDSContext's usePatientCDSAlerts will trigger when services are loaded
      console.log('[CDS Debug] CDSAlertBanner - patient-view hooks will be executed by CDSContext');
    } else if (currentPatient?.id && hookType !== 'patient-view') {
      console.log('[CDS Debug] CDSAlertBanner - executing non-patient-view hooks for patient:', currentPatient.id);
      executeCDSHooks(hookType, {
        patientId: currentPatient.id,
        userId: 'current-user' // TODO: Get from auth context
      });
    }
  }, [currentPatient?.id, hookType, executeCDSHooks]);

  // Handle accepting a suggestion
  const handleAcceptSuggestion = useCallback(async (suggestion) => {
    // TODO: Implement suggestion acceptance
    console.log('Accepting suggestion:', suggestion);
    
    // For now, just hide the card
    if (suggestion.actions) {
      // Process FHIR actions
      for (const action of suggestion.actions) {
        console.log('Would process action:', action);
      }
    }
  }, []);

  // Handle dismissing a card
  const handleDismissCard = useCallback((card, reasonKey, comment) => {
    setHiddenCards(prev => new Set([...prev, card.uuid]));
  }, []);

  // Don't render if no cards
  console.log('[CDS Debug] CDSAlertBanner - visibleCards:', visibleCards);
  console.log('[CDS Debug] CDSAlertBanner - visibleCards.length:', visibleCards.length);
  if (visibleCards.length === 0) {
    console.log('[CDS Debug] CDSAlertBanner - No visible cards, returning null');
    return null;
  }

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1200,
        backgroundColor: 'background.paper',
        borderRadius: 0,
        borderBottom: 2,
        borderColor: 'divider'
      }}
    >
      {/* Banner Header */}
      <Box
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: cardCounts.critical > 0 ? 'error.lighter' :
                          cardCounts.warning > 0 ? 'warning.lighter' :
                          'info.lighter',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Badge
            badgeContent={visibleCards.length}
            color={cardCounts.critical > 0 ? 'error' :
                  cardCounts.warning > 0 ? 'warning' :
                  'info'}
          >
            <NotificationsIcon />
          </Badge>
          
          <Typography variant="subtitle1" fontWeight="medium">
            Clinical Decision Support Alerts
          </Typography>

          <Stack direction="row" spacing={1}>
            {cardCounts.critical > 0 && (
              <Tooltip title="Critical alerts">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <ErrorIcon color="error" fontSize="small" />
                  <Typography variant="body2" color="error">
                    {cardCounts.critical}
                  </Typography>
                </Box>
              </Tooltip>
            )}
            {cardCounts.warning > 0 && (
              <Tooltip title="Warning alerts">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <WarningIcon color="warning" fontSize="small" />
                  <Typography variant="body2" color="warning.main">
                    {cardCounts.warning}
                  </Typography>
                </Box>
              </Tooltip>
            )}
            {cardCounts.info > 0 && (
              <Tooltip title="Information alerts">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <InfoIcon color="info" fontSize="small" />
                  <Typography variant="body2" color="info.main">
                    {cardCounts.info}
                  </Typography>
                </Box>
              </Tooltip>
            )}
          </Stack>
        </Box>

        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* Expanded Content */}
      <Collapse in={expanded}>
        <Box sx={{ maxHeight: '60vh', overflowY: 'auto', p: 2 }}>
          {/* System Actions Alert */}
          {systemActions && systemActions.length > 0 && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              action={
                <Button size="small" onClick={() => console.log('Apply system actions')}>
                  Review & Apply
                </Button>
              }
            >
              <Typography variant="subtitle2" gutterBottom>
                Automated Actions Available
              </Typography>
              <Typography variant="body2">
                {systemActions.length} automated action{systemActions.length > 1 ? 's' : ''} can be applied to update patient records.
              </Typography>
            </Alert>
          )}

          {/* CDS Cards */}
          <Stack spacing={2}>
            {/* Sort cards by severity: critical first, then warning, then info */}
            {visibleCards
              .sort((a, b) => {
                const severityOrder = { critical: 0, warning: 1, info: 2 };
                return severityOrder[a.indicator] - severityOrder[b.indicator];
              })
              .map((card) => (
                <CDSCard
                  key={card.uuid}
                  card={card}
                  serviceId={card.serviceId}
                  hookInstance={card.hookInstance}
                  onAcceptSuggestion={handleAcceptSuggestion}
                  onDismiss={handleDismissCard}
                  compact={false}
                />
              ))}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default CDSAlertBanner;