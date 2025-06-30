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

const CDSAlerts = ({ hook = null, patientId = null, position = 'top' }) => {
  const [cards, setCards] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());

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

  const handleSuggestionAction = (suggestion, action) => {
    console.log('CDS Suggestion Action:', suggestion, action);
    // TODO: Implement suggestion actions (create order, etc.)
    alert(`Action: ${action.type} - ${action.description}`);
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
                {card.suggestions.map((suggestion, index) => (
                  <Box key={suggestion.uuid || index}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CheckIcon />}
                      onClick={() => handleSuggestionAction(suggestion, suggestion.actions[0])}
                    >
                      {suggestion.label}
                    </Button>
                  </Box>
                ))}
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