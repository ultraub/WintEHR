/**
 * CDS Documentation Prompts Component
 * Displays documentation prompts generated from CDS alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  NoteAdd as CreateNoteIcon
} from '@mui/icons-material';
import { cdsDocumentationService } from '../../../services/cdsDocumentationService';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

const CDSDocumentationPrompts = ({ 
  cdsAlerts = [],
  patientId,
  encounterId,
  onCreateNote,
  className = ''
}) => {
  const [prompts, setPrompts] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const { publish } = useClinicalWorkflow();

  // Generate documentation prompts from CDS alerts
  useEffect(() => {
    if (cdsAlerts.length > 0 && patientId) {
      generatePrompts();
    }
  }, [cdsAlerts, patientId, encounterId]);

  const generatePrompts = useCallback(async () => {
    try {
      const context = {
        patientId,
        encounterId,
        timestamp: new Date().toISOString()
      };

      const documentationPrompts = await cdsDocumentationService.generateDocumentationPrompts(
        cdsAlerts,
        context
      );

      setPrompts(documentationPrompts);
      
      // Store prompts in service for cross-component access
      documentationPrompts.forEach(prompt => {
        cdsDocumentationService.storePrompt(prompt);
      });

    } catch (error) {
      // Failed to generate documentation prompts
    }
  }, [cdsAlerts, patientId, encounterId]);

  const handleCreateNote = useCallback(async (prompt) => {
    try {
      // Publish workflow event
      await publish('DOCUMENTATION_PROMPT_ACCEPTED', {
        promptId: prompt.id,
        alertIds: prompt.linkedAlerts,
        patientId,
        encounterId,
        template: prompt.template
      });

      // Call parent handler to create note
      if (onCreateNote) {
        onCreateNote({
          template: prompt.template,
          content: prompt.content,
          title: prompt.title,
          linkedAlerts: prompt.linkedAlerts,
          context: prompt.context
        });
      }

      // Remove prompt after use
      handleDismissPrompt(prompt.id);

    } catch (error) {
      // Failed to create note from prompt
    }
  }, [onCreateNote, publish, patientId, encounterId]);

  const handleDismissPrompt = useCallback((promptId) => {
    setPrompts(prev => prev.filter(p => p.id !== promptId));
    cdsDocumentationService.clearPrompt(promptId);
    
    // Publish dismissal event
    publish('DOCUMENTATION_PROMPT_DISMISSED', {
      promptId,
      patientId,
      encounterId
    });
  }, [publish, patientId, encounterId]);

  const handlePreviewNote = useCallback((prompt) => {
    setSelectedPrompt(prompt);
    setShowPreview(true);
  }, []);

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical':
        return 'error.main';
      case 'warning':
        return 'warning.main';
      case 'info':
      default:
        return 'info.main';
    }
  };

  if (prompts.length === 0) {
    return null;
  }

  return (
    <Box className={className}>
      <Paper 
        elevation={2} 
        sx={{ 
          mb: 2,
          border: '1px solid',
          borderColor: 'primary.light',
          borderRadius: 2
        }}
      >
        <Box
          sx={{
            p: 2,
            backgroundColor: 'primary.light',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer'
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <DocumentIcon color="primary" />
            <Typography variant="h6" color="primary.main" sx={{ flexGrow: 1 }}>
              Documentation Prompts
            </Typography>
            <Chip 
              label={`${prompts.length} prompt${prompts.length !== 1 ? 's' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <IconButton size="small" color="primary">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        </Box>

        <Collapse in={expanded}>
          <List disablePadding>
            {prompts.map((prompt, index) => (
              <ListItem
                key={prompt.id}
                divider={index < prompts.length - 1}
                sx={{
                  borderLeft: `4px solid`,
                  borderLeftColor: getUrgencyColor(prompt.urgency),
                  backgroundColor: 'background.default'
                }}
              >
                <ListItemIcon>
                  {getUrgencyIcon(prompt.urgency)}
                </ListItemIcon>
                
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {prompt.title}
                      </Typography>
                      <Chip 
                        label={prompt.type.replace('_', ' ')}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    </Stack>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {prompt.description}
                      </Typography>
                      
                      {prompt.suggestedActions.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Suggested Actions:
                          </Typography>
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                            {prompt.suggestedActions.slice(0, 2).map((action, idx) => (
                              <Chip
                                key={`action-${action.description?.substring(0, 20) || ''}-${idx}`}
                                label={action.description}
                                size="small"
                                variant="outlined"
                                color="secondary"
                              />
                            ))}
                            {prompt.suggestedActions.length > 2 && (
                              <Chip
                                label={`+${prompt.suggestedActions.length - 2} more`}
                                size="small"
                                variant="outlined"
                                color="secondary"
                              />
                            )}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  }
                />

                <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
                  <Tooltip title="Preview note content">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DocumentIcon />}
                      onClick={() => handlePreviewNote(prompt)}
                    >
                      Preview
                    </Button>
                  </Tooltip>
                  
                  <Tooltip title="Create note from prompt">
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CreateNoteIcon />}
                      onClick={() => handleCreateNote(prompt)}
                      color="primary"
                    >
                      Create Note
                    </Button>
                  </Tooltip>
                  
                  <Tooltip title="Dismiss prompt">
                    <IconButton
                      size="small"
                      onClick={() => handleDismissPrompt(prompt.id)}
                      color="error"
                    >
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </Paper>

      {/* Note Preview Dialog */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DocumentIcon />
            <Typography variant="h6">
              Preview: {selectedPrompt?.title}
            </Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This note will be pre-populated with CDS alert information. You can edit it before saving.
          </Alert>
          
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              backgroundColor: 'grey.50',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: 400,
              overflow: 'auto'
            }}
          >
            <Typography variant="body2">
              {selectedPrompt?.content}
            </Typography>
          </Paper>

          {selectedPrompt?.suggestedActions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Suggested Actions:
              </Typography>
              <Stack spacing={1}>
                {selectedPrompt.suggestedActions.map((action, index) => (
                  <Chip
                    key={`bullet-${bullet.substring(0, 20)}-${index}`}
                    label={action.description}
                    variant="outlined"
                    color="primary"
                    size="small"
                  />
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<CreateNoteIcon />}
            onClick={() => {
              setShowPreview(false);
              handleCreateNote(selectedPrompt);
            }}
          >
            Create Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CDSDocumentationPrompts;