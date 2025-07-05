import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  IconButton,
  Collapse,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { cdsHooksClient } from '../services/cdsHooksClient';

const CDSHooksDisplay = ({ patientId, hook = 'patient-view', context = {} }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (patientId) {
      fetchCDSHooks();
    }
  }, [patientId, hook]);

  const fetchCDSHooks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get available services
      const services = await cdsHooksClient.discoverServices();
      
      // Filter services by hook type
      const relevantServices = services.filter(service => service.hook === hook);
      
      // Execute each relevant service
      const allCards = [];
      
      for (const service of relevantServices) {
        const hookContext = {
          userId: 'current-user',
          patientId: patientId,
          context: {
            ...context,
            patientId: patientId
          }
        };
        
        const result = await cdsHooksClient.executeHook(service.id, hookContext);
        
        if (result.cards && result.cards.length > 0) {
          allCards.push(...result.cards.map(card => ({
            ...card,
            serviceId: service.id,
            serviceTitle: service.title
          })));
        }
      }
      
      setCards(allCards);
    } catch (err) {
      setError('Failed to fetch CDS Hooks');
      console.error('CDS Hooks error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (cardId) => {
    setExpanded(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const getIndicatorIcon = (indicator) => {
    switch (indicator) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getIndicatorColor = (indicator) => {
    switch (indicator) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Clinical Decision Support</Typography>
        <IconButton size="small" onClick={fetchCDSHooks}>
          <RefreshIcon />
        </IconButton>
      </Box>
      
      {cards.map((card) => (
        <Card 
          key={card.uuid} 
          sx={{ 
            mb: 2, 
            borderLeft: 4, 
            borderColor: `${getIndicatorColor(card.indicator)}.main` 
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="flex-start" justifyContent="space-between">
              <Box display="flex" alignItems="flex-start" flex={1}>
                {getIndicatorIcon(card.indicator)}
                <Box ml={2} flex={1}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {card.summary}
                  </Typography>
                  
                  {card.serviceTitle && (
                    <Chip 
                      label={card.serviceTitle} 
                      size="small" 
                      sx={{ mt: 0.5, mb: 1 }}
                    />
                  )}
                  
                  {card.detail && (
                    <>
                      <Collapse in={expanded[card.uuid] || false}>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {card.detail}
                        </Typography>
                      </Collapse>
                      
                      <IconButton
                        size="small"
                        onClick={() => toggleExpanded(card.uuid)}
                        sx={{ mt: 1 }}
                      >
                        {expanded[card.uuid] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </>
                  )}
                  
                  {card.suggestions && card.suggestions.length > 0 && (
                    <Box mt={2}>
                      {card.suggestions.map((suggestion, idx) => (
                        <Button
                          key={idx}
                          variant="outlined"
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                          onClick={() => console.log('Suggestion clicked:', suggestion)}
                        >
                          {suggestion.label}
                        </Button>
                      ))}
                    </Box>
                  )}
                  
                  {card.links && card.links.length > 0 && (
                    <Box mt={2}>
                      {card.links.map((link, idx) => (
                        <Button
                          key={idx}
                          variant="text"
                          size="small"
                          href={link.url}
                          target="_blank"
                          sx={{ mr: 1 }}
                        >
                          {link.label}
                        </Button>
                      ))}
                    </Box>
                  )}
                  
                  {card.source && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Source: {card.source.label}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default CDSHooksDisplay;