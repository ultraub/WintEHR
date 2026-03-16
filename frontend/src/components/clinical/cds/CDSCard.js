/**
 * CDS Card Component - CDS Hooks 2.0 Compliant
 * Displays CDS cards with feedback tracking and override reasons
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  IconButton,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Link,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Launch as LaunchIcon,
  Feedback as FeedbackIcon
} from '@mui/icons-material';
import { cdsHooksClient } from '../../../services/cdsHooksClient';

// Indicator icons and colors
const INDICATOR_CONFIG = {
  info: {
    icon: InfoIcon,
    color: 'info.main',
    bgColor: 'info.lighter'
  },
  warning: {
    icon: WarningIcon,
    color: 'warning.main',
    bgColor: 'warning.lighter'
  },
  critical: {
    icon: ErrorIcon,
    color: 'error.main',
    bgColor: 'error.lighter'
  }
};

const CDSCard = ({
  card,
  serviceId,
  hookInstance,
  onAcceptSuggestion,
  onDismiss,
  compact = false
}) => {
  const [expanded, setExpanded] = useState(!compact);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedOverrideReason, setSelectedOverrideReason] = useState('');
  const [overrideComment, setOverrideComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [acceptedSuggestionId, setAcceptedSuggestionId] = useState(null);
  const [iconError, setIconError] = useState(false);

  const indicatorConfig = INDICATOR_CONFIG[card.indicator] || INDICATOR_CONFIG.info;
  const IndicatorIcon = indicatorConfig.icon;

  // Handle accepting a suggestion
  const handleAcceptSuggestion = useCallback(async (suggestion) => {
    try {
      // Enforce selectionBehavior: at-most-one
      if (card.selectionBehavior === 'at-most-one' && acceptedSuggestionId) {
        return;
      }

      setSubmittingFeedback(true);
      setAcceptedSuggestionId(suggestion.uuid || suggestion.label);

      // Call parent handler to apply the suggestion
      if (onAcceptSuggestion) {
        await onAcceptSuggestion(suggestion);
      }

      // Send feedback to CDS service
      await cdsHooksClient.sendFeedback(serviceId, {
        feedback: [{
          card: card.uuid,
          outcome: 'accepted',
          outcomeTimestamp: new Date().toISOString(),
          acceptedSuggestions: [{ id: suggestion.uuid }]
        }]
      });

      setFeedbackSubmitted(true);
    } catch (error) {
      console.error('Error accepting suggestion:', error);
    } finally {
      setSubmittingFeedback(false);
    }
  }, [card.uuid, card.selectionBehavior, serviceId, onAcceptSuggestion, acceptedSuggestionId]);

  // Handle dismissing the card
  const handleDismiss = useCallback(async () => {
    // Check if override is required based on display behavior or explicit override reasons
    const requiresOverride = (card.displayBehavior?.acknowledgmentRequired) || 
                           (card.overrideReasons && card.overrideReasons.length > 0);
    
    if (requiresOverride) {
      // Show override reason dialog
      setShowOverrideDialog(true);
    } else {
      // Dismiss without reason
      await submitDismissal();
    }
  }, [card]);

  // Submit dismissal with or without reason
  const submitDismissal = useCallback(async (reasonKey = null, comment = null) => {
    try {
      setSubmittingFeedback(true);

      // Send feedback to CDS service
      const feedbackItem = {
        card: card.uuid,
        outcome: 'overridden',
        outcomeTimestamp: new Date().toISOString()
      };

      if (reasonKey || comment) {
        feedbackItem.overrideReason = {
          key: reasonKey || 'other',
          userComment: comment
        };
      }

      await cdsHooksClient.sendFeedback(serviceId, {
        feedback: [feedbackItem]
      });

      // Call parent handler
      if (onDismiss) {
        onDismiss(card, reasonKey, comment);
      }

      setFeedbackSubmitted(true);
      setShowOverrideDialog(false);
    } catch (error) {
      console.error('Error dismissing card:', error);
    } finally {
      setSubmittingFeedback(false);
    }
  }, [card, serviceId, onDismiss]);

  // Handle override dialog submission
  const handleOverrideSubmit = () => {
    submitDismissal(selectedOverrideReason, overrideComment);
  };

  // Don't show card if feedback was already submitted
  if (feedbackSubmitted) {
    return null;
  }

  return (
    <>
      <Card
        elevation={2}
        sx={{
          mb: 2,
          borderLeft: 4,
          borderLeftColor: indicatorConfig.color,
          backgroundColor: indicatorConfig.bgColor,
          '&:hover': {
            boxShadow: 4
          }
        }}
      >
        <CardContent>
          {/* Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <IndicatorIcon color={card.indicator} />
              <Typography variant="subtitle1" fontWeight="bold">
                {card.summary}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              {card.source && (
                <Chip
                  label={card.source.label}
                  size="small"
                  variant="outlined"
                  icon={card.source.icon && !iconError ? (
                    <img
                      src={card.source.icon}
                      alt={card.source.label}
                      width={16}
                      onError={() => setIconError(true)}
                    />
                  ) : null}
                />
              )}
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
              <IconButton
                size="small"
                onClick={handleDismiss}
                disabled={submittingFeedback}
              >
                <CancelIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Expanded Content */}
          <Collapse in={expanded}>
            {card.detail && (
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  {card.detail}
                </Typography>
              </Box>
            )}

            {/* Suggestions */}
            {card.suggestions && card.suggestions.length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Suggested Actions:
                  {card.selectionBehavior === 'at-most-one' && (
                    <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 1 }}>
                      (select one)
                    </Typography>
                  )}
                </Typography>
                <Stack spacing={1}>
                  {card.suggestions.map((suggestion, index) => {
                    const suggestionId = suggestion.uuid || suggestion.label;
                    const isAccepted = acceptedSuggestionId === suggestionId;
                    const isDisabledBySelection = card.selectionBehavior === 'at-most-one'
                      && acceptedSuggestionId
                      && !isAccepted;

                    return (
                      <Box key={suggestion.uuid || index}>
                        <Tooltip
                          title={suggestion.description || ''}
                          placement="top"
                          arrow
                          disableHoverListener={!suggestion.description}
                        >
                          <span>
                            <Button
                              variant={isAccepted ? "outlined" : "contained"}
                              size="small"
                              onClick={() => handleAcceptSuggestion(suggestion)}
                              disabled={submittingFeedback || isDisabledBySelection}
                              startIcon={
                                isAccepted ? <CheckIcon color="success" /> :
                                submittingFeedback ? <CircularProgress size={16} /> :
                                <CheckIcon />
                              }
                              fullWidth
                              sx={{ justifyContent: 'flex-start' }}
                            >
                              {suggestion.label}
                              {isAccepted && ' (accepted)'}
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* Links */}
            {card.links && card.links.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  References:
                </Typography>
                <Stack spacing={0.5}>
                  {card.links.map((link, index) => (
                    <Link
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {link.label}
                      <LaunchIcon sx={{ fontSize: 16 }} />
                    </Link>
                  ))}
                </Stack>
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Override Reason Dialog */}
      <Dialog
        open={showOverrideDialog}
        onClose={() => setShowOverrideDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <FeedbackIcon />
            Reason for Override
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Please provide a reason for overriding this recommendation. This helps improve our clinical decision support.
          </Alert>

          {(() => {
            // Use provided override reasons or default ones if acknowledgment is required
            const overrideReasons = card.overrideReasons && card.overrideReasons.length > 0
              ? card.overrideReasons
              : card.displayBehavior?.acknowledgmentRequired
              ? [
                  { code: 'clinical-judgment', display: 'Clinical judgment' },
                  { code: 'patient-preference', display: 'Patient preference' },
                  { code: 'alternative-treatment', display: 'Alternative treatment planned' },
                  { code: 'not-relevant', display: 'Not clinically relevant' },
                  { code: 'already-addressed', display: 'Already addressed' }
                ]
              : [];

            return overrideReasons.length > 0 ? (
              <FormControl component="fieldset" fullWidth>
                <RadioGroup
                  value={selectedOverrideReason}
                  onChange={(e) => setSelectedOverrideReason(e.target.value)}
                >
                  {overrideReasons.map((reason) => (
                    <FormControlLabel
                      key={reason.code}
                      value={reason.code}
                      control={<Radio />}
                      label={reason.display}
                    />
                  ))}
                  <FormControlLabel
                    value="other"
                    control={<Radio />}
                    label="Other (please specify)"
                  />
                </RadioGroup>
              </FormControl>
            ) : null;
          })()}

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Additional Comments (Optional)"
            value={overrideComment}
            onChange={(e) => setOverrideComment(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Please provide any additional context..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOverrideDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleOverrideSubmit}
            variant="contained"
            disabled={
              submittingFeedback ||
              (card.displayBehavior?.reasonRequired && !selectedOverrideReason && !overrideComment.trim()) ||
              (!card.displayBehavior?.reasonRequired && !selectedOverrideReason && !overrideComment.trim())
            }
            startIcon={submittingFeedback ? <CircularProgress size={16} /> : null}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CDSCard;