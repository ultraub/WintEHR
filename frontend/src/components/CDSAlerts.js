/**
 * CDS Alerts Component
 * Displays CDS cards and handles user interactions
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Collapse,
  Stack,
  Chip,
  Link,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import cdsHooksService from '../services/cdsHooks';
import { fhirClient } from '../services/fhirClient';
import api from '../services/api';
import { useSnackbar } from 'notistack';

const CDSAlerts = ({ hook = null, patientId = null, position = 'top' }) => {
  const [cards, setCards] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [processingActions, setProcessingActions] = useState(new Set());
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    // Subscribe to CDS hook events
    const unsubscribe = cdsHooksService.addListener((firedHook, newCards) => {
      // Filter by hook type if specified
      if (!hook || hook === firedHook) {
        setCards(prevCards => {
          // Merge new cards, avoiding duplicates
          const cardMap = new Map();
          [...prevCards, ...newCards].forEach(card => {
            if (!dismissed.has(card.uuid)) {
              cardMap.set(card.uuid, card);
            }
          });
          return Array.from(cardMap.values());
        });
      }
    });

    return unsubscribe;
  }, [hook, dismissed]);

  const getAlertSeverity = (indicator) => {
    switch (indicator) {
      case 'info':
        return 'info';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'info';
    }
  };

  const getAlertIcon = (indicator) => {
    switch (indicator) {
      case 'info':
        return <InfoIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'critical':
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const handleDismiss = (cardId) => {
    setDismissed(prev => new Set([...prev, cardId]));
    setCards(prev => prev.filter(card => card.uuid !== cardId));
  };

  const handleToggleExpand = (cardId) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const handleSuggestionAction = async (suggestion, action) => {
    const actionId = `${suggestion.uuid}-${action.type}`;
    
    // Prevent duplicate processing
    if (processingActions.has(actionId)) {
      return;
    }
    
    setProcessingActions(prev => new Set([...prev, actionId]));
    
    try {
      switch (action.type) {
        case 'create':
          await handleCreateAction(action, suggestion);
          break;
          
        case 'update':
          await handleUpdateAction(action, suggestion);
          break;
          
        case 'delete':
          await handleDeleteAction(action, suggestion);
          break;
          
        case 'external':
          if (action.url) {
            window.open(action.url, '_blank');
          }
          break;
          
        default:
          enqueueSnackbar(`Unsupported action type: ${action.type}`, { variant: 'warning' });
      }
      
      // Mark the card as addressed
      if (action.type !== 'external') {
        enqueueSnackbar('Action completed successfully', { variant: 'success' });
        // Optionally dismiss the card after successful action
        handleDismiss(suggestion.uuid || suggestion.card?.uuid);
      }
    } catch (error) {
      console.error('Error executing CDS action:', error);
      enqueueSnackbar(`Failed to execute action: ${error.message}`, { variant: 'error' });
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
    }
  };

  const handleCreateAction = async (action, suggestion) => {
    if (!action.resource) {
      throw new Error('No resource provided for create action');
    }
    
    const resource = action.resource;
    const resourceType = resource.resourceType;
    
    if (!resourceType) {
      throw new Error('Resource type not specified');
    }
    
    // Add patient reference if not present and we have patientId
    if (patientId && !resource.subject && !resource.patient) {
      if (['ServiceRequest', 'MedicationRequest', 'Observation', 'Condition'].includes(resourceType)) {
        resource.subject = { reference: `Patient/${patientId}` };
      } else if (resourceType === 'Appointment') {
        resource.participant = resource.participant || [];
        resource.participant.push({
          actor: { reference: `Patient/${patientId}` },
          status: 'needs-action'
        });
      }
    }
    
    // Create the resource
    const result = await fhirClient.create(resourceType, resource);
    
    // Log the action in audit trail
    await logCDSAction(suggestion, action, result);
    
    return result;
  };

  const handleUpdateAction = async (action, suggestion) => {
    if (!action.resource) {
      throw new Error('No resource provided for update action');
    }
    
    const resource = action.resource;
    const resourceType = resource.resourceType;
    const resourceId = resource.id;
    
    if (!resourceType || !resourceId) {
      throw new Error('Resource type or ID not specified');
    }
    
    // Update the resource
    const result = await fhirClient.update(resourceType, resourceId, resource);
    
    // Log the action
    await logCDSAction(suggestion, action, result);
    
    return result;
  };

  const handleDeleteAction = async (action, suggestion) => {
    if (!action.resourceId || !action.resourceType) {
      throw new Error('Resource type or ID not specified for delete action');
    }
    
    // Delete the resource
    await fhirClient.delete(action.resourceType, action.resourceId);
    
    // Log the action
    await logCDSAction(suggestion, action, { deleted: true });
  };

  const logCDSAction = async (suggestion, action, result) => {
    try {
      await api.post('/api/emr/clinical/cds-action-log', {
        cardId: suggestion.card?.uuid || suggestion.uuid,
        suggestionId: suggestion.uuid,
        action: {
          type: action.type,
          description: action.description,
          resourceType: action.resource?.resourceType || action.resourceType
        },
        result: {
          success: true,
          resourceId: result.id,
          resourceType: result.resourceType
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log CDS action:', error);
    }
  };

  const renderCard = (card) => {
    const isExpanded = expanded.has(card.uuid);
    const severity = getAlertSeverity(card.indicator);
    
    return (
      <Alert
        key={card.uuid}
        severity={severity}
        icon={getAlertIcon(card.indicator)}
        action={
          <Stack direction="row" spacing={0}>
            {card.detail && (
              <IconButton
                size="small"
                onClick={() => handleToggleExpand(card.uuid)}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={() => handleDismiss(card.uuid)}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        }
        sx={{ mb: 1 }}
      >
        <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {card.summary}
          {card.serviceTitle && (
            <Chip 
              label={card.serviceTitle} 
              size="small" 
              variant="outlined"
              color="secondary"
              sx={{ ml: 1 }}
            />
          )}
        </AlertTitle>
        
        <Collapse in={isExpanded}>
          {card.detail && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {card.detail}
            </Typography>
          )}
          
          {card.source && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Source: {card.source.label}
                {card.source.url && (
                  <Link
                    href={card.source.url}
                    target="_blank"
                    rel="noopener"
                    sx={{ ml: 1 }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} />
                  </Link>
                )}
              </Typography>
            </Box>
          )}
          
          {card.suggestions && card.suggestions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" gutterBottom>
                Suggested Actions:
              </Typography>
              <Stack spacing={1}>
                {card.suggestions.map((suggestion, index) => {
                  const isProcessing = suggestion.actions && suggestion.actions[0] && 
                    processingActions.has(`${suggestion.uuid}-${suggestion.actions[0].type}`);
                  
                  return (
                    <Box key={suggestion.uuid || index}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CheckIcon />}
                        onClick={() => handleSuggestionAction(suggestion, suggestion.actions[0])}
                        disabled={isProcessing || !suggestion.actions || suggestion.actions.length === 0}
                      >
                        {isProcessing ? 'Processing...' : suggestion.label}
                      </Button>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}
          
          {card.links && card.links.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" gutterBottom>
                Resources:
              </Typography>
              <Stack spacing={0.5}>
                {card.links.map((link, index) => (
                  <Link
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {link.label}
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </Link>
                ))}
              </Stack>
            </Box>
          )}
        </Collapse>
      </Alert>
    );
  };

  if (cards.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      {cards.map(renderCard)}
    </Box>
  );
};

export default CDSAlerts;