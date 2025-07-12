/**
 * CDS Card Display Component
 * Displays CDS cards according to configured display behavior
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  Badge,
  Fab,
  Zoom,
  Collapse,
  Alert,
  Snackbar,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Notifications as NotificationsIcon,
  Link as LinkIcon,
  CheckCircle as SuccessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { TransitionGroup } from 'react-transition-group';

const CDSCardDisplay = ({ 
  cards = [], 
  displayBehavior = {},
  onDismiss,
  onAction,
  patientName = 'Patient'
}) => {
  const [displayedCards, setDisplayedCards] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [dismissedCards, setDismissedCards] = useState(new Set());

  // Default display behavior
  const config = {
    displayMode: 'immediate',
    position: 'top',
    maxCards: 10,
    groupByService: true,
    allowDismiss: true,
    animation: true,
    autoHide: false,
    autoHideDelay: 30,
    priority: 'critical-first',
    ...displayBehavior
  };

  // Filter and sort cards based on configuration
  useEffect(() => {
    let filtered = cards.filter(card => {
      // Filter dismissed cards if persistence is enabled
      if (config.persistDismissals && dismissedCards.has(`${card.serviceId}-${card.summary}`)) {
        return false;
      }
      return true;
    });

    // Sort by priority
    if (config.priority === 'critical-first') {
      filtered.sort((a, b) => {
        const priorityOrder = { critical: 0, warning: 1, info: 2 };
        return (priorityOrder[a.indicator] || 3) - (priorityOrder[b.indicator] || 3);
      });
    } else if (config.priority === 'newest-first') {
      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // Limit cards
    filtered = filtered.slice(0, config.maxCards);

    setDisplayedCards(filtered);

    // Handle display mode
    if (config.displayMode === 'immediate' && filtered.length > 0) {
      if (config.position === 'modal') {
        setModalOpen(true);
      } else if (config.position === 'right') {
        setDrawerOpen(true);
      }
    }

    // Auto-hide
    if (config.autoHide && filtered.length > 0) {
      const timer = setTimeout(() => {
        if (config.position === 'modal') {
          setModalOpen(false);
        } else if (config.position === 'right') {
          setDrawerOpen(false);
        }
      }, config.autoHideDelay * 1000);
      return () => clearTimeout(timer);
    }
  }, [cards, config, dismissedCards]);

  const handleDismiss = (card, index) => {
    if (config.persistDismissals) {
      setDismissedCards(prev => new Set([...prev, `${card.serviceId}-${card.summary}`]));
    }
    if (onDismiss) {
      onDismiss(card, index);
    }
  };

  const getCardIcon = (indicator) => {
    switch (indicator) {
      case 'info': return <InfoIcon color="info" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'critical': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const renderCard = (card, index) => (
    <Card 
      key={`${card.serviceId}-${card.summary}-${index}`} 
      variant="outlined"
      sx={{
        animation: config.animation ? 'slideIn 0.3s ease-out' : 'none',
        '@keyframes slideIn': {
          from: { opacity: 0, transform: 'translateY(-10px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        }
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {getCardIcon(card.indicator)}
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {card.summary}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {card.detail}
                </Typography>
                
                {/* Links */}
                {card.links && card.links.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    {card.links.map((link, linkIndex) => (
                      <Chip
                        key={linkIndex}
                        label={link.label}
                        icon={<LinkIcon />}
                        onClick={() => window.open(link.url, '_blank')}
                        size="small"
                        variant="outlined"
                        clickable
                      />
                    ))}
                  </Stack>
                )}

                {/* Suggestions */}
                {card.suggestions && card.suggestions.length > 0 && (
                  <Stack spacing={1}>
                    {card.suggestions.map((suggestion, suggIndex) => (
                      <Button
                        key={suggIndex}
                        variant="outlined"
                        size="small"
                        onClick={() => onAction && onAction(suggestion, card)}
                      >
                        {suggestion.label}
                      </Button>
                    ))}
                  </Stack>
                )}

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Chip 
                    label={card.serviceName} 
                    size="small" 
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(card.timestamp).toLocaleTimeString()}
                  </Typography>
                </Stack>
              </Box>
              {config.allowDismiss && (
                <Tooltip title="Dismiss alert">
                  <IconButton
                    size="small"
                    onClick={() => handleDismiss(card, index)}
                    sx={{ ml: 1 }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderGroupedCards = () => {
    if (!config.groupByService) {
      return displayedCards.map((card, index) => renderCard(card, index));
    }

    const grouped = displayedCards.reduce((acc, card) => {
      const service = card.serviceName || 'Unknown Service';
      if (!acc[service]) acc[service] = [];
      acc[service].push(card);
      return acc;
    }, {});

    return Object.entries(grouped).map(([service, serviceCards]) => (
      <Box key={service} sx={{ mb: 2 }}>
        <Stack 
          direction="row" 
          alignItems="center" 
          spacing={1} 
          sx={{ mb: 1, cursor: 'pointer' }}
          onClick={() => setCollapsedGroups(prev => ({ ...prev, [service]: !prev[service] }))}
        >
          <Typography variant="subtitle2" color="primary">
            {service}
          </Typography>
          <Chip label={serviceCards.length} size="small" />
          {collapsedGroups[service] ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </Stack>
        <Collapse in={!collapsedGroups[service]}>
          <Stack spacing={1}>
            {serviceCards.map((card, index) => renderCard(card, index))}
          </Stack>
        </Collapse>
      </Box>
    ));
  };

  // Modal Display
  if (config.position === 'modal') {
    return (
      <>
        {config.displayMode === 'user-action' && displayedCards.length > 0 && (
          <Tooltip title={`${displayedCards.length} CDS Alerts`}>
            <Fab
              color="primary"
              onClick={() => setModalOpen(true)}
              sx={{ position: 'fixed', bottom: 16, right: 16 }}
            >
              <Badge badgeContent={displayedCards.length} color="error">
                <NotificationsIcon />
              </Badge>
            </Fab>
          </Tooltip>
        )}

        <Dialog
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">
                Clinical Decision Support Alerts
              </Typography>
              <IconButton onClick={() => setModalOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {renderGroupedCards()}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // Drawer Display (Right Sidebar)
  if (config.position === 'right') {
    return (
      <>
        {config.displayMode === 'user-action' && displayedCards.length > 0 && (
          <Tooltip title={`${displayedCards.length} CDS Alerts`}>
            <IconButton
              color="primary"
              onClick={() => setDrawerOpen(true)}
              sx={{ position: 'fixed', right: 8, top: '50%' }}
            >
              <Badge badgeContent={displayedCards.length} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        )}

        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { width: 400 } }}
        >
          <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6">
                CDS Alerts
              </Typography>
              <IconButton onClick={() => setDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Stack spacing={2}>
              {renderGroupedCards()}
            </Stack>
          </Box>
        </Drawer>
      </>
    );
  }

  // Bottom Panel Display
  if (config.position === 'bottom') {
    return (
      <Paper
        elevation={4}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '40vh',
          overflow: 'auto',
          zIndex: 1200,
          display: displayedCards.length > 0 ? 'block' : 'none'
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">
              CDS Alerts ({displayedCards.length})
            </Typography>
            {config.allowDismiss && (
              <Button
                size="small"
                onClick={() => setDisplayedCards([])}
              >
                Clear All
              </Button>
            )}
          </Stack>
          <Stack spacing={2}>
            {renderGroupedCards()}
          </Stack>
        </Box>
      </Paper>
    );
  }

  // Default: Top Display (inline)
  return (
    <Box>
      {displayedCards.length > 0 && (
        <Stack spacing={2}>
          <TransitionGroup>
            {renderGroupedCards()}
          </TransitionGroup>
        </Stack>
      )}
    </Box>
  );
};

export default CDSCardDisplay;